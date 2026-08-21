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
    private readonly ClarificationService _clarSvc;
    private readonly JwtService _jwt;
    private readonly ILogger<AuthorizationFunctions> _log;

    public AuthorizationFunctions(
        PreAuthorizationService svc,
        ClarificationService clarSvc,
        JwtService jwt,
        ILogger<AuthorizationFunctions> log)
    {
        _svc     = svc;
        _clarSvc = clarSvc;
        _jwt     = jwt;
        _log     = log;
    }

    // POST /api/ccms/coverage-cases/{id}/authorization
    [Function("GeneratePreAuth")]
    public async Task<HttpResponseData> GeneratePreAuth(
        [HttpTrigger(AuthorizationLevel.Anonymous, "post", Route = "ccms/coverage-cases/{id:guid}/authorization")] HttpRequestData req, Guid id)
    {
        if (!_jwt.ValidateAndExtract(req, out var claims, out var err))
            return await req.UnauthorizedAsync(err);

        if (await CcmsAuthz.ForbidUnlessAsync(req, claims!,
                "ccms.preauth.create", "ccms.preauth.process", "ccms.workflow.admin") is { } forbidden)
            return forbidden;

        var body = await JsonSerializer.DeserializeAsync<GeneratePreAuthRequest>(
            req.Body, CcmsApi.Services.HttpRequestDataExtensions.DeserializeOpts);
        if (body is null) return req.CreateResponse(HttpStatusCode.BadRequest);

        try
        {
            var result = await _svc.GeneratePreAuthAsync(id, claims!.UserId, body);
            return await req.CreatedJsonAsync(result);
        }
        catch (KeyNotFoundException)
        {
            return req.CreateResponse(HttpStatusCode.NotFound);
        }
        catch (InvalidOperationException ex)
        {
            return await req.BadRequestAsync(ex.Message);
        }
        catch (Exception ex)
        {
            _log.LogError(ex, "Error generating pre-auth for case {Id}", id);
            var resp = req.CreateResponse(HttpStatusCode.InternalServerError);
            resp.Headers.Add("Content-Type", "application/json");
            await resp.WriteStringAsync(
                JsonSerializer.Serialize(new { error = ex.Message },
                    new JsonSerializerOptions { PropertyNamingPolicy = JsonNamingPolicy.CamelCase }));
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

        if (await CcmsAuthz.ForbidUnlessAsync(req, claims!,
                "ccms.preauth.submit", "ccms.preauth.process", "ccms.workflow.admin") is { } forbidden)
            return forbidden;

        var body = await JsonSerializer.DeserializeAsync<SubmitPreAuthRequest>(
            req.Body, CcmsApi.Services.HttpRequestDataExtensions.DeserializeOpts);

        try
        {
            var result = await _svc.MarkSentAsync(id, claims!.UserId, body?.TpaReferenceNumber);
            return await req.OkJsonAsync(result);
        }
        catch (KeyNotFoundException ex)
        {
            return await req.NotFoundAsync(ex.Message);
        }
    }

    // POST /api/ccms/authorizations/{id}/tpa-response
    [Function("RecordTpaResponse")]
    public async Task<HttpResponseData> TpaResponse(
        [HttpTrigger(AuthorizationLevel.Anonymous, "post", Route = "ccms/authorizations/{id:guid}/tpa-response")] HttpRequestData req, Guid id)
    {
        if (!_jwt.ValidateAndExtract(req, out var claims, out var err))
            return await req.UnauthorizedAsync(err);

        if (await CcmsAuthz.ForbidUnlessAsync(req, claims!,
                "ccms.preauth.process", "ccms.workflow.admin") is { } forbidden)
            return forbidden;

        var body = await JsonSerializer.DeserializeAsync<RecordTpaResponseRequest>(
            req.Body, CcmsApi.Services.HttpRequestDataExtensions.DeserializeOpts);
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
        catch (InvalidOperationException ex)
        {
            return await req.BadRequestAsync(ex.Message);
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

    // PATCH /api/ccms/authorizations/{id}/process-status
    [Function("UpdateAuthProcessStatus")]
    public async Task<HttpResponseData> UpdateProcessStatus(
        [HttpTrigger(AuthorizationLevel.Anonymous, "patch",
            Route = "ccms/authorizations/{id:guid}/process-status")] HttpRequestData req, Guid id)
    {
        if (!_jwt.ValidateAndExtract(req, out var claims, out var err))
            return await req.UnauthorizedAsync(err);

        var body = await JsonSerializer.DeserializeAsync<UpdateProcessStatusRequest>(req.Body,
            new JsonSerializerOptions { PropertyNameCaseInsensitive = true });
        if (body is null || string.IsNullOrWhiteSpace(body.ProcessStatus))
            return req.CreateResponse(HttpStatusCode.BadRequest);

        try
        {
            var result = await _svc.UpdateProcessStatusAsync(id, claims!.UserId, body.ProcessStatus);
            return await req.OkJsonAsync(result);
        }
        catch (KeyNotFoundException)
        {
            return req.CreateResponse(HttpStatusCode.NotFound);
        }
    }
}

public record SubmitPreAuthRequest(string? TpaReferenceNumber);
public record UpdateProcessStatusRequest(string ProcessStatus);

// ── Clarification endpoints appended to AuthorizationFunctions ───────────────
// (Declared as partial methods below to keep file length manageable; the
//  ClarificationFunctions partial is in ClarificationFunctions.cs)
