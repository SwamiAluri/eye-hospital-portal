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

public class Patient360DiagnosisReadPermissionTests
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
        "JUNIOR DOCTOR",
        "ANAESTHETIST",
        "COUNSELLOR",
        "RADIOLOGIST",
        "MEDICAL RECORDS OFFICER",
    };

    private static readonly string[] RejectedRoles =
    {
        "PHARMACIST",
        "PHARMACY MANAGER",
        "PHARMACY TECHNICIAN",
        "BILLING CLERK",
        "CASHIER",
        "FINANCE",
        "TPA EXECUTIVE",
        "IP COORDINATOR",
        "OT COORDINATOR",
        "RECEPTIONIST",
        "OPTICAL MANAGER",
        "LAB MANAGER",
        "LAB TECHNICIAN",
        "RADIOLOGY TECHNICIAN",
        "INVENTORY MANAGER",
        "INVENTORY STAFF",
        "STORE KEEPER",
        "PURCHASE MANAGER",
        "HOUSEKEEPING SUPERVISOR",
        "MAINTENANCE TECHNICIAN",
        "SECURITY OFFICER",
        "IT ADMINISTRATOR",
    };

    [Fact]
    public void Catalog_matches_the_approved_permission_shape()
    {
        Assert.Equal("patient360.diagnosis.read", Patient360DiagnosisReadPermissionCatalog.Code);
        Assert.Equal("Read Patient 360 Diagnosis History", Patient360DiagnosisReadPermissionCatalog.Name);
        Assert.Equal("patient360", Patient360DiagnosisReadPermissionCatalog.Module);
        Assert.Equal("read", Patient360DiagnosisReadPermissionCatalog.Action);
        Assert.Equal("diagnosis_history", Patient360DiagnosisReadPermissionCatalog.ResourceType);
        Assert.Equal("tenant", Patient360DiagnosisReadPermissionCatalog.Scope);
        Assert.Equal(
            "Read-only Patient 360 coded diagnosis history from patient_diagnosis and diagnosis_code, excluding diagnosis notes, examination narrative, draft diagnosis, payer and financial diagnosis representations, and staff identifiers.",
            Patient360DiagnosisReadPermissionCatalog.Description);
        Assert.Equal(ApprovedRoles, Patient360DiagnosisReadPermissionCatalog.ApprovedRoleNormalizedNames);
        Assert.Equal(13, Patient360DiagnosisReadPermissionCatalog.ApprovedRoleNormalizedNames.Length);
        foreach (var rejected in RejectedRoles)
            Assert.DoesNotContain(rejected, Patient360DiagnosisReadPermissionCatalog.ApprovedRoleNormalizedNames);
    }

    [Fact]
    public async Task Seed_grants_only_the_thirteen_approved_roles_and_is_idempotent()
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

        var legacy = AddPermission(
            db,
            "clinical_documentation.diagnosis.read",
            "Read Diagnosis permission for clinical_documentation module",
            "clinical_documentation",
            "read",
            "diagnosis",
            "global");
        var medication = AddPermission(
            db,
            Patient360MedicationReadPermissionCatalog.Code,
            Patient360MedicationReadPermissionCatalog.Description,
            Patient360MedicationReadPermissionCatalog.Module,
            Patient360MedicationReadPermissionCatalog.Action,
            Patient360MedicationReadPermissionCatalog.ResourceType,
            Patient360MedicationReadPermissionCatalog.Scope);
        var vitals = AddPermission(db, "ip.vitals.read", IpVitalsReadPermissionCatalog.Description, "ip_management", "read", "vital_sign", "branch");
        var oct = AddPermission(db, "diagnostic.oct.read", DiagnosticOctReadPermissionCatalog.Description, "diagnostic", "read", "oct_imaging", "branch");
        var patientView = AddPermission(db, "patient.view", "Allows viewing patient information", "", "View", "Patient", "");
        await db.SaveChangesAsync();
        var legacyUpdated = legacy.UpdatedAt;
        var medicationUpdated = medication.UpdatedAt;
        var vitalsUpdated = vitals.UpdatedAt;
        var octUpdated = oct.UpdatedAt;
        var patientViewUpdated = patientView.UpdatedAt;
        var legacyGrants = await db.RolePermissions.CountAsync(rp => rp.PermissionId == legacy.Id);
        var roleCount = await db.Roles.CountAsync();

        await PermissionSeeder.SeedPatient360DiagnosisReadPermissionsAsync(db);
        await PermissionSeeder.SeedPatient360DiagnosisReadPermissionsAsync(db);

        Assert.Equal(1, await db.Permissions.CountAsync(p =>
            p.TenantId == SystemTenant && p.Code == Patient360DiagnosisReadPermissionCatalog.Code && p.IsActive));

        var permission = await db.Permissions.SingleAsync(p =>
            p.TenantId == SystemTenant && p.Code == Patient360DiagnosisReadPermissionCatalog.Code);
        Assert.Equal(SystemTenant, permission.TenantId);
        Assert.True(permission.IsSystemPermission);
        Assert.Equal(Patient360DiagnosisReadPermissionCatalog.Name, permission.Name);
        Assert.Equal(Patient360DiagnosisReadPermissionCatalog.Module, permission.Module);
        Assert.Equal(Patient360DiagnosisReadPermissionCatalog.Action, permission.Action);
        Assert.Equal(Patient360DiagnosisReadPermissionCatalog.ResourceType, permission.ResourceType);
        Assert.Equal(Patient360DiagnosisReadPermissionCatalog.Scope, permission.Scope);
        Assert.Equal(Patient360DiagnosisReadPermissionCatalog.Description, permission.Description);

        Assert.Equal(ApprovedRoles.Length, await db.RolePermissions.CountAsync(rp => rp.PermissionId == permission.Id));
        foreach (var role in approved.Values)
        {
            Assert.Equal(1, await db.RolePermissions.CountAsync(rp =>
                rp.RoleId == role.Id && rp.PermissionId == permission.Id));
        }

        Assert.Equal(1, await db.RolePermissions.CountAsync(rp =>
            rp.RoleId == approved["ADMIN"].Id && rp.PermissionId == permission.Id));
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
        Assert.Equal(legacyGrants, await db.RolePermissions.CountAsync(rp => rp.PermissionId == legacy.Id));

        var legacyRow = await db.Permissions.SingleAsync(p => p.Id == legacy.Id);
        Assert.Equal("clinical_documentation", legacyRow.Module);
        Assert.Equal("read", legacyRow.Action);
        Assert.Equal("diagnosis", legacyRow.ResourceType);
        Assert.Equal("global", legacyRow.Scope);
        Assert.Equal("Read Diagnosis permission for clinical_documentation module", legacyRow.Description);
        Assert.Equal(legacyUpdated, legacyRow.UpdatedAt);

        Assert.Equal(Patient360MedicationReadPermissionCatalog.Description, (await db.Permissions.SingleAsync(p => p.Id == medication.Id)).Description);
        Assert.Equal(medicationUpdated, (await db.Permissions.SingleAsync(p => p.Id == medication.Id)).UpdatedAt);
        Assert.Equal(IpVitalsReadPermissionCatalog.Description, (await db.Permissions.SingleAsync(p => p.Id == vitals.Id)).Description);
        Assert.Equal(vitalsUpdated, (await db.Permissions.SingleAsync(p => p.Id == vitals.Id)).UpdatedAt);
        Assert.Equal(DiagnosticOctReadPermissionCatalog.Description, (await db.Permissions.SingleAsync(p => p.Id == oct.Id)).Description);
        Assert.Equal(octUpdated, (await db.Permissions.SingleAsync(p => p.Id == oct.Id)).UpdatedAt);
        Assert.Equal(patientViewUpdated, (await db.Permissions.SingleAsync(p => p.Id == patientView.Id)).UpdatedAt);
        Assert.Equal(1, await db.Permissions.CountAsync(p => p.Code == "clinical_documentation.diagnosis.read"));
        Assert.Equal(1, await db.Permissions.CountAsync(p => p.Code == "patient360.medication.read"));
        Assert.Equal(1, await db.Permissions.CountAsync(p => p.Code == "ip.vitals.read"));
        Assert.Equal(1, await db.Permissions.CountAsync(p => p.Code == "diagnostic.oct.read"));
    }

    [Fact]
    public async Task Seed_does_not_create_missing_roles()
    {
        await using var db = CreateDb();
        foreach (var name in ApprovedRoles.Where(name => name != "JUNIOR DOCTOR"))
            AddRole(db, name);
        await db.SaveChangesAsync();
        var roleCount = await db.Roles.CountAsync();

        await PermissionSeeder.SeedPatient360DiagnosisReadPermissionsAsync(db);

        Assert.Equal(roleCount, await db.Roles.CountAsync());
        Assert.Equal(0, await db.Roles.CountAsync(r => r.NormalizedName == "JUNIOR DOCTOR"));
        var permission = await db.Permissions.SingleAsync(p => p.Code == Patient360DiagnosisReadPermissionCatalog.Code);
        Assert.Equal(ApprovedRoles.Length - 1, await db.RolePermissions.CountAsync(rp => rp.PermissionId == permission.Id));
    }

    [Fact]
    public async Task Wildcard_claim_still_satisfies_the_existing_handler_and_legacy_codes_do_not()
    {
        Assert.True(await Authorize("*"));
        Assert.True(await Authorize("patient360.diagnosis.read"));
        Assert.False(await Authorize("clinical_documentation.diagnosis.read"));
        Assert.False(await Authorize("patient.view"));
        Assert.False(await Authorize("patient360.medication.read"));
        Assert.False(await Authorize(""));
    }

    [Fact]
    public void Migration_stays_inside_the_permission_slice()
    {
        var root = FindRepoRoot();
        var sql = File.ReadAllText(Path.Combine(root, "consolidated", "migrations", "200_patient360_diagnosis_read.sql"));
        Assert.Contains(
            "('patient360.diagnosis.read', 'Read Patient 360 Diagnosis History', 'patient360', 'read', 'diagnosis_history', 'tenant'",
            sql);
        Assert.Contains("00000000-0000-0000-0000-000000000000", sql);
        Assert.Contains("WHERE NOT EXISTS", sql);
        Assert.Contains("r.\"DeletedAt\" IS NULL", sql);
        Assert.DoesNotContain("INSERT INTO app_roles", sql);
        Assert.DoesNotContain("'*'", sql);
        foreach (var role in ApprovedRoles)
            Assert.Contains($"('{role}',", sql);
        Assert.Equal(13, ApprovedRoles.Count(role => sql.Contains($"('{role}',", StringComparison.Ordinal)));
        foreach (var rejected in RejectedRoles)
            Assert.DoesNotContain($"('{rejected}',", sql);
        Assert.DoesNotContain("clinical_documentation.diagnosis.read", sql);
        Assert.DoesNotContain("patient360.medication.read", sql);
        Assert.DoesNotContain("ip.vitals.read", sql);
        Assert.DoesNotContain("diagnostic.oct.read", sql);
        Assert.DoesNotContain("patient.view", sql);

        var medicationSql = File.ReadAllText(Path.Combine(root, "consolidated", "migrations", "199_patient360_medication_read.sql"));
        Assert.DoesNotContain("patient360.diagnosis.read", medicationSql);

        var diagnoses = File.ReadAllText(Path.Combine(
            root, "microservices", "auth-service", "AuthService", "Controllers", "DiagnosesController.cs"));
        Assert.DoesNotContain("patient360.diagnosis.read", diagnoses);
        Assert.Contains("[HttpGet(\"patient/{patientId}\")]", diagnoses);

        var clinical = File.ReadAllText(Path.Combine(
            root, "apps", "hospital-portal-web", "src", "components", "patients", "record", "Patient360Clinical.tsx"));
        Assert.DoesNotContain("patient360.diagnosis.read", clinical);
    }

    private static async Task<bool> Authorize(string permission)
    {
        var requirement = new PermissionRequirement(Patient360DiagnosisReadPermissionCatalog.Code);
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

    private static string FindRepoRoot([System.Runtime.CompilerServices.CallerFilePath] string sourceFile = "")
    {
        var starts = new[] { AppContext.BaseDirectory, Path.GetDirectoryName(sourceFile) };
        foreach (var start in starts)
        {
            if (string.IsNullOrEmpty(start)) continue;
            var dir = new DirectoryInfo(start);
            while (dir != null)
            {
                if (Directory.Exists(Path.Combine(dir.FullName, "microservices"))
                    && Directory.Exists(Path.Combine(dir.FullName, "consolidated")))
                    return dir.FullName;
                dir = dir.Parent;
            }
        }

        throw new DirectoryNotFoundException("Repository root was not found.");
    }
}
