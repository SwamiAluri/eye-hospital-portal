using System;
using System.Threading.Tasks;
using AuthService.Context;
using AuthService.Models.Domain;
using AuthService.Models.Identity;
using AuthService.Services;
using Microsoft.AspNetCore.Http;
using Microsoft.EntityFrameworkCore;
using Xunit;

namespace AuthService.Tests;

/// <summary>
/// Branch authorization used by GET /Counseling/theaters (and follow-up).
/// Client branchId must not expand access; unauthorized branch = 403 semantics.
/// </summary>
public class FollowupBranchAccessServiceTheatersTests
{
    private static readonly Guid Tenant = Guid.Parse("155fe198-6ae5-4a01-9254-ead5b427247e");
    private static readonly Guid Downtown = Guid.Parse("74c014cf-9570-4824-bdf9-b369ea11a8f4");
    private static readonly Guid OtherBranch = Guid.Parse("aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee");
    private static readonly Guid Amelia = Guid.Parse("48a94c56-ccb2-49c0-9916-bee2703b0251");

    [Fact]
    public async Task ResolveAccessibleBranches_omitted_request_returns_authorized_downtown()
    {
        await using var db = CreateDb();
        SeedAmeliaDowntown(db);
        var svc = new FollowupBranchAccessService(db);

        var branches = await svc.ResolveAccessibleBranchesAsync(Tenant, Amelia, requestedBranchId: null);

        Assert.Contains(Downtown, branches);
        Assert.DoesNotContain(OtherBranch, branches);
    }

    [Fact]
    public async Task ResolveAccessibleBranches_unauthorized_branch_throws()
    {
        await using var db = CreateDb();
        SeedAmeliaDowntown(db);
        var svc = new FollowupBranchAccessService(db);

        await Assert.ThrowsAsync<UnauthorizedAccessException>(() =>
            svc.ResolveAccessibleBranchesAsync(Tenant, Amelia, OtherBranch));
    }

    [Fact]
    public async Task ResolveAccessibleBranches_authorized_downtown_narrows_to_downtown()
    {
        await using var db = CreateDb();
        SeedAmeliaDowntown(db);
        var svc = new FollowupBranchAccessService(db);

        var branches = await svc.ResolveAccessibleBranchesAsync(Tenant, Amelia, Downtown);

        Assert.Equal(new[] { Downtown }, branches);
    }

    private static void SeedAmeliaDowntown(AppDbContext db)
    {
        db.Users.Add(new AppUser
        {
            Id = Amelia,
            TenantId = Tenant,
            BranchId = Downtown,
            UserName = "counsellor4@hospital.com",
            Email = "counsellor4@hospital.com",
            NormalizedEmail = "COUNSELLOR4@HOSPITAL.COM",
            NormalizedUserName = "COUNSELLOR4@HOSPITAL.COM",
        });
        db.UserBranches.Add(new UserBranch
        {
            Id = Guid.NewGuid(),
            TenantId = Tenant,
            UserId = Amelia,
            BranchId = Downtown,
            Status = "active",
            EffectiveFrom = DateTime.UtcNow.AddDays(-1),
            IsDefault = true,
        });
        db.SaveChanges();
    }

    private static AppDbContext CreateDb()
    {
        var options = new DbContextOptionsBuilder<AppDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString("N"))
            .Options;
        return new AppDbContext(options, new HttpContextAccessor());
    }
}
