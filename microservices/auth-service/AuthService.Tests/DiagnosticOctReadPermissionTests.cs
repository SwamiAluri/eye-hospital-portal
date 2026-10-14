using System.Security.Claims;
using AuthService.Context;
using AuthService.Models.Domain;
using AuthService.Models.Identity;
using AuthService.SeedData;
using AuthService.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http;
using Microsoft.EntityFrameworkCore;
using Xunit;

namespace AuthService.Tests;

public class DiagnosticOctReadPermissionTests
{
    private static readonly Guid SystemTenant = Guid.Parse("00000000-0000-0000-0000-000000000000");

    private static readonly string[] RejectedRoles =
    {
        "NURSE",
        "OT NURSE",
        "OTNURSE",
        "ANAESTHETIST",
        "ANESTHETIST",
        "IP COORDINATOR",
        "OT COORDINATOR",
        "COUNSELLOR",
        "FRONT DESK",
        "FRONTDESK",
        "CASHIER",
        "BILLING CLERK",
        "FINANCE",
        "TPA EXECUTIVE",
        "WARD CLERK",
    };

    [Fact]
    public void Catalog_matches_the_approved_permission_shape()
    {
        Assert.Equal("diagnostic.oct.read", DiagnosticOctReadPermissionCatalog.Code);
        Assert.Equal("Read OCT metadata", DiagnosticOctReadPermissionCatalog.Name);
        Assert.Equal("diagnostic", DiagnosticOctReadPermissionCatalog.Module);
        Assert.Equal("read", DiagnosticOctReadPermissionCatalog.Action);
        Assert.Equal("oct_imaging", DiagnosticOctReadPermissionCatalog.ResourceType);
        Assert.Equal("branch", DiagnosticOctReadPermissionCatalog.Scope);
        Assert.Contains("scan date", DiagnosticOctReadPermissionCatalog.Description);
        Assert.Contains("Does not authorize measurements", DiagnosticOctReadPermissionCatalog.Description);
        Assert.Contains("ADMIN", DiagnosticOctReadPermissionCatalog.ApprovedRoleNormalizedNames);
        Assert.Contains("DOCTOR", DiagnosticOctReadPermissionCatalog.ApprovedRoleNormalizedNames);
        Assert.Contains("SURGEON", DiagnosticOctReadPermissionCatalog.ApprovedRoleNormalizedNames);
        Assert.Contains("OPTOMETRIST", DiagnosticOctReadPermissionCatalog.ApprovedRoleNormalizedNames);
        Assert.Equal(4, DiagnosticOctReadPermissionCatalog.ApprovedRoleNormalizedNames.Length);
        foreach (var rejected in RejectedRoles)
            Assert.DoesNotContain(rejected, DiagnosticOctReadPermissionCatalog.ApprovedRoleNormalizedNames);
    }

