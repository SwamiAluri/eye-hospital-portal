using IpManagementService.Data;
using IpManagementService.Models.Domain;
using IpManagementService.Services;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging.Abstractions;
using Xunit;

namespace IpManagementService.Tests;

public class IntegrationOutboxServiceTests : IDisposable
{
    private readonly ServiceProvider _provider;
    private readonly IpManagementDbContext _db;
    private readonly RecordingCcmsClient _ccms;
    private readonly IntegrationOutboxService _outbox;

    public IntegrationOutboxServiceTests()
    {
        var services = new ServiceCollection();
        services.AddDbContext<IpManagementDbContext>(o =>
            o.UseInMemoryDatabase(Guid.NewGuid().ToString("N")));
        _provider = services.BuildServiceProvider();
        _db = _provider.GetRequiredService<IpManagementDbContext>();
        _ccms = new RecordingCcmsClient();
        _outbox = new IntegrationOutboxService(_db, _ccms, NullLogger<IntegrationOutboxService>.Instance);
    }

    [Fact]
    public async Task ProcessPending_SuccessfulDelivery_MarksProcessed()
    {
        var journeyId = Guid.NewGuid();
        _outbox.Enqueue(
            Guid.NewGuid(),
            IntegrationEventTypes.SurgeryCompleted,
            journeyId,
            LifecycleEventPayload.Build(Guid.NewGuid(), journeyId, null, null, Guid.NewGuid()),
            idempotencyKey: $"SurgeryCompleted:{journeyId:N}");
        await _db.SaveChangesAsync();

        var n = await _outbox.ProcessPendingAsync();
        Assert.Equal(1, n);
        Assert.Equal(OutboxStatuses.Processed, (await _db.IntegrationOutboxEvents.SingleAsync()).Status);
        Assert.Single(_ccms.Deliveries);
    }

    [Fact]
    public async Task DuplicateDefaultIdempotencyKey_IsSkipped()
    {
        var journeyId = Guid.NewGuid();
        _outbox.Enqueue(Guid.NewGuid(), IntegrationEventTypes.JourneyAdmitted, journeyId, new { journeyId });
        _outbox.Enqueue(Guid.NewGuid(), IntegrationEventTypes.JourneyAdmitted, journeyId, new { journeyId });
        await _db.SaveChangesAsync();
        Assert.Equal(1, await _db.IntegrationOutboxEvents.CountAsync());
        Assert.Equal($"JourneyAdmitted:{journeyId:N}", (await _db.IntegrationOutboxEvents.SingleAsync()).IdempotencyKey);
    }

    [Fact]
    public async Task DuplicateIdempotencyKey_IsSkipped()
    {
        var journeyId = Guid.NewGuid();
        var key = $"JourneyAdmitted:{journeyId:N}";
        _outbox.Enqueue(Guid.NewGuid(), IntegrationEventTypes.JourneyAdmitted, journeyId, new { journeyId }, idempotencyKey: key);
        _outbox.Enqueue(Guid.NewGuid(), IntegrationEventTypes.JourneyAdmitted, journeyId, new { journeyId }, idempotencyKey: key);
        await _db.SaveChangesAsync();
        Assert.Equal(1, await _db.IntegrationOutboxEvents.CountAsync());
    }

    [Fact]
    public async Task JourneyReadyForOt_SameReadyAtTicks_IsOneRow()
    {
        var journeyId = Guid.NewGuid();
        var readyAt = DateTime.UtcNow;
        var key = $"{IntegrationEventTypes.JourneyReadyForOt}:{journeyId:N}:{readyAt.Ticks}";
        var payload = LifecycleEventPayload.Build(
            Guid.NewGuid(), journeyId, null, null, Guid.NewGuid(),
            extra: new { slotId = (Guid?)null, readyAt });

        _outbox.Enqueue(Guid.NewGuid(), IntegrationEventTypes.JourneyReadyForOt, journeyId, payload, idempotencyKey: key);
        _outbox.Enqueue(Guid.NewGuid(), IntegrationEventTypes.JourneyReadyForOt, journeyId, payload, idempotencyKey: key);
        await _db.SaveChangesAsync();

        var evt = Assert.Single(_db.IntegrationOutboxEvents);
        Assert.Equal(IntegrationEventTypes.JourneyReadyForOt, evt.EventType);
        Assert.Equal(key, evt.IdempotencyKey);
    }

