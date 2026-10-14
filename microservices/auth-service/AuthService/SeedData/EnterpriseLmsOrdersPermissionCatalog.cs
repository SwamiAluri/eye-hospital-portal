namespace AuthService.SeedData;

/// <summary>
/// L-ORD-01B: order permission definitions only. No role grants (PD-ORD-15 / PD-CAT-02 style).
/// </summary>
public static class EnterpriseLmsOrdersPermissionCatalog
{
    public const string OrdersView = "lms.orders.view";
    public const string OrdersCreate = "lms.orders.create";
    public const string OrdersManage = "lms.orders.manage";

    public static readonly string[] RequiredPermissionCodes =
    {
        OrdersView,
        OrdersCreate,
        OrdersManage,
    };

    public static readonly (string Code, string Name, string Module, string Action, string ResourceType, string Description)[] PermissionDefinitions =
    {
        (
            OrdersView,
            "View LMS Orders",
            "lms",
            "view",
            "lms_order",
            "Read/search Enterprise LMS laboratory orders."
        ),
        (
            OrdersCreate,
            "Create LMS Orders",
            "lms",
            "create",
            "lms_order",
            "Create drafts and submit Enterprise LMS laboratory orders."
        ),
        (
            OrdersManage,
            "Manage LMS Orders",
            "lms",
            "manage",
            "lms_order",
            "Amend/cancel Enterprise LMS laboratory order lifecycle actions."
        ),
    };
}
