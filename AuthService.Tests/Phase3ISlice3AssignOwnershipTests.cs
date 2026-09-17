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
/// Phase 3I Slice 3 — Explicit Assign establishes ownership (NULL → target).
/// Open/Start do not assign. Cross-branch/tenant denied. Assign-if-null concurrency.
/// </summary>
public class Phase3ISlice3AssignOwnershipTests : IDisposable
{
    private readonly AppDbContext _db;
    private readonly CounselingWorkflowService _svc;
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

    public Phase3ISlice3AssignOwnershipTests()
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
            MedicalRecordNumber = "MRN-S3",
            DateOfBirth = new DateTime(1990, 1, 1),
            Gender = "Female",
        });
        _db.SaveChanges();
    }

    private CreateCounselingSessionRequest BaseCreateRequest() => new()
    {
        TenantId = _tenant,
        BranchId = _branchA,
        PatientId = _patient,
        ReferredByDoctorId = _doctor,
        PatientType = "Cash",
        SessionType = "Initial",
        SessionDate = DateTime.UtcNow.Date,
        AddToQueue = false,
    };

    private async Task<Guid> CreateUnassignedSessionAsync(Guid actor = default)
    {
        if (actor == default) actor = _admin;
        var created = await _svc.CreateSessionAsync(BaseCreateRequest(), actor);
        Assert.True(created.Success);
        var sessionId = created.SessionId!.Value;
        // Waiting List Pending = queue Status Waiting (initial Assign eligibility).
        _db.CounselorQueue.Add(new CounselorQueueItem
        {
            Id = Guid.NewGuid(),
            TenantId = _tenant,
            BranchId = _branchA,
            SessionId = sessionId,
            PatientId = _patient,
            TokenNumber = $"T-{sessionId.ToString()[..8]}",
            QueueType = "Counseling",
            QueuePosition = 1,
            Status = "Waiting",
            AddedToQueueAt = DateTime.UtcNow,
            CreatedAt = DateTime.UtcNow,
        });
        await _db.SaveChangesAsync();
        return sessionId;
    }

    [Fact]
    public async Task Assign_AdminActor_PeerTarget_AdminIsNotOwner()
    {
        var sessionId = await CreateUnassignedSessionAsync(_admin);

        var result = await _svc.AssignSessionAsync(_tenant, sessionId, _amelia, _admin);

        Assert.True(result.Success);
        Assert.Equal(_amelia, result.CounselorId);
        var row = await _db.CounselingSession.AsNoTracking().FirstAsync(s => s.Id == sessionId);
        Assert.Equal(_amelia, row.CounselorId);
        Assert.Equal(_admin, row.UpdatedByUserId);
        Assert.NotEqual(_admin, row.CounselorId);
    }

    [Fact]
    public async Task Assign_NonPendingQueue_Rejected()
    {
        var created = await _svc.CreateSessionAsync(BaseCreateRequest(), _admin);
        Assert.True(created.Success);
        var sessionId = created.SessionId!.Value;
        _db.CounselorQueue.Add(new CounselorQueueItem
        {
            Id = Guid.NewGuid(),
            TenantId = _tenant,
            BranchId = _branchA,
            SessionId = sessionId,
            PatientId = _patient,
            TokenNumber = "T-NP",
            QueueType = "Counseling",
            QueuePosition = 1,
            Status = "InProgress",
            AddedToQueueAt = DateTime.UtcNow,
            CreatedAt = DateTime.UtcNow,
        });
        await _db.SaveChangesAsync();

        var result = await _svc.AssignSessionAsync(_tenant, sessionId, _amelia, _amelia);

        Assert.False(result.Success);
        Assert.Equal(AssignSessionFailureKind.BadRequest, result.FailureKind);
        var row = await _db.CounselingSession.AsNoTracking().FirstAsync(s => s.Id == sessionId);
        Assert.Null(row.CounselorId);
    }

    [Fact]
    public async Task Assign_Self_Unassigned_SetsCounselorIdToActor()
    {
        var sessionId = await CreateUnassignedSessionAsync();

        var result = await _svc.AssignSessionAsync(_tenant, sessionId, _amelia, _amelia);

        Assert.True(result.Success);
        Assert.Equal(_amelia, result.CounselorId);
        var row = await _db.CounselingSession.AsNoTracking().FirstAsync(s => s.Id == sessionId);
        Assert.Equal(_amelia, row.CounselorId);
        Assert.Equal(_amelia, row.UpdatedByUserId);
    }

    [Fact]
    public async Task Assign_Peer_SameBranch_OwnerIsTarget_ActorIsUpdatedBy()
    {
        var sessionId = await CreateUnassignedSessionAsync();

        var result = await _svc.AssignSessionAsync(_tenant, sessionId, _ravi, _amelia);

        Assert.True(result.Success);
        Assert.Equal(_ravi, result.CounselorId);
        var row = await _db.CounselingSession.AsNoTracking().FirstAsync(s => s.Id == sessionId);
        Assert.Equal(_ravi, row.CounselorId);
        Assert.Equal(_amelia, row.UpdatedByUserId);
        Assert.NotEqual(_amelia, row.CounselorId);
    }

    [Fact]
    public async Task Assign_CrossBranchTarget_Rejected_CounselorIdUnchanged()
    {
        var sessionId = await CreateUnassignedSessionAsync();

        var result = await _svc.AssignSessionAsync(_tenant, sessionId, _otherBranchCounsellor, _amelia);

        Assert.False(result.Success);
        Assert.Equal(AssignSessionFailureKind.Forbidden, result.FailureKind);
        var row = await _db.CounselingSession.AsNoTracking().FirstAsync(s => s.Id == sessionId);
        Assert.Null(row.CounselorId);
    }

    [Fact]
    public async Task Assign_CrossTenantTarget_Rejected_CounselorIdUnchanged()
    {
        var sessionId = await CreateUnassignedSessionAsync();

        var result = await _svc.AssignSessionAsync(_tenant, sessionId, _otherTenantCounsellor, _amelia);

        Assert.False(result.Success);
        Assert.Equal(AssignSessionFailureKind.Forbidden, result.FailureKind);
        var row = await _db.CounselingSession.AsNoTracking().FirstAsync(s => s.Id == sessionId);
        Assert.Null(row.CounselorId);
    }

    [Fact]
    public async Task Assign_InvalidTarget_NonCounsellor_Rejected()
    {
        var sessionId = await CreateUnassignedSessionAsync();

        var result = await _svc.AssignSessionAsync(_tenant, sessionId, _nonCounsellor, _amelia);

        Assert.False(result.Success);
        Assert.Equal(AssignSessionFailureKind.BadRequest, result.FailureKind);
        var row = await _db.CounselingSession.AsNoTracking().FirstAsync(s => s.Id == sessionId);
        Assert.Null(row.CounselorId);
    }

    [Fact]
    public async Task Assign_ActorNotAuthorizedForSessionBranch_Rejected()
    {
        var sessionId = await CreateUnassignedSessionAsync();

        var result = await _svc.AssignSessionAsync(_tenant, sessionId, _ravi, _otherBranchCounsellor);

        Assert.False(result.Success);
        Assert.Equal(AssignSessionFailureKind.Forbidden, result.FailureKind);
        var row = await _db.CounselingSession.AsNoTracking().FirstAsync(s => s.Id == sessionId);
        Assert.Null(row.CounselorId);
    }

    [Fact]
    public async Task Assign_AlreadyOwned_DoesNotOverwrite()
    {
        var sessionId = await CreateUnassignedSessionAsync();
        var first = await _svc.AssignSessionAsync(_tenant, sessionId, _ravi, _amelia);
        Assert.True(first.Success);

        var second = await _svc.AssignSessionAsync(_tenant, sessionId, _amelia, _amelia);

        Assert.False(second.Success);
        Assert.Equal(AssignSessionFailureKind.Conflict, second.FailureKind);
        var row = await _db.CounselingSession.AsNoTracking().FirstAsync(s => s.Id == sessionId);
        Assert.Equal(_ravi, row.CounselorId);
    }

    [Fact]
    public async Task Assign_NullToTarget_Succeeds()
    {
        var sessionId = await CreateUnassignedSessionAsync();
        var before = await _db.CounselingSession.AsNoTracking().FirstAsync(s => s.Id == sessionId);
        Assert.Null(before.CounselorId);

        var result = await _svc.AssignSessionAsync(_tenant, sessionId, _ravi, _amelia);

        Assert.True(result.Success);
        Assert.Equal(_ravi, result.CounselorId);
    }

    [Fact]
    public async Task Assign_Concurrent_AssignIfNull_ExactlyOneWinner()
    {
        // Relational providers use ExecuteUpdate (atomic WHERE CounselorId IS NULL).
        // InMemory falls back to tracked assign-if-null; sequential second writer must Conflict.
        var sessionId = await CreateUnassignedSessionAsync();

        var first = await _svc.AssignSessionAsync(_tenant, sessionId, _amelia, _amelia);
        Assert.True(first.Success);

        var second = await _svc.AssignSessionAsync(_tenant, sessionId, _ravi, _ravi);
        Assert.False(second.Success);
        Assert.Equal(AssignSessionFailureKind.Conflict, second.FailureKind);

        var owner = await _db.CounselingSession.AsNoTracking()
            .Where(s => s.Id == sessionId)
            .Select(s => s.CounselorId)
            .FirstAsync();
        Assert.Equal(_amelia, owner);
    }

    [Fact]
    public async Task Assign_IgnoresClientBranchAndTenant_UsesServerSessionScope()
    {
        // Session is branch A. Target Ravi is branch A. Actor Amelia branch A.
        // Even if a caller "meant" another branch/tenant, Assign only takes counselorId.
        var sessionId = await CreateUnassignedSessionAsync();
        var result = await _svc.AssignSessionAsync(_tenant, sessionId, _ravi, _amelia);
        Assert.True(result.Success);
        Assert.Equal(_ravi, result.CounselorId);
    }

    [Fact]
    public async Task Start_StillDoesNotEstablishOwnership()
    {
        // Slice 4: unassigned Start is Forbidden (PD-AUTH-01). Must still not stamp CounselorId.
        var sessionId = await CreateUnassignedSessionAsync();
        var started = await _svc.StartSessionAsync(_tenant, sessionId, _amelia);
        Assert.False(started.Success);
        Assert.Equal(SessionOperationFailureKind.Forbidden, started.FailureKind);
        var row = await _db.CounselingSession.AsNoTracking().FirstAsync(s => s.Id == sessionId);
        Assert.Null(row.CounselorId);
    }

    [Fact]
    public async Task Create_Admin_StillCounselorIdNull()
    {
        var created = await _svc.CreateSessionAsync(BaseCreateRequest(), _admin);
        Assert.True(created.Success);
        var row = await _db.CounselingSession.AsNoTracking().FirstAsync(s => s.Id == created.SessionId);
        Assert.Null(row.CounselorId);
    }

    [Fact]
    public async Task Assign_DoneCompletedQueue_NullOwner_Rejected_UseLifecycleClaim()
    {
        var sessionId = await CreateUnassignedSessionAsync();
        var queue = await _db.CounselorQueue.FirstAsync(q => q.SessionId == sessionId);
        queue.Status = "Completed";
        var session = await _db.CounselingSession.FirstAsync(s => s.Id == sessionId);
        session.PatientAgreedToSurgery = true;
        await _db.SaveChangesAsync();

        var result = await _svc.AssignSessionAsync(_tenant, sessionId, _amelia, _amelia);

        Assert.False(result.Success);
        Assert.Equal(AssignSessionFailureKind.BadRequest, result.FailureKind);
        Assert.Contains("Pending", result.Message);
        var row = await _db.CounselingSession.AsNoTracking().FirstAsync(s => s.Id == sessionId);
        Assert.Null(row.CounselorId);
    }

    [Fact]
    public async Task Assign_RepeatCompletedQueue_NullOwner_Rejected_UseLifecycleClaim()
    {
        var sessionId = await CreateUnassignedSessionAsync();
        var queue = await _db.CounselorQueue.FirstAsync(q => q.SessionId == sessionId);
        queue.Status = "Completed";
        var session = await _db.CounselingSession.FirstAsync(s => s.Id == sessionId);
        session.PatientAgreedToSurgery = false;
        await _db.SaveChangesAsync();

        var result = await _svc.AssignSessionAsync(_tenant, sessionId, _ravi, _amelia);

        Assert.False(result.Success);
        Assert.Equal(AssignSessionFailureKind.BadRequest, result.FailureKind);
        Assert.Contains("Pending", result.Message);
        var row = await _db.CounselingSession.AsNoTracking().FirstAsync(s => s.Id == sessionId);
        Assert.Null(row.CounselorId);
    }

    [Fact]
    public async Task Assign_ProcessedInProgress_NullOwner_Rejected()
    {
        var sessionId = await CreateUnassignedSessionAsync();
        var queue = await _db.CounselorQueue.FirstAsync(q => q.SessionId == sessionId);
        queue.Status = "InProgress";
        await _db.SaveChangesAsync();

        var result = await _svc.AssignSessionAsync(_tenant, sessionId, _amelia, _amelia);

        Assert.False(result.Success);
        Assert.Equal(AssignSessionFailureKind.BadRequest, result.FailureKind);
        var row = await _db.CounselingSession.AsNoTracking().FirstAsync(s => s.Id == sessionId);
        Assert.Null(row.CounselorId);
    }

    [Fact]
    public async Task Assign_UnknownSession_NotFound()
    {
        var result = await _svc.AssignSessionAsync(_tenant, Guid.NewGuid(), _ravi, _amelia);
        Assert.False(result.Success);
        Assert.Equal(AssignSessionFailureKind.NotFound, result.FailureKind);
    }

    [Fact]
    public async Task Assign_UnknownTarget_NotFoundOrBadRequest()
    {
        var sessionId = await CreateUnassignedSessionAsync();
        var result = await _svc.AssignSessionAsync(_tenant, sessionId, Guid.NewGuid(), _amelia);
        Assert.False(result.Success);
        Assert.True(
            result.FailureKind == AssignSessionFailureKind.NotFound
            || result.FailureKind == AssignSessionFailureKind.BadRequest);
        var row = await _db.CounselingSession.AsNoTracking().FirstAsync(s => s.Id == sessionId);
        Assert.Null(row.CounselorId);
    }
}
