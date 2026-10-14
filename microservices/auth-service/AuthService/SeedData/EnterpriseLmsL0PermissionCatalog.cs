namespace AuthService.SeedData;

/// <summary>
/// Enterprise LMS (Variant B+) L0: ensure root <c>lms.view</c> exists as a catalog code.
/// Does NOT grant the permission to Lab Technician / Lab Manager (those remain on
/// <c>laboratory.view</c> for the legacy Pathology Laboratory module).
/// Role grants for LMS require Product Owner approval.
/// </summary>
public static class EnterpriseLmsL0PermissionCatalog
{
    public const string LmsView = "lms.view";

    public static readonly string[] RequiredPermissionCodes = { LmsView };

    public static readonly (string Code, string Name, string Module, string Action, string ResourceType, string Description)[] PermissionDefinitions =
    {
        (
            LmsView,
            "View Enterprise LMS",
            "lms",
            "view",
            "lms",
            "Access the Enterprise Laboratory Management workspace (/dashboard/lms). Distinct from laboratory.view (Pathology Laboratory)."
        ),
    };
}
