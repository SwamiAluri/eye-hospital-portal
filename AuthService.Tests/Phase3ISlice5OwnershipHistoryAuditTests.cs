using System;
using System.Linq;
using System.Security.Claims;
using System.Threading.Tasks;
using AuthService.Context;
using AuthService.Models.Counselor;
using AuthService.Models.Domain;
using AuthService.Models.Identity;
using AuthService.Services;
using AuthService.Services.Interfaces;
using Microsoft.AspNetCore.Http;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using Moq;
using Xunit;

namespace AuthService.Tests;

/// <summary>
/// Phase 3I Slice 5 — dual Operational History + Immutable Audit on ownership mutations.
/// </summary>
public class Phase3ISlice5OwnershipHistoryAuditTests : IDisposable
{
    private readonly AppDbContext _db;
    private readonly CounselingWorkflowService _svc;
    private readonly Mock<IAuditService> _audit = new();
    private readonly IHttpContextAccessor _http;

    private readonly Guid _tenant = Guid.Parse("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa");
    private readonly Guid _branch = Guid.Parse("11111111-1111-1111-1111-111111111111");
    private readonly Guid _admin = Guid.Parse("a0000001-0000-0000-0000-000000000001");
    private readonly Guid _amelia = Guid.Parse("c0000001-0000-0000-0000-000000000001");
    private readonly Guid _ravi = Guid.Parse("c0000002-0000-0000-0000-000000000002");
    private readonly Guid _patient = Guid.Parse("f1000001-0000-0000-0000-000000000001");
    private readonly Guid _doctor = Guid.Parse("e1000001-0000-0000-0000-000000000001");

    public Phase3ISlice5OwnershipHistoryAuditTests()
    {
        _db = TestDbContextFactory.CreateInMemory();
        _http = BuildHttp(_tenant, _amelia);
        _svc = CreateWorkflowService(_db, _audit.Object, _http);
        Seed();
    }

    public void Dispose() => _db.Dispose();

    private static IHttpContextAccessor BuildHttp(Guid tenantId, Guid userId)
    {
        var http = new DefaultHttpContext();
        http.Items["TenantId"] = tenantId;
        http.User = new ClaimsPrincipal(new ClaimsIdentity(new[]
        {
            new Claim("sub", userId.ToString()),
            new Claim(ClaimTypes.NameIdentifier, userId.ToString()),
        }, "test"));
        return new HttpContextAccessor { HttpContext = http };
    }

    private static CounselingWorkflowService CreateWorkflowService(
        AppDbContext db,
        IAuditService audit,
        IHttpContextAccessor? http = null)
    {
        var logger = new Mock<ILogger<CounselingWorkflowService>>();
        var blob = new Mock<IBlobStorageService>();
        var httpFactory = new Mock<System.Net.Http.IHttpClientFactory>();
        var config = new Mock<IConfiguration>();
        config.Setup(c => c["CcmsService:BaseUrl"]).Returns("http://localhost:7075/api");
        config.Setup(c => c["InternalApi:Key"]).Returns(string.Empty);
        var notifier = new Mock<IQueueDisplayNotifier>();
        return new CounselingWorkflowService(
            db,
            logger.Object,
            blob.Object,
            httpFactory.Object,
            config.Object,
            notifier.Object,
            new FollowupBranchAccessService(db),
            audit);
    }

