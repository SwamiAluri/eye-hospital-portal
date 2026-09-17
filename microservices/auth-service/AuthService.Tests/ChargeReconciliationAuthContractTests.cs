using System.Reflection;
using AuthService.Authorization;
using AuthService.Controllers;
using Microsoft.AspNetCore.Mvc;
using Xunit;

namespace AuthService.Tests;

/// <summary>Phase 2Z-RBAC — Charge Reconciliation endpoint permission split.</summary>
public class ChargeReconciliationAuthContractTests
{
    [Fact]
    public void OperationalRoutes_RequireBillReconciliationView()
    {
        foreach (var name in new[]
        {
            nameof(ChargeReconciliationController.Get),
            nameof(ChargeReconciliationController.Run),
            nameof(ChargeReconciliationController.Wastage),
        })
        {
            var method = typeof(ChargeReconciliationController).GetMethod(name);
            Assert.NotNull(method);
            var attr = method!.GetCustomAttribute<RequirePermissionAttribute>();
            Assert.Equal("bill.reconciliation.view", attr!.PermissionCode);
        }
    }

    [Fact]
    public void Completeness_RemainsBillView()
    {
        var method = typeof(ChargeReconciliationController).GetMethod(
            nameof(ChargeReconciliationController.Completeness));
        Assert.NotNull(method);
        var attr = method!.GetCustomAttribute<RequirePermissionAttribute>();
        Assert.Equal("bill.view", attr!.PermissionCode);
        var httpGet = method.GetCustomAttribute<HttpGetAttribute>();
        Assert.Equal("completeness", httpGet!.Template);
    }
}
