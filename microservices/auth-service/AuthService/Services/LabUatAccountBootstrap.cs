using AuthService.Context;
using AuthService.Models.Identity;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Hosting;

namespace AuthService.Services;

/// <summary>
/// Development/UAT only: activate existing pending Lab Technician / Lab Manager
/// invitation accounts and set a password compatible with Identity CheckPasswordAsync.
/// Does not create clinical data, new roles, or production users.
/// </summary>
public static class LabUatAccountBootstrap
{
    public static readonly string[] PreferredLabTechnicianEmails =
    {
        "labtech1@hospital.com",
    };

    public static readonly string[] PreferredLabManagerEmails =
    {
        "labmgr1@hospital.com",
    };

    public static async Task EnsureLabUatAccountsAsync(
        AppDbContext context,
        UserManager<AppUser> userManager,
        IConfiguration configuration,
        IHostEnvironment environment)
    {
        if (!environment.IsDevelopment())
        {
            Console.WriteLine("⏭ Lab UAT account bootstrap skipped (not Development)");
            return;
        }

        var password = ResolveDevelopmentLabPassword(configuration, out var passwordSource);
        if (string.IsNullOrWhiteSpace(password))
        {
            Console.WriteLine(
                "⚠ Lab UAT bootstrap skipped password set — configure LabUatAccounts:Password or LAB_UAT_PASSWORD");
        }
        else
        {
            Console.WriteLine($"✓ Lab UAT password source: {passwordSource}");
        }

        await EnsureIndiaEyeLabAccountsAsync(
            context,
            userManager,
            password,
            PreferredLabTechnicianEmails,
            "LAB TECHNICIAN");

        await EnsureIndiaEyeLabAccountsAsync(
            context,
            userManager,
            password,
            PreferredLabManagerEmails,
            "LAB MANAGER");
    }

    /// <summary>
    /// Resolution order (Development):
    /// 1. LabUatAccounts:Password
    /// 2. LAB_UAT_PASSWORD
    /// 3. Existing admin@test.com Development login convention (login form default)
    /// Literal string "password" is never implied.
    /// </summary>
    public static string? ResolveDevelopmentLabPassword(
        IConfiguration configuration,
        out string source)
    {
        var fromConfig = configuration["LabUatAccounts:Password"];
        if (!string.IsNullOrWhiteSpace(fromConfig))
        {
            source = "LabUatAccounts:Password";
            return fromConfig;
        }

        var fromEnv = Environment.GetEnvironmentVariable("LAB_UAT_PASSWORD");
        if (!string.IsNullOrWhiteSpace(fromEnv))
        {
            source = "LAB_UAT_PASSWORD";
            return fromEnv;
        }

        // Align with AuthController admin@test.com demo + FE login default — already in repo.
        var useConvention = configuration.GetValue("LabUatAccounts:UseDevelopmentLoginPasswordConvention", true);
        if (useConvention)
        {
            source = "DevelopmentLoginCredentials.AdminTestPassword (same as admin@test.com / login form default)";
            return DevelopmentLoginCredentials.AdminTestPassword;
        }

        source = "none";
        return null;
    }

    private static async Task EnsureIndiaEyeLabAccountsAsync(
        AppDbContext context,
        UserManager<AppUser> userManager,
        string? password,
        IReadOnlyList<string> preferredEmails,
        string roleNormalizedName)
    {
        var tenantId = DevTenantBootstrap.IndiaEyeTenantId;
        var roles = await context.Roles
            .Where(r => r.TenantId == tenantId && r.IsActive && r.DeletedAt == null)
            .ToListAsync();
        var role = roles.FirstOrDefault(r =>
            string.Equals(
                (r.NormalizedName ?? r.Name ?? string.Empty).Trim(),
                roleNormalizedName,
                StringComparison.OrdinalIgnoreCase));

        if (role == null)
        {
            Console.WriteLine($"⚠ Lab UAT: role {roleNormalizedName} not found — skipped");
            return;
        }

        AppUser? user = null;
        foreach (var email in preferredEmails)
        {
            user = await userManager.Users
                .FirstOrDefaultAsync(u =>
                    u.TenantId == tenantId
                    && u.NormalizedEmail == userManager.NormalizeEmail(email));
            if (user != null) break;
        }

        if (user == null)
        {
            Console.WriteLine($"⚠ Lab UAT: no existing {roleNormalizedName} invitation user to activate — skipped");
            return;
        }

        var changed = false;
        if (!string.Equals(user.UserStatus, "active", StringComparison.OrdinalIgnoreCase))
        {
            user.UserStatus = "active";
            changed = true;
        }

        if (!user.EmailConfirmed)
        {
            user.EmailConfirmed = true;
            changed = true;
        }

        if (!string.Equals(user.ActivationStatus, "active", StringComparison.OrdinalIgnoreCase))
        {
            user.ActivationStatus = "active";
            changed = true;
        }

        user.MustChangePasswordOnLogin = false;
        user.LockoutEnd = null;
        user.AccessFailedCount = 0;
        user.UpdatedAt = DateTime.UtcNow;

        if (!await context.UserRoles.AnyAsync(ur => ur.UserId == user.Id && ur.RoleId == role.Id))
        {
            context.UserRoles.Add(new AppUserRole
            {
                UserId = user.Id,
                RoleId = role.Id,
                IsActive = true,
                AssignedAt = DateTime.UtcNow,
            });
            changed = true;
        }
        else
        {
            var ur = await context.UserRoles.FirstAsync(x => x.UserId == user.Id && x.RoleId == role.Id);
            if (!ur.IsActive)
            {
                ur.IsActive = true;
                changed = true;
            }
        }

        if (!string.IsNullOrWhiteSpace(password))
        {
            // Use the same Identity PasswordHasher instance UserManager.CheckPasswordAsync uses.
            user.PasswordHash = userManager.PasswordHasher.HashPassword(user, password);
            user.SecurityStamp = Guid.NewGuid().ToString();
            changed = true;
            Console.WriteLine($"✓ Lab UAT account ready: {user.Email} ({roleNormalizedName}) [Identity PasswordHasher]");
        }
        else
        {
            Console.WriteLine(
                $"⚠ Lab UAT account status activated for {user.Email} but password not set");
        }

        if (changed)
        {
            var update = await userManager.UpdateAsync(user);
            if (!update.Succeeded)
            {
                // Fallback to DbContext if Identity update fails (e.g. stamp concurrency)
                await context.SaveChangesAsync();
            }
            else if (context.ChangeTracker.HasChanges())
            {
                await context.SaveChangesAsync();
            }
        }
        else
        {
            Console.WriteLine($"✓ Lab UAT account already ready: {user.Email} ({roleNormalizedName})");
        }
    }
}
