using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using AuthService.Context;
using AuthService.Models.Domain;
using AuthService.Models.Identity;
using AuthService.Services;
using Xunit;

namespace AuthService.Tests;

/// <summary>
/// Phase 3I Slice 1 — Waiting List PD16 server branch authorization + soft-delete.
/// Waiting List remains a shared operational queue (no CounselorId personalization).
/// </summary>
public class WaitingListBranchAuthTests : IDisposable
{
    private readonly AppDbContext _db;
    private readonly FollowupBranchAccessService _branchAccess;

    private readonly Guid _tenant = Guid.Parse("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa");
    private readonly Guid _otherTenant = Guid.Parse("bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb");
    private readonly Guid _branchA = Guid.Parse("11111111-1111-1111-1111-111111111111");
    private readonly Guid _branchB = Guid.Parse("22222222-2222-2222-2222-222222222222");
    private readonly Guid _branchUnauthorized = Guid.Parse("33333333-3333-3333-3333-333333333333");
    private readonly Guid _userSingle = Guid.Parse("c0000001-0000-0000-0000-000000000001");
    private readonly Guid _userMulti = Guid.Parse("c0000002-0000-0000-0000-000000000002");
    private readonly Guid _otherCounsellor = Guid.Parse("44444444-4444-4444-4444-444444444444");
    private readonly Guid _creator = Guid.Parse("55555555-5555-5555-5555-555555555555");
    private readonly Guid _patient = Guid.Parse("a1000001-0000-0000-0000-000000000001");
    private readonly Guid _sessionA = Guid.Parse("b1000001-0000-0000-0000-000000000001");
    private readonly Guid _sessionB = Guid.Parse("b1000002-0000-0000-0000-000000000002");
    private readonly Guid _sessionOtherTenant = Guid.Parse("b1000003-0000-0000-0000-000000000003");
    private readonly Guid _sessionSoftDeleted = Guid.Parse("b1000004-0000-0000-0000-000000000004");
    private readonly Guid _sessionUnassigned = Guid.Parse("b1000005-0000-0000-0000-000000000005");
    private readonly Guid _sessionOtherOwner = Guid.Parse("b1000006-0000-0000-0000-000000000006");
    private readonly Guid _sessionCreatedByOther = Guid.Parse("b1000007-0000-0000-0000-000000000007");
    private readonly Guid _queueSoftDeleted = Guid.Parse("b1000008-0000-0000-0000-000000000008");

    public WaitingListBranchAuthTests()
    {
        _db = TestDbContextFactory.CreateInMemory();
        _branchAccess = new FollowupBranchAccessService(_db);
        Seed();
    }

    public void Dispose() => _db.Dispose();

    private void Seed()
    {
        _db.Users.Add(new AppUser
        {
            Id = _userSingle,
            TenantId = _tenant,
            UserName = "single@test",
            NormalizedUserName = "SINGLE@TEST",
            Email = "single@test",
            NormalizedEmail = "SINGLE@TEST",
            FirstName = "Single",
            LastName = "User",
            BranchId = _branchA,
        });
        _db.Users.Add(new AppUser
        {
            Id = _userMulti,
            TenantId = _tenant,
            UserName = "multi@test",
            NormalizedUserName = "MULTI@TEST",
            Email = "multi@test",
            NormalizedEmail = "MULTI@TEST",
            FirstName = "Multi",
            LastName = "User",
            BranchId = _branchA,
        });
        _db.UserBranches.Add(new UserBranch
        {
            Id = Guid.NewGuid(),
            TenantId = _tenant,
            UserId = _userSingle,
            BranchId = _branchA,
            Status = "active",
            EffectiveFrom = DateTime.UtcNow.AddDays(-30),
        });
        _db.UserBranches.Add(new UserBranch
        {
            Id = Guid.NewGuid(),
            TenantId = _tenant,
            UserId = _userMulti,
            BranchId = _branchA,
            Status = "active",
            EffectiveFrom = DateTime.UtcNow.AddDays(-30),
        });
        _db.UserBranches.Add(new UserBranch
        {
            Id = Guid.NewGuid(),
            TenantId = _tenant,
            UserId = _userMulti,
            BranchId = _branchB,
            Status = "active",
            EffectiveFrom = DateTime.UtcNow.AddDays(-30),
        });

        _db.Patients.Add(new Patient
        {
            Id = _patient,
            TenantId = _tenant,
            FirstName = "Test",
            LastName = "Patient",
            MedicalRecordNumber = "MRN-WL",
            DateOfBirth = new DateTime(1980, 1, 1),
            Gender = "Female",
        });

        AddQueueSession(_sessionA, _tenant, _branchA, counselorId: _userSingle, createdBy: _userSingle);
        AddQueueSession(_sessionB, _tenant, _branchB, counselorId: _userMulti, createdBy: _userMulti);
        AddQueueSession(_sessionOtherTenant, _otherTenant, _branchA, counselorId: _userSingle, createdBy: _userSingle);
        AddQueueSession(_sessionSoftDeleted, _tenant, _branchA, counselorId: _userSingle, createdBy: _userSingle,
            sessionDeletedAt: DateTime.UtcNow);
        AddQueueSession(_sessionUnassigned, _tenant, _branchA, counselorId: null, createdBy: _creator);
        AddQueueSession(_sessionOtherOwner, _tenant, _branchA, counselorId: _otherCounsellor, createdBy: _creator);
        AddQueueSession(_sessionCreatedByOther, _tenant, _branchA, counselorId: _userSingle, createdBy: _creator);
        AddQueueSession(_queueSoftDeleted, _tenant, _branchA, counselorId: _userSingle, createdBy: _userSingle,
            queueDeletedAt: DateTime.UtcNow);

        _db.SaveChanges();
    }

