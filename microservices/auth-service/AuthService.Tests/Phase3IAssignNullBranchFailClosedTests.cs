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
/// NULL CounselingSession.BranchId must fail Assign with the existing 403
/// before FollowupBranchAccessService is asked to resolve an omitted branch,
/// and before the target-availability NULL-skip path. Non-null Assign behavior stays.
/// </summary>
public class Phase3IAssignNullBranchFailClosedTests : IDisposable
{
    private readonly AppDbContext _db;
    private readonly CounselingWorkflowService _svc;
    private readonly RecordingBranchAccess _branches;
    private readonly Mock<IAuditService> _audit = new();

    private readonly Guid _tenant = Guid.Parse("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa");
    private readonly Guid _branchA = Guid.Parse("11111111-1111-1111-1111-111111111111");
    private readonly Guid _branchB = Guid.Parse("22222222-2222-2222-2222-222222222222");
    private readonly Guid _amelia = Guid.Parse("c0000001-0000-0000-0000-000000000001");
    private readonly Guid _ravi = Guid.Parse("c0000002-0000-0000-0000-000000000002");
    private readonly Guid _admin = Guid.Parse("a0000001-0000-0000-0000-000000000001");
    private readonly Guid _outsider = Guid.Parse("b0000002-0000-0000-0000-000000000002");
    private readonly Guid _patient = Guid.Parse("f1000001-0000-0000-0000-000000000001");

