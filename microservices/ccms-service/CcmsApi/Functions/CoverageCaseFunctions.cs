using System.Net;
using System.Text.Json;
using CcmsApi.Services;
using Microsoft.Azure.Functions.Worker;
using Microsoft.Azure.Functions.Worker.Http;
using Microsoft.Extensions.Logging;

namespace CcmsApi.Functions;

public class CoverageCaseFunctions
{
    private readonly CoverageCaseService _svc;
    private readonly JwtService _jwt;
    private readonly IWorkflowEngine _workflow;
    private readonly ILogger<CoverageCaseFunctions> _log;

    public CoverageCaseFunctions(
        CoverageCaseService svc,
        JwtService jwt,
        IWorkflowEngine workflow,
        ILogger<CoverageCaseFunctions> log)
    {
        _svc      = svc;
        _jwt      = jwt;
        _workflow = workflow;
        _log      = log;
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
            var result = await _svc.CreateAsync(claims!.TenantId, claims.UserId, body);
            var resp = req.CreateResponse(HttpStatusCode.Created);
            await resp.WriteAsJsonAsync(result);
            return resp;
        }
        catch (Exception ex)
        {
            _log.LogError(ex, "Error creating coverage case");
            var resp = req.CreateResponse(HttpStatusCode.InternalServerError);
            await resp.WriteAsJsonAsync(new { error = ex.Message });
            return resp;
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

    // GET /api/ccms/coverage-cases?state=&payerType=&page=&pageSize=
    [Function("ListCoverageCases")]
    public async Task<HttpResponseData> List(
        [HttpTrigger(AuthorizationLevel.Anonymous, "get", Route = "ccms/coverage-cases")] HttpRequestData req)
    {
        if (!_jwt.ValidateAndExtract(req, out var claims, out var err))
            return await req.UnauthorizedAsync(err);

        var state     = req.Query["state"];
        var payerType = req.Query["payerType"];
        int.TryParse(req.Query["page"],     out var page);
        int.TryParse(req.Query["pageSize"], out var pageSize);

        var result = await _svc.ListAsync(
            claims!.TenantId, state, payerType, null,
            page > 0 ? page : 1, pageSize > 0 ? pageSize : 20);
        return await req.OkJsonAsync(result);
    }

    // POST /api/ccms/coverage-cases/by-sessions
    // Body: { "sessionIds": ["uuid1","uuid2",...] }
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
        return await req.OkJsonAsync(list);
    }

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
