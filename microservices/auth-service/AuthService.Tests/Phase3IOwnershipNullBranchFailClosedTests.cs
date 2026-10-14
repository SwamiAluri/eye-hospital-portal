using System.Security.Claims;
using AuthService.Context;
using AuthService.Controllers;
using AuthService.Hubs;
using AuthService.Models.Counselor;
using AuthService.Models.Domain;
using AuthService.Models.Identity;
using AuthService.Services;
using AuthService.Services.Interfaces;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.SignalR;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using Moq;
using Xunit;

namespace AuthService.Tests;

/// <summary>
/// NULL CounselingSession.BranchId must fail Claim, Reassign, and ReQueue with the
/// existing Assign 403 before branch access is treated as all branches, before
/// target availability can pass, and before ownership mutation or audit.
/// Non-null ownership behavior stays.
/// </summary>
public class Phase3IOwnershipNullBranchFailClosedTests : IDisposable
{
    private const string NullBranchForbiddenMessage = "Not authorized to assign this session.";

    private readonly AppDbContext _db;
    private readonly CounselingWorkflowService _svc;
    private readonly RecordingBranchAccess _branches;
    private readonly Mock<IAuditService> _audit = new();

    private readonly Guid _tenant = Guid.Parse("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa");
    private readonly Guid _branchA = Guid.Parse("11111111-1111-1111-1111-111111111111");
    private readonly Guid _branchB = Guid.Parse("22222222-2222-2222-2222-222222222222");
    private readonly Guid _amelia = Guid.Parse("c0000001-0000-0000-0000-000000000001");
    private readonly Guid _ravi = Guid.Parse("c0000002-0000-0000-0000-000000000002");
    private readonly Guid _otherCounsellor = Guid.Parse("c0000003-0000-0000-0000-000000000003");
    private readonly Guid _admin = Guid.Parse("a0000001-0000-0000-0000-000000000001");
    private readonly Guid _outsider = Guid.Parse("b0000002-0000-0000-0000-000000000002");
    private readonly Guid _patient = Guid.Parse("f1000001-0000-0000-0000-000000000001");
    private readonly Guid _unrelatedSession;

    public Phase3IOwnershipNullBranchFailClosedTests()
    {
        _db = TestDbContextFactory.CreateInMemoryNamed(Guid.NewGuid().ToString());
        _branches = new RecordingBranchAccess(new FollowupBranchAccessService(_db));
        _audit.Setup(a => a.StageAsync(
                It.IsAny<Guid>(),
                It.IsAny<string>(),
                It.IsAny<string>(),
                It.IsAny<Guid?>(),
                It.IsAny<string?>(),
                It.IsAny<string?>(),
                It.IsAny<string?>()))
            .Returns(Task.CompletedTask);
        _svc = CreateWorkflow(_db, _branches, _audit.Object);
        _unrelatedSession = Seed();
    }

    public void Dispose() => _db.Dispose();

    [Fact]
    public async Task Claim_NullSessionBranch_Returns403_WithoutOwnershipMutation_OrAudit()
    {
        var sessionId = await SeedSessionAsync(branchId: null, ownerId: null, queueStatus: "Completed");
        var before = await SnapshotAsync(sessionId);
        var unrelated = await SnapshotAsync(_unrelatedSession);

        var result = await PostClaim(_amelia, sessionId, expectedOwner: null, CounselingLifecycleClaimIntent.StartRepeat, before.Version);

        AssertForbidden(result, NullBranchForbiddenMessage);
        Assert.Empty(_branches.Calls);
        await AssertUnchangedAsync(sessionId, before);
        await AssertUnchangedAsync(_unrelatedSession, unrelated);
        AssertNoOwnershipAudit(sessionId, CounselingWorkflowService.OwnershipAuditEvents.Claimed);
        Assert.Equal(0, await GuidEmptyQueueCountAsync());
    }

