using IpManagementService.Data;
using IpManagementService.Models.Domain;
using IpManagementService.Services;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging.Abstractions;
using Xunit;

namespace IpManagementService.Tests;

public class ConsumableChargeHandlerTests : IDisposable
{
    private readonly ServiceProvider _provider;
    private readonly IpManagementDbContext _db;
    private readonly RecordingConsumableBillingClient _billing;
    private readonly IntegrationOutboxService _outbox;

    public ConsumableChargeHandlerTests()
    {
        var services = new ServiceCollection();
        services.AddDbContext<IpManagementDbContext>(o =>
            o.UseInMemoryDatabase(Guid.NewGuid().ToString("N")));
        _provider = services.BuildServiceProvider();
        _db = _provider.GetRequiredService<IpManagementDbContext>();
        _billing = new RecordingConsumableBillingClient();
        var handler = new ConsumableChargeHandler(_billing, NullLogger<ConsumableChargeHandler>.Instance);
        _outbox = new IntegrationOutboxService(
            _db, new NoOpCcmsAdmissionClient(), NullLogger<IntegrationOutboxService>.Instance,
            implantCharges: null, consumableCharges: handler);
    }

    [Fact]
    public async Task ProcessPending_WithJourney_PostsChargeItemsWithoutPrice()
    {
        var tenantId = Guid.NewGuid();
        var journeyId = Guid.NewGuid();
        var consumptionId = Guid.NewGuid();
        var consumableId = Guid.NewGuid();
        var itemId = Guid.NewGuid();
        _outbox.Enqueue(
            tenantId,
            IntegrationEventTypes.ConsumablesConsumed,
            journeyId,
            new
            {
                tenantId,
                journeyId,
                consumptionId,
                actorUserId = Guid.NewGuid(),
                lines = new[] { new { consumableId, itemId, quantity = 2m } },
            },
            idempotencyKey: $"{IntegrationEventTypes.ConsumablesConsumed}:{consumptionId:N}");
        await _db.SaveChangesAsync();

        var n = await _outbox.ProcessPendingAsync();
        Assert.Equal(1, n);
        var post = Assert.Single(_billing.Posts);
        Assert.Equal($"ConsumablesConsumed:{consumptionId:N}", post.Key);
        var line = Assert.Single(post.Lines);
        Assert.Equal("Consumable", line.SourceType);
        Assert.Equal(consumableId, line.SourceRefId);
        Assert.Equal(itemId, line.ItemId);
        Assert.Equal(2m, line.Quantity);
        Assert.False(line.IsCredit);
        Assert.Empty(_billing.Exceptions);
        Assert.Equal(OutboxStatuses.Processed, (await _db.IntegrationOutboxEvents.SingleAsync()).Status);

        await _outbox.ProcessPendingAsync();
        Assert.Single(_billing.Posts);
    }

    [Fact]
    public async Task ProcessPending_MissingJourney_EnqueuesException_DoesNotCharge()
    {
        var tenantId = Guid.NewGuid();
        var consumptionId = Guid.NewGuid();
        var consumableId = Guid.NewGuid();
        _outbox.Enqueue(
            tenantId,
            IntegrationEventTypes.ConsumablesConsumed,
            consumptionId,
            new
            {
                tenantId,
                journeyId = (Guid?)null,
                consumptionId,
                actorUserId = Guid.NewGuid(),
                lines = new[] { new { consumableId, itemId = Guid.NewGuid(), quantity = 1m } },
            },
            idempotencyKey: $"{IntegrationEventTypes.ConsumablesConsumed}:{consumptionId:N}");
        await _db.SaveChangesAsync();

        var n = await _outbox.ProcessPendingAsync();
        Assert.Equal(1, n);
        Assert.Empty(_billing.Posts);
        var parked = Assert.Single(_billing.Exceptions);
        Assert.Contains("Missing journey_id", parked.Reason);
        Assert.Null(parked.JourneyId);
        Assert.Equal(OutboxStatuses.Processed, (await _db.IntegrationOutboxEvents.SingleAsync()).Status);
    }

