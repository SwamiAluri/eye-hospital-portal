using System;
using System.Linq;
using System.Threading.Tasks;
using AuthService.Context;
using AuthService.Models.Counselor;
using AuthService.Models.Domain;
using AuthService.Models.Identity;
using AuthService.Services;
using AuthService.Services.Interfaces;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using Moq;
using Xunit;

namespace AuthService.Tests;

/// <summary>
/// Phase 3I PD-C — CreateSession reuse vs new episode (SurgeryDone boundary from OtFinalizeSchedules).
/// </summary>
public class Phase3IPdCCreateSessionReuseTests : IDisposable
{
    private readonly AppDbContext _db;
    private readonly CounselingWorkflowService _svc;
    private readonly IFollowupBranchAccessService _branchAccess;

    private readonly Guid _tenant = Guid.Parse("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa");
    private readonly Guid _branchA = Guid.Parse("11111111-1111-1111-1111-111111111111");
    private readonly Guid _admin = Guid.Parse("a0000001-0000-0000-0000-000000000001");
    private readonly Guid _counsellor = Guid.Parse("c0000001-0000-0000-0000-000000000001");
    private readonly Guid _patient = Guid.Parse("f1000001-0000-0000-0000-000000000001");
    private readonly Guid _patientB = Guid.Parse("f1000002-0000-0000-0000-000000000002");
    private readonly Guid _doctor = Guid.Parse("e1000001-0000-0000-0000-000000000001");

    public Phase3IPdCCreateSessionReuseTests()
    {
        _db = TestDbContextFactory.CreateInMemory();
        _branchAccess = new FollowupBranchAccessService(_db);
        _svc = CreateWorkflowService(_db, _branchAccess);
        Seed();
    }

    public void Dispose() => _db.Dispose();

    private static CounselingWorkflowService CreateWorkflowService(
        AppDbContext db,
        IFollowupBranchAccessService branchAccess)
    {
        var logger = new Mock<ILogger<CounselingWorkflowService>>();
        var blob = new Mock<IBlobStorageService>();
        var http = new Mock<System.Net.Http.IHttpClientFactory>();
        var config = new Mock<IConfiguration>();
        config.Setup(c => c["CcmsService:BaseUrl"]).Returns("http://localhost:7075/api");
        config.Setup(c => c["InternalApi:Key"]).Returns(string.Empty);
        var notifier = new Mock<IQueueDisplayNotifier>();
        return new CounselingWorkflowService(
            db, logger.Object, blob.Object, http.Object, config.Object, notifier.Object, branchAccess,
            new Mock<IAuditService>().Object);
    }

    private void Seed()
    {
        _db.Users.Add(new AppUser
        {
            Id = _admin,
            TenantId = _tenant,
            UserName = "admin@test",
            NormalizedUserName = "ADMIN@TEST",
            Email = "admin@test",
            NormalizedEmail = "ADMIN@TEST",
            FirstName = "Admin",
            LastName = "User",
            BranchId = _branchA,
            UserType = "Admin",
        });
        _db.UserBranches.Add(new UserBranch
        {
            Id = Guid.NewGuid(),
            TenantId = _tenant,
            UserId = _admin,
            BranchId = _branchA,
            Status = "active",
            EffectiveFrom = DateTime.UtcNow.AddDays(-30),
        });
        _db.Users.Add(new AppUser
        {
            Id = _counsellor,
            TenantId = _tenant,
            UserName = "amelia@test",
            NormalizedUserName = "AMELIA@TEST",
            Email = "amelia@test",
            NormalizedEmail = "AMELIA@TEST",
            FirstName = "Amelia",
            LastName = "Martinez",
            BranchId = _branchA,
            UserType = "Counsellor",
        });
        _db.UserBranches.Add(new UserBranch
        {
            Id = Guid.NewGuid(),
            TenantId = _tenant,
            UserId = _counsellor,
            BranchId = _branchA,
            Status = "active",
            EffectiveFrom = DateTime.UtcNow.AddDays(-30),
        });
        _db.Patients.Add(new Patient
        {
            Id = _patient,
            TenantId = _tenant,
            BranchId = _branchA,
            FirstName = "Pat",
            LastName = "Ent",
            MedicalRecordNumber = "MRN-PDC",
            DateOfBirth = new DateTime(1990, 1, 1),
            Gender = "Female",
        });
        _db.Patients.Add(new Patient
        {
            Id = _patientB,
            TenantId = _tenant,
            BranchId = _branchA,
            FirstName = "Other",
            LastName = "Patient",
            MedicalRecordNumber = "MRN-PDC-B",
            DateOfBirth = new DateTime(1985, 1, 1),
            Gender = "Male",
        });
        _db.SaveChanges();
    }

