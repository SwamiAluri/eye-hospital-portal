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
}

public class IntegrationOutboxService : IIntegrationOutboxService
{
    private readonly IpManagementDbContext _db;
    private readonly ICcmsAdmissionClient _ccms;
    private readonly ILogger<IntegrationOutboxService> _log;
    private const int MaxRetries = 8;

    private static readonly JsonSerializerOptions JsonOpts = new()
    {
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
    };

    public IntegrationOutboxService(
        IpManagementDbContext db,
        ICcmsAdmissionClient ccms,
        ILogger<IntegrationOutboxService> log)
    {
        _db = db;
        _ccms = ccms;
        _log = log;
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
            ?? $"{eventType}:{aggregateId:N}:{now:yyyyMMddHHmmss}";

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

        var conn = _db.Database.GetDbConnection();
        if (conn.State != System.Data.ConnectionState.Open)
            await conn.OpenAsync(ct);

        await using var cmd = conn.CreateCommand();
        cmd.CommandText =
            """
            CREATE TABLE IF NOT EXISTS integration_outbox_event (
                id               UUID PRIMARY KEY,
                tenant_id        UUID NOT NULL,
                event_type       VARCHAR(80) NOT NULL,
                aggregate_type   VARCHAR(80) NOT NULL,
                aggregate_id     UUID NOT NULL,
                correlation_id   UUID NULL,
                payload_json     TEXT NOT NULL,
                idempotency_key  VARCHAR(200) NOT NULL,
                occurred_at      TIMESTAMPTZ NOT NULL,
                status           VARCHAR(20) NOT NULL,
                retry_count      INT NOT NULL DEFAULT 0,
                last_attempt_at  TIMESTAMPTZ NULL,
                processed_at     TIMESTAMPTZ NULL,
                error            TEXT NULL,
                created_at       TIMESTAMPTZ NOT NULL,
                updated_at       TIMESTAMPTZ NOT NULL
            );
            CREATE UNIQUE INDEX IF NOT EXISTS ux_integration_outbox_idempotency
                ON integration_outbox_event (idempotency_key);
            CREATE INDEX IF NOT EXISTS ix_integration_outbox_pending
                ON integration_outbox_event (status, occurred_at)
                WHERE status IN ('Pending', 'Failed');
            """;
        await cmd.ExecuteNonQueryAsync(ct);
    }

    public async Task<int> ProcessPendingAsync(int batchSize = 25, CancellationToken ct = default)
    {
        await EnsureSchemaAsync(ct);

        var batch = await _db.IntegrationOutboxEvents
            .Where(e => e.Status == OutboxStatuses.Pending || e.Status == OutboxStatuses.Failed)
            .OrderBy(e => e.OccurredAt)
            .Take(batchSize)
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
                await _ccms.DeliverOutboxEventAsync(evt.EventType, evt.PayloadJson, evt.IdempotencyKey);
                evt.Status = OutboxStatuses.Processed;
                evt.ProcessedAt = DateTime.UtcNow;
                evt.Error = null;
                processed++;
            }
            catch (Exception ex)
            {
                evt.RetryCount += 1;
                evt.Error = ex.Message.Length > 2000 ? ex.Message[..2000] : ex.Message;
                evt.Status = evt.RetryCount >= MaxRetries ? OutboxStatuses.Dead : OutboxStatuses.Failed;
                _log.LogWarning(ex,
                    "Outbox delivery failed for {EventType} {EventId} retry={Retry} status={Status}",
                    evt.EventType, evt.Id, evt.RetryCount, evt.Status);
            }

            evt.UpdatedAt = DateTime.UtcNow;
            await _db.SaveChangesAsync(ct);
        }

        return processed;
    }
}
