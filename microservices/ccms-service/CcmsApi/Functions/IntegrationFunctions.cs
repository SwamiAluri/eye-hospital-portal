using System.Net;
using System.Text.Json;
using CcmsApi.Services;
using Microsoft.Azure.Functions.Worker;
using Microsoft.Azure.Functions.Worker.Http;
using Microsoft.Extensions.Logging;

namespace CcmsApi.Functions;

/// <summary>
/// Cross-service integration endpoints.
/// - counselling-completed: called by auth-service (fire-and-forget) when a counselling session completes
/// - validate-admission: called by ip-service before admitting a patient
/// </summary>
public class IntegrationFunctions
{
    private readonly CoverageCaseService _caseService;
    private readonly JwtService _jwt;
    private readonly ILogger<IntegrationFunctions> _log;

    public IntegrationFunctions(
        CoverageCaseService caseService,
        JwtService jwt,
        ILogger<IntegrationFunctions> log)
    {
        _caseService = caseService;
        _jwt         = jwt;
        _log         = log;
    }

    // POST /api/ccms/integration/counselling-completed
    // Called by auth-service CounselingWorkflowService (fire-and-forget, internal auth)
    [Function("CounsellingCompleted")]
    public async Task<HttpResponseData> CounsellingCompleted(
        [HttpTrigger(AuthorizationLevel.Anonymous, "post", Route = "ccms/integration/counselling-completed")] HttpRequestData req)
    {
        // Accept internal service-to-service key OR valid JWT
        bool authorized = _jwt.TryValidateInternalKey(req)
            || _jwt.ValidateAndExtract(req, out _, out _);

        if (!authorized)
            return req.CreateResponse(HttpStatusCode.Unauthorized);

        CounsellingCompletedPayload? body;
        try
        {
            body = await JsonSerializer.DeserializeAsync<CounsellingCompletedPayload>(req.Body);
        }
        catch
        {
            return req.CreateResponse(HttpStatusCode.BadRequest);
        }

        if (body is null || body.TenantId == Guid.Empty)
            return req.CreateResponse(HttpStatusCode.BadRequest);

        _log.LogInformation(
            "Counselling completed for session {SessionId}, payerType={PayerType}",
            body.SessionId, body.PaymentType);

        // Create a CCMS coverage case if payment is insurance/TPA/GovtScheme and preauth is required
        var requiresCcms = body.PaymentType is "Insurance" or "TPA" or "GovernmentScheme"
                           && !body.NotRequiredPreAuth;

        if (requiresCcms && body.SessionId.HasValue)
        {
            // Check if case already exists for this session
            var existing = await _caseService.GetBySessionIdAsync(body.SessionId.Value);
            if (existing is null)
            {
                var createReq = new CreateCoverageCaseRequest(
                    PatientId:          body.PatientId ?? Guid.Empty,
                    PatientName:        body.PatientName,
                    SessionId:          body.SessionId,
                    CounselingSessionId: null,
                    JourneyId:          body.JourneyId,
                    FinancialYearId:    null,
                    BranchId:           body.BranchId,
                    DoctorId:           body.DoctorId,
                    PayerType:          body.PaymentType,
                    PaymentType:        body.PaymentType,
                    InsuranceProviderId: body.InsuranceProviderId,
                    TpaProviderId:      body.TpaProviderId,
                    GovernmentSchemeId: body.GovernmentSchemeId,
                    CoveragePackageId:  body.PackageId,
                    LegacyPreauthId:    body.LegacyPreauthId,
                    SessionPreauthId:   body.SessionPreauthId
                );

                await _caseService.CreateAsync(body.TenantId, body.ActorUserId ?? Guid.Empty, createReq);
                _log.LogInformation("Auto-created CCMS coverage case for session {SessionId}", body.SessionId);
            }
        }

        return req.CreateResponse(HttpStatusCode.OK);
    }

