using System.Net;
using System.Text.Json;
using System.Text.Json.Serialization;
using Microsoft.Azure.Functions.Worker;
using Microsoft.Azure.Functions.Worker.Http;
using IpManagementService.Models.Dtos;
using IpManagementService.Services;

namespace IpManagementService.Functions;

/// <summary>
/// Form 5 — Anaesthesia Monitoring.
///   GET    /api/ip-management/journeys/{id}/anaesthesia-monitoring
///   PUT    /api/ip-management/journeys/{id}/anaesthesia-monitoring/pre-op-review
///   POST   /api/ip-management/journeys/{id}/anaesthesia-monitoring/readings
///   PUT    /api/ip-management/journeys/{id}/anaesthesia-monitoring/readings/{readingId}
///   DELETE /api/ip-management/journeys/{id}/anaesthesia-monitoring/readings/{readingId}
///   PUT    /api/ip-management/journeys/{id}/anaesthesia-monitoring/discharge-clearance
/// </summary>
public class AnaesthesiaMonitoringFunctions
{
    private readonly AnaesthesiaMonitoringService _svc;
    private readonly JwtService                   _jwt;

    private static readonly JsonSerializerOptions Json = new()
    {
        PropertyNamingPolicy   = JsonNamingPolicy.CamelCase,
        DefaultIgnoreCondition = JsonIgnoreCondition.WhenWritingNull,
    };

    public AnaesthesiaMonitoringFunctions(AnaesthesiaMonitoringService svc, JwtService jwt)
    {
        _svc = svc;
        _jwt = jwt;
    }

    [Function("GetAnaesthesiaMonitoring")]
    public async Task<HttpResponseData> Get(
        [HttpTrigger(AuthorizationLevel.Function, "get",
            Route = "ip-management/journeys/{id:guid}/anaesthesia-monitoring")]
        HttpRequestData req, Guid id)
    {
        try
        {
            var (_, tenantId) = _jwt.ValidateAndExtract(req);
            var tid           = _jwt.ExtractTenantId(req, tenantId);
            return await Ok(req, await _svc.GetMonitoringAsync(id, tid));
        }
        catch (KeyNotFoundException ex)        { return await NotFound(req, ex.Message); }
        catch (UnauthorizedAccessException ex) { return await Unauthorized(req, ex.Message); }
        catch (Exception ex)                 { return await InternalError(req, ex.Message); }
    }

    [Function("SavePreOpReview")]
    public async Task<HttpResponseData> SavePreOpReview(
        [HttpTrigger(AuthorizationLevel.Function, "put",
            Route = "ip-management/journeys/{id:guid}/anaesthesia-monitoring/pre-op-review")]
        HttpRequestData req, Guid id)
    {
        try
        {
            IpChecklistAuth.RequirePermission(req, _jwt, "anaesthesia.monitoring.edit");
            var (userId, tenantId) = _jwt.ValidateAndExtract(req);
            var tid                = _jwt.ExtractTenantId(req, tenantId);
            var body = await JsonSerializer.DeserializeAsync<SavePreOpReviewRequest>(req.Body, Json)
                       ?? throw new ArgumentException("Request body is required.");
            return await Ok(req, await _svc.SavePreOpReviewAsync(id, tid, userId, body));
        }
        catch (KeyNotFoundException ex)        { return await NotFound(req, ex.Message); }
        catch (UnauthorizedAccessException ex) { return await Unauthorized(req, ex.Message); }
        catch (ArgumentException ex)           { return await BadRequest(req, ex.Message); }
        catch (Exception ex)                 { return await InternalError(req, ex.Message); }
    }

