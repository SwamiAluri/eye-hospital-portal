using IpManagementService.Data;
using IpManagementService.Models.Domain;
using IpManagementService.Models.Dtos;
using IpManagementService.Services;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging.Abstractions;
using Xunit;

namespace IpManagementService.Tests;

public class JourneyExceptionsAndBedHistoryTests : IDisposable
{
    private readonly ServiceProvider _provider;
    private readonly IpManagementDbContext _db;
    private readonly RecordingBedClient _beds;
    private readonly RecordingNotify _notify;
    private readonly PatientJourneyService _svc;
    private readonly Guid _tenantId = Guid.NewGuid();
    private readonly Guid _actorId = Guid.NewGuid();
    private readonly Guid _branchId = Guid.NewGuid();

    public JourneyExceptionsAndBedHistoryTests()
    {
        var services = new ServiceCollection();
        services.AddDbContext<IpManagementDbContext>(o =>
            o.UseInMemoryDatabase(Guid.NewGuid().ToString("N")));
        _provider = services.BuildServiceProvider();
        _db = _provider.GetRequiredService<IpManagementDbContext>();
        _beds = new RecordingBedClient();
        _notify = new RecordingNotify();
        var ccms = new NoOpCcms();

        _svc = new PatientJourneyService(
            _db,
            _notify,
            ccms,
            Uninit<SurgicalSafetyService>(),
            Uninit<ChecklistGateService>(),
            Uninit<PreOpClearanceService>(),
            Uninit<PreOpReadinessService>(),
            Uninit<WardChecklistAutoSyncService>(),
            new JourneyMutationGuardService(_db),
            new JourneySchedulingGuardService(_db),
            new IntegrationOutboxService(_db, ccms, NullLogger<IntegrationOutboxService>.Instance),
            _beds);
    }

    [Fact]
    public async Task TransferBed_ReleasesOld_OccupiesNew_WritesHistory()
    {
        var oldBed = Guid.NewGuid();
        var newBed = Guid.NewGuid();
        var journey = SeedJourney(ClinicalState.Admitted, assignedBedId: oldBed, admittedAt: DateTime.UtcNow);
        _db.JourneyBedAssignments.Add(new JourneyBedAssignment
        {
            Id = Guid.NewGuid(),
            TenantId = _tenantId,
            PatientJourneyId = journey.Id,
            PatientId = journey.PatientId,
            AssignedBedId = oldBed,
            AssignmentType = BedAssignmentType.Initial,
            StartedAt = DateTime.UtcNow.AddHours(-2),
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow,
            Status = "active",
        });
        await _db.SaveChangesAsync();

        await _svc.TransferBedAsync(journey.Id, _tenantId, _actorId,
            new TransferBedRequest(newBed, Reason: "Ward transfer"));

        var saved = await _db.PatientJourneys.AsNoTracking().SingleAsync(j => j.Id == journey.Id);
        Assert.Equal(newBed, saved.AssignedBedId);
        Assert.Contains(_beds.Actions, a => a.BedId == oldBed && a.Action == "transfer-out");
        Assert.Contains(_beds.Actions, a => a.BedId == newBed && a.Action == "occupy");
        Assert.Contains(_db.JourneyAuditLogs, a => a.Action == "BedTransferred");
        Assert.Contains(_notify.WardChanges, s => s == IpRealtimeEventMapper.BedChanged);
        var history = await _db.JourneyBedAssignments.Where(a => a.PatientJourneyId == journey.Id).ToListAsync();
        Assert.Contains(history, h => h.EndedAt != null);
        Assert.Contains(history, h => h.EndedAt == null && h.AssignmentType == BedAssignmentType.Transfer);
    }

    [Fact]
    public async Task CancelToday_ClosesOpenAssignment_AndVacatesAuth()
    {
        var bedId = Guid.NewGuid();
        var journey = SeedJourney(ClinicalState.ReadyForSurgery, assignedBedId: bedId, admittedAt: DateTime.UtcNow);
        _db.JourneyBedAssignments.Add(new JourneyBedAssignment
        {
            Id = Guid.NewGuid(),
            TenantId = _tenantId,
            PatientJourneyId = journey.Id,
            PatientId = journey.PatientId,
            AssignedBedId = bedId,
            AssignmentType = BedAssignmentType.Initial,
            StartedAt = DateTime.UtcNow.AddHours(-2),
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow,
            Status = "active",
        });
        await _db.SaveChangesAsync();

        await _svc.CancelTodaySurgeryAsync(journey.Id, _tenantId, _actorId,
            new CancelTodaySurgeryRequest("Surgeon unavailable"));

        var saved = await _db.PatientJourneys.AsNoTracking().SingleAsync(j => j.Id == journey.Id);
        Assert.Equal(ClinicalState.CancelledSurgery, saved.ClinicalState);
        Assert.Null(saved.AssignedBedId);
        Assert.Contains(_beds.Actions, a => a.BedId == bedId && a.Action == "vacate");
        Assert.DoesNotContain(
            await _db.JourneyBedAssignments.Where(a => a.PatientJourneyId == journey.Id).ToListAsync(),
            h => h.EndedAt == null);
        Assert.Contains(_db.JourneyAuditLogs, a => a.Action == "CancelTodaySurgery");
    }