    // GET /api/ccms/integration/validate-admission
    // Called by ip-service PatientJourneyService.AdmitAsync()
    // Query params: patientId, sessionId, journeyId, tenantId
    [Function("ValidateAdmission")]
    public async Task<HttpResponseData> ValidateAdmission(
        [HttpTrigger(AuthorizationLevel.Anonymous, "get", Route = "ccms/integration/validate-admission")] HttpRequestData req)
    {
        // Accept internal service key OR JWT
        bool authorized = _jwt.TryValidateInternalKey(req)
            || _jwt.ValidateAndExtract(req, out _, out _);

        if (!authorized)
            return req.CreateResponse(HttpStatusCode.Unauthorized);

        Guid.TryParse(req.Query["journeyId"],  out var journeyId);
        Guid.TryParse(req.Query["sessionId"],  out var sessionId);
        Guid.TryParse(req.Query["tenantId"],   out var tenantId);

        var result = await _caseService.ValidateAdmissionAsync(
            tenantId,
            journeyId == Guid.Empty ? null : journeyId,
            sessionId == Guid.Empty ? null : sessionId);

        var resp = req.CreateResponse(result.Allowed
            ? HttpStatusCode.OK
            : HttpStatusCode.OK);  // Always 200 — blocked flag is in body

        await resp.WriteAsJsonAsync(result);
        return resp;
    }

    // POST /api/ccms/integration/surgery-completed
    // Fire-and-forget from ip-service when surgery is marked complete
    [Function("SurgeryCompleted")]
    public async Task<HttpResponseData> SurgeryCompleted(
        [HttpTrigger(AuthorizationLevel.Anonymous, "post", Route = "ccms/integration/surgery-completed")] HttpRequestData req)
    {
        if (!_jwt.TryValidateInternalKey(req) && !_jwt.ValidateAndExtract(req, out _, out _))
            return req.CreateResponse(HttpStatusCode.Unauthorized);

        var body = await JsonSerializer.DeserializeAsync<JourneyEventPayload>(req.Body);
        if (body?.JourneyId is null) return req.CreateResponse(HttpStatusCode.BadRequest);

        var coverageCase = await _caseService.GetByJourneyIdAsync(body.JourneyId.Value);
        if (coverageCase is not null)
        {
            _log.LogInformation("Surgery completed for journey {JourneyId}, CCMS case {CaseId}",
                body.JourneyId, coverageCase.Id);
            // Future: trigger bill preparation workflow step
        }

        return req.CreateResponse(HttpStatusCode.OK);
    }

    // POST /api/ccms/integration/patient-discharged
    [Function("PatientDischarged")]
    public async Task<HttpResponseData> PatientDischarged(
        [HttpTrigger(AuthorizationLevel.Anonymous, "post", Route = "ccms/integration/patient-discharged")] HttpRequestData req)
    {
        if (!_jwt.TryValidateInternalKey(req) && !_jwt.ValidateAndExtract(req, out _, out _))
            return req.CreateResponse(HttpStatusCode.Unauthorized);

        var body = await JsonSerializer.DeserializeAsync<JourneyEventPayload>(req.Body);
        if (body?.JourneyId is null) return req.CreateResponse(HttpStatusCode.BadRequest);

        var coverageCase = await _caseService.GetByJourneyIdAsync(body.JourneyId.Value);
        if (coverageCase is not null)
        {
            _log.LogInformation("Patient discharged for journey {JourneyId}, CCMS case {CaseId}",
                body.JourneyId, coverageCase.Id);
            // Future: trigger bill finalization step
        }

        return req.CreateResponse(HttpStatusCode.OK);
    }
}

// ── Payload types ─────────────────────────────────────────────────────────────

public record CounsellingCompletedPayload(
    Guid    TenantId,
    Guid?   SessionId,
    Guid?   JourneyId,
    Guid?   PatientId,
    string? PatientName,
    string  PaymentType,
    bool    NotRequiredPreAuth,
    Guid?   BranchId,
    Guid?   DoctorId,
    Guid?   InsuranceProviderId,
    Guid?   TpaProviderId,
    Guid?   GovernmentSchemeId,
    Guid?   PackageId,
    Guid?   LegacyPreauthId,
    Guid?   SessionPreauthId,
    Guid?   ActorUserId
);

public record JourneyEventPayload(
    Guid?   JourneyId,
    Guid?   SessionId,
    Guid?   PatientId,
    string? EventType
);
