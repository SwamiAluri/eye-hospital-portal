using AuthService.Context;
using AuthService.Models.Domain;
using AuthService.Models.Identity;
using AuthService.SeedData;
using AuthService.Services;
using Microsoft.AspNetCore.Http;
using Microsoft.EntityFrameworkCore;
using Xunit;

namespace AuthService.Tests;

/// <summary>
/// L0 UAT prerequisite: restore laboratory.view / patient.view / patient.update
/// and grant them to Lab Technician / Lab Manager only (not inventing new codes).
/// </summary>
public class LaboratoryL0UatPermissionTests
{
    private static readonly Guid SystemTenant = Guid.Parse("00000000-0000-0000-0000-000000000000");
    private static readonly Guid TenantId = Guid.Parse("155fe198-6ae5-4a01-9254-ead5b427247e");

    private static readonly string[] RejectedRoles =
    {
        "DOCTOR",
        "COUNSELLOR",
        "NURSE",
        "RECEPTIONIST",
        "FRONT DESK",
        "CASHIER",
    };

    [Fact]
    public void Catalog_uses_existing_contracts_only()
    {
        Assert.Equal(
            new[] { "laboratory.view", "patient.view", "patient.update" },
            LaboratoryL0UatPermissionCatalog.RequiredPermissionCodes);
        Assert.Contains("LAB TECHNICIAN", LaboratoryL0UatPermissionCatalog.ApprovedRoleNormalizedNames);
        Assert.Contains("LAB MANAGER", LaboratoryL0UatPermissionCatalog.ApprovedRoleNormalizedNames);
        Assert.Equal(2, LaboratoryL0UatPermissionCatalog.ApprovedRoleNormalizedNames.Length);
        foreach (var rejected in RejectedRoles)
            Assert.DoesNotContain(rejected, LaboratoryL0UatPermissionCatalog.ApprovedRoleNormalizedNames);
        Assert.DoesNotContain("ADMIN", LaboratoryL0UatPermissionCatalog.ApprovedRoleNormalizedNames);
    }

    [Fact]
    public async Task Seed_restores_missing_codes_and_grants_lab_roles_idempotently()
    {
        await using var db = CreateDb();
        var tech = AddRole(db, "LAB TECHNICIAN");
        var mgr = AddRole(db, "LAB MANAGER");
        var doctor = AddRole(db, "DOCTOR");
        // patient.view may already exist (counsellor path) — seed must not duplicate.
        var existingView = AddPermission(db, "patient.view", "View Patients");
        await db.SaveChangesAsync();
        var viewUpdated = existingView.UpdatedAt;

        await PermissionSeeder.SeedLaboratoryL0UatPermissionsAsync(db);
        await PermissionSeeder.SeedLaboratoryL0UatPermissionsAsync(db);

        foreach (var code in LaboratoryL0UatPermissionCatalog.RequiredPermissionCodes)
        {
            Assert.Equal(1, await db.Permissions.CountAsync(p => p.Code == code && p.IsActive));
        }

        Assert.Equal(viewUpdated, (await db.Permissions.SingleAsync(p => p.Id == existingView.Id)).UpdatedAt);

        var permIds = await db.Permissions
            .Where(p => LaboratoryL0UatPermissionCatalog.RequiredPermissionCodes.Contains(p.Code))
            .Select(p => p.Id)
            .ToListAsync();

        foreach (var role in new[] { tech, mgr })
        {
            foreach (var permId in permIds)
            {
                Assert.Equal(1, await db.RolePermissions.CountAsync(rp =>
                    rp.RoleId == role.Id && rp.PermissionId == permId));
            }
        }

        Assert.Equal(0, await db.RolePermissions.CountAsync(rp =>
            rp.RoleId == doctor.Id && permIds.Contains(rp.PermissionId)));
    }

    [Fact]
    public async Task Lab_technician_effective_permissions_include_l0_contracts()
    {
        await using var db = CreateDb();
        var user = AddUser(db, "labtech1@hospital.com");
        var tech = AddRole(db, "LAB TECHNICIAN");
        LinkRole(db, user, tech);
        await db.SaveChangesAsync();

        await PermissionSeeder.SeedLaboratoryL0UatPermissionsAsync(db);

        var svc = new PermissionService(db);
        var perms = await svc.GetUserPermissionsAsync(user.Id, TenantId);

        Assert.DoesNotContain("*", perms);
        Assert.Contains("laboratory.view", perms);
        Assert.Contains("patient.view", perms);
        Assert.Contains("patient.update", perms);
        Assert.True(await svc.HasPermissionAsync(user.Id, "laboratory.view", TenantId));
        Assert.True(await svc.HasPermissionAsync(user.Id, "patient.view", TenantId));
        Assert.True(await svc.HasPermissionAsync(user.Id, "patient.update", TenantId));
        Assert.False(await svc.HasPermissionAsync(user.Id, "user.manage", TenantId));
    }