    [Fact]
    public async Task ProcessPending_BillNotFound_RetriesUntilBillExists_NeverDeads()
    {
        _billing.ThrowCode = "BILL_NOT_FOUND";
        var tenantId = Guid.NewGuid();
        var journeyId = Guid.NewGuid();
        var consumptionId = Guid.NewGuid();
        _outbox.Enqueue(
            tenantId,
            IntegrationEventTypes.ConsumablesConsumed,
            journeyId,
            new
            {
                tenantId,
                journeyId,
                consumptionId,
                lines = new[] { new { consumableId = Guid.NewGuid(), itemId = Guid.NewGuid(), quantity = 1m } },
            },
            idempotencyKey: $"{IntegrationEventTypes.ConsumablesConsumed}:{consumptionId:N}");
        await _db.SaveChangesAsync();

        for (var i = 0; i < 10; i++)
            await _outbox.ProcessPendingAsync();

        var waiting = await _db.IntegrationOutboxEvents.SingleAsync();
        Assert.Equal(OutboxStatuses.Failed, waiting.Status);
        Assert.True(waiting.RetryCount >= 8);
        Assert.Empty(_billing.Posts);

        _billing.ThrowCode = null;
        var n = await _outbox.ProcessPendingAsync();
        Assert.Equal(1, n);
        Assert.Equal(OutboxStatuses.Processed, (await _db.IntegrationOutboxEvents.SingleAsync()).Status);
        Assert.Single(_billing.Posts);
    }

    [Fact]
    public async Task ProcessPending_DeadBillNotFound_IsRevivedAndPosted()
    {
        var tenantId = Guid.NewGuid();
        var journeyId = Guid.NewGuid();
        var consumptionId = Guid.NewGuid();
        _db.IntegrationOutboxEvents.Add(new IntegrationOutboxEvent
        {
            Id = Guid.NewGuid(),
            TenantId = tenantId,
            EventType = IntegrationEventTypes.ConsumablesConsumed,
            AggregateType = "PatientJourney",
            AggregateId = journeyId,
            CorrelationId = journeyId,
            PayloadJson = System.Text.Json.JsonSerializer.Serialize(new
            {
                tenantId,
                journeyId,
                consumptionId,
                lines = new[] { new { consumableId = Guid.NewGuid(), itemId = Guid.NewGuid(), quantity = 1m } },
            }),
            IdempotencyKey = $"{IntegrationEventTypes.ConsumablesConsumed}:{consumptionId:N}",
            OccurredAt = DateTime.UtcNow,
            Status = OutboxStatuses.Dead,
            RetryCount = 8,
            Error = "BILL_NOT_FOUND",
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow,
        });
        await _db.SaveChangesAsync();

        var n = await _outbox.ProcessPendingAsync();
        Assert.Equal(1, n);
        Assert.Equal(OutboxStatuses.Processed, (await _db.IntegrationOutboxEvents.SingleAsync()).Status);
        Assert.Single(_billing.Posts);
    }

    [Fact]
    public async Task ProcessPending_DeadBillFinalized_IsRevivedAndParked_DoesNotPost()
    {
        _billing.ThrowCode = "BILL_FINALIZED";
        var tenantId = Guid.NewGuid();
        var journeyId = Guid.NewGuid();
        var consumptionId = Guid.NewGuid();
        _db.IntegrationOutboxEvents.Add(new IntegrationOutboxEvent
        {
            Id = Guid.NewGuid(),
            TenantId = tenantId,
            EventType = IntegrationEventTypes.ConsumablesConsumed,
            AggregateType = "PatientJourney",
            AggregateId = journeyId,
            CorrelationId = journeyId,
            PayloadJson = System.Text.Json.JsonSerializer.Serialize(new
            {
                tenantId,
                journeyId,
                consumptionId,
                lines = new[] { new { consumableId = Guid.NewGuid(), itemId = Guid.NewGuid(), quantity = 1m } },
            }),
            IdempotencyKey = $"{IntegrationEventTypes.ConsumablesConsumed}:{consumptionId:N}",
            OccurredAt = DateTime.UtcNow,
            Status = OutboxStatuses.Dead,
            RetryCount = 8,
            Error = "BILL_FINALIZED",
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow,
        });
        await _db.SaveChangesAsync();

        var n = await _outbox.ProcessPendingAsync();
        Assert.Equal(1, n);
        Assert.Equal(OutboxStatuses.Processed, (await _db.IntegrationOutboxEvents.SingleAsync()).Status);
        Assert.Empty(_billing.Posts);
        var parked = Assert.Single(_billing.Exceptions);
        Assert.Equal("NeedsAdjustment", parked.Status);
    }

