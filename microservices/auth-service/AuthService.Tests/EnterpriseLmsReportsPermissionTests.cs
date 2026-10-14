using AuthService.Context;
using AuthService.SeedData;
using Microsoft.AspNetCore.Http;
using Microsoft.EntityFrameworkCore;
using Xunit;

namespace AuthService.Tests;

public class EnterpriseLmsReportsPermissionTests
{
    private static AppDbContext CreateDb() =>
        new(new DbContextOptionsBuilder<AppDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString("N"))
            .Options, new HttpContextAccessor());

    [Fact]
    public void Catalog_Defines_Report_Codes_Without_Publish()
    {
        Assert.Equal(
            new[]
            {
                "lms.reports.view",
                "lms.reports.manage",
                "lms.reports.finalize",
                "lms.reports.release",
                "lms.reports.download",
                "lms.reports.assign_number",
                "lms.reports.generate",
            },
            EnterpriseLmsReportsPermissionCatalog.RequiredPermissionCodes);
        Assert.DoesNotContain(
            "lms.reports.publish",
            EnterpriseLmsReportsPermissionCatalog.RequiredPermissionCodes);
    }

    [Fact]
    public async Task Seed_Creates_Codes_Without_Role_Grants()
    {
        await using var db = CreateDb();
        await PermissionSeeder.SeedEnterpriseLmsReportsPermissionsAsync(db);
        await PermissionSeeder.SeedEnterpriseLmsReportsPermissionsAsync(db);

        foreach (var code in EnterpriseLmsReportsPermissionCatalog.RequiredPermissionCodes)
        {
            var perm = await db.Permissions.SingleAsync(p => p.Code == code && p.IsActive);
            Assert.Empty(await db.RolePermissions.Where(rp => rp.PermissionId == perm.Id).ToListAsync());
        }
    }
}
