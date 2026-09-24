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
/// Phase 3I Slice 2 + workflow correction — Admin create leaves CounselorId NULL;
/// counsellor create establishes self as owner. Start/open does not stamp ownership.
/// Explicit Assign remains for unassigned (admin) intake.
/// </summary>
public class Phase3ISlice2OwnershipCreateStartTests : IDisposable
{
    private readonly AppDbContext _db;
    private readonly CounselingWorkflowService _svc;

    private readonly Guid _tenant = Guid.Parse("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa");
    private readonly Guid _branch = Guid.Parse("11111111-1111-1111-1111-111111111111");
    private readonly Guid _admin = Guid.Parse("a0000001-0000-0000-0000-000000000001");
    private readonly Guid _counsellor = Guid.Parse("c0000001-0000-0000-0000-000000000001");
    private readonly Guid _otherCounsellor = Guid.Parse("c0000002-0000-0000-0000-000000000002");
    private readonly Guid _patient = Guid.Parse("f1000001-0000-0000-0000-000000000001");
    private readonly Guid _doctor = Guid.Parse("e1000001-0000-0000-0000-000000000001");

    public Phase3ISlice2OwnershipCreateStartTests()
    {
        _db = TestDbContextFactory.CreateInMemory();
        _svc = CreateWorkflowService(_db);
        Seed();
    }

    public void Dispose() => _db.Dispose();

