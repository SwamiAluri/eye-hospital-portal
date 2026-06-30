using System.Collections.Concurrent;
using System.Net;
using System.Text.Json;
using CcmsApi.Services;
using Microsoft.Azure.Functions.Worker;
using Microsoft.Azure.Functions.Worker.Http;
using Microsoft.Extensions.Caching.Memory;
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
    private readonly TpaInboundEmailService _tpaInbound;
    private readonly IWorkflowEngine _workflow;
    private readonly JwtService _jwt;
    private readonly IMemoryCache _cache;
    private readonly ILogger<IntegrationFunctions> _log;

    public IntegrationFunctions(
        CoverageCaseService caseService,
        TpaInboundEmailService tpaInbound,
        IWorkflowEngine workflow,
        JwtService jwt,
        IMemoryCache cache,
        ILogger<IntegrationFunctions> log)
    {
        _caseService = caseService;
        _tpaInbound  = tpaInbound;
        _workflow    = workflow;
        _jwt         = jwt;
        _cache       = cache;
        _log         = log;
    }

    /// <summary>
    /// Checks the X-Idempotency-Key header. Returns true if this is a duplicate request
    /// (key was seen within the last 24 h). Records the key on first encounter.
    /// </summary>
    private bool IsDuplicate(HttpRequestData req, out string key)
    {
        key = req.Headers.TryGetValues("X-Idempotency-Key", out var vals)
            ? vals.FirstOrDefault() ?? string.Empty
            : string.Empty;
        if (string.IsNullOrWhiteSpace(key)) return false;

        var cacheKey = $"idempotency:{key}";
        if (_cache.TryGetValue(cacheKey, out _))
        {
            _log.LogInformation("Duplicate integration request suppressed (key={Key})", key);
            return true;
        }
        _cache.Set(cacheKey, 1, TimeSpan.FromHours(24));
        return false;
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

        if (IsDuplicate(req, out var idempKey))
            return req.CreateResponse(HttpStatusCode.OK); // return 200 for idempotent replay

        CounsellingCompletedPayload? body;
        try
        {
            body = await JsonSerializer.DeserializeAsync<CounsellingCompletedPayload>(
                req.Body, Services.HttpRequestDataExtensions.DeserializeOpts);
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

        // Create a CCMS coverage case if payment requires coverage workflow and preauth is required
        var ccmsPaymentTypes = new HashSet<string>(StringComparer.OrdinalIgnoreCase)
        {
            "Insurance", "TPA", "CoPay", "CGHS", "SGHS", "GovernmentScheme", "ESH", "Arograshree", "Railway",
        };
        var requiresCcms = ccmsPaymentTypes.Contains(body.PaymentType ?? "")
                           && !body.NotRequiredPreAuth;

        if (requiresCcms && body.SessionId.HasValue)
        {
            // Check if case already exists for this session
            var existing = await _caseService.GetBySessionIdAsync(body.SessionId.Value);
            if (existing is null)
            {
                var payerType = MapIntegrationPayerType(body.PaymentType);
                var createReq = new CreateCoverageCaseRequest(
                    PatientId:          body.PatientId ?? Guid.Empty,
                    PatientName:        body.PatientName,
                    SessionId:          body.SessionId,
                    CounselingSessionId: null,
                    JourneyId:          body.JourneyId,
                    FinancialYearId:    null,
                    BranchId:           body.BranchId,
                    DoctorId:           body.DoctorId,
                    PayerType:          payerType,
                    PaymentType:        body.PaymentType,
                    InsuranceProviderId: body.InsuranceProviderId,
                    TpaProviderId:      body.TpaProviderId,
                    GovernmentSchemeId: body.GovernmentSchemeId,
                    CoveragePackageId:  body.PackageId,
                    LegacyPreauthId:    body.LegacyPreauthId,
                    SessionPreauthId:   body.SessionPreauthId,
                    InsurerName:        body.InsurerName,
                    EstimatedAmount:    body.EstimatedAmount,
                    CounsellorDraftJson: body.CounsellorDraftJson
                );

                await _caseService.CreateAsync(body.TenantId, body.ActorUserId ?? Guid.Empty, createReq);
                _log.LogInformation("Auto-created CCMS coverage case for session {SessionId}", body.SessionId);
            }
        }

        return req.CreateResponse(HttpStatusCode.OK);
    }

    private static string MapIntegrationPayerType(string? paymentType) => paymentType switch
    {
        "TPA"                                              => "tpa",
        "CoPay" or "Insurance" or "ESH"                    => "insurance",
        "CGHS" or "SGHS" or "GovernmentScheme"
            or "Arograshree" or "Railway"                  => "govt",
        _                                                  => "insurance",
    };

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

        if (IsDuplicate(req, out _)) return req.CreateResponse(HttpStatusCode.OK);

        var body = await JsonSerializer.DeserializeAsync<JourneyEventPayload>(req.Body);
        if (body?.JourneyId is null) return req.CreateResponse(HttpStatusCode.BadRequest);

        var coverageCase = await _caseService.GetByJourneyIdAsync(body.JourneyId.Value);
        if (coverageCase is not null && coverageCase.WorkflowInstanceId.HasValue)
        {
            _log.LogInformation("Surgery completed for journey {JourneyId}, CCMS case {CaseId} — firing COMPLETE_SURGERY",
                body.JourneyId, coverageCase.Id);
            try
            {
                await _workflow.FireAsync(
                    coverageCase.WorkflowInstanceId.Value,
                    "COMPLETE_SURGERY",
                    body.ActorUserId ?? Guid.Empty,
                    "Surgery marked complete via ip-service callback",
                    CancellationToken.None);
            }
            catch (Exception ex)
            {
                // Non-blocking — workflow may already be past this state
                _log.LogWarning(ex, "COMPLETE_SURGERY fire failed for case {CaseId} (may be benign if state already advanced)", coverageCase.Id);
            }
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

        if (IsDuplicate(req, out _)) return req.CreateResponse(HttpStatusCode.OK);

        var body = await JsonSerializer.DeserializeAsync<JourneyEventPayload>(req.Body);
        if (body?.JourneyId is null) return req.CreateResponse(HttpStatusCode.BadRequest);

        var coverageCase = await _caseService.GetByJourneyIdAsync(body.JourneyId.Value);
        if (coverageCase is not null && coverageCase.WorkflowInstanceId.HasValue)
        {
            _log.LogInformation("Patient discharged for journey {JourneyId}, CCMS case {CaseId} — firing GENERATE_BILL",
                body.JourneyId, coverageCase.Id);
            try
            {
                await _workflow.FireAsync(
                    coverageCase.WorkflowInstanceId.Value,
                    "GENERATE_BILL",
                    body.ActorUserId ?? Guid.Empty,
                    "Patient discharged via ip-service callback",
                    CancellationToken.None);
            }
            catch (Exception ex)
            {
                _log.LogWarning(ex, "GENERATE_BILL fire failed for case {CaseId} (may be benign if state already advanced)", coverageCase.Id);
            }
        }

        return req.CreateResponse(HttpStatusCode.OK);
    }

    // POST /api/ccms/integration/bill-finalized
    // Called by billing service when the final bill is locked (fire-and-forget)
    [Function("BillFinalized")]
    public async Task<HttpResponseData> BillFinalized(
        [HttpTrigger(AuthorizationLevel.Anonymous, "post", Route = "ccms/integration/bill-finalized")] HttpRequestData req)
    {
        if (!_jwt.TryValidateInternalKey(req) && !_jwt.ValidateAndExtract(req, out _, out _))
            return req.CreateResponse(HttpStatusCode.Unauthorized);

        if (IsDuplicate(req, out _)) return req.CreateResponse(HttpStatusCode.OK);

        BillFinalizedPayload? body;
        try
        {
            body = await System.Text.Json.JsonSerializer.DeserializeAsync<BillFinalizedPayload>(req.Body);
        }
        catch
        {
            return req.CreateResponse(HttpStatusCode.BadRequest);
        }

        if (body?.JourneyId is null && body?.SessionId is null)
            return req.CreateResponse(HttpStatusCode.BadRequest);

        var coverageCase = body.JourneyId.HasValue
            ? await _caseService.GetByJourneyIdAsync(body.JourneyId.Value)
            : body.SessionId.HasValue
                ? await _caseService.GetBySessionIdAsync(body.SessionId.Value)
                : null;

        if (coverageCase is null)
        {
            _log.LogInformation("BillFinalized: no CCMS case found for journey {J} / session {S} — ignoring",
                body.JourneyId, body.SessionId);
            return req.CreateResponse(HttpStatusCode.OK);
        }

        if (coverageCase.WorkflowInstanceId.HasValue)
        {
            _log.LogInformation("Bill finalized for CCMS case {CaseId} — firing FINALIZE_BILL", coverageCase.Id);
            try
            {
                await _workflow.FireAsync(
                    coverageCase.WorkflowInstanceId.Value,
                    "FINALIZE_BILL",
                    body.ActorUserId ?? Guid.Empty,
                    $"Bill finalized (billId={body.BillId})",
                    CancellationToken.None);
            }
            catch (Exception ex)
            {
                _log.LogWarning(ex, "FINALIZE_BILL fire failed for case {CaseId} (may be benign)", coverageCase.Id);
            }
        }

        return req.CreateResponse(HttpStatusCode.OK);
    }

    // POST /api/ccms/integration/tpa-inbound-email
    [Function("TpaInboundEmail")]
    public async Task<HttpResponseData> TpaInboundEmail(
        [HttpTrigger(AuthorizationLevel.Anonymous, "post", Route = "ccms/integration/tpa-inbound-email")] HttpRequestData req)
    {
        bool authorized = _jwt.TryValidateInternalKey(req)
            || _jwt.ValidateAndExtract(req, out _, out _);

        if (!authorized)
            return req.CreateResponse(HttpStatusCode.Unauthorized);

        TpaInboundEmailPayload? body;
        try
        {
            body = await JsonSerializer.DeserializeAsync<TpaInboundEmailPayload>(
                req.Body, Services.HttpRequestDataExtensions.DeserializeOpts);
        }
        catch
        {
            return req.CreateResponse(HttpStatusCode.BadRequest);
        }

        if (body is null || string.IsNullOrWhiteSpace(body.Body))
        {
            var bad = req.CreateResponse(HttpStatusCode.BadRequest);
            await bad.WriteStringAsync("body is required.");
            return bad;
        }

        try
        {
            var result = await _tpaInbound.IngestAsync(new TpaInboundEmailRequest(
                body.FromAddress,
                body.Subject,
                body.Body,
                body.ExternalMessageId,
                body.InReplyToMessageId,
                body.CoverageCaseId,
                body.ReceivedAt));

            var resp = req.CreateResponse(HttpStatusCode.Created);
            await resp.WriteAsJsonAsync(new
            {
                logId = result.LogId,
                coverageCaseId = result.CoverageCaseId,
                caseNumber = result.CaseNumber,
                parse = result.Parse,
            });
            return resp;
        }
        catch (KeyNotFoundException ex)
        {
            var nf = req.CreateResponse(HttpStatusCode.NotFound);
            await nf.WriteStringAsync(ex.Message);
            return nf;
        }
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
    Guid?   ActorUserId,
    string? InsurerName = null,
    decimal? EstimatedAmount = null,
    string? CounsellorDraftJson = null
);

public record JourneyEventPayload(
    Guid?   JourneyId,
    Guid?   SessionId,
    Guid?   PatientId,
    string? EventType,
    Guid?   ActorUserId = null
);

public record BillFinalizedPayload(
    Guid?    JourneyId,
    Guid?    SessionId,
    Guid?    BillId,
    decimal? TotalAmount,
    Guid?    ActorUserId = null
);

public record TpaInboundEmailPayload(
    string?  FromAddress,
    string?  Subject,
    string?  Body,
    string?  ExternalMessageId,
    string?  InReplyToMessageId,
    Guid?    CoverageCaseId,
    DateTime? ReceivedAt
);
