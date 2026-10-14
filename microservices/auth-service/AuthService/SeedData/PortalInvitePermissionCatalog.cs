namespace AuthService.SeedData;

/// <summary>
/// L-PORTAL-01 Gate A — Patient Portal invitation permission definition only.
/// No role grants (Gate B not authorized). Does not expose HTTP endpoints.
/// </summary>
public static class PortalInvitePermissionCatalog
{
    public const string InviteCreate = "portal.invite.create";

    public static readonly string[] RequiredPermissionCodes =
    {
        InviteCreate,
    };

    public static readonly (string Code, string Name, string Module, string Action, string ResourceType, string Description)[] PermissionDefinitions =
    {
        (
            InviteCreate,
            "Create Patient Portal Invitation",
            "portal",
            "create",
            "portal_invitation",
            "Authorize staff to create Patient Portal invitations for an explicitly selected tenant-scoped patient. Catalogue only — no role grants."
        ),
    };
}
