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
/// Phase 3I — lifecycle ownership claim for Done Re-evaluate / Repeat Start.
/// Not general Reassign (Slice 6 / PD-REASSIGN-01).
/// </summary>
public class Phase3ILifecycleClaimOwnershipTests : IDisposable
{
    private readonly AppDbContext _db;
    private readonly CounselingWorkflowService _svc;

    private readonly Guid _tenant = Guid.Parse("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa");
    private readonly Guid _otherTenant = Guid.Parse("bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb");
    private readonly Guid _branchA = Guid.Parse("11111111-1111-1111-1111-111111111111");
    private readonly Guid _branchB = Guid.Parse("22222222-2222-2222-2222-222222222222");
    private readonly Guid _amelia = Guid.Parse("c0000001-0000-0000-0000-000000000001");
    private readonly Guid _ravi = Guid.Parse("c0000002-0000-0000-0000-000000000002");
    private readonly Guid _otherBranchCounsellor = Guid.Parse("c0000003-0000-0000-0000-000000000003");
    private readonly Guid _otherTenantCounsellor = Guid.Parse("c0000004-0000-0000-0000-000000000004");
    private readonly Guid _admin = Guid.Parse("a0000001-0000-0000-0000-000000000001");
    private readonly Guid _patient = Guid.Parse("f1000001-0000-0000-0000-000000000001");
    private readonly Guid _doctor = Guid.Parse("e1000001-0000-0000-0000-000000000001");

