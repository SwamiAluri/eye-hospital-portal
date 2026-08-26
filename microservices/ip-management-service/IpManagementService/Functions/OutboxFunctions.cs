using System.Net;
using System.Text.Json;
using System.Text.Json.Serialization;
using IpManagementService.Services;
using Microsoft.Azure.Functions.Worker;
using Microsoft.Azure.Functions.Worker.Http;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;

namespace IpManagementService.Functions;

/// <summary>
/// Processes the integration outbox for reliable IP → CCMS lifecycle delivery (Phase 2 / Wave 2).
/// Hangfire is the primary processor; this timer is a backup when Hangfire is disabled.
/// Operator health endpoints (OPS-070) are JWT + integration.admin.
/// Function-key stats/process are kept for Hangfire/manual drain.
/// </summary>
public class OutboxFunctions
{
    private readonly IIntegrationOutboxService _outbox;
    private readonly JwtService _jwt;
    private readonly IConfiguration _config;
    private readonly ILogger<OutboxFunctions> _log;

    private static readonly JsonSerializerOptions Json = new()
    {
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
        PropertyNameCaseInsensitive = true,
        DefaultIgnoreCondition = JsonIgnoreCondition.WhenWritingNull,
    };

    public OutboxFunctions(
        IIntegrationOutboxService outbox,
        JwtService jwt,
        IConfiguration config,
        ILogger<OutboxFunctions> log)
    {
        _outbox = outbox;
        _jwt = jwt;
        _config = config;
        _log = log;
    }

    /// <summary>Timer every 30s — skipped when Hangfire:Enabled is true.</summary>
    [Function("ProcessIntegrationOutbox")]
    public async Task ProcessIntegrationOutbox(
        [TimerTrigger("*/30 * * * * *")] TimerInfo timer)
    {
        if (_config.GetValue("Hangfire:Enabled", true))
            return;

        var count = await _outbox.ProcessPendingAsync();
        if (count > 0)
            _log.LogInformation("Integration outbox processed {Count} event(s)", count);
    }

    /// <summary>Manual/ops endpoint to drain the outbox (authorized via function key).</summary>
    [Function("ProcessIntegrationOutboxNow")]
    public async Task<HttpResponseData> ProcessIntegrationOutboxNow(
        [HttpTrigger(AuthorizationLevel.Function, "post",
            Route = "ip-management/integration/outbox/process")] HttpRequestData req)
    {
        var count = await _outbox.ProcessPendingAsync(batchSize: 100);
        var resp = req.CreateResponse(HttpStatusCode.OK);
        await resp.WriteAsJsonAsync(new { processed = count });
        return resp;
    }

    [Function("IntegrationOutboxStats")]
    public async Task<HttpResponseData> IntegrationOutboxStats(
        [HttpTrigger(AuthorizationLevel.Function, "get",
            Route = "ip-management/integration/outbox/stats")] HttpRequestData req)
    {
        var stats = await _outbox.GetStatsAsync();
        var resp = req.CreateResponse(HttpStatusCode.OK);
        await resp.WriteAsJsonAsync(stats);
        return resp;
    }

    [Function("IntegrationOutboxHealth")]
    public async Task<HttpResponseData> IntegrationOutboxHealth(
        [HttpTrigger(AuthorizationLevel.Anonymous, "get",
            Route = "ip-management/integration/outbox/health")] HttpRequestData req)
    {
        try
        {
            var (_, tenantId) = RequireAdmin(req);
            var stats = await _outbox.GetStatsAsync(tenantId);
            return await Ok(req, stats);
        }
        catch (UnauthorizedAccessException ex) { return await Unauthorized(req, ex.Message); }
        catch (Exception ex) { return await InternalError(req, ex.Message); }
    }

    [Function("IntegrationOutboxDead")]
    public async Task<HttpResponseData> IntegrationOutboxDead(
        [HttpTrigger(AuthorizationLevel.Anonymous, "get",
            Route = "ip-management/integration/outbox/dead")] HttpRequestData req)
    {
        try
        {
            var (_, tenantId) = RequireAdmin(req);
            var rows = await _outbox.ListDeadAsync(tenantId);
            return await Ok(req, rows);
        }
        catch (UnauthorizedAccessException ex) { return await Unauthorized(req, ex.Message); }
        catch (Exception ex) { return await InternalError(req, ex.Message); }
    }

