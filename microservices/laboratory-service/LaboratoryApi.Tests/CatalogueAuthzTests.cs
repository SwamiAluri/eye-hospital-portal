using LaboratoryApi.Services;
using Xunit;

namespace LaboratoryApi.Tests;

public class CatalogueAuthzTests
{
    [Fact]
    public void LaboratoryView_Cannot_Authorize_Catalogue_Operations()
    {
        var claims = new JwtClaims(
            Guid.NewGuid(),
            Guid.NewGuid(),
            new[] { LaboratoryAuthz.LegacyLaboratoryView, "patient.view" });

        Assert.False(LaboratoryAuthz.HasAny(claims, LaboratoryAuthz.CatalogueView));
        Assert.False(LaboratoryAuthz.HasAny(claims, LaboratoryAuthz.CatalogueManage));
        Assert.False(LaboratoryAuthz.HasAny(claims, LaboratoryAuthz.CatalogueApprove));
    }

    [Fact]
    public void Catalogue_Permissions_Are_Distinct()
    {
        var viewOnly = new JwtClaims(Guid.NewGuid(), Guid.NewGuid(), new[] { LaboratoryAuthz.CatalogueView });
        Assert.True(LaboratoryAuthz.HasAny(viewOnly, LaboratoryAuthz.CatalogueView));
        Assert.False(LaboratoryAuthz.HasAny(viewOnly, LaboratoryAuthz.CatalogueManage));
        Assert.False(LaboratoryAuthz.HasAny(viewOnly, LaboratoryAuthz.CatalogueApprove));
    }

    [Fact]
    public void Wildcard_Authorizes_Catalogue()
    {
        var admin = new JwtClaims(Guid.NewGuid(), Guid.NewGuid(), new[] { "*" });
        Assert.True(LaboratoryAuthz.HasAny(admin, LaboratoryAuthz.CatalogueView));
        Assert.True(LaboratoryAuthz.HasAny(admin, LaboratoryAuthz.CatalogueManage));
        Assert.True(LaboratoryAuthz.HasAny(admin, LaboratoryAuthz.CatalogueApprove));
    }
}
