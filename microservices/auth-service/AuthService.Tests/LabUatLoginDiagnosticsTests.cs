using AuthService.Context;
using AuthService.Models.Identity;
using AuthService.Services;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.FileProviders;
using Xunit;
using Xunit.Abstractions;

namespace AuthService.Tests;

/// <summary>
/// Read-only diagnostics for Lab UAT login failures. Does not print secrets or hashes.
/// Runs against Development DB when LAB_UAT_DIAGNOSTICS=1.
/// </summary>
public class LabUatLoginDiagnosticsTests
{
    private readonly ITestOutputHelper _out;

    public LabUatLoginDiagnosticsTests(ITestOutputHelper output) => _out = output;

    [Fact]
    public async Task Diagnose_lab_uat_accounts_against_development_database()
    {
        if (!string.Equals(Environment.GetEnvironmentVariable("LAB_UAT_DIAGNOSTICS"), "1", StringComparison.Ordinal))
            return;

        var root = FindRepoRoot();
        var config = new ConfigurationBuilder()
            .SetBasePath(Path.Combine(root, "microservices", "auth-service", "AuthService"))
            .AddJsonFile("appsettings.Development.json", optional: false)
            .AddEnvironmentVariables()
            .Build();

        var cs = config.GetConnectionString("DefaultConnection")!;
        // Safe connection fingerprint only — no password
        var host = Extract(cs, "Host") ?? Extract(cs, "Server");
        var database = Extract(cs, "Database");
        _out.WriteLine($"DB host={host}; database={database}");

        var options = new DbContextOptionsBuilder<AppDbContext>()
            .UseNpgsql(cs)
            .Options;
        await using var db = new AppDbContext(options, new HttpContextAccessor());

        var tenantId = DevTenantBootstrap.IndiaEyeTenantId;
        foreach (var email in new[] { "labtech1@hospital.com", "labmgr1@hospital.com", "admin@test.com" })
        {
            await DumpUserSafeAsync(db, tenantId, email);
        }

        var passwordConfigured =
            !string.IsNullOrWhiteSpace(config["LabUatAccounts:Password"])
            || !string.IsNullOrWhiteSpace(Environment.GetEnvironmentVariable("LAB_UAT_PASSWORD"));
        _out.WriteLine($"LabUat password configured (config or LAB_UAT_PASSWORD): {passwordConfigured}");

        // Build Identity UserManager matching AuthService DI as closely as practical
        var services = new ServiceCollection();
        services.AddLogging();
        services.AddSingleton<IHttpContextAccessor, HttpContextAccessor>();
        services.AddDbContext<AppDbContext>(o => o.UseNpgsql(cs));
        services.AddIdentity<AppUser, AppRole>()
            .AddEntityFrameworkStores<AppDbContext>()
            .AddDefaultTokenProviders();
        await using var sp = services.BuildServiceProvider();
        var userManager = sp.GetRequiredService<UserManager<AppUser>>();

        var candidate = Environment.GetEnvironmentVariable("LAB_UAT_PASSWORD")
            ?? config["LabUatAccounts:Password"]
            ?? Environment.GetEnvironmentVariable("E2E_TEST_PASSWORD");

        foreach (var email in new[] { "labtech1@hospital.com", "labmgr1@hospital.com" })
        {
            var user = await userManager.Users
                .FirstOrDefaultAsync(u => u.TenantId == tenantId && u.Email == email);
            if (user == null)
            {
                _out.WriteLine($"{email}: NOT FOUND via UserManager");
                continue;
            }

            var hashExists = !string.IsNullOrWhiteSpace(user.PasswordHash);
            _out.WriteLine($"{email}: PasswordHashExists={hashExists}; HashPrefix={(hashExists ? user.PasswordHash![..Math.Min(8, user.PasswordHash.Length)] : "n/a")}");

            if (!string.IsNullOrEmpty(candidate))
            {
                var ok = await userManager.CheckPasswordAsync(user, candidate);
                _out.WriteLine($"{email}: CheckPasswordAsync(LAB_UAT/E2E candidate)={ok}");
            }
            else
            {
                _out.WriteLine($"{email}: no password candidate configured — cannot verify CheckPasswordAsync");
            }

            // Standalone PasswordHasher (what bootstrap used) vs Identity hasher
            if (!string.IsNullOrEmpty(candidate) && hashExists)
            {
                var standalone = new PasswordHasher<AppUser>();
                var standaloneResult = standalone.VerifyHashedPassword(user, user.PasswordHash!, candidate);
                _out.WriteLine($"{email}: Standalone PasswordHasher.Verify={standaloneResult}");
            }
        }
    }

    private async Task DumpUserSafeAsync(AppDbContext db, Guid tenantId, string email)
    {
        var user = await db.Users.AsNoTracking()
            .FirstOrDefaultAsync(u => u.TenantId == tenantId && u.Email != null && u.Email.ToLower() == email.ToLower());
        if (user == null)
        {
            _out.WriteLine($"{email}: MISSING");
            return;
        }

        var roles = await db.UserRoles
            .Where(ur => ur.UserId == user.Id)
            .Join(db.Roles, ur => ur.RoleId, r => r.Id, (ur, r) => new { r.Name, r.NormalizedName, ur.IsActive })
            .ToListAsync();

        _out.WriteLine(
            $"{email}: status={user.UserStatus}; activation={user.ActivationStatus}; " +
            $"emailConfirmed={user.EmailConfirmed}; lockoutEnd={user.LockoutEnd}; " +
            $"accessFailed={user.AccessFailedCount}; twoFactor={user.TwoFactorEnabled}; " +
            $"mustChangePwd={user.MustChangePasswordOnLogin}; " +
            $"passwordHashExists={!string.IsNullOrWhiteSpace(user.PasswordHash)}; " +
            $"normalizedEmail={user.NormalizedEmail}; tenant={user.TenantId}; " +
            $"roles=[{string.Join(",", roles.Select(r => $"{r.NormalizedName}:active={r.IsActive}"))}]");
    }

    private static string? Extract(string cs, string key)
    {
        foreach (var part in cs.Split(';', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries))
        {
            var i = part.IndexOf('=');
            if (i <= 0) continue;
            if (part[..i].Equals(key, StringComparison.OrdinalIgnoreCase))
                return part[(i + 1)..];
        }
        return null;
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
