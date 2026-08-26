using AuthService.Context;
using AuthService.DTOs.Billing;
using AuthService.Models.Domain;
using AuthService.Services;
using Microsoft.AspNetCore.Http;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging.Abstractions;
using Moq;
using Xunit;

namespace AuthService.Tests;

/// <summary>BILL-030 — duplicate automated charges are a no-op; concurrent bill writes 409.</summary>
public class BillItemIdempotencyTests
{
    private static readonly Guid TenantId = Guid.NewGuid();
    private static readonly Guid UserId = Guid.NewGuid();

    [Fact]
    public async Task DuplicateIdempotencyKey_ReturnsExistingLine()
    {
        var db = new Store();
        var bill = await db.SeedBillAsync();
        var service = db.Items();

        var request = NamedLine(bill.Id, "Phaco surgery", 62000m, "Package", "Package:j1:t1:c1");
        var first = await service.AddBillItemAsync(request, TenantId, UserId);
        var second = await service.AddBillItemAsync(request, TenantId, UserId);

        Assert.Equal(first.Id, second.Id);
        using var check = db.Reader();
        Assert.Equal(1, await check.OpdBillItems.CountAsync());
    }

    [Fact]
    public async Task DifferentKeys_InsertTwoLines()
    {
        var db = new Store();
        var bill = await db.SeedBillAsync();
        var service = db.Items();

        await service.AddBillItemAsync(
            NamedLine(bill.Id, "Phaco surgery", 62000m, "Package", "Package:j1:t1:c1"),
            TenantId, UserId);
        await service.AddBillItemAsync(
            NamedLine(bill.Id, "OT charges", 12000m, "Package", "Package:j1:t1:c2"),
            TenantId, UserId);

        using var check = db.Reader();
        Assert.Equal(2, await check.OpdBillItems.CountAsync());
    }

    [Fact]
    public async Task MissingSourceType_DefaultsToManual()
    {
        var db = new Store();
        var bill = await db.SeedBillAsync();
        var dto = await db.Items().AddBillItemAsync(
            NamedLine(bill.Id, "Walk-in add-on", 500m, sourceType: null, key: null),
            TenantId, UserId);

        Assert.Equal(BillChargeSource.Manual, dto.SourceType);
        Assert.Equal("Walk-in add-on", dto.ServiceName);
    }

    [Fact]
    public async Task AddBillItem_IncrementsGrossAndBalanceDue()
    {
        var db = new Store();
        var bill = await db.SeedBillAsync();
        var service = db.Items();

        await service.AddBillItemAsync(
            NamedLine(bill.Id, "Capsular tension ring", 3200m, "Manual", "billitem:ctr:1"),
            TenantId, UserId);
        await service.AddBillItemAsync(
            NamedLine(bill.Id, "Capsular tension ring", 3200m, "Manual", "billitem:ctr:1"),
            TenantId, UserId);

        using var check = db.Reader();
        var updated = await check.OpdBills.SingleAsync(b => b.Id == bill.Id);
        Assert.Equal(103200m, updated.GrossAmount);
        Assert.Equal(103200m, updated.NetAmount);
        Assert.Equal(103200m, updated.BalanceDue);
    }

    [Fact]
    public async Task AddBillItem_RejectsFinalizedBill()
    {
        var db = new Store();
        var bill = await db.SeedBillAsync();
        await using (var ctx = db.NewContext())
        {
            var row = await ctx.OpdBills.SingleAsync(b => b.Id == bill.Id);
            row.IsFinalized = true;
            await ctx.SaveChangesAsync();
        }

        var ex = await Assert.ThrowsAsync<InvalidOperationException>(() =>
            db.Items().AddBillItemAsync(
                NamedLine(bill.Id, "Walk-in add-on", 500m, "Manual", "billitem:final:1"),
                TenantId, UserId));
        Assert.Contains("finalized", ex.Message, StringComparison.OrdinalIgnoreCase);
    }

    [Fact]
    public async Task ConcurrentBillUpdate_ThrowsStaleMessage()
    {
        var db = new Store();
        var seeded = await db.SeedBillAsync();

        await using var ctxA = db.NewContext();
        await using var ctxB = db.NewContext();
        var billA = await ctxA.OpdBills.SingleAsync(b => b.Id == seeded.Id);
        var billB = await ctxB.OpdBills.SingleAsync(b => b.Id == seeded.Id);
        Assert.Equal(1, billA.RowVersion);
        Assert.Equal(1, billB.RowVersion);

        billA.Notes = "cashier-a";
        await ctxA.SaveChangesAsync();
        Assert.Equal(2, billA.RowVersion);

        billB.Notes = "cashier-b";
        var ex = await Assert.ThrowsAsync<InvalidOperationException>(() => ctxB.SaveChangesAsync());
        Assert.Equal(BillConcurrency.StaleMessage, ex.Message);

        await using var check = db.NewContext();
        Assert.Equal("cashier-a", (await check.OpdBills.SingleAsync()).Notes);
    }

    private static AddBillItemRequest NamedLine(
        Guid billId, string name, decimal price, string? sourceType, string? key)
        => new()
        {
            OpdBillId = billId,
            ServiceName = name,
            UnitPriceOverride = price,
            Quantity = 1,
            SourceType = sourceType,
            IdempotencyKey = key,
        };

    private sealed class Store
    {
        private readonly string _name = Guid.NewGuid().ToString();
        private readonly IHttpContextAccessor _http;

        public Store()
        {
            var accessor = new Mock<IHttpContextAccessor>();
            var http = new DefaultHttpContext();
            http.Items["TenantId"] = TenantId;
            accessor.Setup(a => a.HttpContext).Returns(http);
            _http = accessor.Object;
            Context = NewContext();
        }

        public AppDbContext Context { get; }

        public AppDbContext NewContext() => new(
            new DbContextOptionsBuilder<AppDbContext>().UseInMemoryDatabase(_name).Options,
            _http);

        public AppDbContext Reader() => NewContext();

        public BillItemService Items() => new(Context, NullLogger<BillItemService>.Instance);

        public async Task<OpdBill> SeedBillAsync()
        {
            var bill = new OpdBill
            {
                Id = Guid.NewGuid(),
                TenantId = TenantId,
                BillNumber = "IP-BILL-030-0001",
                PatientId = Guid.NewGuid(),
                BranchId = Guid.NewGuid(),
                BillDate = DateTime.UtcNow,
                GrossAmount = 100000m,
                NetAmount = 100000m,
                BalanceDue = 100000m,
                Status = "generated",
                GeneratedBy = UserId,
                CreatedByUserId = UserId,
                CreatedAt = DateTime.UtcNow,
                RowVersion = 1,
            };
            Context.OpdBills.Add(bill);
            await Context.SaveChangesAsync();
            Context.ChangeTracker.Clear();
            return bill;
        }
    }
}
