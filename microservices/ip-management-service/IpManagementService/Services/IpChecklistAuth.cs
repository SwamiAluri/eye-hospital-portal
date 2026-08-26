using IpManagementService.Models.Domain;
using System.Security.Claims;
using Microsoft.Azure.Functions.Worker.Http;

namespace IpManagementService.Services;

/// <summary>JWT permission and role checks for ip-management checklist endpoints.</summary>
public static class IpChecklistAuth
{
    public const string PermWardEdit = "ward.checklist.edit";
    public const string PermInvestigationEnter = "ward.investigation.enter";
    public const string PermInvestigationVerify = "ward.investigation.verify";
    public const string PermOtSign = "ot.safety.sign";
    public const string PermPacEdit = "anaesthesia.pac.edit";
    public const string PermMonitoringEdit = "anaesthesia.monitoring.edit";
    public const string PermCounsellorEdit = "counsellor.outpatient_checklist.edit";
    public const string PermOtOverride = "ot.safety.override";
    public const string PermClinicalEvalSign = "ward.clinical_evaluation.sign";
    public const string PermIpView = "ip_management.view";
    public const string PermEmergencyFc = "ip.emergency_fc.apply";
    public const string PermDischargeCancel = "ip.discharge.cancel";

    public const string PermAdmit = "ip.admit";
    public const string PermBedTransfer = "ip.bed.transfer";
    public const string PermReadyForOt = "ip.ot.mark_ready";
    public const string PermUnmarkReady = "ip.ot.unmark_ready";
    public const string PermSendToOt = "ip.ot.send";
    public const string PermAcceptOt = "ip.ot.accept";
    public const string PermSurgeryStart = "ip.surgery.start";
    public const string PermSurgeryComplete = "ip.surgery.complete";
    public const string PermDischarge = "ip.discharge";
    public const string PermPostOpManage = "ip.postop.manage";
    public const string PermDischargeOverride = "ip.discharge.override";
    public const string PermImplantMismatchOverride = "ip.implant.mismatch.override";
    public const string PermSafetyTokenPrint = "ip.safety_token.print";
    public const string PermIntegrationAdmin = "integration.admin";
    public const string PermBillingCollect = "ip.billing.collect";
    public const string PermBillingRefund = "ip.billing.refund";
    public const string PermBillingAdjust = "ip.billing.adjust";
    public const string PermBillUpdate = "bill.update";
    public const string PermOpdBillRefund = "opd_bill.refund";

    public static IReadOnlyList<string> ExtractPermissions(ClaimsPrincipal principal)
        => principal.FindAll("permission").Select(c => c.Value).ToList();

    public static IReadOnlyList<string> ExtractRoles(ClaimsPrincipal principal)
        => principal.FindAll(ClaimTypes.Role).Select(c => c.Value).ToList();

    public static bool HasPermission(IReadOnlyList<string> permissions, string code)
        => permissions.Contains("*") || permissions.Contains(code);

