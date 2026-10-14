using System.Reflection;
using System.Security.Claims;
using AuthService.Authorization;
using AuthService.Context;
using AuthService.Controllers;
using AuthService.Models.Domain;
using AuthService.Models.Identity;
using AuthService.SeedData;
using AuthService.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http;
using Microsoft.EntityFrameworkCore;
using Xunit;

namespace AuthService.Tests;

public class PatientCreateRoleGrantTests
{
    private static readonly Guid SystemTenant = Guid.Parse("00000000-0000-0000-0000-000000000000");

    private static readonly string[] ApprovedRoles =
    {
        "ADMIN",
        "COUNSELLOR",
        "RECEPTIONIST",
        "MEDICAL RECORDS OFFICER",
        "NURSE",
        "IP COORDINATOR",
    };

    private static readonly string[] ExcludedNamedRoles =
    {
        "DOCTOR",
        "CONSULTANT",
        "SENIOR DOCTOR",
        "JUNIOR DOCTOR",
        "SURGEON",
        "ANAESTHETIST",
        "BILLING CLERK",
        "CASHIER",
        "FINANCE",
        "PHARMACIST",
        "PHARMACY MANAGER",
        "PHARMACY TECHNICIAN",
        "TPA EXECUTIVE",
        "RADIOLOGIST",
        "RADIOLOGY TECHNICIAN",
        "LAB MANAGER",
        "LAB TECHNICIAN",
        "OT COORDINATOR",
        "OPTICAL MANAGER",
        "INVENTORY MANAGER",
        "HOUSEKEEPING SUPERVISOR",
        "MAINTENANCE TECHNICIAN",
        "SECURITY OFFICER",
        "PURCHASE MANAGER",
        "IT ADMINISTRATOR",
    };

    private static readonly string[] UnnamedRoleCodes =
    {
        "OPHTHALMOLOGIST",
        "OPTOMETRIST",
        "PARAMEDIC",
        "EMT",
    };

    [Fact]
    public async Task Seed_grants_exactly_the_six_approved_roles_once_and_is_idempotent()
    {
        await using var db = CreateDb();
        var permission = AddPatientCreate(db);
        var approved = ApprovedRoles.ToDictionary(name => name, name => AddNamedRole(db, name));
        foreach (var name in ExcludedNamedRoles)
            AddNamedRole(db, name);
        foreach (var code in UnnamedRoleCodes)
            AddUnnamedRole(db, code);
        await db.SaveChangesAsync();

        await PermissionSeeder.SeedPatientCreateRoleGrantsAsync(db);
        await PermissionSeeder.SeedPatientCreateRoleGrantsAsync(db);

        var grants = await db.RolePermissions.Where(rp => rp.PermissionId == permission.Id).ToListAsync();
        Assert.Equal(ApprovedRoles.Length, grants.Count);
        foreach (var role in approved.Values)
            Assert.Equal(1, grants.Count(rp => rp.RoleId == role.Id));
        Assert.Equal(permission.UpdatedAt, (await db.Permissions.SingleAsync(p => p.Id == permission.Id)).UpdatedAt);
        Assert.Equal("Create Patients", (await db.Permissions.SingleAsync(p => p.Id == permission.Id)).Name);
        Assert.Equal("branch", (await db.Permissions.SingleAsync(p => p.Id == permission.Id)).Scope);
    }

    [Fact]
    public async Task Seed_preserves_an_existing_counsellor_grant_and_does_not_remove_other_grants()
    {
        await using var db = CreateDb();
        var permission = AddPatientCreate(db);
        var counsellor = AddNamedRole(db, "COUNSELLOR");
        var pharmacist = AddNamedRole(db, "PHARMACIST");
        var existingCounsellorGrant = new RolePermission
        {
            Id = Guid.NewGuid(),
            RoleId = counsellor.Id,
            PermissionId = permission.Id,
            CreatedAt = DateTime.UtcNow.AddDays(-2),
        };
        var unexpected = new RolePermission
        {
            Id = Guid.NewGuid(),
            RoleId = pharmacist.Id,
            PermissionId = permission.Id,
            CreatedAt = DateTime.UtcNow.AddDays(-1),
        };
        db.RolePermissions.AddRange(existingCounsellorGrant, unexpected);
        foreach (var name in ApprovedRoles.Where(name => name != "COUNSELLOR"))
            AddNamedRole(db, name);
        await db.SaveChangesAsync();

        await PermissionSeeder.SeedPatientCreateRoleGrantsAsync(db);

        var grants = await db.RolePermissions.Where(rp => rp.PermissionId == permission.Id).ToListAsync();
        Assert.Equal(ApprovedRoles.Length + 1, grants.Count);
        Assert.Equal(existingCounsellorGrant.Id, grants.Single(rp => rp.RoleId == counsellor.Id).Id);
        Assert.Contains(grants, rp => rp.Id == unexpected.Id);
    }

    [Fact]
    public async Task Seed_does_not_create_counselor_or_grant_unnamed_role_codes()
    {
        await using var db = CreateDb();
        AddPatientCreate(db);
        foreach (var name in ApprovedRoles)
            AddNamedRole(db, name);
        foreach (var code in UnnamedRoleCodes)
            AddUnnamedRole(db, code);
        await db.SaveChangesAsync();

        await PermissionSeeder.SeedPatientCreateRoleGrantsAsync(db);

        Assert.Equal(0, await db.Roles.CountAsync(r => r.NormalizedName == "COUNSELOR" || r.Name == "COUNSELOR"));
        var permission = await db.Permissions.SingleAsync(p => p.Code == "patient.create");
        var unnamedIds = await db.Roles.Where(r => r.NormalizedName == null).Select(r => r.Id).ToListAsync();
        Assert.Equal(0, await db.RolePermissions.CountAsync(rp => unnamedIds.Contains(rp.RoleId) && rp.PermissionId == permission.Id));
    }