    private void Seed()
    {
        void AddUser(Guid id, string first, string last, string userType)
        {
            _db.Users.Add(new AppUser
            {
                Id = id,
                TenantId = _tenant,
                UserName = $"{first.ToLower()}@test",
                NormalizedUserName = $"{first.ToUpper()}@TEST",
                Email = $"{first.ToLower()}@test",
                NormalizedEmail = $"{first.ToUpper()}@TEST",
                FirstName = first,
                LastName = last,
                BranchId = _branch,
                UserType = userType,
            });
            _db.UserBranches.Add(new UserBranch
            {
                Id = Guid.NewGuid(),
                TenantId = _tenant,
                UserId = id,
                BranchId = _branch,
                Status = "active",
                EffectiveFrom = DateTime.UtcNow.AddDays(-30),
            });
        }

        AddUser(_amelia, "Amelia", "Martinez", "Counsellor");
        AddUser(_ravi, "Ravi", "Kumar", "Counsellor");
        AddUser(_admin, "Admin", "User", "Admin");
        _db.Users.Add(new AppUser
        {
            Id = _doctor,
            TenantId = _tenant,
            UserName = "doc@test",
            NormalizedUserName = "DOC@TEST",
            Email = "doc@test",
            NormalizedEmail = "DOC@TEST",
            FirstName = "Doc",
            LastName = "Tor",
            BranchId = _branch,
            UserType = "Doctor",
        });
        _db.Patients.Add(new Patient
        {
            Id = _patient,
            TenantId = _tenant,
            BranchId = _branch,
            FirstName = "Pat",
            LastName = "ient",
            MedicalRecordNumber = "MRN-S5",
            DateOfBirth = new DateTime(1970, 1, 1),
            Gender = "F",
            Status = "Active",
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow,
        });
        _db.SaveChanges();
    }

    private CreateCounselingSessionRequest CreateRequest() => new()
    {
        TenantId = _tenant,
        BranchId = _branch,
        PatientId = _patient,
        ReferredByDoctorId = _doctor,
        SessionType = "Initial",
        PatientType = "Cash",
        AddToQueue = false,
    };

    private async Task<Guid> SeedUnassignedWaitingSessionAsync()
    {
        var sessionId = Guid.NewGuid();
        _db.CounselingSession.Add(new CounselingSession
        {
            Id = sessionId,
            TenantId = _tenant,
            BranchId = _branch,
            PatientId = _patient,
            CounselorId = null,
            SessionType = "Initial",
            SessionDate = DateTime.UtcNow.Date,
            PatientType = "Cash",
            Status = "Scheduled",
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow,
            CreatedByUserId = _admin,
            UpdatedByUserId = _admin,
        });
        _db.CounselorQueue.Add(new CounselorQueueItem
        {
            Id = Guid.NewGuid(),
            TenantId = _tenant,
            BranchId = _branch,
            SessionId = sessionId,
            PatientId = _patient,
            TokenNumber = "S5-001",
            QueueType = "Counseling",
            QueuePosition = 1,
            PriorityScore = 50,
            UrgencyLevel = "Normal",
            Status = "Waiting",
            AddedToQueueAt = DateTime.UtcNow,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow,
        });
        await _db.SaveChangesAsync();
        return sessionId;
    }

