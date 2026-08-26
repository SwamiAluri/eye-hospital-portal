using System.Net;
using System.Text.Json;
using CcmsApi.Services;
using Microsoft.Azure.Functions.Worker;
using Microsoft.Azure.Functions.Worker.Http;

namespace CcmsApi.Functions;

public class ClaimFunctions
{
    private static readonly JsonSerializerOptions JsonOpts = new()
    {
        PropertyNameCaseInsensitive = true,
    };

    private readonly ClaimPacketGeneratorService _svc;
    private readonly JwtService _jwt;

    public ClaimFunctions(ClaimPacketGeneratorService svc, JwtService jwt)
    {
        _svc = svc;
        _jwt = jwt;
    }

    // POST /api/ccms/coverage-cases/{id}/claims
    [Function("GenerateClaim")]
    public async Task<HttpResponseData> Generate(
        [HttpTrigger(AuthorizationLevel.Anonymous, "post", Route = "ccms/coverage-cases/{id:guid}/claims")] HttpRequestData req, Guid id)
    {
        if (!_jwt.ValidateAndExtract(req, out var claims, out var err))
            return await req.UnauthorizedAsync(err);

        if (await CcmsAuthz.ForbidUnlessAsync(req, claims!,
                "ccms.claim.submit", "ccms.claim.write", "ccms.workflow.admin") is { } forbidden)
            return forbidden;

        var body = await JsonSerializer.DeserializeAsync<GenerateClaimRequest>(req.Body);
        if (body is null) return req.CreateResponse(HttpStatusCode.BadRequest);

        var result = await _svc.GenerateClaimAsync(id, claims!.UserId, body);
        var resp = req.CreateResponse(HttpStatusCode.Created);
        await resp.WriteAsJsonAsync(result);
        return resp;
    }

    // GET /api/ccms/coverage-cases/{id}/claims
    [Function("GetClaims")]
    public async Task<HttpResponseData> GetForCase(
        [HttpTrigger(AuthorizationLevel.Anonymous, "get", Route = "ccms/coverage-cases/{id:guid}/claims")] HttpRequestData req, Guid id)
    {
        if (!_jwt.ValidateAndExtract(req, out var claims, out var err))
            return await req.UnauthorizedAsync(err);

        var list = await _svc.GetByCaseIdAsync(id);
        return await req.OkJsonAsync(list);
    }

    // POST /api/ccms/claims/{id}/submit
    [Function("SubmitClaim")]
    public async Task<HttpResponseData> Submit(
        [HttpTrigger(AuthorizationLevel.Anonymous, "post", Route = "ccms/claims/{id:guid}/submit")] HttpRequestData req, Guid id)
    {
        if (!_jwt.ValidateAndExtract(req, out var claims, out var err))
            return await req.UnauthorizedAsync(err);

        var body = await JsonSerializer.DeserializeAsync<SubmitClaimRequest>(req.Body);
        var result = await _svc.SubmitClaimAsync(id, claims!.UserId, body?.TpaClaimNumber);
        return await req.OkJsonAsync(result);
    }

    // POST /api/ccms/claims/{id}/acknowledge
    [Function("AcknowledgeClaim")]
    public async Task<HttpResponseData> Acknowledge(
        [HttpTrigger(AuthorizationLevel.Anonymous, "post", Route = "ccms/claims/{id:guid}/acknowledge")] HttpRequestData req, Guid id)
    {
        if (!_jwt.ValidateAndExtract(req, out var claims, out var err))
            return await req.UnauthorizedAsync(err);

        var body = await JsonSerializer.DeserializeAsync<AcknowledgeClaimRequest>(req.Body);
        var result = await _svc.AcknowledgeClaimAsync(id, claims!.UserId, body?.TpaAckReference);
        return await req.OkJsonAsync(result);
    }

    [Function("RaiseClaimQuery")]
    public async Task<HttpResponseData> RaiseQuery(
        [HttpTrigger(AuthorizationLevel.Anonymous, "post", Route = "ccms/claims/{id:guid}/query")] HttpRequestData req, Guid id)
    {
        if (!_jwt.ValidateAndExtract(req, out var claims, out var err))
            return await req.UnauthorizedAsync(err);
        if (await CcmsAuthz.ForbidUnlessAsync(req, claims!,
                "ccms.claim.submit", "ccms.claim.write", "ccms.clarification.write", "ccms.workflow.admin") is { } forbidden)
            return forbidden;

        var body = await JsonSerializer.DeserializeAsync<RaiseClaimQueryRequest>(req.Body, JsonOpts);
        var result = await _svc.RaiseClaimQueryAsync(
            id, claims!.UserId, body?.Query ?? "", body?.AdditionalInfoRequired ?? false);
        return await req.OkJsonAsync(result);
    }

    [Function("RespondClaimQuery")]
    public async Task<HttpResponseData> RespondQuery(
        [HttpTrigger(AuthorizationLevel.Anonymous, "post", Route = "ccms/claims/{id:guid}/query-response")] HttpRequestData req, Guid id)
    {
        if (!_jwt.ValidateAndExtract(req, out var claims, out var err))
            return await req.UnauthorizedAsync(err);
        if (await CcmsAuthz.ForbidUnlessAsync(req, claims!,
                "ccms.claim.submit", "ccms.claim.write", "ccms.clarification.write", "ccms.workflow.admin") is { } forbidden)
            return forbidden;

        var body = await JsonSerializer.DeserializeAsync<RespondClaimQueryRequest>(req.Body, JsonOpts);
        var result = await _svc.RespondClaimQueryAsync(id, claims!.UserId, body?.Response ?? "");
        return await req.OkJsonAsync(result);
    }

    // GET /api/ccms/claims/queue
    [Function("GetClaimQueue")]
    public async Task<HttpResponseData> GetQueue(
        [HttpTrigger(AuthorizationLevel.Anonymous, "get", Route = "ccms/claims/queue")] HttpRequestData req)
    {
        if (!_jwt.ValidateAndExtract(req, out var claims, out var err))
            return await req.UnauthorizedAsync(err);

        var queue = await _svc.GetQueueAsync();
        return await req.OkJsonAsync(queue);
    }
}

public record SubmitClaimRequest(string? TpaClaimNumber);
public record AcknowledgeClaimRequest(string? TpaAckReference);
public record RaiseClaimQueryRequest(string? Query, bool AdditionalInfoRequired = false);
public record RespondClaimQueryRequest(string? Response);
