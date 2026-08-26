using InventoryApi.Data;
using InventoryApi.Models.DTOs;
using InventoryApi.Models.Entities;
using InventoryApi.Services;
using Microsoft.EntityFrameworkCore;
using Xunit;

namespace InventoryApi.Tests.Services;

public class SurgeryConsumableChargeTests
{
    [Fact]
    public async Task BulkIssue_EmitsOneOutboxEvent_WithoutPurchaseRate()
    {
        await using var db = NewDb();
        var stock = new FakeStock(purchaseRate: 8888.88m);
        var svc = new SurgeryConsumableService(db, stock);
        var tenantId = Guid.NewGuid();
        var journeyId = Guid.NewGuid();
        var itemA = Guid.NewGuid();
        var itemB = Guid.NewGuid();

        await svc.IssueSurgeryConsumablesAsync(tenantId, Guid.NewGuid(), new IssueSurgeryConsumableRequest(
            Guid.NewGuid(), Guid.NewGuid(), "Bulk", "Pat", "IP-1",
            [
                new IssueConsumableItemRequest(itemA, null, 2, null, null),
                new IssueConsumableItemRequest(itemB, null, 1, null, null),
            ],
            journeyId), CancellationToken.None);

        var evt = Assert.Single(db.IntegrationOutboxEvents);
        Assert.Equal(InventoryIntegrationEventTypes.ConsumablesConsumed, evt.EventType);
        Assert.StartsWith("ConsumablesConsumed:", evt.IdempotencyKey);
        Assert.Contains(journeyId.ToString(), evt.PayloadJson);
        Assert.Contains(itemA.ToString(), evt.PayloadJson);
        Assert.Contains("\"quantity\":2", evt.PayloadJson);
        Assert.DoesNotContain("8888", evt.PayloadJson);
        Assert.DoesNotContain("unitRate", evt.PayloadJson, StringComparison.OrdinalIgnoreCase);
        Assert.DoesNotContain("purchaseRate", evt.PayloadJson, StringComparison.OrdinalIgnoreCase);
        Assert.DoesNotContain("\"amount\"", evt.PayloadJson, StringComparison.OrdinalIgnoreCase);

        var rows = await db.SurgeryConsumables.ToListAsync();
        Assert.Equal(2, rows.Count);
        Assert.All(rows, r => Assert.Equal(ConsumableChargeStatus.Pending, r.ChargeStatus));
        Assert.All(rows, r => Assert.Equal(8888.88m, r.UnitRate));
    }

    [Fact]
    public async Task BulkIssue_WithoutJourney_MarksUnmappedJourney_AndStillEmits()
    {
        await using var db = NewDb();
        var svc = new SurgeryConsumableService(db, new FakeStock(1m));

        await svc.IssueSurgeryConsumablesAsync(Guid.NewGuid(), Guid.NewGuid(), new IssueSurgeryConsumableRequest(
            Guid.NewGuid(), null, "Bulk", null, null,
            [new IssueConsumableItemRequest(Guid.NewGuid(), null, 1, null, null)]), CancellationToken.None);

        var row = Assert.Single(db.SurgeryConsumables);
        Assert.Equal(ConsumableChargeStatus.UnmappedJourney, row.ChargeStatus);
        var evt = Assert.Single(db.IntegrationOutboxEvents);
        Assert.Contains("\"journeyId\":null", evt.PayloadJson);
    }

    [Fact]
    public async Task DuplicateOutboxKey_IsSkipped()
    {
        await using var db = NewDb();
        var svc = new SurgeryConsumableService(db, new FakeStock(1m));
        var tenantId = Guid.NewGuid();
        var journeyId = Guid.NewGuid();
        await svc.IssueSurgeryConsumablesAsync(tenantId, Guid.NewGuid(), new IssueSurgeryConsumableRequest(
            Guid.NewGuid(), null, "Bulk", null, null,
            [new IssueConsumableItemRequest(Guid.NewGuid(), null, 1, null, null)],
            journeyId), CancellationToken.None);

        var evt = Assert.Single(db.IntegrationOutboxEvents);
        var consumptionId = Guid.Parse(evt.IdempotencyKey.Split(':')[1]);
        svc.TryEnqueueConsumablesConsumed(tenantId, journeyId, consumptionId, Guid.NewGuid(), db.SurgeryConsumables.ToList());
        await db.SaveChangesAsync();
        Assert.Equal(1, await db.IntegrationOutboxEvents.CountAsync());
    }

