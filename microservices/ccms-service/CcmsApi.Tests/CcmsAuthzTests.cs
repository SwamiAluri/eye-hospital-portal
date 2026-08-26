using CcmsApi.Services;
using Xunit;

namespace CcmsApi.Tests;

public class CcmsAuthzTests
{
    [Fact]
    public void EmptyPermissions_Deny_PrivilegedWrites()
    {
        var claims = new JwtClaims(Guid.NewGuid(), Guid.NewGuid(), Permissions: Array.Empty<string>());
        Assert.False(CcmsAuthz.HasAny(claims, "ccms.preauth.process"));
    }

    [Fact]
    public void ExplicitPermissions_RequireMatch()
    {
        var claims = new JwtClaims(Guid.NewGuid(), Guid.NewGuid(), new[] { "ccms.case.view" });
        Assert.False(CcmsAuthz.HasAny(claims, "ccms.preauth.process", "ccms.workflow.admin"));
        Assert.True(CcmsAuthz.HasAny(claims, "ccms.case.view"));
    }

    [Fact]
    public void StarPermission_AllowsAll()
    {
        var claims = new JwtClaims(Guid.NewGuid(), Guid.NewGuid(), new[] { "*" });
        Assert.True(CcmsAuthz.HasAny(claims, "ccms.claim.submit"));
    }

    [Fact]
    public void EquivalentLegacyAuthorizationCodes_SatisfyPreauthAliases()
    {
        var claims = new JwtClaims(Guid.NewGuid(), Guid.NewGuid(),
            new[] { "ccms.authorization.record_response" });
        Assert.True(CcmsAuthz.HasAny(claims, "ccms.preauth.process"));
    }
}
