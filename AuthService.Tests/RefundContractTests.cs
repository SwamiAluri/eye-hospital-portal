using System;
using System.Linq;
using System.Reflection;
using System.Threading.Tasks;
using AuthService.Context;
using AuthService.Controllers;
using AuthService.Models.Domain;
using AuthService.Services;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging.Abstractions;
using Moq;
using Xunit;

namespace AuthService.Tests;

public class RefundContractTests
{
    private static readonly Guid TenantId = Guid.NewGuid();
    private static readonly Guid UserId = Guid.NewGuid();
    private static readonly Guid BillId = Guid.NewGuid();

    [Fact]
    public void PortalAliases_ResolveToBillIdAmountReason()
    {
        var request = new RefundRequest
        {
            OpdBillId = BillId,
            RefundAmount = 250m,
            RefundReason = " Duplicate payment ",
        };

        Assert.True(request.TryResolve(out var billId, out var amount, out var reason, out var error));
        Assert.Equal(BillId, billId);
        Assert.Equal(250m, amount);
        Assert.Equal("Duplicate payment", reason);
        Assert.Equal(string.Empty, error);
    }

    [Fact]
    public void LegacyBillIdAmountReason_StillBinds()
    {
        var request = new RefundRequest
        {
            BillId = BillId,
            Amount = 100m,
            Reason = "Staff error",
        };

        Assert.True(request.TryResolve(out var billId, out var amount, out var reason, out _));
        Assert.Equal(BillId, billId);
        Assert.Equal(100m, amount);
        Assert.Equal("Staff error", reason);
    }

    [Fact]
    public void EmptyBillId_IsRejected()
    {
        var request = new RefundRequest { RefundAmount = 10m, RefundReason = "x" };
        Assert.False(request.TryResolve(out _, out _, out _, out var error));
        Assert.Contains("opdBillId", error, StringComparison.OrdinalIgnoreCase);
    }

    [Fact]
    public void ConflictingIds_AreRejected()
    {
        var request = new RefundRequest
        {
            BillId = Guid.NewGuid(),
            OpdBillId = Guid.NewGuid(),
            RefundAmount = 10m,
            RefundReason = "x",
        };
        Assert.False(request.TryResolve(out _, out _, out _, out var error));
        Assert.Contains("same OpdBill", error, StringComparison.OrdinalIgnoreCase);
    }

    [Fact]
    public void DenialReason_MapsToAuthorizeNotes()
    {
        var request = new RefundAuthorizationRequest { Approved = false, DenialReason = " Missing receipt " };
        Assert.Equal("Missing receipt", request.ResolvedNotes());
    }

    [Fact]
    public void AuthorizeAndComplete_UseIdInRoute()
    {
        var authorize = typeof(RefundsController).GetMethod(nameof(RefundsController.AuthorizeRefund));
        var complete = typeof(RefundsController).GetMethod(nameof(RefundsController.CompleteRefund));
        Assert.Equal("{id:guid}/authorize", authorize!.GetCustomAttribute<HttpPostAttribute>()!.Template);
        Assert.Equal("{id:guid}/complete", complete!.GetCustomAttribute<HttpPostAttribute>()!.Template);
    }

    [Fact]
    public async Task Request_WithOpdBillId_CreatesPendingRefund()
    {
        var db = new Store();
        var bill = await db.SeedPaidBillAsync();
        var service = db.Refunds();

        var refund = await service.RequestRefundAsync(bill.Id, 400m, "Duplicate payment", UserId, "cash", "desk");

        Assert.Equal("pending", refund.Status);
        Assert.Equal(400m, refund.RefundAmount);
        Assert.Equal("cash", refund.RefundMode);
        using var check = db.Reader();
        var stored = await check.Refunds.SingleAsync();
        Assert.Equal(bill.Id, stored.BillId);
        Assert.Equal("requested", (await check.OpdBills.SingleAsync()).RefundStatus);
    }

    [Fact]
    public async Task Request_RejectsCancelledBill()
    {
        var db = new Store();
        var bill = await db.SeedPaidBillAsync("cancelled");
        var ex = await Assert.ThrowsAsync<InvalidOperationException>(
            () => db.Refunds().RequestRefundAsync(bill.Id, 100m, "Duplicate payment", UserId));
        Assert.Contains("cancelled", ex.Message, StringComparison.OrdinalIgnoreCase);
    }

