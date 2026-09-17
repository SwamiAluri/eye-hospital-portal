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
/// Phase 3I Slice 6 — General Reassign (owned A → B). Status/queue unchanged.
/// Dual trail OwnershipReassigned. Expected-owner concurrency. Eligibility matrix.
/// </summary>
public class Phase3ISlice6ReassignOwnershipTests : IDisposable
{
    private readonly AppDbContext _db;
    private readonly CounselingWorkflowService _svc;
    private readonly Mock<IAuditService> _audit = new();
    private readonly IFollowupBranchAccessService _branchAccess;

    private readonly Guid _tenant = Guid.Parse("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa");
    private readonly Guid _otherTenant = Guid.Parse("bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb");
    private readonly Guid _branchA = Guid.Parse("11111111-1111-1111-1111-111111111111");
    private readonly Guid _branchB = Guid.Parse("22222222-2222-2222-2222-222222222222");
    private readonly Guid _amelia = Guid.Parse("c0000001-0000-0000-0000-000000000001");
    private readonly Guid _ravi = Guid.Parse("c0000002-0000-0000-0000-000000000002");
    private readonly Guid _otherBranchCounsellor = Guid.Parse("c0000003-0000-0000-0000-000000000003");
    private readonly Guid _otherTenantCounsellor = Guid.Parse("c0000004-0000-0000-0000-000000000004");
    private readonly Guid _nonCounsellor = Guid.Parse("c0000005-0000-0000-0000-000000000005");
    private readonly Guid _admin = Guid.Parse("a0000001-0000-0000-0000-000000000001");
    private readonly Guid _patient = Guid.Parse("f1000001-0000-0000-0000-000000000001");
    private readonly Guid _doctor = Guid.Parse("e1000001-0000-0000-0000-000000000001");

    private const string DefaultReason = "Peer leave coverage";

    public Phase3ISlice6ReassignOwnershipTests()
    {
        _db = TestDbContextFactory.CreateInMemory();
        _branchAccess = new FollowupBranchAccessService(_db);
        _svc = CreateWorkflowService(_db, _branchAccess, _audit.Object);
        Seed();
    }

    public void Dispose() => _db.Dispose();

    private static CounselingWorkflowService CreateWorkflowService(
        AppDbContext db,
        IFollowupBranchAccessService branchAccess,
        IAuditService audit)
    {
        var logger = new Mock<ILogger<CounselingWorkflowService>>();
        var blob = new Mock<IBlobStorageService>();
        var http = new Mock<System.Net.Http.IHttpClientFactory>();
        var config = new Mock<IConfiguration>();
        config.Setup(c => c["CcmsService:BaseUrl"]).Returns("http://localhost:7075/api");
        config.Setup(c => c["InternalApi:Key"]).Returns(string.Empty);
        var notifier = new Mock<IQueueDisplayNotifier>();
        return new CounselingWorkflowService(
            db, logger.Object, blob.Object, http.Object, config.Object, notifier.Object, branchAccess, audit);
    }

    private void Seed()
    {
        void AddCounsellor(Guid id, Guid tenant, Guid branch, string first, string last, string userType = "Counsellor")
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

        AddCounsellor(_amelia, _tenant, _branchA, "Amelia", "Martinez");
        AddCounsellor(_ravi, _tenant, _branchA, "Ravi", "Kumar");
        AddCounsellor(_otherBranchCounsellor, _tenant, _branchB, "Other", "Branch");
        AddCounsellor(_otherTenantCounsellor, _otherTenant, _branchA, "Foreign", "Tenant");

        _db.Users.Add(new AppUser
        {
            Id = _nonCounsellor,
            TenantId = _tenant,
            UserName = "nurse@test",
            NormalizedUserName = "NURSE@TEST",
            Email = "nurse@test",
            NormalizedEmail = "NURSE@TEST",
            FirstName = "Nurse",
            LastName = "Only",
            BranchId = _branchA,
            UserType = "Nurse",
        });
        _db.UserBranches.Add(new UserBranch
        {
            Id = Guid.NewGuid(),
            TenantId = _tenant,
            UserId = _nonCounsellor,
            BranchId = _branchA,
            Status = "active",
            EffectiveFrom = DateTime.UtcNow.AddDays(-30),
        });

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

        _db.Patients.Add(new Patient
        {
            Id = _patient,
            TenantId = _tenant,
            BranchId = _branchA,
            FirstName = "Pat",
            LastName = "Ent",
            MedicalRecordNumber = "MRN-S6",
            DateOfBirth = new DateTime(1990, 1, 1),
            Gender = "Female",
            Status = "Active",
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow,
        });
        _db.SaveChanges();
    }

