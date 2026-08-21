using AuthService.Context;
using AuthService.Models.Domain;
using AuthService.Models.Identity;
using Microsoft.EntityFrameworkCore;

namespace AuthService.Services;

/// <summary>
/// Ensures the canonical dev tenant (India Eye Hospital Network) exists for local login.
/// </summary>
public static class DevTenantBootstrap
{
    public static readonly Guid IndiaEyeTenantId = Guid.Parse("155fe198-6ae5-4a01-9254-ead5b427247e");
    public const string IndiaEyeTenantCode = "INDIA_EYE_NET";
    public const string IndiaEyeTenantName = "India Eye Hospital Network";

    public static readonly Guid IndiaEyeAdminUserId = Guid.Parse("dddddddd-dddd-dddd-dddd-dddddddddddd");
    public static readonly Guid IndiaEyeAdminRoleId = Guid.Parse("eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee");

    public static async Task<Tenant> EnsureIndiaEyeTenantAsync(AppDbContext context)
    {
        var tenant = await context.Tenants.FindAsync(IndiaEyeTenantId);
        if (tenant == null)
        {
            tenant = new Tenant
            {
                Id = IndiaEyeTenantId,
                Name = IndiaEyeTenantName,
                TenantCode = IndiaEyeTenantCode,
                TenantType = "Hospital",
                Status = "Active",
                IsActive = true,
                Country = "India",
                PrimaryRegion = "India",
                DefaultCurrency = "INR",
                SubscriptionTier = "Professional",
                CreatedAt = DateTime.UtcNow,
                UpdatedAt = DateTime.UtcNow,
            };
            context.Tenants.Add(tenant);
            await context.SaveChangesAsync();
            Console.WriteLine($"✓ Created default login tenant: {IndiaEyeTenantName}");
        }
        else if (!string.Equals(tenant.Status, "Active", StringComparison.OrdinalIgnoreCase))
        {
            tenant.Status = "Active";
            tenant.IsActive = true;
            tenant.UpdatedAt = DateTime.UtcNow;
            await context.SaveChangesAsync();
        }

        return tenant;
    }

    public static async Task EnsureIndiaEyeAdminUserAsync(AppDbContext context)
    {
        await EnsureIndiaEyeTenantAsync(context);

        if (!await context.Users.AnyAsync(u => u.TenantId == IndiaEyeTenantId && u.Email == "admin@test.com"))
        {
            context.Users.Add(new AppUser
            {
                Id = IndiaEyeAdminUserId,
                UserName = "admin@test.com",
                NormalizedUserName = "ADMIN@TEST.COM",
                Email = "admin@test.com",
                NormalizedEmail = "ADMIN@TEST.COM",
                EmailConfirmed = true,
                PasswordHash = "AQAAAAEAACcQAAAAEJGjLkT2QH8Q2VzGv5Q2VzGv5Q2VzGv5Q2VzGv5Q2VzGv5Q==",
                SecurityStamp = Guid.NewGuid().ToString(),
                ConcurrencyStamp = Guid.NewGuid().ToString(),
                PhoneNumber = "+1234567890",
                PhoneNumberConfirmed = true,
                TenantId = IndiaEyeTenantId,
                UserType = "Admin",
                UserStatus = "active",
                MustChangePasswordOnLogin = false,
                CreatedAt = DateTime.UtcNow,
                UpdatedAt = DateTime.UtcNow,
            });
            await context.SaveChangesAsync();
            Console.WriteLine("✓ Created admin@test.com for India Eye Hospital Network");
        }

        if (!await context.Roles.AnyAsync(r => r.Id == IndiaEyeAdminRoleId))
        {
            context.Roles.Add(new AppRole
            {
                Id = IndiaEyeAdminRoleId,
                Name = "Admin",
                NormalizedName = "ADMIN",
                ConcurrencyStamp = Guid.NewGuid().ToString(),
                TenantId = IndiaEyeTenantId,
                CreatedAt = DateTime.UtcNow,
                UpdatedAt = DateTime.UtcNow,
            });
            await context.SaveChangesAsync();
        }

        if (!await context.UserRoles.AnyAsync(ur =>
                ur.UserId == IndiaEyeAdminUserId && ur.RoleId == IndiaEyeAdminRoleId))
        {
            context.UserRoles.Add(new AppUserRole
            {
                UserId = IndiaEyeAdminUserId,
                RoleId = IndiaEyeAdminRoleId,
            });
            await context.SaveChangesAsync();
        }
    }
}
