using IpManagementService.Data;
using IpManagementService.Models.Domain;
using IpManagementService.Models.Dtos;
using IpManagementService.Services;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Xunit;

namespace IpManagementService.Tests;

public class ChecklistGateDischargeTests : IDisposable
{
    private readonly ServiceProvider _provider;
    private readonly IpManagementDbContext _db;
    private readonly StubBilling _billing;
    private readonly StubCcms _ccms;
    private readonly ChecklistGateService _gates;
    private readonly Guid _tenantId = Guid.NewGuid();

    public ChecklistGateDischargeTests()
    {
        var services = new ServiceCollection();
        services.AddDbContext<IpManagementDbContext>(o =>
            o.UseInMemoryDatabase(Guid.NewGuid().ToString("N")));
        _provider = services.BuildServiceProvider();
        _db = _provider.GetRequiredService<IpManagementDbContext>();
        _billing = new StubBilling();
        _ccms = new StubCcms();
        _gates = new ChecklistGateService(
            _db,
            Uninit<SurgicalSafetyService>(),
            new AnaesthesiaMonitoringService(_db, Uninit<ChecklistPhaseStatusService>()),
            Uninit<PacAssessmentService>(),
            Uninit<WardInvestigationChecklistService>(),
            _ccms,
            _billing);
    }

    [Fact]
    public async Task PostOp_To_Discharged_UsesAuthPatientBalance_NotJourneyPackageColumn()
    {
        var journey = Seed(ClinicalState.PostOp, paymentMode: "Cash", journeyBalanceDue: 0m);
        _billing.Summary = Summary(billId: Guid.NewGuid(), patientBalance: 500m, balanceDue: 500m, patientPaid: 90_000m);

        var result = await _gates.EvaluateTransitionAsync(journey, ClinicalState.Discharged, _tenantId);

        Assert.Contains(result.Warnings, w => w.Code == "patient_obligation_outstanding" && w.Severity == "block");
        Assert.False(result.CanProceed);
    }

    [Fact]
    public async Task ReadyForDischarge_DoesNotBlock_WhenAuthPatientBalanceIsZero_AndJourneyColumnLooksDue()
    {
        var journey = Seed(ClinicalState.ReadyForDischarge, paymentMode: "Cash", journeyBalanceDue: 80_000m);
        _billing.Summary = Summary(billId: Guid.NewGuid(), patientBalance: 0m, balanceDue: 80_000m, patientPaid: 10_000m);

        var result = await _gates.EvaluateTransitionAsync(journey, ClinicalState.Discharged, _tenantId);

        Assert.DoesNotContain(result.Warnings, w => w.Code == "patient_obligation_outstanding");
    }

    [Fact]
    public async Task Coverage_DoesNotHoldBed_OnTpaBalanceDue()
    {
        var journey = Seed(ClinicalState.Admitted, paymentMode: "Insurance", journeyBalanceDue: 80_000m);
        _ccms.PatientShare = 0m;
        _billing.Summary = Summary(billId: Guid.NewGuid(), patientBalance: 0m, balanceDue: 80_000m, patientPaid: 0m);

        var result = await _gates.EvaluateTransitionAsync(journey, ClinicalState.Discharged, _tenantId);

        Assert.DoesNotContain(result.Warnings, w => w.Code == "patient_obligation_outstanding");
    }

    [Fact]
    public async Task Admitted_To_Discharged_StillEvaluatesMoneyGate()
    {
        var journey = Seed(ClinicalState.Admitted, paymentMode: "Cash", journeyBalanceDue: 0m);
        _billing.Summary = Summary(billId: Guid.NewGuid(), patientBalance: 1_200m, balanceDue: 1_200m, patientPaid: 0m);

        var result = await _gates.EvaluateTransitionAsync(journey, ClinicalState.Discharged, _tenantId);

        Assert.Contains(result.Warnings, w => w.Code == "patient_obligation_outstanding");
    }

