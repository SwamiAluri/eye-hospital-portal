using System;
using System.Linq;
using System.Reflection;
using System.Threading;
using System.Threading.Tasks;
using AuthService.Authorization;
using AuthService.Context;
using AuthService.Controllers;
using AuthService.DTOs.Billing;
using AuthService.Models.Domain;
using AuthService.Services;
using Microsoft.AspNetCore.Http;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging.Abstractions;
using Moq;
using Xunit;

namespace AuthService.Tests;

/// <summary>
/// SEC-042. Two guarantees:
/// 1. Billing rule configuration is behind bill.admin, not merely authenticated.
/// 2. A financial mutation that cannot be audited does not happen at all.
/// </summary>
public class FinancialAuditFailClosedTests
{
    private static readonly Guid TenantId = Guid.NewGuid();
    private static readonly Guid UserId = Guid.NewGuid();

    // ---------- billing rules routes ----------

    [Theory]
    [InlineData(nameof(OpdBillsController.GetBillingRules))]
    [InlineData(nameof(OpdBillsController.CreateBillingRule))]
    [InlineData(nameof(OpdBillsController.UpdateBillingRule))]
    [InlineData(nameof(OpdBillsController.DeleteBillingRule))]
    public void BillingRuleRoutes_RequireBillAdmin(string methodName)
    {
        var method = typeof(OpdBillsController).GetMethod(methodName, BindingFlags.Public | BindingFlags.Instance);
        Assert.NotNull(method);

        var attribute = method!.GetCustomAttribute<RequirePermissionAttribute>();
        Assert.True(
            attribute is not null,
            $"{methodName} must be permission-gated; billing rules decide what every patient is charged.");
        Assert.Equal("bill.admin", attribute!.PermissionCode);
    }

    // ---------- audit fail-closed ----------

    [Fact]
    public async Task AddPayment_WhenAuditCannotBeStaged_RecordsNoPayment()
    {
        var db = new TestDb();
        db.Audit
            .Setup(a => a.StageAsync(
                It.IsAny<Guid>(), It.IsAny<string>(), It.IsAny<string>(), It.IsAny<Guid?>(),
                It.IsAny<string?>(), It.IsAny<string?>(), It.IsAny<string?>()))
            .ThrowsAsync(new InvalidOperationException("audit store unreachable"));

        var bill = await db.SeedBillAsync();

        await Assert.ThrowsAsync<InvalidOperationException>(
            () => db.Service().AddPaymentAsync(NewPayment(bill.Id, 500m), UserId));

        using var check = db.Reader();
        Assert.Empty(await check.OpdBillPayments.ToListAsync());
        Assert.Equal(0m, (await check.OpdBills.SingleAsync()).AmountPaid);
    }

    [Fact]
    public async Task AddPayment_WhenNoAuditServiceIsRegistered_RecordsNoPayment()
    {
        var db = new TestDb();
        var bill = await db.SeedBillAsync();

        await Assert.ThrowsAsync<InvalidOperationException>(
            () => db.Service(withAudit: false).AddPaymentAsync(NewPayment(bill.Id, 500m), UserId));

        using var check = db.Reader();
        Assert.Empty(await check.OpdBillPayments.ToListAsync());
    }

    [Fact]
    public async Task AddPayment_StagesAuditBeforeTheSaveThatCommitsTheMoney()
    {
        var db = new TestDb();
        var paymentsCommittedWhenAuditRan = -1;

        db.Audit
            .Setup(a => a.StageAsync(
                It.IsAny<Guid>(), It.IsAny<string>(), It.IsAny<string>(), It.IsAny<Guid?>(),
                It.IsAny<string?>(), It.IsAny<string?>(), It.IsAny<string?>()))
            .Callback(() =>
            {
                using var reader = db.Reader();
                paymentsCommittedWhenAuditRan = reader.OpdBillPayments.Count();
            })
            .Returns(Task.CompletedTask);

        var bill = await db.SeedBillAsync();
        await db.Service().AddPaymentAsync(NewPayment(bill.Id, 500m), UserId);

        Assert.Equal(0, paymentsCommittedWhenAuditRan);

        using var check = db.Reader();
        Assert.Single(await check.OpdBillPayments.ToListAsync());
        Assert.Equal(500m, (await check.OpdBills.SingleAsync()).AmountPaid);
    }

    [Fact]
    public async Task AddPayment_ProjectsAmountPaidFromInFlightLedgerLine()
    {
        var db = new TestDb();
        db.Audit
            .Setup(a => a.StageAsync(
                It.IsAny<Guid>(), It.IsAny<string>(), It.IsAny<string>(), It.IsAny<Guid?>(),
                It.IsAny<string?>(), It.IsAny<string?>(), It.IsAny<string?>()))
            .Returns(Task.CompletedTask);

        var bill = await db.SeedBillAsync();
        await db.Service().AddPaymentAsync(NewPayment(bill.Id, 400m), UserId);

        using var check = db.Reader();
        Assert.Equal(400m, (await check.OpdBills.SingleAsync()).AmountPaid);
        Assert.Equal(600m, (await check.OpdBills.SingleAsync()).BalanceDue);
        Assert.Equal("partially_paid", (await check.OpdBills.SingleAsync()).Status);
    }

