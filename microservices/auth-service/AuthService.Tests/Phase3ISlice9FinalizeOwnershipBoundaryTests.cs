using System;
using System.Linq;
using System.Net.Http;
using System.Reflection;
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
using Microsoft.Extensions.Logging.Abstractions;
using Moq;
using Xunit;

namespace AuthService.Tests;

/// <summary>
/// Phase 3I Slice 9 — Finalize Surgery / Post-Surgery ownership boundary:
/// branch auth, no CounselorId propagation, SurgeryDone assign seal, OT audit separation.
/// </summary>
public class Phase3ISlice9FinalizeOwnershipBoundaryTests : IDisposable
{
    private readonly AppDbContext _db;
    private readonly OtFinalizeService _ot;
    private readonly CounselingWorkflowService _workflow;
    private readonly FollowupListService _followups;
    private readonly IFollowupBranchAccessService _branchAccess;
    private readonly Mock<IAuditService> _audit = new();

    private readonly Guid _tenant = Guid.Parse("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa");
    private readonly Guid _branchA = Guid.Parse("11111111-1111-1111-1111-111111111111");
    private readonly Guid _branchB = Guid.Parse("22222222-2222-2222-2222-222222222222");
    private readonly Guid _amelia = Guid.Parse("c0000001-0000-0000-0000-000000000001");
    private readonly Guid _ravi = Guid.Parse("c0000002-0000-0000-0000-000000000002");
    private readonly Guid _otherBranchCounsellor = Guid.Parse("c0000003-0000-0000-0000-000000000003");
    private readonly Guid _multiBranchUser = Guid.Parse("c0000006-0000-0000-0000-000000000006");
    private readonly Guid _admin = Guid.Parse("a0000001-0000-0000-0000-000000000001");
    private readonly Guid _patient = Guid.Parse("f1000001-0000-0000-0000-000000000001");
    private readonly Guid _patientB = Guid.Parse("f1000002-0000-0000-0000-000000000002");

    public Phase3ISlice9FinalizeOwnershipBoundaryTests()
    {
        _db = TestDbContextFactory.CreateInMemory();
        _branchAccess = new FollowupBranchAccessService(_db);
        _ot = CreateOtService(_db, _branchAccess);
        _workflow = CreateWorkflowService(_db, _branchAccess, _audit.Object);
        _followups = new FollowupListService(_db);
        Seed();
    }

    public void Dispose() => _db.Dispose();

    private static OtFinalizeService CreateOtService(
        AppDbContext db,
        IFollowupBranchAccessService branchAccess)
    {
        var httpFactory = new Mock<IHttpClientFactory>();
        httpFactory.Setup(f => f.CreateClient(It.IsAny<string>())).Returns(new HttpClient());
        var config = new ConfigurationBuilder()
            .AddInMemoryCollection(new Dictionary<string, string?>())
            .Build();
        return new OtFinalizeService(
            db, httpFactory.Object, config, NullLogger<OtFinalizeService>.Instance, branchAccess);
    }

    private static CounselingWorkflowService CreateWorkflowService(
        AppDbContext db,
        IFollowupBranchAccessService branchAccess,
        IAuditService audit)
    {
        var logger = new Mock<ILogger<CounselingWorkflowService>>();
        var blob = new Mock<IBlobStorageService>();
        var http = new Mock<IHttpClientFactory>();
        var config = new Mock<IConfiguration>();
        config.Setup(c => c["CcmsService:BaseUrl"]).Returns("http://localhost:7075/api");
        config.Setup(c => c["InternalApi:Key"]).Returns(string.Empty);
        var notifier = new Mock<IQueueDisplayNotifier>();
        return new CounselingWorkflowService(
            db, logger.Object, blob.Object, http.Object, config.Object, notifier.Object, branchAccess, audit);
    }

