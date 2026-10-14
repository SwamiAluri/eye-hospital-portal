using System;
using System.Linq;
using System.Threading.Tasks;
using AuthService.Context;
using AuthService.Models.Domain;
using AuthService.Models.Identity;
using AuthService.SeedData;
using Microsoft.AspNetCore.Http;
using Microsoft.EntityFrameworkCore;
using Xunit;

namespace AuthService.Tests;

/// <summary>
/// L-PORTAL-01 Gate B — portal.invite.create RolePermission grants for RECEPTIONIST + COUNSELLOR only.
/// InMemory provider; not live PostgreSQL verification.
/// </summary>
public class PortalInviteRoleGrantTests
{
    private static readonly Guid SystemTenant = Guid.Parse("00000000-0000-0000-0000-000000000000");

    private static readonly string[] ApprovedRoles =
    {
        "RECEPTIONIST",
        "COUNSELLOR",
    };

    private static readonly string[] DeferredOrExcludedRoles =
    {
        "COUNSELOR",
        "FRONT DESK",
        "MEDICAL RECORDS OFFICER",
        "ADMIN",
        "SUPERADMIN",
        "SUPER ADMIN",
        "NURSE",
        "IP COORDINATOR",
        "DOCTOR",
        "FRONT DESK MANAGER",
        "PATIENT COUNSELLOR",
    };

    [Fact]
    public void Catalog_Defines_Exact_Approved_NormalizedNames_Only()
    {
        Assert.Equal("portal.invite.create", PortalInviteRoleGrantCatalog.Code);
        Assert.Equal(ApprovedRoles, PortalInviteRoleGrantCatalog.ApprovedRoleNormalizedNames);
        Assert.DoesNotContain("COUNSELOR", PortalInviteRoleGrantCatalog.ApprovedRoleNormalizedNames);
        Assert.DoesNotContain("FRONT DESK", PortalInviteRoleGrantCatalog.ApprovedRoleNormalizedNames);
        Assert.DoesNotContain("MEDICAL RECORDS OFFICER", PortalInviteRoleGrantCatalog.ApprovedRoleNormalizedNames);
        Assert.DoesNotContain("ADMIN", PortalInviteRoleGrantCatalog.ApprovedRoleNormalizedNames);
        Assert.DoesNotContain("SUPERADMIN", PortalInviteRoleGrantCatalog.ApprovedRoleNormalizedNames);
        Assert.DoesNotContain("SUPER ADMIN", PortalInviteRoleGrantCatalog.ApprovedRoleNormalizedNames);
    }

    [Fact]
    public async Task Seed_Grants_Exactly_Receptionist_And_Counsellor_Once_And_Is_Idempotent()
    {
        await using var db = CreateDb();
        await PermissionSeeder.SeedPortalInvitePermissionsAsync(db);
        var permission = await db.Permissions.SingleAsync(p => p.Code == PortalInviteRoleGrantCatalog.Code);

        var approved = ApprovedRoles.ToDictionary(n => n, n => AddNamedRole(db, n));
        foreach (var name in DeferredOrExcludedRoles)
            AddNamedRole(db, name);
        await db.SaveChangesAsync();

        await PermissionSeeder.SeedPortalInviteRoleGrantsAsync(db);
        await PermissionSeeder.SeedPortalInviteRoleGrantsAsync(db);

        var grants = await db.RolePermissions.Where(rp => rp.PermissionId == permission.Id).ToListAsync();
        Assert.Equal(ApprovedRoles.Length, grants.Count);
        foreach (var role in approved.Values)
            Assert.Equal(1, grants.Count(rp => rp.RoleId == role.Id));

        foreach (var name in DeferredOrExcludedRoles)
        {
            var roleId = await db.Roles.Where(r => r.NormalizedName == name).Select(r => r.Id).SingleAsync();
            Assert.DoesNotContain(grants, rp => rp.RoleId == roleId);
        }
    }

