using System.Net;
using System.Text.Json;
using System.Text.Json.Serialization;
using Microsoft.Azure.Functions.Worker;
using Microsoft.Azure.Functions.Worker.Http;
using Microsoft.Extensions.Logging;
using CcmsApi.Services;
using CcmsApi.Data;
using Microsoft.EntityFrameworkCore;
using Npgsql;
using NpgsqlTypes;

namespace CcmsApi.Functions;

/// <summary>
/// Workflow Engine endpoints — query definitions, states, transitions, fire events.
/// Route prefix: /api/ccms/workflow
/// </summary>
public class WorkflowFunctions
{
    private readonly JwtService _jwt;
    private readonly IWorkflowEngine _engine;
    private readonly CcmsDbContext _db;
    private readonly ILogger<WorkflowFunctions> _log;

    private static readonly JsonSerializerOptions JsonOpts = new()
    {
        PropertyNamingPolicy      = JsonNamingPolicy.CamelCase,
        DefaultIgnoreCondition    = JsonIgnoreCondition.WhenWritingNull,
        Converters                = { new JsonStringEnumConverter() }
    };

    public WorkflowFunctions(
        JwtService jwt,
        IWorkflowEngine engine,
        CcmsDbContext db,
        ILogger<WorkflowFunctions> log)
    {
        _jwt    = jwt;
        _engine = engine;
        _db     = db;
        _log    = log;
    }

    // ── GET /api/ccms/workflow/definitions ───────────────────────────────────
    [Function("GetWorkflowDefinitions")]
    public async Task<HttpResponseData> GetDefinitions(
        [HttpTrigger(AuthorizationLevel.Anonymous, "get",
            Route = "ccms/workflow/definitions")] HttpRequestData req,
        CancellationToken ct)
    {
        try
        {
            _jwt.ValidateAndExtract(req);
            var defs = await _db.WorkflowDefinitions
                .AsNoTracking()
                .Where(d => d.IsActive && d.DeletedAt == null)
                .OrderBy(d => d.Code)
                .ToListAsync(ct);

            return await Ok(req, defs, ct);
        }
        catch (UnauthorizedAccessException ex) { return await Unauthorized(req, ex.Message, ct); }
        catch (Exception ex) { return await Error(req, ex, ct); }
    }

    // ── GET /api/ccms/workflow/instances/{instanceId}/state ──────────────────
    [Function("GetWorkflowInstanceState")]
    public async Task<HttpResponseData> GetState(
        [HttpTrigger(AuthorizationLevel.Anonymous, "get",
            Route = "ccms/workflow/instances/{instanceId}/state")] HttpRequestData req,
        string instanceId,
        CancellationToken ct)
    {
        try
        {
            _jwt.ValidateAndExtract(req);
            if (!Guid.TryParse(instanceId, out var id))
                return await BadRequest(req, "Invalid instanceId.", ct);

            var stateCode = await _engine.GetCurrentStateCodeAsync(id, ct);
            var transitions = await _engine.GetAvailableTransitionsAsync(id, ct);

            return await Ok(req, new
            {
                instanceId,
                currentState = stateCode,
                availableEvents = transitions.Select(t => t.TriggerEvent).ToList()
            }, ct);
        }
        catch (KeyNotFoundException ex) { return await NotFound(req, ex.Message, ct); }
        catch (UnauthorizedAccessException ex) { return await Unauthorized(req, ex.Message, ct); }
        catch (Exception ex) { return await Error(req, ex, ct); }
    }

    // ── GET /api/ccms/workflow/instances/{instanceId}/history ────────────────
    // Returns normalized DTO shape: { fromState, toState, actionCode, performedAt, comment }
    [Function("GetWorkflowHistory")]
    public async Task<HttpResponseData> GetHistory(
        [HttpTrigger(AuthorizationLevel.Anonymous, "get",
            Route = "ccms/workflow/instances/{instanceId}/history")] HttpRequestData req,
        string instanceId,
        CancellationToken ct)
    {
        try
        {
            _jwt.ValidateAndExtract(req);
            if (!Guid.TryParse(instanceId, out var id))
                return await BadRequest(req, "Invalid instanceId.", ct);

            var rawHistory = await _engine.GetHistoryAsync(id, ct);
            if (!rawHistory.Any())
                return await Ok(req, Array.Empty<object>(), ct);

            // ── Resolve state IDs → state codes using raw ADO.NET with nil-UUID tenant context.
            // ccms_workflow_states rows for the CCMS_MAIN definition are system-tenant rows
            // (tenant_id = '00000000-0000-0000-0000-000000000000'). EF Core's
            // TenantCommandInterceptor runs under the REAL tenant, so RLS hides them.
            // Using the same SET LOCAL pattern as FetchSystemWorkflowAsync bypasses RLS.
            // Always attempt ID lookup — denormalized codes may be missing on legacy rows.
            var stateIds = rawHistory
                .SelectMany(h => new[] { h.FromStateId, (Guid?)h.ToStateId })
                .Where(sid => sid.HasValue)
                .Select(sid => sid!.Value)
                .Distinct()
                .ToList();

            var statesById = stateIds.Count > 0
                ? await _engine.ResolveStateCodesAsync(stateIds, ct)
                : new Dictionary<Guid, string>();

            var dto = rawHistory.Select(h =>
            {
                // Prefer denormalized code → ID lookup → sentinel (never raw GUID)
                var from = !string.IsNullOrEmpty(h.FromStateCode)
                    ? h.FromStateCode
                    : h.FromStateId.HasValue && statesById.TryGetValue(h.FromStateId.Value, out var f)
                        ? f : "DRAFT";
                var to = !string.IsNullOrEmpty(h.ToStateCode)
                    ? h.ToStateCode
                    : statesById.TryGetValue(h.ToStateId, out var t)
                        ? t : "UNKNOWN";
                return new
                {
                    fromState   = from,
                    toState     = to,
                    actionCode  = h.TriggerEvent,
                    performedAt = h.TransitionedAt.ToString("O"),
                    comment     = h.Notes,
                };
            });

            return await Ok(req, dto, ct);
        }
        catch (KeyNotFoundException ex) { return await NotFound(req, ex.Message, ct); }
        catch (UnauthorizedAccessException ex) { return await Unauthorized(req, ex.Message, ct); }
        catch (Exception ex) { return await Error(req, ex, ct); }
    }

