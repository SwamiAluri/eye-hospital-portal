namespace AuthService.SeedData;

/// <summary>
/// L-COL-01B: collection permission definitions only. No role grants (PD-COL-17).
/// </summary>
public static class EnterpriseLmsCollectionPermissionCatalog
{
    public const string CollectionView = "lms.collection.view";
    public const string CollectionManage = "lms.collection.manage";
    public const string CollectionCollect = "lms.collection.collect";

    public static readonly string[] RequiredPermissionCodes =
    {
        CollectionView,
        CollectionManage,
        CollectionCollect,
    };

    public static readonly (string Code, string Name, string Module, string Action, string ResourceType, string Description)[] PermissionDefinitions =
    {
        (
            CollectionView,
            "View LMS Collection",
            "lms",
            "view",
            "lms_collection_task",
            "Read/search Enterprise LMS collection tasks and work queue."
        ),
        (
            CollectionManage,
            "Manage LMS Collection",
            "lms",
            "manage",
            "lms_collection_task",
            "Create collection plans, transition, and assign collection tasks."
        ),
        (
            CollectionCollect,
            "Collect LMS Collection",
            "lms",
            "collect",
            "lms_collection_task",
            "Claim collection tasks and perform collect-scoped transitions."
        ),
    };
}
