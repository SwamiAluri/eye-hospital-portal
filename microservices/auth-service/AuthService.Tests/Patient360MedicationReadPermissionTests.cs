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

public class Patient360MedicationReadPermissionTests
{
    private static readonly Guid SystemTenant = Guid.Parse("00000000-0000-0000-0000-000000000000");

    private static readonly string[] ApprovedRoles =
    {
        "ADMIN",
        "CONSULTANT",
        "DOCTOR",
        "SENIOR DOCTOR",
        "NURSE",
        "SENIOR NURSE",
        "NURSE MANAGER",
        "SURGEON",
    };

    private static readonly string[] RejectedRoles =
    {
        "JUNIOR DOCTOR",
        "ANAESTHETIST",
        "PHARMACIST",
        "PHARMACY MANAGER",
        "PHARMACY TECHNICIAN",
        "COUNSELLOR",
        "IP COORDINATOR",
        "OT COORDINATOR",
        "RECEPTIONIST",
        "CASHIER",
        "BILLING CLERK",
        "FINANCE",
        "TPA EXECUTIVE",
        "RADIOLOGIST",
        "RADIOLOGY TECHNICIAN",
        "LAB MANAGER",
        "LAB TECHNICIAN",
        "MEDICAL RECORDS OFFICER",
        "OPTICAL MANAGER",
        "INVENTORY MANAGER",
        "INVENTORY STAFF",
        "STORE KEEPER",
        "PURCHASE MANAGER",
        "HOUSEKEEPING SUPERVISOR",
        "SECURITY OFFICER",
        "MAINTENANCE TECHNICIAN",
        "IT ADMINISTRATOR",
        "OT NURSE",
        "OTNURSE",
        "ANESTHETIST",
        "FRONT DESK",
        "FRONTDESK",
        "WARD CLERK",
        "OPTOMETRIST",
        "OPHTHALMOLOGIST",
        "SPECIALIST",
        "TECHNICIAN",
        "DIAGNOSTIC STAFF",
    };

    [Fact]
    public void Catalog_matches_the_approved_permission_shape()
    {
        Assert.Equal("patient360.medication.read", Patient360MedicationReadPermissionCatalog.Code);
        Assert.Equal("Read Patient 360 Medication History", Patient360MedicationReadPermissionCatalog.Name);
        Assert.Equal("patient360", Patient360MedicationReadPermissionCatalog.Module);
        Assert.Equal("read", Patient360MedicationReadPermissionCatalog.Action);
        Assert.Equal("medication_history", Patient360MedicationReadPermissionCatalog.ResourceType);
        Assert.Equal("tenant", Patient360MedicationReadPermissionCatalog.Scope);
        Assert.Equal(
            "Read-only Patient 360 clinical prescription history from prescription and prescription_medication, excluding financial, dispensing, inventory, notes, diagnosis, and staff identity fields.",
            Patient360MedicationReadPermissionCatalog.Description);
        Assert.Equal(ApprovedRoles, Patient360MedicationReadPermissionCatalog.ApprovedRoleNormalizedNames);
        foreach (var rejected in RejectedRoles)
            Assert.DoesNotContain(rejected, Patient360MedicationReadPermissionCatalog.ApprovedRoleNormalizedNames);
    }