    [Fact]
    public async Task AuthSummaryUnavailable_StaleHighJourneyDue_BlocksWithoutUsingJourneyAmount()
    {
        var journey = Seed(ClinicalState.ReadyForDischarge, paymentMode: "Cash", journeyBalanceDue: 80_000m);
        _billing.ThrowOnSummary = true;

        var result = await _gates.EvaluateTransitionAsync(journey, ClinicalState.Discharged, _tenantId);

        var money = Assert.Single(result.Warnings, w => w.Code == "patient_obligation_outstanding");
        Assert.Equal("block", money.Severity);
        Assert.Equal(DischargeBlockerCategory.Financial, money.Category);
        Assert.Contains("could not be verified", money.Message, StringComparison.OrdinalIgnoreCase);
        Assert.DoesNotContain("80,000", money.Message, StringComparison.Ordinal);
        Assert.DoesNotContain("80000", money.Message, StringComparison.Ordinal);
        Assert.False(result.CanProceed);
    }

    [Fact]
    public async Task AuthSummaryUnavailable_StaleZeroJourneyDue_DoesNotClearDischarge()
    {
        var journey = Seed(ClinicalState.ReadyForDischarge, paymentMode: "Cash", journeyBalanceDue: 0m);
        _billing.ThrowOnSummary = true;

        var result = await _gates.EvaluateTransitionAsync(journey, ClinicalState.Discharged, _tenantId);

        var money = Assert.Single(result.Warnings, w => w.Code == "patient_obligation_outstanding");
        Assert.Equal("block", money.Severity);
        Assert.Contains("could not be verified", money.Message, StringComparison.OrdinalIgnoreCase);
        Assert.False(result.CanProceed);
    }

    [Fact]
    public async Task Coverage_CcmsUnavailable_Blocks_WithoutAuthFallback()
    {
        var journey = Seed(ClinicalState.ReadyForDischarge, paymentMode: "Insurance", journeyBalanceDue: 0m);
        _ccms.Unavailable = true;
        _billing.Summary = Summary(billId: Guid.NewGuid(), patientBalance: 0m, balanceDue: 80_000m, patientPaid: 0m);

        var result = await _gates.EvaluateTransitionAsync(journey, ClinicalState.Discharged, _tenantId);

        var money = Assert.Single(result.Warnings, w => w.Code == "patient_obligation_outstanding");
        Assert.Contains("CCMS unavailable", money.Message, StringComparison.OrdinalIgnoreCase);
        Assert.False(result.CanProceed);
        Assert.Equal(1, _ccms.ValidateCalls);
    }

    [Fact]
    public async Task AuthSummaryUnavailable_DoesNotDropFollowupBlocker()
    {
        var journey = Seed(ClinicalState.ReadyForDischarge, paymentMode: "Cash", journeyBalanceDue: 0m);
        _billing.ThrowOnSummary = true;

        var result = await _gates.EvaluateTransitionAsync(journey, ClinicalState.Discharged, _tenantId);

        Assert.Contains(result.Warnings, w => w.Code == "patient_obligation_outstanding");
        Assert.Contains(result.Warnings, w => w.Code == FollowupAppointmentLock.MissingCode);
        Assert.False(result.CanProceed);
    }

    [Fact]
    public async Task NoBill_AuthSummarySucceeds_UsesExistingJourneySemantics()
    {
        var due = Seed(ClinicalState.ReadyForDischarge, paymentMode: "Cash", journeyBalanceDue: 1_200m);
        _billing.Summary = Summary(billId: Guid.Empty, patientBalance: 0m, balanceDue: 0m, patientPaid: 0m);

        var dueResult = await _gates.EvaluateTransitionAsync(due, ClinicalState.Discharged, _tenantId);
        Assert.Contains(dueResult.Warnings, w => w.Code == "patient_obligation_outstanding" && w.Message.Contains("1,200"));

        var zero = Seed(ClinicalState.ReadyForDischarge, paymentMode: "Cash", journeyBalanceDue: 0m);
        var zeroResult = await _gates.EvaluateTransitionAsync(zero, ClinicalState.Discharged, _tenantId);
        Assert.DoesNotContain(zeroResult.Warnings, w => w.Code == "patient_obligation_outstanding");
    }

    private PatientJourney Seed(string clinical, string paymentMode, decimal journeyBalanceDue)
    {
        var journey = new PatientJourney
        {
            Id = Guid.NewGuid(),
            TenantId = _tenantId,
            BranchId = Guid.NewGuid(),
            PatientId = Guid.NewGuid(),
            ClinicalState = clinical,
            OtState = OtState.NotSent,
            FinancialState = FinancialState.Draft,
            PaymentMode = paymentMode,
            PackageAmount = 90_000m,
            TotalPaid = 90_000m - journeyBalanceDue,
            BalanceDue = journeyBalanceDue,
            AdmittedAt = DateTime.UtcNow,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow,
            Status = "active",
        };
        _db.PatientJourneys.Add(journey);
        _db.SaveChanges();
        return journey;
    }