    [Fact]
    public async Task Lab_manager_effective_permissions_include_l0_contracts()
    {
        await using var db = CreateDb();
        var user = AddUser(db, "labmgr1@hospital.com");
        var mgr = AddRole(db, "LAB MANAGER");
        LinkRole(db, user, mgr);
        await db.SaveChangesAsync();

        await PermissionSeeder.SeedLaboratoryL0UatPermissionsAsync(db);

        var svc = new PermissionService(db);
        var perms = await svc.GetUserPermissionsAsync(user.Id, TenantId);

        Assert.DoesNotContain("*", perms);
        Assert.Contains("laboratory.view", perms);
        Assert.Contains("patient.view", perms);
        Assert.Contains("patient.update", perms);
    }

    [Fact]
    public void LabReportsController_contracts_unchanged()
    {
        var path = Path.Combine(
            FindRepoRoot(),
            "microservices", "auth-service", "AuthService", "Controllers", "LabReportsController.cs");
        var src = File.ReadAllText(path);
        Assert.Contains("RequirePermission(\"patient.view\")", src);
        Assert.Contains("RequirePermission(\"patient.update\")", src);
        Assert.DoesNotContain("RequirePermission(\"laboratory.view\")", src);
    }

    [Fact]
    public void Lab_uat_bootstrap_targets_existing_invitation_emails_only()
    {
        Assert.Contains("labtech1@hospital.com", LabUatAccountBootstrap.PreferredLabTechnicianEmails);
        Assert.Contains("labmgr1@hospital.com", LabUatAccountBootstrap.PreferredLabManagerEmails);
        Assert.Single(LabUatAccountBootstrap.PreferredLabTechnicianEmails);
        Assert.Single(LabUatAccountBootstrap.PreferredLabManagerEmails);
    }

    private static AppDbContext CreateDb() =>
        new(new DbContextOptionsBuilder<AppDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString("N"))
            .Options, new HttpContextAccessor());

    private static AppUser AddUser(AppDbContext db, string email)
    {
        var user = new AppUser
        {
            Id = Guid.NewGuid(),
            TenantId = TenantId,
            Email = email,
            NormalizedEmail = email.ToUpperInvariant(),
            UserName = email,
            NormalizedUserName = email.ToUpperInvariant(),
            UserStatus = "active",
            EmailConfirmed = true,
            SecurityStamp = Guid.NewGuid().ToString(),
            ConcurrencyStamp = Guid.NewGuid().ToString(),
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow,
        };
        db.Users.Add(user);
        return user;
    }

    private static AppRole AddRole(AppDbContext db, string normalizedName)
    {
        var role = new AppRole
        {
            Id = Guid.NewGuid(),
            Name = normalizedName,
            NormalizedName = normalizedName,
            TenantId = TenantId,
            IsActive = true,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow,
        };
        db.Roles.Add(role);
        return role;
    }

    private static Permission AddPermission(AppDbContext db, string code, string name)
    {
        var p = new Permission
        {
            Id = Guid.NewGuid(),
            TenantId = SystemTenant,
            Code = code,
            Name = name,
            Module = "patient",
            Action = "view",
            ResourceType = "patient",
            Scope = "branch",
            IsActive = true,
            CreatedAt = DateTime.UtcNow.AddDays(-5),
            UpdatedAt = DateTime.UtcNow.AddDays(-5),
        };
        db.Permissions.Add(p);
        return p;
    }

    private static void LinkRole(AppDbContext db, AppUser user, AppRole role) =>
        db.UserRoles.Add(new AppUserRole { UserId = user.Id, RoleId = role.Id, IsActive = true });

    private static string FindRepoRoot()
    {
        var dir = new DirectoryInfo(AppContext.BaseDirectory);
        while (dir != null)
        {
            if (Directory.Exists(Path.Combine(dir.FullName, "microservices")))
                return dir.FullName;
            dir = dir.Parent;
        }
        throw new InvalidOperationException("Repo root not found");
    }
}