    // ── POST /api/ccms/workflow/instances/{instanceId}/fire ──────────────────
    [Function("FireWorkflowEvent")]
    public async Task<HttpResponseData> Fire(
        [HttpTrigger(AuthorizationLevel.Anonymous, "post",
            Route = "ccms/workflow/instances/{instanceId}/fire")] HttpRequestData req,
        string instanceId,
        CancellationToken ct)
    {
        try
        {
            var (userId, _) = _jwt.ValidateAndExtract(req);
            if (!Guid.TryParse(instanceId, out var id))
                return await BadRequest(req, "Invalid instanceId.", ct);

            var body = await JsonSerializer.DeserializeAsync<FireEventRequest>(
                req.Body, JsonOpts, ct)
                ?? throw new ArgumentException("Request body required.");

            if (string.IsNullOrWhiteSpace(body.TriggerEvent))
                return await BadRequest(req, "triggerEvent is required.", ct);

            var result = await _engine.FireAsync(id, body.TriggerEvent, userId, body.Notes, ct);

            if (!result.Success)
            {
                var resp = req.CreateResponse(HttpStatusCode.Conflict);
                resp.Headers.Add("Content-Type", "application/json");
                await resp.WriteStringAsync(JsonSerializer.Serialize(new
                {
                    success = false,
                    error = result.ErrorMessage
                }, JsonOpts), ct);
                return resp;
            }

            return await Ok(req, new
            {
                success = true,
                fromState = result.FromState,
                toState = result.ToState,
                triggerEvent = result.TriggerEvent
            }, ct);
        }
        catch (KeyNotFoundException ex) { return await NotFound(req, ex.Message, ct); }
        catch (UnauthorizedAccessException ex) { return await Unauthorized(req, ex.Message, ct); }
        catch (Exception ex) { return await Error(req, ex, ct); }
    }

    // ── Helper response builders ─────────────────────────────────────────────
    private static async Task<HttpResponseData> Ok(HttpRequestData req, object data, CancellationToken ct)
    {
        var resp = req.CreateResponse(HttpStatusCode.OK);
        resp.Headers.Add("Content-Type", "application/json");
        await resp.WriteStringAsync(JsonSerializer.Serialize(data, JsonOpts), ct);
        return resp;
    }

    private static async Task<HttpResponseData> BadRequest(HttpRequestData req, string msg, CancellationToken ct)
    {
        var resp = req.CreateResponse(HttpStatusCode.BadRequest);
        resp.Headers.Add("Content-Type", "application/json");
        await resp.WriteStringAsync(JsonSerializer.Serialize(new { error = msg }, JsonOpts), ct);
        return resp;
    }

    private static async Task<HttpResponseData> NotFound(HttpRequestData req, string msg, CancellationToken ct)
    {
        var resp = req.CreateResponse(HttpStatusCode.NotFound);
        resp.Headers.Add("Content-Type", "application/json");
        await resp.WriteStringAsync(JsonSerializer.Serialize(new { error = msg }, JsonOpts), ct);
        return resp;
    }

    private static async Task<HttpResponseData> Unauthorized(HttpRequestData req, string msg, CancellationToken ct)
    {
        var resp = req.CreateResponse(HttpStatusCode.Unauthorized);
        resp.Headers.Add("Content-Type", "application/json");
        await resp.WriteStringAsync(JsonSerializer.Serialize(new { error = msg }, JsonOpts), ct);
        return resp;
    }

    private async Task<HttpResponseData> Error(HttpRequestData req, Exception ex, CancellationToken ct)
    {
        _log.LogError(ex, "Unhandled error in WorkflowFunctions");
        var resp = req.CreateResponse(HttpStatusCode.InternalServerError);
        resp.Headers.Add("Content-Type", "application/json");
        await resp.WriteStringAsync(JsonSerializer.Serialize(
            new { error = "Internal server error." }, JsonOpts), ct);
        return resp;
    }

    private record FireEventRequest(string TriggerEvent, string? Notes);
}
