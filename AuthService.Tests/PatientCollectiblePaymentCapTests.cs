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

/// <summary>
/// Step 15 — patient cash/card/UPI cannot exceed collectible patient obligation.
/// TPA-inclusive BalanceDue is not the cashier ceiling.
/// </summary>
public class PatientCollectiblePaymentCapTests
{
    private static readonly Guid TenantId = Guid.NewGuid();
    private static readonly Guid UserId = Guid.NewGuid();
    private static readonly Guid JourneyId = Guid.NewGuid();
    private static readonly Guid PatientId = Guid.NewGuid();

    [Fact]
    public async Task CashPayment_OnInsuredBill_CannotExceedCcmsPatientShare()
    {
        var db = new Store();
        var bill = await db.SeedBillAsync(gross: 105_000m, insuranceClaim: 90_000m);
        var ccms = LiveShare(15_000m);

        var ex = await Assert.ThrowsAsync<ArgumentException>(() =>
            db.Service(ccms).AddPaymentAsync(Cash(bill.Id, 105_000m), UserId));

        Assert.Contains("collectible patient due", ex.Message, StringComparison.OrdinalIgnoreCase);
        Assert.Contains("15,000", ex.Message);
        Assert.Equal(0, await db.Reader().OpdBillPayments.CountAsync());
        Assert.Equal(0m, (await db.Reader().OpdBills.SingleAsync()).AmountPaid);
    }

    [Fact]
    public async Task CashPayment_EqualToCcmsShare_IsAccepted()
    {
        var db = new Store();
        var bill = await db.SeedBillAsync(gross: 105_000m, insuranceClaim: 90_000m);

        await db.Service(LiveShare(15_000m)).AddPaymentAsync(Cash(bill.Id, 15_000m), UserId);

        using var check = db.Reader();
        Assert.Equal(1, await check.OpdBillPayments.CountAsync());
        var updated = await check.OpdBills.SingleAsync();
        Assert.Equal(15_000m, updated.AmountPaid);
        Assert.Equal(90_000m, updated.BalanceDue);
    }

    [Fact]
    public async Task Advance_CannotBypassPatientShareCap()
    {
        var db = new Store();
        var bill = await db.SeedBillAsync(gross: 105_000m, insuranceClaim: 90_000m);

        var ex = await Assert.ThrowsAsync<ArgumentException>(() =>
            db.Service(LiveShare(15_000m)).AddPaymentAsync(new AddPaymentDto
            {
                OpdBillId = bill.Id,
                PaymentMode = "cash",
                Amount = 20_000m,
                PaymentKind = OpdBillLedgerCalculator.Advance,
            }, UserId));

        Assert.Contains("collectible patient due", ex.Message, StringComparison.OrdinalIgnoreCase);
        Assert.Equal(0, await db.Reader().OpdBillPayments.CountAsync());
    }

    [Fact]
    public async Task InsuranceTender_MayCollectUpToLedgerBalanceDue()
    {
        var db = new Store();
        var bill = await db.SeedBillAsync(gross: 105_000m, insuranceClaim: 90_000m);

        await db.Service(LiveShare(15_000m)).AddPaymentAsync(new AddPaymentDto
        {
            OpdBillId = bill.Id,
            PaymentMode = "insurance",
            Amount = 90_000m,
            PaymentKind = OpdBillLedgerCalculator.Payment,
        }, UserId);

        using var check = db.Reader();
        Assert.Equal(1, await check.OpdBillPayments.CountAsync());
        Assert.Equal(90_000m, (await check.OpdBills.SingleAsync()).AmountPaid);
    }

    [Fact]
    public async Task CashOpdBill_StillCapsAtBalanceDue()
    {
        var db = new Store();
        var bill = await db.SeedOpdBillAsync(1_000m);

        var ex = await Assert.ThrowsAsync<ArgumentException>(() =>
            db.Service().AddPaymentAsync(Cash(bill.Id, 1_001m), UserId));

        Assert.Contains("collectible patient due", ex.Message, StringComparison.OrdinalIgnoreCase);
        Assert.Equal(0, await db.Reader().OpdBillPayments.CountAsync());
    }

