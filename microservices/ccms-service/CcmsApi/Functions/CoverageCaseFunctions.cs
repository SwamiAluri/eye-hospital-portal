using System.Net;
using System.Text.Json;
using CcmsApi.Data;
using CcmsApi.Models.Dtos;
using CcmsApi.Services;
using Microsoft.Azure.Functions.Worker;
using Microsoft.Azure.Functions.Worker.Http;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;

namespace CcmsApi.Functions;

public class CoverageCaseFunctions
{
    private readonly CoverageCaseService _svc;
    private readonly CoverageCaseWorkspaceService _workspaceSvc;
    private readonly PreAuthorizationService _preAuthSvc;
    private readonly JwtService _jwt;
    private readonly IWorkflowEngine _workflow;
    private readonly CcmsDbContext _db;
    private readonly ILogger<CoverageCaseFunctions> _log;

    public CoverageCaseFunctions(
        CoverageCaseService svc,
        CoverageCaseWorkspaceService workspaceSvc,
        PreAuthorizationService preAuthSvc,
        JwtService jwt,
        IWorkflowEngine workflow,
        CcmsDbContext db,
        ILogger<CoverageCaseFunctions> log)
    {
        _svc            = svc;
        _workspaceSvc   = workspaceSvc;
        _preAuthSvc     = preAuthSvc;
        _jwt        = jwt;
        _workflow   = workflow;
        _db         = db;
        _log        = log;
    }

    // POST /api/ccms/coverage-cases
    [Function("CreateCoverageCase")]
    public async Task<HttpResponseData> Create(
        [HttpTrigger(AuthorizationLevel.Anonymous, "post", Route = "ccms/coverage-cases")] HttpRequestData req)
    {
        if (!_jwt.ValidateAndExtract(req, out var claims, out var err))
            return await req.UnauthorizedAsync(err);

        var body = await JsonSerializer.DeserializeAsync<CreateCoverageCaseRequest>(req.Body, CcmsApi.Services.HttpRequestDataExtensions.DeserializeOpts);
        if (body is null) return req.CreateResponse(HttpStatusCode.BadRequest);

        try
        {
            var entity = await _svc.CreateAsync(claims!.TenantId, claims.UserId, body);
            var dto    = await _svc.GetByIdAsync(entity.Id) ?? (object)new { id = entity.Id };
            return await req.CreatedJsonAsync(dto);
        }
        catch (Exception ex)
        {
            _log.LogError(ex, "Error creating coverage case");
            return await req.OkJsonAsync(new { error = ex.Message });
        }
    }

    // GET /api/ccms/coverage-cases/{id}
    [Function("GetCoverageCase")]
    public async Task<HttpResponseData> GetById(
        [HttpTrigger(AuthorizationLevel.Anonymous, "get", Route = "ccms/coverage-cases/{id:guid}")] HttpRequestData req, Guid id)
    {
        if (!_jwt.ValidateAndExtract(req, out var claims, out var err))
            return await req.UnauthorizedAsync(err);

        var item = await _svc.GetByIdAsync(id);
        if (item is null) return req.CreateResponse(HttpStatusCode.NotFound);
        return await req.OkJsonAsync(item);
    }

    // GET /api/ccms/coverage-cases/{id}/workspace?sections=policies,preauths,billing,...
    [Function("GetCoverageCaseWorkspace")]
    public async Task<HttpResponseData> GetWorkspace(
        [HttpTrigger(AuthorizationLevel.Anonymous, "get", Route = "ccms/coverage-cases/{id:guid}/workspace")] HttpRequestData req, Guid id)
    {
        if (!_jwt.ValidateAndExtract(req, out var claims, out var err))
            return await req.UnauthorizedAsync(err);

        var sections = WorkspaceSections.Parse(req.Query["sections"]);
        var workspace = await _workspaceSvc.GetAsync(id, sections);
        if (workspace is null) return req.CreateResponse(HttpStatusCode.NotFound);
        return await req.OkJsonAsync(workspace);
    }

