using System.Text.Json;
using IpManagementService.Data;
using IpManagementService.Models.Domain;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;

namespace IpManagementService.Services;

public interface IIntegrationOutboxService
{
    /// <summary>
    /// Enqueue a lifecycle event. Caller must SaveChanges (ideally in the same transaction
    /// as the originating domain change).
    /// </summary>
    void Enqueue(
        Guid tenantId,
        string eventType,
        Guid aggregateId,
        object payload,
        Guid? correlationId = null,
        string? idempotencyKey = null);

    Task EnsureSchemaAsync(CancellationToken ct = default);

    Task<int> ProcessPendingAsync(int batchSize = 25, CancellationToken ct = default);

    Task<OutboxStats> GetStatsAsync(Guid? tenantId = null, CancellationToken ct = default);

    Task<IReadOnlyList<OutboxDeadLetterDto>> ListDeadAsync(Guid tenantId, CancellationToken ct = default);

    Task<OutboxEventDetailDto> GetEventAsync(Guid tenantId, Guid eventId, CancellationToken ct = default);

    Task<int> RequeueAsync(Guid tenantId, OutboxRequeueRequest request, CancellationToken ct = default);

    Task AbandonAsync(Guid tenantId, Guid userId, OutboxAbandonRequest request, CancellationToken ct = default);
}

public class IntegrationOutboxService : IIntegrationOutboxService
{
    private readonly IpManagementDbContext _db;
    private readonly ICcmsAdmissionClient _ccms;
    private readonly IImplantChargeHandler? _implantCharges;
    private readonly IConsumableChargeHandler? _consumableCharges;
    private readonly IHl7AdtPublisher? _hl7;
    private readonly IPacsWorklistPublisher? _pacs;
    private readonly ILogger<IntegrationOutboxService> _log;
    private const int MaxRetries = 8;
    /// <summary>Auth ChargePostingCodes.BillNotFound. OT charges wait for ensure-bill; they must not dead-letter.</summary>
    internal const string BillNotFoundCode = "BILL_NOT_FOUND";
    /// <summary>Inventory HTTP/outage. ImplantUsed must wait like BILL_NOT_FOUND — never permanently Dead.</summary>
    internal const string InventoryUnavailableCode = "INVENTORY_UNAVAILABLE";

    private static readonly JsonSerializerOptions JsonOpts = new()
    {
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
    };

    public IntegrationOutboxService(
        IpManagementDbContext db,
        ICcmsAdmissionClient ccms,
        ILogger<IntegrationOutboxService> log,
        IImplantChargeHandler? implantCharges = null,
        IConsumableChargeHandler? consumableCharges = null,
        IHl7AdtPublisher? hl7 = null,
        IPacsWorklistPublisher? pacs = null)
    {
        _db = db;
        _ccms = ccms;
        _log = log;
        _implantCharges = implantCharges;
        _consumableCharges = consumableCharges;
        _hl7 = hl7;
        _pacs = pacs;
    }

    public void Enqueue(
        Guid tenantId,
        string eventType,
        Guid aggregateId,
        object payload,
        Guid? correlationId = null,
        string? idempotencyKey = null)
    {
        var now = DateTime.UtcNow;
        var key = idempotencyKey
            ?? $"{eventType}:{aggregateId:N}";

        // Deduplicate identical pending keys within the same unit of work / short window.
        var exists = _db.IntegrationOutboxEvents.Local
            .Any(e => e.IdempotencyKey == key && e.Status == OutboxStatuses.Pending);
        if (!exists)
        {
            exists = _db.IntegrationOutboxEvents
                .Any(e => e.IdempotencyKey == key
                          && (e.Status == OutboxStatuses.Pending
                              || e.Status == OutboxStatuses.Processed
                              || e.Status == OutboxStatuses.Processing));
        }

        if (exists)
        {
            _log.LogInformation("Outbox skip duplicate idempotency key {Key}", key);
            return;
        }

        _db.IntegrationOutboxEvents.Add(new IntegrationOutboxEvent
        {
            Id             = Guid.NewGuid(),
            TenantId       = tenantId,
            EventType      = eventType,
            AggregateType  = "PatientJourney",
            AggregateId    = aggregateId,
            CorrelationId  = correlationId ?? aggregateId,
            PayloadJson    = JsonSerializer.Serialize(payload, JsonOpts),
            IdempotencyKey = key,
            OccurredAt     = now,
            Status         = OutboxStatuses.Pending,
            RetryCount     = 0,
            CreatedAt      = now,
            UpdatedAt      = now,
        });
    }