    [Fact]
    public async Task TransferBed_OccupyConflict_RestoresPreviousAndDoesNotSwitchPointer()
    {
        var oldBed = Guid.NewGuid();
        var newBed = Guid.NewGuid();
        var journey = SeedJourney(ClinicalState.Admitted, assignedBedId: oldBed, admittedAt: DateTime.UtcNow);
        _beds.FailOnOccupy.Add(newBed);

        await Assert.ThrowsAsync<InvalidOperationException>(() =>
            _svc.TransferBedAsync(journey.Id, _tenantId, _actorId, new TransferBedRequest(newBed)));

        var saved = await _db.PatientJourneys.AsNoTracking().SingleAsync(j => j.Id == journey.Id);
        Assert.Equal(oldBed, saved.AssignedBedId);
        Assert.Contains(_beds.Actions, a => a.BedId == newBed && a.Action == "occupy");
        Assert.Contains(_beds.Actions, a => a.BedId == oldBed && a.Action == "occupy");
    }

    [Fact]
    public async Task TransferBed_ConcurrencyToken_Conflicts()
    {
        var journey = SeedJourney(ClinicalState.Admitted, assignedBedId: Guid.NewGuid(), admittedAt: DateTime.UtcNow);
        var stale = journey.UpdatedAt.AddMinutes(-2);
        await Assert.ThrowsAsync<InvalidOperationException>(() =>
            _svc.TransferBedAsync(journey.Id, _tenantId, _actorId,
                new TransferBedRequest(Guid.NewGuid(), ExpectedUpdatedAt: stale)));
    }

    [Fact]
    public async Task LinkPriorJourney_SetsPriorOnNewExpectedEpisode()
    {
        var patientId = Guid.NewGuid();
        var prior = SeedJourney(ClinicalState.Discharged, patientId: patientId);
        prior.DischargedAt = DateTime.UtcNow.AddDays(-3);
        prior.DischargeType = DischargeType.Routine;
        await _db.SaveChangesAsync();

        var next = SeedJourney(ClinicalState.Expected, patientId: patientId);
        await _svc.LinkPriorJourneyIfNeededAsync(next.Id, _tenantId);

        var saved = await _db.PatientJourneys.AsNoTracking().SingleAsync(j => j.Id == next.Id);
        Assert.Equal(prior.Id, saved.PriorJourneyId);
        Assert.NotEqual(prior.Id, saved.Id);
        Assert.Equal(ClinicalState.Expected, saved.ClinicalState);
        Assert.Equal(ClinicalState.Discharged, (await _db.PatientJourneys.AsNoTracking().SingleAsync(j => j.Id == prior.Id)).ClinicalState);
    }

    [Fact]
    public async Task CancelDischarge_Reopens_Reoccupies_Audits_Notifies()
    {
        var bedId = Guid.NewGuid();
        var journey = SeedJourney(ClinicalState.Discharged, assignedBedId: bedId);
        journey.IsDischarged = true;
        journey.IsLocked = true;
        journey.DischargedAt = DateTime.UtcNow.AddHours(-1);
        journey.DischargeType = DischargeType.Routine;
        journey.ClinicalStateBeforeDischarge = ClinicalState.ReadyForDischarge;
        await _db.SaveChangesAsync();

        var dto = await _svc.CancelDischargeAsync(
            journey.Id, _tenantId, _actorId,
            new CancelDischargeRequest("Wrong patient selected", bedId));

        Assert.Equal(ClinicalState.ReadyForDischarge, dto.ClinicalState);
        var saved = await _db.PatientJourneys.AsNoTracking().SingleAsync(j => j.Id == journey.Id);
        Assert.False(saved.IsDischarged);
        Assert.False(saved.IsLocked);
        Assert.Null(saved.DischargeType);
        Assert.Equal(bedId, saved.AssignedBedId);
        Assert.Contains(_beds.Actions, a => a.BedId == bedId && a.Action == "occupy");
        Assert.Contains(_db.JourneyAuditLogs, a => a.Action == "DischargeCancelled");
        Assert.Contains(_notify.Departments, d => d.Contains("DischargeCancelled"));
    }

    [Fact]
    public async Task CancelDischarge_BlockedWhenAnotherEpisodeIsActive()
    {
        var patientId = Guid.NewGuid();
        var closed = SeedJourney(ClinicalState.Discharged, patientId: patientId);
        closed.IsDischarged = true;
        SeedJourney(ClinicalState.Expected, patientId: patientId);
        await _db.SaveChangesAsync();

        await Assert.ThrowsAsync<InvalidOperationException>(() =>
            _svc.CancelDischargeAsync(closed.Id, _tenantId, _actorId, new CancelDischargeRequest("reopen")));
    }