    [Fact]
    public async Task Reassign_NullSessionBranch_Returns403_WithoutOwnershipMutation_OrAudit()
    {
        var sessionId = await SeedSessionAsync(branchId: null, ownerId: _amelia, queueStatus: "Waiting");
        var before = await SnapshotAsync(sessionId);
        var targetBefore = await UserSnapshotAsync(_ravi);

        var result = await PostReassign(_admin, sessionId, _ravi, _amelia, before.Version, "Coverage change");

        AssertForbidden(result, NullBranchForbiddenMessage);
        Assert.Empty(_branches.Calls);
        await AssertUnchangedAsync(sessionId, before);
        Assert.Equal(targetBefore, await UserSnapshotAsync(_ravi));
        AssertNoOwnershipAudit(sessionId, CounselingWorkflowService.OwnershipAuditEvents.Reassigned);
        Assert.Equal(0, await GuidEmptyQueueCountAsync());
    }

    [Fact]
    public async Task ReQueue_NullSessionBranch_Returns403_WithoutClearingOwner_OrGuidEmptyQueue_OrAudit()
    {
        var sessionId = await SeedSessionAsync(branchId: null, ownerId: _amelia, queueStatus: "InProgress");
        var before = await SnapshotAsync(sessionId);

        var result = await PostReQueue(_amelia, sessionId, _amelia, before.Version, "Patient asked to wait");

        AssertForbidden(result, NullBranchForbiddenMessage);
        Assert.Empty(_branches.Calls);
        await AssertUnchangedAsync(sessionId, before);
        Assert.Equal(_amelia, (await _db.CounselingSession.AsNoTracking().FirstAsync(s => s.Id == sessionId)).CounselorId);
        AssertNoOwnershipAudit(sessionId, CounselingWorkflowService.OwnershipAuditEvents.Requeued);
        Assert.Equal(0, await GuidEmptyQueueCountAsync());
        Assert.Equal(before.QueueCount, await QueueCountAsync(sessionId));
    }

    [Fact]
    public async Task TargetAvailability_NullSessionBranch_IsNotTreatedAsAuthorized()
    {
        var sessionId = await SeedSessionAsync(branchId: null, ownerId: _amelia, queueStatus: "Waiting");
        var before = await SnapshotAsync(sessionId);

        var result = await PostReassign(_admin, sessionId, _ravi, _amelia, before.Version, "Target stays unauthorized");

        AssertForbidden(result, NullBranchForbiddenMessage);
        Assert.DoesNotContain(_branches.Calls, c => c.RequestedBranchId == null);
        Assert.DoesNotContain(_branches.Calls, c => c.UserId == _ravi);
        await AssertUnchangedAsync(sessionId, before);
        Assert.Equal(_amelia, (await _db.CounselingSession.AsNoTracking().FirstAsync(s => s.Id == sessionId)).CounselorId);
    }

    [Fact]
    public async Task Assign_NullSessionBranch_StillReturns403_WithoutOwnershipMutation()
    {
        var sessionId = await SeedSessionAsync(branchId: null, ownerId: null);
        var before = await SnapshotAsync(sessionId);

        var result = await PostAssign(_admin, sessionId, _ravi, before.Version);

        AssertForbidden(result, NullBranchForbiddenMessage);
        Assert.Empty(_branches.Calls);
        await AssertUnchangedAsync(sessionId, before);
        AssertNoOwnershipAudit(sessionId, CounselingWorkflowService.OwnershipAuditEvents.Assigned);
    }

