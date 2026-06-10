using System.Net;
using System.Text.Json;
using System.Text.Json.Serialization;
using Microsoft.Azure.Functions.Worker;
using Microsoft.Azure.Functions.Worker.Http;
using IpManagementService.Models.Dtos;
using IpManagementService.Services;

namespace IpManagementService.Functions;

/// <summary>
/// Form 4 — Ward post-op checklist.
///   GET  /api/ip-management/journeys/{id}/ward-postop-checklist
///   POST /api/ip-management/journeys/{id}/ward-postop-checklist/completions/{itemId}
///   PUT  /api/ip-management/journeys/{id}/ward-postop-checklist/iol-sticker
/// </summary>
public class WardPostOpChecklistFunctions
{
    private readonly WardPostOpChecklistService _svc;
    private readonly JwtService                 _jwt;

    private static readonly JsonSerializerOptions Json = new()
    {
        PropertyNamingPolicy   = JsonNamingPolicy.CamelCase,
        DefaultIgnoreCondition = JsonIgnoreCondition.WhenWritingNull,
    };

    public WardPostOpChecklistFunctions(WardPostOpChecklistService svc, JwtService jwt)
    {
        _svc = svc;
        _jwt = jwt;
    }

    [Function("GetWardPostOpChecklist")]
    public async Task<HttpResponseData> Get(
        [HttpTrigger(AuthorizationLevel.Function, "get",
            Route = "ip-management/journeys/{id:guid}/ward-postop-checklist")]
        HttpRequestData req, Guid id)
    {
        try
        {
            var (userId, tenantId) = _jwt.ValidateAndExtract(req);
            var tid                = _jwt.ExtractTenantId(req, tenantId);
            return await Ok(req, await _svc.GetChecklistAsync(id, tid, userId));
        }
        catch (KeyNotFoundException ex)        { return await NotFound(req, ex.Message); }
        catch (UnauthorizedAccessException ex) { return await Unauthorized(req, ex.Message); }
        catch (Exception ex)                 { return await InternalError(req, ex.Message); }
    }

    [Function("SaveWardPostOpCompletion")]
    public async Task<HttpResponseData> SaveCompletion(
        [HttpTrigger(AuthorizationLevel.Function, "post",
            Route = "ip-management/journeys/{id:guid}/ward-postop-checklist/completions/{itemId:guid}")]
        HttpRequestData req, Guid id, Guid itemId)
    {
        try
        {
            IpChecklistAuth.RequirePermission(req, _jwt, "ward.checklist.edit");
            var (userId, tenantId) = _jwt.ValidateAndExtract(req);
            var tid                = _jwt.ExtractTenantId(req, tenantId);
            var body = await JsonSerializer.DeserializeAsync<SaveWardPostOpCompletionRequest>(req.Body, Json)
                       ?? throw new ArgumentException("Request body is required.");
            return await Ok(req, await _svc.SaveCompletionAsync(id, itemId, tid, userId, body));
        }
        catch (KeyNotFoundException ex)        { return await NotFound(req, ex.Message); }
        catch (UnauthorizedAccessException ex) { return await Unauthorized(req, ex.Message); }
        catch (ArgumentException ex)           { return await BadRequest(req, ex.Message); }
        catch (Exception ex)                 { return await InternalError(req, ex.Message); }
    }

    [Function("SaveIolStickerChecks")]
    public async Task<HttpResponseData> SaveIol(
        [HttpTrigger(AuthorizationLevel.Function, "put",
            Route = "ip-management/journeys/{id:guid}/ward-postop-checklist/iol-sticker")]
        HttpRequestData req, Guid id)
    {
        try
        {
            IpChecklistAuth.RequirePermission(req, _jwt, "ward.checklist.edit");
            var (userId, tenantId) = _jwt.ValidateAndExtract(req);
            var tid                = _jwt.ExtractTenantId(req, tenantId);
            var body = await JsonSerializer.DeserializeAsync<SaveIolStickerChecksRequest>(req.Body, Json)
                       ?? throw new ArgumentException("Request body is required.");
            return await Ok(req, await _svc.SaveIolStickerChecksAsync(id, tid, userId, body));
        }
        catch (KeyNotFoundException ex)        { return await NotFound(req, ex.Message); }
        catch (UnauthorizedAccessException ex) { return await Unauthorized(req, ex.Message); }
        catch (ArgumentException ex)           { return await BadRequest(req, ex.Message); }
        catch (Exception ex)                 { return await InternalError(req, ex.Message); }
    }

    private static async Task<HttpResponseData> Ok(HttpRequestData req, object body)
    {
        var res = req.CreateResponse(HttpStatusCode.OK);
        res.Headers.Add("Content-Type", "application/json; charset=utf-8");
        await res.WriteStringAsync(JsonSerializer.Serialize(body, Json));
        return res;
    }

    private static async Task<HttpResponseData> BadRequest(HttpRequestData req, string msg)
    {
        var res = req.CreateResponse(HttpStatusCode.BadRequest);
        await res.WriteAsJsonAsync(new { error = msg });
        return res;
    }

    private static async Task<HttpResponseData> NotFound(HttpRequestData req, string msg)
    {
        var res = req.CreateResponse(HttpStatusCode.NotFound);
        await res.WriteAsJsonAsync(new { error = msg });
        return res;
    }

    private static async Task<HttpResponseData> Unauthorized(HttpRequestData req, string msg)
    {
        var res = req.CreateResponse(HttpStatusCode.Unauthorized);
        await res.WriteAsJsonAsync(new { error = msg });
        return res;
    }

    private static async Task<HttpResponseData> InternalError(HttpRequestData req, string msg)
    {
        var res = req.CreateResponse(HttpStatusCode.InternalServerError);
        await res.WriteAsJsonAsync(new { error = msg });
        return res;
    }
}