    private void Seed()
    {
        void AddUser(Guid id, Guid tenant, Guid branch, string first, string last, string userType)
        {
            _db.Users.Add(new AppUser
            {
                Id = id,
                TenantId = tenant,
                UserName = $"{first.ToLower()}@test",
                NormalizedUserName = $"{first.ToUpper()}@TEST",
                Email = $"{first.ToLower()}@test",
                NormalizedEmail = $"{first.ToUpper()}@TEST",
                FirstName = first,
                LastName = last,
                BranchId = branch,
                UserType = userType,
            });
            _db.UserBranches.Add(new UserBranch
            {
                Id = Guid.NewGuid(),
                TenantId = tenant,
                UserId = id,
                BranchId = branch,
                Status = "active",
                EffectiveFrom = DateTime.UtcNow.AddDays(-30),
            });
        }

        AddUser(_amelia, _tenant, _branchA, "Amelia", "Martinez", "Counsellor");
        AddUser(_ravi, _tenant, _branchA, "Ravi", "Kumar", "Counsellor");
        AddUser(_otherBranchCounsellor, _tenant, _branchB, "Other", "Branch", "Counsellor");
        AddUser(_admin, _tenant, _branchA, "Admin", "User", "Admin");

        _db.Users.Add(new AppUser
        {
            Id = _multiBranchUser,
            TenantId = _tenant,
            UserName = "multi@test",
            NormalizedUserName = "MULTI@TEST",
            Email = "multi@test",
            NormalizedEmail = "MULTI@TEST",
            FirstName = "Multi",
            LastName = "Branch",
            BranchId = _branchA,
            UserType = "Counsellor",
        });
        _db.UserBranches.AddRange(
            new UserBranch
            {
                Id = Guid.NewGuid(),
                TenantId = _tenant,
                UserId = _multiBranchUser,
                BranchId = _branchA,
                Status = "active",
                EffectiveFrom = DateTime.UtcNow.AddDays(-30),
            },
            new UserBranch
            {
                Id = Guid.NewGuid(),
                TenantId = _tenant,
                UserId = _multiBranchUser,
                BranchId = _branchB,
                Status = "active",
                EffectiveFrom = DateTime.UtcNow.AddDays(-30),
            });

        _db.Patients.AddRange(
            new Patient
            {
                Id = _patient,
                TenantId = _tenant,
                BranchId = _branchA,
                FirstName = "Pat",
                LastName = "Ent",
                MedicalRecordNumber = "MRN-S9A",
                DateOfBirth = new DateTime(1990, 1, 1),
                Gender = "Female",
                Status = "Active",
                CreatedAt = DateTime.UtcNow,
                UpdatedAt = DateTime.UtcNow,
            },
            new Patient
            {
                Id = _patientB,
                TenantId = _tenant,
                BranchId = _branchB,
                FirstName = "Branch",
                LastName = "Bee",
                MedicalRecordNumber = "MRN-S9B",
                DateOfBirth = new DateTime(1985, 5, 5),
                Gender = "Male",
                Status = "Active",
                CreatedAt = DateTime.UtcNow,
                UpdatedAt = DateTime.UtcNow,
            });
        _db.SaveChanges();
    }

    private async Task<Guid> SeedSessionAsync(
        Guid? ownerId,
        Guid branchId,
        Guid patientId,
        string queueStatus = "Completed",
        string sessionStatus = "Completed",
        int version = 1)
    {
        var sessionId = Guid.NewGuid();
        _db.CounselingSession.Add(new CounselingSession
        {
            Id = sessionId,
            TenantId = _tenant,
            BranchId = branchId,
            PatientId = patientId,
            CounselorId = ownerId,
            SessionType = "Initial",
            SessionDate = DateTime.UtcNow.Date,
            PatientType = "Cash",
            Status = sessionStatus,
            Version = version,
            RecommendedSurgery = "Phaco",
            SurgeryTentativeEye = "RE",
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow,
            CreatedByUserId = ownerId ?? _admin,
            UpdatedByUserId = ownerId ?? _admin,
        });
        _db.CounselorQueue.Add(new CounselorQueueItem
        {
            Id = Guid.NewGuid(),
            TenantId = _tenant,
            BranchId = branchId,
            SessionId = sessionId,
            PatientId = patientId,
            TokenNumber = $"S9-{sessionId.ToString()[..8]}",
            QueueType = "Counseling",
            QueuePosition = 1,
            PriorityScore = 50,
            UrgencyLevel = "Normal",
            Status = queueStatus,
            AddedToQueueAt = DateTime.UtcNow,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow,
        });
        await _db.SaveChangesAsync();
        return sessionId;
    }