    private async Task<Guid> SeedOwnedCompletedSessionAsync(
        Guid ownerId,
        bool agreed,
        string queueStatus = "Completed")
    {
        var sessionId = Guid.NewGuid();
        _db.CounselingSession.Add(new CounselingSession
        {
            Id = sessionId,
            TenantId = _tenant,
            BranchId = _branch,
            PatientId = _patient,
            CounselorId = ownerId,
            SessionType = "Initial",
            SessionDate = DateTime.UtcNow.Date,
            PatientType = "Cash",
            Status = "Completed",
            PatientAgreedToSurgery = agreed,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow,
            CreatedByUserId = ownerId,
            UpdatedByUserId = ownerId,
        });
        _db.CounselorQueue.Add(new CounselorQueueItem
        {
            Id = Guid.NewGuid(),
            TenantId = _tenant,
            BranchId = _branch,
            SessionId = sessionId,
            PatientId = _patient,
            TokenNumber = "S5-DONE",
            QueueType = "Counseling",
            QueuePosition = 2,
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

    /// <summary>Phase 3I Slice 7 (PD-S7-01) — fetch the current DB Version right before a mutation call.</summary>
    private async Task<int> CurrentVersionAsync(Guid sessionId) =>
        (await _db.CounselingSession.AsNoTracking().FirstAsync(s => s.Id == sessionId)).Version;

    [Fact]
    public async Task Create_Counsellor_WritesOwnershipEstablishedOnCreate_DualTrail()
    {
        var result = await _svc.CreateSessionAsync(CreateRequest(), _amelia);

        Assert.True(result.Success);
        Assert.Equal(_amelia, result.Session!.CounselorId);
        Assert.Equal(1, HistoryCount(result.SessionId!.Value, "OwnershipEstablishedOnCreate"));
        var hist = _db.CounselingSessionAuditLog.Single(h =>
            h.SessionId == result.SessionId && h.ChangeType == "OwnershipEstablishedOnCreate");
        Assert.Equal(_amelia, hist.ChangedByUserId);
        Assert.Null(hist.OldValue);
        Assert.Equal(_amelia.ToString(), hist.NewValue);
        _audit.Verify(a => a.StageAsync(
            _amelia,
            "OwnershipEstablishedOnCreate",
            "CounselingSession",
            result.SessionId,
            It.IsAny<string?>(),
            null,
            _amelia.ToString()), Times.Once);
    }

    [Fact]
    public async Task Create_Admin_NoOwnershipEvent()
    {
        var result = await _svc.CreateSessionAsync(CreateRequest(), _admin);

        Assert.True(result.Success);
        Assert.Null(result.Session!.CounselorId);
        Assert.Equal(0, HistoryCount(result.SessionId!.Value, "OwnershipEstablishedOnCreate"));
        _audit.Verify(a => a.StageAsync(
            It.IsAny<Guid>(),
            "OwnershipEstablishedOnCreate",
            It.IsAny<string>(),
            It.IsAny<Guid?>(),
            It.IsAny<string?>(),
            It.IsAny<string?>(),
            It.IsAny<string?>()), Times.Never);
    }

    [Fact]
    public async Task Assign_NullToTarget_WritesOwnershipAssigned_ActorNotOwner()
    {
        var sessionId = await SeedUnassignedWaitingSessionAsync();

        var result = await _svc.AssignSessionAsync(_tenant, sessionId, _ravi, 1, _admin);

        Assert.True(result.Success);
        Assert.Equal(_ravi, result.CounselorId);
        Assert.Equal(1, HistoryCount(sessionId, "OwnershipAssigned"));
        var hist = _db.CounselingSessionAuditLog.Single(h =>
            h.SessionId == sessionId && h.ChangeType == "OwnershipAssigned");
        Assert.Equal(_admin, hist.ChangedByUserId);
        Assert.NotEqual(_admin, _ravi);
        Assert.Null(hist.OldValue);
        Assert.Equal(_ravi.ToString(), hist.NewValue);
        Assert.Equal("Assign", hist.Reason);
        _audit.Verify(a => a.StageAsync(
            _admin,
            "OwnershipAssigned",
            "CounselingSession",
            sessionId,
            It.Is<string?>(d => d != null && d.Contains(_admin.ToString()) && d.Contains(_ravi.ToString())),
            null,
            _ravi.ToString()), Times.Once);
    }

    [Fact]
    public async Task Assign_SelfFromNull_WritesDualTrail()
    {
        var sessionId = await SeedUnassignedWaitingSessionAsync();

        var result = await _svc.AssignSessionAsync(_tenant, sessionId, _amelia, 1, _amelia);

        Assert.True(result.Success);
        Assert.Equal(1, HistoryCount(sessionId, "OwnershipAssigned"));
        _audit.Verify(a => a.StageAsync(
            _amelia,
            "OwnershipAssigned",
            "CounselingSession",
            sessionId,
            It.IsAny<string?>(),
            null,
            _amelia.ToString()), Times.Once);
    }

    [Fact]
    public async Task Assign_AlreadyOwned_Conflict_NoTrail()
    {
        var sessionId = await SeedUnassignedWaitingSessionAsync();
        Assert.True((await _svc.AssignSessionAsync(_tenant, sessionId, _amelia, 1, _admin)).Success);
        _audit.Invocations.Clear();

        var conflict = await _svc.AssignSessionAsync(_tenant, sessionId, _ravi, 1, _admin);

        Assert.False(conflict.Success);
        Assert.Equal(AssignSessionFailureKind.Conflict, conflict.FailureKind);
        Assert.Equal(1, HistoryCount(sessionId, "OwnershipAssigned"));
        _audit.Verify(a => a.StageAsync(
            It.IsAny<Guid>(),
            "OwnershipAssigned",
            It.IsAny<string>(),
            It.IsAny<Guid?>(),
            It.IsAny<string?>(),
            It.IsAny<string?>(),
            It.IsAny<string?>()), Times.Never);
    }

    [Fact]
    public async Task Claim_NullToActor_ReEvaluate_WritesOwnershipClaimed()
    {
        var sessionId = await SeedOwnedCompletedSessionAsync(_amelia, agreed: true);
        var session = await _db.CounselingSession.SingleAsync(s => s.Id == sessionId);
        session.CounselorId = null;
        await _db.SaveChangesAsync();

        var result = await _svc.ClaimSessionForLifecycleAsync(
            _tenant, sessionId, null, CounselingLifecycleClaimIntent.ReEvaluate, await CurrentVersionAsync(sessionId), _ravi);

        Assert.True(result.Success);
        Assert.Equal(_ravi, result.CounselorId);
        Assert.Equal(1, HistoryCount(sessionId, "OwnershipClaimed"));
        var hist = _db.CounselingSessionAuditLog.Single(h =>
            h.SessionId == sessionId && h.ChangeType == "OwnershipClaimed");
        Assert.Equal(_ravi, hist.ChangedByUserId);
        Assert.Equal(CounselingLifecycleClaimIntent.ReEvaluate, hist.Reason);
        _audit.Verify(a => a.StageAsync(
            _ravi,
            "OwnershipClaimed",
            "CounselingSession",
            sessionId,
            It.Is<string?>(d => d != null && d.Contains("ReEvaluate")),
            null,
            _ravi.ToString()), Times.Once);
    }

    [Fact]
    public async Task Claim_PeerToActor_ReEvaluate_RecordsPreviousOwner()
    {
        var sessionId = await SeedOwnedCompletedSessionAsync(_amelia, agreed: true);

        var result = await _svc.ClaimSessionForLifecycleAsync(
            _tenant, sessionId, _amelia, CounselingLifecycleClaimIntent.ReEvaluate, await CurrentVersionAsync(sessionId), _ravi);

        Assert.True(result.Success);
        var hist = _db.CounselingSessionAuditLog.Single(h =>
            h.SessionId == sessionId && h.ChangeType == "OwnershipClaimed");
        Assert.Equal(_amelia.ToString(), hist.OldValue);
        Assert.Equal(_ravi.ToString(), hist.NewValue);
        Assert.Equal(_ravi, hist.ChangedByUserId);
    }

    [Fact]
    public async Task Claim_PeerToActor_StartRepeat_WritesIntent()
    {
        var sessionId = await SeedOwnedCompletedSessionAsync(_amelia, agreed: false);

        var result = await _svc.ClaimSessionForLifecycleAsync(
            _tenant, sessionId, _amelia, CounselingLifecycleClaimIntent.StartRepeat, await CurrentVersionAsync(sessionId), _ravi);

        Assert.True(result.Success);
        var hist = _db.CounselingSessionAuditLog.Single(h =>
            h.SessionId == sessionId && h.ChangeType == "OwnershipClaimed");
        Assert.Equal(CounselingLifecycleClaimIntent.StartRepeat, hist.Reason);
    }

    [Fact]
    public async Task Claim_SelfOwner_NoOp_NoTrail()
    {
        var sessionId = await SeedOwnedCompletedSessionAsync(_amelia, agreed: true);

        var result = await _svc.ClaimSessionForLifecycleAsync(
            _tenant, sessionId, _amelia, CounselingLifecycleClaimIntent.ReEvaluate, await CurrentVersionAsync(sessionId), _amelia);

        Assert.True(result.Success);
        Assert.Equal(0, HistoryCount(sessionId, "OwnershipClaimed"));
        _audit.Verify(a => a.StageAsync(
            It.IsAny<Guid>(),
            "OwnershipClaimed",
            It.IsAny<string>(),
            It.IsAny<Guid?>(),
            It.IsAny<string?>(),
            It.IsAny<string?>(),
            It.IsAny<string?>()), Times.Never);
    }

    [Fact]
    public async Task Claim_ExpectedMismatch_Conflict_NoTrail()
    {
        var sessionId = await SeedOwnedCompletedSessionAsync(_amelia, agreed: true);

        var result = await _svc.ClaimSessionForLifecycleAsync(
            _tenant, sessionId, _ravi, CounselingLifecycleClaimIntent.ReEvaluate, await CurrentVersionAsync(sessionId), _ravi);

        Assert.False(result.Success);
        Assert.Equal(AssignSessionFailureKind.Conflict, result.FailureKind);
        Assert.Equal(0, HistoryCount(sessionId, "OwnershipClaimed"));
        _audit.Verify(a => a.StageAsync(
            It.IsAny<Guid>(),
            "OwnershipClaimed",
            It.IsAny<string>(),
            It.IsAny<Guid?>(),
            It.IsAny<string?>(),
            It.IsAny<string?>(),
            It.IsAny<string?>()), Times.Never);
    }

    [Fact]
    public async Task Assign_WhenAuditStagingFails_RollsBackOwnership()
    {
        var sessionId = await SeedUnassignedWaitingSessionAsync();
        _audit.Setup(a => a.StageAsync(
                It.IsAny<Guid>(), It.IsAny<string>(), It.IsAny<string>(), It.IsAny<Guid?>(),
                It.IsAny<string?>(), It.IsAny<string?>(), It.IsAny<string?>()))
            .ThrowsAsync(new InvalidOperationException("audit store unreachable"));

        var result = await _svc.AssignSessionAsync(_tenant, sessionId, _ravi, await CurrentVersionAsync(sessionId), _admin);

        Assert.False(result.Success);
        var session = await _db.CounselingSession.AsNoTracking().SingleAsync(s => s.Id == sessionId);
        Assert.Null(session.CounselorId);
        Assert.Equal(0, HistoryCount(sessionId, "OwnershipAssigned"));
    }

    [Fact]
    public async Task UpdateSession_CounselorId_StillRejected_400()
    {
        var sessionId = await SeedUnassignedWaitingSessionAsync();
        Assert.True((await _svc.AssignSessionAsync(_tenant, sessionId, _amelia, 1, _admin)).Success);

        var result = await _svc.UpdateSessionAsync(_tenant, sessionId, new UpdateCounselingSessionRequest
        {
            Version = await CurrentVersionAsync(sessionId),
            CounselorId = _ravi,
            ClinicalSummary = "should not apply",
        }, _amelia);

        Assert.False(result.Success);
        Assert.Equal(SessionOperationFailureKind.BadRequest, result.FailureKind);
        var session = await _db.CounselingSession.AsNoTracking().SingleAsync(s => s.Id == sessionId);
        Assert.Equal(_amelia, session.CounselorId);
        Assert.Null(session.ClinicalSummary);
    }

    [Fact]
    public void Requeue_OwnershipClear_IsSlice8_NotSlice5()
    {
        // Slice 5 reserved OwnershipRequeued without emitting it.
        // Slice 8 owns ReQueue → NULL; see Phase3ISlice8RequeueOwnershipTests.
        Assert.Equal(
            "OwnershipRequeued",
            CounselingWorkflowService.OwnershipAuditEvents.Requeued);
    }
}