    [Fact]
    public async Task Claim_NonNullAuthorizedBranch_Succeeds_AndRecordsOwnershipClaimed()
    {
        var sessionId = await SeedSessionAsync(_branchA, ownerId: null, queueStatus: "Completed");
        var before = await SnapshotAsync(sessionId);

        var result = await PostClaim(_amelia, sessionId, expectedOwner: null, CounselingLifecycleClaimIntent.StartRepeat, before.Version);

        var ok = Assert.IsType<OkObjectResult>(result);
        var body = Assert.IsType<AssignSessionResult>(ok.Value);
        Assert.True(body.Success);
        Assert.Equal(_amelia, body.CounselorId);
        Assert.Equal(before.Version + 1, body.Version);

        var row = await _db.CounselingSession.AsNoTracking().FirstAsync(s => s.Id == sessionId);
        Assert.Equal(_amelia, row.CounselorId);
        Assert.Equal(_branchA, row.BranchId);
        Assert.Equal(before.Version + 1, row.Version);
        Assert.Contains(_branches.Calls, c => c.UserId == _amelia && c.RequestedBranchId == _branchA);
        Assert.DoesNotContain(_branches.Calls, c => c.RequestedBranchId == null);
        Assert.Equal(1, _db.CounselingSessionAuditLog.Count(h =>
            h.SessionId == sessionId && h.ChangeType == CounselingWorkflowService.OwnershipAuditEvents.Claimed));
    }

    [Fact]
    public async Task Reassign_NonNullAuthorizedBranch_Succeeds_AndRecordsOwnershipReassigned()
    {
        var sessionId = await SeedSessionAsync(_branchA, ownerId: _amelia, queueStatus: "Waiting");
        var before = await SnapshotAsync(sessionId);

        var result = await PostReassign(_admin, sessionId, _ravi, _amelia, before.Version, "Coverage change");

        var ok = Assert.IsType<OkObjectResult>(result);
        var body = Assert.IsType<AssignSessionResult>(ok.Value);
        Assert.True(body.Success);
        Assert.Equal(_ravi, body.CounselorId);
        Assert.Equal(before.Version + 1, body.Version);

        var row = await _db.CounselingSession.AsNoTracking().FirstAsync(s => s.Id == sessionId);
        Assert.Equal(_ravi, row.CounselorId);
        Assert.Equal(_branchA, row.BranchId);
        Assert.Equal(before.Version + 1, row.Version);
        Assert.Contains(_branches.Calls, c => c.UserId == _admin && c.RequestedBranchId == _branchA);
        Assert.Contains(_branches.Calls, c => c.UserId == _ravi && c.RequestedBranchId == _branchA);
        Assert.DoesNotContain(_branches.Calls, c => c.RequestedBranchId == null);
        Assert.Equal(1, _db.CounselingSessionAuditLog.Count(h =>
            h.SessionId == sessionId && h.ChangeType == CounselingWorkflowService.OwnershipAuditEvents.Reassigned));
    }

    [Fact]
    public async Task ReQueue_NonNullAuthorizedBranch_Succeeds_WithoutGuidEmptyQueue()
    {
        var sessionId = await SeedSessionAsync(_branchA, ownerId: _amelia, queueStatus: "InProgress");
        var before = await SnapshotAsync(sessionId);

        var result = await PostReQueue(_admin, sessionId, _amelia, before.Version, "Patient asked to wait");

        var ok = Assert.IsType<OkObjectResult>(result);
        Assert.Equal(StatusCodes.Status200OK, ok.StatusCode);
        var row = await _db.CounselingSession.AsNoTracking().FirstAsync(s => s.Id == sessionId);
        Assert.Null(row.CounselorId);
        Assert.Equal(_branchA, row.BranchId);
        Assert.Equal(before.Version + 1, row.Version);
        Assert.Contains(_branches.Calls, c => c.UserId == _admin && c.RequestedBranchId == _branchA);
        Assert.DoesNotContain(_branches.Calls, c => c.RequestedBranchId == null);
        Assert.Equal(0, await GuidEmptyQueueCountAsync());
        Assert.Contains(
            await _db.CounselorQueue.AsNoTracking().Where(q => q.SessionId == sessionId && q.DeletedAt == null).ToListAsync(),
            q => q.BranchId == _branchA && q.Status == "Waiting");
        Assert.Equal(1, _db.CounselingSessionAuditLog.Count(h =>
            h.SessionId == sessionId && h.ChangeType == CounselingWorkflowService.OwnershipAuditEvents.Requeued));
    }

