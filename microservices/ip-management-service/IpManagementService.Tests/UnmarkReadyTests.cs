using IpManagementService.Data;
using IpManagementService.Models.Domain;
using IpManagementService.Models.Dtos;
using IpManagementService.Services;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging.Abstractions;
using Xunit;

namespace IpManagementService.Tests;

public class UnmarkReadyTests : IDisposable
{
    private readonly ServiceProvider _provider;
    private readonly IpManagementDbContext _db;
    private readonly RecordingNotify _notify;
    private readonly JourneyCommandAuthContext _auth;
    private readonly PatientJourneyService _svc;
    private readonly Guid _tenantId = Guid.NewGuid();
    private readonly Guid _actorId = Guid.NewGuid();
    private readonly Guid _branchId = Guid.NewGuid();

    public UnmarkReadyTests()
    {
        var services = new ServiceCollection();
        services.AddDbContext<IpManagementDbContext>(o =>
            o.UseInMemoryDatabase(Guid.NewGuid().ToString("N")));
        _provider = services.BuildServiceProvider();
        _db = _provider.GetRequiredService<IpManagementDbContext>();
        _notify = new RecordingNotify();
        _auth = new JourneyCommandAuthContext();
        var ccms = new NoOpCcmsAdmissionClient();
        var gates = new ChecklistGateService(
            _db,
            Uninit<SurgicalSafetyService>(),
            Uninit<AnaesthesiaMonitoringService>(),
            Uninit<PacAssessmentService>(),
            Uninit<WardInvestigationChecklistService>());

        _svc = new PatientJourneyService(
            _db,
            _notify,
            ccms,
            Uninit<SurgicalSafetyService>(),
            gates,
            Uninit<PreOpClearanceService>(),
            Uninit<PreOpReadinessService>(),
            new WardChecklistAutoSyncService(_db, _provider),
            new JourneyMutationGuardService(_db),
            new JourneySchedulingGuardService(_db),
            new IntegrationOutboxService(_db, ccms, NullLogger<IntegrationOutboxService>.Instance),
            beds: null,
            commandAuth: _auth);
    }

    [Fact]
    public async Task UnmarkReady_WithReason_ReturnsToAdmitted_AuditsAndEmitsOutbox()
    {
        var journey = SeedReady();
        var reason = "BP 180/100, deferred pending physician review";

        var result = await _svc.TransitionClinicalAsync(
            journey.Id, _tenantId, _actorId,
            new TransitionRequest(ClinicalState.Admitted, reason));

        Assert.Equal(ClinicalState.Admitted, result.ClinicalState);
        var saved = await _db.PatientJourneys.AsNoTracking().SingleAsync(j => j.Id == journey.Id);
        Assert.Equal(ClinicalState.Admitted, saved.ClinicalState);
        Assert.Equal(reason, saved.UnmarkReadyReason);
        Assert.NotNull(saved.UnmarkedReadyAt);
        Assert.Equal(_actorId, saved.UnmarkedReadyByUserId);
        Assert.Null(saved.InformedOtTeamAt);

        var audit = Assert.Single(_db.JourneyAuditLogs, a => a.Action == "ClinicalStateReverted");
        Assert.Equal(reason, audit.Notes);
        Assert.NotNull(audit.CorrelationId);
        Assert.Equal(ClinicalState.ReadyForSurgery, audit.OldValue);
        Assert.Equal(ClinicalState.Admitted, audit.NewValue);

        var evt = Assert.Single(_db.IntegrationOutboxEvents);
        Assert.Equal(IntegrationEventTypes.JourneyReadyReverted, evt.EventType);
        Assert.Equal(audit.CorrelationId, evt.CorrelationId);
        Assert.Contains(_notify.Departments, t => t == IpRealtimeEventMapper.JourneyReadyReverted);
        Assert.Contains(_notify.WardChanges, s => s == IpRealtimeEventMapper.JourneyReadyReverted);
        Assert.DoesNotContain(ClinicalState.Admitted, _notify.WardChanges);
    }

    [Fact]
    public async Task UnmarkReady_WithoutReason_IsRejected()
    {
        var journey = SeedReady();
        await Assert.ThrowsAsync<ArgumentException>(() =>
            _svc.TransitionClinicalAsync(
                journey.Id, _tenantId, _actorId,
                new TransitionRequest(ClinicalState.Admitted, "short")));
        var saved = await _db.PatientJourneys.AsNoTracking().SingleAsync(j => j.Id == journey.Id);
        Assert.Equal(ClinicalState.ReadyForSurgery, saved.ClinicalState);
    }

    [Fact]
    public async Task UnmarkReady_AfterSentToOt_IsRejected()
    {
        var journey = SeedReady();
        journey.OtState = OtState.SentToOT;
        await _db.SaveChangesAsync();

        var ex = await Assert.ThrowsAsync<InvalidOperationException>(() =>
            _svc.TransitionClinicalAsync(
                journey.Id, _tenantId, _actorId,
                new TransitionRequest(ClinicalState.Admitted, "BP high, drops not instilled")));
        Assert.Contains("sent to theatre", ex.Message, StringComparison.OrdinalIgnoreCase);
    }

