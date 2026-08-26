using System.Text.Json;
using AuthService.Context;
using AuthService.Models.Domain;
using Microsoft.EntityFrameworkCore;

namespace AuthService.Services;

public interface IBillingCcmsOutboxService
{
    void Enqueue(
        Guid tenantId,
        string eventType,
        Guid billId,
        object payload,
        string idempotencyKey);

    Task EnsureSchemaAsync(CancellationToken ct = default);

    Task<int> ProcessPendingAsync(int batchSize = 25, CancellationToken ct = default);

    Task<BillingOutboxStats> GetStatsAsync(Guid tenantId, CancellationToken ct = default)
        => Task.FromResult(new BillingOutboxStats(0, 0, 0, 0, 0, 0, null, Array.Empty<BillingOutboxTypeStats>()));

    Task<IReadOnlyList<BillingOutboxDeadLetterDto>> ListDeadAsync(Guid tenantId, CancellationToken ct = default)
        => Task.FromResult<IReadOnlyList<BillingOutboxDeadLetterDto>>(Array.Empty<BillingOutboxDeadLetterDto>());

    Task<BillingOutboxEventDetailDto> GetEventAsync(Guid tenantId, Guid eventId, CancellationToken ct = default)
        => Task.FromException<BillingOutboxEventDetailDto>(new KeyNotFoundException("Outbox event not found."));

    Task<int> RequeueAsync(Guid tenantId, BillingOutboxRequeueRequest request, CancellationToken ct = default)
        => Task.FromException<int>(new NotSupportedException());

    Task AbandonAsync(Guid tenantId, Guid userId, BillingOutboxAbandonRequest request, CancellationToken ct = default)
        => Task.FromException(new NotSupportedException());
}

public sealed class BillingCcmsOutboxService : IBillingCcmsOutboxService
{
    private readonly AppDbContext _db;
    private readonly ICcmsBillFinalizedClient _ccms;
    private readonly ILogger<BillingCcmsOutboxService> _log;
    private const int MaxRetries = 8;

    private static readonly JsonSerializerOptions JsonOpts = new()
    {
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
    };

    public BillingCcmsOutboxService(
        AppDbContext db,
        ICcmsBillFinalizedClient ccms,
        ILogger<BillingCcmsOutboxService> log)
    {
        _db = db;
        _ccms = ccms;
        _log = log;
    }

    public void Enqueue(
        Guid tenantId,
        string eventType,
        Guid billId,
        object payload,
        string idempotencyKey)
    {
        var now = DateTime.UtcNow;
        var exists = _db.BillingCcmsOutboxEvents.Local
            .Any(e => e.IdempotencyKey == idempotencyKey
                      && e.Status != BillingOutboxStatuses.Dead);
        if (!exists)
        {
            exists = _db.BillingCcmsOutboxEvents
                .Any(e => e.IdempotencyKey == idempotencyKey
                          && (e.Status == BillingOutboxStatuses.Pending
                              || e.Status == BillingOutboxStatuses.Processed
                              || e.Status == BillingOutboxStatuses.Processing));
        }

        if (exists)
        {
            _log.LogInformation("Billing CCMS outbox skip duplicate {Key}", idempotencyKey);
            return;
        }

        _db.BillingCcmsOutboxEvents.Add(new BillingCcmsOutboxEvent
        {
            Id             = Guid.NewGuid(),
            TenantId       = tenantId,
            EventType      = eventType,
            AggregateType  = "OpdBill",
            AggregateId    = billId,
            CorrelationId  = billId,
            PayloadJson    = JsonSerializer.Serialize(payload, JsonOpts),
            IdempotencyKey = idempotencyKey,
            OccurredAt     = now,
            Status         = BillingOutboxStatuses.Pending,
            CreatedAt      = now,
            UpdatedAt      = now,
        });
    }

