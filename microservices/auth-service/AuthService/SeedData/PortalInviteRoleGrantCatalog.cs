namespace AuthService.SeedData;

/// <summary>
/// L-PORTAL-01 Gate B — role grants for existing portal.invite.create permission.
/// Does not define or rewrite the permission catalog row (Gate A).
/// Matching uses exact NormalizedName only — no aliases, fuzzy match, or role creation.
/// </summary>
public static class PortalInviteRoleGrantCatalog
{
    public const string Code = PortalInvitePermissionCatalog.InviteCreate;

    /// <summary>
    /// Live-verified, PO-approved recipients (2026-10-14).
    /// Deferred / excluded: COUNSELOR, FRONT DESK, MEDICAL RECORDS OFFICER, Admin wildcard roles.
    /// </summary>
    public static readonly string[] ApprovedRoleNormalizedNames =
    {
        "RECEPTIONIST",
        "COUNSELLOR",
    };
}
