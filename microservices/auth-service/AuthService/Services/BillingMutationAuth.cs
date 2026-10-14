using System.Security.Claims;
using AuthService.Context;
using Microsoft.AspNetCore.Http;

namespace AuthService.Services;

/// <summary>
/// Service-layer billing authorization. HTTP JWT users are fail-closed.
/// Internal/API-key and unit-test calls (no authenticated principal) are skipped.
/// </summary>
public static class BillingMutationAuth
{
    public static bool ShouldEnforce(ClaimsPrincipal? user)
        => user?.Identity?.IsAuthenticated == true;

    public static bool HasJwtPermission(ClaimsPrincipal? user, params string[] codes)
    {
        if (user is null) return false;
        var perms = user.FindAll("permission").Select(c => c.Value).ToHashSet(StringComparer.OrdinalIgnoreCase);
        if (perms.Contains("*")) return true;
        return codes.Any(c => perms.Contains(c));
    }

    public static async Task RequireAsync(
        IHttpContextAccessor? http,
        AppDbContext db,
        params string[] codes)
    {
        var user = http?.HttpContext?.User;
        if (!ShouldEnforce(user)) return;
        if (HasJwtPermission(user, codes)) return;

        var userIdClaim = user!.FindFirst(ClaimTypes.NameIdentifier)?.Value
            ?? user.FindFirst("sub")?.Value;
        var tenantIdClaim = user.FindFirst("tenant_id")?.Value;
        if (Guid.TryParse(userIdClaim, out var userId)
            && Guid.TryParse(tenantIdClaim, out var tenantId)
            && userId != Guid.Empty
            && tenantId != Guid.Empty)
        {
            var permissionService = new PermissionService(db);
            foreach (var code in codes)
            {
                if (await permissionService.HasPermissionAsync(userId, code, tenantId))
                    return;
            }
        }

        throw new UnauthorizedAccessException($"Missing permission: {string.Join(" or ", codes)}");
    }

    /// <summary>
    /// Requires every named permission. Unlike <see cref="RequireAsync"/>, a missing
    /// authenticated principal is rejected. Wildcard <c>permission=*</c> satisfies each code.
    /// </summary>
    public static async Task RequireAllAsync(
        ClaimsPrincipal? user,
        AppDbContext? db,
        params string[] codes)
    {
        if (!ShouldEnforce(user))
            throw new UnauthorizedAccessException("Authentication required.");

        var userIdClaim = user!.FindFirst(ClaimTypes.NameIdentifier)?.Value
            ?? user.FindFirst("sub")?.Value;
        var tenantIdClaim = user.FindFirst("tenant_id")?.Value;
        Guid userId = Guid.Empty;
        Guid tenantId = Guid.Empty;
        var canCheckDatabase = db != null
            && Guid.TryParse(userIdClaim, out userId)
            && Guid.TryParse(tenantIdClaim, out tenantId)
            && userId != Guid.Empty
            && tenantId != Guid.Empty;

        foreach (var code in codes)
        {
            if (HasJwtPermission(user, code))
                continue;

            var granted = false;
            if (canCheckDatabase)
            {
                var permissionService = new PermissionService(db!);
                granted = await permissionService.HasPermissionAsync(userId, code, tenantId);
            }

            if (!granted)
                throw new UnauthorizedAccessException($"Missing permission: {code}");
        }
    }
}
