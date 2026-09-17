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
        Assert.Equal(1, await CountCodeAsync(db, "counseling_sessions.read"));
        Assert.Equal(1, await CountCodeAsync(db, "counseling_sessions.update"));
        Assert.Equal(1, await CountCodeAsync(db, "counseling_sessions.reassign"));

        var markReady = await db.Permissions.SingleAsync(p => p.Code == "ip.ot.mark_ready");
        Assert.Equal(SystemTenant, markReady.TenantId);
        Assert.True(markReady.IsActive);
        Assert.Equal("ip_management", markReady.Module);

        var counselRead = await db.Permissions.SingleAsync(p => p.Code == "counseling_sessions.read");
        Assert.Equal("counsellor", counselRead.Module);
    }

    [Fact]
    public void Counseling_catalog_lists_baseline_and_reassign_without_duplicating()
    {
        var codes = CounselingSessionsPermissionCatalog.Create(SystemTenant, DateTime.UtcNow)
            .Select(p => p.Code)
            .ToList();

        Assert.Equal(6, codes.Count);
        Assert.Equal(codes.Count, codes.Distinct(StringComparer.Ordinal).Count());
        Assert.Contains("counseling_sessions.read", codes);
        Assert.Contains("counseling_sessions.create", codes);
        Assert.Contains("counseling_sessions.update", codes);
        Assert.Contains("counseling_sessions.reassign", codes);
        Assert.Equal(5, CounselingSessionsPermissionCatalog.Codes.Length);
        Assert.DoesNotContain(
            CounselingSessionsPermissionCatalog.ReassignPermissionCode,
            CounselingSessionsPermissionCatalog.Codes);
    }

    [Fact]
    public void Catalog_lists_156_and_a5_codes_without_duplicating_a2()
    {
        var codes = IpBillingPermissionCatalog.Create(SystemTenant, DateTime.UtcNow)
            .Select(p => p.Code)
            .ToList();

        Assert.Equal(24, codes.Count);
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