    private static CounselingWorkflowService CreateWorkflowService(AppDbContext db)
    {
        var logger = new Mock<ILogger<CounselingWorkflowService>>();
        var blob = new Mock<IBlobStorageService>();
        var http = new Mock<System.Net.Http.IHttpClientFactory>();
        var config = new Mock<IConfiguration>();
        config.Setup(c => c["CcmsService:BaseUrl"]).Returns("http://localhost:7075/api");
        config.Setup(c => c["InternalApi:Key"]).Returns(string.Empty);
        var notifier = new Mock<IQueueDisplayNotifier>();
        return new CounselingWorkflowService(
            db, logger.Object, blob.Object, http.Object, config.Object, notifier.Object,
            new FollowupBranchAccessService(db),
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
            BranchId = _branch,
        });
        _db.Users.Add(new AppUser
        {
            Id = _counsellor,
            TenantId = _tenant,
            UserName = "counsellor@test",
            NormalizedUserName = "COUNSELLOR@TEST",
            Email = "counsellor@test",
            NormalizedEmail = "COUNSELLOR@TEST",
            FirstName = "Amelia",
            LastName = "User",
            BranchId = _branch,
            UserType = "Counsellor",
        });
        _db.Users.Add(new AppUser
        {
            Id = _otherCounsellor,
            TenantId = _tenant,
            UserName = "peer@test",
            NormalizedUserName = "PEER@TEST",
            Email = "peer@test",
            NormalizedEmail = "PEER@TEST",
            FirstName = "Peer",
            LastName = "Counsellor",
            BranchId = _branch,
            UserType = "Counsellor",
        });
        _db.Patients.Add(new Patient
        {
            Id = _patient,
            TenantId = _tenant,
            BranchId = _branch,
            FirstName = "Pat",
            LastName = "Ent",
            MedicalRecordNumber = "MRN-S2",
            DateOfBirth = new DateTime(1990, 1, 1),
            Gender = "Female",
        });
        _db.SaveChanges();
    }

    private async Task<int> CurrentVersionAsync(Guid sessionId) =>
        (await _db.CounselingSession.AsNoTracking().FirstAsync(s => s.Id == sessionId)).Version;

    private CreateCounselingSessionRequest BaseCreateRequest(Guid? clientCounselorId = null) => new()
    {
        TenantId = _tenant,
        BranchId = _branch,
        PatientId = _patient,
        ReferredByDoctorId = _doctor,
        PatientType = "Cash",
        SessionType = "Initial",
        SessionDate = DateTime.UtcNow.Date,
        AddToQueue = false,
        CounselorId = clientCounselorId,
    };

    [Fact]
    public async Task Create_AdminActor_CounselorIdNull_CreatedByIsActor()
    {
        var result = await _svc.CreateSessionAsync(BaseCreateRequest(), _admin);

        Assert.True(result.Success);
        var row = await _db.CounselingSession.AsNoTracking().FirstAsync(s => s.Id == result.SessionId);
        Assert.Null(row.CounselorId);
        Assert.Equal(_admin, row.CreatedByUserId);
    }

    [Fact]
    public async Task Create_CounsellorActor_SetsSelfAsOwner()
    {
        var result = await _svc.CreateSessionAsync(BaseCreateRequest(), _counsellor);

        Assert.True(result.Success);
        var row = await _db.CounselingSession.AsNoTracking().FirstAsync(s => s.Id == result.SessionId);
        Assert.Equal(_counsellor, row.CounselorId);
        Assert.Equal(_counsellor, row.CreatedByUserId);
    }

    [Fact]
    public async Task Create_CounsellorActor_ClientSuppliedPeer_Ignored_UsesActor()
    {
        var result = await _svc.CreateSessionAsync(BaseCreateRequest(_otherCounsellor), _counsellor);

        Assert.True(result.Success);
        var row = await _db.CounselingSession.AsNoTracking().FirstAsync(s => s.Id == result.SessionId);
        Assert.Equal(_counsellor, row.CounselorId);
        Assert.NotEqual(_otherCounsellor, row.CounselorId);
    }

    [Fact]
    public async Task Create_ClientSuppliedCounselorId_Ignored_RemainsNull_ForAdmin()
    {
        var result = await _svc.CreateSessionAsync(BaseCreateRequest(_otherCounsellor), _admin);

        Assert.True(result.Success);
        var row = await _db.CounselingSession.AsNoTracking().FirstAsync(s => s.Id == result.SessionId);
        Assert.Null(row.CounselorId);
    }

    [Fact]
    public async Task Start_Unassigned_Forbidden_DoesNotStampCounselorId()
    {
        var created = await _svc.CreateSessionAsync(BaseCreateRequest(), _admin);
        var before = await _db.CounselingSession.AsNoTracking().FirstAsync(s => s.Id == created.SessionId);
        Assert.Null(before.CounselorId);

        var started = await _svc.StartSessionAsync(_tenant, created.SessionId!.Value, _counsellor, await CurrentVersionAsync(created.SessionId!.Value));

        Assert.False(started.Success);
        Assert.Equal(SessionOperationFailureKind.Forbidden, started.FailureKind);
        var row = await _db.CounselingSession.AsNoTracking().FirstAsync(s => s.Id == created.SessionId);
        Assert.Null(row.CounselorId);
        Assert.NotEqual("InProgress", row.Status);
    }

    [Fact]
    public async Task Start_NonOwner_Forbidden_PreservesExistingCounselorId()
    {
        var created = await _svc.CreateSessionAsync(BaseCreateRequest(), _admin);
        var owned = await _db.CounselingSession.FirstAsync(s => s.Id == created.SessionId);
        owned.CounselorId = _otherCounsellor;
        await _db.SaveChangesAsync();

        var started = await _svc.StartSessionAsync(_tenant, created.SessionId!.Value, _counsellor, await CurrentVersionAsync(created.SessionId!.Value));

        Assert.False(started.Success);
        Assert.Equal(SessionOperationFailureKind.Forbidden, started.FailureKind);
        var row = await _db.CounselingSession.AsNoTracking().FirstAsync(s => s.Id == created.SessionId);
        Assert.Equal(_otherCounsellor, row.CounselorId);
        Assert.NotEqual("InProgress", row.Status);
    }

    [Fact]
    public async Task Start_Owner_Succeeds_PreservesCounselorId()
    {
        var created = await _svc.CreateSessionAsync(BaseCreateRequest(), _admin);
        var owned = await _db.CounselingSession.FirstAsync(s => s.Id == created.SessionId);
        owned.CounselorId = _counsellor;
        await _db.SaveChangesAsync();

        var started = await _svc.StartSessionAsync(_tenant, created.SessionId!.Value, _counsellor, await CurrentVersionAsync(created.SessionId!.Value));

        Assert.True(started.Success);
        var row = await _db.CounselingSession.AsNoTracking().FirstAsync(s => s.Id == created.SessionId);
        Assert.Equal(_counsellor, row.CounselorId);
        Assert.Equal("InProgress", row.Status);
    }

    [Fact]
    public async Task StartFromQueue_Unassigned_ThrowsUnauthorized_DoesNotChangeCounselorId()
    {
        var created = await _svc.CreateSessionAsync(BaseCreateRequest(), _admin);
        var sessionId = created.SessionId!.Value;
        var queueId = Guid.NewGuid();
        _db.CounselorQueue.Add(new CounselorQueueItem
        {
            Id = queueId,
            TenantId = _tenant,
            BranchId = _branch,
            SessionId = sessionId,
            PatientId = _patient,
            TokenNumber = "T-S2",
            QueueType = "Counseling",
            QueuePosition = 1,
            Status = "Called",
            AddedToQueueAt = DateTime.UtcNow,
            CreatedAt = DateTime.UtcNow,
        });
        await _db.SaveChangesAsync();

        await Assert.ThrowsAsync<UnauthorizedAccessException>(() =>
            _svc.StartSessionFromQueueAsync(_tenant, queueId, _counsellor));

        var row = await _db.CounselingSession.AsNoTracking().FirstAsync(s => s.Id == sessionId);
        Assert.Null(row.CounselorId);
        var q = await _db.CounselorQueue.AsNoTracking().FirstAsync(x => x.Id == queueId);
        Assert.Equal("Called", q.Status);
    }

    [Fact]
    public async Task Create_DoesNotWriteOwnershipAuditLog()
    {
        var before = await _db.CounselingSessionAuditLog.CountAsync();
        await _svc.CreateSessionAsync(BaseCreateRequest(), _admin);
        var after = await _db.CounselingSessionAuditLog.CountAsync();
        Assert.Equal(before, after);
    }

    [Fact]
    public async Task Start_Owner_DoesNotWriteOwnershipAuditLog()
    {
        var created = await _svc.CreateSessionAsync(BaseCreateRequest(), _admin);
        var owned = await _db.CounselingSession.FirstAsync(s => s.Id == created.SessionId);
        owned.CounselorId = _counsellor;
        await _db.SaveChangesAsync();

        var before = await _db.CounselingSessionAuditLog.CountAsync();
        await _svc.StartSessionAsync(_tenant, created.SessionId!.Value, _counsellor, await CurrentVersionAsync(created.SessionId!.Value));
        var after = await _db.CounselingSessionAuditLog.CountAsync();
        Assert.Equal(before, after);
    }
}