    [Fact]
    public async Task ProcessPending_JourneyReadyForOt_MarksProcessed()
    {
        var journeyId = Guid.NewGuid();
        var readyAt = DateTime.UtcNow;
        _outbox.Enqueue(
            Guid.NewGuid(),
            IntegrationEventTypes.JourneyReadyForOt,
            journeyId,
            LifecycleEventPayload.Build(Guid.NewGuid(), journeyId, null, null, Guid.NewGuid(), extra: new { readyAt }),
            idempotencyKey: $"{IntegrationEventTypes.JourneyReadyForOt}:{journeyId:N}:{readyAt.Ticks}");
        await _db.SaveChangesAsync();

        var n = await _outbox.ProcessPendingAsync();
        Assert.Equal(1, n);
        Assert.Equal(OutboxStatuses.Processed, (await _db.IntegrationOutboxEvents.SingleAsync()).Status);
        Assert.Single(_ccms.Deliveries);
        Assert.Equal(IntegrationEventTypes.JourneyReadyForOt, _ccms.Deliveries[0].EventType);
    }

    [Fact]
    public async Task ProcessPending_Retry_ThenDead_OnPermanentFailure()
    {
        _ccms.FailDeliveries = true;
        var journeyId = Guid.NewGuid();
        _outbox.Enqueue(
            Guid.NewGuid(),
            IntegrationEventTypes.BillFinalized,
            journeyId,
            LifecycleEventPayload.Build(Guid.NewGuid(), journeyId, null, null, Guid.NewGuid()),
            idempotencyKey: $"BillFinalized:{journeyId:N}");
        await _db.SaveChangesAsync();

        for (var i = 0; i < 8; i++)
            await _outbox.ProcessPendingAsync();

        var evt = await _db.IntegrationOutboxEvents.SingleAsync();
        Assert.Equal(OutboxStatuses.Dead, evt.Status);
        Assert.Equal(8, evt.RetryCount);
        Assert.False(string.IsNullOrWhiteSpace(evt.Error));
    }

    [Fact]
    public async Task ProcessPending_ImplantUsed_DoesNotDeliverToCcms()
    {
        var journeyId = Guid.NewGuid();
        var usageId = Guid.NewGuid();
        _outbox.Enqueue(
            Guid.NewGuid(),
            IntegrationEventTypes.ImplantUsed,
            journeyId,
            new { usageStatus = "Implanted", implantUsageId = usageId, journeyId },
            idempotencyKey: $"{IntegrationEventTypes.ImplantUsed}:{usageId:N}");
        await _db.SaveChangesAsync();

        var n = await _outbox.ProcessPendingAsync();
        Assert.Equal(1, n);
        Assert.Equal(OutboxStatuses.Processed, (await _db.IntegrationOutboxEvents.SingleAsync()).Status);
        Assert.Empty(_ccms.Deliveries);
    }

    [Fact]
    public void FilterDrainBatch_IsTranslatableByNpgsql()
    {
        var options = new DbContextOptionsBuilder<IpManagementDbContext>()
            .UseNpgsql("Host=127.0.0.1;Database=unused;Username=unused")
            .Options;
        using var db = new IpManagementDbContext(options);

        var sql = IntegrationOutboxService.FilterDrainBatch(db.IntegrationOutboxEvents, 25)
            .ToQueryString();

        Assert.Contains(IntegrationEventTypes.ConsumablesConsumed, sql, StringComparison.Ordinal);
        Assert.Contains(IntegrationEventTypes.ConsumablesReturned, sql, StringComparison.Ordinal);
        Assert.Contains(IntegrationEventTypes.ImplantUsed, sql, StringComparison.Ordinal);
        Assert.Contains("inventory unavailable", sql, StringComparison.Ordinal);
        Assert.DoesNotContain(nameof(OutboxHealthSupport.IsConsumableCharge), sql, StringComparison.Ordinal);
    }

    [Fact]
    public async Task ProcessPending_ConsumablesConsumed_DoesNotDeliverToCcms()
    {
        var journeyId = Guid.NewGuid();
        var consumptionId = Guid.NewGuid();
        _outbox.Enqueue(
            Guid.NewGuid(),
            IntegrationEventTypes.ConsumablesConsumed,
            journeyId,
            new { journeyId, consumptionId, lines = Array.Empty<object>() },
            idempotencyKey: $"{IntegrationEventTypes.ConsumablesConsumed}:{consumptionId:N}");
        await _db.SaveChangesAsync();

        var n = await _outbox.ProcessPendingAsync();
        Assert.Equal(1, n);
        Assert.Equal(OutboxStatuses.Processed, (await _db.IntegrationOutboxEvents.SingleAsync()).Status);
        Assert.Empty(_ccms.Deliveries);
    }

    [Fact]
    public async Task ProcessPending_ConsumablesReturned_DoesNotDeliverToCcms()
    {
        var journeyId = Guid.NewGuid();
        var consumableId = Guid.NewGuid();
        _outbox.Enqueue(
            Guid.NewGuid(),
            IntegrationEventTypes.ConsumablesReturned,
            journeyId,
            new { journeyId, consumptionId = consumableId, lines = Array.Empty<object>() },
            idempotencyKey: $"{IntegrationEventTypes.ConsumablesReturned}:{consumableId:N}:return");
        await _db.SaveChangesAsync();

        var n = await _outbox.ProcessPendingAsync();
        Assert.Equal(1, n);
        Assert.Equal(OutboxStatuses.Processed, (await _db.IntegrationOutboxEvents.SingleAsync()).Status);
        Assert.Empty(_ccms.Deliveries);
    }