    public async Task EnsureSchemaAsync(CancellationToken ct = default)
    {
        // In-memory / non-relational providers used in unit tests skip DDL.
        if (!_db.Database.IsRelational())
            return;

        // DB-005: schema is owned by consolidated/migrations/164_outbox_versioned_schema.sql.
        // Runtime CREATE/ALTER is disabled. This call stays for one release as a logged no-op.
        var conn = _db.Database.GetDbConnection();
        if (conn.State != System.Data.ConnectionState.Open)
            await conn.OpenAsync(ct);

        await using var cmd = conn.CreateCommand();
        cmd.CommandText =
            """
            SELECT EXISTS (
                SELECT 1
                FROM information_schema.tables
                WHERE table_schema = 'public'
                  AND table_name = 'integration_outbox_event'
            )
            """;
        try
        {
            var exists = await cmd.ExecuteScalarAsync(ct);
            if (!Equals(exists, true))
            {
                _log.LogError(
                    "integration_outbox_event is missing. Apply consolidated/migrations/164_outbox_versioned_schema.sql. Runtime DDL is disabled (DB-005).");
            }
        }
        catch (Exception ex)
        {
            _log.LogWarning(ex, "Could not verify integration_outbox_event (DB-005). Apply migration 164.");
        }
    }

    public async Task<int> ProcessPendingAsync(int batchSize = 25, CancellationToken ct = default)
    {
        await EnsureSchemaAsync(ct);

        // Drain filter must stay SQL-translatable. Do not call CLR helpers such as
        // OutboxHealthSupport.IsConsumableCharge here — Npgsql cannot translate them.
        // Dispatch after materialization may use those helpers.
        var batch = await FilterDrainBatch(_db.IntegrationOutboxEvents, batchSize)
            .ToListAsync(ct);

        var processed = 0;
        foreach (var evt in batch)
        {
            evt.Status = OutboxStatuses.Processing;
            evt.LastAttemptAt = DateTime.UtcNow;
            evt.UpdatedAt = DateTime.UtcNow;
            await _db.SaveChangesAsync(ct);

            try
            {
                if (evt.EventType is IntegrationEventTypes.ImplantUsed
                    or IntegrationEventTypes.ImplantUsageReversed)
                {
                    if (_implantCharges is not null)
                        await _implantCharges.HandleAsync(evt, ct);
                }
                else if (OutboxHealthSupport.IsConsumableCharge(evt.EventType))
                {
                    if (_consumableCharges is not null)
                        await _consumableCharges.HandleAsync(evt, ct);
                }
                else
                {
                    await _ccms.DeliverOutboxEventAsync(evt.EventType, evt.PayloadJson, evt.IdempotencyKey);
                }

                if (_hl7 is not null)
                    await _hl7.PublishAsync(evt, ct);
                if (_pacs is not null)
                    await _pacs.PublishAsync(evt, ct);

                evt.Status = OutboxStatuses.Processed;
                evt.ProcessedAt = DateTime.UtcNow;
                evt.Error = null;
                processed++;
            }
            catch (Exception ex)
            {
                evt.RetryCount += 1;
                evt.Error = ex.Message.Length > 2000 ? ex.Message[..2000] : ex.Message;
                var waitingForBill = IsWaitingForInpatientBill(ex);
                var waitingForInventory = IsWaitingForInventory(ex);
                var waitingForDependency = waitingForBill || waitingForInventory;
                // BILL_NOT_FOUND / INVENTORY_UNAVAILABLE are not delivery poison.
                // Keep Failed so Hangfire's next minute can ChargeItems after the dependency recovers.
                evt.Status = !waitingForDependency && evt.RetryCount >= MaxRetries
                    ? OutboxStatuses.Dead
                    : OutboxStatuses.Failed;
                if (waitingForBill)
                {
                    _log.LogInformation(
                        "Outbox {EventType} {EventId} waiting for OpdBill retry={Retry}",
                        evt.EventType, evt.Id, evt.RetryCount);
                }
                else if (waitingForInventory)
                {
                    _log.LogInformation(
                        "Outbox {EventType} {EventId} waiting for inventory retry={Retry}",
                        evt.EventType, evt.Id, evt.RetryCount);
                }
                else
                {
                    _log.LogWarning(ex,
                        "Outbox delivery failed for {EventType} {EventId} retry={Retry} status={Status}",
                        evt.EventType, evt.Id, evt.RetryCount, evt.Status);
                }
            }

            evt.UpdatedAt = DateTime.UtcNow;
            await _db.SaveChangesAsync(ct);
        }

        return processed;
    }