    [Fact]
    public async Task Seed_grants_only_existing_approved_roles_and_is_idempotent()
    {
        await using var db = CreateDb();

        var admin = AddRole(db, "ADMIN");
        var doctor = AddRole(db, "DOCTOR");
        var surgeon = AddRole(db, "SURGEON");
        var optometrist = AddRole(db, "OPTOMETRIST");
        var inactiveAdmin = AddRole(db, "ADMIN");
        inactiveAdmin.IsActive = false;
        inactiveAdmin.Name = "Inactive Admin";
        var deletedSurgeon = AddRole(db, "SURGEON");
        deletedSurgeon.DeletedAt = DateTime.UtcNow;
        deletedSurgeon.Name = "Deleted Surgeon";

        var rejected = new Dictionary<string, AppRole>();
        foreach (var name in RejectedRoles)
            rejected[name] = AddRole(db, name);

        var vitals = AddPermission(db, "ip.vitals.read", IpVitalsReadPermissionCatalog.Description, "ip_management", "read", "vital_sign");
        var examination = AddPermission(db, "examination.view", "View examinations", "clinical", "view", "examination");
        var octUi = AddPermission(db, "DIAGNOSTIC:OCT:VIEW", "UI OCT view", "diagnostic", "view", "oct");
        var octAction = AddPermission(db, "view:oct_imaging", "UI OCT action", "diagnostic", "view", "oct");
        await db.SaveChangesAsync();
        var vitalsUpdated = vitals.UpdatedAt;
        var examinationUpdated = examination.UpdatedAt;
        var roleCount = await db.Roles.CountAsync();

        await PermissionSeeder.SeedDiagnosticOctReadPermissionsAsync(db);
        await PermissionSeeder.SeedDiagnosticOctReadPermissionsAsync(db);

        Assert.Equal(1, await db.Permissions.CountAsync(p =>
            p.TenantId == SystemTenant && p.Code == DiagnosticOctReadPermissionCatalog.Code && p.IsActive));

        var oct = await db.Permissions.SingleAsync(p => p.Code == DiagnosticOctReadPermissionCatalog.Code);
        Assert.Equal(SystemTenant, oct.TenantId);
        Assert.Equal(DiagnosticOctReadPermissionCatalog.Name, oct.Name);
        Assert.Equal(DiagnosticOctReadPermissionCatalog.Module, oct.Module);
        Assert.Equal(DiagnosticOctReadPermissionCatalog.Action, oct.Action);
        Assert.Equal(DiagnosticOctReadPermissionCatalog.ResourceType, oct.ResourceType);
        Assert.Equal(DiagnosticOctReadPermissionCatalog.Scope, oct.Scope);
        Assert.Equal(DiagnosticOctReadPermissionCatalog.Description, oct.Description);
        Assert.True(string.IsNullOrEmpty(oct.Dependencies));

        foreach (var role in new[] { admin, doctor, surgeon, optometrist })
        {
            Assert.Equal(1, await db.RolePermissions.CountAsync(rp =>
                rp.RoleId == role.Id && rp.PermissionId == oct.Id));
        }

        Assert.Equal(0, await db.RolePermissions.CountAsync(rp =>
            rp.RoleId == inactiveAdmin.Id && rp.PermissionId == oct.Id));
        Assert.Equal(0, await db.RolePermissions.CountAsync(rp =>
            rp.RoleId == deletedSurgeon.Id && rp.PermissionId == oct.Id));

        foreach (var role in rejected.Values)
        {
            Assert.Equal(0, await db.RolePermissions.CountAsync(rp =>
                rp.RoleId == role.Id && rp.PermissionId == oct.Id));
        }

        Assert.Equal(roleCount, await db.Roles.CountAsync());
        Assert.Equal(1, await db.Permissions.CountAsync(p => p.Code == "ip.vitals.read"));
        Assert.Equal(IpVitalsReadPermissionCatalog.Description, (await db.Permissions.SingleAsync(p => p.Id == vitals.Id)).Description);
        Assert.Equal(vitalsUpdated, (await db.Permissions.SingleAsync(p => p.Id == vitals.Id)).UpdatedAt);
        Assert.Equal(1, await db.Permissions.CountAsync(p => p.Code == "examination.view"));
        Assert.Equal("View examinations", (await db.Permissions.SingleAsync(p => p.Id == examination.Id)).Description);
        Assert.Equal(examinationUpdated, (await db.Permissions.SingleAsync(p => p.Id == examination.Id)).UpdatedAt);
        Assert.Equal("UI OCT view", (await db.Permissions.SingleAsync(p => p.Id == octUi.Id)).Description);
        Assert.Equal("UI OCT action", (await db.Permissions.SingleAsync(p => p.Id == octAction.Id)).Description);
    }

    [Fact]
    public async Task Seed_does_not_create_optometrist_when_the_role_is_absent()
    {
        await using var db = CreateDb();
        AddRole(db, "ADMIN");
        AddRole(db, "DOCTOR");
        AddRole(db, "SURGEON");
        await db.SaveChangesAsync();

        await PermissionSeeder.SeedDiagnosticOctReadPermissionsAsync(db);

        Assert.Equal(0, await db.Roles.CountAsync(r => r.NormalizedName == "OPTOMETRIST"));
        var oct = await db.Permissions.SingleAsync(p => p.Code == DiagnosticOctReadPermissionCatalog.Code);
        Assert.Equal(3, await db.RolePermissions.CountAsync(rp => rp.PermissionId == oct.Id));
    }