    [Fact]
    public async Task UnmarkReady_WithoutPermission_IsRejected()
    {
        _auth.Bind(["ip.ot.mark_ready", "ward.checklist.edit"]);
        var journey = SeedReady();
        await Assert.ThrowsAsync<UnauthorizedAccessException>(() =>
            _svc.TransitionClinicalAsync(
                journey.Id, _tenantId, _actorId,
                new TransitionRequest(ClinicalState.Admitted, "BP high, deferred for review")));
    }

    [Fact]
    public async Task UnmarkReady_WithPermission_Succeeds()
    {
        _auth.Bind(["ip.ot.unmark_ready", "ip.ot.mark_ready"]);
        var journey = SeedReady();

        var result = await _svc.TransitionClinicalAsync(
            journey.Id, _tenantId, _actorId,
            new TransitionRequest(ClinicalState.Admitted, "Consent withdrawn this morning"));
        Assert.Equal(ClinicalState.Admitted, result.ClinicalState);
    }

    [Fact]
    public async Task ReverseMarkReady_UnchecksOnlyAutoSyncedInformedOtTeam()
    {
        var journey = SeedReady();
        var item = new PreOpSectionItem
        {
            Id = Guid.NewGuid(),
            ItemKey = WardChecklistAutoSyncService.InformedOtKey,
            ItemLabel = "Informed OT",
            Category = "Ward",
            FormCode = WardChecklistService.WardFormCode,
            FormContext = WardChecklistService.WardFormContext,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow,
            Status = "active",
        };
        var clearance = new PreOpClearance
        {
            Id = Guid.NewGuid(),
            TenantId = _tenantId,
            JourneyId = journey.Id,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow,
            Status = "active",
        };
        var auto = new PreOpCompletion
        {
            Id = Guid.NewGuid(),
            TenantId = _tenantId,
            ClearanceId = clearance.Id,
            ItemId = item.Id,
            IsCompleted = true,
            Notes = "Auto-synced on Mark Ready",
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow,
            Status = "active",
        };
        _db.PreOpSectionItems.Add(item);
        _db.PreOpClearances.Add(clearance);
        _db.PreOpCompletions.Add(auto);
        await _db.SaveChangesAsync();

        await _svc.TransitionClinicalAsync(
            journey.Id, _tenantId, _actorId,
            new TransitionRequest(ClinicalState.Admitted, "Drops not instilled, hold OT"));

        var saved = await _db.PreOpCompletions.AsNoTracking().SingleAsync(c => c.Id == auto.Id);
        Assert.False(saved.IsCompleted);
        Assert.Equal("Reversed on Un-mark Ready", saved.Notes);
    }

    [Fact]
    public async Task ReverseMarkReady_LeavesManualInformedOtTeamCompleted()
    {
        var journey = SeedReady();
        var item = new PreOpSectionItem
        {
            Id = Guid.NewGuid(),
            ItemKey = WardChecklistAutoSyncService.InformedOtKey,
            ItemLabel = "Informed OT",
            Category = "Ward",
            FormCode = WardChecklistService.WardFormCode,
            FormContext = WardChecklistService.WardFormContext,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow,
            Status = "active",
        };
        var clearance = new PreOpClearance
        {
            Id = Guid.NewGuid(),
            TenantId = _tenantId,
            JourneyId = journey.Id,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow,
            Status = "active",
        };
        var manual = new PreOpCompletion
        {
            Id = Guid.NewGuid(),
            TenantId = _tenantId,
            ClearanceId = clearance.Id,
            ItemId = item.Id,
            IsCompleted = true,
            Notes = "Nurse completed at bedside",
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow,
            Status = "active",
        };
        _db.PreOpSectionItems.Add(item);
        _db.PreOpClearances.Add(clearance);
        _db.PreOpCompletions.Add(manual);
        await _db.SaveChangesAsync();

        await _svc.TransitionClinicalAsync(
            journey.Id, _tenantId, _actorId,
            new TransitionRequest(ClinicalState.Admitted, "Drops not instilled, hold OT"));

        var saved = await _db.PreOpCompletions.AsNoTracking().SingleAsync(c => c.Id == manual.Id);
        Assert.True(saved.IsCompleted);
        Assert.Equal("Nurse completed at bedside", saved.Notes);
    }

    private PatientJourney SeedReady()
    {
        var journey = new PatientJourney
        {
            Id = Guid.NewGuid(),
            TenantId = _tenantId,
            BranchId = _branchId,
            PatientId = Guid.NewGuid(),
            ClinicalState = ClinicalState.ReadyForSurgery,
            OtState = OtState.NotSent,
            FinancialState = FinancialState.Draft,
            InformedOtTeamAt = DateTime.UtcNow,
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
}
