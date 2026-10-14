namespace AuthService.SeedData;

/// <summary>
/// L-CAT-01B: catalogue permission definitions only. No role grants (PD-CAT-02).
/// </summary>
public static class EnterpriseLmsCataloguePermissionCatalog
{
    public const string CatalogueView = "lms.catalogue.view";
    public const string CatalogueManage = "lms.catalogue.manage";
    public const string CatalogueApprove = "lms.catalogue.approve";

    public static readonly string[] RequiredPermissionCodes =
    {
        CatalogueView,
        CatalogueManage,
        CatalogueApprove,
    };

    public static readonly (string Code, string Name, string Module, string Action, string ResourceType, string Description)[] PermissionDefinitions =
    {
        (
            CatalogueView,
            "View LMS Catalogue",
            "lms",
            "view",
            "lms_catalogue",
            "Read Enterprise LMS catalogue items and versions."
        ),
        (
            CatalogueManage,
            "Manage LMS Catalogue",
            "lms",
            "manage",
            "lms_catalogue",
            "Create/update drafts, submit for review, retire/supersede (not approve/activate)."
        ),
        (
            CatalogueApprove,
            "Approve LMS Catalogue",
            "lms",
            "approve",
            "lms_catalogue",
            "Approve and activate Enterprise LMS catalogue versions."
        ),
    };
}