    [Fact]
    public async Task UnauthorizedNonNullBranch_Remains403_WithExistingOperationMessages()
    {
        var claimId = await SeedSessionAsync(_branchA, ownerId: null, queueStatus: "Completed");
        var claimBefore = await SnapshotAsync(claimId);
        var claim = await PostClaim(_otherCounsellor, claimId, expectedOwner: null, CounselingLifecycleClaimIntent.StartRepeat, claimBefore.Version);
        AssertForbidden(claim, "Not authorized to claim this session.");
        await AssertUnchangedAsync(claimId, claimBefore);

        var reassignId = await SeedSessionAsync(_branchA, ownerId: _amelia, queueStatus: "Waiting");
        var reassignBefore = await SnapshotAsync(reassignId);
        var reassign = await PostReassign(_outsider, reassignId, _ravi, _amelia, reassignBefore.Version, "Coverage change");
        AssertForbidden(reassign, "Not authorized to reassign this session.");
        await AssertUnchangedAsync(reassignId, reassignBefore);

        var requeueId = await SeedSessionAsync(_branchA, ownerId: _amelia, queueStatus: "InProgress");
        var requeueBefore = await SnapshotAsync(requeueId);
        var requeue = await PostReQueue(_outsider, requeueId, _amelia, requeueBefore.Version, "Patient asked to wait");
        AssertForbidden(requeue, "Not authorized to requeue this session.");
        await AssertUnchangedAsync(requeueId, requeueBefore);
    }

    [Fact]
    public async Task StaleVersion_Remains409_WithoutOwnershipChange()
    {
        var claimId = await SeedSessionAsync(_branchA, ownerId: null, queueStatus: "Completed");
        var claimStale = await SnapshotAsync(claimId);
        await TouchAsync(claimId);
        var claim = await PostClaim(_amelia, claimId, expectedOwner: null, CounselingLifecycleClaimIntent.StartRepeat, claimStale.Version);
        AssertConflict(claim, SessionConcurrency.StaleMessage);
        Assert.Null((await _db.CounselingSession.AsNoTracking().FirstAsync(s => s.Id == claimId)).CounselorId);

        var reassignId = await SeedSessionAsync(_branchA, ownerId: _amelia, queueStatus: "Waiting");
        var reassignStale = await SnapshotAsync(reassignId);
        await TouchAsync(reassignId);
        var reassign = await PostReassign(_admin, reassignId, _ravi, _amelia, reassignStale.Version, "Coverage change");
        AssertConflict(reassign, SessionConcurrency.StaleMessage);
        Assert.Equal(_amelia, (await _db.CounselingSession.AsNoTracking().FirstAsync(s => s.Id == reassignId)).CounselorId);

        var requeueId = await SeedSessionAsync(_branchA, ownerId: _amelia, queueStatus: "InProgress");
        var requeueStale = await SnapshotAsync(requeueId);
        await TouchAsync(requeueId);
        var requeue = await PostReQueue(_admin, requeueId, _amelia, requeueStale.Version, "Patient asked to wait");
        AssertConflict(requeue, SessionConcurrency.StaleMessage);
        Assert.Equal(_amelia, (await _db.CounselingSession.AsNoTracking().FirstAsync(s => s.Id == requeueId)).CounselorId);
        Assert.Equal(0, await GuidEmptyQueueCountAsync());
    }

