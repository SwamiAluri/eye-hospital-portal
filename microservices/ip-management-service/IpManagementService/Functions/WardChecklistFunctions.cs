using System.Net;
using System.Text.Json;
using System.Text.Json.Serialization;
using Microsoft.Azure.Functions.Worker;
using Microsoft.Azure.Functions.Worker.Http;
using IpManagementService.Models.Dtos;
using IpManagementService.Services;

namespace IpManagementService.Functions;

/// <summary>
/// Ward Checklist (Form 2 — 17 items).
///   GET  /api/ip-management/journeys/{id}/ward-checklist
///   POST /api/ip-management/journeys/{id}/ward-checklist/completions/{itemId}
/// </summary>
public class WardChecklistFunctions
{
    private readonly WardChecklistService _svc;
    private readonly JwtService           _jwt;

    private static readonly JsonSerializerOptions Json = new()
    {
        PropertyNamingPolicy   = JsonNamingPolicy.CamelCase,
        DefaultIgnoreCondition = JsonIgnoreCondition.WhenWritingNull,
    };

    public WardChecklistFunctions(WardChecklistService svc, JwtService jwt)
    {
        _svc = svc;
        _jwt = jwt;
    }

    [Function("GetWardChecklist")]
    public async Task<HttpResponseData> GetWardChecklist(
        [HttpTrigger(AuthorizationLevel.Function, "get",
            Route = "ip-management/journeys/{id:guid}/ward-checklist")]
        HttpRequestData req,
        Guid id)
    {
        try
        {
            var (userId, tenantId) = _jwt.ValidateAndExtract(req);
            var tid                = _jwt.ExtractTenantId(req, tenantId);
            var qs                 = ParseQs(req.Url.Query);
            var paymentMode        = qs.TryGetValue("paymentMode", out var pm) ? pm : null;

            var result = await _svc.GetWardChecklistAsync(id, tid, userId, paymentMode);
            return await Ok(req, result);
        }
        catch (KeyNotFoundException ex)        { return await NotFound(req, ex.Message); }
        catch (UnauthorizedAccessException ex) { return await Unauthorized(req, ex.Message); }
        catch (Exception ex)                 { return await InternalError(req, ex.Message); }
    }

    [Function("SaveWardChecklistCompletion")]
    public async Task<HttpResponseData> SaveCompletion(
        [HttpTrigger(AuthorizationLevel.Function, "post",
            Route = "ip-management/journeys/{id:guid}/ward-checklist/completions/{itemId:guid}")]
        HttpRequestData req,
        Guid id,
        Guid itemId)
    {
        try
        {
            IpChecklistAuth.RequirePermission(req, _jwt, "ward.checklist.edit");
            var (userId, tenantId) = _jwt.ValidateAndExtract(req);
            var tid                = _jwt.ExtractTenantId(req, tenantId);

            var body = await JsonSerializer.DeserializeAsync<SaveWardChecklistCompletionRequest>(
                           req.Body, Json)
                       ?? throw new ArgumentException("Request body is required.");

            var result = await _svc.SaveCompletionAsync(id, itemId, tid, userId, body);
            return await Ok(req, result);
        }
        catch (KeyNotFoundException ex)        { return await NotFound(req, ex.Message); }
        catch (UnauthorizedAccessException ex) { return await Unauthorized(req, ex.Message); }
        catch (ArgumentException ex)           { return await BadRequest(req, ex.Message); }
        catch (Exception ex)                 { return await InternalError(req, ex.Message); }
    }

    private static Dictionary<string, string> ParseQs(string query)
    {
        var result = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);
        if (string.IsNullOrEmpty(query)) return result;
        foreach (var part in query.TrimStart('?').Split('&', StringSplitOptions.RemoveEmptyEntries))
        {
            var kv = part.Split('=', 2);
            if (kv.Length == 2)
                result[Uri.UnescapeDataString(kv[0])] = Uri.UnescapeDataString(kv[1]);
        }
        return result;
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