    private static AuthIpFinancialSummary Summary(
        Guid billId, decimal patientBalance, decimal balanceDue, decimal patientPaid)
        => new(
            billId, "IP-P06", 90_000m, 90_000m + patientBalance, 0, patientBalance, balanceDue - patientBalance,
            patientPaid, 0, 0, balanceDue, "partial", false, false, [], [],
            PatientPaid: patientPaid, PatientBalance: patientBalance);

    public void Dispose()
    {
        _db.Dispose();
        _provider.Dispose();
    }

    private static T Uninit<T>() where T : class =>
        (T)System.Runtime.Serialization.FormatterServices.GetUninitializedObject(typeof(T));

    private sealed class StubBilling : IAuthBillingClient
    {
        public AuthIpFinancialSummary Summary { get; set; } = new(
            null, null, 0, 0, 0, 0, 0, 0, 0, 0, 0, "not_created", false, false, [], []);
        public bool ThrowOnSummary { get; set; }

        public Task<Guid> EnsureBillAsync(Guid tenantId, Guid branchId, Guid patientId, Guid journeyId, decimal packageAmount, Guid actorUserId)
            => Task.FromResult(Guid.Empty);
        public Task<AuthIpFinancialSummary> GetSummaryAsync(Guid journeyId)
            => ThrowOnSummary
                ? throw new InvalidOperationException("Billing summary unavailable")
                : Task.FromResult(Summary);
        public Task RecordPaymentAsync(Guid opdBillId, Guid actorUserId, string kind, string paymentMode, decimal amount, string? reference, string? notes, string? idempotencyKey)
            => Task.CompletedTask;
        public Task ReversePaymentAsync(Guid opdBillId, Guid originalPaymentId, Guid actorUserId, string reason)
            => Task.CompletedTask;
        public Task ApplyCoverageAllocationAsync(Guid journeyId, decimal payerResponsibility, decimal patientResponsibility, Guid actorUserId)
            => Task.CompletedTask;
        public Task SoftDeleteBillsForJourneysAsync(IReadOnlyList<Guid> journeyIds, Guid actorUserId)
            => Task.CompletedTask;
        public Task<AuthChargeItemsResult> ChargeItemsAsync(
            Guid tenantId, Guid patientJourneyId, Guid actorUserId, string idempotencyKey, IReadOnlyList<AuthChargeItemLine> lines)
            => Task.FromResult(new AuthChargeItemsResult(Guid.Empty, false));
        public Task EnqueueChargeExceptionAsync(
            Guid tenantId, Guid? patientJourneyId, Guid? itemId, Guid? sourceRefId, string sourceType, string reason,
            string idempotencyKey, decimal quantity, Guid? opdBillId = null, string? status = null)
            => Task.CompletedTask;
    }

    private sealed class StubCcms : ICcmsAdmissionClient
    {
        public decimal? PatientShare { get; set; }
        public bool Unavailable { get; set; }
        public int ValidateCalls { get; private set; }

        public Task<CcmsAdmissionValidation> ValidateAdmissionAsync(
            Guid journeyId, Guid? sessionId, Guid tenantId, bool coverageBased, bool emergencyFcApplied = false)
        {
            ValidateCalls++;
            return Task.FromResult(Unavailable
                ? CcmsAdmissionValidation.ForCcmsUnavailable(coverageBased)
                : new CcmsAdmissionValidation(
                    true, "none", null, null, null, null, null,
                    CcmsUnavailable: false, PatientShareAmount: PatientShare));
        }

        public Task NotifyEmergencyFcAppliedAsync(Guid journeyId, Guid? sessionId, Guid tenantId, Guid actorUserId, string reason)
            => Task.CompletedTask;
        public Task DeliverOutboxEventAsync(string eventType, string payloadJson, string idempotencyKey)
            => Task.CompletedTask;
        public Task NotifySurgeryCompletedAsync(Guid journeyId, Guid? sessionId, Guid tenantId, Guid actorUserId)
            => Task.CompletedTask;
        public Task NotifyPatientDischargedAsync(Guid journeyId, Guid? sessionId, Guid tenantId, Guid actorUserId)
            => Task.CompletedTask;
    }
}
