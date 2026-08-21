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
}
