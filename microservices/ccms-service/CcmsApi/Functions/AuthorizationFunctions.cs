using System.Net;
using System.Text.Json;
using CcmsApi.Services;
using Microsoft.Azure.Functions.Worker;
using Microsoft.Azure.Functions.Worker.Http;
using Microsoft.Extensions.Logging;

namespace CcmsApi.Functions;

public class AuthorizationFunctions
{
    private readonly PreAuthorizationService _svc;
    private readonly JwtService _jwt;
    private readonly ILogger<AuthorizationFunctions> _log;

    public AuthorizationFunctions(PreAuthorizationService svc, JwtService jwt, ILogger<AuthorizationFunctions> log)
    {
        _svc = svc;
        _jwt = jwt;
        _log = log;
    }

    // POST /api/ccms/coverage-cases/{id}/authorization
    [Function("GeneratePreAuth")]
    public async Task<HttpResponseData> GeneratePreAuth(
        [HttpTrigger(AuthorizationLevel.Anonymous, "post", Route = "ccms/coverage-cases/{id:guid}/authorization")] HttpRequestData req, Guid id)
    {
        if (!_jwt.ValidateAndExtract(req, out var claims, out var err))
            return await req.UnauthorizedAsync(err);

        var body = await JsonSerializer.DeserializeAsync<GeneratePreAuthRequest>(req.Body);
        if (body is null) return req.CreateResponse(HttpStatusCode.BadRequest);

        try
        {
            var result = await _svc.GeneratePreAuthAsync(id, claims!.UserId, body);
            var resp = req.CreateResponse(HttpStatusCode.Created);
            await resp.WriteAsJsonAsync(result);
            return resp;
        }
        catch (KeyNotFoundException)
        {
            return req.CreateResponse(HttpStatusCode.NotFound);
        }
        catch (Exception ex)
        {
            _log.LogError(ex, "Error generating pre-auth for case {Id}", id);
            var resp = req.CreateResponse(HttpStatusCode.InternalServerError);
            await resp.WriteAsJsonAsync(new { error = ex.Message });
            return resp;
        }
    }

    // GET /api/ccms/coverage-cases/{id}/authorization
    [Function("GetAuthorizationsForCase")]
    public async Task<HttpResponseData> GetForCase(
        [HttpTrigger(AuthorizationLevel.Anonymous, "get", Route = "ccms/coverage-cases/{id:guid}/authorization")] HttpRequestData req, Guid id)
    {
        if (!_jwt.ValidateAndExtract(req, out var claims, out var err))
            return await req.UnauthorizedAsync(err);

        var list = await _svc.GetByCaseIdAsync(id);
        return await req.OkJsonAsync(list);
    }

    // POST /api/ccms/authorizations/{id}/submit
    [Function("SubmitPreAuth")]
    public async Task<HttpResponseData> Submit(
        [HttpTrigger(AuthorizationLevel.Anonymous, "post", Route = "ccms/authorizations/{id:guid}/submit")] HttpRequestData req, Guid id)
    {
        if (!_jwt.ValidateAndExtract(req, out var claims, out var err))
            return await req.UnauthorizedAsync(err);

        var body = await JsonSerializer.DeserializeAsync<SubmitPreAuthRequest>(req.Body);

        var result = await _svc.MarkSentAsync(id, claims!.UserId, body?.TpaReferenceNumber);
        return await req.OkJsonAsync(result);
    }

    // POST /api/ccms/authorizations/{id}/tpa-response
    [Function("RecordTpaResponse")]
    public async Task<HttpResponseData> TpaResponse(
        [HttpTrigger(AuthorizationLevel.Anonymous, "post", Route = "ccms/authorizations/{id:guid}/tpa-response")] HttpRequestData req, Guid id)
    {
        if (!_jwt.ValidateAndExtract(req, out var claims, out var err))
            return await req.UnauthorizedAsync(err);

        var body = await JsonSerializer.DeserializeAsync<RecordTpaResponseRequest>(req.Body);
        if (body is null) return req.CreateResponse(HttpStatusCode.BadRequest);

        try
        {
            var result = await _svc.RecordTpaResponseAsync(id, claims!.UserId, body);
            return await req.OkJsonAsync(result);
        }
        catch (ArgumentException ex)
        {
            var resp = req.CreateResponse(HttpStatusCode.BadRequest);
            await resp.WriteAsJsonAsync(new { error = ex.Message });
            return resp;
        }
        catch (KeyNotFoundException)
        {
            return req.CreateResponse(HttpStatusCode.NotFound);
        }
    }

    // GET /api/ccms/authorizations/queue
    [Function("GetAuthQueue")]
    public async Task<HttpResponseData> GetQueue(
        [HttpTrigger(AuthorizationLevel.Anonymous, "get", Route = "ccms/authorizations/queue")] HttpRequestData req)
    {
        if (!_jwt.ValidateAndExtract(req, out var claims, out var err))
            return await req.UnauthorizedAsync(err);

        var queue = await _svc.GetQueueAsync();
        return await req.OkJsonAsync(queue);
    }
}

public record SubmitPreAuthRequest(string? TpaReferenceNumber);
