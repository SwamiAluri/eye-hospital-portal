using AuthService.Context;
using AuthService.DTOs.Billing;
using AuthService.Models.Domain;
using AuthService.Services;
using AuthService.Services.Interfaces;
using Microsoft.AspNetCore.Http;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging.Abstractions;
using Moq;
using Xunit;

namespace AuthService.Tests;

/// <summary>
/// Step 14 — duplicate money writes replay; item delete/update keep header Gross/BalanceDue aligned.
/// </summary>
public class MoneyWriteIntegrityTests
{
    private static readonly Guid TenantId = Guid.NewGuid();
    private static readonly Guid UserId = Guid.NewGuid();

    [Fact]
    public async Task ApplyDiscount_SameKey_DoesNotPostSecondLine()
    {
        var db = new Store();
        var bill = await db.SeedBillAsync();
        var request = new ApplyDiscountDto
        {
            OpdBillId = bill.Id,
            DiscountPercentage = 10,
            DiscountReason = "Staff family",
            IdempotencyKey = "disc:retry-1",
        };

        await db.Bills().ApplyDiscountAsync(request, UserId);
        await db.Bills().ApplyDiscountAsync(request, UserId);

        using var check = db.Reader();
        Assert.Equal(1, await check.OpdBillPayments.CountAsync());
        var updated = await check.OpdBills.SingleAsync();
        Assert.Equal(10_000m, updated.DiscountAmount);
        Assert.Equal(90_000m, updated.NetAmount);
        Assert.Equal(90_000m, updated.BalanceDue);
    }

    [Fact]
    public async Task ApplyDiscount_SamePercentAndReasonWithoutKey_IsIdempotent()
    {
        var db = new Store();
        var bill = await db.SeedBillAsync();
        var request = new ApplyDiscountDto
        {
            OpdBillId = bill.Id,
            DiscountPercentage = 10,
            DiscountReason = "Staff family",
        };

        await db.Bills().ApplyDiscountAsync(request, UserId);
        await db.Bills().ApplyDiscountAsync(request, UserId);

        using var check = db.Reader();
        Assert.Equal(1, await check.OpdBillPayments.CountAsync());
    }

    [Fact]
    public async Task ReversePayment_SecondCall_DoesNotDoubleReverse()
    {
        var db = new Store();
        var bill = await db.SeedBillAsync();
        await db.Bills().AddPaymentAsync(new AddPaymentDto
        {
            OpdBillId = bill.Id,
            PaymentMode = "cash",
            Amount = 5_000m,
            IdempotencyKey = "pay-1",
        }, UserId);

        var paymentId = await db.Reader().OpdBillPayments.Select(p => p.Id).SingleAsync();
        var reverse = new ReversePaymentRequest
        {
            OpdBillId = bill.Id,
            OriginalPaymentId = paymentId,
            Reason = "cashier error",
        };

        await db.Bills().ReversePaymentAsync(reverse, UserId);
        await db.Bills().ReversePaymentAsync(reverse, UserId);

        using var check = db.Reader();
        Assert.Equal(2, await check.OpdBillPayments.CountAsync());
        Assert.Equal(0m, (await check.OpdBills.SingleAsync()).AmountPaid);
        Assert.Equal(100_000m, (await check.OpdBills.SingleAsync()).BalanceDue);
    }

    [Fact]
    public async Task DeleteBillItem_DecrementsGrossAndBalanceDue()
    {
        var db = new Store();
        var bill = await db.SeedBillAsync();
        var items = db.Items();
        var added = await items.AddBillItemAsync(
            NamedLine(bill.Id, "Capsular tension ring", 3_200m, "billitem:ctr:1"),
            TenantId, UserId);

        Assert.True(await items.DeleteBillItemAsync(added.Id, TenantId, UserId));

        using var check = db.Reader();
        var updated = await check.OpdBills.SingleAsync();
        Assert.Equal(100_000m, updated.GrossAmount);
        Assert.Equal(100_000m, updated.NetAmount);
        Assert.Equal(100_000m, updated.BalanceDue);
        Assert.Equal(1, await check.OpdBillItems.CountAsync(i => i.DeletedAt != null));
    }

    [Fact]
    public async Task UpdateBillItem_AdjustsGrossByDelta()
    {
        var db = new Store();
        var bill = await db.SeedBillAsync();
        var items = db.Items();
        var added = await items.AddBillItemAsync(
            NamedLine(bill.Id, "Viscoelastic", 1_000m, "billitem:visc:1"),
            TenantId, UserId);

        await items.UpdateBillItemAsync(added.Id, new UpdateBillItemRequest
        {
            Quantity = 2,
            DiscountPercentage = 0,
        }, TenantId, UserId);

        using var check = db.Reader();
        var updated = await check.OpdBills.SingleAsync();
        Assert.Equal(102_000m, updated.GrossAmount);
        Assert.Equal(102_000m, updated.BalanceDue);
    }

