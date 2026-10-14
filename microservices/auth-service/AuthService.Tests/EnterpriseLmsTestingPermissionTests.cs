using AuthService.Context;
using AuthService.SeedData;
using Microsoft.AspNetCore.Http;
using Microsoft.EntityFrameworkCore;
using Xunit;

namespace AuthService.Tests;

public class EnterpriseLmsTestingPermissionTests
{
    private static AppDbContext CreateDb() =>
        new(new DbContextOptionsBuilder<AppDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString("N"))
            .Options, new HttpContextAccessor());

    [Fact]
    public void Catalog_Defines_Testing_Codes_Without_Extras()
    {
        Assert.Equal(
            new[]
            {
                "lms.testing.view",
                "lms.testing.manage",
                "lms.testing.result",
                "lms.testing.verify",
                "lms.results.authorize",
                "lms.results.critical.view",
                "lms.results.critical.manage",
                "lms.results.critical.acknowledge",
            },
            EnterpriseLmsTestingPermissionCatalog.RequiredPermissionCodes);
    }

    [Fact]
    public async Task Seed_Creates_Codes_Without_Role_Grants()
    {
        await using var db = CreateDb();
        await PermissionSeeder.SeedEnterpriseLmsTestingPermissionsAsync(db);
        await PermissionSeeder.SeedEnterpriseLmsTestingPermissionsAsync(db);

        foreach (var code in EnterpriseLmsTestingPermissionCatalog.RequiredPermissionCodes)
        {
            var perm = await db.Permissions.SingleAsync(p => p.Code == code && p.IsActive);
            Assert.Empty(await db.RolePermissions.Where(rp => rp.PermissionId == perm.Id).ToListAsync());
        }
    }
}