    [Fact]
    public async Task Seed_grants_only_the_eight_approved_roles_and_is_idempotent()
    {
        await using var db = CreateDb();

        var approved = new Dictionary<string, AppRole>();
        foreach (var name in ApprovedRoles)
            approved[name] = AddRole(db, name);

        var inactiveAdmin = AddRole(db, "ADMIN");
        inactiveAdmin.IsActive = false;
        inactiveAdmin.Name = "Inactive Admin";
        var deletedSurgeon = AddRole(db, "SURGEON");
        deletedSurgeon.DeletedAt = DateTime.UtcNow;
        deletedSurgeon.Name = "Deleted Surgeon";
        var unnamed = AddRole(db, "UNNAMED");
        unnamed.Name = null;
        unnamed.NormalizedName = null;

        var rejected = new Dictionary<string, AppRole>();
        foreach (var name in RejectedRoles)
            rejected[name] = AddRole(db, name);

        var vitals = AddPermission(db, "ip.vitals.read", IpVitalsReadPermissionCatalog.Description, "ip_management", "read", "vital_sign", "branch");
        var oct = AddPermission(db, "diagnostic.oct.read", DiagnosticOctReadPermissionCatalog.Description, "diagnostic", "read", "oct_imaging", "branch");
        var prescriptionRead = AddPermission(db, "prescription.read", "View prescription details", "Prescriptions", "read", "prescription", "tenant");
        await db.SaveChangesAsync();
        var vitalsUpdated = vitals.UpdatedAt;
        var octUpdated = oct.UpdatedAt;
        var prescriptionUpdated = prescriptionRead.UpdatedAt;
        var roleCount = await db.Roles.CountAsync();

        await PermissionSeeder.SeedPatient360MedicationReadPermissionsAsync(db);
        await PermissionSeeder.SeedPatient360MedicationReadPermissionsAsync(db);

        Assert.Equal(1, await db.Permissions.CountAsync(p =>
            p.TenantId == SystemTenant && p.Code == Patient360MedicationReadPermissionCatalog.Code && p.IsActive));

        var permission = await db.Permissions.SingleAsync(p =>
            p.TenantId == SystemTenant && p.Code == Patient360MedicationReadPermissionCatalog.Code);
        Assert.Equal(Patient360MedicationReadPermissionCatalog.Name, permission.Name);
        Assert.Equal(Patient360MedicationReadPermissionCatalog.Module, permission.Module);
        Assert.Equal(Patient360MedicationReadPermissionCatalog.Action, permission.Action);
        Assert.Equal(Patient360MedicationReadPermissionCatalog.ResourceType, permission.ResourceType);
        Assert.Equal(Patient360MedicationReadPermissionCatalog.Scope, permission.Scope);
        Assert.Equal(Patient360MedicationReadPermissionCatalog.Description, permission.Description);
        Assert.True(string.IsNullOrEmpty(permission.Dependencies));

        foreach (var role in approved.Values)
        {
            Assert.Equal(1, await db.RolePermissions.CountAsync(rp =>
                rp.RoleId == role.Id && rp.PermissionId == permission.Id));
        }

        Assert.Equal(0, await db.RolePermissions.CountAsync(rp =>
            rp.RoleId == inactiveAdmin.Id && rp.PermissionId == permission.Id));
        Assert.Equal(0, await db.RolePermissions.CountAsync(rp =>
            rp.RoleId == deletedSurgeon.Id && rp.PermissionId == permission.Id));
        Assert.Equal(0, await db.RolePermissions.CountAsync(rp =>
            rp.RoleId == unnamed.Id && rp.PermissionId == permission.Id));

        foreach (var role in rejected.Values)
        {
            Assert.Equal(0, await db.RolePermissions.CountAsync(rp =>
                rp.RoleId == role.Id && rp.PermissionId == permission.Id));
        }

        Assert.Equal(roleCount, await db.Roles.CountAsync());
        Assert.Equal(0, await db.Permissions.CountAsync(p => p.Code == "*"));

        Assert.Equal(IpVitalsReadPermissionCatalog.Description, (await db.Permissions.SingleAsync(p => p.Id == vitals.Id)).Description);
        Assert.Equal(vitalsUpdated, (await db.Permissions.SingleAsync(p => p.Id == vitals.Id)).UpdatedAt);
        Assert.Equal(DiagnosticOctReadPermissionCatalog.Description, (await db.Permissions.SingleAsync(p => p.Id == oct.Id)).Description);
        Assert.Equal(octUpdated, (await db.Permissions.SingleAsync(p => p.Id == oct.Id)).UpdatedAt);
        Assert.Equal("View prescription details", (await db.Permissions.SingleAsync(p => p.Id == prescriptionRead.Id)).Description);
        Assert.Equal(prescriptionUpdated, (await db.Permissions.SingleAsync(p => p.Id == prescriptionRead.Id)).UpdatedAt);
        Assert.Equal(1, await db.Permissions.CountAsync(p => p.Code == "prescription.read"));
    }