    [Fact]
    public async Task AddPayment_ThatIsARetryDoesNotWriteASecondAudit()
    {
        var db = new TestDb();
        db.Audit
            .Setup(a => a.StageAsync(
                It.IsAny<Guid>(), It.IsAny<string>(), It.IsAny<string>(), It.IsAny<Guid?>(),
                It.IsAny<string?>(), It.IsAny<string?>(), It.IsAny<string?>()))
            .Returns(Task.CompletedTask);

        var bill = await db.SeedBillAsync();
        var service = db.Service();

        var request = NewPayment(bill.Id, 500m);
        request.IdempotencyKey = "receipt-retry-1";

        await service.AddPaymentAsync(request, UserId);
        await service.AddPaymentAsync(request, UserId);

        db.Audit.Verify(
            a => a.StageAsync(
                It.IsAny<Guid>(), It.IsAny<string>(), It.IsAny<string>(), It.IsAny<Guid?>(),
                It.IsAny<string?>(), It.IsAny<string?>(), It.IsAny<string?>()),
            Times.Once);
    }

    // ---------- AuditService staging semantics ----------

    [Fact]
    public async Task StageAsync_QueuesTheRowWithoutCommittingIt()
    {
        var db = new TestDb();
        var audit = new AuditService(db.Context, db.Http);

        await audit.StageAsync(UserId, "PaymentReceived", "OpdBill", Guid.NewGuid(), newValue: "500.00");

        using (var beforeSave = db.Reader())
        {
            Assert.Empty(await beforeSave.AuditLogs.ToListAsync());
        }

        await db.Context.SaveChangesAsync();

        using var afterSave = db.Reader();
        Assert.Single(await afterSave.AuditLogs.ToListAsync());
    }

    [Fact]
    public async Task LogAsync_StillCommitsOnItsOwnForNonFinancialCallers()
    {
        var db = new TestDb();
        var audit = new AuditService(db.Context, db.Http);

        await audit.LogAsync(UserId, "RoleChanged", "AppRole", Guid.NewGuid());

        using var check = db.Reader();
        Assert.Single(await check.AuditLogs.ToListAsync());
    }

    // ---------- helpers ----------

    private static AddPaymentDto NewPayment(Guid billId, decimal amount) => new()
    {
        OpdBillId = billId,
        PaymentMode = "cash",
        Amount = amount
    };

    /// <summary>
    /// One in-memory store, plus a way to read it through a clean change tracker so
    /// assertions see what was committed rather than what is merely staged.
    /// </summary>
    private sealed class TestDb
    {
        private readonly string _name = Guid.NewGuid().ToString();

        public TestDb()
        {
            Http = NewHttpAccessor();
            Context = NewContext();
            Audit = new Mock<IAuditService>();
        }

        public IHttpContextAccessor Http { get; }
        public AppDbContext Context { get; }
        public Mock<IAuditService> Audit { get; }

        public AppDbContext Reader() => NewContext();

        private AppDbContext NewContext() => new(
            new DbContextOptionsBuilder<AppDbContext>().UseInMemoryDatabase(_name).Options,
            Http);

        public OpdBillService Service(bool withAudit = true) => new(
            Context,
            NullLogger<OpdBillService>.Instance,
            new NoOpCcmsOutbox(),
            notifications: null,
            audit: withAudit ? Audit.Object : null,
            http: Http);

        public async Task<OpdBill> SeedBillAsync()
        {
            var bill = new OpdBill
            {
                Id = Guid.NewGuid(),
                TenantId = TenantId,
                BillNumber = "OPD-TEST-0001",
                PatientId = Guid.NewGuid(),
                BranchId = Guid.NewGuid(),
                BillDate = DateTime.UtcNow,
                ConsultationFee = 1000m,
                GrossAmount = 1000m,
                NetAmount = 1000m,
                BalanceDue = 1000m,
                Status = "generated",
                CreatedAt = DateTime.UtcNow
            };

            Context.OpdBills.Add(bill);
            await Context.SaveChangesAsync();
            Context.ChangeTracker.Clear();
            return bill;
        }

        private static IHttpContextAccessor NewHttpAccessor()
        {
            var accessor = new Mock<IHttpContextAccessor>();
            var http = new DefaultHttpContext();
            http.Items["TenantId"] = TenantId;
            accessor.Setup(a => a.HttpContext).Returns(http);
            return accessor.Object;
        }
    }

    private sealed class NoOpCcmsOutbox : IBillingCcmsOutboxService
    {
        public void Enqueue(Guid tenantId, string eventType, Guid billId, object payload, string idempotencyKey) { }

        public Task EnsureSchemaAsync(CancellationToken ct = default) => Task.CompletedTask;

        public Task<int> ProcessPendingAsync(int batchSize = 25, CancellationToken ct = default) => Task.FromResult(0);
    }
}
