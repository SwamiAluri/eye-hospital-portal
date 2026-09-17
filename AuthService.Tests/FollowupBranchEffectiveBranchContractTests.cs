using System;
using System.Threading.Tasks;
using AuthService.Context;
using AuthService.Models.Domain;
using AuthService.Models.Identity;
using AuthService.Services;
using Xunit;

namespace AuthService.Tests;

/// <summary>Phase 2Z Counsellor UAT — ResolveEffectiveBranchAsync behaviour.</summary>
public class FollowupBranchEffectiveBranchContractTests : IDisposable
{
    private readonly Guid _tenant = Guid.Parse("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa");
    private readonly Guid _branchA = Guid.Parse("11111111-1111-1111-1111-111111111111");
    private readonly Guid _branchB = Guid.Parse("22222222-2222-2222-2222-222222222222");
    private readonly Guid _branchUnauthorized = Guid.Parse("33333333-3333-3333-3333-333333333333");
    private readonly Guid _userSingle = Guid.Parse("c0000001-0000-0000-0000-000000000001");
    private readonly Guid _userMulti = Guid.Parse("c0000002-0000-0000-0000-000000000002");
    private readonly Guid _userPrimaryOnly = Guid.Parse("c0000003-0000-0000-0000-000000000003");

    private readonly AppDbContext _db;
    private readonly FollowupBranchAccessService _sut;

    public FollowupBranchEffectiveBranchContractTests()
    {
        _db = TestDbContextFactory.CreateInMemory();
        _sut = new FollowupBranchAccessService(_db);
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
            Email = "single@test",
            BranchId = _branchA,
        });
        _db.Users.Add(new AppUser
        {
            Id = _userMulti,
            TenantId = _tenant,
            UserName = "multi@test",
            Email = "multi@test",
            BranchId = _branchA,
        });
        _db.Users.Add(new AppUser
        {
            Id = _userPrimaryOnly,
            TenantId = _tenant,
            UserName = "primary@test",
            Email = "primary@test",
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
        _db.SaveChanges();
    }

    [Fact]
    public void Interface_exposes_ResolveEffectiveBranchAsync()
    {
        var method = typeof(IFollowupBranchAccessService).GetMethod(
            nameof(IFollowupBranchAccessService.ResolveEffectiveBranchAsync));
        Assert.NotNull(method);
        Assert.Equal(typeof(Task<Guid>), method!.ReturnType);
    }

    [Fact]
    public async Task SingleAuthorizedBranch_OmitsBranchId_ResolvesThatBranch()
    {
        var effective = await _sut.ResolveEffectiveBranchAsync(_tenant, _userSingle, null);
        Assert.Equal(_branchA, effective);
    }

    [Fact]
    public async Task PrimaryBranchOnly_NoUserBranchRow_StillResolves()
    {
        var effective = await _sut.ResolveEffectiveBranchAsync(_tenant, _userPrimaryOnly, null);
        Assert.Equal(_branchA, effective);
    }

    [Fact]
    public async Task ExplicitAuthorizedBranch_Works()
    {
        var effective = await _sut.ResolveEffectiveBranchAsync(_tenant, _userMulti, _branchB);
        Assert.Equal(_branchB, effective);
    }

    [Fact]
    public async Task ExplicitUnauthorizedBranch_Throws403Shape()
    {
        await Assert.ThrowsAsync<UnauthorizedAccessException>(() =>
            _sut.ResolveEffectiveBranchAsync(_tenant, _userSingle, _branchUnauthorized));
    }

    [Fact]
    public async Task MultiBranch_OmittedBranchId_RequiresSelection()
    {
        await Assert.ThrowsAsync<InvalidOperationException>(() =>
            _sut.ResolveEffectiveBranchAsync(_tenant, _userMulti, null));
    }
}