    [Fact]
    public async Task Request_RejectsWhenOutstandingWouldExceedPaid()
    {
        var db = new Store();
        var bill = await db.SeedPaidBillAsync();
        await db.Refunds().RequestRefundAsync(bill.Id, 800m, "First request", UserId);
        db.Context.ChangeTracker.Clear();

        var ex = await Assert.ThrowsAsync<InvalidOperationException>(
            () => db.Refunds().RequestRefundAsync(bill.Id, 300m, "Second request", UserId));
        Assert.Contains("exceed", ex.Message, StringComparison.OrdinalIgnoreCase);
    }

    [Fact]
    public async Task Request_DoesNotSeeOtherTenantBill()
    {
        var db = new Store();
        var other = Guid.NewGuid();
        var bill = await db.SeedPaidBillAsync(tenantId: other);
        var ex = await Assert.ThrowsAsync<InvalidOperationException>(
            () => db.Refunds().RequestRefundAsync(bill.Id, 100m, "Duplicate payment", UserId));
        Assert.Contains("not found", ex.Message, StringComparison.OrdinalIgnoreCase);
    }

    [Fact]
    public async Task Request_WhenAmountPaidIsZero_IsFullyRefunded()
    {
        var db = new Store();
        var bill = await db.SeedPaidBillAsync();
        bill = await db.Context.OpdBills.SingleAsync();
        bill.AmountPaid = 0m;
        await db.Context.SaveChangesAsync();
        db.Context.ChangeTracker.Clear();

        var ex = await Assert.ThrowsAsync<InvalidOperationException>(
            () => db.Refunds().RequestRefundAsync(bill.Id, 1m, "Duplicate payment", UserId));
        Assert.Contains("fully refunded", ex.Message, StringComparison.OrdinalIgnoreCase);
    }

    [Fact]
    public async Task Reject_AfterCompletedPayout_DoesNotUnwindCompletedHeader()
    {
        var db = new Store();
        var bill = await db.SeedPaidBillWithLedgerAsync();
        var svc = db.Refunds();
        var first = await svc.RequestRefundAsync(bill.Id, 400m, "First", UserId);
        var second = await svc.RequestRefundAsync(bill.Id, 100m, "Duplicate retry", UserId);
        await svc.AuthorizeRefundAsync(first.Id, true, UserId, "ok");
        await svc.CompleteRefundAsync(first.Id, "cash");
        db.Context.ChangeTracker.Clear();

        await db.Refunds().AuthorizeRefundAsync(second.Id, false, UserId, "duplicate");

        using var check = db.Reader();
        Assert.Equal("completed", (await check.OpdBills.SingleAsync()).RefundStatus);
        Assert.Equal(400m, (await check.OpdBills.SingleAsync()).RefundAmount);
        Assert.Equal("rejected", (await check.Refunds.SingleAsync(r => r.Id == second.Id)).Status);
        Assert.Equal(1, await check.OpdBillPayments.CountAsync(p => p.PaymentKind == "Refund"));
    }

    [Fact]
    public async Task Complete_SecondCall_DoesNotPostASecondLedgerLine()
    {
        var db = new Store();
        var bill = await db.SeedPaidBillWithLedgerAsync();
        var svc = db.Refunds();
        var refund = await svc.RequestRefundAsync(bill.Id, 250m, "Duplicate payment", UserId);
        await svc.AuthorizeRefundAsync(refund.Id, true, UserId);
        await svc.CompleteRefundAsync(refund.Id, "cash");
        await svc.CompleteRefundAsync(refund.Id, "cash");

        using var check = db.Reader();
        Assert.Equal(1, await check.OpdBillPayments.CountAsync(p => p.PaymentKind == "Refund"));
        Assert.Equal("completed", (await check.Refunds.SingleAsync()).Status);
        Assert.Equal("completed", (await check.OpdBills.SingleAsync()).RefundStatus);
        Assert.Equal(250m, (await check.OpdBills.SingleAsync()).RefundAmount);
    }

