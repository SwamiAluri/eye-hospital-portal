using IpManagementService.Data;
using IpManagementService.Models.Domain;
using IpManagementService.Models.Dtos;
using IpManagementService.Services;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging.Abstractions;
using Xunit;

namespace IpManagementService.Tests;

public class SlotServiceTests : IDisposable
{
    private readonly IpManagementDbContext _db;
    private readonly SlotService _svc;
    private readonly Guid _tenantId = Guid.NewGuid();
    private readonly Guid _branchId = Guid.NewGuid();
    private readonly Guid _actorId = Guid.NewGuid();
    private readonly Guid _theatreId = Guid.NewGuid();
    private readonly DateOnly _date = new(2026, 8, 25);

    public SlotServiceTests()
    {
        var options = new DbContextOptionsBuilder<IpManagementDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString("N"))
            .Options;
        _db = new IpManagementDbContext(options);
        var ccms = new NoOpCcms();
        _svc = new SlotService(
            _db,
            new NoOpNotify(),
            new IntegrationOutboxService(_db, ccms, NullLogger<IntegrationOutboxService>.Instance));
    }

    [Fact]
    public async Task Assign_PlacesPatientInMorningSequence_AndCensusLabel()
    {
        var journey = SeedJourney(ClinicalState.ReadyForSurgery);

        var row = await _svc.AssignAsync(_tenantId, _actorId, Request(journey.Id, SlotSession.Morning));

        Assert.Equal("AM-1", row.SlotLabel);
        Assert.Equal(1, row.SequenceNo);
        var saved = await _db.PatientJourneys.SingleAsync(j => j.Id == journey.Id);
        Assert.Equal(row.Id, saved.SlotId);
        Assert.Contains(_db.JourneyAuditLogs, a => a.Action == "SlotAssigned" && a.NewValue == "AM-1");
        Assert.Contains(_db.IntegrationOutboxEvents, e => e.EventType == IntegrationEventTypes.JourneyScheduled);

        var board = await _svc.ListBoardAsync(_tenantId, _branchId, _date, _theatreId);
        Assert.Equal("AM-1", Assert.Single(board.Morning).SlotLabel);
        Assert.DoesNotContain(board.Unassigned, u => u.JourneyId == journey.Id);
    }

    [Fact]
    public async Task Assign_DuplicateSequence_ThrowsConflict()
    {
        var a = SeedJourney(ClinicalState.Admitted);
        var b = SeedJourney(ClinicalState.Admitted);
        await _svc.AssignAsync(_tenantId, _actorId, Request(a.Id, SlotSession.Morning, 1));

        var ex = await Assert.ThrowsAsync<InvalidOperationException>(() =>
            _svc.AssignAsync(_tenantId, _actorId, Request(b.Id, SlotSession.Morning, 1)));
        Assert.Contains("already taken", ex.Message, StringComparison.OrdinalIgnoreCase);
    }

    [Fact]
    public async Task Assign_AfterRelease_ReusesSequence()
    {
        var a = SeedJourney(ClinicalState.Admitted);
        var b = SeedJourney(ClinicalState.Admitted);
        var first = await _svc.AssignAsync(_tenantId, _actorId, Request(a.Id, SlotSession.Morning, 1));
        await _svc.ReleaseAsync(_tenantId, _actorId, first.Id, "No-show");

        var second = await _svc.AssignAsync(_tenantId, _actorId, Request(b.Id, SlotSession.Morning, 1));
        Assert.Equal("AM-1", second.SlotLabel);
        var history = await _svc.ListHistoryAsync(_tenantId, a.Id);
        Assert.Contains(history, h => h.ReleasedAt != null);
    }

    [Fact]
    public async Task Assign_PastSentToOt_Throws()
    {
        var journey = SeedJourney(ClinicalState.SentToOT);
        journey.SentToOtAt = DateTime.UtcNow;
        await _db.SaveChangesAsync();

        await Assert.ThrowsAsync<InvalidOperationException>(() =>
            _svc.AssignAsync(_tenantId, _actorId, Request(journey.Id, SlotSession.Morning)));
    }

    [Fact]
    public async Task Reorder_ResequencesAndAudits()
    {
        var a = SeedJourney(ClinicalState.ReadyForSurgery, "Amit");
        var b = SeedJourney(ClinicalState.ReadyForSurgery, "Meena");
        var c = SeedJourney(ClinicalState.ReadyForSurgery, "Ananya");
        await _svc.AssignAsync(_tenantId, _actorId, Request(a.Id, SlotSession.Morning));
        await _svc.AssignAsync(_tenantId, _actorId, Request(b.Id, SlotSession.Morning));
        await _svc.AssignAsync(_tenantId, _actorId, Request(c.Id, SlotSession.Morning));

        var rows = await _svc.ReorderAsync(_tenantId, _actorId, new ReorderSlotsRequest(
            _branchId, _theatreId, _date, SlotSession.Morning, [c.Id, a.Id, b.Id]));

        Assert.Equal(new[] { c.Id, a.Id, b.Id }, rows.Select(r => r.JourneyId).ToArray());
        Assert.Equal(new[] { 1, 2, 3 }, rows.Select(r => r.SequenceNo).ToArray());
        Assert.Contains(_db.JourneyAuditLogs, x => x.Action == "SlotReordered" && x.PatientJourneyId == c.Id && x.NewValue == "AM-1");
        Assert.Contains(_db.JourneyAuditLogs, x => x.Action == "SlotReordered" && x.PatientJourneyId == a.Id && x.NewValue == "AM-2");
    }

    [Fact]
    public async Task Reorder_StaleRoster_ThrowsConflict()
    {
        var a = SeedJourney(ClinicalState.Admitted);
        var b = SeedJourney(ClinicalState.Admitted);
        await _svc.AssignAsync(_tenantId, _actorId, Request(a.Id, SlotSession.Morning));
        await _svc.AssignAsync(_tenantId, _actorId, Request(b.Id, SlotSession.Morning));

        var ex = await Assert.ThrowsAsync<InvalidOperationException>(() =>
            _svc.ReorderAsync(_tenantId, _actorId, new ReorderSlotsRequest(
                _branchId, _theatreId, _date, SlotSession.Morning, [a.Id])));
        Assert.Contains("roster", ex.Message, StringComparison.OrdinalIgnoreCase);
    }

    [Fact]
    public async Task Reorder_ThenAssignInterleaved_SecondReorderConflicts()
    {
        var a = SeedJourney(ClinicalState.Admitted);
        var b = SeedJourney(ClinicalState.Admitted);
        var c = SeedJourney(ClinicalState.Admitted);
        await _svc.AssignAsync(_tenantId, _actorId, Request(a.Id, SlotSession.Morning));
        await _svc.AssignAsync(_tenantId, _actorId, Request(b.Id, SlotSession.Morning));

        var firstOrder = new ReorderSlotsRequest(_branchId, _theatreId, _date, SlotSession.Morning, [b.Id, a.Id]);
        await _svc.ReorderAsync(_tenantId, _actorId, firstOrder);
        await _svc.AssignAsync(_tenantId, _actorId, Request(c.Id, SlotSession.Morning));

        await Assert.ThrowsAsync<InvalidOperationException>(() =>
            _svc.ReorderAsync(_tenantId, _actorId, firstOrder));
    }

    [Fact]
    public async Task Throughput_Period_CountsAssignedAndArrivalToDischarge()
    {
        var a = SeedJourney(ClinicalState.Admitted);
        var b = SeedJourney(ClinicalState.ReadyForSurgery);
        var start = _date.ToDateTime(new TimeOnly(8, 0), DateTimeKind.Utc);
        a.DischargedAt = start.AddMinutes(90);
        a.SurgeryEndedAt = start.AddMinutes(40);
        await _db.SaveChangesAsync();

        await _svc.AssignAsync(_tenantId, _actorId, Request(a.Id, SlotSession.Morning, 1));
        await _svc.AssignAsync(_tenantId, _actorId, Request(b.Id, SlotSession.Morning, 2));

        var report = await _svc.GetThroughputAsync(_tenantId, _branchId, _date, _date, _theatreId);

        Assert.Equal(2, report.AssignedCount);
        Assert.Equal(1, report.ReadyCount);
        Assert.Equal(1, report.DischargedCount);
        Assert.NotNull(report.AvgArrivalToDischargeMinutes);
        Assert.Equal(2, Assert.Single(report.BySession).AssignedCount);
        Assert.Equal(_date, report.From);
        Assert.Equal(_date, report.To);
        Assert.Equal(0, report.VitalsOverrideCount);
        Assert.Equal(0, report.IolMismatchOverrideCount);
    }

    [Fact]
    public async Task Throughput_CountsVitalsAndIolSafetyAudits_OnSlottedJourneys()
    {
        var slotted = SeedJourney(ClinicalState.ReadyForSurgery);
        var otherTheatre = SeedJourney(ClinicalState.ReadyForSurgery);
        var unslotted = SeedJourney(ClinicalState.Admitted);
        await _svc.AssignAsync(_tenantId, _actorId, Request(slotted.Id, SlotSession.Morning, 1));
        await _svc.AssignAsync(_tenantId, _actorId, new AssignSlotRequest(
            otherTheatre.Id, _branchId, Guid.NewGuid(), _date, SlotSession.Morning, 1, null, "Theatre 2"));

        var inWindow = _date.ToDateTime(new TimeOnly(10, 0), DateTimeKind.Utc);
        SeedAudit(slotted.Id, JourneyClinicalAudit.VitalsWarningAcknowledged, inWindow);
        SeedAudit(slotted.Id, JourneyClinicalAudit.ImplantMismatchOverridden, inWindow);
        SeedAudit(slotted.Id, JourneyClinicalAudit.ImplantMismatchOverridden, inWindow.AddMinutes(5));
        SeedAudit(otherTheatre.Id, JourneyClinicalAudit.VitalsWarningAcknowledged, inWindow);
        SeedAudit(unslotted.Id, JourneyClinicalAudit.VitalsWarningAcknowledged, inWindow);
        SeedAudit(slotted.Id, JourneyClinicalAudit.VitalsWarningAcknowledged,
            _date.AddDays(-1).ToDateTime(new TimeOnly(10, 0), DateTimeKind.Utc));

        var theatreReport = await _svc.GetThroughputAsync(_tenantId, _branchId, _date, _date, _theatreId);
        Assert.Equal(1, theatreReport.VitalsOverrideCount);
        Assert.Equal(2, theatreReport.IolMismatchOverrideCount);

        var branchReport = await _svc.GetThroughputAsync(_tenantId, _branchId, _date, _date, null);
        Assert.Equal(2, branchReport.VitalsOverrideCount);
        Assert.Equal(2, branchReport.IolMismatchOverrideCount);
    }

    [Fact]
    public async Task Throughput_RejectsInvertedRange()
    {
        await Assert.ThrowsAsync<ArgumentException>(() =>
            _svc.GetThroughputAsync(_tenantId, _branchId, _date.AddDays(1), _date, null));
    }

    private AssignSlotRequest Request(Guid journeyId, string session, int? sequence = null)
        => new(journeyId, _branchId, _theatreId, _date, session, sequence, null, "Theatre 1");

    private PatientJourney SeedJourney(string clinical, string? uhid = null)
    {
        var journey = new PatientJourney
        {
            Id = Guid.NewGuid(),
            TenantId = _tenantId,
            BranchId = _branchId,
            PatientId = Guid.NewGuid(),
            Uhid = uhid,
            ClinicalState = clinical,
            OtState = OtState.NotSent,
            FinancialState = FinancialState.Draft,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow,
            Status = "active",
        };
        _db.PatientJourneys.Add(journey);
        _db.SaveChanges();
        return journey;
    }

    private void SeedAudit(Guid journeyId, string action, DateTime performedAt)
    {
        _db.JourneyAuditLogs.Add(new JourneyAuditLog
        {
            Id = Guid.NewGuid(),
            TenantId = _tenantId,
            PatientJourneyId = journeyId,
            Action = action,
            StateType = action == JourneyClinicalAudit.VitalsWarningAcknowledged ? "Vitals" : "Implant",
            PerformedAt = performedAt,
            CreatedAt = performedAt,
            UpdatedAt = performedAt,
            Status = "active",
        });
        _db.SaveChanges();
    }

    public void Dispose() => _db.Dispose();

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