    // GET /api/ccms/coverage-cases?state=&payerType=&search=&page=&pageSize=
    [Function("ListCoverageCases")]
    public async Task<HttpResponseData> List(
        [HttpTrigger(AuthorizationLevel.Anonymous, "get", Route = "ccms/coverage-cases")] HttpRequestData req)
    {
        if (!_jwt.ValidateAndExtract(req, out var claims, out var err))
            return await req.UnauthorizedAsync(err);

        var state     = req.Query["state"];
        var payerType = req.Query["payerType"];
        var search    = req.Query["search"];
        int.TryParse(req.Query["pageNumber"], out var page);
        if (page == 0) int.TryParse(req.Query["page"], out page);
        int.TryParse(req.Query["pageSize"], out var pageSize);

        var result = await _svc.ListAsync(
            claims!.TenantId, state, payerType, null,
            page > 0 ? page : 1, pageSize > 0 ? pageSize : 20,
            search: string.IsNullOrWhiteSpace(search) ? null : search);
        // Return with field names matching the frontend CasesListResponse interface
        return await req.OkJsonAsync(new
        {
            cases      = result.Items,
            totalCount = result.Total,
            pageNumber = result.Page,
            pageSize   = result.PageSize,
        });
    }

    // GET /api/ccms/coverage-cases/by-session/{sessionId}
    // Returns the full coverage case for a given counselling session, or 204 if none exists yet.
    [Function("GetCoverageCaseBySession")]
    public async Task<HttpResponseData> BySession(
        [HttpTrigger(AuthorizationLevel.Anonymous, "get", Route = "ccms/coverage-cases/by-session/{sessionId:guid}")] HttpRequestData req,
        Guid sessionId)
    {
        if (!_jwt.ValidateAndExtract(req, out var claims, out var err))
            return await req.UnauthorizedAsync(err);

        var coverageCase = await _svc.GetBySessionIdAsync(sessionId);
        if (coverageCase is null) return req.CreateResponse(HttpStatusCode.NoContent);

        // Return the full entity (same shape as GET /coverage-cases/{id})
        var dto = await _svc.GetByIdAsync(coverageCase.Id);
        return await req.OkJsonAsync(dto);
    }

    // POST /api/ccms/coverage-cases/by-sessions
    // Body: { "sessionIds": ["uuid1","uuid2",...] }
    // Returns lightweight summary DTO (not full entity) to minimize payload for waiting-list badges.
    [Function("GetCoverageCasesBySessions")]
    public async Task<HttpResponseData> BySessions(
        [HttpTrigger(AuthorizationLevel.Anonymous, "post", Route = "ccms/coverage-cases/by-sessions")] HttpRequestData req)
    {
        if (!_jwt.ValidateAndExtract(req, out var claims, out var err))
            return await req.UnauthorizedAsync(err);

        var body = await JsonSerializer.DeserializeAsync<BySessionsRequest>(req.Body, CcmsApi.Services.HttpRequestDataExtensions.DeserializeOpts);
        if (body?.SessionIds is null || body.SessionIds.Count == 0)
            return req.CreateResponse(HttpStatusCode.BadRequest);

        var list = await _svc.GetBySessionIdsAsync(body.SessionIds);

        // Map to lightweight summary DTO with display-ready fields
        var dto = list.Select(c => new
        {
            id                 = c.Id,
            caseNumber         = c.CaseNumber,
            sessionId          = c.SessionId,
            currentState       = c.CurrentState,
            stateLabel         = StateLabel(c.CurrentState),
            stateColor         = StateColor(c.CurrentState),
            payerType          = c.PayerType,
            paymentType        = c.PaymentType,
            preAuthNumber      = c.PreAuthNumber,
            approvedAmount     = c.ApprovedAmount,
            isDraft            = c.IsDraft,
            draftSavedAt       = c.DraftSavedAt,
            workflowInstanceId = c.WorkflowInstanceId,
        });

        return await req.OkJsonAsync(dto);
    }

    private static string StateLabel(string state) => state switch {
        "DRAFT"                   => "Draft",
        "ELIGIBILITY_PENDING"     => "Eligibility Check",
        "ELIGIBILITY_VERIFIED"    => "Eligibility OK",
        "PREAUTH_GENERATED"       => "Pre-Auth Ready",
        "PREAUTH_SENT"            => "Pre-Auth Sent",
        "WAITING_APPROVAL"        => "Awaiting TPA",
        "APPROVED"                => "Approved",
        "PARTIAL_APPROVAL"        => "Partial Approval",
        "REJECTED"                => "Rejected",
        "CLARIFICATION_REQUIRED"  => "Clarification Needed",
        "BILL_PENDING"            => "Bill Pending",
        "CLAIM_RAISED"            => "Claim Raised",
        "FULL_SETTLEMENT"         => "Settled",
        "CLOSED"                  => "Closed",
        _                         => state
    };