    [Fact]
    public async Task IssueInOT_UsesPlannedJourney_AndConsumableIdAsConsumptionId()
    {
        await using var db = NewDb();
        var svc = new SurgeryConsumableService(db, new FakeStock(8888.88m));
        var tenantId = Guid.NewGuid();
        var userId = Guid.NewGuid();
        var journeyId = Guid.NewGuid();
        var planned = await svc.PlanAsync(tenantId, userId, new PlanConsumableRequest(
            Guid.NewGuid(), Guid.NewGuid(), "Bulk", "Pat", "IP-1",
            [new PlanConsumableItemRequest(Guid.NewGuid(), 1)],
            journeyId), CancellationToken.None);
        var row = Assert.Single(planned);
        row.ConsumableStatus = "StockAllocated";
        await db.SaveChangesAsync();

        await svc.IssueInOTAsync(tenantId, userId, row.Id, CancellationToken.None);

        var evt = Assert.Single(db.IntegrationOutboxEvents);
        Assert.Equal($"ConsumablesConsumed:{row.Id:N}", evt.IdempotencyKey);
        Assert.Contains(journeyId.ToString(), evt.PayloadJson);
        Assert.DoesNotContain("8888", evt.PayloadJson);
        Assert.Equal(ConsumableChargeStatus.Pending, (await db.SurgeryConsumables.SingleAsync()).ChargeStatus);
    }

    [Fact]
    public async Task PostedReturn_EmitsConsumablesReturned_WithoutPurchaseRate()
    {
        await using var db = NewDb();
        var svc = new SurgeryConsumableService(db, new FakeStock(8888.88m));
        var tenantId = Guid.NewGuid();
        var journeyId = Guid.NewGuid();
        var itemId = Guid.NewGuid();
        await svc.IssueSurgeryConsumablesAsync(tenantId, Guid.NewGuid(), new IssueSurgeryConsumableRequest(
            Guid.NewGuid(), Guid.NewGuid(), "Bulk", "Pat", "IP-1",
            [new IssueConsumableItemRequest(itemId, null, 2, null, null)],
            journeyId), CancellationToken.None);

        var row = await db.SurgeryConsumables.SingleAsync();
        row.ChargeStatus = ConsumableChargeStatus.Posted;
        await db.SaveChangesAsync();

        await svc.PostReturnAsync(tenantId, Guid.NewGuid(), row.Id, 2, CancellationToken.None);

        var returned = Assert.Single(db.IntegrationOutboxEvents.Where(e =>
            e.EventType == InventoryIntegrationEventTypes.ConsumablesReturned));
        Assert.Equal($"ConsumablesReturned:{row.Id:N}:return", returned.IdempotencyKey);
        Assert.Contains(journeyId.ToString(), returned.PayloadJson);
        Assert.Contains(itemId.ToString(), returned.PayloadJson);
        Assert.Contains("\"quantity\":2", returned.PayloadJson);
        Assert.DoesNotContain("8888", returned.PayloadJson);
        Assert.DoesNotContain("unitRate", returned.PayloadJson, StringComparison.OrdinalIgnoreCase);
        Assert.DoesNotContain("purchaseRate", returned.PayloadJson, StringComparison.OrdinalIgnoreCase);
        Assert.Equal(ConsumableChargeStatus.Posted, (await db.SurgeryConsumables.SingleAsync()).ChargeStatus);
        Assert.Equal("ReturnPosted", (await db.SurgeryConsumables.SingleAsync()).ConsumableStatus);
    }