    [Fact]
    public async Task Claim_AlreadyOwnedByActor_RemainsIdempotent_WithoutVersionChange()
    {
        var sessionId = await SeedSessionAsync(_branchA, ownerId: _amelia, queueStatus: "Completed");
        var before = await SnapshotAsync(sessionId);

        var result = await PostClaim(_amelia, sessionId, _amelia, CounselingLifecycleClaimIntent.StartRepeat, before.Version);

        var ok = Assert.IsType<OkObjectResult>(result);
        var body = Assert.IsType<AssignSessionResult>(ok.Value);
        Assert.True(body.Success);
        Assert.Equal("Session already owned by you.", body.Message);
        Assert.Equal(before.Version, body.Version);
        await AssertUnchangedAsync(sessionId, before);
        AssertNoOwnershipAudit(sessionId, CounselingWorkflowService.OwnershipAuditEvents.Claimed);
    }

    private async Task<IActionResult> PostAssign(Guid actorId, Guid sessionId, Guid targetId, int version)
    {
        _branches.Calls.Clear();
        return await Controller(actorId).AssignSession(sessionId, new AssignCounselingSessionRequest
        {
            CounselorId = targetId,
            Version = version,
        });
    }

    private async Task<IActionResult> PostClaim(
        Guid actorId, Guid sessionId, Guid? expectedOwner, string intent, int version)
    {
        _branches.Calls.Clear();
        return await Controller(actorId).ClaimSessionForLifecycle(sessionId, new ClaimCounselingSessionForLifecycleRequest
        {
            ExpectedCounselorId = expectedOwner,
            Intent = intent,
            Version = version,
        });
    }

    private async Task<IActionResult> PostReassign(
        Guid actorId, Guid sessionId, Guid targetId, Guid expectedOwner, int version, string reason)
    {
        _branches.Calls.Clear();
        return await Controller(actorId).ReassignSession(sessionId, new ReassignCounselingSessionRequest
        {
            CounselorId = targetId,
            ExpectedCounselorId = expectedOwner,
            Reason = reason,
            Version = version,
        });
    }

    private async Task<IActionResult> PostReQueue(
        Guid actorId, Guid sessionId, Guid? expectedOwner, int version, string reason)
    {
        _branches.Calls.Clear();
        return await Controller(actorId).ReQueueSession(sessionId, new ReQueueSessionRequest
        {
            Version = version,
            ExpectedCounselorId = expectedOwner,
            Reason = reason,
        });
    }

    private CounselingController Controller(Guid actorId) => new(
        _svc,
        new Mock<ICounselorCommunicationService>().Object,
        new Mock<IFollowupListService>().Object,
        _branches,
        new Mock<ICounselingAnalyticsService>().Object,
        new Mock<ILogger<CounselingController>>().Object,
        new Mock<IEmailService>().Object,
        new Mock<ISmsService>().Object,
        new Mock<IHubContext<QueueHub>>().Object,
        _db,
        new Mock<IOtFinalizeService>().Object,
        new Mock<ICounselingSessionDocumentCanonicalService>().Object)
    {
        ControllerContext = new ControllerContext
        {
            HttpContext = new DefaultHttpContext
            {
                User = new ClaimsPrincipal(new ClaimsIdentity(new[]
                {
                    new Claim(ClaimTypes.NameIdentifier, actorId.ToString()),
                    new Claim("TenantId", _tenant.ToString()),
                }, "test")),
            },
        },
    };

