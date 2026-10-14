using AuthService.Context;
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
/// Optional live Development DB apply. Runs only when APPLY_LAB_UAT_PREREQ=1.
/// Does not print credentials. Password comes from LAB_UAT_PASSWORD / LabUatAccounts:Password.
/// </summary>
public class ApplyLabUatPrereqLiveDbTests
{
    [Fact]
    public async Task Apply_laboratory_l0_uat_prerequisites_to_development_database_when_flag_set()
    {
        if (!string.Equals(
                Environment.GetEnvironmentVariable("APPLY_LAB_UAT_PREREQ"),
                "1",
                StringComparison.Ordinal))
        {
            return;
        }

        var root = FindRepoRoot();
        var config = new ConfigurationBuilder()
            .SetBasePath(Path.Combine(root, "microservices", "auth-service", "AuthService"))
            .AddJsonFile("appsettings.Development.json", optional: false)
            .AddEnvironmentVariables()
            .Build();

        var cs = config.GetConnectionString("DefaultConnection");
        Assert.False(string.IsNullOrWhiteSpace(cs));

        var options = new DbContextOptionsBuilder<AppDbContext>()
            .UseNpgsql(cs)
            .Options;

        await using var db = new AppDbContext(options, new HttpContextAccessor());
        await PermissionSeeder.SeedLaboratoryL0UatPermissionsAsync(db);

        var services = new ServiceCollection();
        services.AddLogging();
        services.AddSingleton<IHttpContextAccessor, HttpContextAccessor>();
        services.AddDbContext<AppDbContext>(o => o.UseNpgsql(cs));
        services.AddIdentity<AppUser, AppRole>()
            .AddEntityFrameworkStores<AppDbContext>()
            .AddDefaultTokenProviders();
        await using var sp = services.BuildServiceProvider();
        using var scope = sp.CreateScope();
        var scopedDb = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        var userManager = scope.ServiceProvider.GetRequiredService<UserManager<AppUser>>();

        var env = new FakeDevelopmentHostEnvironment();
        await LabUatAccountBootstrap.EnsureLabUatAccountsAsync(scopedDb, userManager, config, env);

        var tech = await db.Users.AsNoTracking()
            .FirstOrDefaultAsync(u => u.Email == "labtech1@hospital.com");
        var mgr = await db.Users.AsNoTracking()
            .FirstOrDefaultAsync(u => u.Email == "labmgr1@hospital.com");

        Assert.NotNull(tech);
        Assert.NotNull(mgr);
        Assert.Equal("active", tech!.UserStatus, ignoreCase: true);
        Assert.Equal("active", mgr!.UserStatus, ignoreCase: true);

        Assert.True(await db.Permissions.AnyAsync(p => p.Code == "laboratory.view" && p.IsActive));
        Assert.True(await db.Permissions.AnyAsync(p => p.Code == "patient.update" && p.IsActive));
        Assert.True(await db.Permissions.AnyAsync(p => p.Code == "patient.view" && p.IsActive));
    }

    private sealed class FakeDevelopmentHostEnvironment : IHostEnvironment
    {
        public string EnvironmentName { get; set; } = Environments.Development;
        public string ApplicationName { get; set; } = "AuthService.Tests";
        public string ContentRootPath { get; set; } = AppContext.BaseDirectory;
        public IFileProvider ContentRootFileProvider { get; set; } = new NullFileProvider();
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
        throw new InvalidOperationException("Repo root not found");
    }
}
