using AuthService.Context;
using AuthService.SeedData;
using Microsoft.AspNetCore.Http;
using Microsoft.EntityFrameworkCore;
using Xunit;

namespace AuthService.Tests;

public class EnterpriseLmsSpecimenPermissionTests
{
    private static AppDbContext CreateDb() =>
        new(new DbContextOptionsBuilder<AppDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString("N"))
            .Options, new HttpContextAccessor());

    [Fact]
    public void Catalog_Defines_Specimen_And_Barcode_Label_Codes_Without_Extras()
    {
        Assert.Equal(
            new[]
            {
                "lms.specimens.view",
                "lms.specimens.manage",
                "lms.specimens.receive",
                "lms.specimens.barcode.view",
                "lms.specimens.label.print",
                "lms.specimens.label.reprint",
            },
            EnterpriseLmsSpecimenPermissionCatalog.RequiredPermissionCodes);
    }

    [Fact]
    public async Task Seed_Creates_Codes_Without_Role_Grants()
    {
        await using var db = CreateDb();
        await PermissionSeeder.SeedEnterpriseLmsSpecimenPermissionsAsync(db);
        await PermissionSeeder.SeedEnterpriseLmsSpecimenPermissionsAsync(db);

        foreach (var code in EnterpriseLmsSpecimenPermissionCatalog.RequiredPermissionCodes)
        {
            var perm = await db.Permissions.SingleAsync(p => p.Code == code && p.IsActive);
            Assert.Empty(await db.RolePermissions.Where(rp => rp.PermissionId == perm.Id).ToListAsync());
        }
    }
}