    /// <summary>
    /// Production drain query. EventType checks must be string equality so EF/Npgsql can
    /// emit SQL. CLR helpers (IsConsumableCharge) belong only after ToListAsync.
    /// </summary>
    internal static IQueryable<IntegrationOutboxEvent> FilterDrainBatch(
        IQueryable<IntegrationOutboxEvent> source, int batchSize) =>
        source.Where(e =>
                e.Status == OutboxStatuses.Pending
                || e.Status == OutboxStatuses.Failed
                || (e.Status == OutboxStatuses.Dead
                    && (e.EventType == IntegrationEventTypes.ImplantUsed
                        || e.EventType == IntegrationEventTypes.ImplantUsageReversed
                        || e.EventType == IntegrationEventTypes.ConsumablesConsumed
                        || e.EventType == IntegrationEventTypes.ConsumablesReturned)
                    && e.Error != null
                    && (e.Error.Contains(BillNotFoundCode)
                        || e.Error.Contains(InventoryUnavailableCode)
                        || e.Error.Contains("BILL_FINALIZED")
                        || e.Error.Contains("BILL_LOCKED")
                        || e.Error.Contains("BILL_CANCELLED")
                        || e.Error.ToLower().Contains("bill not found")
                        || e.Error.ToLower().Contains("bill is finalized")
                        || e.Error.ToLower().Contains("bill is locked")
                        || e.Error.ToLower().Contains("bill is cancelled")
                        || e.Error.ToLower().Contains("inventory unavailable")
                        || e.Error.ToLower().Contains("implant stock apply failed"))))
            .OrderBy(e => e.OccurredAt)
            .Take(batchSize);

    private static bool IsWaitingForInpatientBill(Exception ex)
        => ex is AuthChargePostingException posted && posted.Code == BillNotFoundCode;

    private static bool IsWaitingForInventory(Exception ex)
        => ex is InventoryUnavailableException
           || ex.Message.Contains(InventoryUnavailableCode, StringComparison.Ordinal)
           || ex.Message.Contains("Inventory unavailable", StringComparison.OrdinalIgnoreCase)
           || ex.Message.Contains("Implant stock apply failed", StringComparison.OrdinalIgnoreCase);

    public async Task<OutboxStats> GetStatsAsync(Guid? tenantId = null, CancellationToken ct = default)
    {
        await EnsureSchemaAsync(ct);
        var q = _db.IntegrationOutboxEvents.AsQueryable();
        if (tenantId.HasValue)
            q = q.Where(e => e.TenantId == tenantId.Value);

        var snapshot = await q
            .Select(e => new { e.Status, e.EventType, e.OccurredAt })
            .ToListAsync(ct);

        int Count(string status) => snapshot.Count(r => r.Status == status);
        var since = DateTime.UtcNow.AddHours(-24);
        var published24h = snapshot.Count(e => e.OccurredAt >= since);
        var pendingTimes = snapshot
            .Where(e => e.Status == OutboxStatuses.Pending || e.Status == OutboxStatuses.Failed)
            .Select(e => e.OccurredAt)
            .ToList();
        DateTime? oldestPendingAt = pendingTimes.Count == 0 ? null : pendingTimes.Min();

        var byType = snapshot
            .Where(e => e.Status is OutboxStatuses.Pending
                or OutboxStatuses.Failed
                or OutboxStatuses.Processing
                or OutboxStatuses.Dead)
            .GroupBy(e => e.EventType)
            .Select(g => new OutboxTypeStats(
                g.Key,
                g.Count(x => x.Status == OutboxStatuses.Pending),
                g.Count(x => x.Status is OutboxStatuses.Failed or OutboxStatuses.Processing),
                g.Count(x => x.Status == OutboxStatuses.Dead)))
            .OrderByDescending(r => r.Dead)
            .ThenByDescending(r => r.Retrying)
            .ThenBy(r => r.EventType)
            .ToList();

        return new OutboxStats(
            Count(OutboxStatuses.Pending),
            Count(OutboxStatuses.Failed),
            Count(OutboxStatuses.Dead),
            Count(OutboxStatuses.Processed),
            Count(OutboxStatuses.Processing),
            published24h,
            oldestPendingAt,
            byType);
    }

    public async Task<IReadOnlyList<OutboxDeadLetterDto>> ListDeadAsync(Guid tenantId, CancellationToken ct = default)
    {
        await EnsureSchemaAsync(ct);
        var rows = await _db.IntegrationOutboxEvents
            .Where(e => e.TenantId == tenantId && e.Status == OutboxStatuses.Dead)
            .OrderByDescending(e => e.LastAttemptAt ?? e.UpdatedAt)
            .ToListAsync(ct);
        return rows.Select(ToDeadLetter).ToList();
    }

    public async Task<OutboxEventDetailDto> GetEventAsync(Guid tenantId, Guid eventId, CancellationToken ct = default)
    {
        await EnsureSchemaAsync(ct);
        var evt = await RequireEventAsync(tenantId, eventId, ct);
        return new OutboxEventDetailDto(
            evt.Id,
            OutboxHealthSupport.SourceIp,
            evt.EventType,
            evt.AggregateId,
            evt.AggregateType,
            evt.CorrelationId,
            evt.IdempotencyKey,
            evt.OccurredAt,
            evt.LastAttemptAt,
            evt.ProcessedAt,
            evt.RetryCount,
            evt.Error,
            evt.Status,
            OutboxHealthSupport.SubjectFromPayload(evt.PayloadJson, evt.AggregateId),
            OutboxHealthSupport.NeedsChargeMapping(evt.EventType, evt.Error),
            OutboxHealthSupport.IsFinancial(evt.EventType),
            OutboxHealthSupport.MaskPayload(evt.PayloadJson),
            evt.AbandonReason,
            evt.CompensatingAction);
    }

