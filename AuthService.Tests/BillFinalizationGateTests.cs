using AuthService.Context;
using AuthService.Models.Domain;
using AuthService.Services;
using Microsoft.AspNetCore.Http;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging.Abstractions;
using Moq;
using Xunit;

namespace AuthService.Tests;

public class BillFinalizationGateTests
{
    private static readonly Guid TenantId = Guid.NewGuid();
    private static readonly Guid UserId = Guid.NewGuid();
    private static readonly Guid JourneyId = Guid.NewGuid();
    private static readonly Guid PatientId = Guid.NewGuid();

    [Fact]
    public async Task Finalize_Rejects_MissingImplantCharge()
    {
        var db = new Store();
        var bill = await db.SeedBillAsync(gross: 0);
        await db.SeedUsageAsync("Pending");

        var ex = await Assert.ThrowsAsync<InvalidOperationException>(
            () => db.Service().FinalizeBillAsync(bill.Id, UserId));

        Assert.Contains("Cannot finalize", ex.Message, StringComparison.OrdinalIgnoreCase);
        Assert.False((await db.Reader().OpdBills.SingleAsync()).IsFinalized);
        Assert.DoesNotContain(BillingCcmsEventTypes.BillFinalized, db.Outbox.Types);
    }

    [Fact]
    public async Task Finalize_Rejects_UnpaidPatientBalance()
    {
        var db = new Store();
        var bill = await db.SeedBillAsync(gross: 5_000m);

        var ex = await Assert.ThrowsAsync<InvalidOperationException>(
            () => db.Service().FinalizeBillAsync(bill.Id, UserId));

        Assert.Contains("patient balance", ex.Message, StringComparison.OrdinalIgnoreCase);
        Assert.False((await db.Reader().OpdBills.SingleAsync()).IsFinalized);
        Assert.DoesNotContain(BillingCcmsEventTypes.BillFinalized, db.Outbox.Types);
    }

    [Fact]
    public async Task Finalize_Allows_TpaOutstanding_WhenPatientShareCollected()
    {
        var db = new Store();
        var bill = await db.SeedBillAsync(gross: 90_000m, insuranceClaim: 80_000m);
        await db.SeedPaymentAsync(bill.Id, 10_000m);

        await db.Service().FinalizeBillAsync(bill.Id, UserId);

        Assert.True((await db.Reader().OpdBills.SingleAsync()).IsFinalized);
        Assert.Contains(BillingCcmsEventTypes.BillFinalized, db.Outbox.Types);
    }

    [Fact]
    public async Task Finalize_Allows_CoveredAndCreditedImplants_WhenPatientPaid()
    {
        var db = new Store();
        var bill = await db.SeedBillAsync(gross: 1_000m);
        await db.SeedPaymentAsync(bill.Id, 1_000m);
        await db.SeedUsageAsync("Covered");
        await db.SeedUsageAsync("Credited");
        await db.SeedUsageAsync("Suppressed");

        await db.Service().FinalizeBillAsync(bill.Id, UserId);

        Assert.True((await db.Reader().OpdBills.SingleAsync()).IsFinalized);
    }

    [Fact]
    public async Task Finalize_Rejects_WhenReconciliationUnavailable()
    {
        var db = new Store();
        var bill = await db.SeedBillAsync(gross: 0);

        var ex = await Assert.ThrowsAsync<InvalidOperationException>(
            () => db.Service(includeReconciliation: false).FinalizeBillAsync(bill.Id, UserId));

        Assert.Contains("completeness is unavailable", ex.Message, StringComparison.OrdinalIgnoreCase);
    }

