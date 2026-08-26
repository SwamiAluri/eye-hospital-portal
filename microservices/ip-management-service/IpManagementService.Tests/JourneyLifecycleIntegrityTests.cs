using IpManagementService.Data;
using IpManagementService.Models.Domain;
using IpManagementService.Models.Dtos;
using IpManagementService.Services;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging.Abstractions;
using Xunit;

namespace IpManagementService.Tests;

public class JourneyLifecycleIntegrityTests : IDisposable
{
    private readonly ServiceProvider _provider;
    private readonly IpManagementDbContext _db;
    private readonly RecordingBedClient _beds;
    private readonly PatientJourneyService _svc;
    private readonly Guid _tenantId = Guid.NewGuid();
    private readonly Guid _actorId = Guid.NewGuid();
    private readonly Guid _branchId = Guid.NewGuid();

    public JourneyLifecycleIntegrityTests()
    {
        var services = new ServiceCollection();
        services.AddDbContext<IpManagementDbContext>(o =>
            o.UseInMemoryDatabase(Guid.NewGuid().ToString("N")));
        _provider = services.BuildServiceProvider();
        _db = _provider.GetRequiredService<IpManagementDbContext>();
        _beds = new RecordingBedClient();
        var ccms = new NoOpCcms();

        _svc = new PatientJourneyService(
            _db,
            new NoOpNotify(),
            ccms,
            Uninit<SurgicalSafetyService>(),
            new OpenGates(),
            Uninit<PreOpClearanceService>(),
            Uninit<PreOpReadinessService>(),
            new WardChecklistAutoSyncService(_db, _provider),
            new JourneyMutationGuardService(_db),
            new JourneySchedulingGuardService(_db),
            new IntegrationOutboxService(_db, ccms, NullLogger<IntegrationOutboxService>.Instance),
            _beds);
    }

    [Fact]
    public async Task CancelToday_FromAdmitted_VacatesAuthBed_AndClearsPointer()
    {
        var bedId = Guid.NewGuid();
        var journey = SeedJourney(ClinicalState.Admitted, assignedBedId: bedId, admittedAt: DateTime.UtcNow);

        await _svc.CancelTodaySurgeryAsync(
            journey.Id, _tenantId, _actorId, new CancelTodaySurgeryRequest("Surgeon unavailable"));

        var saved = await _db.PatientJourneys.AsNoTracking().SingleAsync(j => j.Id == journey.Id);
        Assert.Equal(ClinicalState.CancelledSurgery, saved.ClinicalState);
        Assert.Null(saved.AssignedBedId);
        Assert.Equal("vacate", Assert.Single(_beds.Actions).Action);
        Assert.Equal(bedId, _beds.Actions[0].BedId);
        Assert.Contains(_db.JourneyAuditLogs, a => a.Action == "CancelTodaySurgery");
    }

    [Fact]
    public async Task CancelToday_FromExpected_ReleasesReservedBed()
    {
        var bedId = Guid.NewGuid();
        var journey = SeedJourney(ClinicalState.Expected, assignedBedId: bedId);

        await _svc.CancelTodaySurgeryAsync(
            journey.Id, _tenantId, _actorId, new CancelTodaySurgeryRequest("Patient postponed"));

        var saved = await _db.PatientJourneys.AsNoTracking().SingleAsync(j => j.Id == journey.Id);
        Assert.Null(saved.AssignedBedId);
        Assert.Equal("release", Assert.Single(_beds.Actions).Action);
    }

    [Fact]
    public async Task CancelToday_BedServiceFailure_LeavesAssignedBedId()
    {
        var bedId = Guid.NewGuid();
        var journey = SeedJourney(ClinicalState.Admitted, assignedBedId: bedId, admittedAt: DateTime.UtcNow);
        _beds.Fail = true;

        await Assert.ThrowsAsync<InvalidOperationException>(() =>
            _svc.CancelTodaySurgeryAsync(
                journey.Id, _tenantId, _actorId, new CancelTodaySurgeryRequest("Abort")));

        var saved = await _db.PatientJourneys.AsNoTracking().SingleAsync(j => j.Id == journey.Id);
        Assert.Equal(ClinicalState.Admitted, saved.ClinicalState);
        Assert.Equal(bedId, saved.AssignedBedId);
    }