    private void AddQueueSession(
        Guid sessionId,
        Guid tenantId,
        Guid branchId,
        Guid? counselorId,
        Guid? createdBy,
        DateTime? sessionDeletedAt = null,
        DateTime? queueDeletedAt = null)
    {
        _db.CounselingSession.Add(new CounselingSession
        {
            Id = sessionId,
            TenantId = tenantId,
            BranchId = branchId,
            PatientId = _patient,
            CounselorId = counselorId,
            CreatedByUserId = createdBy,
            ReferredByDoctorId = Guid.NewGuid(),
            SessionDate = DateTime.UtcNow.Date,
            PatientType = "Cash",
            SessionType = "Initial",
            CreatedAt = DateTime.UtcNow,
            DeletedAt = sessionDeletedAt,
        });
        _db.CounselorQueue.Add(new CounselorQueueItem
        {
            Id = Guid.NewGuid(),
            TenantId = tenantId,
            BranchId = branchId,
            SessionId = sessionId,
            PatientId = _patient,
            TokenNumber = $"T-{sessionId.ToString()[..8]}",
            QueueType = "Counseling",
            QueuePosition = 1,
            Status = "Waiting",
            AddedToQueueAt = DateTime.UtcNow,
            CreatedAt = DateTime.UtcNow,
            DeletedAt = queueDeletedAt,
        });
    }

    private async Task<List<Guid>> QueryVisibleAsync(Guid userId, Guid? requestedBranchId)
    {
        var authorized = await _branchAccess.ResolveAccessibleBranchesAsync(_tenant, userId, requestedBranchId);
        return await WaitingListPopulationScope.QueryVisibleSessionIdsAsync(_db, _tenant, authorized);
    }

    [Fact]
    public async Task A_AuthorizedBranch_ReturnsOnlyThatBranch()
    {
        var ids = await QueryVisibleAsync(_userMulti, _branchA);

        Assert.Contains(_sessionA, ids);
        Assert.DoesNotContain(_sessionB, ids);
    }

    [Fact]
    public async Task B_UnauthorizedBranch_Throws()
    {
        await Assert.ThrowsAsync<UnauthorizedAccessException>(() =>
            _branchAccess.ResolveAccessibleBranchesAsync(_tenant, _userSingle, _branchUnauthorized));
        await Assert.ThrowsAsync<UnauthorizedAccessException>(() =>
            _branchAccess.ResolveAccessibleBranchesAsync(_tenant, _userSingle, _branchB));
    }

    [Fact]
    public async Task C_OmittedBranchId_SingleBranchUser_OnlyAuthorized_NotTenantWide()
    {
        var ids = await QueryVisibleAsync(_userSingle, null);

        Assert.Contains(_sessionA, ids);
        Assert.DoesNotContain(_sessionB, ids);
        Assert.DoesNotContain(_sessionOtherTenant, ids);
    }

    [Fact]
    public async Task D_MultiBranch_OmittedBranchId_ReturnsAllAuthorizedOnly()
    {
        var ids = await QueryVisibleAsync(_userMulti, null);

        Assert.Contains(_sessionA, ids);
        Assert.Contains(_sessionB, ids);
        Assert.DoesNotContain(_sessionOtherTenant, ids);
    }

    [Fact]
    public async Task E_ClientBranchTampering_UnauthorizedDenied()
    {
        await Assert.ThrowsAsync<UnauthorizedAccessException>(() =>
            _branchAccess.ResolveAccessibleBranchesAsync(_tenant, _userSingle, _branchB));
    }

    [Fact]
    public async Task F_OtherCounsellorOwned_StillVisible_SharedQueue()
    {
        var ids = await QueryVisibleAsync(_userSingle, _branchA);

        Assert.Contains(_sessionOtherOwner, ids);
    }

    [Fact]
    public async Task G_Unassigned_CounselorIdNull_StillVisible()
    {
        var ids = await QueryVisibleAsync(_userSingle, _branchA);

        Assert.Contains(_sessionUnassigned, ids);
    }

    [Fact]
    public async Task H_CreatedByUserId_NotOwnership_StillVisible()
    {
        var ids = await QueryVisibleAsync(_userSingle, _branchA);

        Assert.Contains(_sessionCreatedByOther, ids);
    }

    [Fact]
    public async Task I_SoftDeletedSession_NotReturned()
    {
        var ids = await QueryVisibleAsync(_userSingle, _branchA);

        Assert.DoesNotContain(_sessionSoftDeleted, ids);
    }

    [Fact]
    public async Task J_SoftDeletedQueueItem_NotReturned()
    {
        var ids = await QueryVisibleAsync(_userSingle, _branchA);

        Assert.DoesNotContain(_queueSoftDeleted, ids);
    }

    [Fact]
    public async Task K_CrossTenant_NeverReturned()
    {
        var ids = await QueryVisibleAsync(_userMulti, null);

        Assert.DoesNotContain(_sessionOtherTenant, ids);
    }

    [Fact]
    public async Task EmptyAuthorizedBranches_ReturnsEmpty_NotTenantWide()
    {
        var ids = await WaitingListPopulationScope.QueryVisibleSessionIdsAsync(
            _db, _tenant, Array.Empty<Guid>());

        Assert.Empty(ids);
    }
}