    [Fact]
    public async Task Finalize_Rejects_WhenLiveCcmsShareUnpaid_EvenIfInsuranceClaimCoversGross()
    {
        var db = new Store();
        var bill = await db.SeedBillAsync(gross: 105_000m, insuranceClaim: 105_000m);
        var ccms = new Mock<ICcmsPatientShareLookup>();
        ccms.Setup(c => c.GetAsync(TenantId, JourneyId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(new CcmsPatientShareLookupResult(true, true, 15_000m));

        var ex = await Assert.ThrowsAsync<InvalidOperationException>(
            () => db.Service(patientShare: ccms.Object).FinalizeBillAsync(bill.Id, UserId));

        Assert.Contains("patient balance", ex.Message, StringComparison.OrdinalIgnoreCase);
        Assert.Contains("15,000", ex.Message);
        Assert.False((await db.Reader().OpdBills.SingleAsync()).IsFinalized);
    }

    [Fact]
    public async Task Finalize_Allows_WhenLiveCcmsShareIsCollected_EvenIfInsuranceClaimLooksFullyCovered()
    {
        var db = new Store();
        var bill = await db.SeedBillAsync(gross: 105_000m, insuranceClaim: 105_000m);
        await db.SeedPaymentAsync(bill.Id, 15_000m);
        var ccms = new Mock<ICcmsPatientShareLookup>();
        ccms.Setup(c => c.GetAsync(TenantId, JourneyId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(new CcmsPatientShareLookupResult(true, true, 15_000m));

        await db.Service(patientShare: ccms.Object).FinalizeBillAsync(bill.Id, UserId);

        Assert.True((await db.Reader().OpdBills.SingleAsync()).IsFinalized);
    }

    [Fact]
    public async Task Finalize_Rejects_WhenCcmsShareUnavailable_OnInsuranceBill()
    {
        var db = new Store();
        var bill = await db.SeedBillAsync(gross: 5_000m, insuranceClaim: 4_000m);
        await db.SeedPaymentAsync(bill.Id, 1_000m);
        var ccms = new Mock<ICcmsPatientShareLookup>();
        ccms.Setup(c => c.GetAsync(TenantId, JourneyId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(new CcmsPatientShareLookupResult(false, false, 0));

        var ex = await Assert.ThrowsAsync<InvalidOperationException>(
            () => db.Service(patientShare: ccms.Object).FinalizeBillAsync(bill.Id, UserId));

        Assert.Contains("CCMS patient obligation is unavailable", ex.Message, StringComparison.OrdinalIgnoreCase);
        Assert.False((await db.Reader().OpdBills.SingleAsync()).IsFinalized);
    }

    [Fact]
    public async Task Lock_Rejects_WhenCcmsShareUnavailable_OnInsuranceBill()
    {
        var db = new Store();
        var bill = await db.SeedBillAsync(gross: 5_000m, insuranceClaim: 4_000m);
        await db.SeedPaymentAsync(bill.Id, 1_000m);
        var ccms = new Mock<ICcmsPatientShareLookup>();
        ccms.Setup(c => c.GetAsync(TenantId, JourneyId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(new CcmsPatientShareLookupResult(false, false, 0));

        var ex = await Assert.ThrowsAsync<InvalidOperationException>(
            () => db.Service(patientShare: ccms.Object).LockBillAsync(bill.Id, UserId));

        Assert.Contains("CCMS patient obligation is unavailable", ex.Message, StringComparison.OrdinalIgnoreCase);
        var persisted = await db.Reader().OpdBills.SingleAsync();
        Assert.False(persisted.IsFinalized);
        Assert.False(persisted.IsLocked);
        Assert.DoesNotContain(BillingCcmsEventTypes.BillFinalized, db.Outbox.Types);
    }

    [Fact]
    public async Task Lock_Rejects_UnpaidPatientBalance_WithoutFinalizingOrLocking()
    {
        var db = new Store();
        var bill = await db.SeedBillAsync(gross: 5_000m);

        var ex = await Assert.ThrowsAsync<InvalidOperationException>(
            () => db.Service().LockBillAsync(bill.Id, UserId));

        Assert.Contains("patient balance", ex.Message, StringComparison.OrdinalIgnoreCase);
        var persisted = await db.Reader().OpdBills.SingleAsync();
        Assert.False(persisted.IsFinalized);
        Assert.False(persisted.IsLocked);
        Assert.DoesNotContain(BillingCcmsEventTypes.BillFinalized, db.Outbox.Types);
    }

    [Fact]
    public async Task Lock_Rejects_MissingImplantCharge()
    {
        var db = new Store();
        var bill = await db.SeedBillAsync(gross: 0);
        await db.SeedUsageAsync("Pending");

        var ex = await Assert.ThrowsAsync<InvalidOperationException>(
            () => db.Service().LockBillAsync(bill.Id, UserId));

        Assert.Contains("Cannot finalize", ex.Message, StringComparison.OrdinalIgnoreCase);
        var persisted = await db.Reader().OpdBills.SingleAsync();
        Assert.False(persisted.IsFinalized);
        Assert.False(persisted.IsLocked);
        Assert.DoesNotContain(BillingCcmsEventTypes.BillFinalized, db.Outbox.Types);
    }

    [Fact]
    public async Task Lock_Allows_TpaOutstanding_WhenPatientShareCollected()
    {
        var db = new Store();
        var bill = await db.SeedBillAsync(gross: 90_000m, insuranceClaim: 80_000m);
        await db.SeedPaymentAsync(bill.Id, 10_000m);

        await db.Service().LockBillAsync(bill.Id, UserId);

        var persisted = await db.Reader().OpdBills.SingleAsync();
        Assert.True(persisted.IsFinalized);
        Assert.True(persisted.IsLocked);
        Assert.Equal(1, db.Outbox.Types.Count(t => t == BillingCcmsEventTypes.BillFinalized));
    }

    [Fact]
    public async Task Lock_Replay_DoesNotEmitSecondBillFinalized()
    {
        var db = new Store();
        var bill = await db.SeedBillAsync(gross: 1_000m);
        await db.SeedPaymentAsync(bill.Id, 1_000m);

        await db.Service().LockBillAsync(bill.Id, UserId);
        await db.Service().LockBillAsync(bill.Id, UserId);

        var persisted = await db.Reader().OpdBills.SingleAsync();
        Assert.True(persisted.IsFinalized);
        Assert.True(persisted.IsLocked);
        Assert.Equal(1, db.Outbox.Types.Count(t => t == BillingCcmsEventTypes.BillFinalized));
    }

    [Fact]
    public async Task Lock_OnAlreadyFinalizedBill_SetsLockedWithoutSecondEvent()
    {
        var db = new Store();
        var bill = await db.SeedBillAsync(gross: 1_000m);
        await db.SeedPaymentAsync(bill.Id, 1_000m);

        await db.Service().FinalizeBillAsync(bill.Id, UserId);
        await db.Service().LockBillAsync(bill.Id, UserId);

        var persisted = await db.Reader().OpdBills.SingleAsync();
        Assert.True(persisted.IsFinalized);
        Assert.True(persisted.IsLocked);
        Assert.Equal(1, db.Outbox.Types.Count(t => t == BillingCcmsEventTypes.BillFinalized));
    }

    [Fact]
    public async Task Summary_UsesLiveCcmsShare_NotBilledMinusInsuranceClaim()
    {
        var db = new Store();
        await db.SeedBillAsync(gross: 105_000m, insuranceClaim: 105_000m);
        var ccms = new Mock<ICcmsPatientShareLookup>();
        ccms.Setup(c => c.GetAsync(TenantId, JourneyId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(new CcmsPatientShareLookupResult(true, true, 15_000m));

        var summary = await db.Service(patientShare: ccms.Object).GetInpatientSummaryAsync(JourneyId);

        Assert.Equal(15_000m, summary.PatientResponsibility);
        Assert.Equal(15_000m, summary.PatientBalance);
        Assert.Equal(15_000m, summary.CcmsPatientShare);
        Assert.True(summary.CcmsPatientShareAvailable);
        Assert.Contains(summary.FinancialBlockers, b => b.Contains("15,000"));
    }

    private sealed class RecordingOutbox : IBillingCcmsOutboxService
    {
        public List<string> Types { get; } = [];
        public void Enqueue(Guid tenantId, string eventType, Guid billId, object payload, string idempotencyKey)
            => Types.Add(eventType);
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
            Outbox = new RecordingOutbox();
            Audit = new Mock<IAuditService>();
            Audit.Setup(a => a.StageAsync(
                    It.IsAny<Guid>(), It.IsAny<string>(), It.IsAny<string>(), It.IsAny<Guid?>(),
                    It.IsAny<string?>(), It.IsAny<string?>(), It.IsAny<string?>()))
                .Returns(Task.CompletedTask);
        }

        public AppDbContext Context { get; }
        public RecordingOutbox Outbox { get; }
        public Mock<IAuditService> Audit { get; }

        public AppDbContext Reader() => NewContext();

        private AppDbContext NewContext() => new(
            new DbContextOptionsBuilder<AppDbContext>().UseInMemoryDatabase(_name).Options,
            _http);

        public OpdBillService Service(bool includeReconciliation = true, ICcmsPatientShareLookup? patientShare = null)
        {
            var ctx = Context;
            return new OpdBillService(
                ctx,
                NullLogger<OpdBillService>.Instance,
                Outbox,
                notifications: null,
                audit: Audit.Object,
                http: _http,
                billItems: new BillItemService(ctx, NullLogger<BillItemService>.Instance),
                catalog: new ChargeCatalogResolver(ctx),
                reconciliation: includeReconciliation ? new ChargeReconciliationService(ctx, new ChargeCatalogResolver(ctx)) : null,
                patientShare: patientShare);
        }

        public async Task<OpdBill> SeedBillAsync(decimal gross, decimal insuranceClaim = 0)
        {
            Context.Patients.Add(new Patient
            {
                Id = PatientId,
                TenantId = TenantId,
                MedicalRecordNumber = "UAT-P06B",
                FirstName = "P06",
                LastName = "Patient",
                DateOfBirth = new DateTime(1968, 3, 12, 0, 0, 0, DateTimeKind.Utc),
                Gender = "F",
            });
            var bill = new OpdBill
            {
                Id = Guid.NewGuid(),
                TenantId = TenantId,
                BillNumber = "IP-P06B-0001",
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

        public async Task SeedPaymentAsync(Guid billId, decimal amount)
        {
            Context.OpdBillPayments.Add(new OpdBillPayment
            {
                Id = Guid.NewGuid(),
                TenantId = TenantId,
                OpdBillId = billId,
                PaymentReference = $"PAY-{Guid.NewGuid():N}"[..20],
                PaymentMode = "cash",
                Amount = amount,
                PaymentKind = OpdBillLedgerCalculator.Payment,
                Status = "completed",
                PaymentDate = DateTime.UtcNow,
                CreatedAt = DateTime.UtcNow,
                CreatedByUserId = UserId,
            });
            await Context.SaveChangesAsync();
            Context.ChangeTracker.Clear();
        }

        public async Task SeedUsageAsync(string chargeStatus)
        {
            Context.JourneyImplantUsageReads.Add(new JourneyImplantUsageRead
            {
                Id = Guid.NewGuid(),
                TenantId = TenantId,
                JourneyId = JourneyId,
                PatientId = PatientId,
                Eye = "OD",
                ItemId = Guid.NewGuid(),
                UsageStatus = ChargeReconciliationService.Implanted,
                ChargeStatus = chargeStatus,
                ScannedAt = DateTime.UtcNow,
            });
            await Context.SaveChangesAsync();
            Context.ChangeTracker.Clear();
        }
    }
}