    [Fact]
    public async Task CancelAdmission_FromExpected_ReleasesBed_AndIsTerminal()
    {
        var bedId = Guid.NewGuid();
        var journey = SeedJourney(ClinicalState.Expected, assignedBedId: bedId);

        var dto = await _svc.CancelAdmissionAsync(
            journey.Id, _tenantId, _actorId, new CancelAdmissionRequest("Patient declined admission"));

        Assert.Equal(ClinicalState.AdmissionCancelled, dto.ClinicalState);
        var saved = await _db.PatientJourneys.AsNoTracking().SingleAsync(j => j.Id == journey.Id);
        Assert.Null(saved.AssignedBedId);
        Assert.Equal("release", Assert.Single(_beds.Actions).Action);
        Assert.Throws<InvalidOperationException>(
            () => StateTransitionValidator.ValidateClinical(
                ClinicalState.AdmissionCancelled, ClinicalState.Expected));
        Assert.Contains(_db.JourneyAuditLogs, a => a.Action == "CancelAdmission");
    }

    [Fact]
    public async Task CancelAdmission_FromAdmitted_IsRejected()
    {
        var journey = SeedJourney(ClinicalState.Admitted, admittedAt: DateTime.UtcNow);

        await Assert.ThrowsAsync<InvalidOperationException>(() =>
            _svc.CancelAdmissionAsync(
                journey.Id, _tenantId, _actorId, new CancelAdmissionRequest("Too late")));
    }

    [Fact]
    public async Task TransitionClinical_StaleExpectedUpdatedAt_Conflicts()
    {
        var journey = SeedJourney(ClinicalState.Admitted, admittedAt: DateTime.UtcNow);
        var stale = journey.UpdatedAt.AddMinutes(-5);

        var ex = await Assert.ThrowsAsync<InvalidOperationException>(() =>
            _svc.TransitionClinicalAsync(
                journey.Id, _tenantId, _actorId,
                new TransitionRequest(ClinicalState.ReadyForSurgery, ExpectedUpdatedAt: stale)));

        Assert.Contains("another user", ex.Message, StringComparison.OrdinalIgnoreCase);
        var saved = await _db.PatientJourneys.AsNoTracking().SingleAsync(j => j.Id == journey.Id);
        Assert.Equal(ClinicalState.Admitted, saved.ClinicalState);
    }

    [Fact]
    public async Task TransitionFinancial_IsDeprecated_OwnedByBilling()
    {
        var journey = SeedJourney(ClinicalState.Admitted, admittedAt: DateTime.UtcNow);
        journey.FinancialState = FinancialState.PartiallyPaid;
        await _db.SaveChangesAsync();

        var ex = await Assert.ThrowsAsync<InvalidOperationException>(() =>
            _svc.TransitionFinancialAsync(
                journey.Id, _tenantId, _actorId, new TransitionRequest(FinancialState.Paid)));
        Assert.Contains("Billing", ex.Message, StringComparison.OrdinalIgnoreCase);
    }

    [Fact]
    public async Task MarkReady_EnqueuesExactlyOneJourneyReadyForOt()
    {
        var journey = SeedJourney(ClinicalState.Admitted, admittedAt: DateTime.UtcNow);

        await _svc.TransitionClinicalAsync(
            journey.Id, _tenantId, _actorId,
            new TransitionRequest(ClinicalState.ReadyForSurgery));

        var evt = Assert.Single(_db.IntegrationOutboxEvents);
        Assert.Equal(IntegrationEventTypes.JourneyReadyForOt, evt.EventType);
        Assert.Equal(journey.Id, evt.AggregateId);
        Assert.StartsWith($"{IntegrationEventTypes.JourneyReadyForOt}:{journey.Id:N}:", evt.IdempotencyKey);
        Assert.Contains("readyAt", evt.PayloadJson);
        Assert.Contains("slotId", evt.PayloadJson);

        var saved = await _db.PatientJourneys.AsNoTracking().SingleAsync(j => j.Id == journey.Id);
        Assert.Equal(ClinicalState.ReadyForSurgery, saved.ClinicalState);
    }

