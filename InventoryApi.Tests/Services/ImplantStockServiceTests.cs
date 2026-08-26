using InventoryApi.Data;
using InventoryApi.Models.DTOs;
using InventoryApi.Models.Entities;
using InventoryApi.Services;
using Microsoft.EntityFrameworkCore;
using Xunit;

namespace InventoryApi.Tests.Services;

public class ImplantStockServiceTests
{
    [Fact]
    public async Task Implanted_DeductsFefo_AndIsIdempotent()
    {
        await using var db = NewDb();
        var tenantId = Guid.NewGuid();
        var userId = Guid.NewGuid();
        var (store, item, batch) = await SeedStockAsync(db, tenantId);
        var svc = new ImplantStockService(db, new StockService(db));
        var usageId = Guid.NewGuid();

        var first = await svc.ApplyAsync(tenantId, userId, Used(usageId, item.Id, "Implanted"), CancellationToken.None);
        Assert.False(first.Unmapped);
        Assert.False(first.Replayed);
        Assert.NotNull(first.LedgerId);
        Assert.Equal(ImplantStockTxn.OtIssue, first.TransactionType);

        var remaining = await db.StockBatches.AsNoTracking().SingleAsync(b => b.Id == batch.Id);
        Assert.Equal(2m, remaining.QuantityAvailable);

        var replay = await svc.ApplyAsync(tenantId, userId, Used(usageId, item.Id, "Implanted"), CancellationToken.None);
        Assert.True(replay.Replayed);
        Assert.Equal(first.LedgerId, replay.LedgerId);
        Assert.Equal(1, await db.StockLedgers.CountAsync());
    }

    [Fact]
    public async Task OpenedUnused_PostsImplantWaste_WithoutChargeSemantics()
    {
        await using var db = NewDb();
        var tenantId = Guid.NewGuid();
        var (store, item, _) = await SeedStockAsync(db, tenantId);
        var svc = new ImplantStockService(db, new StockService(db));

        var result = await svc.ApplyAsync(tenantId, Guid.NewGuid(), Used(Guid.NewGuid(), item.Id, "Opened_Unused", "Wrong power"), CancellationToken.None);
        Assert.Equal(ImplantStockTxn.ImplantWaste, result.TransactionType);
        var ledger = await db.StockLedgers.SingleAsync();
        Assert.Equal(1m, ledger.QuantityOut);
        Assert.Equal("Wrong power", ledger.Remarks);
    }

    [Fact]
    public async Task UnmappedItem_SucceedsWithoutLedger()
    {
        await using var db = NewDb();
        db.Stores.Add(new StoreMaster
        {
            Id = Guid.NewGuid(), TenantId = Guid.NewGuid(), StoreName = "OT", StoreType = "OT",
            IsActive = true, CreatedAt = DateTime.UtcNow, UpdatedAt = DateTime.UtcNow, Status = "active",
        });
        await db.SaveChangesAsync();
        var svc = new ImplantStockService(db, new StockService(db));

        var result = await svc.ApplyAsync(Guid.NewGuid(), Guid.NewGuid(), new ApplyImplantStockRequest
        {
            ImplantUsageId = Guid.NewGuid(),
            JourneyId = Guid.NewGuid(),
            CatalogRef = "NOT-A-REAL-SKU",
            UsageStatus = "Implanted",
        }, CancellationToken.None);

        Assert.True(result.Unmapped);
        Assert.Null(result.LedgerId);
        Assert.Equal(0, await db.StockLedgers.CountAsync());
    }

