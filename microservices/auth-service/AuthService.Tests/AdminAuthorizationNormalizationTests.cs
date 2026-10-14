using System.Security.Claims;
using AuthService.Context;
using AuthService.Models.Domain;
using AuthService.Models.Identity;
using AuthService.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http;
using Microsoft.EntityFrameworkCore;
using Xunit;

namespace AuthService.Tests;

/// <summary>
/// L0 UAT prerequisite: Admin/SuperAdmin unrestricted access is role-based wildcard "*",
/// not email-based special casing for admin@test.com.
/// </summary>
public class AdminAuthorizationNormalizationTests
{
    private static readonly Guid TenantId = Guid.Parse("155fe198-6ae5-4a01-9254-ead5b427247e");

    [Theory]
    [InlineData("ADMIN")]
    [InlineData("SUPERADMIN")]
    [InlineData("SUPER ADMIN")]
    public void Administrative_role_names_are_recognized_independent_of_email(string normalizedName)
    {
        Assert.True(PermissionService.IsUnrestrictedAdministrativeRole(normalizedName));
        Assert.True(PermissionService.IsUnrestrictedAdministrativeRole(normalizedName.ToLowerInvariant()));
    }

    [Theory]
    [InlineData("LAB TECHNICIAN")]
    [InlineData("LAB MANAGER")]
    [InlineData("DOCTOR")]
    [InlineData("COUNSELLOR")]
    [InlineData("")]
    [InlineData(null)]
    public void Ordinary_roles_are_not_unrestricted(string? normalizedName)
    {
        Assert.False(PermissionService.IsUnrestrictedAdministrativeRole(normalizedName));
    }

    [Fact]
    public async Task Admin_role_user_gets_wildcard_regardless_of_email()
    {
        await using var db = CreateDb();
        var user = AddUser(db, "any-admin@hospital.example", "active");
        var admin = AddRole(db, "ADMIN");
        LinkRole(db, user, admin);
        await db.SaveChangesAsync();

        var svc = new PermissionService(db);
        var perms = await svc.GetUserPermissionsAsync(user.Id, TenantId);

        Assert.Equal(new[] { "*" }, perms);
        Assert.True(await svc.HasPermissionAsync(user.Id, "laboratory.view", TenantId));
        Assert.True(await svc.HasPermissionAsync(user.Id, "patient.view", TenantId));
        Assert.True(await svc.HasPermissionAsync(user.Id, "patient.update", TenantId));
        Assert.True(await svc.HasPermissionAsync(user.Id, "any.other.permission", TenantId));
    }

    [Fact]
    public async Task SuperAdmin_role_user_gets_wildcard_regardless_of_email()
    {
        await using var db = CreateDb();
        var user = AddUser(db, "super@hospital.example", "active");
        var role = AddRole(db, "SUPERADMIN");
        LinkRole(db, user, role);
        await db.SaveChangesAsync();

        var svc = new PermissionService(db);
        Assert.Equal(new[] { "*" }, await svc.GetUserPermissionsAsync(user.Id, TenantId));
        Assert.True(await svc.HasPermissionAsync(user.Id, "laboratory.view", TenantId));
    }

    [Fact]
    public async Task Non_admin_user_does_not_receive_wildcard_even_with_matching_email_shape()
    {
        await using var db = CreateDb();
        // Deliberately use the former special-case email — must NOT grant * without Admin role.
        var user = AddUser(db, "admin@test.com", "active");
        var doctor = AddRole(db, "DOCTOR");
        var view = AddPermission(db, "patient.view");
        LinkRole(db, user, doctor);
        LinkPermission(db, doctor, view);
        await db.SaveChangesAsync();

        var svc = new PermissionService(db);
        var perms = await svc.GetUserPermissionsAsync(user.Id, TenantId);

        Assert.DoesNotContain("*", perms);
        Assert.Contains("patient.view", perms);
        Assert.True(await svc.HasPermissionAsync(user.Id, "patient.view", TenantId));
        Assert.False(await svc.HasPermissionAsync(user.Id, "laboratory.view", TenantId));
        Assert.False(await svc.HasPermissionAsync(user.Id, "patient.update", TenantId));
    }