    public async Task<int> RequeueAsync(Guid tenantId, OutboxRequeueRequest request, CancellationToken ct = default)
    {
        await EnsureSchemaAsync(ct);
        var ids = request.EventIds?.Where(id => id != Guid.Empty).Distinct().ToList() ?? [];
        IQueryable<IntegrationOutboxEvent> q = _db.IntegrationOutboxEvents
            .Where(e => e.TenantId == tenantId);

        if (ids.Count > 0)
            q = q.Where(e => ids.Contains(e.Id));
        else if (!string.IsNullOrWhiteSpace(request.EventType))
            q = q.Where(e => e.EventType == request.EventType && e.Status == OutboxStatuses.Dead);
        else
            throw new ArgumentException("Provide eventIds or eventType to requeue.");

        var rows = await q.ToListAsync(ct);
        if (rows.Count == 0)
            throw new KeyNotFoundException("Outbox event not found.");

        var now = DateTime.UtcNow;
        foreach (var evt in rows)
        {
            if (evt.Status == OutboxStatuses.Abandoned)
                throw new InvalidOperationException("Abandoned events cannot be requeued.");
            if (evt.Status is not (OutboxStatuses.Dead or OutboxStatuses.Failed))
                throw new InvalidOperationException("Only Dead or Failed events can be requeued.");

            evt.Status = OutboxStatuses.Pending;
            evt.RetryCount = 0;
            evt.LastAttemptAt = null;
            evt.ProcessedAt = null;
            evt.UpdatedAt = now;
        }

        await _db.SaveChangesAsync(ct);
        _log.LogInformation("Outbox requeued {Count} event(s) tenant={TenantId}", rows.Count, tenantId);
        return rows.Count;
    }

    public async Task AbandonAsync(Guid tenantId, Guid userId, OutboxAbandonRequest request, CancellationToken ct = default)
    {
        if (string.IsNullOrWhiteSpace(request.Reason))
            throw new ArgumentException("Reason is required to abandon an outbox event.");

        await EnsureSchemaAsync(ct);
        var evt = await RequireEventAsync(tenantId, request.EventId, ct);
        if (evt.Status is not (OutboxStatuses.Dead or OutboxStatuses.Failed))
            throw new InvalidOperationException("Only Dead or Failed events can be abandoned.");
        if (OutboxHealthSupport.IsFinancial(evt.EventType)
            && string.IsNullOrWhiteSpace(request.CompensatingAction))
            throw new ArgumentException("Financial events require a compensating action before abandon.");

        evt.Status = OutboxStatuses.Abandoned;
        evt.AbandonReason = request.Reason.Trim();
        evt.CompensatingAction = string.IsNullOrWhiteSpace(request.CompensatingAction)
            ? null
            : request.CompensatingAction.Trim();
        evt.AbandonedAt = DateTime.UtcNow;
        evt.AbandonedByUserId = userId;
        evt.UpdatedAt = DateTime.UtcNow;
        await _db.SaveChangesAsync(ct);
        _log.LogWarning(
            "Outbox abandoned {EventType} {EventId} by {UserId} reason={Reason}",
            evt.EventType, evt.Id, userId, evt.AbandonReason);
    }

    private async Task<IntegrationOutboxEvent> RequireEventAsync(Guid tenantId, Guid eventId, CancellationToken ct)
    {
        var evt = await _db.IntegrationOutboxEvents
            .FirstOrDefaultAsync(e => e.Id == eventId && e.TenantId == tenantId, ct);
        return evt ?? throw new KeyNotFoundException("Outbox event not found.");
    }

    private static OutboxDeadLetterDto ToDeadLetter(IntegrationOutboxEvent evt) => new(
        evt.Id,
        OutboxHealthSupport.SourceIp,
        evt.EventType,
        evt.AggregateId,
        evt.AggregateType,
        evt.CorrelationId,
        evt.IdempotencyKey,
        evt.OccurredAt,
        evt.LastAttemptAt,
        evt.RetryCount,
        evt.Error,
        evt.Status,
        OutboxHealthSupport.SubjectFromPayload(evt.PayloadJson, evt.AggregateId),
        OutboxHealthSupport.NeedsChargeMapping(evt.EventType, evt.Error),
        OutboxHealthSupport.IsFinancial(evt.EventType));
}