    [Fact]
    public async Task ProcessPending_BillFinalized_ParksNeedsAdjustment_DoesNotDead()
    {
        _billing.ThrowCode = "BILL_FINALIZED";
        var tenantId = Guid.NewGuid();
        var journeyId = Guid.NewGuid();
        var consumptionId = Guid.NewGuid();
        _outbox.Enqueue(
            tenantId,
            IntegrationEventTypes.ConsumablesConsumed,
            journeyId,
            new
            {
                tenantId,
                journeyId,
                consumptionId,
                lines = new[] { new { consumableId = Guid.NewGuid(), itemId = Guid.NewGuid(), quantity = 1m } },
            },
            idempotencyKey: $"{IntegrationEventTypes.ConsumablesConsumed}:{consumptionId:N}");
        await _db.SaveChangesAsync();

        for (var i = 0; i < 10; i++)
            await _outbox.ProcessPendingAsync();

        var evt = await _db.IntegrationOutboxEvents.SingleAsync();
        Assert.Equal(OutboxStatuses.Processed, evt.Status);
        Assert.Empty(_billing.Posts);
        var parked = Assert.Single(_billing.Exceptions);
        Assert.Equal("NeedsAdjustment", parked.Status);
        Assert.Contains("BILL_FINALIZED", parked.Reason);
    }

    [Fact]
    public async Task ProcessPending_Returned_PostsIsCreditTrue()
    {
        var tenantId = Guid.NewGuid();
        var journeyId = Guid.NewGuid();
        var consumableId = Guid.NewGuid();
        var itemId = Guid.NewGuid();
        _outbox.Enqueue(
            tenantId,
            IntegrationEventTypes.ConsumablesReturned,
            journeyId,
            new
            {
                tenantId,
                journeyId,
                consumptionId = consumableId,
                actorUserId = Guid.NewGuid(),
                lines = new[] { new { consumableId, itemId, quantity = 2m } },
            },
            idempotencyKey: $"{IntegrationEventTypes.ConsumablesReturned}:{consumableId:N}:return");
        await _db.SaveChangesAsync();

        var n = await _outbox.ProcessPendingAsync();
        Assert.Equal(1, n);
        var post = Assert.Single(_billing.Posts);
        Assert.Equal($"ConsumablesReturned:{consumableId:N}:return", post.Key);
        var line = Assert.Single(post.Lines);
        Assert.Equal("Consumable", line.SourceType);
        Assert.Equal(consumableId, line.SourceRefId);
        Assert.Equal(itemId, line.ItemId);
        Assert.Equal(2m, line.Quantity);
        Assert.True(line.IsCredit);
        Assert.Empty(_billing.Exceptions);
        Assert.Equal(OutboxStatuses.Processed, (await _db.IntegrationOutboxEvents.SingleAsync()).Status);
    }

    [Fact]
    public async Task ProcessPending_Returned_BillFinalized_ParksNeedsAdjustment_DoesNotPost()
    {
        _billing.ThrowCode = "BILL_FINALIZED";
        var tenantId = Guid.NewGuid();
        var journeyId = Guid.NewGuid();
        var consumableId = Guid.NewGuid();
        _outbox.Enqueue(
            tenantId,
            IntegrationEventTypes.ConsumablesReturned,
            journeyId,
            new
            {
                tenantId,
                journeyId,
                consumptionId = consumableId,
                lines = new[] { new { consumableId, itemId = Guid.NewGuid(), quantity = 1m } },
            },
            idempotencyKey: $"{IntegrationEventTypes.ConsumablesReturned}:{consumableId:N}:return");
        await _db.SaveChangesAsync();

        for (var i = 0; i < 10; i++)
            await _outbox.ProcessPendingAsync();

        var evt = await _db.IntegrationOutboxEvents.SingleAsync();
        Assert.Equal(OutboxStatuses.Processed, evt.Status);
        Assert.Empty(_billing.Posts);
        var parked = Assert.Single(_billing.Exceptions);
        Assert.Equal("NeedsAdjustment", parked.Status);
    }

