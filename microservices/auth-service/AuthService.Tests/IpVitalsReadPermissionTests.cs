using AuthService.Context;
using AuthService.Models.Domain;
using AuthService.Models.Identity;
using AuthService.SeedData;
using Microsoft.AspNetCore.Http;
using Microsoft.EntityFrameworkCore;
using Xunit;

namespace AuthService.Tests;

public class IpVitalsReadPermissionTests
{
    private static readonly Guid SystemTenant = Guid.Parse("00000000-0000-0000-0000-000000000000");

    private static readonly string[] RejectedRoles =
    {
        "CASHIER",
        "BILLING CLERK",
        "FINANCE",
        "TPA EXECUTIVE",
        "COUNSELLOR",
        "FRONT DESK",
        "DOCTOR",
        "ANAESTHETIST",
        "SURGEON",
        "IP COORDINATOR",
        "OT COORDINATOR",
        "WARD CLERK",
    };

    [Fact]
    public void Catalog_matches_the_approved_permission_shape()
    {
        Assert.Equal("ip.vitals.read", IpVitalsReadPermissionCatalog.Code);
        Assert.Equal("ip_management", IpVitalsReadPermissionCatalog.Module);
        Assert.Equal("read", IpVitalsReadPermissionCatalog.Action);
        Assert.Equal("vital_sign", IpVitalsReadPermissionCatalog.ResourceType);
        Assert.Equal("branch", IpVitalsReadPermissionCatalog.Scope);
        Assert.Contains("NURSE", IpVitalsReadPermissionCatalog.ApprovedRoleNormalizedNames);
        Assert.Contains("OT NURSE", IpVitalsReadPermissionCatalog.ApprovedRoleNormalizedNames);
        Assert.Contains("OTNURSE", IpVitalsReadPermissionCatalog.ApprovedRoleNormalizedNames);
        Assert.Contains("ADMIN", IpVitalsReadPermissionCatalog.ApprovedRoleNormalizedNames);
        Assert.Equal(4, IpVitalsReadPermissionCatalog.ApprovedRoleNormalizedNames.Length);
        foreach (var rejected in RejectedRoles)
            Assert.DoesNotContain(rejected, IpVitalsReadPermissionCatalog.ApprovedRoleNormalizedNames);
    }

    [Fact]
    public async Task Seed_inserts_permission_once_and_grants_only_approved_roles()
    {
        await using var db = CreateDb();

        var approved = new Dictionary<string, AppRole>();
        foreach (var name in IpVitalsReadPermissionCatalog.ApprovedRoleNormalizedNames)
            approved[name] = AddRole(db, name);

        var rejected = new Dictionary<string, AppRole>();
        foreach (var name in RejectedRoles)
            rejected[name] = AddRole(db, name);

        var inactiveNurse = AddRole(db, "NURSE");
        inactiveNurse.IsActive = false;
        inactiveNurse.Name = "Inactive Nurse";

        var view = new Permission
        {
            Id = Guid.NewGuid(),
            TenantId = SystemTenant,
            Code = "ip.view",
            Name = "View IP Patients",
            Module = "ip_management",
            Action = "view",
            ResourceType = "patient_journey",
            Scope = "branch",
            Description = "View the inpatient census and patient journeys",
            IsSystemPermission = true,
            IsActive = true,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow,
        };
        db.Permissions.Add(view);
        db.RolePermissions.Add(new RolePermission
        {
            Id = Guid.NewGuid(),
            RoleId = rejected["CASHIER"].Id,
            PermissionId = view.Id,
            CreatedAt = DateTime.UtcNow,
        });
        await db.SaveChangesAsync();

        await PermissionSeeder.SeedIpVitalsReadPermissionsAsync(db);
        await PermissionSeeder.SeedIpVitalsReadPermissionsAsync(db);

        Assert.Equal(1, await db.Permissions.CountAsync(p =>
            p.TenantId == SystemTenant && p.Code == IpVitalsReadPermissionCatalog.Code));
        Assert.Equal(1, await db.Permissions.CountAsync(p => p.Code == "ip.view"));

        var vitals = await db.Permissions.SingleAsync(p => p.Code == IpVitalsReadPermissionCatalog.Code);
        Assert.Equal(IpVitalsReadPermissionCatalog.Module, vitals.Module);
        Assert.Equal(IpVitalsReadPermissionCatalog.Action, vitals.Action);
        Assert.Equal(IpVitalsReadPermissionCatalog.ResourceType, vitals.ResourceType);
        Assert.Equal(IpVitalsReadPermissionCatalog.Scope, vitals.Scope);
        Assert.Equal(IpVitalsReadPermissionCatalog.Description, vitals.Description);

        foreach (var role in approved.Values)
        {
            Assert.Equal(1, await db.RolePermissions.CountAsync(rp =>
                rp.RoleId == role.Id && rp.PermissionId == vitals.Id));
        }

        Assert.Equal(0, await db.RolePermissions.CountAsync(rp =>
            rp.RoleId == inactiveNurse.Id && rp.PermissionId == vitals.Id));

        foreach (var role in rejected.Values)
        {
            Assert.Equal(0, await db.RolePermissions.CountAsync(rp =>
                rp.RoleId == role.Id && rp.PermissionId == vitals.Id));
        }

        Assert.Equal(1, await db.RolePermissions.CountAsync(rp =>
            rp.RoleId == rejected["CASHIER"].Id && rp.PermissionId == view.Id));
        Assert.Equal(1, await db.RolePermissions.CountAsync(rp => rp.RoleId == rejected["CASHIER"].Id));
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
}