    public Phase3IAssignNullBranchFailClosedTests()
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
        Seed();
    }

    public void Dispose() => _db.Dispose();

    [Fact]
    public async Task Assign_NullSessionBranch_Returns403_WithoutBranchResolution_OrOwnershipMutation()
    {
        var sessionId = await SeedSessionAsync(branchId: null, ownerId: null);
        var before = await SnapshotAsync(sessionId);

        var result = await PostAssign(_admin, sessionId, _ravi, before.Version);

        AssertForbidden(result, "Not authorized to assign this session.");
        Assert.Empty(_branches.Calls);
        await AssertUnchangedAsync(sessionId, before);
        AssertNoOwnershipAudit(sessionId);
    }

    [Fact]
    public async Task Assign_NonNullAuthorizedBranch_Succeeds_AndRecordsOwnershipAssigned()
    {
        var sessionId = await SeedSessionAsync(_branchA, ownerId: null);
        var before = await SnapshotAsync(sessionId);

        var result = await PostAssign(_admin, sessionId, _ravi, before.Version);

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
            h.SessionId == sessionId && h.ChangeType == CounselingWorkflowService.OwnershipAuditEvents.Assigned));
        _audit.Verify(a => a.StageAsync(
            It.IsAny<Guid>(),
            CounselingWorkflowService.OwnershipAuditEvents.Assigned,
            "CounselingSession",
            sessionId,
            It.IsAny<string?>(),
            It.IsAny<string?>(),
            It.IsAny<string?>()), Times.Once);
    }

    [Fact]
    public async Task Assign_NonNullUnauthorizedActorBranch_Returns403_WithoutOwnershipMutation()
    {
        var sessionId = await SeedSessionAsync(_branchA, ownerId: null);
        var before = await SnapshotAsync(sessionId);

        var result = await PostAssign(_outsider, sessionId, _ravi, before.Version);

        AssertForbidden(result, "Not authorized to assign this session.");
        Assert.Contains(_branches.Calls, c => c.UserId == _outsider && c.RequestedBranchId == _branchA);
        await AssertUnchangedAsync(sessionId, before);
        AssertNoOwnershipAudit(sessionId);
    }

    [Fact]
    public async Task Assign_AlreadyOwned_Returns409_WithoutOwnershipChange()
    {
        var sessionId = await SeedSessionAsync(_branchA, ownerId: _amelia);
        var before = await SnapshotAsync(sessionId);

        var result = await PostAssign(_admin, sessionId, _ravi, before.Version);

        AssertConflict(result, "Session is already assigned.");
        await AssertUnchangedAsync(sessionId, before);
        Assert.Equal(_amelia, (await _db.CounselingSession.AsNoTracking().FirstAsync(s => s.Id == sessionId)).CounselorId);
        AssertNoOwnershipAudit(sessionId);
    }

    [Fact]
    public async Task Assign_StaleVersion_Returns409_WithoutOwnershipChange()
    {
        var sessionId = await SeedSessionAsync(_branchA, ownerId: null);
        var stale = await SnapshotAsync(sessionId);

        var row = await _db.CounselingSession.FirstAsync(s => s.Id == sessionId);
        row.AdditionalNotes = "concurrent edit";
        await _db.SaveChangesAsync();
        _db.ChangeTracker.Clear();

        var result = await PostAssign(_admin, sessionId, _ravi, stale.Version);

        AssertConflict(result, SessionConcurrency.StaleMessage);
        var after = await _db.CounselingSession.AsNoTracking().FirstAsync(s => s.Id == sessionId);
        Assert.Null(after.CounselorId);
        Assert.Equal(_branchA, after.BranchId);
        Assert.True(after.Version > stale.Version);
        AssertNoOwnershipAudit(sessionId);
    }

    private async Task<IActionResult> PostAssign(Guid actorId, Guid sessionId, Guid targetId, int version)
    {
        _branches.Calls.Clear();
        var controller = new CounselingController(
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

        return await controller.AssignSession(sessionId, new AssignCounselingSessionRequest
        {
            CounselorId = targetId,
            Version = version,
        });
    }

    private async Task<Guid> SeedSessionAsync(Guid? branchId, Guid? ownerId)
    {
        var sessionId = Guid.NewGuid();
        _db.CounselingSession.Add(new CounselingSession
        {
            Id = sessionId,
            TenantId = _tenant,
            BranchId = branchId,
            PatientId = _patient,
            CounselorId = ownerId,
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
            BranchId = branchId ?? _branchA,
            SessionId = sessionId,
            PatientId = _patient,
            TokenNumber = $"NB-{sessionId.ToString()[..8]}",
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
        _db.ChangeTracker.Clear();
        return sessionId;
    }

    private async Task<(Guid? CounselorId, Guid? BranchId, int Version, int AuditCount)> SnapshotAsync(Guid sessionId)
    {
        var row = await _db.CounselingSession.AsNoTracking().FirstAsync(s => s.Id == sessionId);
        var audits = await _db.CounselingSessionAuditLog.AsNoTracking().CountAsync(h => h.SessionId == sessionId);
        return (row.CounselorId, row.BranchId, row.Version, audits);
    }

    private async Task AssertUnchangedAsync(
        Guid sessionId,
        (Guid? CounselorId, Guid? BranchId, int Version, int AuditCount) before)
    {
        var after = await SnapshotAsync(sessionId);
        Assert.Equal(before.CounselorId, after.CounselorId);
        Assert.Equal(before.BranchId, after.BranchId);
        Assert.Equal(before.Version, after.Version);
        Assert.Equal(before.AuditCount, after.AuditCount);
    }

    private void AssertNoOwnershipAudit(Guid sessionId)
    {
        Assert.Equal(0, _db.CounselingSessionAuditLog.Count(h =>
            h.SessionId == sessionId && h.ChangeType == CounselingWorkflowService.OwnershipAuditEvents.Assigned));
        _audit.Verify(a => a.StageAsync(
            It.IsAny<Guid>(),
            CounselingWorkflowService.OwnershipAuditEvents.Assigned,
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

    private void Seed()
    {
        AddUser(_amelia, _branchA, "Amelia", "Martinez", "Counsellor");
        AddUser(_ravi, _branchA, "Ravi", "Kumar", "Counsellor");
        AddUser(_admin, _branchA, "Admin", "User", "Admin");
        AddUser(_outsider, _branchB, "Out", "Sider", "Admin");

        _db.Patients.Add(new Patient
        {
            Id = _patient,
            TenantId = _tenant,
            BranchId = _branchA,
            FirstName = "Pat",
            LastName = "Ent",
            MedicalRecordNumber = "MRN-NULL-BRANCH",
            DateOfBirth = new DateTime(1990, 1, 1),
            Gender = "Female",
            Status = "Active",
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow,
        });
        _db.SaveChanges();
    }

    private void AddUser(Guid id, Guid branch, string first, string last, string userType)
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
