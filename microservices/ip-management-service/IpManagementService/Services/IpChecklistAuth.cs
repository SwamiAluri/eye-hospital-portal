using System.Security.Claims;
using Microsoft.Azure.Functions.Worker.Http;

namespace IpManagementService.Services;

/// <summary>JWT permission and role checks for ip-management checklist endpoints.</summary>
public static class IpChecklistAuth
{
    public const string PermWardEdit      = "ward.checklist.edit";
    public const string PermInvestigationEnter = "ward.investigation.enter";
    public const string PermInvestigationVerify = "ward.investigation.verify";
    public const string PermOtSign        = "ot.safety.sign";
    public const string PermPacEdit       = "anaesthesia.pac.edit";
    public const string PermMonitoringEdit = "anaesthesia.monitoring.edit";
    public const string PermCounsellorEdit = "counsellor.outpatient_checklist.edit";
    public const string PermOtOverride    = "ot.safety.override";
    public const string PermIpView        = "ip_management.view";

    public static IReadOnlyList<string> ExtractPermissions(ClaimsPrincipal principal)
        => principal.FindAll("permission").Select(c => c.Value).ToList();

    public static IReadOnlyList<string> ExtractRoles(ClaimsPrincipal principal)
        => principal.FindAll(ClaimTypes.Role).Select(c => c.Value).ToList();

    public static bool HasPermission(IReadOnlyList<string> permissions, string code)
        => permissions.Contains("*") || permissions.Contains(code);

    public static bool HasAnyRole(IReadOnlyList<string> roles, params string[] allowed)
    {
        var normalized = roles.Select(r => r.Trim()).ToHashSet(StringComparer.OrdinalIgnoreCase);
        return allowed.Any(a => normalized.Contains(a));
    }

    public static readonly HashSet<string> OtReturnRoles =
    [
        "OT Nurse", "OTNurse", "Anaesthetist", "Anesthetist", "Surgeon", "Doctor", "Admin",
    ];

    public static void RequirePermission(HttpRequestData request, JwtService jwt, string permissionCode)
    {
        var principal = jwt.ValidatePrincipal(request);
        var perms     = ExtractPermissions(principal);
        if (perms.Count > 0 && !HasPermission(perms, permissionCode))
            throw new UnauthorizedAccessException($"Missing permission: {permissionCode}");
    }

    public static void RequirePermissionOrFallback(
        HttpRequestData request, JwtService jwt, string primary, string fallback)
    {
        var principal = jwt.ValidatePrincipal(request);
        var perms     = ExtractPermissions(principal);
        if (perms.Count == 0) return;
        if (HasPermission(perms, primary) || HasPermission(perms, fallback))
            return;
        throw new UnauthorizedAccessException($"Missing permission: {primary} or {fallback}");
    }

    public static void RequireInvestigationEnter(HttpRequestData request, JwtService jwt)
        => RequirePermissionOrFallback(request, jwt, PermInvestigationEnter, PermWardEdit);

    public static void RequireInvestigationVerify(HttpRequestData request, JwtService jwt)
        => RequirePermissionOrFallback(request, jwt, PermInvestigationVerify, PermWardEdit);

    /** Ward transitions or OT staff may advance clinical state. */
    public static void RequireClinicalTransition(HttpRequestData request, JwtService jwt)
    {
        var principal = jwt.ValidatePrincipal(request);
        var perms     = ExtractPermissions(principal);
        if (perms.Count == 0) return;
        if (HasPermission(perms, PermWardEdit)
            || HasPermission(perms, PermOtSign)
            || HasPermission(perms, PermIpView))
            return;
        throw new UnauthorizedAccessException(
            "Missing permission: ward.checklist.edit or ot.safety.sign");
    }

    public static void RequireOtReturnRole(HttpRequestData request, JwtService jwt)
    {
        var principal = jwt.ValidatePrincipal(request);
        var roles     = ExtractRoles(principal);
        if (roles.Count > 0 && !HasAnyRole(roles, OtReturnRoles.ToArray()))
            throw new UnauthorizedAccessException(
                "Only OT Nurse, Anaesthetist, or Surgeon may return a patient from OT.");
    }
}