    [Function("IntegrationOutboxEvent")]
    public async Task<HttpResponseData> IntegrationOutboxEvent(
        [HttpTrigger(AuthorizationLevel.Anonymous, "get",
            Route = "ip-management/integration/outbox/events/{eventId:guid}")] HttpRequestData req,
        Guid eventId)
    {
        try
        {
            var (userId, tenantId) = RequireAdmin(req);
            var detail = await _outbox.GetEventAsync(tenantId, eventId);
            _log.LogInformation("Outbox inspect {EventId} by {UserId}", eventId, userId);
            return await Ok(req, detail);
        }
        catch (UnauthorizedAccessException ex) { return await Unauthorized(req, ex.Message); }
        catch (KeyNotFoundException ex) { return await NotFound(req, ex.Message); }
        catch (Exception ex) { return await InternalError(req, ex.Message); }
    }

    [Function("IntegrationOutboxRequeue")]
    public async Task<HttpResponseData> IntegrationOutboxRequeue(
        [HttpTrigger(AuthorizationLevel.Anonymous, "post",
            Route = "ip-management/integration/outbox/requeue")] HttpRequestData req)
    {
        try
        {
            var (_, tenantId) = RequireAdmin(req);
            var body = await JsonSerializer.DeserializeAsync<OutboxRequeueRequest>(req.Body, Json)
                       ?? new OutboxRequeueRequest(null, null);
            var n = await _outbox.RequeueAsync(tenantId, body);
            return await Ok(req, new { requeued = n });
        }
        catch (UnauthorizedAccessException ex) { return await Unauthorized(req, ex.Message); }
        catch (ArgumentException ex) { return await BadRequest(req, ex.Message); }
        catch (InvalidOperationException ex) { return await BadRequest(req, ex.Message); }
        catch (KeyNotFoundException ex) { return await NotFound(req, ex.Message); }
        catch (Exception ex) { return await InternalError(req, ex.Message); }
    }

    [Function("IntegrationOutboxAbandon")]
    public async Task<HttpResponseData> IntegrationOutboxAbandon(
        [HttpTrigger(AuthorizationLevel.Anonymous, "post",
            Route = "ip-management/integration/outbox/abandon")] HttpRequestData req)
    {
        try
        {
            var (userId, tenantId) = RequireAdmin(req);
            var body = await JsonSerializer.DeserializeAsync<OutboxAbandonRequest>(req.Body, Json)
                       ?? throw new ArgumentException("Abandon body is required.");
            await _outbox.AbandonAsync(tenantId, userId, body);
            return await Ok(req, new { abandoned = true });
        }
        catch (UnauthorizedAccessException ex) { return await Unauthorized(req, ex.Message); }
        catch (ArgumentException ex) { return await BadRequest(req, ex.Message); }
        catch (InvalidOperationException ex) { return await BadRequest(req, ex.Message); }
        catch (KeyNotFoundException ex) { return await NotFound(req, ex.Message); }
        catch (Exception ex) { return await InternalError(req, ex.Message); }
    }

    private (Guid UserId, Guid TenantId) RequireAdmin(HttpRequestData req)
    {
        IpChecklistAuth.RequirePermission(req, _jwt, OutboxHealthSupport.PermIntegrationAdmin);
        return _jwt.ValidateAndExtract(req);
    }

    private static async Task<HttpResponseData> Ok(HttpRequestData req, object payload)
    {
        var r = req.CreateResponse(HttpStatusCode.OK);
        r.Headers.Add("Content-Type", "application/json; charset=utf-8");
        await r.WriteStringAsync(JsonSerializer.Serialize(payload, Json));
        return r;
    }

    private static async Task<HttpResponseData> BadRequest(HttpRequestData req, string message)
    {
        var r = req.CreateResponse(HttpStatusCode.BadRequest);
        await r.WriteAsJsonAsync(new { error = message });
        return r;
    }

    private static async Task<HttpResponseData> Unauthorized(HttpRequestData req, string message)
    {
        var r = req.CreateResponse(HttpStatusCode.Unauthorized);
        await r.WriteAsJsonAsync(new { error = message });
        return r;
    }

    private static async Task<HttpResponseData> NotFound(HttpRequestData req, string message)
    {
        var r = req.CreateResponse(HttpStatusCode.NotFound);
        await r.WriteAsJsonAsync(new { error = message });
        return r;
    }

    private static async Task<HttpResponseData> InternalError(HttpRequestData req, string message)
    {
        var r = req.CreateResponse(HttpStatusCode.InternalServerError);
        await r.WriteAsJsonAsync(new { error = message });
        return r;
    }
}
