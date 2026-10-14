using System.Linq;
using System.Threading.Tasks;
using AuthService.Context;
using AuthService.SeedData;
using Microsoft.AspNetCore.Http;
using Microsoft.EntityFrameworkCore;
using Xunit;

namespace AuthService.Tests;

/// <summary>
/// L-PORTAL-01 Gate A — portal.invite.create definition/seed only (no role grants, no HTTP).
/// </summary>
public class PortalInvitePermissionTests
{
    private static AppDbContext CreateDb() =>
        new(new DbContextOptionsBuilder<AppDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString("N"))
            .Options, new HttpContextAccessor());

    [Fact]
    public void Catalog_Defines_PortalInviteCreate_Only()
    {
        Assert.Equal(new[] { "portal.invite.create" }, PortalInvitePermissionCatalog.RequiredPermissionCodes);
        Assert.Equal("portal.invite.create", PortalInvitePermissionCatalog.InviteCreate);
        Assert.Single(PortalInvitePermissionCatalog.PermissionDefinitions);
        Assert.Contains(
            "Patient Portal invitations",
            PortalInvitePermissionCatalog.PermissionDefinitions[0].Description);
    }

    [Fact]
    public async Task Seed_Creates_PortalInviteCreate_Without_Role_Grants()
    {
        await using var db = CreateDb();

        await PermissionSeeder.SeedPortalInvitePermissionsAsync(db);
        await PermissionSeeder.SeedPortalInvitePermissionsAsync(db); // idempotent

        var perm = await db.Permissions.SingleAsync(p =>
            p.Code == PortalInvitePermissionCatalog.InviteCreate && p.IsActive);
        Assert.Equal("portal", perm.Module);
        Assert.Equal("create", perm.Action);
        Assert.Equal("portal_invitation", perm.ResourceType);
        Assert.True(perm.IsSystemPermission);
        Assert.Contains("Patient Portal invitations", perm.Description);

        Assert.Equal(1, await db.Permissions.CountAsync(p =>
            p.Code == PortalInvitePermissionCatalog.InviteCreate));
        Assert.Empty(await db.RolePermissions.Where(rp => rp.PermissionId == perm.Id).ToListAsync());
    }

    [Fact]
    public async Task Seed_Does_Not_Remove_Existing_Unrelated_Permissions()
    {
        await using var db = CreateDb();
        await PermissionSeeder.SeedEnterpriseLmsL0PermissionsAsync(db);
        await PermissionSeeder.SeedPortalInvitePermissionsAsync(db);

        Assert.True(await db.Permissions.AnyAsync(p => p.Code == "lms.view" && p.IsActive));
        Assert.True(await db.Permissions.AnyAsync(p =>
            p.Code == PortalInvitePermissionCatalog.InviteCreate && p.IsActive));
    }
}
