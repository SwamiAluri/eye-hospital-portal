using System;
using System.Linq;
using System.Threading.Tasks;
using AuthService.Context;
using AuthService.Models.Counselor;
using AuthService.Models.Domain;
using AuthService.Services;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging.Abstractions;
using Xunit;

namespace AuthService.Tests;

/// <summary>
/// Phase2X Slice 1 functional fix — Log Contact + callback master-code → DB CHECK mapping.
/// </summary>
public class CounselorCommunicationServiceTests : IDisposable
{
    private readonly AppDbContext _db;
    private readonly CounselorCommunicationService _svc;
    private readonly Guid _tenant = Guid.Parse("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa");
    private readonly Guid _branch = Guid.Parse("11111111-1111-1111-1111-111111111111");
    private readonly Guid _patient = Guid.Parse("a00000c1-0000-0000-0000-0000000000c1");
    private readonly Guid _session = Guid.Parse("b00000c1-0000-0000-0000-0000000000c1");
    private readonly Guid _user = Guid.Parse("c00000c1-0000-0000-0000-0000000000c1");

    public CounselorCommunicationServiceTests()
    {
        _db = TestDbContextFactory.CreateInMemory();
        _svc = new CounselorCommunicationService(_db, NullLogger<CounselorCommunicationService>.Instance);
        Seed();
    }

    public void Dispose() => _db.Dispose();

    private void Seed()
    {
        _db.Patients.Add(new Patient
        {
            Id = _patient,
            TenantId = _tenant,
            FirstName = "Meenakshi",
            LastName = "Iyer",
            MedicalRecordNumber = "UHID-MI",
            ContactNumber = "9000000011",
            DateOfBirth = new DateTime(1985, 1, 1),
            Gender = "Female",
        });
        _db.CounselingSession.Add(new CounselingSession
        {
            Id = _session,
            TenantId = _tenant,
            BranchId = _branch,
            PatientId = _patient,
            ReferredByDoctorId = Guid.NewGuid(),
            SessionDate = DateTime.UtcNow.Date.AddDays(-3),
            PatientType = "Cash",
            PatientIntention = "Declined",
            ContactAttemptCount = 0,
            EscalationStatus = "Normal",
            CreatedAt = DateTime.UtcNow.AddDays(-3),
            UpdatedAt = DateTime.UtcNow,
        });
        _db.SaveChanges();
    }

    [Fact]
    public async Task AddCommLog_PersistsAndDoesNotClearColdIntention()
    {
        var dto = await _svc.AddCommLogAsync(
            _session,
            new CreateCommLogRequest
            {
                Channel = "Phone",
                Direction = "Outbound",
                Outcome = "Answered",
                ResponseSummary = "Still needs time",
            },
            _tenant,
            _user);

        Assert.Equal("Answered", dto.Outcome);
        var session = await _db.CounselingSession.AsNoTracking().FirstAsync(s => s.Id == _session);
        Assert.Equal("Declined", session.PatientIntention);
        Assert.Equal(1, session.ContactAttemptCount);
        Assert.Equal(1, await _db.CounselorCommunicationLogs.CountAsync(l => l.SessionId == _session));
    }

    [Fact]
    public async Task AddCommLog_MapsLeftMessageOutcome()
    {
        var dto = await _svc.AddCommLogAsync(
            _session,
            new CreateCommLogRequest
            {
                Channel = "Phone",
                Direction = "Outbound",
                Outcome = "LeftMessage",
            },
            _tenant,
            _user);

        Assert.Equal("Voicemail", dto.Outcome);
    }

    [Fact]
    public async Task ScheduleCallback_AcceptsMasterReminderCode()
    {
        var cb = await _svc.ScheduleCallbackAsync(
            _session,
            new ScheduleCallbackRequest
            {
                CallbackType = "REMINDER",
                CallbackDate = new DateTime(2026, 9, 16),
                Channel = "Phone",
                CallbackNotes = "Still needs time",
            },
            _tenant,
            _user);

        Assert.Equal("General", cb.CallbackType);
        Assert.Equal("Phone", cb.Channel);
        Assert.Equal(new DateTime(2026, 9, 16).Date, cb.CallbackDate.Date);
    }

    [Fact]
    public async Task LogContactThenCallback_CreatesExactlyOneOfEach()
    {
        await _svc.AddCommLogAsync(
            _session,
            new CreateCommLogRequest
            {
                Channel = "Phone",
                Direction = "Outbound",
                Outcome = "Answered",
                ResponseSummary = "Still needs time",
            },
            _tenant,
            _user);

        await _svc.ScheduleCallbackAsync(
            _session,
            new ScheduleCallbackRequest
            {
                CallbackType = "REMINDER",
                CallbackDate = new DateTime(2026, 9, 16),
                Channel = "Phone",
            },
            _tenant,
            _user);

        Assert.Equal(1, await _db.CounselorCommunicationLogs.CountAsync(l => l.SessionId == _session && l.DeletedAt == null));
        Assert.Equal(1, await _db.CounselorCallbackRequests.CountAsync(c => c.SessionId == _session && c.DeletedAt == null));

        var session = await _db.CounselingSession.AsNoTracking().FirstAsync(s => s.Id == _session);
        Assert.Equal("Declined", session.PatientIntention);
    }

    [Fact]
    public async Task AddCommLog_RejectsUnknownOutcome_WithoutPersisting()
    {
        await Assert.ThrowsAsync<ArgumentException>(() =>
            _svc.AddCommLogAsync(
                _session,
                new CreateCommLogRequest
                {
                    Channel = "Phone",
                    Direction = "Outbound",
                    Outcome = "TotallyInvalid",
                },
                _tenant,
                _user));

        Assert.Equal(0, await _db.CounselorCommunicationLogs.CountAsync(l => l.SessionId == _session));
    }
}
