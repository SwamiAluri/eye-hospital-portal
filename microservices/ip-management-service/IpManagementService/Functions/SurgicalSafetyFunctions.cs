using System.Net;
using System.Text.Json;
using System.Text.Json.Serialization;
using Microsoft.Azure.Functions.Worker;
using Microsoft.Azure.Functions.Worker.Http;
using IpManagementService.Models.Dtos;
using IpManagementService.Services;

namespace IpManagementService.Functions;

/// <summary>
/// Form 1 OT — Surgical Safety Checklist.
///   GET /api/ip-management/journeys/{id}/surgical-safety
///   PUT /api/ip-management/journeys/{id}/surgical-safety/before-anaesthesia
///   PUT /api/ip-management/journeys/{id}/surgical-safety/who-timeout
///   PUT /api/ip-management/journeys/{id}/surgical-safety/after-surgery
/// </summary>
public class SurgicalSafetyFunctions
{
    private readonly SurgicalSafetyService _svc;
    private readonly JwtService            _jwt;

    private static readonly JsonSerializerOptions Json = new()
    {
        PropertyNamingPolicy   = JsonNamingPolicy.CamelCase,
        DefaultIgnoreCondition = JsonIgnoreCondition.WhenWritingNull,
    };

    public SurgicalSafetyFunctions(SurgicalSafetyService svc, JwtService jwt)
    {
        _svc = svc;
        _jwt = jwt;
    }

    [Function("GetSurgicalSafetyChecklist")]
    public async Task<HttpResponseData> Get(
        [HttpTrigger(AuthorizationLevel.Function, "get",
            Route = "ip-management/journeys/{id:guid}/surgical-safety")]
        HttpRequestData req, Guid id)
    {
        try
        {
            var (_, tenantId) = _jwt.ValidateAndExtract(req);
            var tid           = _jwt.ExtractTenantId(req, tenantId);
            return await Ok(req, await _svc.GetChecklistAsync(id, tid));
        }
        catch (KeyNotFoundException ex)        { return await NotFound(req, ex.Message); }
        catch (UnauthorizedAccessException ex) { return await Unauthorized(req, ex.Message); }
        catch (Exception ex)                 { return await InternalError(req, ex.Message); }
    }

    [Function("SaveBeforeAnaesthesia")]
    public async Task<HttpResponseData> SaveBefore(
        [HttpTrigger(AuthorizationLevel.Function, "put",
            Route = "ip-management/journeys/{id:guid}/surgical-safety/before-anaesthesia")]
        HttpRequestData req, Guid id)
    {
        try
        {
            IpChecklistAuth.RequirePermission(req, _jwt, "ot.safety.sign");
            var (userId, tenantId) = _jwt.ValidateAndExtract(req);
            var tid                = _jwt.ExtractTenantId(req, tenantId);
            var body = await JsonSerializer.DeserializeAsync<SaveBeforeAnaesthesiaRequest>(req.Body, Json)
                       ?? throw new ArgumentException("Request body is required.");
            return await Ok(req, await _svc.SaveBeforeAnaesthesiaAsync(id, tid, userId, body));
        }
        catch (KeyNotFoundException ex)        { return await NotFound(req, ex.Message); }
        catch (UnauthorizedAccessException ex) { return await Unauthorized(req, ex.Message); }
        catch (ArgumentException ex)           { return await BadRequest(req, ex.Message); }
        catch (Exception ex)                 { return await InternalError(req, ex.Message); }
    }

    [Function("SaveWhoTimeout")]
    public async Task<HttpResponseData> SaveWho(
        [HttpTrigger(AuthorizationLevel.Function, "put",
            Route = "ip-management/journeys/{id:guid}/surgical-safety/who-timeout")]
        HttpRequestData req, Guid id)
    {
        try
        {
            IpChecklistAuth.RequirePermission(req, _jwt, "ot.safety.sign");
            var (userId, tenantId) = _jwt.ValidateAndExtract(req);
            var tid                = _jwt.ExtractTenantId(req, tenantId);
            var body = await JsonSerializer.DeserializeAsync<SaveWhoTimeoutRequest>(req.Body, Json)
                       ?? throw new ArgumentException("Request body is required.");
            return await Ok(req, await _svc.SaveWhoTimeoutAsync(id, tid, userId, body));
        }
        catch (KeyNotFoundException ex)        { return await NotFound(req, ex.Message); }
        catch (UnauthorizedAccessException ex) { return await Unauthorized(req, ex.Message); }
        catch (ArgumentException ex)           { return await BadRequest(req, ex.Message); }
        catch (Exception ex)                 { return await InternalError(req, ex.Message); }
    }

    [Function("SaveAfterSurgery")]
    public async Task<HttpResponseData> SaveAfter(
        [HttpTrigger(AuthorizationLevel.Function, "put",
            Route = "ip-management/journeys/{id:guid}/surgical-safety/after-surgery")]
        HttpRequestData req, Guid id)
    {
        try
        {
            IpChecklistAuth.RequirePermission(req, _jwt, "ot.safety.sign");
            var (userId, tenantId) = _jwt.ValidateAndExtract(req);
            var tid                = _jwt.ExtractTenantId(req, tenantId);
            var body = await JsonSerializer.DeserializeAsync<SaveAfterSurgeryRequest>(req.Body, Json)
                       ?? throw new ArgumentException("Request body is required.");
            return await Ok(req, await _svc.SaveAfterSurgeryAsync(id, tid, userId, body));
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