    [Fact]
    public async Task ProcessPending_Returned_BillNotFound_RetriesUntilBillExists()
    {
        _billing.ThrowCode = "BILL_NOT_FOUND";
        var tenantId = Guid.NewGuid();
        var journeyId = Guid.NewGuid();
        var consumableId = Guid.NewGuid();
        _outbox.Enqueue(
            tenantId,
            IntegrationEventTypes.ConsumablesReturned,
            journeyId,
            new
            {
                tenantId,
                journeyId,
                consumptionId = consumableId,
                lines = new[] { new { consumableId, itemId = Guid.NewGuid(), quantity = 1m } },
            },
            idempotencyKey: $"{IntegrationEventTypes.ConsumablesReturned}:{consumableId:N}:return");
        await _db.SaveChangesAsync();

        for (var i = 0; i < 10; i++)
            await _outbox.ProcessPendingAsync();

        var waiting = await _db.IntegrationOutboxEvents.SingleAsync();
        Assert.Equal(OutboxStatuses.Failed, waiting.Status);
        Assert.True(waiting.RetryCount >= 8);
        Assert.Empty(_billing.Posts);

        _billing.ThrowCode = null;
        var n = await _outbox.ProcessPendingAsync();
        Assert.Equal(1, n);
        Assert.Equal(OutboxStatuses.Processed, (await _db.IntegrationOutboxEvents.SingleAsync()).Status);
        Assert.Single(_billing.Posts);
        Assert.True(Assert.Single(_billing.Posts).Lines[0].IsCredit);
    }

    public void Dispose()
    {
        _db.Dispose();
        _provider.Dispose();
    }

    private sealed class RecordingConsumableBillingClient : IAuthBillingClient
    {
        public List<(string Key, IReadOnlyList<AuthChargeItemLine> Lines)> Posts { get; } = [];
        public List<(string Key, string Reason, Guid? JourneyId, string? Status)> Exceptions { get; } = [];
        public string? ThrowCode { get; set; }

        public Task<Guid> EnsureBillAsync(Guid tenantId, Guid branchId, Guid patientId, Guid journeyId, decimal packageAmount, Guid actorUserId)
            => Task.FromResult(Guid.NewGuid());
        public Task<AuthIpFinancialSummary> GetSummaryAsync(Guid journeyId)
            => Task.FromResult(new AuthIpFinancialSummary(
                null, null, 0, 0, 0, 0, 0, 0, 0, 0, 0, "not_created", false, false, [], []));
        public Task RecordPaymentAsync(Guid opdBillId, Guid actorUserId, string kind, string paymentMode, decimal amount, string? reference, string? notes, string? idempotencyKey)
            => Task.CompletedTask;
        public Task ReversePaymentAsync(Guid opdBillId, Guid originalPaymentId, Guid actorUserId, string reason)
            => Task.CompletedTask;
        public Task ApplyCoverageAllocationAsync(Guid journeyId, decimal payerResponsibility, decimal patientResponsibility, Guid actorUserId)
            => Task.CompletedTask;
        public Task SoftDeleteBillsForJourneysAsync(IReadOnlyList<Guid> journeyIds, Guid actorUserId)
            => Task.CompletedTask;

        public Task<AuthChargeItemsResult> ChargeItemsAsync(
            Guid tenantId, Guid patientJourneyId, Guid actorUserId, string idempotencyKey,
            IReadOnlyList<AuthChargeItemLine> lines)
        {
            if (ThrowCode is not null)
                throw new AuthChargePostingException(ThrowCode, ThrowCode, Guid.NewGuid());
            Posts.Add((idempotencyKey, lines));
            return Task.FromResult(new AuthChargeItemsResult(Guid.NewGuid(), false, PostedCount: lines.Count));
        }

        public Task EnqueueChargeExceptionAsync(
            Guid tenantId, Guid? patientJourneyId, Guid? itemId, Guid? sourceRefId,
            string sourceType, string reason, string idempotencyKey, decimal quantity,
            Guid? opdBillId = null, string? status = null)
        {
            Exceptions.Add((idempotencyKey, reason, patientJourneyId, status));
            return Task.CompletedTask;
        }
    }
}