    private async Task<OtFinalizeSchedule> SeedScheduleAsync(
        Guid sessionId,
        Guid branchId,
        Guid patientId,
        string status,
        string patientName = "Pat Ent",
        DateTime? startTime = null)
    {
        var entity = new OtFinalizeSchedule
        {
            Id = Guid.NewGuid(),
            TenantId = _tenant,
            BranchId = branchId,
            PatientId = patientId,
            PatientName = patientName,
            SurgeryName = "Phaco",
            Eye = "RE",
            CounsellingSessionId = sessionId,
            Status = status,
            StartTime = startTime ?? DateTime.UtcNow.Date.AddDays(3).AddHours(9),
            ReportingTime = TimeSpan.FromHours(7),
            Version = 1,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow,
        };
        _db.OtFinalizeSchedules.Add(entity);
        await _db.SaveChangesAsync();
        return entity;
    }

    private static void AssertNoCounselorIdProperty()
    {
        Assert.Null(typeof(OtFinalizeSchedule).GetProperty(
            "CounselorId", BindingFlags.Public | BindingFlags.Instance | BindingFlags.IgnoreCase));
    }

    private int OwnershipHistoryCount(Guid sessionId) =>
        _db.CounselingSessionAuditLog.Count(h =>
            h.SessionId == sessionId
            && h.ChangeType != null
            && h.ChangeType.StartsWith("Ownership", StringComparison.Ordinal));

    // ── Branch auth ──────────────────────────────────────────────────────────

    [Fact]
    public async Task List_BranchAUser_SeesBranchAOnly_NotBranchB()
    {
        var sessionA = await SeedSessionAsync(_amelia, _branchA, _patient);
        var sessionB = await SeedSessionAsync(_otherBranchCounsellor, _branchB, _patientB);
        var schedA = await SeedScheduleAsync(sessionA, _branchA, _patient, OtFinalizeStatus.NotConfirmed, "Pat Ent");
        var schedB = await SeedScheduleAsync(sessionB, _branchB, _patientB, OtFinalizeStatus.NotConfirmed, "Branch Bee");

        var branches = await _branchAccess.ResolveAccessibleBranchesAsync(_tenant, _amelia, null);
        var list = await _ot.GetFinalizeListAsync(new OtScheduleFilters(), _tenant, branches);

        Assert.Contains(list, r => r.Id == schedA.Id);
        Assert.DoesNotContain(list, r => r.Id == schedB.Id);
    }

    [Fact]
    public async Task List_MultiBranchUser_SeesBothAuthorized()
    {
        var sessionA = await SeedSessionAsync(_amelia, _branchA, _patient);
        var sessionB = await SeedSessionAsync(_otherBranchCounsellor, _branchB, _patientB);
        var schedA = await SeedScheduleAsync(sessionA, _branchA, _patient, OtFinalizeStatus.NotConfirmed);
        var schedB = await SeedScheduleAsync(sessionB, _branchB, _patientB, OtFinalizeStatus.NotConfirmed, "Branch Bee");

        var branches = await _branchAccess.ResolveAccessibleBranchesAsync(_tenant, _multiBranchUser, null);
        var list = await _ot.GetFinalizeListAsync(new OtScheduleFilters(), _tenant, branches);

        Assert.Contains(list, r => r.Id == schedA.Id);
        Assert.Contains(list, r => r.Id == schedB.Id);
    }

    [Fact]
    public async Task CrossBranch_Confirm_ThrowsUnauthorized()
    {
        var sessionId = await SeedSessionAsync(_amelia, _branchA, _patient);
        var sched = await SeedScheduleAsync(sessionId, _branchA, _patient, OtFinalizeStatus.NotConfirmed);

        await Assert.ThrowsAsync<UnauthorizedAccessException>(() =>
            _ot.ConfirmAsync(sched.Id, _tenant, _otherBranchCounsellor));
    }

    [Fact]
    public async Task CrossBranch_Cancel_ThrowsUnauthorized()
    {
        var sessionId = await SeedSessionAsync(_amelia, _branchA, _patient);
        var sched = await SeedScheduleAsync(sessionId, _branchA, _patient, OtFinalizeStatus.NotConfirmed);

        await Assert.ThrowsAsync<UnauthorizedAccessException>(() =>
            _ot.CancelAsync(sched.Id, _tenant, _otherBranchCounsellor, "cross-branch cancel attempt"));
    }

