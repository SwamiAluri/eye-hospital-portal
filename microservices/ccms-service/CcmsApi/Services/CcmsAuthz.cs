using Microsoft.Azure.Functions.Worker.Http;

namespace CcmsApi.Services;

/// <summary>
/// Shared CCMS permission gate (Phase 2 RBAC). Empty permission arrays remain
/// allowed for legacy tokens; when permissions are present, at least one must match.
/// Accepts Phase-2 aliases and legacy authorization.* codes.
/// </summary>
public static class CcmsAuthz
{
    private static readonly Dictionary<string, string[]> Equivalents = new(StringComparer.OrdinalIgnoreCase)
    {
        ["ccms.preauth.create"] = new[] { "ccms.authorization.create" },
        ["ccms.preauth.submit"] = new[] { "ccms.authorization.submit" },
        ["ccms.preauth.process"] = new[]
        {
            "ccms.authorization.record_response",
            "ccms.authorization.create",
            "ccms.authorization.submit",
        },
        ["ccms.clarification.write"] = new[]
        {
            "ccms.clarification.create",
            "ccms.clarification.respond",
        },
        ["ccms.claim.write"] = new[] { "ccms.claim.create", "ccms.claim.submit" },
        ["ccms.enhancement.write"] = new[] { "ccms.enhancement.create", "ccms.enhancement.decide" },
    };

    public static bool HasAny(JwtClaims claims, params string[] required)
    {
        var perms = claims.SafePermissions;
        if (perms.Length == 0) return true; // legacy JWT without permission claims
        if (perms.Contains("*")) return true;

        foreach (var r in required)
        {
            if (perms.Contains(r)) return true;
            if (Equivalents.TryGetValue(r, out var alts) && alts.Any(a => perms.Contains(a)))
                return true;
        }
        return false;
    }

    public static async Task<HttpResponseData?> ForbidUnlessAsync(
        HttpRequestData req, JwtClaims claims, params string[] required)
    {
        if (HasAny(claims, required)) return null;
        return await req.UnauthorizedAsync(
            $"Missing permission. Required one of: {string.Join(", ", required)}");
    }
}
