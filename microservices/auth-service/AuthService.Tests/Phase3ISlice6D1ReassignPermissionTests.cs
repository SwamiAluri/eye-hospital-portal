using AuthService.Context;
using AuthService.Models.Domain;
using AuthService.Models.Identity;
using AuthService.SeedData;
using Microsoft.AspNetCore.Http;
using Microsoft.EntityFrameworkCore;
using Xunit;

namespace AuthService.Tests;

/// <summary>
/// Phase 3I Slice 6 D1 — counseling_sessions.reassign IAM mapping (no Reassign endpoint).
/// </summary>
public class Phase3ISlice6D1ReassignPermissionTests
{
    private static readonly Guid SystemTenant = Guid.Parse("00000000-0000-0000-0000-000000000000");

    [Fact]
    public void Catalog_defines_reassign_code_and_branch_scope()
    {
        Assert.Equal("counseling_sessions.reassign", CounselingSessionsPermissionCatalog.ReassignPermissionCode);

        var reassign = CounselingSessionsPermissionCatalog.Create(SystemTenant, DateTime.UtcNow)
            .Single(p => p.Code == CounselingSessionsPermissionCatalog.ReassignPermissionCode);

        Assert.Equal("counsellor", reassign.Module);
        Assert.Equal("reassign", reassign.Action);
        Assert.Equal("counseling_sessions", reassign.ResourceType);
        Assert.Equal("branch", reassign.Scope);
        Assert.True(reassign.IsSystemPermission);
        Assert.True(reassign.IsActive);
    }

    [Fact]
    public void Baseline_codes_exclude_reassign_so_counsellor_seeder_cannot_auto_grant()
    {
        Assert.DoesNotContain(
            CounselingSessionsPermissionCatalog.ReassignPermissionCode,
            CounselingSessionsPermissionCatalog.Codes);
        Assert.Equal(5, CounselingSessionsPermissionCatalog.Codes.Length);
        Assert.Contains("counseling_sessions.update", CounselingSessionsPermissionCatalog.Codes);
    }

    [Fact]
    public void Seeded_reassign_roles_are_admin_only_not_counsellor()
    {
        var roles = CounselingSessionsPermissionCatalog.ReassignRoleNormalizedNames;
        Assert.Contains("ADMIN", roles);
        Assert.DoesNotContain("COUNSELLOR", roles);
        Assert.DoesNotContain("COUNSELOR", roles);
        Assert.DoesNotContain("SUPERVISOR", roles);
    }

    [Fact]
    public void Counsellor_least_privilege_excludes_reassign_from_retained_and_strips_if_present()
    {
        Assert.DoesNotContain(
            CounselingSessionsPermissionCatalog.ReassignPermissionCode,
            CounsellorLeastPrivilegeCatalog.RetainedPermissionCodes);
        Assert.Contains(
            CounselingSessionsPermissionCatalog.ReassignPermissionCode,
            CounsellorLeastPrivilegeCatalog.RemovedFromCounsellorPermissionCodes);
        Assert.Contains("counseling_sessions.update", CounsellorLeastPrivilegeCatalog.RetainedPermissionCodes);
    }

    [Fact]
    public async Task SeedPermissionsAsync_inserts_reassign_once_without_changing_baseline_update()
    {
        await using var db = CreateDb();

        await PermissionSeeder.SeedPermissionsAsync(db);
        await PermissionSeeder.SeedPermissionsAsync(db);

        Assert.Equal(1, await CountCodeAsync(db, "counseling_sessions.reassign"));
        Assert.Equal(1, await CountCodeAsync(db, "counseling_sessions.update"));
        Assert.Equal(1, await CountCodeAsync(db, "counseling_sessions.read"));

        var reassign = await db.Permissions.SingleAsync(p => p.Code == "counseling_sessions.reassign");
        Assert.Equal("branch", reassign.Scope);
        Assert.Equal("counsellor", reassign.Module);
    }

    [Fact]
    public async Task SeedReassign_grants_admin_and_excludes_counsellor()
    {
        await using var db = CreateDb();

        var adminRole = new AppRole
        {
            Id = Guid.NewGuid(),
            Name = "Admin",
            NormalizedName = "ADMIN",
            TenantId = SystemTenant,
        };
        var counsellorRole = new AppRole
        {
            Id = Guid.NewGuid(),
            Name = "Counsellor",
            NormalizedName = "COUNSELLOR",
            TenantId = SystemTenant,
        };
        db.Roles.Add(adminRole);
        db.Roles.Add(counsellorRole);
        await db.SaveChangesAsync();

        await PermissionSeeder.SeedCounselingSessionsPermissionsForCounsellorRolesAsync(db);
        await PermissionSeeder.SeedCounselingSessionReassignPermissionsAsync(db);
        await PermissionSeeder.ApplyCounsellorLeastPrivilegeAsync(db);

        var reassignId = await db.Permissions
            .Where(p => p.Code == "counseling_sessions.reassign")
            .Select(p => p.Id)
            .SingleAsync();
        var updateId = await db.Permissions
            .Where(p => p.Code == "counseling_sessions.update")
            .Select(p => p.Id)
            .SingleAsync();

        Assert.True(await db.RolePermissions.AnyAsync(rp =>
            rp.RoleId == adminRole.Id && rp.PermissionId == reassignId));
        Assert.False(await db.RolePermissions.AnyAsync(rp =>
            rp.RoleId == counsellorRole.Id && rp.PermissionId == reassignId));
        Assert.True(await db.RolePermissions.AnyAsync(rp =>
            rp.RoleId == counsellorRole.Id && rp.PermissionId == updateId));
    }

    [Fact]
    public async Task ApplyLeastPrivilege_strips_reassign_from_counsellor_if_present()
    {
        await using var db = CreateDb();

        var counsellorRole = new AppRole
        {
            Id = Guid.NewGuid(),
            Name = "Counsellor",
            NormalizedName = "COUNSELLOR",
            TenantId = SystemTenant,
        };
        db.Roles.Add(counsellorRole);
        await db.SaveChangesAsync();

        await PermissionSeeder.SeedPermissionsAsync(db);

        var reassignId = await db.Permissions
            .Where(p => p.Code == "counseling_sessions.reassign")
            .Select(p => p.Id)
            .SingleAsync();

        db.RolePermissions.Add(new RolePermission
        {
            Id = Guid.NewGuid(),
            RoleId = counsellorRole.Id,
            PermissionId = reassignId,
            CreatedAt = DateTime.UtcNow,
        });
        await db.SaveChangesAsync();

        await PermissionSeeder.ApplyCounsellorLeastPrivilegeAsync(db);

        Assert.False(await db.RolePermissions.AnyAsync(rp =>
            rp.RoleId == counsellorRole.Id && rp.PermissionId == reassignId));
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
