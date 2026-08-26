using System.Security.Claims;
using AuthService.Services;
using Xunit;

namespace AuthService.Tests;

public class BillingMutationAuthTests
{
    [Fact]
    public void Unauthenticated_IsNotEnforced()
    {
        Assert.False(BillingMutationAuth.ShouldEnforce(null));
        Assert.False(BillingMutationAuth.ShouldEnforce(new ClaimsPrincipal(new ClaimsIdentity())));
    }

    [Fact]
    public void AuthenticatedWithoutPermission_IsDeniedAtJwtLayer()
    {
        var user = new ClaimsPrincipal(new ClaimsIdentity(
            [new Claim(ClaimTypes.NameIdentifier, Guid.NewGuid().ToString())],
            authenticationType: "jwt"));
        Assert.True(BillingMutationAuth.ShouldEnforce(user));
        Assert.False(BillingMutationAuth.HasJwtPermission(user, "bill.update"));
    }

    [Fact]
    public void AuthenticatedWithBillUpdate_IsAllowed()
    {
        var user = new ClaimsPrincipal(new ClaimsIdentity(
            [
                new Claim(ClaimTypes.NameIdentifier, Guid.NewGuid().ToString()),
                new Claim("permission", "bill.update"),
            ],
            authenticationType: "jwt"));
        Assert.True(BillingMutationAuth.HasJwtPermission(user, "bill.update", "bill.create"));
    }

    [Fact]
    public void WildcardPermission_IsAllowed()
    {
        var user = new ClaimsPrincipal(new ClaimsIdentity(
            [new Claim("permission", "*")],
            authenticationType: "jwt"));
        Assert.True(BillingMutationAuth.HasJwtPermission(user, "opd_bill.refund"));
    }

    [Fact]
    public void IpEnsureRequiresCreateAndCollectOrUpdate()
    {
        var createOnly = new ClaimsPrincipal(new ClaimsIdentity(
            [
                new Claim(ClaimTypes.NameIdentifier, Guid.NewGuid().ToString()),
                new Claim("permission", "bill.create"),
            ],
            authenticationType: "jwt"));
        Assert.True(BillingMutationAuth.HasJwtPermission(createOnly, "bill.create"));
        Assert.False(BillingMutationAuth.HasJwtPermission(createOnly, "ip.billing.collect", "bill.update"));

        var cashier = new ClaimsPrincipal(new ClaimsIdentity(
            [
                new Claim(ClaimTypes.NameIdentifier, Guid.NewGuid().ToString()),
                new Claim("permission", "bill.create"),
                new Claim("permission", "bill.update"),
            ],
            authenticationType: "jwt"));
        Assert.True(BillingMutationAuth.HasJwtPermission(cashier, "bill.create"));
        Assert.True(BillingMutationAuth.HasJwtPermission(cashier, "ip.billing.collect", "bill.update"));
    }
}
