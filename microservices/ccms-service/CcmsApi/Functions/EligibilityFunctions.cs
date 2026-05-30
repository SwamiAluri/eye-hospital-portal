using System.Net;
using System.Text.Json;
using CcmsApi.Services;
using Microsoft.Azure.Functions.Worker;
using Microsoft.Azure.Functions.Worker.Http;
using Microsoft.Extensions.Logging;

namespace CcmsApi.Functions;

/// <summary>
/// REST endpoints for eligibility checks and policy captures.
///
/// Eligibility:
///   GET  /ccms/coverage-cases/{caseId}/eligibility-checks
///   POST /ccms/coverage-cases/{caseId}/eligibility-checks
///
/// Policy Capture:
///   GET  /ccms/coverage-cases/{caseId}/policy-captures
///   GET  /ccms/coverage-cases/{caseId}/policy-captures/latest
///   POST /ccms/coverage-cases/{caseId}/policy-captures
/// </summary>
public class EligibilityFunctions
{
    private readonly EligibilityService _eligSvc;
    private readonly PolicyCaptureService _policySvc;
    private readonly JwtService _jwt;
    private readonly ILogger<EligibilityFunctions> _log;

    public EligibilityFunctions(
        EligibilityService eligSvc,
        PolicyCaptureService policySvc,
        JwtService jwt,
        ILogger<EligibilityFunctions> log)
    {
        _eligSvc   = eligSvc;
        _policySvc = policySvc;
        _jwt       = jwt;
        _log       = log;
    }

    // ── Eligibility Checks ───────────────────────────────────────────────────

    [Function("ListEligibilityChecks")]
    public async Task<HttpResponseData> ListEligibilityChecks(
        [HttpTrigger(AuthorizationLevel.Anonymous, "get",
            Route = "ccms/coverage-cases/{caseId:guid}/eligibility-checks")] HttpRequestData req,
        Guid caseId)
    {
        if (!_jwt.ValidateAndExtract(req, out var claims, out var err))
            return await req.UnauthorizedAsync(err);

        var list = await _eligSvc.GetByCaseAsync(caseId);
        return await req.OkJsonAsync(list);
    }

    [Function("CreateEligibilityCheck")]
    public async Task<HttpResponseData> CreateEligibilityCheck(
        [HttpTrigger(AuthorizationLevel.Anonymous, "post",
            Route = "ccms/coverage-cases/{caseId:guid}/eligibility-checks")] HttpRequestData req,
        Guid caseId)
    {
        if (!_jwt.ValidateAndExtract(req, out var claims, out var err))
            return await req.UnauthorizedAsync(err);

        var body = await JsonSerializer.DeserializeAsync<EligibilityCheckRequest>(req.Body,
            new JsonSerializerOptions { PropertyNameCaseInsensitive = true });
        if (body is null) return req.CreateResponse(HttpStatusCode.BadRequest);

        try
        {
            var result = await _eligSvc.PerformCheckAsync(caseId, claims!.UserId, body);
            var resp = req.CreateResponse(HttpStatusCode.Created);
            await resp.WriteAsJsonAsync(result);
            return resp;
        }
        catch (KeyNotFoundException)
        {
            return req.CreateResponse(HttpStatusCode.NotFound);
        }
    }

    // ── Policy Captures ──────────────────────────────────────────────────────

    [Function("ListPolicyCaptures")]
    public async Task<HttpResponseData> ListPolicyCaptures(
        [HttpTrigger(AuthorizationLevel.Anonymous, "get",
            Route = "ccms/coverage-cases/{caseId:guid}/policy-captures")] HttpRequestData req,
        Guid caseId)
    {
        if (!_jwt.ValidateAndExtract(req, out var claims, out var err))
            return await req.UnauthorizedAsync(err);

        var list = await _policySvc.GetByCaseAsync(caseId);
        return await req.OkJsonAsync(list);
    }

    [Function("GetLatestPolicyCapture")]
    public async Task<HttpResponseData> GetLatestPolicyCapture(
        [HttpTrigger(AuthorizationLevel.Anonymous, "get",
            Route = "ccms/coverage-cases/{caseId:guid}/policy-captures/latest")] HttpRequestData req,
        Guid caseId)
    {
        if (!_jwt.ValidateAndExtract(req, out var claims, out var err))
            return await req.UnauthorizedAsync(err);

        var item = await _policySvc.GetLatestAsync(caseId);
        if (item is null) return req.CreateResponse(HttpStatusCode.NoContent);
        return await req.OkJsonAsync(item);
    }

    [Function("CreatePolicyCapture")]
    public async Task<HttpResponseData> CreatePolicyCapture(
        [HttpTrigger(AuthorizationLevel.Anonymous, "post",
            Route = "ccms/coverage-cases/{caseId:guid}/policy-captures")] HttpRequestData req,
        Guid caseId)
    {
        if (!_jwt.ValidateAndExtract(req, out var claims, out var err))
            return await req.UnauthorizedAsync(err);

        var body = await JsonSerializer.DeserializeAsync<PolicyCaptureRequest>(req.Body,
            new JsonSerializerOptions { PropertyNameCaseInsensitive = true });
        if (body is null) return req.CreateResponse(HttpStatusCode.BadRequest);

        try
        {
            var result = await _policySvc.CaptureAsync(caseId, claims!.UserId, body);
            var resp = req.CreateResponse(HttpStatusCode.Created);
            await resp.WriteAsJsonAsync(result);
            return resp;
        }
        catch (KeyNotFoundException)
        {
            return req.CreateResponse(HttpStatusCode.NotFound);
        }
    }
}