    [Fact]
    public async Task PermissionService_source_has_no_email_based_admin_bypass()
    {
        var path = Path.Combine(FindRepoRoot(), "microservices", "auth-service", "AuthService", "Services", "PermissionService.cs");
        var src = await File.ReadAllTextAsync(path);
        Assert.DoesNotContain("admin@test.com", src, StringComparison.OrdinalIgnoreCase);
        Assert.DoesNotContain("TEMP OVERRIDE", src, StringComparison.OrdinalIgnoreCase);
        Assert.Contains("IsUnrestrictedAdministrativeRole", src);
        Assert.Contains("permissions.Contains(\"*\")", src);
    }

    [Fact]
    public async Task Jwt_wildcard_and_db_wildcard_paths_both_satisfy_RequirePermission()
    {
        Assert.True(await AuthorizeViaJwt("*", "laboratory.view"));
        Assert.True(await AuthorizeViaJwt("laboratory.view", "laboratory.view"));
        Assert.False(await AuthorizeViaJwt("patient.view", "laboratory.view"));

        await using var db = CreateDb();
        var user = AddUser(db, "ops@hospital.example", "active");
        var admin = AddRole(db, "ADMIN");
        LinkRole(db, user, admin);
        await db.SaveChangesAsync();

        var requirement = new PermissionRequirement("patient.update");
        var principal = new ClaimsPrincipal(new ClaimsIdentity(new[]
        {
            new Claim(ClaimTypes.NameIdentifier, user.Id.ToString()),
            new Claim("tenant_id", TenantId.ToString()),
        }, "test"));
        var context = new AuthorizationHandlerContext(new[] { requirement }, principal, null);
        await new PermissionAuthorizationHandler(db).HandleAsync(context);
        Assert.True(context.HasSucceeded);
    }

    [Fact]
    public async Task GetRolePermissions_for_Admin_returns_wildcard()
    {
        await using var db = CreateDb();
        var admin = AddRole(db, "ADMIN");
        await db.SaveChangesAsync();

        var svc = new PermissionService(db);
        Assert.Equal(new[] { "*" }, await svc.GetRolePermissionsAsync(admin.Id));
    }

    private static async Task<bool> AuthorizeViaJwt(string claimPermission, string required)
    {
        var requirement = new PermissionRequirement(required);
        var user = new ClaimsPrincipal(new ClaimsIdentity(new[]
        {
            new Claim(ClaimTypes.NameIdentifier, Guid.NewGuid().ToString()),
            new Claim("tenant_id", TenantId.ToString()),
            new Claim("permission", claimPermission),
        }, "test"));
        var context = new AuthorizationHandlerContext(new[] { requirement }, user, null);
        await using var db = CreateDb();
        await new PermissionAuthorizationHandler(db).HandleAsync(context);
        return context.HasSucceeded;
    }

    private static AppDbContext CreateDb() =>
        new(new DbContextOptionsBuilder<AppDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString("N"))
            .Options, new HttpContextAccessor());

    private static AppUser AddUser(AppDbContext db, string email, string status)
    {
        var user = new AppUser
        {
            Id = Guid.NewGuid(),
            TenantId = TenantId,
            Email = email,
            NormalizedEmail = email.ToUpperInvariant(),
            UserName = email,
            NormalizedUserName = email.ToUpperInvariant(),
            UserStatus = status,
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

    private static Permission AddPermission(AppDbContext db, string code)
    {
        var p = new Permission
        {
            Id = Guid.NewGuid(),
            TenantId = Guid.Empty,
            Code = code,
            Name = code,
            Module = "test",
            Action = "test",
            ResourceType = "test",
            Scope = "branch",
            IsActive = true,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow,
        };
        db.Permissions.Add(p);
        return p;
    }

    private static void LinkRole(AppDbContext db, AppUser user, AppRole role) =>
        db.UserRoles.Add(new AppUserRole { UserId = user.Id, RoleId = role.Id, IsActive = true });

    private static void LinkPermission(AppDbContext db, AppRole role, Permission permission) =>
        db.RolePermissions.Add(new RolePermission
        {
            Id = Guid.NewGuid(),
            RoleId = role.Id,
            PermissionId = permission.Id,
            CreatedAt = DateTime.UtcNow,
        });

    private static string FindRepoRoot()
    {
        var dir = new DirectoryInfo(AppContext.BaseDirectory);
        while (dir != null)
        {
            if (File.Exists(Path.Combine(dir.FullName, "HospitalPortal.sln"))
                || Directory.Exists(Path.Combine(dir.FullName, "microservices")))
                return dir.FullName;
            dir = dir.Parent;
        }
        throw new InvalidOperationException("Repo root not found");
    }
}