    [Fact]
    public async Task Requeue_Dead_ResetsRetryCount_PreservesIdempotencyKey()
    {
        var tenantId = Guid.NewGuid();
        var journeyId = Guid.NewGuid();
        var key = $"SurgeryCompleted:{journeyId:N}";
        var id = Guid.NewGuid();
        _db.IntegrationOutboxEvents.Add(new IntegrationOutboxEvent
        {
            Id = id,
            TenantId = tenantId,
            EventType = IntegrationEventTypes.SurgeryCompleted,
            AggregateId = journeyId,
            PayloadJson = """{"journeyId":"x"}""",
            IdempotencyKey = key,
            Status = OutboxStatuses.Dead,
            RetryCount = 8,
            Error = "CCMS 503",
            OccurredAt = DateTime.UtcNow,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow,
        });
        await _db.SaveChangesAsync();

        var n = await _outbox.RequeueAsync(tenantId, new OutboxRequeueRequest([id], null));
        Assert.Equal(1, n);
        var evt = await _db.IntegrationOutboxEvents.SingleAsync();
        Assert.Equal(OutboxStatuses.Pending, evt.Status);
        Assert.Equal(0, evt.RetryCount);
        Assert.Equal(key, evt.IdempotencyKey);
        Assert.Null(evt.LastAttemptAt);
    }

    [Fact]
    public async Task Requeue_Abandoned_IsRejected()
    {
        var tenantId = Guid.NewGuid();
        var id = Guid.NewGuid();
        _db.IntegrationOutboxEvents.Add(new IntegrationOutboxEvent
        {
            Id = id,
            TenantId = tenantId,
            EventType = IntegrationEventTypes.SurgeryCompleted,
            AggregateId = Guid.NewGuid(),
            PayloadJson = "{}",
            IdempotencyKey = $"k:{id:N}",
            Status = OutboxStatuses.Abandoned,
            RetryCount = 8,
            OccurredAt = DateTime.UtcNow,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow,
        });
        await _db.SaveChangesAsync();

        await Assert.ThrowsAsync<InvalidOperationException>(() =>
            _outbox.RequeueAsync(tenantId, new OutboxRequeueRequest([id], null)));
    }

    [Fact]
    public async Task Abandon_RequiresReason_AndCompensatingActionForFinancial()
    {
        var tenantId = Guid.NewGuid();
        var userId = Guid.NewGuid();
        var id = Guid.NewGuid();
        _db.IntegrationOutboxEvents.Add(new IntegrationOutboxEvent
        {
            Id = id,
            TenantId = tenantId,
            EventType = IntegrationEventTypes.ImplantUsed,
            AggregateId = Guid.NewGuid(),
            PayloadJson = """{"patientName":"Meena Iyer","serialNumber":"77120"}""",
            IdempotencyKey = $"ImplantUsed:{id:N}",
            Status = OutboxStatuses.Dead,
            RetryCount = 8,
            Error = "no billable variant",
            OccurredAt = DateTime.UtcNow,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow,
        });
        await _db.SaveChangesAsync();

        await Assert.ThrowsAsync<ArgumentException>(() =>
            _outbox.AbandonAsync(tenantId, userId, new OutboxAbandonRequest(id, "", null)));
        await Assert.ThrowsAsync<ArgumentException>(() =>
            _outbox.AbandonAsync(tenantId, userId, new OutboxAbandonRequest(id, "duplicate", null)));

        await _outbox.AbandonAsync(tenantId, userId,
            new OutboxAbandonRequest(id, "duplicate of earlier scan", "posted manually on IPD-1"));
        var evt = await _db.IntegrationOutboxEvents.SingleAsync();
        Assert.Equal(OutboxStatuses.Abandoned, evt.Status);
        Assert.Equal("duplicate of earlier scan", evt.AbandonReason);
        Assert.Equal($"ImplantUsed:{id:N}", evt.IdempotencyKey);

        var n = await _outbox.ProcessPendingAsync();
        Assert.Equal(0, n);
        Assert.Equal(OutboxStatuses.Abandoned, (await _db.IntegrationOutboxEvents.SingleAsync()).Status);
    }