    [Fact]
    public async Task Seed_does_not_create_unprovisioned_roles()
    {
        await using var db = CreateDb();
        foreach (var name in ApprovedRoles)
            AddRole(db, name);
        await db.SaveChangesAsync();
        var roleCount = await db.Roles.CountAsync();

        await PermissionSeeder.SeedPatient360MedicationReadPermissionsAsync(db);

        Assert.Equal(roleCount, await db.Roles.CountAsync());
        foreach (var name in new[] { "OPTOMETRIST", "OT NURSE", "OTNURSE", "ANESTHETIST", "FRONT DESK", "WARD CLERK", "OPHTHALMOLOGIST" })
            Assert.Equal(0, await db.Roles.CountAsync(r => r.NormalizedName == name));

        var permission = await db.Permissions.SingleAsync(p => p.Code == Patient360MedicationReadPermissionCatalog.Code);
        Assert.Equal(ApprovedRoles.Length, await db.RolePermissions.CountAsync(rp => rp.PermissionId == permission.Id));
    }

    [Fact]
    public async Task Wildcard_claim_still_satisfies_the_existing_handler_and_legacy_codes_do_not()
    {
        Assert.True(await Authorize("*"));
        Assert.True(await Authorize("patient360.medication.read"));
        Assert.False(await Authorize("prescription.read"));
        Assert.False(await Authorize("prescription.dispense"));
        Assert.False(await Authorize("patient.view"));
        Assert.False(await Authorize("medication.search"));
        Assert.False(await Authorize(""));
    }

    [Fact]
    public void Migration_stays_inside_the_permission_slice()
    {
        var root = FindRepoRoot();
        var sql = File.ReadAllText(Path.Combine(root, "consolidated", "migrations", "199_patient360_medication_read.sql"));
        Assert.Contains(
            "('patient360.medication.read', 'Read Patient 360 Medication History', 'patient360', 'read', 'medication_history', 'tenant'",
            sql);
        Assert.Contains("00000000-0000-0000-0000-000000000000", sql);
        Assert.Contains("('ADMIN',         'patient360.medication.read')", sql);
        Assert.Contains("('CONSULTANT',    'patient360.medication.read')", sql);
        Assert.Contains("('DOCTOR',        'patient360.medication.read')", sql);
        Assert.Contains("('SENIOR DOCTOR', 'patient360.medication.read')", sql);
        Assert.Contains("('NURSE',         'patient360.medication.read')", sql);
        Assert.Contains("('SENIOR NURSE',  'patient360.medication.read')", sql);
        Assert.Contains("('NURSE MANAGER', 'patient360.medication.read')", sql);
        Assert.Contains("('SURGEON',       'patient360.medication.read')", sql);
        Assert.Contains("WHERE NOT EXISTS", sql);
        Assert.Contains("r.\"DeletedAt\" IS NULL", sql);
        Assert.DoesNotContain("INSERT INTO app_roles", sql);
        Assert.DoesNotContain("'*'", sql);
        foreach (var rejected in RejectedRoles)
            Assert.DoesNotContain($"('{rejected}'", sql);
        Assert.DoesNotContain("prescription.read", sql);
        Assert.DoesNotContain("ip.vitals.read", sql);
        Assert.DoesNotContain("diagnostic.oct.read", sql);

        var prescriptions = File.ReadAllText(Path.Combine(
            root, "microservices", "auth-service", "AuthService", "Controllers", "PrescriptionsController.cs"));
        Assert.DoesNotContain("patient360.medication.read", prescriptions);
    }

    private static async Task<bool> Authorize(string permission)
    {
        var requirement = new PermissionRequirement(Patient360MedicationReadPermissionCatalog.Code);
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
        string resource,
        string scope)
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
            Scope = scope,
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