    [Fact]
    public async Task MarkReady_AcknowledgingVitalsOutOfRange_WritesAudit()
    {
        var ccms = new NoOpCcms();
        var svc = new PatientJourneyService(
            _db,
            new NoOpNotify(),
            ccms,
            Uninit<SurgicalSafetyService>(),
            new VitalsOutOfRangeGates(),
            Uninit<PreOpClearanceService>(),
            Uninit<PreOpReadinessService>(),
            new WardChecklistAutoSyncService(_db, _provider),
            new JourneyMutationGuardService(_db),
            new JourneySchedulingGuardService(_db),
            new IntegrationOutboxService(_db, ccms, NullLogger<IntegrationOutboxService>.Instance),
            _beds);
        var journey = SeedJourney(ClinicalState.Admitted, admittedAt: DateTime.UtcNow);

        var held = await svc.TransitionClinicalAsync(
            journey.Id, _tenantId, _actorId,
            new TransitionRequest(ClinicalState.ReadyForSurgery));
        Assert.Equal(ClinicalState.Admitted, held.ClinicalState);
        Assert.Contains(held.TransitionWarnings ?? [], w => w.Code == "vitals_out_of_range");
        Assert.DoesNotContain(_db.JourneyAuditLogs, a => a.Action == JourneyClinicalAudit.VitalsWarningAcknowledged);

        await svc.TransitionClinicalAsync(
            journey.Id, _tenantId, _actorId,
            new TransitionRequest(ClinicalState.ReadyForSurgery, AcknowledgeWarnings: true));

        Assert.Contains(_db.JourneyAuditLogs, a =>
            a.Action == JourneyClinicalAudit.VitalsWarningAcknowledged
            && a.PatientJourneyId == journey.Id
            && a.NewValue == "out_of_range");
        var saved = await _db.PatientJourneys.AsNoTracking().SingleAsync(j => j.Id == journey.Id);
        Assert.Equal(ClinicalState.ReadyForSurgery, saved.ClinicalState);
    }

    [Fact]
    public async Task MarkReady_AcknowledgingMissingVitals_DoesNotCountAsOverride()
    {
        var ccms = new NoOpCcms();
        var svc = new PatientJourneyService(
            _db,
            new NoOpNotify(),
            ccms,
            Uninit<SurgicalSafetyService>(),
            new MissingVitalsGates(),
            Uninit<PreOpClearanceService>(),
            Uninit<PreOpReadinessService>(),
            new WardChecklistAutoSyncService(_db, _provider),
            new JourneyMutationGuardService(_db),
            new JourneySchedulingGuardService(_db),
            new IntegrationOutboxService(_db, ccms, NullLogger<IntegrationOutboxService>.Instance),
            _beds);
        var journey = SeedJourney(ClinicalState.Admitted, admittedAt: DateTime.UtcNow);

        await svc.TransitionClinicalAsync(
            journey.Id, _tenantId, _actorId,
            new TransitionRequest(ClinicalState.ReadyForSurgery, AcknowledgeWarnings: true));

        Assert.DoesNotContain(_db.JourneyAuditLogs, a => a.Action == JourneyClinicalAudit.VitalsWarningAcknowledged);
        Assert.Equal(ClinicalState.ReadyForSurgery,
            (await _db.PatientJourneys.AsNoTracking().SingleAsync(j => j.Id == journey.Id)).ClinicalState);
    }

    [Fact]
    public async Task OtReturn_DoesNotEnqueueJourneyReadyForOt()
    {
        var journey = SeedJourney(ClinicalState.SentToOT);
        journey.OtState = OtState.SentToOT;
        await _db.SaveChangesAsync();

        await _svc.TransitionClinicalAsync(
            journey.Id, _tenantId, _actorId,
            new TransitionRequest(ClinicalState.ReadyForSurgery, "Returned from holding"));

        Assert.Empty(_db.IntegrationOutboxEvents);
        var saved = await _db.PatientJourneys.AsNoTracking().SingleAsync(j => j.Id == journey.Id);
        Assert.Equal(ClinicalState.ReadyForSurgery, saved.ClinicalState);
        Assert.Equal(OtState.NotSent, saved.OtState);
        Assert.Equal("Returned from holding", saved.OtReturnReason);
    }

    [Fact]
    public async Task MarkReady_ReplayOfSameIdempotencyKey_IsOneRow()
    {
        var journey = SeedJourney(ClinicalState.Admitted, admittedAt: DateTime.UtcNow);
        await _svc.TransitionClinicalAsync(
            journey.Id, _tenantId, _actorId,
            new TransitionRequest(ClinicalState.ReadyForSurgery));

        var first = await _db.IntegrationOutboxEvents.AsNoTracking().SingleAsync();
        var tenantId = first.TenantId;
        var outbox = new IntegrationOutboxService(
            _db, new NoOpCcms(), NullLogger<IntegrationOutboxService>.Instance);
        outbox.Enqueue(
            tenantId,
            IntegrationEventTypes.JourneyReadyForOt,
            journey.Id,
            new { journey.Id },
            idempotencyKey: first.IdempotencyKey);
        await _db.SaveChangesAsync();

        Assert.Equal(1, await _db.IntegrationOutboxEvents.CountAsync());
    }

