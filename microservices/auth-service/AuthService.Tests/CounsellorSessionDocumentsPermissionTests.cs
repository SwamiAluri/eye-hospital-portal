using AuthService.Context;
using AuthService.Models.Identity;
using AuthService.SeedData;
using Microsoft.AspNetCore.Http;
using Microsoft.EntityFrameworkCore;
using Xunit;

namespace AuthService.Tests;

/// <summary>
/// Counselling Session Documents RBAC — grant existing session_documents.* to Counsellor only.
/// </summary>
public class CounsellorSessionDocumentsPermissionTests
{
    private static readonly Guid SystemTenant = Guid.Parse("00000000-0000-0000-0000-000000000000");

    [Fact]
    public void Catalog_defines_four_certified_session_document_codes()
    {
        Assert.Equal(
            new[]
            {
                "session_documents.read",
                "session_documents.create",
                "session_documents.verify",
                "session_documents.delete",
            },
            SessionDocumentsPermissionCatalog.Codes);

        var created = SessionDocumentsPermissionCatalog.Create(SystemTenant, DateTime.UtcNow);
        Assert.Equal(4, created.Count);
        Assert.All(created, p =>
        {
            Assert.Equal("counsellor", p.Module);
            Assert.Equal("session_documents", p.ResourceType);
            Assert.Equal("branch", p.Scope);
            Assert.True(p.IsSystemPermission);
            Assert.True(p.IsActive);
        });
    }

    [Fact]
    public void Counsellor_least_privilege_retains_session_documents_and_does_not_strip()
    {
        var retained = CounsellorLeastPrivilegeCatalog.RetainedPermissionCodes;
        var remove = CounsellorLeastPrivilegeCatalog.RemovedFromCounsellorPermissionCodes;
        foreach (var code in CounsellorLeastPrivilegeCatalog.WorkflowSessionDocumentPermissionCodes)
        {
            Assert.Contains(code, retained);
            Assert.DoesNotContain(code, remove);
        }
        Assert.DoesNotContain("session_notes.read", retained);
        Assert.DoesNotContain("patient.patient_document.download", retained);
    }

    [Fact]
    public async Task SeedPermissionsAsync_inserts_session_documents_once()
    {
        await using var db = CreateDb();
        await PermissionSeeder.SeedPermissionsAsync(db);
        await PermissionSeeder.SeedPermissionsAsync(db);

        foreach (var code in SessionDocumentsPermissionCatalog.Codes)
            Assert.Equal(1, await db.Permissions.CountAsync(p => p.Code == code && p.IsActive));
    }

    [Fact]
    public async Task Seed_grants_counsellor_and_excludes_front_office_roles()
    {
        await using var db = CreateDb();

        var counsellor = Role("Counsellor", "COUNSELLOR");
        var counselor = Role("Counselor", "COUNSELOR");
        var reception = Role("Receptionist", "RECEPTIONIST");
        var frontDesk = Role("Front Desk", "FRONT DESK");
        db.Roles.AddRange(counsellor, counselor, reception, frontDesk);
        await db.SaveChangesAsync();

        await PermissionSeeder.SeedCounsellorSessionDocumentsPermissionsAsync(db);
        await PermissionSeeder.ApplyCounsellorLeastPrivilegeAsync(db);

        var permIds = await db.Permissions
            .Where(p => SessionDocumentsPermissionCatalog.Codes.Contains(p.Code) && p.IsActive)
            .Select(p => p.Id)
            .ToListAsync();
        Assert.Equal(4, permIds.Count);

        foreach (var permId in permIds)
        {
            Assert.True(await db.RolePermissions.AnyAsync(rp =>
                rp.RoleId == counsellor.Id && rp.PermissionId == permId));
            Assert.True(await db.RolePermissions.AnyAsync(rp =>
                rp.RoleId == counselor.Id && rp.PermissionId == permId));
            Assert.False(await db.RolePermissions.AnyAsync(rp =>
                rp.RoleId == reception.Id && rp.PermissionId == permId));
            Assert.False(await db.RolePermissions.AnyAsync(rp =>
                rp.RoleId == frontDesk.Id && rp.PermissionId == permId));
        }
    }

    [Fact]
    public async Task Seed_is_idempotent()
    {
        await using var db = CreateDb();
        db.Roles.Add(Role("Counsellor", "COUNSELLOR"));
        await db.SaveChangesAsync();

        await PermissionSeeder.SeedCounsellorSessionDocumentsPermissionsAsync(db);
        await PermissionSeeder.SeedCounsellorSessionDocumentsPermissionsAsync(db);

        var counsellorId = await db.Roles.Where(r => r.NormalizedName == "COUNSELLOR").Select(r => r.Id).SingleAsync();
        var linked = await db.RolePermissions.CountAsync(rp => rp.RoleId == counsellorId);
        Assert.Equal(4, linked);
    }

    private static AppRole Role(string name, string normalized) => new()
    {
        Id = Guid.NewGuid(),
        Name = name,
        NormalizedName = normalized,
        TenantId = SystemTenant,
    };

    private static AppDbContext CreateDb() =>
        new(
            new DbContextOptionsBuilder<AppDbContext>()
                .UseInMemoryDatabase(Guid.NewGuid().ToString("N"))
                .Options,
            new HttpContextAccessor());
}