    [Fact]
    public async Task Wildcard_claim_still_satisfies_the_existing_handler()
    {
        Assert.True(await Authorize("*"));
        Assert.True(await Authorize("diagnostic.oct.read"));
        Assert.False(await Authorize("examination.view"));
        Assert.False(await Authorize("DIAGNOSTIC:OCT:VIEW"));
        Assert.False(await Authorize("view:oct_imaging"));
        Assert.False(await Authorize(""));
    }

    [Fact]
    public void Migration_and_operational_oct_routes_stay_inside_the_permission_slice()
    {
        var root = FindRepoRoot();
        var sql = File.ReadAllText(Path.Combine(root, "consolidated", "migrations", "198_diagnostic_oct_read.sql"));
        Assert.Contains("('diagnostic.oct.read', 'Read OCT metadata', 'diagnostic', 'read', 'oct_imaging', 'branch'", sql);
        Assert.Contains("('ADMIN',       'diagnostic.oct.read')", sql);
        Assert.Contains("('DOCTOR',      'diagnostic.oct.read')", sql);
        Assert.Contains("('SURGEON',     'diagnostic.oct.read')", sql);
        Assert.Contains("('OPTOMETRIST', 'diagnostic.oct.read')", sql);
        Assert.Contains("WHERE NOT EXISTS", sql);
        Assert.Contains("r.\"DeletedAt\" IS NULL", sql);
        Assert.DoesNotContain("INSERT INTO app_roles", sql);
        foreach (var rejected in RejectedRoles)
            Assert.DoesNotContain($"('{rejected}'", sql);
        Assert.DoesNotContain("examination.view", sql);
        Assert.DoesNotContain("ip.vitals.read", sql);
        Assert.DoesNotContain("DIAGNOSTIC:OCT:VIEW", sql);
        Assert.DoesNotContain("view:oct_imaging", sql);
        Assert.DoesNotContain("CLINICAL:OCT:VIEW", sql);

        var controller = File.ReadAllText(Path.Combine(
            root, "microservices", "auth-service", "AuthService", "Controllers", "OctImagingController.cs"));
        Assert.DoesNotContain("diagnostic.oct.read", controller);
        Assert.DoesNotContain("RequirePermission", controller);
    }

    private static async Task<bool> Authorize(string permission)
    {
        var requirement = new PermissionRequirement(DiagnosticOctReadPermissionCatalog.Code);
        var claims = new List<Claim>
        {
            new(ClaimTypes.NameIdentifier, Guid.NewGuid().ToString()),
            new("tenant_id", SystemTenant.ToString()),
        };
        if (!string.IsNullOrEmpty(permission))
            claims.Add(new Claim("permission", permission));
        var user = new ClaimsPrincipal(new ClaimsIdentity(claims, "test"));
        var context = new AuthorizationHandlerContext(new[] { requirement }, user, null);
        await using var db = CreateDb();
        await new PermissionAuthorizationHandler(db).HandleAsync(context);
        return context.HasSucceeded;
    }

    private static Permission AddPermission(
        AppDbContext db,
        string code,
        string description,
        string module,
        string action,
        string resource)
    {
        var permission = new Permission
        {
            Id = Guid.NewGuid(),
            TenantId = SystemTenant,
            Code = code,
            Name = code,
            Module = module,
            Action = action,
            ResourceType = resource,
            Scope = "branch",
            Description = description,
            IsSystemPermission = true,
            IsActive = true,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow,
        };
        db.Permissions.Add(permission);
        return permission;
    }

    private static AppRole AddRole(AppDbContext db, string normalizedName)
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

    private static string FindRepoRoot()
    {
        var dir = new DirectoryInfo(AppContext.BaseDirectory);
        while (dir != null)
        {
            if (Directory.Exists(Path.Combine(dir.FullName, "microservices")))
                return dir.FullName;
            dir = dir.Parent;
        }

        throw new DirectoryNotFoundException("Repository root was not found.");
    }
}
