using CcmsApi.Data;
using CcmsApi.Models.Domain;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using Npgsql;
using NpgsqlTypes;

namespace CcmsApi.Services;

public interface IWorkflowEngine
{
    /// <summary>Start a new workflow instance for an entity (e.g. coverage_case).</summary>
    Task<CcmsWorkflowInstance> StartAsync(
        Guid tenantId, Guid entityId, string entityType,
        Guid actorUserId, CancellationToken ct = default);

    /// <summary>Fire a trigger event on a workflow instance.</summary>
    Task<TransitionResult> FireAsync(
        Guid instanceId, string triggerEvent,
        Guid actorUserId, string? notes = null,
        CancellationToken ct = default);

    /// <summary>Get current state code for a workflow instance.</summary>
    Task<string> GetCurrentStateCodeAsync(Guid instanceId, CancellationToken ct = default);

    /// <summary>Get all valid next transitions from current state.</summary>
    Task<List<CcmsWorkflowTransition>> GetAvailableTransitionsAsync(
        Guid instanceId, CancellationToken ct = default);

    /// <summary>Get complete transition history for an instance.</summary>
    Task<List<CcmsWorkflowHistory>> GetHistoryAsync(
        Guid instanceId, CancellationToken ct = default);

    /// <summary>Resolve workflow state GUIDs to state codes (system-tenant rows via nil-UUID RLS context).</summary>
    Task<Dictionary<Guid, string>> ResolveStateCodesAsync(
        List<Guid> stateIds, CancellationToken ct = default);
}

public record TransitionResult(
    bool   Success,
    string FromState,
    string ToState,
    string TriggerEvent,
    string? ErrorMessage = null
);

public class WorkflowEngine : IWorkflowEngine
{
    private readonly CcmsDbContext _db;
    private readonly ILogger<WorkflowEngine> _log;

    // System tenant UUID used in seed data definitions.
    private static readonly Guid SystemTenantId = Guid.Empty;

    public WorkflowEngine(CcmsDbContext db, ILogger<WorkflowEngine> log)
    {
        _db  = db;
        _log = log;
    }

    public async Task<CcmsWorkflowInstance> StartAsync(
        Guid tenantId, Guid entityId, string entityType,
        Guid actorUserId, CancellationToken ct = default)
    {
        // Fetch the CCMS_MAIN definition + initial state using raw ADO.NET.
        // EF Core's TenantCommandInterceptor sets app.current_tenant_id to the real tenant,
        // which would hide the nil-UUID system rows via RLS. We override that here by
        // temporarily setting current_tenant_id to the nil UUID inside a rolled-back transaction
        // (SET LOCAL scoping means the override dies with the transaction).
        var (definitionId, initialStateId, initialStateCode) = await FetchSystemWorkflowAsync(ct);

        var instance = new CcmsWorkflowInstance
        {
            Id                   = Guid.NewGuid(),
            TenantId             = tenantId,
            WorkflowDefinitionId = definitionId,
            CurrentStateId       = initialStateId,
            EntityType           = entityType,
            EntityId             = entityId,
            StartedAt            = DateTime.UtcNow,
            CreatedAt            = DateTime.UtcNow,
            UpdatedAt            = DateTime.UtcNow,
            CreatedByUserId      = actorUserId,
            UpdatedByUserId      = actorUserId,
            Status               = "active"
        };

        _db.WorkflowInstances.Add(instance);

        // Record initial history entry (null from state = start)
        var history = new CcmsWorkflowHistory
        {
            Id                 = Guid.NewGuid(),
            TenantId           = tenantId,
            WorkflowInstanceId = instance.Id,
            FromStateId        = null,
            ToStateId          = initialStateId,
            FromStateCode      = null,
            ToStateCode        = initialStateCode,
            TriggerEvent       = "START",
            ActorUserId        = actorUserId,
            TransitionedAt     = DateTime.UtcNow,
            CreatedAt          = DateTime.UtcNow,
            UpdatedAt          = DateTime.UtcNow,
            CreatedByUserId    = actorUserId,
            UpdatedByUserId    = actorUserId,
            Status             = "active"
        };
        _db.WorkflowHistories.Add(history);

        await _db.SaveChangesAsync(ct);
        _log.LogInformation("Workflow instance {Id} started for {EntityType}/{EntityId} at state {State}",
            instance.Id, entityType, entityId, initialStateCode);

        return instance;
    }

