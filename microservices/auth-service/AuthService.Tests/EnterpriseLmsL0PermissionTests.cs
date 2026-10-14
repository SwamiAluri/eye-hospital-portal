using AuthService.Context;
using AuthService.SeedData;
using Microsoft.AspNetCore.Http;
using Microsoft.EntityFrameworkCore;
using Xunit;

namespace AuthService.Tests;

/// <summary>
/// Enterprise LMS L0: catalog seed for lms.view without conflating legacy laboratory.view roles.
/// </summary>
public class EnterpriseLmsL0PermissionTests
{
    private static AppDbContext CreateDb() =>
        new(new DbContextOptionsBuilder<AppDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString("N"))
            .Options, new HttpContextAccessor());

    [Fact]
    public void Catalog_defines_root_lms_view_only()
    {
        Assert.Equal(new[] { "lms.view" }, EnterpriseLmsL0PermissionCatalog.RequiredPermissionCodes);
        Assert.Equal("lms.view", EnterpriseLmsL0PermissionCatalog.LmsView);
        Assert.Single(EnterpriseLmsL0PermissionCatalog.PermissionDefinitions);
    }

    [Fact]
    public async Task Seed_Creates_LmsView_Without_Role_Grants()
    {
        await using var db = CreateDb();

        await PermissionSeeder.SeedEnterpriseLmsL0PermissionsAsync(db);
        await PermissionSeeder.SeedEnterpriseLmsL0PermissionsAsync(db); // idempotent

        var perm = await db.Permissions.SingleAsync(p => p.Code == EnterpriseLmsL0PermissionCatalog.LmsView);
        Assert.True(perm.IsActive);
        Assert.Equal("lms", perm.Module);

        Assert.Empty(await db.RolePermissions.Where(rp => rp.PermissionId == perm.Id).ToListAsync());
    }

    [Fact]
    public async Task Seed_Does_Not_Touch_LaboratoryView_Catalog()
    {
        await using var db = CreateDb();
        await PermissionSeeder.SeedLaboratoryL0UatPermissionsAsync(db);
        await PermissionSeeder.SeedEnterpriseLmsL0PermissionsAsync(db);

        Assert.True(await db.Permissions.AnyAsync(p => p.Code == "laboratory.view" && p.IsActive));
        Assert.True(await db.Permissions.AnyAsync(p => p.Code == "lms.view" && p.IsActive));
        Assert.NotEqual("laboratory.view", EnterpriseLmsL0PermissionCatalog.LmsView);
    }
}