    private CreateCounselingSessionRequest CreateRequest(Guid? patientId = null) => new()
    {
        TenantId = _tenant,
        BranchId = _branchA,
        PatientId = patientId ?? _patient,
        ReferredByDoctorId = _doctor,
        PatientType = "Cash",
        SessionType = "Initial",
        SessionDate = DateTime.UtcNow.Date,
        AddToQueue = false,
    };

    private async Task<(Guid SessionId, int Version)> SeedSessionAsync(
        Guid patientId,
        Guid? counselorId,
        bool? patientAgreed,
        string queueStatus,
        string sessionStatus = "Scheduled")
    {
        var created = await _svc.CreateSessionAsync(CreateRequest(patientId), counselorId.HasValue ? _counsellor : _admin);
        Assert.True(created.Success);
        var sessionId = created.SessionId!.Value;
        var session = await _db.CounselingSession.FirstAsync(s => s.Id == sessionId);
        session.Status = sessionStatus;
        session.PatientAgreedToSurgery = patientAgreed;
        if (counselorId.HasValue)
            session.CounselorId = counselorId;
        else
            session.CounselorId = null;
        _db.CounselorQueue.Add(new CounselorQueueItem
        {
            Id = Guid.NewGuid(),
            TenantId = _tenant,
            BranchId = _branchA,
            SessionId = sessionId,
            PatientId = patientId,
            TokenNumber = $"T-{sessionId.ToString()[..8]}",
            QueueType = "Counseling",
            QueuePosition = 1,
            Status = queueStatus,
            AddedToQueueAt = DateTime.UtcNow,
            CreatedAt = DateTime.UtcNow,
        });
        await _db.SaveChangesAsync();
        return (sessionId, session.Version);
    }

    private async Task SeedSurgeryDoneAsync(Guid sessionId, Guid patientId)
    {
        _db.OtFinalizeSchedules.Add(new OtFinalizeSchedule
        {
            Id = Guid.NewGuid(),
            TenantId = _tenant,
            BranchId = _branchA,
            PatientId = patientId,
            PatientName = "Pat Ent",
            SurgeryName = "Phaco",
            CounsellingSessionId = sessionId,
            Status = OtFinalizeStatus.SurgeryDone,
            CreatedAt = DateTime.UtcNow,
        });
        await _db.SaveChangesAsync();
    }

    [Fact]
    public async Task Create_NewPatient_NoExistingSession_Allowed()
    {
        var result = await _svc.CreateSessionAsync(CreateRequest(_patientB), _admin);
        Assert.True(result.Success);
        Assert.NotNull(result.SessionId);
    }

    [Theory]
    [InlineData("Waiting")]
    [InlineData("InProgress")]
    [InlineData("Called")]
    [InlineData("AddOnSurgery")]
    public async Task Create_ActiveQueueWork_Blocked(string queueStatus)
    {
        var (existingId, _) = await SeedSessionAsync(_patient, null, null, queueStatus);

        var result = await _svc.CreateSessionAsync(CreateRequest(_patient), _admin);

        Assert.False(result.Success);
        Assert.Equal(SessionOperationFailureKind.Conflict, result.FailureKind);
        Assert.Equal(existingId, result.SessionId);
        Assert.Contains("already", result.Message, StringComparison.OrdinalIgnoreCase);
        Assert.DoesNotContain("ReEvaluate", result.Message, StringComparison.OrdinalIgnoreCase);
        Assert.Equal(1, await _db.CounselingSession.CountAsync(s => s.PatientId == _patient && s.DeletedAt == null));
    }

    [Fact]
    public async Task Create_DoneNotSurgeryDone_Blocked_DirectsReEvaluate()
    {
        var (existingId, versionBefore) = await SeedSessionAsync(
            _patient, _counsellor, patientAgreed: true, "Completed", sessionStatus: "Completed");

        var result = await _svc.CreateSessionAsync(CreateRequest(_patient), _admin);

        Assert.False(result.Success);
        Assert.Equal(SessionOperationFailureKind.Conflict, result.FailureKind);
        Assert.Equal(existingId, result.SessionId);
        Assert.Contains("ReEvaluate", result.Message, StringComparison.OrdinalIgnoreCase);
        Assert.Equal(1, await _db.CounselingSession.CountAsync(s => s.PatientId == _patient && s.DeletedAt == null));

        var prior = await _db.CounselingSession.AsNoTracking().FirstAsync(s => s.Id == existingId);
        Assert.Equal(_counsellor, prior.CounselorId);
        Assert.Equal(versionBefore, prior.Version);
        Assert.Equal(true, prior.PatientAgreedToSurgery);
    }