    /// <summary>
    /// Fetches the CCMS_MAIN workflow definition and initial state using raw ADO.NET
    /// with the tenant context pinned to nil UUID so RLS exposes system-tenant rows.
    /// The transaction is rolled back immediately — this is a pure read.
    /// </summary>
    private async Task<(Guid defId, Guid stateId, string stateCode)> FetchSystemWorkflowAsync(CancellationToken ct)
    {
        var conn = _db.Database.GetDbConnection();
        if (conn.State != System.Data.ConnectionState.Open)
            await conn.OpenAsync(ct);

        await using var tx = await conn.BeginTransactionAsync(ct);
        try
        {
            // Override RLS tenant context to nil UUID so system-tenant rows are visible
            using (var setCmd = conn.CreateCommand())
            {
                setCmd.Transaction = tx;
                setCmd.CommandText = "SET LOCAL app.current_tenant_id = '00000000-0000-0000-0000-000000000000'";
                await setCmd.ExecuteNonQueryAsync(ct);
            }

            using (var qCmd = conn.CreateCommand())
            {
                qCmd.Transaction = tx;
                qCmd.CommandText = """
                    SELECT d.id, s.id, s.state_code
                    FROM   ccms_workflow_definitions d
                    JOIN   ccms_workflow_states s
                      ON   s.workflow_definition_id = d.id
                     AND   s.is_initial  = TRUE
                     AND   s.deleted_at  IS NULL
                    WHERE  d.code       = 'CCMS_MAIN'
                      AND  d.is_active  = TRUE
                      AND  d.deleted_at IS NULL
                    LIMIT 1
                    """;

                await using var reader = await qCmd.ExecuteReaderAsync(ct);
                if (!await reader.ReadAsync(ct))
                    throw new InvalidOperationException(
                        "CCMS_MAIN workflow definition not found. Run migrations 108 and 121.");

                return (reader.GetGuid(0), reader.GetGuid(1), reader.GetString(2));
            }
        }
        finally
        {
            await tx.RollbackAsync(ct); // SET LOCAL dies with the transaction
        }
    }