    private PatientJourney SeedJourney(
        string clinical, Guid? assignedBedId = null, DateTime? admittedAt = null)
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
            AssignedBedId = assignedBedId,
            AdmittedAt = admittedAt,
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

    /// <summary>IP-012 tests need gates to pass on Admitted → ReadyForSurgery without PAC/lab wiring.</summary>
    private sealed class OpenGates : ChecklistGateService
    {
        public OpenGates()
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
                $"{journey.ClinicalState}->{newState}", true, false, []));
    }

    private sealed class VitalsOutOfRangeGates : ChecklistGateService
    {
        public VitalsOutOfRangeGates()
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
                true,
                true,
                [new ChecklistGateWarningDto("vitals_out_of_range", "BP out of range", "warn", true)]));
    }

    private sealed class MissingVitalsGates : ChecklistGateService
    {
        public MissingVitalsGates()
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
                true,
                true,
                [new ChecklistGateWarningDto("vitals_not_recorded", "No vitals in 4h", "warn", true)]));
    }

    private sealed class RecordingBedClient : IAuthBedLifecycleClient
    {
        public bool Fail { get; set; }
        public List<(Guid BedId, string Action)> Actions { get; } = [];

        public Task<AuthBedSnapshot?> ApplyAsync(
            Guid tenantId, Guid bedId, Guid actorUserId, Guid? patientId, string action)
        {
            if (Fail) throw new InvalidOperationException("Bed inventory service unavailable.");
            Actions.Add((bedId, action));
            return Task.FromResult<AuthBedSnapshot?>(new AuthBedSnapshot(bedId, "B1", null, null, "Cleaning"));
        }

        public Task<IReadOnlyList<AuthBedSnapshot>> ListAsync(Guid tenantId, Guid branchId, string? wardName, Guid? wardId = null)
            => Task.FromResult<IReadOnlyList<AuthBedSnapshot>>(Array.Empty<AuthBedSnapshot>());
    }

    private sealed class NoOpNotify : IPreOpNotificationClient
    {
        public Task NotifyDepartmentAsync(Guid tenantId, Guid? branchId, string departmentCode, string type, string message, string details)
            => Task.CompletedTask;
        public Task NotifyUserAsync(Guid tenantId, Guid userId, string type, string message, string details)
            => Task.CompletedTask;
        public Task MarkOtSurgeryDoneAsync(Guid otScheduleId, Guid tenantId, string actorUserId)
            => Task.CompletedTask;
        public Task ReleaseOtScheduleForRebookAsync(Guid otScheduleId, Guid tenantId, string actorUserId)
            => Task.CompletedTask;
        public Task NotifyCounsellingRebookAsync(Guid tenantId, Guid? branchId, Guid? counselingSessionId, string patientName, string reason)
            => Task.CompletedTask;
        public Task NotifyWardPostOpHandoffAsync(Guid tenantId, Guid? branchId, Guid journeyId, string patientName, string? procedureName)
            => Task.CompletedTask;
        public Task NotifyWardChangedAsync(Guid tenantId, Guid? branchId, Guid journeyId, string newState)
            => Task.CompletedTask;
        public Task NotifyPreOpMarkReadyAsync(Guid tenantId, Guid? branchId, Guid journeyId, string patientName, string? procedureName)
            => Task.CompletedTask;
        public Task NotifyClinicalEvaluationMaterialChangeAsync(
            Guid tenantId, Guid? branchId, Guid journeyId, string patientName, string changeType, string details, bool inOt)
            => Task.CompletedTask;
    }

    private sealed class NoOpCcms : ICcmsAdmissionClient
    {
        public Task<CcmsAdmissionValidation> ValidateAdmissionAsync(
            Guid journeyId, Guid? sessionId, Guid tenantId, bool coverageBased, bool emergencyFcApplied = false)
            => Task.FromResult(new CcmsAdmissionValidation(true, "none", null, null, null, null, null));
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
