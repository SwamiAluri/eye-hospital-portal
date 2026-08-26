using InventoryApi.Data;
using InventoryApi.Models.Entities;
using InventoryApi.Services;
using Microsoft.EntityFrameworkCore;
using Xunit;

namespace InventoryApi.Tests.Services;

public class ConsignmentStockTests
{
    [Fact]
    public async Task DeductFefo_PrefersConsignmentBatch()
    {
        await using var db = NewDb();
        var tenantId = Guid.NewGuid();
        var userId = Guid.NewGuid();
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
        var owned = new StockBatch
        {
            Id = Guid.NewGuid(), TenantId = tenantId, StoreId = store.Id, ItemId = item.Id,
            BatchNumber = "OWNED", PurchaseRate = 14000, QuantityIn = 2, QuantityAvailable = 2,
            IsActive = true, IsConsignment = false,
            CreatedAt = DateTime.UtcNow, UpdatedAt = DateTime.UtcNow, Status = "active",
        };
        var consignment = new StockBatch
        {
            Id = Guid.NewGuid(), TenantId = tenantId, StoreId = store.Id, ItemId = item.Id,
            BatchNumber = "CONS", PurchaseRate = 0, QuantityIn = 2, QuantityAvailable = 2,
            IsActive = true, IsConsignment = true,
            CreatedAt = DateTime.UtcNow.AddMinutes(1), UpdatedAt = DateTime.UtcNow, Status = "active",
        };
        db.Stores.Add(store);
        db.Items.Add(item);
        db.StockBatches.AddRange(owned, consignment);
        await db.SaveChangesAsync();

        var stock = new StockService(db);
        var picked = await stock.DeductFefoAsync(
            tenantId, store.Id, item.Id, 1, userId, "OT_ISSUE", Guid.NewGuid().ToString("D"), "serial", CancellationToken.None);
        await db.SaveChangesAsync();

        Assert.Equal(consignment.Id, picked.Id);
        Assert.Equal(1m, (await db.StockBatches.AsNoTracking().SingleAsync(b => b.Id == consignment.Id)).QuantityAvailable);
        Assert.Equal(2m, (await db.StockBatches.AsNoTracking().SingleAsync(b => b.Id == owned.Id)).QuantityAvailable);
    }

    private static InventoryDbContext NewDb() => new(
        new DbContextOptionsBuilder<InventoryDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString("N"))
            .Options);
}