    public async Task<TransitionResult> FireAsync(
        Guid instanceId, string triggerEvent,
        Guid actorUserId, string? notes = null,
        CancellationToken ct = default)
    {
        // ── 1. Read via EF Core (AsNoTracking — writes use raw ADO.NET below) ──────────
        var instance = await _db.WorkflowInstances
            .AsNoTracking()
            .FirstOrDefaultAsync(i => i.Id == instanceId && i.DeletedAt == null, ct)
            ?? throw new KeyNotFoundException($"Workflow instance {instanceId} not found.");

        var fromState = await _db.WorkflowStates
            .AsNoTracking()
            .FirstOrDefaultAsync(s => s.Id == instance.CurrentStateId, ct)
            ?? throw new InvalidOperationException("Current state not found.");

        if (fromState.IsFinal || fromState.IsTerminal)
            return new TransitionResult(false, fromState.StateCode, fromState.StateCode,
                triggerEvent, "Cannot transition from a terminal/final state.");

        var transition = await _db.WorkflowTransitions
            .AsNoTracking()
            .FirstOrDefaultAsync(t =>
                t.WorkflowDefinitionId == instance.WorkflowDefinitionId &&
                t.FromStateId          == instance.CurrentStateId &&
                t.TriggerEvent         == triggerEvent &&
                t.DeletedAt            == null, ct);

        if (transition is null)
        {
            _log.LogWarning("No valid transition found from {From} via {Event}", fromState.StateCode, triggerEvent);
            return new TransitionResult(false, fromState.StateCode, fromState.StateCode,
                triggerEvent, $"Event '{triggerEvent}' is not valid from state '{fromState.StateCode}'.");
        }

        var toState = await _db.WorkflowStates
            .AsNoTracking()
            .FirstOrDefaultAsync(s => s.Id == transition.ToStateId, ct)
            ?? throw new InvalidOperationException("Target state not found.");

        // ── 2. Write via raw ADO.NET + explicit transaction ──────────────────────────
        // EF Core's SaveChangesAsync silently updates 0 rows on ccms_workflow_instances
        // because TenantCommandInterceptor's SET LOCAL executes as a separate autocommit
        // statement — its effect does not persist to the subsequent UPDATE on Azure PG 17.
        // Raw ADO.NET with an explicit transaction (same pattern as FetchSystemWorkflowAsync)
        // pins SET LOCAL for the entire write transaction so RLS passes.
        var conn = _db.Database.GetDbConnection();
        if (conn.State != System.Data.ConnectionState.Open)
            await conn.OpenAsync(ct);

        await using var tx = await conn.BeginTransactionAsync(ct);

        // Pin real tenant context so RLS allows writes
        using (var setCmd = conn.CreateCommand())
        {
            setCmd.Transaction = tx;
            setCmd.CommandText = $"SET LOCAL app.current_tenant_id = '{instance.TenantId}'";
            await setCmd.ExecuteNonQueryAsync(ct);
        }

        // UPDATE workflow instance current state
        using (var updCmd = conn.CreateCommand())
        {
            updCmd.Transaction = tx;
            updCmd.CommandText =
                "UPDATE ccms_workflow_instances " +
                "SET current_state_id   = @to_state_id, " +
                "    updated_at         = NOW(), " +
                "    updated_by_user_id = @actor, " +
                "    row_version        = row_version + 1 " +
                "WHERE id = @instance_id AND deleted_at IS NULL";
            var p1 = updCmd.CreateParameter(); p1.ParameterName = "to_state_id"; p1.Value = toState.Id;   updCmd.Parameters.Add(p1);
            var p2 = updCmd.CreateParameter(); p2.ParameterName = "actor";       p2.Value = actorUserId;  updCmd.Parameters.Add(p2);
            var p3 = updCmd.CreateParameter(); p3.ParameterName = "instance_id"; p3.Value = instanceId;   updCmd.Parameters.Add(p3);
            await updCmd.ExecuteNonQueryAsync(ct);
        }

        // INSERT history record (append-only audit trail)
        using (var insCmd = conn.CreateCommand())
        {
            insCmd.Transaction = tx;
            insCmd.CommandText =
                "INSERT INTO ccms_workflow_history " +
                "(id, tenant_id, workflow_instance_id, from_state_id, to_state_id, " +
                " from_state_code, to_state_code, trigger_event, actor_user_id, notes, transitioned_at, " +
                " created_at, updated_at, created_by_user_id, updated_by_user_id, " +
                " deleted_at, status, row_version) " +
                "VALUES " +
                "(@hid, @tenant_id, @instance_id, @from_state_id, @to_state_id, " +
                " @from_state_code, @to_state_code, @trigger_event, @actor_user_id, @notes, NOW(), " +
                " NOW(), NOW(), @actor_user_id, @actor_user_id, " +
                " NULL, 'active', 1)";
            void AddParam(string name, object? val)
            {
                var p = insCmd.CreateParameter();
                p.ParameterName = name;
                p.Value = val ?? DBNull.Value;
                insCmd.Parameters.Add(p);
            }
            AddParam("hid",           Guid.NewGuid());
            AddParam("tenant_id",     instance.TenantId);
            AddParam("instance_id",   instanceId);
            AddParam("from_state_id",   fromState.Id);
            AddParam("to_state_id",     toState.Id);
            AddParam("from_state_code", fromState.StateCode);
            AddParam("to_state_code",   toState.StateCode);
            AddParam("trigger_event",   triggerEvent);
            AddParam("actor_user_id", actorUserId);
            AddParam("notes",         (object?)notes);
            await insCmd.ExecuteNonQueryAsync(ct);
        }

        await tx.CommitAsync(ct);

        _log.LogInformation("Workflow {Id}: {From} → {To} via {Event}",
            instanceId, fromState.StateCode, toState.StateCode, triggerEvent);

        return new TransitionResult(true, fromState.StateCode, toState.StateCode, triggerEvent);
    }

