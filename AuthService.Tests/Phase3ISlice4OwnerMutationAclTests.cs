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
/// Phase 3I Slice 4 — Owner mutation ACL (PD-AUTH-01).
/// CounselorId changes only via Assign/claim; content mutates require current owner.
/// </summary>
public class Phase3ISlice4OwnerMutationAclTests : IDisposable
{
    private readonly AppDbContext _db;
    private readonly CounselingWorkflowService _svc;

    private readonly Guid _tenant = Guid.Parse("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa");
    private readonly Guid _branch = Guid.Parse("11111111-1111-1111-1111-111111111111");
    private readonly Guid _owner = Guid.Parse("c0000001-0000-0000-0000-000000000001");
    private readonly Guid _peer = Guid.Parse("c0000002-0000-0000-0000-000000000002");
    private readonly Guid _admin = Guid.Parse("a0000001-0000-0000-0000-000000000001");
    private readonly Guid _patient = Guid.Parse("f1000001-0000-0000-0000-000000000001");
    private readonly Guid _doctor = Guid.Parse("e1000001-0000-0000-0000-000000000001");

    public Phase3ISlice4OwnerMutationAclTests()
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
        void AddUser(Guid id, string first, string last)
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
            });
        }

        AddUser(_owner, "Amelia", "Owner");
        AddUser(_peer, "Ravi", "Peer");
        AddUser(_admin, "Admin", "User");
        _db.Patients.Add(new Patient
        {
            Id = _patient,
            TenantId = _tenant,
            BranchId = _branch,
            FirstName = "Pat",
            LastName = "Ent",
            MedicalRecordNumber = "MRN-S4",
            DateOfBirth = new DateTime(1990, 1, 1),
            Gender = "Female",
        });
        _db.SaveChanges();
    }

    private async Task<Guid> CreateUnassignedSessionAsync()
    {
        var result = await _svc.CreateSessionAsync(new CreateCounselingSessionRequest
        {
            TenantId = _tenant,
            BranchId = _branch,
            PatientId = _patient,
            ReferredByDoctorId = _doctor,
            PatientType = "Cash",
            SessionType = "Initial",
            SessionDate = DateTime.UtcNow.Date,
            AddToQueue = false,
        }, _admin);
        Assert.True(result.Success);
        return result.SessionId!.Value;
    }

    private async Task<Guid> CreateOwnedSessionAsync(Guid ownerId)
    {
        var id = await CreateUnassignedSessionAsync();
        var row = await _db.CounselingSession.FirstAsync(s => s.Id == id);
        row.CounselorId = ownerId;
        await _db.SaveChangesAsync();
        return id;
    }

    [Fact]
    public async Task Update_WithClientCounselorId_Rejected_OwnershipUnchanged()
    {
        var id = await CreateOwnedSessionAsync(_owner);

        var result = await _svc.UpdateSessionAsync(_tenant, id, new UpdateCounselingSessionRequest
        {
            CounselorId = _peer,
            ClinicalSummary = "tamper",
        }, _owner);

        Assert.False(result.Success);
        Assert.Equal(SessionOperationFailureKind.BadRequest, result.FailureKind);
        var row = await _db.CounselingSession.AsNoTracking().FirstAsync(s => s.Id == id);
        Assert.Equal(_owner, row.CounselorId);
        Assert.Null(row.ClinicalSummary);
    }

    [Fact]
    public async Task Update_Unassigned_Forbidden()
    {
        var id = await CreateUnassignedSessionAsync();

        var result = await _svc.UpdateSessionAsync(_tenant, id, new UpdateCounselingSessionRequest
        {
            ClinicalSummary = "should not save",
        }, _owner);

        Assert.False(result.Success);
        Assert.Equal(SessionOperationFailureKind.Forbidden, result.FailureKind);
        var row = await _db.CounselingSession.AsNoTracking().FirstAsync(s => s.Id == id);
        Assert.Null(row.CounselorId);
        Assert.Null(row.ClinicalSummary);
    }

    [Fact]
    public async Task Update_NonOwner_Forbidden()
    {
        var id = await CreateOwnedSessionAsync(_owner);

        var result = await _svc.UpdateSessionAsync(_tenant, id, new UpdateCounselingSessionRequest
        {
            ClinicalSummary = "peer write",
        }, _peer);

        Assert.False(result.Success);
        Assert.Equal(SessionOperationFailureKind.Forbidden, result.FailureKind);
        var row = await _db.CounselingSession.AsNoTracking().FirstAsync(s => s.Id == id);
        Assert.Null(row.ClinicalSummary);
    }

    [Fact]
    public async Task Update_Owner_Succeeds_CounselorIdUnchanged()
    {
        var id = await CreateOwnedSessionAsync(_owner);
        Assert.True((await _svc.StartSessionAsync(_tenant, id, _owner)).Success);

        var result = await _svc.UpdateSessionAsync(_tenant, id, new UpdateCounselingSessionRequest
        {
            ClinicalSummary = "owner draft",
        }, _owner);

        Assert.True(result.Success);
        var row = await _db.CounselingSession.AsNoTracking().FirstAsync(s => s.Id == id);
        Assert.Equal(_owner, row.CounselorId);
        Assert.Equal("owner draft", row.ClinicalSummary);
    }

    [Fact]
    public async Task Update_AdminNonOwner_Forbidden_NoImplicitBypass()
    {
        var id = await CreateOwnedSessionAsync(_owner);

        var result = await _svc.UpdateSessionAsync(_tenant, id, new UpdateCounselingSessionRequest
        {
            ClinicalSummary = "admin bypass",
        }, _admin);

        Assert.False(result.Success);
        Assert.Equal(SessionOperationFailureKind.Forbidden, result.FailureKind);
        var row = await _db.CounselingSession.AsNoTracking().FirstAsync(s => s.Id == id);
        Assert.Null(row.ClinicalSummary);
    }

    [Fact]
    public async Task Start_Unassigned_Forbidden_DoesNotStampOwner()
    {
        var id = await CreateUnassignedSessionAsync();

        var result = await _svc.StartSessionAsync(_tenant, id, _owner);

        Assert.False(result.Success);
        Assert.Equal(SessionOperationFailureKind.Forbidden, result.FailureKind);
        var row = await _db.CounselingSession.AsNoTracking().FirstAsync(s => s.Id == id);
        Assert.Null(row.CounselorId);
        Assert.NotEqual("InProgress", row.Status);
    }

    [Fact]
    public async Task Start_NonOwner_Forbidden_PreservesOwner()
    {
        var id = await CreateOwnedSessionAsync(_owner);

        var result = await _svc.StartSessionAsync(_tenant, id, _peer);

        Assert.False(result.Success);
        Assert.Equal(SessionOperationFailureKind.Forbidden, result.FailureKind);
        var row = await _db.CounselingSession.AsNoTracking().FirstAsync(s => s.Id == id);
        Assert.Equal(_owner, row.CounselorId);
        Assert.NotEqual("InProgress", row.Status);
    }

    [Fact]
    public async Task Start_Owner_Succeeds_DoesNotChangeCounselorId()
    {
        var id = await CreateOwnedSessionAsync(_owner);

        var result = await _svc.StartSessionAsync(_tenant, id, _owner);

        Assert.True(result.Success);
        var row = await _db.CounselingSession.AsNoTracking().FirstAsync(s => s.Id == id);
        Assert.Equal(_owner, row.CounselorId);
        Assert.Equal("InProgress", row.Status);
    }

    [Fact]
    public async Task Complete_NonOwner_Forbidden()
    {
        var id = await CreateOwnedSessionAsync(_owner);
        var owned = await _db.CounselingSession.FirstAsync(s => s.Id == id);
        owned.Status = "InProgress";
        await _db.SaveChangesAsync();

        var result = await _svc.CompleteSessionAsync(_tenant, id, _peer);

        Assert.False(result.Success);
        Assert.Equal(SessionOperationFailureKind.Forbidden, result.FailureKind);
        var row = await _db.CounselingSession.AsNoTracking().FirstAsync(s => s.Id == id);
        Assert.Equal("InProgress", row.Status);
    }

    [Fact]
    public async Task Complete_Owner_Succeeds()
    {
        var id = await CreateOwnedSessionAsync(_owner);
        var owned = await _db.CounselingSession.FirstAsync(s => s.Id == id);
        owned.Status = "InProgress";
        owned.SessionStartTime = DateTime.UtcNow.AddMinutes(-10);
        await _db.SaveChangesAsync();

        var result = await _svc.CompleteSessionAsync(_tenant, id, _owner);

        Assert.True(result.Success);
        var row = await _db.CounselingSession.AsNoTracking().FirstAsync(s => s.Id == id);
        Assert.Equal("Completed", row.Status);
        Assert.Equal(_owner, row.CounselorId);
    }

    [Fact]
    public async Task Cancel_NonOwner_Forbidden()
    {
        var id = await CreateOwnedSessionAsync(_owner);

        var result = await _svc.CancelSessionAsync(_tenant, id, "test", _peer);

        Assert.False(result.Success);
        Assert.Equal(SessionOperationFailureKind.Forbidden, result.FailureKind);
        var row = await _db.CounselingSession.AsNoTracking().FirstAsync(s => s.Id == id);
        Assert.NotEqual("Cancelled", row.Status);
    }

    [Fact]
    public async Task SaveInvestigations_NonOwner_ThrowsUnauthorized()
    {
        var id = await CreateOwnedSessionAsync(_owner);

        await Assert.ThrowsAsync<UnauthorizedAccessException>(() =>
            _svc.SaveSessionInvestigationsAsync(_tenant, id, _peer, new System.Collections.Generic.List<InvestigationOrderItemDto>()));
    }

    [Fact]
    public async Task StartFromQueue_Unassigned_ThrowsUnauthorized()
    {
        var id = await CreateUnassignedSessionAsync();
        var queueId = Guid.NewGuid();
        _db.CounselorQueue.Add(new CounselorQueueItem
        {
            Id = queueId,
            TenantId = _tenant,
            BranchId = _branch,
            SessionId = id,
            PatientId = _patient,
            TokenNumber = "T-S4",
            QueueType = "Counseling",
            QueuePosition = 1,
            Status = "Called",
            AddedToQueueAt = DateTime.UtcNow,
            CreatedAt = DateTime.UtcNow,
        });
        await _db.SaveChangesAsync();

        await Assert.ThrowsAsync<UnauthorizedAccessException>(() =>
            _svc.StartSessionFromQueueAsync(_tenant, queueId, _owner));

        var row = await _db.CounselingSession.AsNoTracking().FirstAsync(s => s.Id == id);
        Assert.Null(row.CounselorId);
        var q = await _db.CounselorQueue.AsNoTracking().FirstAsync(x => x.Id == queueId);
        Assert.Equal("Called", q.Status);
    }
}