    [Fact]
    public async Task Reversal_RestoresBatch_AndIsIdempotent()
    {
        await using var db = NewDb();
        var tenantId = Guid.NewGuid();
        var userId = Guid.NewGuid();
        var (_, item, batch) = await SeedStockAsync(db, tenantId);
        var svc = new ImplantStockService(db, new StockService(db));
        var usageId = Guid.NewGuid();

        await svc.ApplyAsync(tenantId, userId, Used(usageId, item.Id, "Implanted"), CancellationToken.None);
        var reversed = await svc.ApplyAsync(tenantId, userId, Used(usageId, item.Id, "Reversed", "Wrong serial"), CancellationToken.None);
        Assert.Equal(ImplantStockTxn.ImplantReturn, reversed.TransactionType);
        Assert.Equal(3m, (await db.StockBatches.AsNoTracking().SingleAsync(b => b.Id == batch.Id)).QuantityAvailable);

        await svc.ApplyAsync(tenantId, userId, Used(usageId, item.Id, "Reversed", "Wrong serial"), CancellationToken.None);
        Assert.Equal(2, await db.StockLedgers.CountAsync());
    }

    [Fact]
    public async Task NoStock_StillPostsOtIssueLedger()
    {
        await using var db = NewDb();
        var tenantId = Guid.NewGuid();
        var store = new StoreMaster
        {
            Id = Guid.NewGuid(), TenantId = tenantId, StoreName = "OT", StoreType = "OT",
            IsActive = true, CreatedAt = DateTime.UtcNow, UpdatedAt = DateTime.UtcNow, Status = "active",
        };
        var item = new ItemMaster
        {
            Id = Guid.NewGuid(), TenantId = tenantId, ItemName = "SN60WF", Brand = "Alcon",
            ItemType = "IOL", Unit = "Nos", CreatedAt = DateTime.UtcNow, UpdatedAt = DateTime.UtcNow, Status = "active",
        };
        db.Stores.Add(store);
        db.Items.Add(item);
        await db.SaveChangesAsync();
        var svc = new ImplantStockService(db, new StockService(db));

        var result = await svc.ApplyAsync(tenantId, Guid.NewGuid(), Used(Guid.NewGuid(), item.Id, "Implanted"), CancellationToken.None);
        Assert.False(result.Unmapped);
        Assert.Equal(ImplantStockTxn.OtIssue, result.TransactionType);
        Assert.Equal(1m, (await db.StockLedgers.SingleAsync()).QuantityOut);
    }

    private static ApplyImplantStockRequest Used(Guid usageId, Guid itemId, string status, string? reason = null)
        => new()
        {
            ImplantUsageId = usageId,
            JourneyId = Guid.NewGuid(),
            ItemId = itemId,
            SerialNumber = "88213",
            UsageStatus = status,
            WastageReason = reason,
        };

    private static async Task<(StoreMaster Store, ItemMaster Item, StockBatch Batch)> SeedStockAsync(
        InventoryDbContext db, Guid tenantId)
    {
        var store = new StoreMaster
        {
            Id = Guid.NewGuid(), TenantId = tenantId, StoreName = "OT", StoreType = "OT",
            IsActive = true, CreatedAt = DateTime.UtcNow, UpdatedAt = DateTime.UtcNow, Status = "active",
        };
        var item = new ItemMaster
        {
            Id = Guid.NewGuid(), TenantId = tenantId, ItemName = "SN60WF", Brand = "Alcon",
            ItemType = "IOL", Unit = "Nos", CreatedAt = DateTime.UtcNow, UpdatedAt = DateTime.UtcNow, Status = "active",
        };
        var batch = new StockBatch
        {
            Id = Guid.NewGuid(), TenantId = tenantId, StoreId = store.Id, ItemId = item.Id,
            BatchNumber = "B-1", PurchaseRate = 14000, QuantityIn = 3, QuantityAvailable = 3,
            IsActive = true, CreatedAt = DateTime.UtcNow, UpdatedAt = DateTime.UtcNow, Status = "active",
        };
        db.Stores.Add(store);
        db.Items.Add(item);
        db.StockBatches.Add(batch);
        await db.SaveChangesAsync();
        return (store, item, batch);
    }

    private static InventoryDbContext NewDb() => new(
        new DbContextOptionsBuilder<InventoryDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString("N"))
            .Options);
}