    public async Task<string> GetCurrentStateCodeAsync(Guid instanceId, CancellationToken ct = default)
    {
        var instance = await _db.WorkflowInstances
            .AsNoTracking()
            .FirstOrDefaultAsync(i => i.Id == instanceId && i.DeletedAt == null, ct)
            ?? throw new KeyNotFoundException($"Instance {instanceId} not found.");

        var state = await _db.WorkflowStates
            .AsNoTracking()
            .FirstOrDefaultAsync(s => s.Id == instance.CurrentStateId, ct)
            ?? throw new InvalidOperationException("Current state not found.");

        return state.StateCode;
    }

    public async Task<List<CcmsWorkflowTransition>> GetAvailableTransitionsAsync(
        Guid instanceId, CancellationToken ct = default)
    {
        var instance = await _db.WorkflowInstances
            .AsNoTracking()
            .FirstOrDefaultAsync(i => i.Id == instanceId && i.DeletedAt == null, ct)
            ?? throw new KeyNotFoundException($"Instance {instanceId} not found.");

        return await _db.WorkflowTransitions
            .AsNoTracking()
            .Where(t =>
                t.WorkflowDefinitionId == instance.WorkflowDefinitionId &&
                t.FromStateId          == instance.CurrentStateId &&
                t.DeletedAt            == null)
            .ToListAsync(ct);
    }

    public async Task<List<CcmsWorkflowHistory>> GetHistoryAsync(
        Guid instanceId, CancellationToken ct = default)
    {
        return await _db.WorkflowHistories
            .AsNoTracking()
            .Where(h => h.WorkflowInstanceId == instanceId && h.DeletedAt == null)
            .OrderBy(h => h.TransitionedAt)
            .ToListAsync(ct);
    }

    public async Task<Dictionary<Guid, string>> ResolveStateCodesAsync(
        List<Guid> stateIds, CancellationToken ct = default)
    {
        if (stateIds.Count == 0) return new Dictionary<Guid, string>();

        var result = new Dictionary<Guid, string>();
        var conn = _db.Database.GetDbConnection();
        if (conn.State != System.Data.ConnectionState.Open)
            await conn.OpenAsync(ct);

        await using var tx = await conn.BeginTransactionAsync(ct);
        try
        {
            using (var setCmd = conn.CreateCommand())
            {
                setCmd.Transaction = tx;
                setCmd.CommandText = "SET LOCAL app.current_tenant_id = '00000000-0000-0000-0000-000000000000'";
                await setCmd.ExecuteNonQueryAsync(ct);
            }

            using var qCmd = conn.CreateCommand();
            qCmd.Transaction = tx;
            qCmd.CommandText = "SELECT id, state_code FROM ccms_workflow_states WHERE id = ANY(@ids) AND deleted_at IS NULL";
            var p = new NpgsqlParameter("ids", NpgsqlDbType.Array | NpgsqlDbType.Uuid) { Value = stateIds.ToArray() };
            qCmd.Parameters.Add(p);

            await using var reader = await qCmd.ExecuteReaderAsync(ct);
            while (await reader.ReadAsync(ct))
                result[reader.GetGuid(0)] = reader.GetString(1);
        }
        finally
        {
            await tx.RollbackAsync(ct);
        }

        if (result.Count == 0)
        {
            var efResult = await _db.WorkflowStates
                .AsNoTracking()
                .Where(s => stateIds.Contains(s.Id))
                .ToDictionaryAsync(s => s.Id, s => s.StateCode, ct);
            foreach (var kv in efResult) result[kv.Key] = kv.Value;
        }

        return result;
    }
}
