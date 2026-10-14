using AuthService.Context;
using AuthService.SeedData;
using Microsoft.AspNetCore.Http;
using Microsoft.EntityFrameworkCore;
using Xunit;

namespace AuthService.Tests;

public class EnterpriseLmsOrdersPermissionTests
{
    private static AppDbContext CreateDb() =>
        new(new DbContextOptionsBuilder<AppDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString("N"))
            .Options, new HttpContextAccessor());

    [Fact]
    public void Catalog_Defines_View_Create_Manage_Only()
    {
        Assert.Equal(
            new[] { "lms.orders.view", "lms.orders.create", "lms.orders.manage" },
            EnterpriseLmsOrdersPermissionCatalog.RequiredPermissionCodes);
    }

    [Fact]
    public async Task Seed_Creates_Codes_Without_Role_Grants()
    {
        await using var db = CreateDb();
        await PermissionSeeder.SeedEnterpriseLmsOrdersPermissionsAsync(db);
        await PermissionSeeder.SeedEnterpriseLmsOrdersPermissionsAsync(db);

        foreach (var code in EnterpriseLmsOrdersPermissionCatalog.RequiredPermissionCodes)
        {
            var perm = await db.Permissions.SingleAsync(p => p.Code == code && p.IsActive);
            Assert.Empty(await db.RolePermissions.Where(rp => rp.PermissionId == perm.Id).ToListAsync());
        }
    }
}
