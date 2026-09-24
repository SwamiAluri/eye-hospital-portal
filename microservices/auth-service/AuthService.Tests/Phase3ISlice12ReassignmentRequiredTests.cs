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
/// Phase 3I Slice 12 — Reassignment Required detection + unavailable ownership targets (PD-S12-*).
/// </summary>
public class Phase3ISlice12ReassignmentRequiredTests : IDisposable
{
    private readonly AppDbContext _db;
    private readonly CounselingWorkflowService _svc;
    private readonly Mock<IAuditService> _audit = new();
    private readonly IFollowupBranchAccessService _branchAccess;

    private readonly Guid _tenant = Guid.Parse("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa");
    private readonly Guid _branchA = Guid.Parse("11111111-1111-1111-1111-111111111111");
    private readonly Guid _branchB = Guid.Parse("22222222-2222-2222-2222-222222222222");
    private readonly Guid _amelia = Guid.Parse("c0000001-0000-0000-0000-000000000001");
    private readonly Guid _ravi = Guid.Parse("c0000002-0000-0000-0000-000000000002");
    private readonly Guid _admin = Guid.Parse("a0000001-0000-0000-0000-000000000001");
    private readonly Guid _patient = Guid.Parse("f1000001-0000-0000-0000-000000000001");
    private readonly Guid _otherBranchCounsellor = Guid.Parse("c0000003-0000-0000-0000-000000000003");

    public Phase3ISlice12ReassignmentRequiredTests()
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
        void AddCounsellor(Guid id, Guid branch, string first, string last, string userStatus = "active")
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
                UserType = "Counsellor",
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