    public Phase3ILifecycleClaimOwnershipTests()
    {
        _db = TestDbContextFactory.CreateInMemory();
        var branchAccess = new FollowupBranchAccessService(_db);
        _svc = CreateWorkflowService(_db, branchAccess);
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
            MedicalRecordNumber = "MRN-LC",
            DateOfBirth = new DateTime(1990, 1, 1),
            Gender = "Female",
        });
        _db.SaveChanges();
    }

    private async Task<Guid> CreateOwnedCompletedSessionAsync(
        Guid ownerId,
        bool patientAgreed,
        string queueStatus = "Completed")
    {
        var created = await _svc.CreateSessionAsync(new CreateCounselingSessionRequest
        {
            TenantId = _tenant,
            BranchId = _branchA,
            PatientId = _patient,
            ReferredByDoctorId = _doctor,
            PatientType = "Cash",
            SessionType = "Initial",
            SessionDate = DateTime.UtcNow.Date,
            AddToQueue = false,
        }, _admin);
        Assert.True(created.Success);
        var sessionId = created.SessionId!.Value;

        var session = await _db.CounselingSession.FirstAsync(s => s.Id == sessionId);
        session.CounselorId = ownerId;
        session.PatientAgreedToSurgery = patientAgreed;
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
            Status = queueStatus,
            AddedToQueueAt = DateTime.UtcNow,
            CreatedAt = DateTime.UtcNow,
        });
        await _db.SaveChangesAsync();
        return sessionId;
    }

    /// <summary>Phase 3I Slice 7 (PD-S7-01) — fetch the current DB Version right before a mutation call,
    /// since seed helpers above mutate the tracked CounselingSession (bumping Version past 1).</summary>
    private async Task<int> VersionOf(Guid sessionId) =>
        await _db.CounselingSession.AsNoTracking()
            .Where(s => s.Id == sessionId)
            .Select(s => s.Version)
            .FirstAsync();

    [Fact]
    public async Task Claim_Done_OtherOwner_Succeeds_OwnerBecomesActor()
    {
        var sessionId = await CreateOwnedCompletedSessionAsync(_ravi, patientAgreed: true);

        var result = await _svc.ClaimSessionForLifecycleAsync(
            _tenant, sessionId, _ravi, CounselingLifecycleClaimIntent.ReEvaluate, await VersionOf(sessionId), _amelia);

        Assert.True(result.Success);
        Assert.Equal(_amelia, result.CounselorId);
        var row = await _db.CounselingSession.AsNoTracking().FirstAsync(s => s.Id == sessionId);
        Assert.Equal(_amelia, row.CounselorId);
        Assert.Equal(_amelia, row.UpdatedByUserId);
    }

    [Fact]
    public async Task Claim_Repeat_OtherOwner_Succeeds()
    {
        var sessionId = await CreateOwnedCompletedSessionAsync(_ravi, patientAgreed: false);

        var result = await _svc.ClaimSessionForLifecycleAsync(
            _tenant, sessionId, _ravi, CounselingLifecycleClaimIntent.StartRepeat, 2, _amelia);

        Assert.True(result.Success);
        Assert.Equal(_amelia, result.CounselorId);
    }

    [Fact]
    public async Task Claim_StaleExpectedOwner_Conflict()
    {
        var sessionId = await CreateOwnedCompletedSessionAsync(_ravi, patientAgreed: true);

        var result = await _svc.ClaimSessionForLifecycleAsync(
            _tenant, sessionId, _amelia, CounselingLifecycleClaimIntent.ReEvaluate, 2, _amelia);

        Assert.False(result.Success);
        Assert.Equal(AssignSessionFailureKind.Conflict, result.FailureKind);
        var row = await _db.CounselingSession.AsNoTracking().FirstAsync(s => s.Id == sessionId);
        Assert.Equal(_ravi, row.CounselorId);
    }

    [Fact]
    public async Task Claim_CrossBranchActor_Forbidden()
    {
        var sessionId = await CreateOwnedCompletedSessionAsync(_ravi, patientAgreed: true);

        var result = await _svc.ClaimSessionForLifecycleAsync(
            _tenant, sessionId, _ravi, CounselingLifecycleClaimIntent.ReEvaluate, 2, _otherBranchCounsellor);

        Assert.False(result.Success);
        Assert.Equal(AssignSessionFailureKind.Forbidden, result.FailureKind);
        var row = await _db.CounselingSession.AsNoTracking().FirstAsync(s => s.Id == sessionId);
        Assert.Equal(_ravi, row.CounselorId);
    }

    [Fact]
    public async Task Claim_AdminActor_Forbidden()
    {
        var sessionId = await CreateOwnedCompletedSessionAsync(_ravi, patientAgreed: true);

        var result = await _svc.ClaimSessionForLifecycleAsync(
            _tenant, sessionId, _ravi, CounselingLifecycleClaimIntent.ReEvaluate, 2, _admin);

        Assert.False(result.Success);
        Assert.Equal(AssignSessionFailureKind.Forbidden, result.FailureKind);
        var row = await _db.CounselingSession.AsNoTracking().FirstAsync(s => s.Id == sessionId);
        Assert.Equal(_ravi, row.CounselorId);
    }

    [Fact]
    public async Task Claim_NullOwner_Succeeds_OwnerBecomesActor()
    {
        var created = await _svc.CreateSessionAsync(new CreateCounselingSessionRequest
        {
            TenantId = _tenant,
            BranchId = _branchA,
            PatientId = _patient,
            ReferredByDoctorId = _doctor,
            PatientType = "Cash",
            SessionType = "Initial",
            SessionDate = DateTime.UtcNow.Date,
            AddToQueue = false,
        }, _admin);
        var sessionId = created.SessionId!.Value;
        var session = await _db.CounselingSession.FirstAsync(s => s.Id == sessionId);
        session.PatientAgreedToSurgery = true;
        _db.CounselorQueue.Add(new CounselorQueueItem
        {
            Id = Guid.NewGuid(),
            TenantId = _tenant,
            BranchId = _branchA,
            SessionId = sessionId,
            PatientId = _patient,
            TokenNumber = "T-null",
            QueueType = "Counseling",
            QueuePosition = 1,
            Status = "Completed",
            AddedToQueueAt = DateTime.UtcNow,
            CreatedAt = DateTime.UtcNow,
        });
        await _db.SaveChangesAsync();

        var result = await _svc.ClaimSessionForLifecycleAsync(
            _tenant, sessionId, null, CounselingLifecycleClaimIntent.ReEvaluate, 2, _amelia);

        Assert.True(result.Success);
        Assert.Equal(_amelia, result.CounselorId);
        var row = await _db.CounselingSession.AsNoTracking().FirstAsync(s => s.Id == sessionId);
        Assert.Equal(_amelia, row.CounselorId);
    }

    [Fact]
    public async Task Claim_Repeat_NullOwner_Succeeds()
    {
        var created = await _svc.CreateSessionAsync(new CreateCounselingSessionRequest
        {
            TenantId = _tenant,
            BranchId = _branchA,
            PatientId = _patient,
            ReferredByDoctorId = _doctor,
            PatientType = "Cash",
            SessionType = "Initial",
            SessionDate = DateTime.UtcNow.Date,
            AddToQueue = false,
        }, _admin);
        var sessionId = created.SessionId!.Value;
        var session = await _db.CounselingSession.FirstAsync(s => s.Id == sessionId);
        session.PatientAgreedToSurgery = false;
        _db.CounselorQueue.Add(new CounselorQueueItem
        {
            Id = Guid.NewGuid(),
            TenantId = _tenant,
            BranchId = _branchA,
            SessionId = sessionId,
            PatientId = _patient,
            TokenNumber = "T-null-rep",
            QueueType = "Counseling",
            QueuePosition = 1,
            Status = "Completed",
            AddedToQueueAt = DateTime.UtcNow,
            CreatedAt = DateTime.UtcNow,
        });
        await _db.SaveChangesAsync();

        var result = await _svc.ClaimSessionForLifecycleAsync(
            _tenant, sessionId, null, CounselingLifecycleClaimIntent.StartRepeat, 1, _amelia);

        Assert.True(result.Success);
        Assert.Equal(_amelia, result.CounselorId);
    }

    [Fact]
    public async Task Claim_WrongIntent_ForDone_Rejected()
    {
        var sessionId = await CreateOwnedCompletedSessionAsync(_ravi, patientAgreed: true);

        var result = await _svc.ClaimSessionForLifecycleAsync(
            _tenant, sessionId, _ravi, CounselingLifecycleClaimIntent.StartRepeat, 2, _amelia);

        Assert.False(result.Success);
        Assert.Equal(AssignSessionFailureKind.BadRequest, result.FailureKind);
    }

    [Fact]
    public async Task Claim_AlreadySelf_IdempotentSuccess()
    {
        var sessionId = await CreateOwnedCompletedSessionAsync(_amelia, patientAgreed: true);

        var result = await _svc.ClaimSessionForLifecycleAsync(
            _tenant, sessionId, _amelia, CounselingLifecycleClaimIntent.ReEvaluate, 2, _amelia);

        Assert.True(result.Success);
        Assert.Equal(_amelia, result.CounselorId);
    }

    [Fact]
    public async Task Assign_StillRejectsAlreadyOwned()
    {
        var sessionId = await CreateOwnedCompletedSessionAsync(_ravi, patientAgreed: true);

        var result = await _svc.AssignSessionAsync(_tenant, sessionId, _amelia, 2, _amelia);

        Assert.False(result.Success);
        Assert.Equal(AssignSessionFailureKind.Conflict, result.FailureKind);
    }

    [Fact]
    public async Task Claim_SurgeryDone_Rejected()
    {
        var sessionId = await CreateOwnedCompletedSessionAsync(_ravi, patientAgreed: true);
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
        });
        await _db.SaveChangesAsync();

        var result = await _svc.ClaimSessionForLifecycleAsync(
            _tenant, sessionId, _ravi, CounselingLifecycleClaimIntent.ReEvaluate, 2, _amelia);

        Assert.False(result.Success);
        Assert.Equal(AssignSessionFailureKind.BadRequest, result.FailureKind);
        var row = await _db.CounselingSession.AsNoTracking().FirstAsync(s => s.Id == sessionId);
        Assert.Equal(_ravi, row.CounselorId);
    }

    [Fact]
    public async Task Claim_CrossTenantActor_Forbidden()
    {
        var sessionId = await CreateOwnedCompletedSessionAsync(_ravi, patientAgreed: true);

        var result = await _svc.ClaimSessionForLifecycleAsync(
            _tenant, sessionId, _ravi, CounselingLifecycleClaimIntent.ReEvaluate, 2, _otherTenantCounsellor);

        Assert.False(result.Success);
        Assert.Equal(AssignSessionFailureKind.Forbidden, result.FailureKind);
        var row = await _db.CounselingSession.AsNoTracking().FirstAsync(s => s.Id == sessionId);
        Assert.Equal(_ravi, row.CounselorId);
    }

    [Fact]
    public async Task Assign_DoneNull_Rejected_UseLifecycleClaim()
    {
        var created = await _svc.CreateSessionAsync(new CreateCounselingSessionRequest
        {
            TenantId = _tenant,
            BranchId = _branchA,
            PatientId = _patient,
            ReferredByDoctorId = _doctor,
            PatientType = "Cash",
            SessionType = "Initial",
            SessionDate = DateTime.UtcNow.Date,
            AddToQueue = false,
        }, _admin);
        var sessionId = created.SessionId!.Value;
        var session = await _db.CounselingSession.FirstAsync(s => s.Id == sessionId);
        session.PatientAgreedToSurgery = true;
        _db.CounselorQueue.Add(new CounselorQueueItem
        {
            Id = Guid.NewGuid(),
            TenantId = _tenant,
            BranchId = _branchA,
            SessionId = sessionId,
            PatientId = _patient,
            TokenNumber = "T-done-null",
            QueueType = "Counseling",
            QueuePosition = 1,
            Status = "Completed",
            AddedToQueueAt = DateTime.UtcNow,
            CreatedAt = DateTime.UtcNow,
        });
        await _db.SaveChangesAsync();

        var result = await _svc.AssignSessionAsync(_tenant, sessionId, _amelia, 2, _amelia);

        Assert.False(result.Success);
        Assert.Equal(AssignSessionFailureKind.BadRequest, result.FailureKind);
        Assert.Contains("Pending", result.Message);
        var row = await _db.CounselingSession.AsNoTracking().FirstAsync(s => s.Id == sessionId);
        Assert.Null(row.CounselorId);
    }

    /// <summary>
    /// Done Re-evaluate / Repeat Start must reopen via StartSession so Waiting List
    /// projects Processing (Completed+agreed must not remain Done after reopen).
    /// </summary>
    [Fact]
    public async Task StartSession_DoneCompleted_ReopensToInProgress_ClearsAgreement_KeepsOwner()
    {
        var sessionId = await CreateOwnedCompletedSessionAsync(_amelia, patientAgreed: true);

        var result = await _svc.StartSessionAsync(_tenant, sessionId, _amelia, 2);

        Assert.True(result.Success);
        var session = await _db.CounselingSession.AsNoTracking().FirstAsync(s => s.Id == sessionId);
        var queue = await _db.CounselorQueue.AsNoTracking().FirstAsync(q => q.SessionId == sessionId);
        Assert.Equal("InProgress", session.Status);
        Assert.Null(session.PatientAgreedToSurgery);
        Assert.False(session.PendingDecision);
        Assert.Equal("InProgress", queue.Status);
        Assert.Equal(_amelia, session.CounselorId);
    }

    [Fact]
    public async Task StartSession_RepeatCompleted_ReopensToInProgress_ClearsAgreement_KeepsOwner()
    {
        var sessionId = await CreateOwnedCompletedSessionAsync(_amelia, patientAgreed: false);

        var result = await _svc.StartSessionAsync(_tenant, sessionId, _amelia, 2, "Followup");

        Assert.True(result.Success);
        var session = await _db.CounselingSession.AsNoTracking().FirstAsync(s => s.Id == sessionId);
        var queue = await _db.CounselorQueue.AsNoTracking().FirstAsync(q => q.SessionId == sessionId);
        Assert.Equal("InProgress", session.Status);
        Assert.Null(session.PatientAgreedToSurgery);
        Assert.Equal("InProgress", queue.Status);
        Assert.Equal(_amelia, session.CounselorId);
        Assert.Equal("Followup", session.SessionType);
    }

    /// <summary>
    /// Pending Start Counseling must move Waiting → InProgress so Waiting List projects Processing.
    /// </summary>
    [Fact]
    public async Task StartSession_PendingWaiting_TransitionsToInProgress_KeepsOwner()
    {
        var sessionId = await CreateOwnedCompletedSessionAsync(_amelia, patientAgreed: false, queueStatus: "Waiting");
        var session = await _db.CounselingSession.FirstAsync(s => s.Id == sessionId);
        session.PatientAgreedToSurgery = null;
        session.Status = "Waiting";
        await _db.SaveChangesAsync();

        var result = await _svc.StartSessionAsync(_tenant, sessionId, _amelia, 3);

        Assert.True(result.Success);
        var row = await _db.CounselingSession.AsNoTracking().FirstAsync(s => s.Id == sessionId);
        var queue = await _db.CounselorQueue.AsNoTracking().FirstAsync(q => q.SessionId == sessionId);
        Assert.Equal("InProgress", row.Status);
        Assert.Equal("InProgress", queue.Status);
        Assert.Equal(_amelia, row.CounselorId);
    }
}
