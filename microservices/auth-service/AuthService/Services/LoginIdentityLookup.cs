using System;
using System.Linq;
using System.Threading.Tasks;
using AuthService.Models.Identity;
using Microsoft.EntityFrameworkCore;

namespace AuthService.Services
{
    /// <summary>
    /// Login looks up users by Network Hospital (tenant) + email.
    /// Branch membership is never a login eligibility check.
    /// </summary>
    public static class LoginIdentityLookup
    {
        public static string NormalizeEmail(string? email) =>
            (email ?? string.Empty).Trim().ToUpperInvariant();

        public static AppUser? FindByEmailAndTenant(
            IQueryable<AppUser> users,
            string email,
            Guid tenantId,
            Func<string?, string> normalizeEmail)
        {
            var normalized = normalizeEmail(email);
            if (string.IsNullOrEmpty(normalized))
                return null;

            return users.FirstOrDefault(u =>
                u.TenantId == tenantId &&
                u.NormalizedEmail == normalized);
        }

        public static Task<AppUser?> FindByEmailAndTenantAsync(
            IQueryable<AppUser> users,
            string email,
            Guid tenantId,
            Func<string?, string> normalizeEmail)
        {
            var normalized = normalizeEmail(email);
            if (string.IsNullOrEmpty(normalized))
                return Task.FromResult<AppUser?>(null);

            return users.FirstOrDefaultAsync(u =>
                u.TenantId == tenantId &&
                u.NormalizedEmail == normalized);
        }
    }
}
