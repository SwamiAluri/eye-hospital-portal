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
/// B5.1 — S-14 Replay must not mark Resolved/Posted unless an opd_bill_items row exists.
/// </summary>
public class ChargeMappingReplayTests
{
    private static readonly Guid TenantId = Guid.NewGuid();
    private static readonly Guid UserId = Guid.NewGuid();

    [Fact]
    public async Task Replay_NullOpdBillId_LeavesOpen_DoesNotPost()
    {
        var db = new Store();
        var itemId = await db.SeedMappedItemAsync(14000m);
        var exceptionId = await db.SeedExceptionAsync(itemId, opdBillId: null, journeyId: null);

        var result = await db.Admin().ReplayAsync(TenantId, UserId);

        Assert.Equal(0, result.Posted);
        Assert.Equal(1, result.BlockedNoBill);
        Assert.Equal(0, await db.Context.OpdBillItems.CountAsync());
        var row = await db.Context.ChargeExceptions.SingleAsync(e => e.Id == exceptionId);
        Assert.Equal(ChargeExceptionStatus.Open, row.Status);
        Assert.Null(row.ResolvedAt);
        Assert.Contains("no OpdBill", row.Reason);
    }

    [Fact]
    public async Task Replay_FakeAddBillItemDto_WithoutLedgerRow_LeavesOpen()
    {
        var db = new Store();
        var bill = await db.SeedBillAsync();
        var itemId = await db.SeedMappedItemAsync(14000m);
        var exceptionId = await db.SeedExceptionAsync(itemId, bill.Id, journeyId: null);

        var bills = new Mock<IBillItemService>();
        bills.Setup(s => s.AddBillItemAsync(It.IsAny<AddBillItemRequest>(), TenantId, UserId))
            .ReturnsAsync(new BillItemDto
            {
                Id = Guid.NewGuid(),
                OpdBillId = bill.Id,
                ServiceName = "ghost",
                TotalAmount = 14000m,
            });
        var admin = new ChargeMappingAdminService(db.Context, db.Resolver(), bills.Object);

        var result = await admin.ReplayAsync(TenantId, UserId);

        Assert.Equal(0, result.Posted);
        Assert.Equal(1, result.BlockedNoBill);
        Assert.Equal(0, await db.Context.OpdBillItems.CountAsync());
        var row = await db.Context.ChargeExceptions.SingleAsync(e => e.Id == exceptionId);
        Assert.Equal(ChargeExceptionStatus.Open, row.Status);
        Assert.Null(row.ResolvedAt);
    }

    [Fact]
    public async Task Replay_OpenBill_PostsVerifiedLine_ThenResolved()
    {
        var db = new Store();
        var bill = await db.SeedBillAsync();
        var itemId = await db.SeedMappedItemAsync(14000m);
        var exceptionId = await db.SeedExceptionAsync(itemId, bill.Id, journeyId: null, sourceRefId: Guid.NewGuid());

        var result = await db.Admin().ReplayAsync(TenantId, UserId);

        Assert.Equal(1, result.Posted);
        Assert.Equal(0, result.BlockedNoBill);
        var line = Assert.Single(await db.Context.OpdBillItems.ToListAsync());
        Assert.Equal(bill.Id, line.OpdBillId);
        Assert.Equal(BillChargeSource.Implant, line.SourceType);
        var row = await db.Context.ChargeExceptions.SingleAsync(e => e.Id == exceptionId);
        Assert.Equal(ChargeExceptionStatus.Resolved, row.Status);
        Assert.NotNull(row.ResolvedAt);
        Assert.Equal(bill.Id, row.OpdBillId);
    }

    [Fact]
    public async Task Replay_NullOpdBillId_ResolvesViaJourneyBill()
    {
        var db = new Store();
        var journeyId = Guid.NewGuid();
        var bill = await db.SeedBillAsync(journeyId);
        var itemId = await db.SeedMappedItemAsync(3200m);
        var exceptionId = await db.SeedExceptionAsync(itemId, opdBillId: null, journeyId);

        var result = await db.Admin().ReplayAsync(TenantId, UserId);

        Assert.Equal(1, result.Posted);
        Assert.Equal(0, result.BlockedNoBill);
        Assert.Equal(1, await db.Context.OpdBillItems.CountAsync());
        var row = await db.Context.ChargeExceptions.SingleAsync(e => e.Id == exceptionId);
        Assert.Equal(ChargeExceptionStatus.Resolved, row.Status);
        Assert.Equal(bill.Id, row.OpdBillId);
    }

    [Fact]
    public async Task Replay_FinalizedBill_NeedsAdjustment_NoLine()
    {
        var db = new Store();
        var bill = await db.SeedBillAsync();
        bill.IsFinalized = true;
        await db.Context.SaveChangesAsync();
        var itemId = await db.SeedMappedItemAsync(14000m);
        var exceptionId = await db.SeedExceptionAsync(itemId, bill.Id, journeyId: null);

        var result = await db.Admin().ReplayAsync(TenantId, UserId);

        Assert.Equal(0, result.Posted);
        Assert.Equal(1, result.NeedsAdjustment);
        Assert.Equal(0, await db.Context.OpdBillItems.CountAsync());
        var row = await db.Context.ChargeExceptions.SingleAsync(e => e.Id == exceptionId);
        Assert.Equal(ChargeExceptionStatus.NeedsAdjustment, row.Status);
        Assert.NotEqual(ChargeExceptionStatus.Resolved, row.Status);
    }

