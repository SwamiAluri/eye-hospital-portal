using IpManagementService.Models.Domain;
using IpManagementService.Models.Dtos;
using IpManagementService.Services;
using Xunit;

namespace IpManagementService.Tests;

public class FollowupAppointmentLockTests
{
    private static PatientJourney Journey(DateTime? surgery = null, DateTime? admitted = null)
        => new()
        {
            Id = Guid.NewGuid(),
            PatientId = Guid.Parse("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa"),
            TenantId = Guid.NewGuid(),
            SurgeryStartedAt = surgery,
            AdmittedAt = admitted,
            CreatedAt = new DateTime(2026, 8, 1, 8, 0, 0, DateTimeKind.Utc),
        };

    private static AuthAppointmentStatus Ok(DateTime when, Guid? patientId = null, bool cancelled = false)
        => new(true, cancelled ? "Cancelled" : "Scheduled", when, Guid.NewGuid(),
            patientId ?? Guid.Parse("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa"), cancelled);

    [Fact]
    public async Task MissingId_BlocksDischarge()
    {
        var warnings = new List<ChecklistGateWarningDto>();
        await FollowupAppointmentLock.AddDischargeBlockAsync(
            warnings, null, Journey(), Guid.NewGuid(), new StubAppointmentClient(null));

        var w = Assert.Single(warnings);
        Assert.Equal(FollowupAppointmentLock.MissingCode, w.Code);
        Assert.Equal("block", w.Severity);
        Assert.True(w.CanOverride);
    }

    [Fact]
    public async Task CancelledAppointment_StillBlocks()
    {
        var warnings = new List<ChecklistGateWarningDto>();
        var apptId = Guid.NewGuid();
        var client = new StubAppointmentClient(Ok(DateTime.UtcNow.AddDays(7), cancelled: true));

        await FollowupAppointmentLock.AddDischargeBlockAsync(
            warnings, apptId, Journey(DateTime.UtcNow.AddDays(-1)), Guid.NewGuid(), client);

        Assert.Contains(warnings, w => w.Code == FollowupAppointmentLock.MissingCode);
    }

    [Fact]
    public async Task BookedFutureVisit_DoesNotBlock()
    {
        var warnings = new List<ChecklistGateWarningDto>();
        var surgery = new DateTime(2026, 8, 20, 10, 0, 0, DateTimeKind.Utc);
        var client = new StubAppointmentClient(Ok(surgery.AddDays(7)));

        await FollowupAppointmentLock.AddDischargeBlockAsync(
            warnings, Guid.NewGuid(), Journey(surgery), Guid.NewGuid(), client);

        Assert.Empty(warnings);
    }

    [Fact]
    public async Task DateBeforeSurgery_Blocks()
    {
        var warnings = new List<ChecklistGateWarningDto>();
        var surgery = new DateTime(2026, 8, 20, 10, 0, 0, DateTimeKind.Utc);
        var client = new StubAppointmentClient(Ok(surgery.AddDays(-1)));

        await FollowupAppointmentLock.AddDischargeBlockAsync(
            warnings, Guid.NewGuid(), Journey(surgery), Guid.NewGuid(), client);

        Assert.Contains(warnings, w => w.Code == FollowupAppointmentLock.MissingCode);
    }

    [Fact]
    public async Task AuthUnreachable_FailClosed()
    {
        var warnings = new List<ChecklistGateWarningDto>();
        await FollowupAppointmentLock.AddDischargeBlockAsync(
            warnings, Guid.NewGuid(), Journey(), Guid.NewGuid(), new ThrowingAppointmentClient());

        var w = Assert.Single(warnings);
        Assert.Equal(FollowupAppointmentLock.MissingCode, w.Code);
        Assert.Contains("could not be verified", w.Message, StringComparison.OrdinalIgnoreCase);
    }

    [Fact]
    public async Task WrongPatient_Blocks()
    {
        var warnings = new List<ChecklistGateWarningDto>();
        var other = Guid.Parse("bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb");
        var client = new StubAppointmentClient(Ok(DateTime.UtcNow.AddDays(3), patientId: other));

        await FollowupAppointmentLock.AddDischargeBlockAsync(
            warnings, Guid.NewGuid(), Journey(DateTime.UtcNow.AddDays(-1)), Guid.NewGuid(), client);

        Assert.Contains(warnings, w => w.Code == FollowupAppointmentLock.MissingCode);
    }

    [Fact]
    public void OverrideClearsFollowupAndMoney_NotOtherBlocks()
    {
        var warnings = new List<ChecklistGateWarningDto>
        {
            new("followup_appointment_missing", "x", "block", true),
            new("patient_obligation_outstanding", "y", "block", true, DischargeBlockerCategory.Financial),
        };
        Assert.True(DischargeOverridePolicy.ClearsHardBlocks(warnings, true));
        Assert.False(DischargeOverridePolicy.ClearsHardBlocks(warnings, false));

        warnings.Add(new("who_timeout_incomplete", "z", "block", false));
        Assert.False(DischargeOverridePolicy.ClearsHardBlocks(warnings, true));
    }

    private sealed class StubAppointmentClient : IAuthAppointmentStatusClient
    {
        private readonly AuthAppointmentStatus? _status;
        public StubAppointmentClient(AuthAppointmentStatus? status) => _status = status;
        public Task<AuthAppointmentStatus> GetStatusAsync(Guid appointmentId, Guid tenantId)
            => Task.FromResult(_status ?? new AuthAppointmentStatus(false, null, null, null, null, true));
    }

    private sealed class ThrowingAppointmentClient : IAuthAppointmentStatusClient
    {
        public Task<AuthAppointmentStatus> GetStatusAsync(Guid appointmentId, Guid tenantId)
            => throw new InvalidOperationException("Appointment service unavailable.");
    }
}
