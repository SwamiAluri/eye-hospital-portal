using System.Net;
using System.Text.Json;
using CcmsApi.Services;
using Microsoft.Azure.Functions.Worker;
using Microsoft.Azure.Functions.Worker.Http;
using Microsoft.Extensions.Logging;

namespace CcmsApi.Functions;

public class ApprovalFunctions
{
    private readonly ApprovalEventService _svc;
    private readonly JwtService _jwt;
    private readonly ILogger<ApprovalFunctions> _log;

    public ApprovalFunctions(ApprovalEventService svc, JwtService jwt, ILogger<ApprovalFunctions> log)
    {
        _svc = svc;
        _jwt = jwt;
        _log = log;
    }

    // GET /api/ccms/coverage-cases/{id}/approval-events
    [Function("GetApprovalEvents")]
    public async Task<HttpResponseData> GetEvents(
        [HttpTrigger(AuthorizationLevel.Anonymous, "get", Route = "ccms/coverage-cases/{id:guid}/approval-events")] HttpRequestData req, Guid id)
    {
        if (!_jwt.ValidateAndExtract(req, out var claims, out var err))
            return await req.UnauthorizedAsync(err);

        var list = await _svc.GetEventsByCaseIdAsync(id);
        return await req.OkJsonAsync(list);
    }

    // POST /api/ccms/authorizations/{id}/approve
    [Function("ApproveCoverageCase")]
    public async Task<HttpResponseData> Approve(
        [HttpTrigger(AuthorizationLevel.Anonymous, "post", Route = "ccms/authorizations/{id:guid}/approve")] HttpRequestData req, Guid id)
    {
        if (!_jwt.ValidateAndExtract(req, out var claims, out var err))
            return await req.UnauthorizedAsync(err);

        var body = await JsonSerializer.DeserializeAsync<ApproveCaseRequest>(req.Body);
        if (body is null) return req.CreateResponse(HttpStatusCode.BadRequest);

        try
        {
            var result = await _svc.RecordApprovalAsync(
                body.CoverageCaseId, id, claims!.UserId,
                new RecordApprovalRequest(body.ApprovedAmount, body.PreAuthNumber, body.TpaReferenceNumber, null));
            return await req.OkJsonAsync(result);
        }
        catch (KeyNotFoundException)
        {
            return req.CreateResponse(HttpStatusCode.NotFound);
        }
    }

    // POST /api/ccms/authorizations/{id}/reject
    [Function("RejectCoverageCase")]
    public async Task<HttpResponseData> Reject(
        [HttpTrigger(AuthorizationLevel.Anonymous, "post", Route = "ccms/authorizations/{id:guid}/reject")] HttpRequestData req, Guid id)
    {
        if (!_jwt.ValidateAndExtract(req, out var claims, out var err))
            return await req.UnauthorizedAsync(err);

        var body = await JsonSerializer.DeserializeAsync<RejectCaseRequest>(req.Body);
        if (body is null) return req.CreateResponse(HttpStatusCode.BadRequest);

        var result = await _svc.RecordRejectionAsync(
            body.CoverageCaseId, id, claims!.UserId,
            new RecordRejectionRequest(body.RejectionReason, body.TpaReferenceNumber));
        return await req.OkJsonAsync(result);
    }

    // POST /api/ccms/authorizations/{id}/clarify
    [Function("RecordClarification")]
    public async Task<HttpResponseData> Clarify(
        [HttpTrigger(AuthorizationLevel.Anonymous, "post", Route = "ccms/authorizations/{id:guid}/clarify")] HttpRequestData req, Guid id)
    {
        if (!_jwt.ValidateAndExtract(req, out var claims, out var err))
            return await req.UnauthorizedAsync(err);

        var body = await JsonSerializer.DeserializeAsync<ClarificationRequest>(req.Body);
        if (body is null) return req.CreateResponse(HttpStatusCode.BadRequest);

        var result = await _svc.RecordClarificationAsync(
            body.CoverageCaseId, id, claims!.UserId,
            new RecordClarificationRequest(body.Query, null));
        return await req.OkJsonAsync(result);
    }
}

public record ApproveCaseRequest(Guid CoverageCaseId, decimal ApprovedAmount, string? PreAuthNumber, string? TpaReferenceNumber);
public record RejectCaseRequest(Guid CoverageCaseId, string RejectionReason, string? TpaReferenceNumber);
public record ClarificationRequest(Guid CoverageCaseId, string Query);