    [Fact]
    public async Task Complete_Replay_HealsStaleRejectedHeaderWithoutSecondLedgerLine()
    {
        var db = new Store();
        var bill = await db.SeedPaidBillWithLedgerAsync();
        var svc = db.Refunds();
        var first = await svc.RequestRefundAsync(bill.Id, 400m, "First", UserId);
        var second = await svc.RequestRefundAsync(bill.Id, 100m, "Duplicate retry", UserId);
        await svc.AuthorizeRefundAsync(first.Id, true, UserId, "ok");
        await svc.CompleteRefundAsync(first.Id, "cash");
        await svc.AuthorizeRefundAsync(second.Id, false, UserId, "duplicate");

        var header = await db.Context.OpdBills.SingleAsync();
        header.RefundStatus = "rejected";
        header.RefundAmount = 100m;
        await db.Context.SaveChangesAsync();
        db.Context.ChangeTracker.Clear();

        await db.Refunds().CompleteRefundAsync(first.Id, "cash");

        using var check = db.Reader();
        Assert.Equal("completed", (await check.OpdBills.SingleAsync()).RefundStatus);
        Assert.Equal(400m, (await check.OpdBills.SingleAsync()).RefundAmount);
        Assert.Equal(1, await check.OpdBillPayments.CountAsync(p => p.PaymentKind == "Refund"));
    }

    [Fact]
    public async Task Request_AllowsFurtherPartialAfterCompletedWhenPaidRemains()
    {
        var db = new Store();
        var bill = await db.SeedPaidBillWithLedgerAsync();
        var svc = db.Refunds();
        var first = await svc.RequestRefundAsync(bill.Id, 400m, "Partial", UserId);
        await svc.AuthorizeRefundAsync(first.Id, true, UserId);
        await svc.CompleteRefundAsync(first.Id, "cash");
        db.Context.ChangeTracker.Clear();

        var second = await db.Refunds().RequestRefundAsync(bill.Id, 200m, "Remaining", UserId);
        Assert.Equal("pending", second.Status);
        using var check = db.Reader();
        Assert.Equal("requested", (await check.OpdBills.SingleAsync()).RefundStatus);
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

        public AppDbContext NewContext() => new(
            new DbContextOptionsBuilder<AppDbContext>().UseInMemoryDatabase(_name).Options,
            _http);

        public AppDbContext Reader() => NewContext();

        public RefundService Refunds()
        {
            var audit = new Mock<IAuditService>();
            audit.Setup(a => a.StageAsync(
                    It.IsAny<Guid>(), It.IsAny<string>(), It.IsAny<string>(), It.IsAny<Guid?>(),
                    It.IsAny<string?>(), It.IsAny<string?>(), It.IsAny<string?>()))
                .Returns(Task.CompletedTask);
            return new RefundService(
                Context,
                NullLogger<RefundService>.Instance,
                new OpdBillService(
                    Context,
                    NullLogger<OpdBillService>.Instance,
                    new NoOpCcmsOutbox(),
                    audit: audit.Object,
                    http: _http),
                audit.Object,
                _http);
        }

        public async Task<OpdBill> SeedPaidBillAsync(string status = "paid", Guid? tenantId = null)
        {
            var bill = new OpdBill
            {
                Id = Guid.NewGuid(),
                TenantId = tenantId ?? TenantId,
                BillNumber = "OPD-REF-0001",
                PatientId = Guid.NewGuid(),
                BranchId = Guid.NewGuid(),
                BillDate = DateTime.UtcNow,
                GrossAmount = 1000m,
                NetAmount = 1000m,
                AmountPaid = 1000m,
                BalanceDue = 0m,
                Status = status,
                RefundStatus = "none",
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

        public async Task<OpdBill> SeedPaidBillWithLedgerAsync()
        {
            var bill = await SeedPaidBillAsync();
            Context.OpdBillPayments.Add(new OpdBillPayment
            {
                Id = Guid.NewGuid(),
                TenantId = bill.TenantId,
                OpdBillId = bill.Id,
                PaymentReference = $"PAY-{Guid.NewGuid():N}"[..20],
                PaymentMode = "cash",
                Amount = 1000m,
                PaymentKind = OpdBillLedgerCalculator.Payment,
                Status = "completed",
                PaymentDate = DateTime.UtcNow,
                CreatedAt = DateTime.UtcNow,
                CreatedByUserId = UserId,
            });
            await Context.SaveChangesAsync();
            Context.ChangeTracker.Clear();
            return await Context.OpdBills.SingleAsync(b => b.Id == bill.Id);
        }
    }

    private sealed class NoOpCcmsOutbox : IBillingCcmsOutboxService
    {
        public void Enqueue(Guid tenantId, string eventType, Guid billId, object payload, string idempotencyKey) { }

        public Task EnsureSchemaAsync(CancellationToken ct = default) => Task.CompletedTask;

        public Task<int> ProcessPendingAsync(int batchSize = 25, CancellationToken ct = default) => Task.FromResult(0);
    }
}
