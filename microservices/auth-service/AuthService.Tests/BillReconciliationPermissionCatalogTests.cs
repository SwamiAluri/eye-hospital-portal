using AuthService.SeedData;
using Xunit;

namespace AuthService.Tests;

/// <summary>
/// Phase 2Z-RBAC — bill.reconciliation.view split from broad bill.view.
/// </summary>
public class BillReconciliationPermissionCatalogTests
{
    [Fact]
    public void Catalog_defines_reconciliation_view_code()
    {
        Assert.Equal("bill.reconciliation.view", BillReconciliationPermissionCatalog.ViewPermissionCode);
    }

    [Fact]
    public void IpBilling_catalog_create_includes_reconciliation_view()
    {
        var perms = IpBillingPermissionCatalog.Create(Guid.Empty, DateTime.UtcNow);
        Assert.Contains(perms, p => p.Code == BillReconciliationPermissionCatalog.ViewPermissionCode);
        Assert.Contains(perms, p => p.Code == "bill.view");
    }

    [Fact]
    public void Operational_roles_are_explicit_and_exclude_counsellor()
    {
        var roles = BillReconciliationPermissionCatalog.OperationalRoleNormalizedNames;
        Assert.Contains("ADMIN", roles);
        Assert.Contains("FINANCE", roles);
        Assert.Contains("CASHIER", roles);
        Assert.Contains("BILLING CLERK", roles);
        Assert.Contains("TPA EXECUTIVE", roles);
        Assert.DoesNotContain("COUNSELLOR", roles);
        Assert.DoesNotContain("COUNSELOR", roles);
    }

    [Fact]
    public void Counsellor_least_privilege_retains_bill_view_without_reconciliation()
    {
        var retained = CounsellorLeastPrivilegeCatalog.RetainedPermissionCodes;
        Assert.Contains("bill.view", retained);
        Assert.DoesNotContain(BillReconciliationPermissionCatalog.ViewPermissionCode, retained);
    }
}