    public static bool HasAnyPermission(IReadOnlyList<string> permissions, params string[] codes)
        => codes.Any(c => HasPermission(permissions, c));

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
        var perms = ExtractPermissions(principal);
        if (perms.Count == 0 || !HasPermission(perms, permissionCode))
            throw new UnauthorizedAccessException($"Missing permission: {permissionCode}");
    }

    public static void RequirePermissionOrFallback(
        HttpRequestData request, JwtService jwt, string primary, string fallback)
    {
        var principal = jwt.ValidatePrincipal(request);
        var perms = ExtractPermissions(principal);
        if (HasPermission(perms, primary) || HasPermission(perms, fallback))
            return;
        throw new UnauthorizedAccessException($"Missing permission: {primary} or {fallback}");
    }

    public static void RequireInvestigationEnter(HttpRequestData request, JwtService jwt)
        => RequirePermissionOrFallback(request, jwt, PermInvestigationEnter, PermWardEdit);

    public static void RequireInvestigationVerify(HttpRequestData request, JwtService jwt)
        => RequirePermissionOrFallback(request, jwt, PermInvestigationVerify, PermWardEdit);

    public static void RequireImplantRecord(HttpRequestData request, JwtService jwt)
        => RequireAnyPermission(request, jwt, PermOtSign, PermSurgeryComplete);

    /// <summary>Wristband print. Fail-closed: no fallback to ward.checklist.edit.</summary>
    public static void RequireSafetyTokenPrint(HttpRequestData request, JwtService jwt)
    {
        var principal = jwt.ValidatePrincipal(request);
        var perms = ExtractPermissions(principal);
        if (!HasPermission(perms, PermSafetyTokenPrint))
            throw new UnauthorizedAccessException($"Missing permission: {PermSafetyTokenPrint}");
    }

    /// <summary>Eyedrop taper write. Fail-closed: no fallback to ward.checklist.edit.</summary>
    public static void RequirePostOpManage(HttpRequestData request, JwtService jwt)
    {
        var principal = jwt.ValidatePrincipal(request);
        var perms = ExtractPermissions(principal);
        if (!HasPermission(perms, PermPostOpManage))
            throw new UnauthorizedAccessException($"Missing permission: {PermPostOpManage}");
    }

    public static void RequireAnyPermission(HttpRequestData request, JwtService jwt, params string[] codes)
    {
        var principal = jwt.ValidatePrincipal(request);
        var perms = ExtractPermissions(principal);
        if (HasAnyPermission(perms, codes))
            return;
        throw new UnauthorizedAccessException($"Missing permission: {string.Join(" or ", codes)}");
    }

    /// <summary>View must not mutate. Ward edit or OT sign still satisfy matching actions.</summary>
    public static void RequireClinicalTransition(HttpRequestData request, JwtService jwt)
        => RequireAnyPermission(request, jwt, PermWardEdit, PermOtSign);

    public static bool AllowsClinicalTransition(
        IReadOnlyList<string> permissions, string fromState, string newState)
    {
        if (UnmarkReadyRules.IsUnmarkReady(fromState, newState))
            return HasPermission(permissions, PermUnmarkReady);
        return AllowsClinicalTransition(permissions, newState);
    }

    public static bool AllowsClinicalTransition(IReadOnlyList<string> permissions, string newState)
        => newState switch
        {
            ClinicalState.Admitted or ClinicalState.Expected or "Admitted" or "Expected"
                => HasAnyPermission(permissions, PermAdmit, PermWardEdit, PermUnmarkReady),
            ClinicalState.ReadyForSurgery or "ReadyForSurgery" or "ReadyForSurgery"
                => HasAnyPermission(permissions, PermReadyForOt, PermWardEdit),
            ClinicalState.SentToOT or "SentToOT"
                => HasAnyPermission(permissions, PermSendToOt, PermWardEdit),
            ClinicalState.InOT or "InOT"
                => HasAnyPermission(permissions, PermAcceptOt, PermOtSign),
            ClinicalState.SurgeryCompleted or "SurgeryCompleted"
                => HasAnyPermission(permissions, PermSurgeryComplete, PermOtSign),
            ClinicalState.PostOp or ClinicalState.ReadyForDischarge or ClinicalState.Discharged
                or "PostOp" or "ReadyForDischarge" or "Discharged"
                => HasAnyPermission(permissions, PermDischarge, PermWardEdit),
            _ => HasAnyPermission(permissions, PermWardEdit, PermOtSign),
        };

    public static void RequireClinicalTransitionTo(HttpRequestData request, JwtService jwt, string newState)
    {
        var principal = jwt.ValidatePrincipal(request);
        var perms = ExtractPermissions(principal);
        if (AllowsClinicalTransition(perms, newState))
            return;
        throw new UnauthorizedAccessException($"Missing permission for clinical transition to {newState}.");
    }

    public static void RequireAdmit(HttpRequestData request, JwtService jwt)
        => RequireAnyPermission(request, jwt, PermAdmit, PermWardEdit);

    public static void RequireBedTransfer(HttpRequestData request, JwtService jwt)
        => RequireAnyPermission(request, jwt, PermBedTransfer, PermWardEdit);

    public static void RequireAcceptInOt(HttpRequestData request, JwtService jwt)
        => RequireAnyPermission(request, jwt, PermAcceptOt, PermOtSign);

    public static void RequireStartSurgery(HttpRequestData request, JwtService jwt)
        => RequireAnyPermission(request, jwt, PermSurgeryStart, PermOtSign);

    public static void RequireDischargeOverride(HttpRequestData request, JwtService jwt)
        => RequireAnyPermission(request, jwt, PermDischargeOverride, PermOtOverride);

    public static bool AllowsBillingMutation(IReadOnlyList<string> permissions, string transactionType)
    {
        var kind = (transactionType ?? "").Trim();
        if (kind.Equals("Refund", StringComparison.OrdinalIgnoreCase))
            return HasAnyPermission(permissions, PermBillingRefund, PermOpdBillRefund);
        if (kind.Equals("Discount", StringComparison.OrdinalIgnoreCase))
            return HasAnyPermission(permissions, PermBillingAdjust, PermBillUpdate);
        return HasAnyPermission(permissions, PermBillingCollect, PermBillUpdate);
    }

    public static void RequireBillingMutation(HttpRequestData request, JwtService jwt, string transactionType)
    {
        var principal = jwt.ValidatePrincipal(request);
        var perms = ExtractPermissions(principal);
        if (AllowsBillingMutation(perms, transactionType))
            return;
        throw new UnauthorizedAccessException($"Missing billing permission for {transactionType}.");
    }

    public static void RequireBillingCollect(HttpRequestData request, JwtService jwt)
        => RequireAnyPermission(request, jwt, PermBillingCollect, PermBillUpdate);

    public static void RequireEmergencyFc(HttpRequestData request, JwtService jwt)
    {
        var principal = jwt.ValidatePrincipal(request);
        var perms = ExtractPermissions(principal);
        if (HasPermission(perms, PermEmergencyFc))
            return;
        throw new UnauthorizedAccessException($"Missing permission: {PermEmergencyFc}");
    }

    public static void RequireDischargeCancel(HttpRequestData request, JwtService jwt)
    {
        var principal = jwt.ValidatePrincipal(request);
        var perms = ExtractPermissions(principal);
        if (HasPermission(perms, PermDischargeCancel) || HasPermission(perms, PermWardEdit))
            return;
        throw new UnauthorizedAccessException($"Missing permission: {PermDischargeCancel}");
    }

    public static void RequireOtReturnRole(HttpRequestData request, JwtService jwt)
    {
        var principal = jwt.ValidatePrincipal(request);
        var roles = ExtractRoles(principal);
        if (roles.Count > 0 && !HasAnyRole(roles, OtReturnRoles.ToArray()))
            throw new UnauthorizedAccessException(
                "Only OT Nurse, Anaesthetist, or Surgeon may return a patient from OT.");
    }
}
