using AuthService.Context;
using AuthService.SeedData;
using Microsoft.AspNetCore.Http;
using Microsoft.EntityFrameworkCore;
using Xunit;

namespace AuthService.Tests;

public class EnterpriseLmsCollectionPermissionTests
{
    private static AppDbContext CreateDb() =>
        new(new DbContextOptionsBuilder<AppDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString("N"))
            .Options, new HttpContextAccessor());

    [Fact]
    public void Catalog_Defines_View_Manage_Collect_Only()
    {
        Assert.Equal(
            new[] { "lms.collection.view", "lms.collection.manage", "lms.collection.collect" },
            EnterpriseLmsCollectionPermissionCatalog.RequiredPermissionCodes);
    }

    [Fact]
    public async Task Seed_Creates_Codes_Without_Role_Grants()
    {
        await using var db = CreateDb();
        await PermissionSeeder.SeedEnterpriseLmsCollectionPermissionsAsync(db);
        await PermissionSeeder.SeedEnterpriseLmsCollectionPermissionsAsync(db);

        foreach (var code in EnterpriseLmsCollectionPermissionCatalog.RequiredPermissionCodes)
        {
            var perm = await db.Permissions.SingleAsync(p => p.Code == code && p.IsActive);
            Assert.Empty(await db.RolePermissions.Where(rp => rp.PermissionId == perm.Id).ToListAsync());
        }
    }
}