    private async Task<Guid> SeedOwnedSessionAsync(
        Guid ownerId,
        string queueStatus = "Waiting",
        string sessionStatus = "Scheduled")
    {
        var sessionId = Guid.NewGuid();
        _db.CounselingSession.Add(new CounselingSession
        {
            Id = sessionId,
            TenantId = _tenant,
            BranchId = _branchA,
            PatientId = _patient,
            CounselorId = ownerId,
            SessionType = "Initial",
            SessionDate = DateTime.UtcNow.Date,
            PatientType = "Cash",
            Status = sessionStatus,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow,
            CreatedByUserId = ownerId,
            UpdatedByUserId = ownerId,
        });
        _db.CounselorQueue.Add(new CounselorQueueItem
        {
            Id = Guid.NewGuid(),
            TenantId = _tenant,
            BranchId = _branchA,
            SessionId = sessionId,
            PatientId = _patient,
            TokenNumber = $"S6-{sessionId.ToString()[..8]}",
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

    private int HistoryCount(Guid sessionId, string changeType) =>
        _db.CounselingSessionAuditLog.Count(h =>
            h.SessionId == sessionId && h.ChangeType == changeType);

    private Task<AssignSessionResult> ReassignAsync(
        Guid sessionId,
        Guid target,
        Guid expected,
        Guid actor,
        string reason = DefaultReason) =>
        _svc.ReassignSessionAsync(_tenant, sessionId, target, expected, reason, actor);

    [Fact]
    public async Task Reassign_PendingWaiting_AtoB_Succeeds_StatusQueueUnchanged_DualTrail()
    {
        var sessionId = await SeedOwnedSessionAsync(_amelia, queueStatus: "Waiting", sessionStatus: "Scheduled");

        var result = await ReassignAsync(sessionId, _ravi, _amelia, _admin);

        Assert.True(result.Success);
        Assert.Equal(_ravi, result.CounselorId);

        var row = await _db.CounselingSession.AsNoTracking().FirstAsync(s => s.Id == sessionId);
        Assert.Equal(_ravi, row.CounselorId);
        Assert.Equal("Scheduled", row.Status);
        Assert.Equal(_admin, row.UpdatedByUserId);

        var queue = await _db.CounselorQueue.AsNoTracking().FirstAsync(q => q.SessionId == sessionId);
        Assert.Equal("Waiting", queue.Status);

        Assert.Equal(1, HistoryCount(sessionId, "OwnershipReassigned"));
        var hist = _db.CounselingSessionAuditLog.Single(h =>
            h.SessionId == sessionId && h.ChangeType == "OwnershipReassigned");
        Assert.Equal(_admin, hist.ChangedByUserId);
        Assert.Equal(_amelia.ToString(), hist.OldValue);
        Assert.Equal(_ravi.ToString(), hist.NewValue);
        Assert.Equal(DefaultReason, hist.Reason);

        _audit.Verify(a => a.StageAsync(
            _admin,
            "OwnershipReassigned",
            "CounselingSession",
            sessionId,
            It.Is<string?>(d =>
                d != null
                && d.Contains(_amelia.ToString())
                && d.Contains(_ravi.ToString())
                && d.Contains("GeneralReassign")
                && d.Contains(DefaultReason)),
            _amelia.ToString(),
            _ravi.ToString()), Times.Once);
    }

    [Fact]
    public async Task Reassign_InProgress_AtoB_Succeeds_QueueUnchanged()
    {
        var sessionId = await SeedOwnedSessionAsync(_amelia, queueStatus: "InProgress", sessionStatus: "InProgress");

        var result = await ReassignAsync(sessionId, _ravi, _amelia, _admin);

        Assert.True(result.Success);
        Assert.Equal(_ravi, result.CounselorId);

        var row = await _db.CounselingSession.AsNoTracking().FirstAsync(s => s.Id == sessionId);
        Assert.Equal(_ravi, row.CounselorId);
        Assert.Equal("InProgress", row.Status);

        var queue = await _db.CounselorQueue.AsNoTracking().FirstAsync(q => q.SessionId == sessionId);
        Assert.Equal("InProgress", queue.Status);

        Assert.Equal(1, HistoryCount(sessionId, "OwnershipReassigned"));
        _audit.Verify(a => a.StageAsync(
            _admin,
            "OwnershipReassigned",
            "CounselingSession",
            sessionId,
            It.IsAny<string?>(),
            _amelia.ToString(),
            _ravi.ToString()), Times.Once);
    }

    [Fact]
    public async Task Reassign_NullOwner_Rejected_MustUseAssign()
    {
        var sessionId = await SeedOwnedSessionAsync(_amelia);
        var session = await _db.CounselingSession.FirstAsync(s => s.Id == sessionId);
        session.CounselorId = null;
        await _db.SaveChangesAsync();

        var result = await ReassignAsync(sessionId, _ravi, _amelia, _admin);

        Assert.False(result.Success);
        Assert.Equal(AssignSessionFailureKind.BadRequest, result.FailureKind);
        Assert.Contains("Assign", result.Message);
        Assert.Equal(0, HistoryCount(sessionId, "OwnershipReassigned"));
        _audit.Verify(a => a.StageAsync(
            It.IsAny<Guid>(),
            "OwnershipReassigned",
            It.IsAny<string>(),
            It.IsAny<Guid?>(),
            It.IsAny<string?>(),
            It.IsAny<string?>(),
            It.IsAny<string?>()), Times.Never);
    }

    [Fact]
    public async Task Reassign_AtoA_Rejected_NoTrail()
    {
        var sessionId = await SeedOwnedSessionAsync(_amelia);

        var result = await ReassignAsync(sessionId, _amelia, _amelia, _admin);

        Assert.False(result.Success);
        Assert.Equal(AssignSessionFailureKind.BadRequest, result.FailureKind);
        var row = await _db.CounselingSession.AsNoTracking().FirstAsync(s => s.Id == sessionId);
        Assert.Equal(_amelia, row.CounselorId);
        Assert.Equal(0, HistoryCount(sessionId, "OwnershipReassigned"));
        _audit.Verify(a => a.StageAsync(
            It.IsAny<Guid>(),
            "OwnershipReassigned",
            It.IsAny<string>(),
            It.IsAny<Guid?>(),
            It.IsAny<string?>(),
            It.IsAny<string?>(),
            It.IsAny<string?>()), Times.Never);
    }

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData("   ")]
    public async Task Reassign_MissingOrWhitespaceReason_Rejected(string? reason)
    {
        var sessionId = await SeedOwnedSessionAsync(_amelia);

        var result = await ReassignAsync(sessionId, _ravi, _amelia, _admin, reason!);

        Assert.False(result.Success);
        Assert.Equal(AssignSessionFailureKind.BadRequest, result.FailureKind);
        Assert.Contains("Reason", result.Message);
        Assert.Equal(0, HistoryCount(sessionId, "OwnershipReassigned"));
        _audit.Verify(a => a.StageAsync(
            It.IsAny<Guid>(),
            "OwnershipReassigned",
            It.IsAny<string>(),
            It.IsAny<Guid?>(),
            It.IsAny<string?>(),
            It.IsAny<string?>(),
            It.IsAny<string?>()), Times.Never);
    }

    [Fact]
    public async Task Reassign_ExpectedMismatch_Conflict_NoTrail()
    {
        var sessionId = await SeedOwnedSessionAsync(_amelia);

        // Owner is Amelia. Stale expected = Ravi; target must differ from expected so A→A guard does not fire first.
        var result = await ReassignAsync(sessionId, target: _amelia, expected: _ravi, _admin);

        Assert.False(result.Success);
        Assert.Equal(AssignSessionFailureKind.Conflict, result.FailureKind);
        var row = await _db.CounselingSession.AsNoTracking().FirstAsync(s => s.Id == sessionId);
        Assert.Equal(_amelia, row.CounselorId);
        Assert.Equal(0, HistoryCount(sessionId, "OwnershipReassigned"));
        _audit.Verify(a => a.StageAsync(
            It.IsAny<Guid>(),
            "OwnershipReassigned",
            It.IsAny<string>(),
            It.IsAny<Guid?>(),
            It.IsAny<string?>(),
            It.IsAny<string?>(),
            It.IsAny<string?>()), Times.Never);
    }

    [Fact]
    public async Task Reassign_CompletedQueueTerminal_Rejected()
    {
        var sessionId = await SeedOwnedSessionAsync(_amelia, queueStatus: "Completed", sessionStatus: "Completed");

        var result = await ReassignAsync(sessionId, _ravi, _amelia, _admin);

        Assert.False(result.Success);
        Assert.Equal(AssignSessionFailureKind.BadRequest, result.FailureKind);
        Assert.Contains("lifecycle", result.Message, StringComparison.OrdinalIgnoreCase);
        var row = await _db.CounselingSession.AsNoTracking().FirstAsync(s => s.Id == sessionId);
        Assert.Equal(_amelia, row.CounselorId);
        Assert.Equal(0, HistoryCount(sessionId, "OwnershipReassigned"));
    }

    [Fact]
    public async Task Reassign_SurgeryDone_Rejected()
    {
        var sessionId = await SeedOwnedSessionAsync(_amelia, queueStatus: "Waiting");
        _db.OtFinalizeSchedules.Add(new OtFinalizeSchedule
        {
            Id = Guid.NewGuid(),
            TenantId = _tenant,
            BranchId = _branchA,
            PatientId = _patient,
            PatientName = "Pat Ent",
            SurgeryName = "Phaco",
            CounsellingSessionId = sessionId,
            Status = OtFinalizeStatus.SurgeryDone,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow,
        });
        await _db.SaveChangesAsync();

        var result = await ReassignAsync(sessionId, _ravi, _amelia, _admin);

        Assert.False(result.Success);
        Assert.Equal(AssignSessionFailureKind.BadRequest, result.FailureKind);
        Assert.Contains("SurgeryDone", result.Message);
        var row = await _db.CounselingSession.AsNoTracking().FirstAsync(s => s.Id == sessionId);
        Assert.Equal(_amelia, row.CounselorId);
        Assert.Equal(0, HistoryCount(sessionId, "OwnershipReassigned"));
    }

    [Fact]
    public async Task Reassign_CrossBranchTarget_Forbidden()
    {
        var sessionId = await SeedOwnedSessionAsync(_amelia);

        var result = await ReassignAsync(sessionId, _otherBranchCounsellor, _amelia, _admin);

        Assert.False(result.Success);
        Assert.Equal(AssignSessionFailureKind.Forbidden, result.FailureKind);
        var row = await _db.CounselingSession.AsNoTracking().FirstAsync(s => s.Id == sessionId);
        Assert.Equal(_amelia, row.CounselorId);
        Assert.Equal(0, HistoryCount(sessionId, "OwnershipReassigned"));
    }

    [Fact]
    public async Task Reassign_NonCounsellorTarget_BadRequest()
    {
        var sessionId = await SeedOwnedSessionAsync(_amelia);

        var result = await ReassignAsync(sessionId, _nonCounsellor, _amelia, _admin);

        Assert.False(result.Success);
        Assert.Equal(AssignSessionFailureKind.BadRequest, result.FailureKind);
        var row = await _db.CounselingSession.AsNoTracking().FirstAsync(s => s.Id == sessionId);
        Assert.Equal(_amelia, row.CounselorId);
        Assert.Equal(0, HistoryCount(sessionId, "OwnershipReassigned"));
    }

    [Fact]
    public async Task Reassign_WhenAuditStagingFails_OwnershipNotCommitted()
    {
        var sessionId = await SeedOwnedSessionAsync(_amelia);
        _audit.Setup(a => a.StageAsync(
                It.IsAny<Guid>(), It.IsAny<string>(), It.IsAny<string>(), It.IsAny<Guid?>(),
                It.IsAny<string?>(), It.IsAny<string?>(), It.IsAny<string?>()))
            .ThrowsAsync(new InvalidOperationException("audit store unreachable"));

        var result = await ReassignAsync(sessionId, _ravi, _amelia, _admin);

        Assert.False(result.Success);
        var session = await _db.CounselingSession.AsNoTracking().SingleAsync(s => s.Id == sessionId);
        Assert.Equal(_amelia, session.CounselorId);
        Assert.Equal(0, HistoryCount(sessionId, "OwnershipReassigned"));
    }

    [Fact]
    public async Task Reassign_ThenOldOwnerCannotStart_NewOwnerCan()
    {
        var sessionId = await SeedOwnedSessionAsync(_amelia, queueStatus: "Waiting");

        var reassigned = await ReassignAsync(sessionId, _ravi, _amelia, _admin);
        Assert.True(reassigned.Success);

        var oldOwnerStart = await _svc.StartSessionAsync(_tenant, sessionId, _amelia);
        Assert.False(oldOwnerStart.Success);
        Assert.Equal(SessionOperationFailureKind.Forbidden, oldOwnerStart.FailureKind);

        var newOwnerStart = await _svc.StartSessionAsync(_tenant, sessionId, _ravi);
        Assert.True(newOwnerStart.Success);

        var row = await _db.CounselingSession.AsNoTracking().FirstAsync(s => s.Id == sessionId);
        Assert.Equal(_ravi, row.CounselorId);
        Assert.Equal("InProgress", row.Status);
    }
}