    private static string StateColor(string state) => state switch {
        "DRAFT"                   => "gray",
        "ELIGIBILITY_PENDING"     => "amber",
        "ELIGIBILITY_VERIFIED"    => "blue",
        "PREAUTH_GENERATED"       => "indigo",
        "PREAUTH_SENT"            => "indigo",
        "WAITING_APPROVAL"        => "amber",
        "APPROVED"                => "emerald",
        "PARTIAL_APPROVAL"        => "teal",
        "REJECTED"                => "red",
        "CLARIFICATION_REQUIRED"  => "orange",
        "BILL_PENDING"            => "purple",
        "CLAIM_RAISED"            => "violet",
        "FULL_SETTLEMENT"         => "emerald",
        "CLOSED"                  => "gray",
        _                         => "gray"
    };

    // POST /api/ccms/coverage-cases/{id}/transition
    // Body: { "triggerEvent": "string", "notes": "string" }
    [Function("FireCoverageCaseTransition")]
    public async Task<HttpResponseData> FireTransition(
        [HttpTrigger(AuthorizationLevel.Anonymous, "post", Route = "ccms/coverage-cases/{id:guid}/transition")] HttpRequestData req, Guid id)
    {
        if (!_jwt.ValidateAndExtract(req, out var claims, out var err))
            return await req.UnauthorizedAsync(err);

        var body = await JsonSerializer.DeserializeAsync<FireTransitionRequest>(req.Body, CcmsApi.Services.HttpRequestDataExtensions.DeserializeOpts);
        if (body is null) return req.CreateResponse(HttpStatusCode.BadRequest);

        var coverageCase = await _svc.GetByIdAsync(id);
        if (coverageCase is null) return req.CreateResponse(HttpStatusCode.NotFound);

        if (!coverageCase.WorkflowInstanceId.HasValue)
        {
            var resp = req.CreateResponse(HttpStatusCode.BadRequest);
            await resp.WriteAsJsonAsync(new { error = "No workflow instance attached to this case." });
            return resp;
        }

        var blockReason = WorkflowTransitionPolicy.GetRawTransitionBlockReason(
            body.TriggerEvent, claims!.SafePermissions);
        if (blockReason is not null)
        {
            var blocked = req.CreateResponse(HttpStatusCode.UnprocessableEntity);
            await blocked.WriteAsJsonAsync(new { error = blockReason, code = "USE_DOMAIN_API" });
            return blocked;
        }

        var result = await _workflow.FireAsync(
            coverageCase.WorkflowInstanceId.Value,
            body.TriggerEvent, claims!.UserId, body.Notes);

        if (!result.Success)
        {
            var resp = req.CreateResponse(HttpStatusCode.UnprocessableEntity);
            await resp.WriteAsJsonAsync(new { error = result.ErrorMessage });
            return resp;
        }

        await _svc.SyncStateFromWorkflowAsync(id, claims.UserId);
        var updatedCase = await _svc.GetByIdAsync(id);
        return await req.OkJsonAsync(updatedCase);
    }

    // PATCH /api/ccms/coverage-cases/{id}
    // Saves counsellor-entered insurance + cost estimate details as a draft.
    // All fields are optional; only supplied fields are stored (as a JSON blob).
    [Function("PatchCoverageCase")]
    public async Task<HttpResponseData> Patch(
        [HttpTrigger(AuthorizationLevel.Anonymous, "patch", Route = "ccms/coverage-cases/{id:guid}")] HttpRequestData req, Guid id)
    {
        if (!_jwt.ValidateAndExtract(req, out var claims, out var err))
            return await req.UnauthorizedAsync(err);

        var body = await JsonSerializer.DeserializeAsync<PatchCoverageCaseRequest>(
            req.Body, CcmsApi.Services.HttpRequestDataExtensions.DeserializeOpts);
        if (body is null) return req.CreateResponse(HttpStatusCode.BadRequest);

        try
        {
            await _svc.PatchDraftAsync(id, claims!.UserId, body);
            var dto = await _svc.GetByIdAsync(id);
            return await req.OkJsonAsync(dto);
        }
        catch (KeyNotFoundException)
        {
            return req.CreateResponse(HttpStatusCode.NotFound);
        }
        catch (Exception ex)
        {
            _log.LogError(ex, "Error patching coverage case {Id}", id);
            var resp = req.CreateResponse(HttpStatusCode.InternalServerError);
            await resp.WriteAsJsonAsync(new { error = ex.Message });
            return resp;
        }
    }