    [Fact]
    public async Task InsuredBill_FailsClosed_WhenCcmsShareUnavailable()
    {
        var db = new Store();
        var bill = await db.SeedBillAsync(gross: 105_000m, insuranceClaim: 90_000m);
        var ccms = new Mock<ICcmsPatientShareLookup>();
        ccms.Setup(c => c.GetAsync(TenantId, JourneyId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(new CcmsPatientShareLookupResult(false, false, 0));

        var ex = await Assert.ThrowsAsync<ArgumentException>(() =>
            db.Service(ccms.Object).AddPaymentAsync(Cash(bill.Id, 1_000m), UserId));

        Assert.Contains("CCMS patient obligation is unavailable", ex.Message, StringComparison.OrdinalIgnoreCase);
        Assert.Equal(0, await db.Reader().OpdBillPayments.CountAsync());
    }

    [Fact]
    public async Task DuplicateKey_Replays_EvenIfAmountWouldExceedCap()
    {
        var db = new Store();
        var bill = await db.SeedBillAsync(gross: 105_000m, insuranceClaim: 90_000m);
        var svc = db.Service(LiveShare(15_000m));
        var request = Cash(bill.Id, 15_000m);
        request.IdempotencyKey = "pay:step15:replay";

        await svc.AddPaymentAsync(request, UserId);
        await svc.AddPaymentAsync(request, UserId);

        Assert.Equal(1, await db.Reader().OpdBillPayments.CountAsync());
    }

    private static ICcmsPatientShareLookup LiveShare(decimal share)
    {
        var ccms = new Mock<ICcmsPatientShareLookup>();
        ccms.Setup(c => c.GetAsync(TenantId, JourneyId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(new CcmsPatientShareLookupResult(true, true, share));
        return ccms.Object;
    }

    private static AddPaymentDto Cash(Guid billId, decimal amount) => new()
    {
        OpdBillId = billId,
        PaymentMode = "cash",
        Amount = amount,
        PaymentKind = OpdBillLedgerCalculator.Payment,
    };

    private sealed class RecordingOutbox : IBillingCcmsOutboxService
    {
        public void Enqueue(Guid tenantId, string eventType, Guid billId, object payload, string idempotencyKey) { }
        public Task EnsureSchemaAsync(CancellationToken ct = default) => Task.CompletedTask;
        public Task<int> ProcessPendingAsync(int batchSize = 25, CancellationToken ct = default) => Task.FromResult(0);
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
            Audit = new Mock<IAuditService>();
            Audit.Setup(a => a.StageAsync(
                    It.IsAny<Guid>(), It.IsAny<string>(), It.IsAny<string>(), It.IsAny<Guid?>(),
                    It.IsAny<string?>(), It.IsAny<string?>(), It.IsAny<string?>()))
                .Returns(Task.CompletedTask);
        }

        public AppDbContext Context { get; }
        public Mock<IAuditService> Audit { get; }
        public AppDbContext Reader() => NewContext();

        private AppDbContext NewContext() => new(
            new DbContextOptionsBuilder<AppDbContext>().UseInMemoryDatabase(_name).Options,
            _http);

        public OpdBillService Service(ICcmsPatientShareLookup? patientShare = null) => new(
            Context,
            NullLogger<OpdBillService>.Instance,
            new RecordingOutbox(),
            notifications: null,
            audit: Audit.Object,
            http: _http,
            patientShare: patientShare);

        public async Task<OpdBill> SeedBillAsync(decimal gross, decimal insuranceClaim = 0)
        {
            Context.Patients.Add(new Patient
            {
                Id = PatientId,
                TenantId = TenantId,
                MedicalRecordNumber = "UAT-S15",
                FirstName = "Step15",
                LastName = "Patient",
                DateOfBirth = new DateTime(1968, 3, 12, 0, 0, 0, DateTimeKind.Utc),
                Gender = "F",
            });
            var bill = new OpdBill
            {
                Id = Guid.NewGuid(),
                TenantId = TenantId,
                BillNumber = "IP-S15-0001",
                PatientId = PatientId,
                PatientJourneyId = JourneyId,
                BranchId = Guid.NewGuid(),
                BillDate = DateTime.UtcNow,
                AdditionalCharges = gross,
                GrossAmount = gross,
                NetAmount = gross,
                AmountPaid = 0,
                BalanceDue = gross,
                InsuranceClaimAmount = insuranceClaim,
                IsInsurance = insuranceClaim > 0,
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

        public async Task<OpdBill> SeedOpdBillAsync(decimal gross)
        {
            var bill = new OpdBill
            {
                Id = Guid.NewGuid(),
                TenantId = TenantId,
                BillNumber = "OPD-S15-0001",
                PatientId = Guid.NewGuid(),
                BranchId = Guid.NewGuid(),
                BillDate = DateTime.UtcNow,
                GrossAmount = gross,
                NetAmount = gross,
                AmountPaid = 0,
                BalanceDue = gross,
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