    [Fact]
    public async Task Upsert_PopulatesBranchIdFromSession_DoesNotSetOwnershipOnOt()
    {
        AssertNoCounselorIdProperty();
        var sessionId = await SeedSessionAsync(_amelia, _branchA, _patient);

        var result = await _ot.UpsertFromCounsellorAsync(new UpsertOtScheduleRequest
        {
            PatientId = _patient,
            PatientName = "Pat Ent",
            Uhid = "MRN-S9A",
            SurgeryName = "Phaco",
            Eye = "RE",
            CounsellingSessionId = sessionId,
            StartTime = DateTime.UtcNow.Date.AddDays(5).AddHours(9),
        }, _tenant, _admin);

        var row = await _db.OtFinalizeSchedules.AsNoTracking().FirstAsync(s => s.Id == result.Id);
        Assert.Equal(_branchA, row.BranchId);
        AssertNoCounselorIdProperty();

        var session = await _db.CounselingSession.AsNoTracking().FirstAsync(s => s.Id == sessionId);
        Assert.Equal(_amelia, session.CounselorId);
    }

    // ── CounselorId non-propagation / survival ───────────────────────────────

    [Fact]
    public async Task Mutations_LeaveCounselingSessionCounselorIdUnchanged()
    {
        AssertNoCounselorIdProperty();
        var sessionId = await SeedSessionAsync(_amelia, _branchA, _patient);
        var start = DateTime.UtcNow.Date.AddDays(6).AddHours(9);

        var upserted = await _ot.UpsertFromCounsellorAsync(new UpsertOtScheduleRequest
        {
            PatientId = _patient,
            PatientName = "Pat Ent",
            Uhid = "MRN-S9A",
            SurgeryName = "Phaco",
            Eye = "RE",
            CounsellingSessionId = sessionId,
            StartTime = start,
            ReportingTime = TimeSpan.FromHours(7),
        }, _tenant, _admin);
        Assert.Equal(_amelia, (await _db.CounselingSession.AsNoTracking().FirstAsync(s => s.Id == sessionId)).CounselorId);

        await _ot.ConfirmAsync(upserted.Id, _tenant, _admin);
        Assert.Equal(_amelia, (await _db.CounselingSession.AsNoTracking().FirstAsync(s => s.Id == sessionId)).CounselorId);

        await _ot.FinaliseAsync(upserted.Id, _tenant, _admin);
        Assert.Equal(_amelia, (await _db.CounselingSession.AsNoTracking().FirstAsync(s => s.Id == sessionId)).CounselorId);

        await _ot.PrepareOtListAsync(
            new PrepareOtListRequest
            {
                Date = start.Date,
                Items = [new PrepareOtListItem { ScheduleId = upserted.Id, Sequence = 1 }],
            },
            _tenant,
            _admin);
        Assert.Equal(_amelia, (await _db.CounselingSession.AsNoTracking().FirstAsync(s => s.Id == sessionId)).CounselorId);

        await _ot.MarkSurgeryDoneAsync(upserted.Id, _tenant, _admin.ToString());
        var afterDone = await _db.CounselingSession.AsNoTracking().FirstAsync(s => s.Id == sessionId);
        Assert.Equal(_amelia, afterDone.CounselorId);

        // Separate Cancel / Reopen path on a second schedule
        var session2 = await SeedSessionAsync(_ravi, _branchA, _patient);
        var sched2 = await SeedScheduleAsync(session2, _branchA, _patient, OtFinalizeStatus.NotConfirmed, startTime: start.AddDays(1));
        await _ot.CancelAsync(sched2.Id, _tenant, _admin, "Package1 ownership regression cancel");
        Assert.Equal(_ravi, (await _db.CounselingSession.AsNoTracking().FirstAsync(s => s.Id == session2)).CounselorId);

        await _ot.ReopenAsync(sched2.Id, _tenant, _admin);
        Assert.Equal(_ravi, (await _db.CounselingSession.AsNoTracking().FirstAsync(s => s.Id == session2)).CounselorId);
    }

    [Fact]
    public async Task MarkSurgeryDone_DoesNotClearCounselorId_OtHasNoCounselorId()
    {
        AssertNoCounselorIdProperty();
        var sessionId = await SeedSessionAsync(_amelia, _branchA, _patient);
        var sched = await SeedScheduleAsync(sessionId, _branchA, _patient, OtFinalizeStatus.OTPrepared);

        await _ot.MarkSurgeryDoneAsync(sched.Id, _tenant, _admin.ToString());

        var session = await _db.CounselingSession.AsNoTracking().FirstAsync(s => s.Id == sessionId);
        Assert.Equal(_amelia, session.CounselorId);
        AssertNoCounselorIdProperty();
    }