    // POST /api/ccms/coverage-cases/{id}/submit-to-claims
    // Counsellor submits the completed draft for claims team review.
    // Internally: generates a pre-auth record and marks it sent.
    [Function("SubmitCoverageToClaimsTeam")]
    public async Task<HttpResponseData> SubmitToClaims(
        [HttpTrigger(AuthorizationLevel.Anonymous, "post", Route = "ccms/coverage-cases/{id:guid}/submit-to-claims")] HttpRequestData req, Guid id)
    {
        if (!_jwt.ValidateAndExtract(req, out var claims, out var err))
            return await req.UnauthorizedAsync(err);

        var body = await JsonSerializer.DeserializeAsync<SubmitToClaimsRequest>(
            req.Body, CcmsApi.Services.HttpRequestDataExtensions.DeserializeOpts);

        try
        {
            var coverageCase = await _svc.GetByIdAsync(id)
                ?? throw new KeyNotFoundException($"Coverage case {id} not found.");

            // Guard: must have a primary visit policy (non-negotiable before generating pre-auth)
            var primaryPolicy = await _db.VisitInsurancePolicies
                .AsNoTracking()
                .Where(p => p.CoverageCase_Id == id && p.IsPrimary == true && p.DeletedAt == null)
                .FirstOrDefaultAsync();
            if (primaryPolicy is null)
            {
                var badReq = req.CreateResponse(HttpStatusCode.UnprocessableEntity);
                await badReq.WriteAsJsonAsync(new { error = "No primary visit policy found. Please capture and mark a policy as primary before submitting." });
                return badReq;
            }

            // Generate pre-auth record (clinical + financial from submit request)
            var preAuthReq = new GeneratePreAuthRequest(
                RequestedAmount:    body?.RequestedAmount ?? 0,
                RoomClassRequested: body?.RoomClassRequested,
                DiagnosisJson:      body?.DiagnosisCodes is { Count: > 0 }
                    ? JsonSerializer.Serialize(body.DiagnosisCodes) : null,
                ProceduresJson:     body?.ProcedureCodes is { Count: > 0 }
                    ? JsonSerializer.Serialize(body.ProcedureCodes) : null,
                ClinicalSummary:    body?.ClinicalNotes,
                EstimatedTotalCost: body?.EstimatedTotalCost ?? 0,
                ServiceTaxAmount:   body?.ServiceTaxAmount   ?? 0,
                NetPayableByInsurer: body?.RequestedAmount    ?? 0
            );
            var auth = await _preAuthSvc.GeneratePreAuthAsync(id, claims!.UserId, preAuthReq);

            // Mark as sent (to claims team)
            await _preAuthSvc.MarkSentAsync(auth.Id, claims.UserId, null);

            var refreshed = await _svc.GetByIdAsync(id);
            return await req.OkJsonAsync(new
            {
                coverageCase  = refreshed,
                authorization = auth,
                message       = "Submitted to Coverage & Claims team successfully."
            });
        }
        catch (KeyNotFoundException)
        {
            return req.CreateResponse(HttpStatusCode.NotFound);
        }
        catch (Exception ex)
        {
            _log.LogError(ex, "Error submitting case {Id} to claims", id);
            var resp = req.CreateResponse(HttpStatusCode.InternalServerError);
            await resp.WriteAsJsonAsync(new { error = ex.Message });
            return resp;
        }
    }