    private async Task<Guid> SeedSessionAsync(
        Guid? branchId,
        Guid? ownerId,
        string queueStatus = "Waiting",
        bool? agreed = null)
    {
        var sessionId = Guid.NewGuid();
        var updatedAt = new DateTime(2026, 9, 1, 8, 0, 0, DateTimeKind.Utc);
        _db.CounselingSession.Add(new CounselingSession
        {
            Id = sessionId,
            TenantId = _tenant,
            BranchId = branchId,
            PatientId = _patient,
            CounselorId = ownerId,
            SessionType = "Initial",
            SessionDate = updatedAt.Date,
            PatientType = "Cash",
            Status = "Scheduled",
            PatientAgreedToSurgery = agreed,
            CreatedAt = updatedAt,
            UpdatedAt = updatedAt,
            CreatedByUserId = _admin,
            UpdatedByUserId = _admin,
        });
        _db.CounselorQueue.Add(new CounselorQueueItem
        {
            Id = Guid.NewGuid(),
            TenantId = _tenant,
            BranchId = branchId ?? _branchA,
            SessionId = sessionId,
            PatientId = _patient,
            TokenNumber = $"NB-{sessionId.ToString()[..8]}",
            QueueType = "Counseling",
            QueuePosition = 1,
            PriorityScore = 50,
            UrgencyLevel = "Normal",
            Status = queueStatus,
            AddedToQueueAt = updatedAt,
            CreatedAt = updatedAt,
            UpdatedAt = updatedAt,
        });
        await _db.SaveChangesAsync();
        _db.ChangeTracker.Clear();
        return sessionId;
    }

    private async Task TouchAsync(Guid sessionId)
    {
        var row = await _db.CounselingSession.FirstAsync(s => s.Id == sessionId);
        row.AdditionalNotes = "concurrent edit";
        await _db.SaveChangesAsync();
        _db.ChangeTracker.Clear();
    }

    private async Task<SessionSnap> SnapshotAsync(Guid sessionId)
    {
        var row = await _db.CounselingSession.AsNoTracking().FirstAsync(s => s.Id == sessionId);
        var audits = await _db.CounselingSessionAuditLog.AsNoTracking().CountAsync(h => h.SessionId == sessionId);
        var queues = await _db.CounselorQueue.AsNoTracking().CountAsync(q => q.SessionId == sessionId);
        return new SessionSnap(row.CounselorId, row.BranchId, row.Version, row.UpdatedAt, audits, queues);
    }

    private async Task AssertUnchangedAsync(Guid sessionId, SessionSnap before)
    {
        var after = await SnapshotAsync(sessionId);
        Assert.Equal(before, after);
    }

    private Task<int> GuidEmptyQueueCountAsync() =>
        _db.CounselorQueue.AsNoTracking().CountAsync(q => q.BranchId == Guid.Empty);

    private Task<int> QueueCountAsync(Guid sessionId) =>
        _db.CounselorQueue.AsNoTracking().CountAsync(q => q.SessionId == sessionId);

    private async Task<(Guid? BranchId, string? UserStatus, string? UserType)> UserSnapshotAsync(Guid userId)
    {
        var user = await _db.Users.AsNoTracking().FirstAsync(u => u.Id == userId);
        return (user.BranchId, user.UserStatus, user.UserType);
    }

    private void AssertNoOwnershipAudit(Guid sessionId, string changeType)
    {
        Assert.Equal(0, _db.CounselingSessionAuditLog.Count(h =>
            h.SessionId == sessionId && h.ChangeType == changeType));
        _audit.Verify(a => a.StageAsync(
            It.IsAny<Guid>(),
            changeType,
            It.IsAny<string>(),
            It.IsAny<Guid?>(),
            It.IsAny<string?>(),
            It.IsAny<string?>(),
            It.IsAny<string?>()), Times.Never);
    }

    private static void AssertForbidden(IActionResult result, string message)
    {
        var forbidden = Assert.IsType<ObjectResult>(result);
        Assert.Equal(StatusCodes.Status403Forbidden, forbidden.StatusCode);
        Assert.Equal(message, ReadMessage(forbidden.Value));
    }

    private static void AssertConflict(IActionResult result, string message)
    {
        var conflict = Assert.IsType<ConflictObjectResult>(result);
        Assert.Equal(StatusCodes.Status409Conflict, conflict.StatusCode);
        Assert.Equal(message, ReadMessage(conflict.Value));
    }

    private static string? ReadMessage(object? value) =>
        value?.GetType().GetProperty("message")?.GetValue(value) as string;

