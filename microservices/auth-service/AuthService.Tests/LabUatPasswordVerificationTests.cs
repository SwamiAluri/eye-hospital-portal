using AuthService.Context;
using AuthService.Models.Domain;
using AuthService.Models.Identity;
using AuthService.SeedData;
using AuthService.Services;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.FileProviders;
using Microsoft.Extensions.Hosting;
using Xunit;

namespace AuthService.Tests;

/// <summary>
/// Proves Lab UAT bootstrap passwords are accepted by Identity CheckPasswordAsync
/// (same verifier AuthController uses). Does not print secrets.
/// </summary>
public class LabUatPasswordVerificationTests
{
    private static readonly Guid TenantId = DevTenantBootstrap.IndiaEyeTenantId;

    [Fact]
    public void Password_resolution_prefers_config_then_env_then_admin_convention()
    {
        var previous = Environment.GetEnvironmentVariable("LAB_UAT_PASSWORD");
        try
        {
            Environment.SetEnvironmentVariable("LAB_UAT_PASSWORD", null);

            var empty = new ConfigurationBuilder().AddInMemoryCollection().Build();
            var pwd = LabUatAccountBootstrap.ResolveDevelopmentLabPassword(empty, out var source);
            Assert.Equal(DevelopmentLoginCredentials.AdminTestPassword, pwd);
            Assert.Contains("DevelopmentLoginCredentials", source);

            var withConfig = new ConfigurationBuilder()
                .AddInMemoryCollection(new Dictionary<string, string?>
                {
                    ["LabUatAccounts:Password"] = "From-Config-Not-Printed",
                })
                .Build();
            var fromConfig = LabUatAccountBootstrap.ResolveDevelopmentLabPassword(withConfig, out var src2);
            Assert.Equal("From-Config-Not-Printed", fromConfig);
            Assert.Equal("LabUatAccounts:Password", src2);

            Assert.NotEqual("password", DevelopmentLoginCredentials.AdminTestPassword);
        }
        finally
        {
            Environment.SetEnvironmentVariable("LAB_UAT_PASSWORD", previous);
        }
    }

    [Fact]
    public async Task Bootstrap_sets_password_accepted_by_UserManager_CheckPasswordAsync_for_lab_roles()
    {
        var dbName = Guid.NewGuid().ToString("N");
        var services = new ServiceCollection();
        services.AddLogging();
        services.AddSingleton<IHttpContextAccessor, HttpContextAccessor>();
        services.AddDbContext<AppDbContext>(o => o.UseInMemoryDatabase(dbName));
        services.AddIdentity<AppUser, AppRole>()
            .AddEntityFrameworkStores<AppDbContext>()
            .AddDefaultTokenProviders();

        await using var sp = services.BuildServiceProvider();
        using var scope = sp.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        var userManager = scope.ServiceProvider.GetRequiredService<UserManager<AppUser>>();

        var techRole = AddRole(db, "LAB TECHNICIAN");
        var mgrRole = AddRole(db, "LAB MANAGER");
        var tech = AddPendingUser(db, "labtech1@hospital.com");
        var mgr = AddPendingUser(db, "labmgr1@hospital.com");
        await db.SaveChangesAsync();

        var config = new ConfigurationBuilder().AddInMemoryCollection().Build();
        var env = new FakeDevEnv();
        await LabUatAccountBootstrap.EnsureLabUatAccountsAsync(db, userManager, config, env);
        await LabUatAccountBootstrap.EnsureLabUatAccountsAsync(db, userManager, config, env); // idempotent

        var reloadedTech = await userManager.Users.SingleAsync(u => u.Id == tech.Id);
        var reloadedMgr = await userManager.Users.SingleAsync(u => u.Id == mgr.Id);

        Assert.Equal("active", reloadedTech.UserStatus, ignoreCase: true);
        Assert.Equal("active", reloadedMgr.UserStatus, ignoreCase: true);
        Assert.False(string.IsNullOrWhiteSpace(reloadedTech.PasswordHash));
        Assert.False(string.IsNullOrWhiteSpace(reloadedMgr.PasswordHash));

        var password = DevelopmentLoginCredentials.AdminTestPassword;
        Assert.True(await userManager.CheckPasswordAsync(reloadedTech, password));
        Assert.True(await userManager.CheckPasswordAsync(reloadedMgr, password));
        Assert.False(await userManager.CheckPasswordAsync(reloadedTech, "password"));
        Assert.False(await userManager.CheckPasswordAsync(reloadedMgr, "password"));

        Assert.True(await db.UserRoles.AnyAsync(ur => ur.UserId == tech.Id && ur.RoleId == techRole.Id && ur.IsActive));
        Assert.True(await db.UserRoles.AnyAsync(ur => ur.UserId == mgr.Id && ur.RoleId == mgrRole.Id && ur.IsActive));
    }