    [Fact]
    public async Task GetEvent_MasksPatientIdentifiers()
    {
        var tenantId = Guid.NewGuid();
        var id = Guid.NewGuid();
        _db.IntegrationOutboxEvents.Add(new IntegrationOutboxEvent
        {
            Id = id,
            TenantId = tenantId,
            EventType = IntegrationEventTypes.ImplantUsed,
            AggregateId = Guid.NewGuid(),
            PayloadJson = """{"patientName":"Meena Iyer","serialNumber":"77120"}""",
            IdempotencyKey = $"ImplantUsed:{id:N}",
            Status = OutboxStatuses.Dead,
            RetryCount = 8,
            Error = "no billable variant",
            OccurredAt = DateTime.UtcNow,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow,
        });
        await _db.SaveChangesAsync();

        var detail = await _outbox.GetEventAsync(tenantId, id);
        Assert.Contains("***", detail.MaskedPayloadJson);
        Assert.DoesNotContain("Meena", detail.MaskedPayloadJson);
        Assert.Contains("77120", detail.MaskedPayloadJson);
        Assert.True(detail.MappingRequired);
        Assert.Equal("77120", detail.Subject);
    }

    [Fact]
    public async Task LifecyclePayload_IncludesVersionAndIdentifiers()
    {
        var tenantId = Guid.NewGuid();
        var journeyId = Guid.NewGuid();
        var sessionId = Guid.NewGuid();
        var patientId = Guid.NewGuid();
        var actor = Guid.NewGuid();
        var payload = LifecycleEventPayload.Build(tenantId, journeyId, sessionId, patientId, actor);
        var json = System.Text.Json.JsonSerializer.Serialize(payload);
        Assert.Contains("\"payloadVersion\":1", json);
        Assert.Contains(journeyId.ToString(), json);
        Assert.Contains(sessionId.ToString(), json);
        Assert.Contains(patientId.ToString(), json);
    }

    [Fact]
    public async Task ProcessPending_FansOutHl7AndPacsAfterCcms()
    {
        var hl7 = new RecordingHl7();
        var pacs = new RecordingPacs();
        var outbox = new IntegrationOutboxService(
            _db, _ccms, NullLogger<IntegrationOutboxService>.Instance,
            hl7: hl7, pacs: pacs);
        var journeyId = Guid.NewGuid();
        outbox.Enqueue(
            Guid.NewGuid(),
            IntegrationEventTypes.JourneyAdmitted,
            journeyId,
            new { journeyId },
            idempotencyKey: $"JourneyAdmitted:{journeyId:N}:hl7");
        await _db.SaveChangesAsync();

        var n = await outbox.ProcessPendingAsync();
        Assert.Equal(1, n);
        Assert.Single(_ccms.Deliveries);
        Assert.Single(hl7.Events);
        Assert.Single(pacs.Events);
        Assert.Equal(IntegrationEventTypes.JourneyAdmitted, hl7.Events[0].EventType);
    }

    public void Dispose()
    {
        _db.Dispose();
        _provider.Dispose();
    }

    private sealed class RecordingCcmsClient : ICcmsAdmissionClient
    {
        public bool FailDeliveries { get; set; }
        public List<(string EventType, string IdempotencyKey)> Deliveries { get; } = new();

        public Task<CcmsAdmissionValidation> ValidateAdmissionAsync(
            Guid journeyId, Guid? sessionId, Guid tenantId, bool coverageBased, bool emergencyFcApplied = false)
            => Task.FromResult(new CcmsAdmissionValidation(true, "none", null, null, null, null, null));

        public Task NotifyEmergencyFcAppliedAsync(
            Guid journeyId, Guid? sessionId, Guid tenantId, Guid actorUserId, string reason)
            => Task.CompletedTask;

        public Task DeliverOutboxEventAsync(string eventType, string payloadJson, string idempotencyKey)
        {
            if (FailDeliveries)
                throw new InvalidOperationException("simulated CCMS outage");
            Deliveries.Add((eventType, idempotencyKey));
            return Task.CompletedTask;
        }

        public Task NotifySurgeryCompletedAsync(Guid journeyId, Guid? sessionId, Guid tenantId, Guid actorUserId)
            => Task.CompletedTask;

        public Task NotifyPatientDischargedAsync(Guid journeyId, Guid? sessionId, Guid tenantId, Guid actorUserId)
            => Task.CompletedTask;
    }

    private sealed class RecordingHl7 : IHl7AdtPublisher
    {
        public List<IntegrationOutboxEvent> Events { get; } = new();
        public Task PublishAsync(IntegrationOutboxEvent evt, CancellationToken ct = default)
        {
            Events.Add(evt);
            return Task.CompletedTask;
        }
    }

    private sealed class RecordingPacs : IPacsWorklistPublisher
    {
        public List<IntegrationOutboxEvent> Events { get; } = new();
        public Task PublishAsync(IntegrationOutboxEvent evt, CancellationToken ct = default)
        {
            Events.Add(evt);
            return Task.CompletedTask;
        }
    }
}