    private Guid Seed()
    {
        AddUser(_amelia, _branchA, "Amelia", "Martinez", "Counsellor", "active");
        AddUser(_ravi, _branchA, "Ravi", "Kumar", "Counsellor", "active");
        AddUser(_otherCounsellor, _branchB, "Other", "Counsellor", "Counsellor", "active");
        AddUser(_admin, _branchA, "Admin", "User", "Admin", "active");
        AddUser(_outsider, _branchB, "Out", "Sider", "Admin", "active");

        _db.Patients.Add(new Patient
        {
            Id = _patient,
            TenantId = _tenant,
            BranchId = _branchA,
            FirstName = "Pat",
            LastName = "Ent",
            MedicalRecordNumber = "MRN-NULL-OWN",
            DateOfBirth = new DateTime(1990, 1, 1),
            Gender = "Female",
            Status = "Active",
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow,
        });

        var unrelated = Guid.NewGuid();
        var stamp = new DateTime(2026, 8, 1, 8, 0, 0, DateTimeKind.Utc);
        _db.CounselingSession.Add(new CounselingSession
        {
            Id = unrelated,
            TenantId = _tenant,
            BranchId = _branchA,
            PatientId = _patient,
            CounselorId = _ravi,
            SessionType = "Initial",
            SessionDate = stamp.Date,
            PatientType = "Cash",
            Status = "Scheduled",
            CreatedAt = stamp,
            UpdatedAt = stamp,
            CreatedByUserId = _admin,
            UpdatedByUserId = _admin,
        });
        _db.SaveChanges();
        return unrelated;
    }

    private void AddUser(Guid id, Guid branch, string first, string last, string userType, string userStatus)
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
            BranchId = branch,
            UserType = userType,
            UserStatus = userStatus,
        });
        _db.UserBranches.Add(new UserBranch
        {
            Id = Guid.NewGuid(),
            TenantId = _tenant,
            UserId = id,
            BranchId = branch,
            Status = "active",
            EffectiveFrom = DateTime.UtcNow.AddDays(-30),
        });
    }

    private static CounselingWorkflowService CreateWorkflow(
        AppDbContext db,
        IFollowupBranchAccessService branchAccess,
        IAuditService audit)
    {
        var config = new Mock<IConfiguration>();
        config.Setup(c => c["CcmsService:BaseUrl"]).Returns("http://localhost:7075/api");
        config.Setup(c => c["InternalApi:Key"]).Returns(string.Empty);
        return new CounselingWorkflowService(
            db,
            new Mock<ILogger<CounselingWorkflowService>>().Object,
            new Mock<IBlobStorageService>().Object,
            new Mock<IHttpClientFactory>().Object,
            config.Object,
            new Mock<IQueueDisplayNotifier>().Object,
            branchAccess,
            audit);
    }

    private sealed record SessionSnap(
        Guid? CounselorId,
        Guid? BranchId,
        int Version,
        DateTime? UpdatedAt,
        int AuditCount,
        int QueueCount);

    private sealed class RecordingBranchAccess : IFollowupBranchAccessService
    {
        private readonly IFollowupBranchAccessService _inner;
        public List<(Guid UserId, Guid? RequestedBranchId)> Calls { get; } = new();

        public RecordingBranchAccess(IFollowupBranchAccessService inner) => _inner = inner;

        public Task<IReadOnlyList<Guid>> ResolveAccessibleBranchesAsync(
            Guid tenantId,
            Guid userId,
            Guid? requestedBranchId,
            CancellationToken ct = default)
        {
            Calls.Add((userId, requestedBranchId));
            return _inner.ResolveAccessibleBranchesAsync(tenantId, userId, requestedBranchId, ct);
        }

        public Task<Guid> ResolveEffectiveBranchAsync(
            Guid tenantId,
            Guid userId,
            Guid? requestedBranchId,
            CancellationToken ct = default) =>
            _inner.ResolveEffectiveBranchAsync(tenantId, userId, requestedBranchId, ct);
    }
}