    [Fact]
    public async Task Lab_roles_receive_l0_permissions_without_wildcard()
    {
        await using var db = new AppDbContext(
            new DbContextOptionsBuilder<AppDbContext>().UseInMemoryDatabase(Guid.NewGuid().ToString("N")).Options,
            new HttpContextAccessor());

        var techRole = AddRole(db, "LAB TECHNICIAN");
        var mgrRole = AddRole(db, "LAB MANAGER");
        var tech = AddPendingUser(db, "labtech1@hospital.com");
        tech.UserStatus = "active";
        Link(db, tech, techRole);
        var mgr = AddPendingUser(db, "labmgr1@hospital.com");
        mgr.UserStatus = "active";
        Link(db, mgr, mgrRole);
        await db.SaveChangesAsync();

        await PermissionSeeder.SeedLaboratoryL0UatPermissionsAsync(db);

        var svc = new PermissionService(db);
        foreach (var userId in new[] { tech.Id, mgr.Id })
        {
            var perms = await svc.GetUserPermissionsAsync(userId, TenantId);
            Assert.DoesNotContain("*", perms);
            Assert.Contains("laboratory.view", perms);
            Assert.Contains("patient.view", perms);
            Assert.Contains("patient.update", perms);
        }

        var admin = AddPendingUser(db, "other-admin@example.com");
        admin.UserStatus = "active";
        var adminRole = AddRole(db, "ADMIN");
        Link(db, admin, adminRole);
        await db.SaveChangesAsync();
        Assert.Equal(new[] { "*" }, await svc.GetUserPermissionsAsync(admin.Id, TenantId));
        Assert.True(await svc.HasPermissionAsync(admin.Id, "laboratory.view", TenantId));
    }

    private static AppRole AddRole(AppDbContext db, string normalized)
    {
        var role = new AppRole
        {
            Id = Guid.NewGuid(),
            Name = normalized,
            NormalizedName = normalized,
            TenantId = TenantId,
            IsActive = true,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow,
        };
        db.Roles.Add(role);
        return role;
    }

    private static AppUser AddPendingUser(AppDbContext db, string email)
    {
        var user = new AppUser
        {
            Id = Guid.NewGuid(),
            TenantId = TenantId,
            Email = email,
            NormalizedEmail = email.ToUpperInvariant(),
            UserName = email,
            NormalizedUserName = email.ToUpperInvariant(),
            UserStatus = "pending_invitation",
            EmailConfirmed = false,
            SecurityStamp = Guid.NewGuid().ToString(),
            ConcurrencyStamp = Guid.NewGuid().ToString(),
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow,
        };
        db.Users.Add(user);
        return user;
    }

    private static void Link(AppDbContext db, AppUser user, AppRole role) =>
        db.UserRoles.Add(new AppUserRole { UserId = user.Id, RoleId = role.Id, IsActive = true });

    private sealed class FakeDevEnv : IHostEnvironment
    {
        public string EnvironmentName { get; set; } = Environments.Development;
        public string ApplicationName { get; set; } = "tests";
        public string ContentRootPath { get; set; } = AppContext.BaseDirectory;
        public IFileProvider ContentRootFileProvider { get; set; } = new NullFileProvider();
    }
}
