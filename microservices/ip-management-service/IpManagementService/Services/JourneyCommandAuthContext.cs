using Microsoft.Azure.Functions.Worker.Http;

namespace IpManagementService.Services;

/// <summary>
/// Per-request command authorization. HTTP handlers Bind JWT permissions;
/// background jobs and unit tests leave Bound=false and skip enforcement.
/// When Bound, mutations fail-closed even if the HTTP trigger forgot a check.
/// </summary>
public class JourneyCommandAuthContext
{
    public bool Bound { get; private set; }
    public IReadOnlyList<string> Permissions { get; private set; } = [];

    public void Bind(IReadOnlyList<string> permissions)
    {
        Bound = true;
        Permissions = permissions ?? [];
    }

    public void Bind(HttpRequestData request, JwtService jwt)
        => Bind(jwt.ExtractPermissions(request));

    public void RequireAny(params string[] codes)
    {
        if (!Bound) return;
        if (!IpChecklistAuth.HasAnyPermission(Permissions, codes))
            throw new UnauthorizedAccessException($"Missing permission: {string.Join(" or ", codes)}");
    }

    public void RequireAdmit()
        => RequireAny(IpChecklistAuth.PermAdmit, IpChecklistAuth.PermWardEdit);

    public void RequireBedTransfer()
        => RequireAny(IpChecklistAuth.PermBedTransfer, IpChecklistAuth.PermWardEdit);

    public void RequireAcceptInOt()
        => RequireAny(IpChecklistAuth.PermAcceptOt, IpChecklistAuth.PermOtSign);

    public void RequireStartSurgery()
        => RequireAny(IpChecklistAuth.PermSurgeryStart, IpChecklistAuth.PermOtSign);

    public void RequireDischarge()
        => RequireAny(IpChecklistAuth.PermDischarge, IpChecklistAuth.PermWardEdit);

    public void RequireDischargeOverride()
        => RequireAny(IpChecklistAuth.PermDischargeOverride, IpChecklistAuth.PermOtOverride);

    /// <summary>
    /// IOL power/model override. Fail-closed: no fallback to OT sign or ward edit.
    /// Unbound (tests/jobs) skips the check; HTTP handlers must Bind first.
    /// </summary>
    public void RequireImplantMismatchOverride()
    {
        if (!Bound) return;
        if (!IpChecklistAuth.HasPermission(Permissions, IpChecklistAuth.PermImplantMismatchOverride))
            throw new UnauthorizedAccessException($"Missing permission: {IpChecklistAuth.PermImplantMismatchOverride}");
    }

    /// <summary>
    /// Wristband print. Fail-closed: no fallback to ward edit.
    /// Unbound (tests/jobs) skips the check; HTTP handlers must Bind first.
    /// </summary>
    public void RequireSafetyTokenPrint()
    {
        if (!Bound) return;
        if (!IpChecklistAuth.HasPermission(Permissions, IpChecklistAuth.PermSafetyTokenPrint))
            throw new UnauthorizedAccessException($"Missing permission: {IpChecklistAuth.PermSafetyTokenPrint}");
    }

    /// <summary>
    /// Eyedrop taper write. Fail-closed: no fallback to ward edit.
    /// Unbound (tests/jobs) skips the check; HTTP handlers must Bind first.
    /// </summary>
    public void RequirePostOpManage()
    {
        if (!Bound) return;
        if (!IpChecklistAuth.HasPermission(Permissions, IpChecklistAuth.PermPostOpManage))
            throw new UnauthorizedAccessException($"Missing permission: {IpChecklistAuth.PermPostOpManage}");
    }

    public void RequireDischargeCancel()
    {
        if (!Bound) return;
        if (IpChecklistAuth.HasPermission(Permissions, IpChecklistAuth.PermDischargeCancel)
            || IpChecklistAuth.HasPermission(Permissions, IpChecklistAuth.PermWardEdit))
            return;
        throw new UnauthorizedAccessException($"Missing permission: {IpChecklistAuth.PermDischargeCancel}");
    }

    public void RequireEmergencyFc()
    {
        if (!Bound) return;
        if (!IpChecklistAuth.HasPermission(Permissions, IpChecklistAuth.PermEmergencyFc))
            throw new UnauthorizedAccessException($"Missing permission: {IpChecklistAuth.PermEmergencyFc}");
    }

    public void RequireClinicalTo(string newState)
        => RequireClinicalTo(fromState: "", newState);

    public void RequireClinicalTo(string fromState, string newState)
    {
        if (!Bound) return;
        var allowed = string.IsNullOrEmpty(fromState)
            ? IpChecklistAuth.AllowsClinicalTransition(Permissions, newState)
            : IpChecklistAuth.AllowsClinicalTransition(Permissions, fromState, newState);
        if (!allowed)
            throw new UnauthorizedAccessException($"Missing permission for clinical transition to {newState}.");
    }

    public void RequireCancelClinical()
        => RequireAny(IpChecklistAuth.PermWardEdit, IpChecklistAuth.PermOtSign, IpChecklistAuth.PermAdmit);

    public void RequireView()
        => RequireAny(IpChecklistAuth.PermIpView, IpChecklistAuth.PermWardEdit, IpChecklistAuth.PermOtSign);

    public void RequireBillingMutation(string transactionType)
    {
        if (!Bound) return;
        if (!IpChecklistAuth.AllowsBillingMutation(Permissions, transactionType))
            throw new UnauthorizedAccessException($"Missing billing permission for {transactionType}.");
    }
}
