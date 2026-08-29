using IpManagementService.Data;
using IpManagementService.Models.Domain;
using IpManagementService.Models.Dtos;
using IpManagementService.Services;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging.Abstractions;
using Xunit;

namespace IpManagementService.Tests;

public class DischargeWithTypeGateTests : IDisposable
{
    private readonly ServiceProvider _provider;
    private readonly IpManagementDbContext _db;
    private readonly PatientJourneyService _svc;
    private readonly Guid _tenantId = Guid.NewGuid();
    private readonly Guid _actorId = Guid.NewGuid();
    private readonly Guid _branchId = Guid.NewGuid();

    public DischargeWithTypeGateTests()
    {
        var services = new ServiceCollection();
        services.AddDbContext<IpManagementDbContext>(o =>
            o.UseInMemoryDatabase(Guid.NewGuid().ToString("N")));
        _provider = services.BuildServiceProvider();
        _db = _provider.GetRequiredService<IpManagementDbContext>();
        var ccms = new NoOpCcmsAdmissionClient();
        _svc = new PatientJourneyService(
            _db,
            new NoOpPreOpNotificationClient(),
            ccms,
            Uninit<SurgicalSafetyService>(),
            new MoneyBlockedGates(),
            Uninit<PreOpClearanceService>(),
            Uninit<PreOpReadinessService>(),
            new WardChecklistAutoSyncService(_db, _provider),
            new JourneyMutationGuardService(_db),
            new JourneySchedulingGuardService(_db),
            new IntegrationOutboxService(_db, ccms, NullLogger<IntegrationOutboxService>.Instance));
    }

    [Fact]
    public async Task Routine_CannotAcknowledgeAway_MoneyBlock_WithoutOverride()
    {
        var journey = Seed(ClinicalState.PostOp);

        var result = await _svc.DischargeWithTypeAsync(
            journey.Id, _tenantId, _actorId,
            new DischargeWithTypeRequest(DischargeType.Routine, "Package paid, extras pending", true, true));

        Assert.Equal(ClinicalState.PostOp, result.ClinicalState);
        Assert.False(result.IsDischarged);
        Assert.Contains(result.TransitionWarnings ?? [], w => w.Code == "patient_obligation_outstanding");
        Assert.Equal(ClinicalState.PostOp, (await _db.PatientJourneys.AsNoTracking().SingleAsync()).ClinicalState);
    }

    [Fact]
    public async Task Routine_Override_ClearsMoneyHardStop()
    {
        var journey = Seed(ClinicalState.PostOp, overrideApplied: true);

        var result = await _svc.DischargeWithTypeAsync(
            journey.Id, _tenantId, _actorId,
            new DischargeWithTypeRequest(DischargeType.Routine, "Social discharge override", true, false));

        Assert.Equal(ClinicalState.Discharged, result.ClinicalState);
        Assert.True(result.IsDischarged);
    }

    [Fact]
    public async Task Lama_Proceeds_WithFinancialBlock_Documented()
    {
        var journey = Seed(ClinicalState.Admitted);

        var result = await _svc.DischargeWithTypeAsync(
            journey.Id, _tenantId, _actorId,
            new DischargeWithTypeRequest(DischargeType.Lama, "Left against medical advice", true, false));

        Assert.Equal(ClinicalState.Discharged, result.ClinicalState);
        Assert.Equal(DischargeType.Lama, result.DischargeType);
        Assert.Contains(result.TransitionWarnings ?? [], w => w.Code == "patient_obligation_outstanding");
    }

    [Fact]
    public async Task Death_And_Transfer_Proceed_WithFinancialWarnings_WithoutRedesign()
    {
        var death = Seed(ClinicalState.Admitted);
        var deathResult = await _svc.DischargeWithTypeAsync(
            death.Id, _tenantId, _actorId,
            new DischargeWithTypeRequest(DischargeType.Death, "Died in ward", true, false));
        Assert.Equal(ClinicalState.Discharged, deathResult.ClinicalState);
        Assert.Equal(DischargeType.Death, deathResult.DischargeType);
        Assert.Contains(deathResult.TransitionWarnings ?? [], w => w.Code == "patient_obligation_outstanding");

        var transfer = Seed(ClinicalState.Admitted);
        var transferResult = await _svc.DischargeWithTypeAsync(
            transfer.Id, _tenantId, _actorId,
            new DischargeWithTypeRequest(DischargeType.Transfer, "Transferred to higher centre", true, false));
        Assert.Equal(ClinicalState.Discharged, transferResult.ClinicalState);
        Assert.Equal(DischargeType.Transfer, transferResult.DischargeType);
        Assert.Contains(transferResult.TransitionWarnings ?? [], w => w.Code == "patient_obligation_outstanding");
    }

    private PatientJourney Seed(string clinical, bool overrideApplied = false)
    {
        var journey = new PatientJourney
        {
            Id = Guid.NewGuid(),
            TenantId = _tenantId,
            BranchId = _branchId,
            PatientId = Guid.NewGuid(),
            ClinicalState = clinical,
            OtState = OtState.NotSent,
            FinancialState = FinancialState.Draft,
            DischargeOverrideApplied = overrideApplied,
            AdmittedAt = DateTime.UtcNow,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow,
            Status = "active",
        };
        _db.PatientJourneys.Add(journey);
        _db.SaveChanges();
        return journey;
    }

    public void Dispose()
    {
        _db.Dispose();
        _provider.Dispose();
    }

    private static T Uninit<T>() where T : class =>
        (T)System.Runtime.Serialization.FormatterServices.GetUninitializedObject(typeof(T));

    private sealed class MoneyBlockedGates : ChecklistGateService
    {
        public MoneyBlockedGates()
            : base(
                Uninit<IpManagementDbContext>(),
                Uninit<SurgicalSafetyService>(),
                Uninit<AnaesthesiaMonitoringService>(),
                Uninit<PacAssessmentService>(),
                Uninit<WardInvestigationChecklistService>())
        {
        }

        public override Task<ChecklistGateResultDto> EvaluateTransitionAsync(
            PatientJourney journey, string newState, Guid tenantId)
            => Task.FromResult(new ChecklistGateResultDto(
                $"{journey.ClinicalState}->{newState}",
                false,
                true,
                [new ChecklistGateWarningDto(
                    "patient_obligation_outstanding",
                    "Clinical discharge blocked until patient share / cash due is collected.",
                    "block",
                    true,
                    DischargeBlockerCategory.Financial)]));
    }
}