    [Fact]
    public async Task Create_CompletedNotAgreed_NotSurgeryDone_Blocked_ContinueExisting()
    {
        var (existingId, versionBefore) = await SeedSessionAsync(
            _patient, null, patientAgreed: false, "Completed", sessionStatus: "Completed");

        var result = await _svc.CreateSessionAsync(CreateRequest(_patient), _admin);

        Assert.False(result.Success);
        Assert.Equal(SessionOperationFailureKind.Conflict, result.FailureKind);
        Assert.Equal(existingId, result.SessionId);
        Assert.DoesNotContain("ReEvaluate", result.Message, StringComparison.OrdinalIgnoreCase);
        Assert.Contains("existing", result.Message, StringComparison.OrdinalIgnoreCase);
        Assert.Equal(1, await _db.CounselingSession.CountAsync(s => s.PatientId == _patient && s.DeletedAt == null));

        var prior = await _db.CounselingSession.AsNoTracking().FirstAsync(s => s.Id == existingId);
        Assert.Null(prior.CounselorId);
        Assert.Equal(versionBefore, prior.Version);
        Assert.Equal(false, prior.PatientAgreedToSurgery);
        Assert.False(await _db.OtFinalizeSchedules.AnyAsync(o =>
            o.CounsellingSessionId == existingId && o.Status == OtFinalizeStatus.SurgeryDone));
    }

    [Fact]
    public async Task Create_AfterSurgeryDone_NewSessionAllowed_NoOwnershipInherit()
    {
        var (sessionA, versionA) = await SeedSessionAsync(
            _patient, _counsellor, patientAgreed: true, "Completed", sessionStatus: "Completed");
        await SeedSurgeryDoneAsync(sessionA, _patient);

        var result = await _svc.CreateSessionAsync(CreateRequest(_patient), _admin);

        Assert.True(result.Success);
        Assert.NotNull(result.SessionId);
        Assert.NotEqual(sessionA, result.SessionId);

        var a = await _db.CounselingSession.AsNoTracking().FirstAsync(s => s.Id == sessionA);
        Assert.Equal(_counsellor, a.CounselorId);
        Assert.Equal(versionA, a.Version);

        var b = await _db.CounselingSession.AsNoTracking().FirstAsync(s => s.Id == result.SessionId);
        Assert.Null(b.CounselorId);
        Assert.NotEqual(a.CounselorId, b.CounselorId);

        Assert.Equal(2, await _db.CounselingSession.CountAsync(s => s.PatientId == _patient && s.DeletedAt == null));
        Assert.True(await _db.OtFinalizeSchedules.AnyAsync(o =>
            o.CounsellingSessionId == sessionA && o.Status == OtFinalizeStatus.SurgeryDone));
    }

    [Fact]
    public async Task Create_AfterSurgeryDone_CounsellorActor_SelfOwnsNewSession_NotPriorOwner()
    {
        var otherCounsellor = Guid.Parse("c0000002-0000-0000-0000-000000000002");
        _db.Users.Add(new AppUser
        {
            Id = otherCounsellor,
            TenantId = _tenant,
            UserName = "ravi@test",
            NormalizedUserName = "RAVI@TEST",
            Email = "ravi@test",
            NormalizedEmail = "RAVI@TEST",
            FirstName = "Ravi",
            LastName = "Kumar",
            BranchId = _branchA,
            UserType = "Counsellor",
        });
        _db.UserBranches.Add(new UserBranch
        {
            Id = Guid.NewGuid(),
            TenantId = _tenant,
            UserId = otherCounsellor,
            BranchId = _branchA,
            Status = "active",
            EffectiveFrom = DateTime.UtcNow.AddDays(-30),
        });
        await _db.SaveChangesAsync();

        var (sessionA, _) = await SeedSessionAsync(
            _patient, otherCounsellor, patientAgreed: true, "Completed", sessionStatus: "Completed");
        await SeedSurgeryDoneAsync(sessionA, _patient);

        var result = await _svc.CreateSessionAsync(CreateRequest(_patient), _counsellor);

        Assert.True(result.Success);
        var b = await _db.CounselingSession.AsNoTracking().FirstAsync(s => s.Id == result.SessionId);
        Assert.Equal(_counsellor, b.CounselorId);
        Assert.NotEqual(otherCounsellor, b.CounselorId);
    }
}
