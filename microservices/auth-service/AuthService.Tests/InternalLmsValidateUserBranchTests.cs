using AuthService.Context;
using AuthService.Controllers;
using AuthService.Models.Domain;
using AuthService.Models.Identity;
using AuthService.Services;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging.Abstractions;
using Moq;
using Xunit;

namespace AuthService.Tests;

/// <summary>L-COL-01C — internal validate-user-branch via FollowupBranchAccessService.</summary>
public class InternalLmsValidateUserBranchTests
{
    private const string Key = "hp-internal-svc-key-change-in-production-2026";
    private static readonly Guid Tenant = Guid.Parse("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa");
    private static readonly Guid BranchA = Guid.Parse("11111111-1111-1111-1111-111111111111");
    private static readonly Guid BranchB = Guid.Parse("22222222-2222-2222-2222-222222222222");

    private static (InternalLmsReferenceController Ctl, AppDbContext Db) Create()
    {
        var db = new AppDbContext(
            new DbContextOptionsBuilder<AppDbContext>()
                .UseInMemoryDatabase(Guid.NewGuid().ToString("N"))
                .Options,
            new HttpContextAccessor());

        var config = new ConfigurationBuilder()
            .AddInMemoryCollection(new Dictionary<string, string?>
            {
                ["InternalApi:Key"] = Key,
            })
            .Build();

        var ctl = new InternalLmsReferenceController(
            db,
            config,
            new Mock<IPermissionService>().Object,
            new FollowupBranchAccessService(db),
            NullLogger<InternalLmsReferenceController>.Instance)
        {
            ControllerContext = new ControllerContext
            {
                HttpContext = new DefaultHttpContext(),
            },
        };
        ctl.ControllerContext.HttpContext.Request.Headers["X-Internal-Key"] = Key;
        ctl.ControllerContext.HttpContext.Request.Headers["X-Tenant-ID"] = Tenant.ToString("D");
        return (ctl, db);
    }

    private static async Task<AppUser> SeedUserWithBranchAsync(
        AppDbContext db, Guid userId, Guid authorizedBranchId)
    {
        var u = new AppUser
        {
            Id = userId,
            TenantId = Tenant,
            UserName = userId.ToString("N"),
            NormalizedUserName = userId.ToString("N").ToUpperInvariant(),
            Email = $"{userId:N}@test.local",
            NormalizedEmail = $"{userId:N}@TEST.LOCAL",
            FirstName = "Collector",
            LastName = "User",
            UserStatus = "active",
            SecurityStamp = Guid.NewGuid().ToString("N"),
        };
        db.Users.Add(u);
        db.UserBranches.Add(new UserBranch
        {
            TenantId = Tenant,
            UserId = userId,
            BranchId = authorizedBranchId,
            Status = "active",
            EffectiveFrom = DateTime.UtcNow.AddDays(-1),
            IsDefault = true,
        });
        await db.SaveChangesAsync();
        return u;
    }

    [Fact]
    public async Task ValidateUserBranch_Allows_Authorized_Branch()
    {
        var (ctl, db) = Create();
        var userId = Guid.Parse("bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb");
        await SeedUserWithBranchAsync(db, userId, BranchA);

        var result = await ctl.ValidateUserBranch(
            new InternalLmsReferenceController.UserBranchValidateRequest(userId, BranchA),
            CancellationToken.None);

        var ok = Assert.IsType<OkObjectResult>(result);
        var body = Assert.IsType<InternalLmsReferenceController.UserBranchValidateResponse>(ok.Value);
        Assert.True(body.Authorized);
        Assert.Equal(BranchA, body.BranchId);
    }

    [Fact]
    public async Task ValidateUserBranch_Rejects_Unauthorized_Branch()
    {
        var (ctl, db) = Create();
        var userId = Guid.Parse("cccccccc-cccc-cccc-cccc-cccccccccccc");
        await SeedUserWithBranchAsync(db, userId, BranchB);

        var result = await ctl.ValidateUserBranch(
            new InternalLmsReferenceController.UserBranchValidateRequest(userId, BranchA),
            CancellationToken.None);

        var forbid = Assert.IsType<ObjectResult>(result);
        Assert.Equal(StatusCodes.Status403Forbidden, forbid.StatusCode);
    }
}