    [Fact]
    public async Task DeleteBillItem_AfterDiscount_KeepsDiscountLineAndReprojectsHeader()
    {
        var db = new Store();
        var bill = await db.SeedBillAsync();
        await db.Bills().ApplyDiscountAsync(new ApplyDiscountDto
        {
            OpdBillId = bill.Id,
            DiscountPercentage = 10,
            DiscountReason = "Staff family",
            IdempotencyKey = "disc:combo-delete",
        }, UserId);

        var items = db.Items();
        var added = await items.AddBillItemAsync(
            NamedLine(bill.Id, "Capsular tension ring", 3_200m, "billitem:ctr:combo"),
            TenantId, UserId);

        Assert.True(await items.DeleteBillItemAsync(added.Id, TenantId, UserId));

        using var check = db.Reader();
        var updated = await check.OpdBills.SingleAsync();
        Assert.Equal(100_000m, updated.GrossAmount);
        Assert.Equal(10_000m, updated.DiscountAmount);
        Assert.Equal(90_000m, updated.NetAmount);
        Assert.Equal(90_000m, updated.BalanceDue);
        Assert.Equal(1, await check.OpdBillPayments.CountAsync());
        Assert.Equal(1, await check.OpdBillItems.CountAsync(i => i.DeletedAt != null));
    }

    [Fact]
    public async Task UpdateBillItem_AfterDiscount_AdjustsGrossKeepsDiscount()
    {
        var db = new Store();
        var bill = await db.SeedBillAsync();
        await db.Bills().ApplyDiscountAsync(new ApplyDiscountDto
        {
            OpdBillId = bill.Id,
            DiscountPercentage = 10,
            DiscountReason = "Staff family",
            IdempotencyKey = "disc:combo-update",
        }, UserId);

        var items = db.Items();
        var added = await items.AddBillItemAsync(
            NamedLine(bill.Id, "Viscoelastic", 1_000m, "billitem:visc:combo"),
            TenantId, UserId);

        await items.UpdateBillItemAsync(added.Id, new UpdateBillItemRequest
        {
            Quantity = 2,
            DiscountPercentage = 0,
        }, TenantId, UserId);

        using var check = db.Reader();
        var updated = await check.OpdBills.SingleAsync();
        Assert.Equal(102_000m, updated.GrossAmount);
        Assert.Equal(10_000m, updated.DiscountAmount);
        Assert.Equal(92_000m, updated.NetAmount);
        Assert.Equal(92_000m, updated.BalanceDue);
        Assert.Equal(1, await check.OpdBillPayments.CountAsync());
    }

    private static AddBillItemRequest NamedLine(Guid billId, string name, decimal price, string key)
        => new()
        {
            OpdBillId = billId,
            ServiceName = name,
            UnitPriceOverride = price,
            Quantity = 1,
            SourceType = "Manual",
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
            Audit = new Mock<IAuditService>();
            Audit.Setup(a => a.StageAsync(
                    It.IsAny<Guid>(), It.IsAny<string>(), It.IsAny<string>(), It.IsAny<Guid?>(),
                    It.IsAny<string?>(), It.IsAny<string?>(), It.IsAny<string?>()))
                .Returns(Task.CompletedTask);
        }

        public AppDbContext Context { get; }
        public Mock<IAuditService> Audit { get; }

        public AppDbContext NewContext() => new(
            new DbContextOptionsBuilder<AppDbContext>().UseInMemoryDatabase(_name).Options,
            _http);

        public AppDbContext Reader() => NewContext();

        public OpdBillService Bills() => new(
            Context,
            NullLogger<OpdBillService>.Instance,
            new NoOpOutbox(),
            notifications: null,
            audit: Audit.Object,
            http: _http);

        public BillItemService Items() => new(Context, NullLogger<BillItemService>.Instance);

        public async Task<OpdBill> SeedBillAsync()
        {
            var bill = new OpdBill
            {
                Id = Guid.NewGuid(),
                TenantId = TenantId,
                BillNumber = "IP-STEP14-0001",
                PatientId = Guid.NewGuid(),
                BranchId = Guid.NewGuid(),
                BillDate = DateTime.UtcNow,
                GrossAmount = 100_000m,
                NetAmount = 100_000m,
                BalanceDue = 100_000m,
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

    private sealed class NoOpOutbox : IBillingCcmsOutboxService
    {
        public void Enqueue(Guid tenantId, string eventType, Guid billId, object payload, string idempotencyKey) { }
        public Task EnsureSchemaAsync(CancellationToken ct = default) => Task.CompletedTask;
        public Task<int> ProcessPendingAsync(int batchSize = 25, CancellationToken ct = default) => Task.FromResult(0);
    }
}