    // ── Assign SurgeryDone ───────────────────────────────────────────────────

    [Fact]
    public async Task Assign_AgainstSurgeryDone_BadRequest_NoOwnershipMutation()
    {
        var sessionId = await SeedSessionAsync(null, _branchA, _patient, queueStatus: "Waiting", sessionStatus: "Scheduled");
        await SeedScheduleAsync(sessionId, _branchA, _patient, OtFinalizeStatus.SurgeryDone);

        var result = await _workflow.AssignSessionAsync(_tenant, sessionId, _amelia, 1, _admin);

        Assert.False(result.Success);
        Assert.Equal(AssignSessionFailureKind.BadRequest, result.FailureKind);
        Assert.Contains("SurgeryDone", result.Message);
        Assert.Contains("cannot be assigned", result.Message, StringComparison.OrdinalIgnoreCase);

        var row = await _db.CounselingSession.AsNoTracking().FirstAsync(s => s.Id == sessionId);
        Assert.Null(row.CounselorId);
        Assert.Equal(0, _db.CounselingSessionAuditLog.Count(h =>
            h.SessionId == sessionId && h.ChangeType == "OwnershipAssigned"));
        _audit.Verify(a => a.StageAsync(
            It.IsAny<Guid>(),
            "OwnershipAssigned",
            It.IsAny<string>(),
            It.IsAny<Guid>(),
            It.IsAny<string?>(),
            It.IsAny<string?>(),
            It.IsAny<string?>()), Times.Never);
    }

    [Fact]
    public async Task Assign_NonSurgeryDone_NullWaiting_Succeeds()
    {
        var sessionId = await SeedSessionAsync(null, _branchA, _patient, queueStatus: "Waiting", sessionStatus: "Scheduled");

        var result = await _workflow.AssignSessionAsync(_tenant, sessionId, _amelia, 1, _admin);

        Assert.True(result.Success);
        var row = await _db.CounselingSession.AsNoTracking().FirstAsync(s => s.Id == sessionId);
        Assert.Equal(_amelia, row.CounselorId);
        Assert.Equal(1, _db.CounselingSessionAuditLog.Count(h =>
            h.SessionId == sessionId && h.ChangeType == "OwnershipAssigned"));
    }

    // ── Finalize audit separation ────────────────────────────────────────────

    [Fact]
    public async Task Finalise_WritesOtFinalizeAudit_NoOwnershipCounselingHistory()
    {
        var sessionId = await SeedSessionAsync(_amelia, _branchA, _patient);
        var sched = await SeedScheduleAsync(sessionId, _branchA, _patient, OtFinalizeStatus.Confirmed);

        await _ot.FinaliseAsync(sched.Id, _tenant, _admin);

        Assert.Contains(_db.OtFinalizeAuditLogs, a =>
            a.ScheduleId == sched.Id && a.Action == "Finalise");
        Assert.Equal(0, OwnershipHistoryCount(sessionId));
    }

    // ── Post-Surgery honesty ─────────────────────────────────────────────────

    [Fact]
    public async Task PostSurgery_DischargedJourney_Appears_NoCounselorId_SessionIdNull()
    {
        Assert.Null(typeof(PostSurgeryFollowupItemDto).GetProperty(
            "CounselorId", BindingFlags.Public | BindingFlags.Instance | BindingFlags.IgnoreCase));

        var journeyId = Guid.Parse("d9000001-0000-0000-0000-000000000001");
        _db.PatientJourneys.Add(new PatientJourneyReadOnly
        {
            Id = journeyId,
            TenantId = _tenant,
            PatientId = _patient,
            BranchId = _branchA,
            IsDischarged = true,
            DischargedAt = DateTime.UtcNow.AddDays(-2),
            ProcedureName = "Phaco OS",
            Uhid = "MRN-S9A",
            ClinicalState = "Discharged",
            CreatedAt = DateTime.UtcNow.AddDays(-10),
        });
        await _db.SaveChangesAsync();

        var post = await _followups.GetPostSurgeryAsync(_tenant, new[] { _branchA }, null, 1, 50);

        var item = Assert.Single(post.Items, i => i.JourneyId == journeyId);
        Assert.Null(item.SessionId);
        Assert.Equal(_patient, item.PatientId);
        Assert.Null(typeof(PostSurgeryFollowupItemDto).GetProperty("CounselorId"));
    }
}