    [Fact]
    public async Task CancelDischarge_FromAdmitted_IsRejected()
    {
        var journey = SeedJourney(ClinicalState.Admitted, admittedAt: DateTime.UtcNow);
        await Assert.ThrowsAsync<InvalidOperationException>(() =>
            _svc.CancelDischargeAsync(journey.Id, _tenantId, _actorId, new CancelDischargeRequest("no")));
    }

    [Fact]
    public async Task OpenBedAssignment_RejectsSecondOpenRow_EvenInMemory()
    {
        var bedId = Guid.NewGuid();
        var journey = SeedJourney(ClinicalState.Admitted, assignedBedId: bedId, admittedAt: DateTime.UtcNow);
        _db.JourneyBedAssignments.Add(new JourneyBedAssignment
        {
            Id = Guid.NewGuid(),
            TenantId = _tenantId,
            PatientJourneyId = journey.Id,
            PatientId = journey.PatientId,
            AssignedBedId = bedId,
            AssignmentType = BedAssignmentType.Initial,
            StartedAt = DateTime.UtcNow,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow,
            Status = "active",
        });
        await _db.SaveChangesAsync();

        await Assert.ThrowsAsync<InvalidOperationException>(() =>
            _svc.OpenBedAssignmentAsync(journey, _actorId, BedAssignmentType.Transfer, Guid.NewGuid(), bedId, "dup"));
    }

    [Fact]
    public void TypedDischarge_LamaAndDeath_AllowedFromAdmitted_NotFromExpected()
    {
        StateTransitionValidator.ValidateTypedDischarge(ClinicalState.Admitted, DischargeType.Lama);
        StateTransitionValidator.ValidateTypedDischarge(ClinicalState.Admitted, DischargeType.Death);
        Assert.Throws<InvalidOperationException>(() =>
            StateTransitionValidator.ValidateTypedDischarge(ClinicalState.Expected, DischargeType.Lama));
        Assert.Throws<InvalidOperationException>(() =>
            StateTransitionValidator.ValidateTypedDischarge(ClinicalState.InOT, DischargeType.Lama));
        StateTransitionValidator.ValidateTypedDischarge(ClinicalState.InOT, DischargeType.Death);
    }

    [Fact]
    public void DischargeCancelPermission_IsDistinctFromView()
    {
        Assert.Equal("ip.discharge.cancel", IpChecklistAuth.PermDischargeCancel);
        Assert.False(IpChecklistAuth.HasPermission(["ip_management.view"], IpChecklistAuth.PermDischargeCancel));
        Assert.True(IpChecklistAuth.HasPermission(["ip.discharge.cancel"], IpChecklistAuth.PermDischargeCancel));
    }

    [Fact]
    public void DischargeType_NormalizesProductAliases()
    {
        Assert.Equal(DischargeType.Routine, DischargeType.Normalize("NORMAL"));
        Assert.Equal(DischargeType.Lama, DischargeType.Normalize("LAMA"));
        Assert.Equal(DischargeType.Transfer, DischargeType.Normalize("TRANSFER"));
        Assert.Equal(DischargeType.Death, DischargeType.Normalize("DEATH"));
        Assert.Equal(DischargeType.Other, DischargeType.Normalize("OTHER"));
    }

    private PatientJourney SeedJourney(
        string clinical, Guid? assignedBedId = null, DateTime? admittedAt = null, Guid? patientId = null)
    {
        var journey = new PatientJourney
        {
            Id = Guid.NewGuid(),
            TenantId = _tenantId,
            BranchId = _branchId,
            PatientId = patientId ?? Guid.NewGuid(),
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

    private sealed class RecordingBedClient : IAuthBedLifecycleClient
    {
        public HashSet<Guid> FailOnOccupy { get; } = [];
        public List<(Guid BedId, string Action)> Actions { get; } = [];

        public Task<AuthBedSnapshot?> ApplyAsync(
            Guid tenantId, Guid bedId, Guid actorUserId, Guid? patientId, string action)
        {
            Actions.Add((bedId, action));
            if (action is "occupy" or "reserve" && FailOnOccupy.Contains(bedId))
                throw new InvalidOperationException("Bed already occupied.");
            return Task.FromResult<AuthBedSnapshot?>(new AuthBedSnapshot(bedId, "B1", "R1", "Ward A", "Occupied"));
        }

        public Task<IReadOnlyList<AuthBedSnapshot>> ListAsync(Guid tenantId, Guid branchId, string? wardName, Guid? wardId = null)
            => Task.FromResult<IReadOnlyList<AuthBedSnapshot>>(Array.Empty<AuthBedSnapshot>());
    }

    private sealed class RecordingNotify : IPreOpNotificationClient
    {
        public List<string> WardChanges { get; } = [];
        public List<string> Departments { get; } = [];

        public Task NotifyDepartmentAsync(Guid tenantId, Guid? branchId, string departmentCode, string type, string message, string details)
        {
            Departments.Add(type);
            return Task.CompletedTask;
        }
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
        {
            WardChanges.Add(newState);
            return Task.CompletedTask;
        }
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
