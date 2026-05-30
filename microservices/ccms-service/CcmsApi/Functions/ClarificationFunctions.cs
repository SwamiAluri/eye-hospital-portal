using System.Net;
using System.Text.Json;
using CcmsApi.Services;
using Microsoft.Azure.Functions.Worker;
using Microsoft.Azure.Functions.Worker.Http;
using Microsoft.Extensions.Logging;

namespace CcmsApi.Functions;

/// <summary>
/// Endpoints for TPA clarification / query thread.
///
///   GET  /ccms/authorizations/{authId}/clarifications
///   POST /ccms/authorizations/{authId}/clarifications
///   POST /ccms/clarifications/{id}/respond
/// </summary>
public class ClarificationFunctions
{
    private readonly ClarificationService _svc;
    private readonly JwtService _jwt;
    private readonly ILogger<ClarificationFunctions> _log;

    public ClarificationFunctions(
        ClarificationService svc, JwtService jwt, ILogger<ClarificationFunctions> log)
    {
        _svc = svc;
        _jwt = jwt;
        _log = log;
    }

    [Function("ListClarifications")]
    public async Task<HttpResponseData> List(
        [HttpTrigger(AuthorizationLevel.Anonymous, "get",
            Route = "ccms/authorizations/{authId:guid}/clarifications")] HttpRequestData req,
        Guid authId)
    {
        if (!_jwt.ValidateAndExtract(req, out var claims, out var err))
            return await req.UnauthorizedAsync(err);

        var items = await _svc.GetByAuthorizationAsync(authId);
        return await req.OkJsonAsync(items);
    }

    [Function("AddClarificationQuery")]
    public async Task<HttpResponseData> AddQuery(
        [HttpTrigger(AuthorizationLevel.Anonymous, "post",
            Route = "ccms/authorizations/{authId:guid}/clarifications")] HttpRequestData req,
        Guid authId)
    {
        if (!_jwt.ValidateAndExtract(req, out var claims, out var err))
            return await req.UnauthorizedAsync(err);

        var body = await JsonSerializer.DeserializeAsync<AddClarificationQueryRequest>(req.Body,
            new JsonSerializerOptions { PropertyNameCaseInsensitive = true });
        if (body is null || string.IsNullOrWhiteSpace(body.Query))
            return req.CreateResponse(HttpStatusCode.BadRequest);

        try
        {
            var result = await _svc.AddQueryAsync(authId, claims!.UserId, body);
            var resp = req.CreateResponse(HttpStatusCode.Created);
            await resp.WriteAsJsonAsync(result);
            return resp;
        }
        catch (KeyNotFoundException)
        {
            return req.CreateResponse(HttpStatusCode.NotFound);
        }
    }

    [Function("RespondToClarification")]
    public async Task<HttpResponseData> Respond(
        [HttpTrigger(AuthorizationLevel.Anonymous, "post",
            Route = "ccms/clarifications/{id:guid}/respond")] HttpRequestData req,
        Guid id)
    {
        if (!_jwt.ValidateAndExtract(req, out var claims, out var err))
            return await req.UnauthorizedAsync(err);

        var body = await JsonSerializer.DeserializeAsync<RespondToClarificationRequest>(req.Body,
            new JsonSerializerOptions { PropertyNameCaseInsensitive = true });
        if (body is null || string.IsNullOrWhiteSpace(body.Response))
            return req.CreateResponse(HttpStatusCode.BadRequest);

        try
        {
            var result = await _svc.RespondAsync(id, claims!.UserId, body);
            return await req.OkJsonAsync(result);
        }
        catch (KeyNotFoundException)
        {
            return req.CreateResponse(HttpStatusCode.NotFound);
        }
        catch (InvalidOperationException ex)
        {
            var resp = req.CreateResponse(HttpStatusCode.Conflict);
            await resp.WriteStringAsync(ex.Message);
            return resp;
        }
    }
}