    [Fact]
    public async Task PostedCancel_EmitsCreditForRemainingQty()
    {
        await using var db = NewDb();
        var svc = new SurgeryConsumableService(db, new FakeStock(1m));
        var tenantId = Guid.NewGuid();
        var journeyId = Guid.NewGuid();
        await svc.IssueSurgeryConsumablesAsync(tenantId, Guid.NewGuid(), new IssueSurgeryConsumableRequest(
            Guid.NewGuid(), Guid.NewGuid(), "Bulk", "Pat", "IP-1",
            [new IssueConsumableItemRequest(Guid.NewGuid(), null, 5, null, null)],
            journeyId), CancellationToken.None);

        var row = await db.SurgeryConsumables.SingleAsync();
        row.ChargeStatus = ConsumableChargeStatus.Posted;
        await db.SaveChangesAsync();

        await svc.PostReturnAsync(tenantId, Guid.NewGuid(), row.Id, 2, CancellationToken.None);
        await svc.CancelConsumableAsync(tenantId, row.Id, Guid.NewGuid(), CancellationToken.None);

        var credits = db.IntegrationOutboxEvents
            .Where(e => e.EventType == InventoryIntegrationEventTypes.ConsumablesReturned)
            .OrderBy(e => e.IdempotencyKey)
            .ToList();
        Assert.Equal(2, credits.Count);
        Assert.EndsWith(":cancel", credits.Single(e => e.IdempotencyKey.EndsWith(":cancel")).IdempotencyKey);
        Assert.Contains("\"quantity\":3", credits.Single(e => e.IdempotencyKey.EndsWith(":cancel")).PayloadJson);
        Assert.Contains("\"quantity\":2", credits.Single(e => e.IdempotencyKey.EndsWith(":return")).PayloadJson);
    }

    [Fact]
    public async Task PendingCancel_AbandonsConsume_DoesNotCredit()
    {
        await using var db = NewDb();
        var svc = new SurgeryConsumableService(db, new FakeStock(1m));
        var tenantId = Guid.NewGuid();
        var userId = Guid.NewGuid();
        var planned = await svc.PlanAsync(tenantId, userId, new PlanConsumableRequest(
            Guid.NewGuid(), Guid.NewGuid(), "Bulk", "Pat", "IP-1",
            [new PlanConsumableItemRequest(Guid.NewGuid(), 1)],
            Guid.NewGuid()), CancellationToken.None);
        var row = Assert.Single(planned);
        row.ConsumableStatus = "StockAllocated";
        await db.SaveChangesAsync();
        await svc.IssueInOTAsync(tenantId, userId, row.Id, CancellationToken.None);

        var consume = Assert.Single(db.IntegrationOutboxEvents);
        Assert.Equal(InventoryIntegrationEventTypes.ConsumablesConsumed, consume.EventType);

        var cancelled = await svc.CancelConsumableAsync(tenantId, row.Id, userId, CancellationToken.None);
        Assert.True(cancelled);

        Assert.Empty(db.IntegrationOutboxEvents.Where(e =>
            e.EventType == InventoryIntegrationEventTypes.ConsumablesReturned));
        Assert.Equal("Abandoned", (await db.IntegrationOutboxEvents.SingleAsync()).Status);
        Assert.Equal(ConsumableChargeStatus.Suppressed, (await db.SurgeryConsumables.SingleAsync()).ChargeStatus);
    }

    [Fact]
    public async Task SuppressedReturn_DoesNotEnqueueCredit()
    {
        await using var db = NewDb();
        var svc = new SurgeryConsumableService(db, new FakeStock(1m));
        var tenantId = Guid.NewGuid();
        await svc.IssueSurgeryConsumablesAsync(tenantId, Guid.NewGuid(), new IssueSurgeryConsumableRequest(
            Guid.NewGuid(), Guid.NewGuid(), "Bulk", "Pat", "IP-1",
            [new IssueConsumableItemRequest(Guid.NewGuid(), null, 1, null, null)],
            Guid.NewGuid()), CancellationToken.None);

        var row = await db.SurgeryConsumables.SingleAsync();
        row.ChargeStatus = ConsumableChargeStatus.Suppressed;
        await db.SaveChangesAsync();

        await svc.PostReturnAsync(tenantId, Guid.NewGuid(), row.Id, 1, CancellationToken.None);

        Assert.Empty(db.IntegrationOutboxEvents.Where(e =>
            e.EventType == InventoryIntegrationEventTypes.ConsumablesReturned));
        Assert.Equal(ConsumableChargeStatus.Suppressed, (await db.SurgeryConsumables.SingleAsync()).ChargeStatus);
    }

