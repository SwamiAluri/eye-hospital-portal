using AuthService.Context;
using AuthService.Controllers;
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

/// <summary>
/// PD-COL-OWN-05 — optional RequiredPermission on internal validate-user.
/// </summary>
public class InternalLmsValidateUserPermissionTests
{
    private const string Key = "hp-internal-svc-key-change-in-production-2026";
    private static readonly Guid Tenant = Guid.Parse("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa");

    private static (InternalLmsReferenceController Ctl, AppDbContext Db, Mock<IPermissionService> Perms) Create()
    {
        var db = new AppDbContext(
            new DbContextOptionsBuilder<AppDbContext>()
                .UseInMemoryDatabase(Guid.NewGuid().ToString("N"))
                .Options,
            new HttpContextAccessor());

        var perms = new Mock<IPermissionService>();
        var config = new ConfigurationBuilder()
            .AddInMemoryCollection(new Dictionary<string, string?>
            {
                ["InternalApi:Key"] = Key,
            })
            .Build();

        var branchAccess = new FollowupBranchAccessService(db);
        var ctl = new InternalLmsReferenceController(
            db, config, perms.Object, branchAccess, NullLogger<InternalLmsReferenceController>.Instance)
        {
            ControllerContext = new ControllerContext
            {
                HttpContext = new DefaultHttpContext(),
            },
        };
        ctl.ControllerContext.HttpContext.Request.Headers["X-Internal-Key"] = Key;
        ctl.ControllerContext.HttpContext.Request.Headers["X-Tenant-ID"] = Tenant.ToString("D");
        return (ctl, db, perms);
    }

    private static async Task<AppUser> SeedUserAsync(
        AppDbContext db, Guid id, string status = "active", DateTime? deletedAt = null)
    {
        var u = new AppUser
        {
            Id = id,
            TenantId = Tenant,
            UserName = id.ToString("N"),
            NormalizedUserName = id.ToString("N").ToUpperInvariant(),
            Email = $"{id:N}@test.local",
            NormalizedEmail = $"{id:N}@TEST.LOCAL",
            FirstName = "Test",
            LastName = "User",
            UserStatus = status,
            DeletedAt = deletedAt,
            SecurityStamp = Guid.NewGuid().ToString("N"),
        };
        db.Users.Add(u);
        await db.SaveChangesAsync();
        return u;
    }

    [Fact]
    public async Task ValidateUser_Without_RequiredPermission_Allows_Active_User()
    {
        var (ctl, db, perms) = Create();
        var id = Guid.Parse("bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb");
        await SeedUserAsync(db, id);

        var result = await ctl.ValidateUser(
            new InternalLmsReferenceController.UserValidateRequest(id), CancellationToken.None);

        Assert.IsType<OkObjectResult>(result);
        perms.Verify(p => p.HasPermissionAsync(It.IsAny<Guid>(), It.IsAny<string>(), It.IsAny<Guid>()), Times.Never);
    }

    [Fact]
    public async Task ValidateUser_With_Collect_Permission_Allows_When_HasPermission()
    {
        var (ctl, db, perms) = Create();
        var id = Guid.Parse("cccccccc-cccc-cccc-cccc-cccccccccccc");
        await SeedUserAsync(db, id);
        perms.Setup(p => p.HasPermissionAsync(id, "lms.collection.collect", Tenant)).ReturnsAsync(true);

        var result = await ctl.ValidateUser(
            new InternalLmsReferenceController.UserValidateRequest(id, "lms.collection.collect"),
            CancellationToken.None);

        Assert.IsType<OkObjectResult>(result);
    }

    [Fact]
    public async Task ValidateUser_With_Collect_Permission_Rejects_When_Lacking()
    {
        var (ctl, db, perms) = Create();
        var id = Guid.Parse("dddddddd-dddd-dddd-dddd-dddddddddddd");
        await SeedUserAsync(db, id);
        perms.Setup(p => p.HasPermissionAsync(id, "lms.collection.collect", Tenant)).ReturnsAsync(false);

        var result = await ctl.ValidateUser(
            new InternalLmsReferenceController.UserValidateRequest(id, "lms.collection.collect"),
            CancellationToken.None);

        var bad = Assert.IsType<BadRequestObjectResult>(result);
        Assert.Contains("user_lacks_permission", bad.Value!.ToString()!, StringComparison.Ordinal);
    }

    [Fact]
    public async Task ValidateUser_Rejects_Inactive_Before_Permission_Check()
    {
        var (ctl, db, perms) = Create();
        var id = Guid.Parse("eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee");
        await SeedUserAsync(db, id, status: "inactive");

        var result = await ctl.ValidateUser(
            new InternalLmsReferenceController.UserValidateRequest(id, "lms.collection.collect"),
            CancellationToken.None);

        var bad = Assert.IsType<BadRequestObjectResult>(result);
        Assert.Contains("user_inactive", bad.Value!.ToString()!, StringComparison.Ordinal);
        perms.Verify(p => p.HasPermissionAsync(It.IsAny<Guid>(), It.IsAny<string>(), It.IsAny<Guid>()), Times.Never);
    }

    [Fact]
    public async Task ValidateUser_Rejects_SoftDeleted_As_NotFound()
    {
        var (ctl, db, _) = Create();
        var id = Guid.Parse("ffffffff-ffff-ffff-ffff-ffffffffffff");
        await SeedUserAsync(db, id, deletedAt: DateTime.UtcNow);

        var result = await ctl.ValidateUser(
            new InternalLmsReferenceController.UserValidateRequest(id, "lms.collection.collect"),
            CancellationToken.None);

        Assert.IsType<NotFoundObjectResult>(result);
    }

    [Fact]
    public async Task ValidateUser_Rejects_CrossTenant_As_NotFound()
    {
        var (ctl, db, _) = Create();
        var id = Guid.Parse("12121212-1212-1212-1212-121212121212");
        var other = new AppUser
        {
            Id = id,
            TenantId = Guid.Parse("99999999-9999-9999-9999-999999999999"),
            UserName = "x",
            NormalizedUserName = "X",
            Email = "x@test.local",
            FirstName = "X",
            LastName = "Y",
            UserStatus = "active",
            SecurityStamp = Guid.NewGuid().ToString("N"),
        };
        db.Users.Add(other);
        await db.SaveChangesAsync();

        var result = await ctl.ValidateUser(
            new InternalLmsReferenceController.UserValidateRequest(id, "lms.collection.collect"),
            CancellationToken.None);

        Assert.IsType<NotFoundObjectResult>(result);
    }
}
