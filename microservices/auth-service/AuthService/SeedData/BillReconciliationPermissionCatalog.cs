namespace AuthService.SeedData;

/// <summary>
/// Phase 2Z-RBAC — Charge Reconciliation operational access, split from broad <c>bill.view</c>.
/// </summary>
public static class BillReconciliationPermissionCatalog
{
    public const string ViewPermissionCode = "bill.reconciliation.view";

    /// <summary>
    /// Roles that retain Charge Reconciliation ops access after the split
    /// (previously inherited CR via <c>bill.view</c>).
    /// </summary>
    public static readonly string[] OperationalRoleNormalizedNames =
    {
        "ADMIN",
        "FINANCE",
        "CASHIER",
        "BILLING CLERK",
        "TPA EXECUTIVE",
    };
}
