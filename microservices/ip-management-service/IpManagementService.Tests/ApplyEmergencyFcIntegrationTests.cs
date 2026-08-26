using IpManagementService.Data;
using IpManagementService.Models.Domain;
using IpManagementService.Models.Dtos;
using IpManagementService.Services;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging.Abstractions;
using Xunit;

namespace IpManagementService.Tests;

public class ApplyEmergencyFcIntegrationTests : IDisposable
{
    private readonly ServiceProvider _provider;
    private readonly IpManagementDbContext _db;
    private readonly RecordingNotifyCcms _ccms;
    private readonly PatientJourneyService _svc;
    private readonly Guid _tenantId = Guid.NewGuid();
    private readonly Guid _actorId = Guid.NewGuid();

    public ApplyEmergencyFcIntegrationTests()
    {
        var services = new ServiceCollection();
        services.AddDbContext<IpManagementDbContext>(o =>
            o.UseInMemoryDatabase(Guid.NewGuid().ToString("N")));
        _provider = services.BuildServiceProvider();
        _db = _provider.GetRequiredService<IpManagementDbContext>();
        _ccms = new RecordingNotifyCcms();

        var mutationGuard = new JourneyMutationGuardService(_db);
        var schedulingGuard = new JourneySchedulingGuardService(_db);
        var outbox = new IntegrationOutboxService(_db, _ccms, NullLogger<IntegrationOutboxService>.Instance);

        _svc = new PatientJourneyService(
            _db,
            new NoOpNotify(),
            _ccms,
            Uninit<SurgicalSafetyService>(),
            Uninit<ChecklistGateService>(),
            Uninit<PreOpClearanceService>(),
            Uninit<PreOpReadinessService>(),
            Uninit<WardChecklistAutoSyncService>(),
            mutationGuard,
            schedulingGuard,
            outbox);
    }

    [Fact]
    public async Task ApplyEmergencyFc_PersistsReasonActorAudit_AndNotifiesCcms()
    {
        var journey = new PatientJourney
        {
            Id = Guid.NewGuid(),
            TenantId = _tenantId,
            BranchId = Guid.NewGuid(),
            PatientId = Guid.NewGuid(),
            ClinicalState = ClinicalState.Expected,
            PaymentMode = "Insurance",
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow,
            Status = "active",
        };
        _db.PatientJourneys.Add(journey);
        await _db.SaveChangesAsync();

        var caseId = Guid.NewGuid();
        _ccms.CaseId = caseId;

        var dto = await _svc.ApplyEmergencyFcAsync(
            journey.Id, _tenantId, _actorId,
            new EmergencyFcRequest("Trauma overnight — surgery cannot wait", false, false, false));

        Assert.True(dto.EmergencyFcApplied);

        var saved = await _db.PatientJourneys.AsNoTracking().SingleAsync(j => j.Id == journey.Id);
        Assert.True(saved.EmergencyFcApplied);
        Assert.Equal(_actorId, saved.EmergencyFcApprovedBy);
        Assert.Equal("Trauma overnight — surgery cannot wait", saved.EmergencyFcReason);

        var audit = await _db.JourneyAuditLogs.SingleAsync(a => a.Action == "EmergencyFcApplied");
        Assert.Contains("Trauma overnight", audit.NewValue);
        Assert.Contains(caseId.ToString(), audit.NewValue);
        Assert.Equal(_actorId, audit.PerformedByUserId);
        Assert.Equal(journey.Id, audit.CorrelationId);
        Assert.Equal("Trauma overnight — surgery cannot wait", audit.Notes);

        Assert.Single(_ccms.EmergencyFcNotifies);
        Assert.Equal(journey.Id, _ccms.EmergencyFcNotifies[0].JourneyId);
        Assert.Equal("Trauma overnight — surgery cannot wait", _ccms.EmergencyFcNotifies[0].Reason);
    }

    [Fact]
    public async Task ApplyEmergencyFc_EmptyReason_Throws()
    {
        var journey = new PatientJourney
        {
            Id = Guid.NewGuid(),
            TenantId = _tenantId,
            BranchId = Guid.NewGuid(),
            PatientId = Guid.NewGuid(),
            ClinicalState = ClinicalState.Expected,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow,
            Status = "active",
        };
        _db.PatientJourneys.Add(journey);
        await _db.SaveChangesAsync();

        await Assert.ThrowsAsync<ArgumentException>(() =>
            _svc.ApplyEmergencyFcAsync(journey.Id, _tenantId, _actorId, new EmergencyFcRequest("  ", false, false, false)));
        Assert.Empty(_ccms.EmergencyFcNotifies);
    }

    [Fact]
    public async Task ApplyEmergencyFc_SecondCall_IsIdempotent()
    {
        var journey = new PatientJourney
        {
            Id = Guid.NewGuid(),
            TenantId = _tenantId,
            BranchId = Guid.NewGuid(),
            PatientId = Guid.NewGuid(),
            ClinicalState = ClinicalState.Expected,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow,
            Status = "active",
        };
        _db.PatientJourneys.Add(journey);
        await _db.SaveChangesAsync();
        var req = new EmergencyFcRequest("Trauma overnight — surgery cannot wait", false, false, false);
        await _svc.ApplyEmergencyFcAsync(journey.Id, _tenantId, _actorId, req);
        await _svc.ApplyEmergencyFcAsync(journey.Id, _tenantId, _actorId, req);
        Assert.Equal(1, await _db.JourneyAuditLogs.CountAsync(a => a.Action == "EmergencyFcApplied"));
        Assert.Single(_ccms.EmergencyFcNotifies);
    }

    public void Dispose()
    {
        _db.Dispose();
        _provider.Dispose();
    }

    private static T Uninit<T>() where T : class =>
        (T)System.Runtime.Serialization.FormatterServices.GetUninitializedObject(typeof(T));

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

    private sealed class RecordingNotifyCcms : ICcmsAdmissionClient
    {
        public Guid? CaseId { get; set; }
        public List<(Guid JourneyId, string Reason)> EmergencyFcNotifies { get; } = new();

        public Task<CcmsAdmissionValidation> ValidateAdmissionAsync(
            Guid journeyId, Guid? sessionId, Guid tenantId, bool coverageBased, bool emergencyFcApplied = false)
            => Task.FromResult(new CcmsAdmissionValidation(
                false, "block", null, "pending", CaseId, null, null, "BLOCK", "WAITING_APPROVAL"));

        public Task NotifyEmergencyFcAppliedAsync(
            Guid journeyId, Guid? sessionId, Guid tenantId, Guid actorUserId, string reason)
        {
            EmergencyFcNotifies.Add((journeyId, reason));
            return Task.CompletedTask;
        }

        public Task DeliverOutboxEventAsync(string eventType, string payloadJson, string idempotencyKey)
            => Task.CompletedTask;
        public Task NotifySurgeryCompletedAsync(Guid journeyId, Guid? sessionId, Guid tenantId, Guid actorUserId)
            => Task.CompletedTask;
        public Task NotifyPatientDischargedAsync(Guid journeyId, Guid? sessionId, Guid tenantId, Guid actorUserId)
            => Task.CompletedTask;
    }
}