    [Fact]
    public async Task Seed_Does_Not_Grant_Counselor_Or_FrontDesk_When_Present()
    {
        await using var db = CreateDb();
        await PermissionSeeder.SeedPortalInvitePermissionsAsync(db);
        var permission = await db.Permissions.SingleAsync(p => p.Code == PortalInviteRoleGrantCatalog.Code);

        AddNamedRole(db, "RECEPTIONIST");
        AddNamedRole(db, "COUNSELLOR");
        var counselor = AddNamedRole(db, "COUNSELOR");
        var frontDesk = AddNamedRole(db, "FRONT DESK");
        var mro = AddNamedRole(db, "MEDICAL RECORDS OFFICER");
        await db.SaveChangesAsync();

        await PermissionSeeder.SeedPortalInviteRoleGrantsAsync(db);

        Assert.Equal(0, await db.RolePermissions.CountAsync(rp =>
            rp.PermissionId == permission.Id && rp.RoleId == counselor.Id));
        Assert.Equal(0, await db.RolePermissions.CountAsync(rp =>
            rp.PermissionId == permission.Id && rp.RoleId == frontDesk.Id));
        Assert.Equal(0, await db.RolePermissions.CountAsync(rp =>
            rp.PermissionId == permission.Id && rp.RoleId == mro.Id));
        Assert.Equal(2, await db.RolePermissions.CountAsync(rp => rp.PermissionId == permission.Id));
    }

    [Fact]
    public async Task Seed_Preserves_Existing_Approved_Grant_And_Unrelated_Grants()
    {
        await using var db = CreateDb();
        await PermissionSeeder.SeedPortalInvitePermissionsAsync(db);
        var invitePerm = await db.Permissions.SingleAsync(p => p.Code == PortalInviteRoleGrantCatalog.Code);

        var receptionist = AddNamedRole(db, "RECEPTIONIST");
        var counsellor = AddNamedRole(db, "COUNSELLOR");
        var pharmacist = AddNamedRole(db, "PHARMACIST");

        var view = new Permission
        {
            Id = Guid.NewGuid(),
            TenantId = SystemTenant,
            Code = "patient.view",
            Name = "View Patients",
            Module = "patient",
            Action = "view",
            ResourceType = "patient",
            Scope = "branch",
            IsActive = true,
            CreatedAt = DateTime.UtcNow.AddDays(-5),
            UpdatedAt = DateTime.UtcNow.AddDays(-5),
        };
        db.Permissions.Add(view);

        var existingInviteGrant = new RolePermission
        {
            Id = Guid.NewGuid(),
            RoleId = receptionist.Id,
            PermissionId = invitePerm.Id,
            CreatedAt = DateTime.UtcNow.AddDays(-2),
        };
        var unexpectedInviteOnPharmacist = new RolePermission
        {
            Id = Guid.NewGuid(),
            RoleId = pharmacist.Id,
            PermissionId = invitePerm.Id,
            CreatedAt = DateTime.UtcNow.AddDays(-1),
        };
        var viewGrant = new RolePermission
        {
            Id = Guid.NewGuid(),
            RoleId = pharmacist.Id,
            PermissionId = view.Id,
            CreatedAt = DateTime.UtcNow.AddDays(-3),
        };
        db.RolePermissions.AddRange(existingInviteGrant, unexpectedInviteOnPharmacist, viewGrant);
        await db.SaveChangesAsync();

        await PermissionSeeder.SeedPortalInviteRoleGrantsAsync(db);

        var inviteGrants = await db.RolePermissions.Where(rp => rp.PermissionId == invitePerm.Id).ToListAsync();
        // receptionist (preserved) + counsellor (added) + pharmacist unexpected preserved
        Assert.Equal(3, inviteGrants.Count);
        Assert.Equal(existingInviteGrant.Id, inviteGrants.Single(rp => rp.RoleId == receptionist.Id).Id);
        Assert.Equal(1, inviteGrants.Count(rp => rp.RoleId == counsellor.Id));
        Assert.Contains(inviteGrants, rp => rp.Id == unexpectedInviteOnPharmacist.Id);

        var storedView = await db.RolePermissions.SingleAsync(rp => rp.Id == viewGrant.Id);
        Assert.Equal(view.Id, storedView.PermissionId);
        Assert.Equal(pharmacist.Id, storedView.RoleId);
        Assert.Equal(viewGrant.CreatedAt, storedView.CreatedAt);
    }