    public async Task EnsureSchemaAsync(CancellationToken ct = default)
    {
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
                  AND table_name = 'billing_ccms_outbox'
            )
            """;
        try
        {
            var exists = await cmd.ExecuteScalarAsync(ct);
            if (!Equals(exists, true))
            {
                _log.LogError(
                    "billing_ccms_outbox is missing. Apply consolidated/migrations/164_outbox_versioned_schema.sql. Runtime DDL is disabled (DB-005).");
            }
        }
        catch (Exception ex)
        {
            _log.LogWarning(ex, "Could not verify billing_ccms_outbox (DB-005). Apply migration 164.");
        }
    }

    public async Task<int> ProcessPendingAsync(int batchSize = 25, CancellationToken ct = default)
    {
        await EnsureSchemaAsync(ct);

        var batch = await _db.BillingCcmsOutboxEvents
            .Where(e => e.Status == BillingOutboxStatuses.Pending || e.Status == BillingOutboxStatuses.Failed)
            .OrderBy(e => e.OccurredAt)
            .Take(batchSize)
            .ToListAsync(ct);

        var processed = 0;
        foreach (var evt in batch)
        {
            evt.Status = BillingOutboxStatuses.Processing;
            evt.LastAttemptAt = DateTime.UtcNow;
            evt.UpdatedAt = DateTime.UtcNow;
            await _db.SaveChangesAsync(ct);

            try
            {
                await _ccms.DeliverOutboxEventAsync(evt.EventType, evt.PayloadJson, evt.IdempotencyKey, ct);
                evt.Status = BillingOutboxStatuses.Processed;
                evt.ProcessedAt = DateTime.UtcNow;
                evt.Error = null;
                processed++;
            }
            catch (Exception ex)
            {
                evt.RetryCount += 1;
                evt.Error = ex.Message.Length > 2000 ? ex.Message[..2000] : ex.Message;
                evt.Status = evt.RetryCount >= MaxRetries ? BillingOutboxStatuses.Dead : BillingOutboxStatuses.Failed;
                _log.LogWarning(ex,
                    "Billing CCMS outbox failed {EventType} {EventId} retry={Retry} status={Status}",
                    evt.EventType, evt.Id, evt.RetryCount, evt.Status);
            }

            evt.UpdatedAt = DateTime.UtcNow;
            await _db.SaveChangesAsync(ct);
        }

        return processed;
    }

    public async Task<BillingOutboxStats> GetStatsAsync(Guid tenantId, CancellationToken ct = default)
    {
        await EnsureSchemaAsync(ct);
        var q = _db.BillingCcmsOutboxEvents.Where(e => e.TenantId == tenantId);

        var snapshot = await q
            .Select(e => new { e.Status, e.EventType, e.OccurredAt })
            .ToListAsync(ct);

        int Count(string status) => snapshot.Count(r => r.Status == status);
        var since = DateTime.UtcNow.AddHours(-24);
        var published24h = snapshot.Count(e => e.OccurredAt >= since);
        var pendingTimes = snapshot
            .Where(e => e.Status == BillingOutboxStatuses.Pending || e.Status == BillingOutboxStatuses.Failed)
            .Select(e => e.OccurredAt)
            .ToList();
        DateTime? oldestPendingAt = pendingTimes.Count == 0 ? null : pendingTimes.Min();

        var byType = snapshot
            .Where(e => e.Status is BillingOutboxStatuses.Pending
                or BillingOutboxStatuses.Failed
                or BillingOutboxStatuses.Processing
                or BillingOutboxStatuses.Dead)
            .GroupBy(e => e.EventType)
            .Select(g => new BillingOutboxTypeStats(
                g.Key,
                g.Count(x => x.Status == BillingOutboxStatuses.Pending),
                g.Count(x => x.Status is BillingOutboxStatuses.Failed or BillingOutboxStatuses.Processing),
                g.Count(x => x.Status == BillingOutboxStatuses.Dead)))
            .OrderByDescending(r => r.Dead)
            .ThenByDescending(r => r.Retrying)
            .ThenBy(r => r.EventType)
            .ToList();

        return new BillingOutboxStats(
            Count(BillingOutboxStatuses.Pending),
            Count(BillingOutboxStatuses.Failed),
            Count(BillingOutboxStatuses.Dead),
            Count(BillingOutboxStatuses.Processed),
            Count(BillingOutboxStatuses.Processing),
            published24h,
            oldestPendingAt,
            byType);
    }

    public async Task<IReadOnlyList<BillingOutboxDeadLetterDto>> ListDeadAsync(Guid tenantId, CancellationToken ct = default)
    {
        await EnsureSchemaAsync(ct);
        var rows = await _db.BillingCcmsOutboxEvents
            .Where(e => e.TenantId == tenantId && e.Status == BillingOutboxStatuses.Dead)
            .OrderByDescending(e => e.LastAttemptAt ?? e.UpdatedAt)
            .ToListAsync(ct);
        return rows.Select(ToDeadLetter).ToList();
    }

    public async Task<BillingOutboxEventDetailDto> GetEventAsync(Guid tenantId, Guid eventId, CancellationToken ct = default)
    {
        await EnsureSchemaAsync(ct);
        var evt = await RequireEventAsync(tenantId, eventId, ct);
        return new BillingOutboxEventDetailDto(
            evt.Id,
            BillingOutboxHealthSupport.SourceBilling,
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
            BillingOutboxHealthSupport.SubjectFromPayload(evt.PayloadJson, evt.AggregateId),
            MappingRequired: false,
            BillingOutboxHealthSupport.IsFinancial(evt.EventType),
            BillingOutboxHealthSupport.MaskPayload(evt.PayloadJson),
            evt.AbandonReason,
            evt.CompensatingAction);
    }

    public async Task<int> RequeueAsync(Guid tenantId, BillingOutboxRequeueRequest request, CancellationToken ct = default)
    {
        await EnsureSchemaAsync(ct);
        var ids = request.EventIds?.Where(id => id != Guid.Empty).Distinct().ToList() ?? [];
        IQueryable<BillingCcmsOutboxEvent> q = _db.BillingCcmsOutboxEvents
            .Where(e => e.TenantId == tenantId);

        if (ids.Count > 0)
            q = q.Where(e => ids.Contains(e.Id));
        else if (!string.IsNullOrWhiteSpace(request.EventType))
            q = q.Where(e => e.EventType == request.EventType && e.Status == BillingOutboxStatuses.Dead);
        else
            throw new ArgumentException("Provide eventIds or eventType to requeue.");

        var rows = await q.ToListAsync(ct);
        if (rows.Count == 0)
            throw new KeyNotFoundException("Outbox event not found.");

        var now = DateTime.UtcNow;
        foreach (var evt in rows)
        {
            if (evt.Status == BillingOutboxStatuses.Abandoned)
                throw new InvalidOperationException("Abandoned events cannot be requeued.");
            if (evt.Status is not (BillingOutboxStatuses.Dead or BillingOutboxStatuses.Failed))
                throw new InvalidOperationException("Only Dead or Failed events can be requeued.");

            evt.Status = BillingOutboxStatuses.Pending;
            evt.RetryCount = 0;
            evt.LastAttemptAt = null;
            evt.ProcessedAt = null;
            evt.UpdatedAt = now;
        }

        await _db.SaveChangesAsync(ct);
        _log.LogInformation("Billing outbox requeued {Count} event(s) tenant={TenantId}", rows.Count, tenantId);
        return rows.Count;
    }

    public async Task AbandonAsync(Guid tenantId, Guid userId, BillingOutboxAbandonRequest request, CancellationToken ct = default)
    {
        if (string.IsNullOrWhiteSpace(request.Reason))
            throw new ArgumentException("Reason is required to abandon an outbox event.");

        await EnsureSchemaAsync(ct);
        var evt = await RequireEventAsync(tenantId, request.EventId, ct);
        if (evt.Status is not (BillingOutboxStatuses.Dead or BillingOutboxStatuses.Failed))
            throw new InvalidOperationException("Only Dead or Failed events can be abandoned.");
        if (BillingOutboxHealthSupport.IsFinancial(evt.EventType)
            && string.IsNullOrWhiteSpace(request.CompensatingAction))
            throw new ArgumentException("Financial events require a compensating action before abandon.");

        evt.Status = BillingOutboxStatuses.Abandoned;
        evt.AbandonReason = request.Reason.Trim();
        evt.CompensatingAction = string.IsNullOrWhiteSpace(request.CompensatingAction)
            ? null
            : request.CompensatingAction.Trim();
        evt.AbandonedAt = DateTime.UtcNow;
        evt.AbandonedByUserId = userId;
        evt.UpdatedAt = DateTime.UtcNow;
        await _db.SaveChangesAsync(ct);
        _log.LogWarning(
            "Billing outbox abandoned {EventType} {EventId} by {UserId} reason={Reason}",
            evt.EventType, evt.Id, userId, evt.AbandonReason);
    }

    private async Task<BillingCcmsOutboxEvent> RequireEventAsync(Guid tenantId, Guid eventId, CancellationToken ct)
    {
        var evt = await _db.BillingCcmsOutboxEvents
            .FirstOrDefaultAsync(e => e.Id == eventId && e.TenantId == tenantId, ct);
        return evt ?? throw new KeyNotFoundException("Outbox event not found.");
    }

    private static BillingOutboxDeadLetterDto ToDeadLetter(BillingCcmsOutboxEvent evt) => new(
        evt.Id,
        BillingOutboxHealthSupport.SourceBilling,
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
        BillingOutboxHealthSupport.SubjectFromPayload(evt.PayloadJson, evt.AggregateId),
        MappingRequired: false,
        BillingOutboxHealthSupport.IsFinancial(evt.EventType));
}