    [Fact]
    public async Task Seed_does_not_alter_an_unrelated_permission_grant()
    {
        await using var db = CreateDb();
        AddPatientCreate(db);
        var view = new Permission
        {
            Id = Guid.NewGuid(),
            TenantId = SystemTenant,
            Code = "patient.view",
            Name = "View Patients",
            Module = "",
            Action = "View",
            ResourceType = "Patient",
            Scope = "",
            IsActive = true,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow,
        };
        var admin = AddNamedRole(db, "ADMIN");
        var viewGrant = new RolePermission
        {
            Id = Guid.NewGuid(),
            RoleId = admin.Id,
            PermissionId = view.Id,
            CreatedAt = DateTime.UtcNow.AddDays(-3),
        };
        db.Permissions.Add(view);
        db.RolePermissions.Add(viewGrant);
        await db.SaveChangesAsync();

        await PermissionSeeder.SeedPatientCreateRoleGrantsAsync(db);

        var stored = await db.RolePermissions.SingleAsync(rp => rp.Id == viewGrant.Id);
        Assert.Equal(view.Id, stored.PermissionId);
        Assert.Equal(admin.Id, stored.RoleId);
        Assert.Equal(viewGrant.CreatedAt, stored.CreatedAt);
    }

    [Fact]
    public void Create_endpoint_still_requires_patient_create_and_migration_only_links_roles()
    {
        var attribute = typeof(PatientsController).GetMethod(nameof(PatientsController.CreatePatient))!
            .GetCustomAttribute<RequirePermissionAttribute>();
        Assert.NotNull(attribute);
        Assert.Equal("patient.create", attribute!.PermissionCode);

        var sql = File.ReadAllText(Path.Combine(FindRepoRoot(), "consolidated", "migrations", "201_patient_create_role_grants.sql"));
        Assert.Contains("p.\"Code\" = 'patient.create'", sql);
        Assert.Contains("WHERE NOT EXISTS", sql);
        Assert.Contains("r.\"DeletedAt\" IS NULL", sql);
        Assert.DoesNotContain("INSERT INTO permissions", sql);
        Assert.DoesNotContain("UPDATE permissions", sql);
        Assert.DoesNotContain("INSERT INTO app_roles", sql);
        Assert.DoesNotContain("DELETE FROM role_permission", sql);
        Assert.DoesNotContain("('COUNSELOR')", sql);
        foreach (var role in ApprovedRoles)
            Assert.Contains($"('{role}')", sql);
        foreach (var excluded in ExcludedNamedRoles.Concat(UnnamedRoleCodes))
            Assert.DoesNotContain($"('{excluded}')", sql);
    }

    [Fact]
    public async Task Existing_permission_handler_still_accepts_patient_create_and_the_demo_wildcard()
    {
        Assert.True(await Authorize("patient.create"));
        Assert.True(await Authorize("*"));
        Assert.False(await Authorize("patient.view"));
    }

    private static async Task<bool> Authorize(string permission)
    {
        var requirement = new PermissionRequirement(PatientCreateRoleGrantCatalog.Code);
        var user = new ClaimsPrincipal(new ClaimsIdentity(new[]
        {
            new Claim(ClaimTypes.NameIdentifier, Guid.NewGuid().ToString()),
            new Claim("tenant_id", SystemTenant.ToString()),
            new Claim("permission", permission),
        }, "test"));
        var context = new AuthorizationHandlerContext(new[] { requirement }, user, null);
        await using var db = CreateDb();
        await new PermissionAuthorizationHandler(db).HandleAsync(context);
        return context.HasSucceeded;
    }

    private static Permission AddPatientCreate(AppDbContext db)
    {
        var permission = new Permission
        {
            Id = Guid.NewGuid(),
            TenantId = SystemTenant,
            Code = "patient.create",
            Name = "Create Patients",
            Module = "patient",
            Action = "create",
            ResourceType = "patient",
            Scope = "branch",
            Description = "Register new patients (MPI create) including counselling Add Patient registration",
            IsSystemPermission = true,
            IsActive = true,
            CreatedAt = DateTime.UtcNow.AddDays(-10),
            UpdatedAt = DateTime.UtcNow.AddDays(-10),
        };
        db.Permissions.Add(permission);
        return permission;
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

    private static AppRole AddUnnamedRole(AppDbContext db, string roleCode)
    {
        var role = new AppRole
        {
            Id = Guid.NewGuid(),
            Name = null,
            NormalizedName = null,
            RoleCode = roleCode,
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

    private static string FindRepoRoot([System.Runtime.CompilerServices.CallerFilePath] string sourceFile = "")
    {
        var dir = new DirectoryInfo(Path.GetDirectoryName(sourceFile)!);
        while (dir != null)
        {
            if (Directory.Exists(Path.Combine(dir.FullName, "microservices"))
                && Directory.Exists(Path.Combine(dir.FullName, "consolidated")))
                return dir.FullName;
            dir = dir.Parent;
        }

        throw new DirectoryNotFoundException("Repository root was not found.");
    }
}