        AddCounsellor(_amelia, _branchA, "Amelia", "Martinez");
        AddCounsellor(_ravi, _branchA, "Ravi", "Kumar");
        AddCounsellor(_otherBranchCounsellor, _branchB, "Other", "Branch");

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
            UserStatus = "active",
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
            MedicalRecordNumber = "MRN-S12",
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
        string sessionStatus = "Scheduled",
        Guid? branchId = null)
    {
        var sessionId = Guid.NewGuid();
        var branch = branchId ?? _branchA;
        _db.CounselingSession.Add(new CounselingSession
        {
            Id = sessionId,
            TenantId = _tenant,
            BranchId = branch,
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
            Version = 1,
        });
        _db.CounselorQueue.Add(new CounselorQueueItem
        {
            Id = Guid.NewGuid(),
            TenantId = _tenant,
            BranchId = branch,
            SessionId = sessionId,
            PatientId = _patient,
            TokenNumber = $"S12-{sessionId.ToString()[..8]}",
            QueueType = "Counseling",
            QueuePosition = 1,
            PriorityScore = 50,
            UrgencyLevel = "Normal",
            Status = sessionStatus == "InProgress" ? "InProgress" : "Waiting",
            AddedToQueueAt = DateTime.UtcNow,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow,
        });
        await _db.SaveChangesAsync();
        return sessionId;
    }

    private SessionFilters ListFilters(bool reassignmentRequired = false) => new()
    {
        TenantId = _tenant,
        AccessibleBranchIds = new[] { _branchA },
        ReassignmentRequired = reassignmentRequired,
        Page = 1,
        PageSize = 50,
    };

    [Fact]
    public async Task RR_Includes_Scheduled_When_Owner_Inactive()
    {
        var sessionId = await SeedOwnedSessionAsync(_amelia, "Scheduled");
        var amelia = await _db.Users.FirstAsync(u => u.Id == _amelia);
        amelia.UserStatus = "inactive";
        await _db.SaveChangesAsync();

        var list = await _svc.GetAllSessionsAsync(ListFilters(reassignmentRequired: true));

        Assert.Contains(list.Sessions, s => s.Id == sessionId);
        Assert.Equal(1, list.TotalCount);
    }

    [Fact]
    public async Task RR_Includes_InProgress_When_Owner_Inactive()
    {
        var sessionId = await SeedOwnedSessionAsync(_amelia, "InProgress");
        var amelia = await _db.Users.FirstAsync(u => u.Id == _amelia);
        amelia.UserStatus = "inactive";
        await _db.SaveChangesAsync();

        var list = await _svc.GetAllSessionsAsync(ListFilters(reassignmentRequired: true));

        Assert.Contains(list.Sessions, s => s.Id == sessionId);
    }

    [Fact]
    public async Task RR_Excludes_Completed_Even_When_Owner_Inactive()
    {
        var sessionId = await SeedOwnedSessionAsync(_amelia, "Completed");
        var amelia = await _db.Users.FirstAsync(u => u.Id == _amelia);
        amelia.UserStatus = "inactive";
        await _db.SaveChangesAsync();

        var list = await _svc.GetAllSessionsAsync(ListFilters(reassignmentRequired: true));

        Assert.DoesNotContain(list.Sessions, s => s.Id == sessionId);
        Assert.Equal(0, list.TotalCount);
    }

    [Fact]
    public async Task RR_Excludes_Null_Owner()
    {
        var sessionId = Guid.NewGuid();
        _db.CounselingSession.Add(new CounselingSession
        {
            Id = sessionId,
            TenantId = _tenant,
            BranchId = _branchA,
            PatientId = _patient,
            CounselorId = null,
            SessionType = "Initial",
            SessionDate = DateTime.UtcNow.Date,
            PatientType = "Cash",
            Status = "Scheduled",
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow,
            Version = 1,
        });
        await _db.SaveChangesAsync();

        var list = await _svc.GetAllSessionsAsync(ListFilters(reassignmentRequired: true));

        Assert.DoesNotContain(list.Sessions, s => s.Id == sessionId);
    }

    [Fact]
    public async Task RR_Excludes_Active_Owner_Open_Session()
    {
        var sessionId = await SeedOwnedSessionAsync(_amelia, "Scheduled");

        var list = await _svc.GetAllSessionsAsync(ListFilters(reassignmentRequired: true));

        Assert.DoesNotContain(list.Sessions, s => s.Id == sessionId);
    }

    [Fact]
    public async Task RR_Includes_When_Owner_SoftDeleted()
    {
        var sessionId = await SeedOwnedSessionAsync(_amelia, "Scheduled");
        var amelia = await _db.Users.FirstAsync(u => u.Id == _amelia);
        amelia.DeletedAt = DateTime.UtcNow;
        await _db.SaveChangesAsync();

        var list = await _svc.GetAllSessionsAsync(ListFilters(reassignmentRequired: true));

        Assert.Contains(list.Sessions, s => s.Id == sessionId);
    }

    [Fact]
    public async Task RR_Includes_When_Owner_Loses_Counsellor_Eligibility()
    {
        var sessionId = await SeedOwnedSessionAsync(_amelia, "InProgress");
        var amelia = await _db.Users.FirstAsync(u => u.Id == _amelia);
        amelia.UserType = "Nurse";
        amelia.Designation = "Staff Nurse";
        await _db.SaveChangesAsync();

        var list = await _svc.GetAllSessionsAsync(ListFilters(reassignmentRequired: true));

        Assert.Contains(list.Sessions, s => s.Id == sessionId);
    }

    [Fact]
    public async Task RR_Includes_When_Owner_Loses_Branch_Authorization()
    {
        var sessionId = await SeedOwnedSessionAsync(_amelia, "Scheduled", _branchA);
        var amelia = await _db.Users.FirstAsync(u => u.Id == _amelia);
        amelia.BranchId = _branchB;
        var ub = await _db.UserBranches.FirstAsync(x => x.UserId == _amelia && x.BranchId == _branchA);
        ub.Status = "inactive";
        ub.EffectiveUntil = DateTime.UtcNow.AddMinutes(-1);
        await _db.SaveChangesAsync();

        var list = await _svc.GetAllSessionsAsync(ListFilters(reassignmentRequired: true));

        Assert.Contains(list.Sessions, s => s.Id == sessionId);
    }

    [Fact]
    public async Task RR_Respects_AccessibleBranchIds_Empty()
    {
        await SeedOwnedSessionAsync(_amelia, "Scheduled");
        var amelia = await _db.Users.FirstAsync(u => u.Id == _amelia);
        amelia.UserStatus = "inactive";
        await _db.SaveChangesAsync();

        var list = await _svc.GetAllSessionsAsync(new SessionFilters
        {
            TenantId = _tenant,
            AccessibleBranchIds = Array.Empty<Guid>(),
            ReassignmentRequired = true,
            Page = 1,
            PageSize = 50,
        });

        Assert.Empty(list.Sessions);
        Assert.Equal(0, list.TotalCount);
    }

    [Fact]
    public async Task Assign_Rejects_Inactive_Target()
    {
        var sessionId = Guid.NewGuid();
        _db.CounselingSession.Add(new CounselingSession
        {
            Id = sessionId,
            TenantId = _tenant,
            BranchId = _branchA,
            PatientId = _patient,
            CounselorId = null,
            SessionType = "Initial",
            SessionDate = DateTime.UtcNow.Date,
            PatientType = "Cash",
            Status = "Scheduled",
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow,
            Version = 1,
        });
        _db.CounselorQueue.Add(new CounselorQueueItem
        {
            Id = Guid.NewGuid(),
            TenantId = _tenant,
            BranchId = _branchA,
            SessionId = sessionId,
            PatientId = _patient,
            TokenNumber = "S12-UNASSIGNED",
            QueueType = "Counseling",
            QueuePosition = 1,
            PriorityScore = 50,
            UrgencyLevel = "Normal",
            Status = "Waiting",
            AddedToQueueAt = DateTime.UtcNow,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow,
        });
        var ravi = await _db.Users.FirstAsync(u => u.Id == _ravi);
        ravi.UserStatus = "inactive";
        await _db.SaveChangesAsync();

        var result = await _svc.AssignSessionAsync(_tenant, sessionId, _ravi, 1, _amelia);

        Assert.False(result.Success);
        Assert.Equal(AssignSessionFailureKind.BadRequest, result.FailureKind);
        Assert.Contains("unavailable", result.Message, StringComparison.OrdinalIgnoreCase);
    }

    [Fact]
    public async Task Reassign_Rejects_Inactive_Target()
    {
        var sessionId = await SeedOwnedSessionAsync(_amelia, "Scheduled");
        var ravi = await _db.Users.FirstAsync(u => u.Id == _ravi);
        ravi.UserStatus = "inactive";
        await _db.SaveChangesAsync();

        var result = await _svc.ReassignSessionAsync(
            _tenant, sessionId, _ravi, _amelia, "Coverage", 1, _admin);

        Assert.False(result.Success);
        Assert.Equal(AssignSessionFailureKind.BadRequest, result.FailureKind);
        Assert.Contains("unavailable", result.Message, StringComparison.OrdinalIgnoreCase);
    }

    [Fact]
    public async Task Deactivate_Does_Not_Clear_CounselorId()
    {
        var sessionId = await SeedOwnedSessionAsync(_amelia, "InProgress");
        var amelia = await _db.Users.FirstAsync(u => u.Id == _amelia);
        amelia.UserStatus = "inactive";
        await _db.SaveChangesAsync();

        var row = await _db.CounselingSession.AsNoTracking().FirstAsync(s => s.Id == sessionId);
        Assert.Equal(_amelia, row.CounselorId);
    }

    [Fact]
    public void UserStatus_Inactive_Is_Detected()
    {
        Assert.True(CounsellorOwnershipAvailability.IsUnavailableUserStatus("inactive"));
        Assert.True(CounsellorOwnershipAvailability.IsUnavailableUserStatus("Inactive"));
        Assert.True(CounsellorOwnershipAvailability.IsUnavailableUserStatus("suspended"));
        Assert.False(CounsellorOwnershipAvailability.IsUnavailableUserStatus("active"));
        Assert.False(CounsellorOwnershipAvailability.IsUnavailableUserStatus("Active"));
    }

    [Fact]
    public void OperationalOpen_Statuses_Are_Scheduled_And_InProgress()
    {
        Assert.Contains("Scheduled", CounsellorOwnershipAvailability.OperationalOpenSessionStatuses);
        Assert.Contains("InProgress", CounsellorOwnershipAvailability.OperationalOpenSessionStatuses);
        Assert.DoesNotContain("Completed", CounsellorOwnershipAvailability.OperationalOpenSessionStatuses);
        Assert.DoesNotContain("Cancelled", CounsellorOwnershipAvailability.OperationalOpenSessionStatuses);
        Assert.DoesNotContain("NoShow", CounsellorOwnershipAvailability.OperationalOpenSessionStatuses);
    }
}