    // POST /api/ccms/coverage-cases/{id}/remind
    // Counsellor nudges the CCMS team. Adds a lightweight history note; no state change.
    [Function("RemindCcmsTeam")]
    public async Task<HttpResponseData> Remind(
        [HttpTrigger(AuthorizationLevel.Anonymous, "post", Route = "ccms/coverage-cases/{id:guid}/remind")] HttpRequestData req, Guid id)
    {
        if (!_jwt.ValidateAndExtract(req, out var claims, out var err))
            return await req.UnauthorizedAsync(err);

        var body = await JsonSerializer.DeserializeAsync<RemindRequest>(
            req.Body, CcmsApi.Services.HttpRequestDataExtensions.DeserializeOpts);

        try
        {
            await _svc.AddRemindNoteAsync(id, claims!.UserId, body?.Notes);
            return await req.OkJsonAsync(new { message = "Reminder logged. CCMS team will be notified." });
        }
        catch (KeyNotFoundException)
        {
            return req.CreateResponse(HttpStatusCode.NotFound);
        }
        catch (Exception ex)
        {
            _log.LogError(ex, "Error adding remind note for coverage case {Id}", id);
            var resp = req.CreateResponse(HttpStatusCode.InternalServerError);
            await resp.WriteAsJsonAsync(new { error = ex.Message });
            return resp;
        }
    }

    // POST /api/ccms/coverage-cases/{id}/eligibility
    // Body: { "eligibilityStatus": "verified|failed|pending", "notes": "..." }
    [Function("RecordEligibility")]
    public async Task<HttpResponseData> RecordEligibility(
        [HttpTrigger(AuthorizationLevel.Anonymous, "post", Route = "ccms/coverage-cases/{id:guid}/eligibility")] HttpRequestData req, Guid id)
    {
        if (!_jwt.ValidateAndExtract(req, out var claims, out var err))
            return await req.UnauthorizedAsync(err);

        var body = await JsonSerializer.DeserializeAsync<RecordEligibilityRequest>(req.Body, CcmsApi.Services.HttpRequestDataExtensions.DeserializeOpts);
        if (body is null) return req.CreateResponse(HttpStatusCode.BadRequest);

        var coverageCase = await _svc.GetByIdAsync(id);
        if (coverageCase is null) return req.CreateResponse(HttpStatusCode.NotFound);

        if (coverageCase.WorkflowInstanceId.HasValue)
        {
            // State-aware trigger selection:
            //   DRAFT           + verified  → VERIFY_ELIGIBILITY     → ELIGIBILITY_PENDING
            //   ELIGIBILITY_PENDING + verified → ELIGIBILITY_APPROVED → ELIGIBILITY_VERIFIED
            //   any state       + failed    → ELIGIBILITY_FAILED     → REJECTED
            string triggerEvent;
            if (body.EligibilityStatus?.ToLowerInvariant() == "verified")
            {
                triggerEvent = coverageCase.CurrentState == "DRAFT"
                    ? "VERIFY_ELIGIBILITY"
                    : "ELIGIBILITY_APPROVED";
            }
            else
            {
                triggerEvent = "ELIGIBILITY_FAILED";
            }

            var result = await _workflow.FireAsync(
                coverageCase.WorkflowInstanceId.Value,
                triggerEvent, claims!.UserId, body.Notes);

            if (!result.Success)
            {
                var errResp = req.CreateResponse(HttpStatusCode.UnprocessableEntity);
                await errResp.WriteAsJsonAsync(new { error = result.ErrorMessage });
                return errResp;
            }

            await _svc.SyncStateFromWorkflowAsync(id, claims.UserId);
        }

        return await req.OkJsonAsync(await _svc.GetByIdAsync(id));
    }
}

public record BySessionsRequest(List<Guid> SessionIds);
public record FireTransitionRequest(string TriggerEvent, string? Notes);
public record RecordEligibilityRequest(string EligibilityStatus, string? Notes);
public record RemindRequest(string? Notes);

public record SubmitToClaimsRequest(
    decimal          RequestedAmount,
    string?          EstimatedSurgeryDate  = null,
    List<string>?    DiagnosisCodes        = null,
    List<string>?    ProcedureCodes        = null,
    string?          ClinicalNotes         = null,
    string?          UrgencyLevel          = null,
    string?          RoomClassRequested    = null,
    string?          TpaContact            = null,
    string?          TpaEmail              = null,
    string?          TpaPhone              = null,
    string?          Notes                 = null,
    decimal          EstimatedTotalCost    = 0,
    decimal          ServiceTaxAmount      = 0,
    bool             ServiceTaxApplicable  = false,
    decimal          ServiceTaxPercent     = 0
);