    [Function("AddMonitoringReading")]
    public async Task<HttpResponseData> AddReading(
        [HttpTrigger(AuthorizationLevel.Function, "post",
            Route = "ip-management/journeys/{id:guid}/anaesthesia-monitoring/readings")]
        HttpRequestData req, Guid id)
    {
        try
        {
            IpChecklistAuth.RequirePermission(req, _jwt, "anaesthesia.monitoring.edit");
            var (_, tenantId) = _jwt.ValidateAndExtract(req);
            var tid           = _jwt.ExtractTenantId(req, tenantId);
            var body = await JsonSerializer.DeserializeAsync<SaveMonitoringReadingRequest>(req.Body, Json)
                       ?? throw new ArgumentException("Request body is required.");
            return await Ok(req, await _svc.AddReadingAsync(id, tid, body));
        }
        catch (KeyNotFoundException ex)        { return await NotFound(req, ex.Message); }
        catch (UnauthorizedAccessException ex) { return await Unauthorized(req, ex.Message); }
        catch (ArgumentException ex)           { return await BadRequest(req, ex.Message); }
        catch (Exception ex)                 { return await InternalError(req, ex.Message); }
    }

    [Function("UpdateMonitoringReading")]
    public async Task<HttpResponseData> UpdateReading(
        [HttpTrigger(AuthorizationLevel.Function, "put",
            Route = "ip-management/journeys/{id:guid}/anaesthesia-monitoring/readings/{readingId:guid}")]
        HttpRequestData req, Guid id, Guid readingId)
    {
        try
        {
            IpChecklistAuth.RequirePermission(req, _jwt, "anaesthesia.monitoring.edit");
            var (_, tenantId) = _jwt.ValidateAndExtract(req);
            var tid           = _jwt.ExtractTenantId(req, tenantId);
            var body = await JsonSerializer.DeserializeAsync<UpdateMonitoringReadingRequest>(req.Body, Json)
                       ?? throw new ArgumentException("Request body is required.");
            return await Ok(req, await _svc.UpdateReadingAsync(id, tid, readingId, body));
        }
        catch (KeyNotFoundException ex)        { return await NotFound(req, ex.Message); }
        catch (UnauthorizedAccessException ex) { return await Unauthorized(req, ex.Message); }
        catch (ArgumentException ex)           { return await BadRequest(req, ex.Message); }
        catch (Exception ex)                 { return await InternalError(req, ex.Message); }
    }

    [Function("RemoveMonitoringReading")]
    public async Task<HttpResponseData> RemoveReading(
        [HttpTrigger(AuthorizationLevel.Function, "delete",
            Route = "ip-management/journeys/{id:guid}/anaesthesia-monitoring/readings/{readingId:guid}")]
        HttpRequestData req, Guid id, Guid readingId)
    {
        try
        {
            IpChecklistAuth.RequirePermission(req, _jwt, "anaesthesia.monitoring.edit");
            var (_, tenantId) = _jwt.ValidateAndExtract(req);
            var tid           = _jwt.ExtractTenantId(req, tenantId);
            return await Ok(req, await _svc.RemoveReadingAsync(id, tid, readingId));
        }
        catch (KeyNotFoundException ex)        { return await NotFound(req, ex.Message); }
        catch (UnauthorizedAccessException ex) { return await Unauthorized(req, ex.Message); }
        catch (Exception ex)                 { return await InternalError(req, ex.Message); }
    }

    [Function("SaveDischargeClearance")]
    public async Task<HttpResponseData> SaveDischargeClearance(
        [HttpTrigger(AuthorizationLevel.Function, "put",
            Route = "ip-management/journeys/{id:guid}/anaesthesia-monitoring/discharge-clearance")]
        HttpRequestData req, Guid id)
    {
        try
        {
            IpChecklistAuth.RequirePermission(req, _jwt, "anaesthesia.monitoring.edit");
            var (userId, tenantId) = _jwt.ValidateAndExtract(req);
            var tid                = _jwt.ExtractTenantId(req, tenantId);
            var body = await JsonSerializer.DeserializeAsync<SaveDischargeClearanceRequest>(req.Body, Json)
                       ?? throw new ArgumentException("Request body is required.");
            return await Ok(req, await _svc.SaveDischargeClearanceAsync(id, tid, userId, body));
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