    [Fact]
    public async Task BulkCancelOneLine_DoesNotAbandonBatchConsume()
    {
        await using var db = NewDb();
        var svc = new SurgeryConsumableService(db, new FakeStock(1m));
        var tenantId = Guid.NewGuid();
        await svc.IssueSurgeryConsumablesAsync(tenantId, Guid.NewGuid(), new IssueSurgeryConsumableRequest(
            Guid.NewGuid(), Guid.NewGuid(), "Bulk", "Pat", "IP-1",
            [
                new IssueConsumableItemRequest(Guid.NewGuid(), null, 1, null, null),
                new IssueConsumableItemRequest(Guid.NewGuid(), null, 1, null, null),
            ],
            Guid.NewGuid()), CancellationToken.None);

        var first = db.SurgeryConsumables.OrderBy(c => c.CreatedAt).First();
        await svc.CancelConsumableAsync(tenantId, first.Id, Guid.NewGuid(), CancellationToken.None);

        var consume = Assert.Single(db.IntegrationOutboxEvents);
        Assert.Equal(InventoryIntegrationEventTypes.ConsumablesConsumed, consume.EventType);
        Assert.Equal("Pending", consume.Status);
        Assert.Equal(ConsumableChargeStatus.Suppressed, (await db.SurgeryConsumables.FindAsync(first.Id))!.ChargeStatus);
    }

    [Fact]
    public async Task DuplicateReturnedKey_IsSkipped()
    {
        await using var db = NewDb();
        var svc = new SurgeryConsumableService(db, new FakeStock(1m));
        var tenantId = Guid.NewGuid();
        var journeyId = Guid.NewGuid();
        await svc.IssueSurgeryConsumablesAsync(tenantId, Guid.NewGuid(), new IssueSurgeryConsumableRequest(
            Guid.NewGuid(), Guid.NewGuid(), "Bulk", "Pat", "IP-1",
            [new IssueConsumableItemRequest(Guid.NewGuid(), null, 1, null, null)],
            journeyId), CancellationToken.None);

        var row = await db.SurgeryConsumables.SingleAsync();
        svc.TryEnqueueConsumablesReturned(tenantId, journeyId, Guid.NewGuid(), row, 1, "return");
        svc.TryEnqueueConsumablesReturned(tenantId, journeyId, Guid.NewGuid(), row, 1, "return");
        await db.SaveChangesAsync();

        Assert.Single(db.IntegrationOutboxEvents.Where(e =>
            e.EventType == InventoryIntegrationEventTypes.ConsumablesReturned));
    }

    private static InventoryDbContext NewDb() => new(
        new DbContextOptionsBuilder<InventoryDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString("N"))
            .Options);

    private sealed class FakeStock : IStockService
    {
        private readonly decimal _purchaseRate;
        public FakeStock(decimal purchaseRate) => _purchaseRate = purchaseRate;

        public Task PostGrnStockAsync(Guid tenantId, GrnHeader grn, Guid userId, CancellationToken ct)
            => throw new NotImplementedException();

        public Task<StockBatch> DeductFefoAsync(
            Guid tenantId, Guid storeId, Guid itemId, decimal quantity, Guid userId,
            string txType, string refId, string refNumber, CancellationToken ct)
            => Task.FromResult(new StockBatch
            {
                Id = Guid.NewGuid(),
                TenantId = tenantId,
                StoreId = storeId,
                ItemId = itemId,
                PurchaseRate = _purchaseRate,
                QuantityAvailable = quantity,
            });

        public Task PostTransferAsync(Guid tenantId, StockTransfer transfer, Guid userId, CancellationToken ct)
            => throw new NotImplementedException();
    }
}