    [Fact]
    public async Task Replay_IdempotentExistingLine_MarksResolved_DoesNotDuplicate()
    {
        var db = new Store();
        var bill = await db.SeedBillAsync();
        var itemId = await db.SeedMappedItemAsync(14000m);
        var sourceRef = Guid.NewGuid();
        var key = $"ImplantUsed:{sourceRef:N}:Implant:{sourceRef:N}";
        var exceptionId = await db.SeedExceptionAsync(itemId, bill.Id, journeyId: null, sourceRef, key);

        var first = await db.Admin().ReplayAsync(TenantId, UserId);
        Assert.Equal(1, first.Posted);

        db.Context.ChargeExceptions.Single(e => e.Id == exceptionId).Status = ChargeExceptionStatus.Open;
        db.Context.ChargeExceptions.Single(e => e.Id == exceptionId).ResolvedAt = null;
        await db.Context.SaveChangesAsync();

        var second = await db.Admin().ReplayAsync(TenantId, UserId);
        Assert.Equal(1, second.Posted);
        Assert.Equal(1, await db.Context.OpdBillItems.CountAsync(i => i.DeletedAt == null));
        Assert.Equal(ChargeExceptionStatus.Resolved,
            (await db.Context.ChargeExceptions.SingleAsync(e => e.Id == exceptionId)).Status);
    }

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

        private AppDbContext NewContext() => new(
            new DbContextOptionsBuilder<AppDbContext>().UseInMemoryDatabase(_name).Options,
            _http);

        public ChargeCatalogResolver Resolver() => new(Context);

        public ChargeMappingAdminService Admin() =>
            new(Context, Resolver(), new BillItemService(Context, NullLogger<BillItemService>.Instance));

        public async Task<Guid> SeedMappedItemAsync(decimal amount)
        {
            var variantId = Guid.NewGuid();
            var itemId = Guid.NewGuid();
            Context.ServiceVariants.Add(new ServiceVariant
            {
                Id = variantId,
                CatalogServiceId = Guid.NewGuid(),
                VariantName = "SN60WF",
                VariantCode = "IOL-SN60WF",
                IsActive = true,
            });
            Context.VariantPrices.Add(new VariantPrice
            {
                Id = Guid.NewGuid(),
                VariantId = variantId,
                Amount = amount,
                IsActive = true,
                EffectiveFrom = DateOnly.FromDateTime(DateTime.UtcNow),
            });
            Context.ServiceVariantItemMaps.Add(new ServiceVariantItemMap
            {
                Id = Guid.NewGuid(),
                TenantId = TenantId,
                ItemId = itemId,
                ServiceVariantId = variantId,
                IsChargeable = true,
                EffectiveFrom = DateTime.UtcNow.AddDays(-1),
                CreatedAt = DateTime.UtcNow,
            });
            await Context.SaveChangesAsync();
            return itemId;
        }

        public async Task<OpdBill> SeedBillAsync(Guid? journeyId = null)
        {
            var bill = new OpdBill
            {
                Id = Guid.NewGuid(),
                TenantId = TenantId,
                BillNumber = "IP-B51-" + Guid.NewGuid().ToString("N")[..8],
                PatientId = Guid.NewGuid(),
                PatientJourneyId = journeyId,
                BranchId = Guid.NewGuid(),
                BillDate = DateTime.UtcNow,
                GrossAmount = 0,
                NetAmount = 0,
                BalanceDue = 0,
                Status = "generated",
                GeneratedBy = UserId,
                CreatedByUserId = UserId,
                CreatedAt = DateTime.UtcNow,
                RowVersion = 1,
            };
            Context.OpdBills.Add(bill);
            await Context.SaveChangesAsync();
            return bill;
        }

        public async Task<Guid> SeedExceptionAsync(
            Guid itemId,
            Guid? opdBillId,
            Guid? journeyId,
            Guid? sourceRefId = null,
            string? idempotencyKey = null)
        {
            var id = Guid.NewGuid();
            Context.ChargeExceptions.Add(new ChargeException
            {
                Id = id,
                TenantId = TenantId,
                ItemId = itemId,
                SourceType = BillChargeSource.Implant,
                SourceRefId = sourceRefId,
                OpdBillId = opdBillId,
                PatientJourneyId = journeyId,
                Quantity = 1,
                EstimatedValue = 14000m,
                Status = ChargeExceptionStatus.Open,
                Reason = "Unmapped",
                IdempotencyKey = idempotencyKey,
                CreatedAt = DateTime.UtcNow,
            });
            await Context.SaveChangesAsync();
            return id;
        }
    }
}
