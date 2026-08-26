using AuthService.Context;
using AuthService.SeedData;
using Microsoft.AspNetCore.Http;
using Microsoft.EntityFrameworkCore;
using Xunit;

namespace AuthService.Tests;

public class PermissionSeederTests
{
    private static readonly Guid SystemTenant = Guid.Parse("00000000-0000-0000-0000-000000000000");

    [Fact]
    public async Task SeedPermissionsAsync_inserts_ip_ot_mark_ready_once()
    {
        await using var db = CreateDb();

        await PermissionSeeder.SeedPermissionsAsync(db);
        await PermissionSeeder.SeedPermissionsAsync(db);

        Assert.Equal(1, await CountCodeAsync(db, "ip.ot.mark_ready"));
        Assert.Equal(1, await CountCodeAsync(db, "ip.admit"));
        Assert.Equal(1, await CountCodeAsync(db, "ip.safety_token.print"));
        Assert.Equal(1, await CountCodeAsync(db, "ip.implant.mismatch.override"));
        Assert.Equal(1, await CountCodeAsync(db, "bill.create"));

        var markReady = await db.Permissions.SingleAsync(p => p.Code == "ip.ot.mark_ready");
        Assert.Equal(SystemTenant, markReady.TenantId);
        Assert.True(markReady.IsActive);
        Assert.Equal("ip_management", markReady.Module);
    }

    [Fact]
    public void Catalog_lists_156_and_a5_codes_without_duplicating_a2()
    {
        var codes = IpBillingPermissionCatalog.Create(SystemTenant, DateTime.UtcNow)
            .Select(p => p.Code)
            .ToList();

        Assert.Equal(23, codes.Count);
        Assert.Equal(codes.Count, codes.Distinct(StringComparer.Ordinal).Count());
        Assert.Contains("ip.ot.mark_ready", codes);
        Assert.Contains("ip.safety_token.print", codes);
        Assert.DoesNotContain("ip.implant.mismatch.override", codes);
    }

    private static async Task<int> CountCodeAsync(AppDbContext db, string code) =>
        await db.Permissions.CountAsync(p => p.TenantId == SystemTenant && p.Code == code);

    private static AppDbContext CreateDb()
    {
        var options = new DbContextOptionsBuilder<AppDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString("N"))
            .Options;
        return new AppDbContext(options, new HttpContextAccessor());
    }
}