    [Fact]
    public async Task Seed_Does_Not_Add_Explicit_Admin_Or_SuperAdmin_RolePermission()
    {
        await using var db = CreateDb();
        await PermissionSeeder.SeedPortalInvitePermissionsAsync(db);
        var permission = await db.Permissions.SingleAsync(p => p.Code == PortalInviteRoleGrantCatalog.Code);

        AddNamedRole(db, "RECEPTIONIST");
        AddNamedRole(db, "COUNSELLOR");
        var admin = AddNamedRole(db, "ADMIN");
        var superAdmin = AddNamedRole(db, "SUPERADMIN");
        var superAdminSpaced = AddNamedRole(db, "SUPER ADMIN");
        await db.SaveChangesAsync();

        await PermissionSeeder.SeedPortalInviteRoleGrantsAsync(db);

        Assert.Equal(0, await db.RolePermissions.CountAsync(rp =>
            rp.PermissionId == permission.Id && rp.RoleId == admin.Id));
        Assert.Equal(0, await db.RolePermissions.CountAsync(rp =>
            rp.PermissionId == permission.Id && rp.RoleId == superAdmin.Id));
        Assert.Equal(0, await db.RolePermissions.CountAsync(rp =>
            rp.PermissionId == permission.Id && rp.RoleId == superAdminSpaced.Id));
    }

    [Fact]
    public async Task Seed_Skips_When_Permission_Missing_Without_Creating_Permission()
    {
        await using var db = CreateDb();
        AddNamedRole(db, "RECEPTIONIST");
        AddNamedRole(db, "COUNSELLOR");
        await db.SaveChangesAsync();

        await PermissionSeeder.SeedPortalInviteRoleGrantsAsync(db);

        Assert.Empty(await db.Permissions.Where(p => p.Code == PortalInviteRoleGrantCatalog.Code).ToListAsync());
        Assert.Empty(await db.RolePermissions.ToListAsync());
    }

    [Fact]
    public async Task Seed_Does_Not_Match_Role_By_Name_When_NormalizedName_Differs()
    {
        await using var db = CreateDb();
        await PermissionSeeder.SeedPortalInvitePermissionsAsync(db);
        var permission = await db.Permissions.SingleAsync(p => p.Code == PortalInviteRoleGrantCatalog.Code);

        // Display name looks like Receptionist but NormalizedName is not approved.
        db.Roles.Add(new AppRole
        {
            Id = Guid.NewGuid(),
            Name = "Receptionist",
            NormalizedName = "FRONT DESK MANAGER",
            TenantId = SystemTenant,
            IsActive = true,
        });
        AddNamedRole(db, "COUNSELLOR");
        await db.SaveChangesAsync();

        await PermissionSeeder.SeedPortalInviteRoleGrantsAsync(db);

        Assert.Equal(1, await db.RolePermissions.CountAsync(rp => rp.PermissionId == permission.Id));
        var grantedRoleId = await db.RolePermissions
            .Where(rp => rp.PermissionId == permission.Id)
            .Select(rp => rp.RoleId)
            .SingleAsync();
        var granted = await db.Roles.SingleAsync(r => r.Id == grantedRoleId);
        Assert.Equal("COUNSELLOR", granted.NormalizedName);
    }

    private static AppRole AddNamedRole(AppDbContext db, string normalizedName)
    {
        var role = new AppRole
        {
            Id = Guid.NewGuid(),
            Name = normalizedName,
            NormalizedName = normalizedName,
            TenantId = SystemTenant,
            IsActive = true,
        };
        db.Roles.Add(role);
        return role;
    }

    private static AppDbContext CreateDb()
    {
        var options = new DbContextOptionsBuilder<AppDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString("N"))
            .Options;
        return new AppDbContext(options, new HttpContextAccessor());
    }
}
