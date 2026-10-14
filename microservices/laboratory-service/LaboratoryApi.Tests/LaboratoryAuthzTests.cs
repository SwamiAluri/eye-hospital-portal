using LaboratoryApi.Services;
using Xunit;

namespace LaboratoryApi.Tests;

public class LaboratoryAuthzTests
{
    [Fact]
    public void HasAny_Accepts_LmsView_And_Wildcard()
    {
        var userId = Guid.NewGuid();
        var tenantId = Guid.NewGuid();

        Assert.True(LaboratoryAuthz.HasAny(
            new JwtClaims(userId, tenantId, new[] { LaboratoryAuthz.LmsView }),
            LaboratoryAuthz.LmsView));

        Assert.True(LaboratoryAuthz.HasAny(
            new JwtClaims(userId, tenantId, new[] { "*" }),
            LaboratoryAuthz.LmsView));
    }

    [Fact]
    public void HasAny_Rejects_LaboratoryView_And_PatientUpdate()
    {
        var claims = new JwtClaims(
            Guid.NewGuid(),
            Guid.NewGuid(),
            new[] { "laboratory.view", "patient.view", "patient.update" });

        Assert.False(LaboratoryAuthz.HasAny(claims, LaboratoryAuthz.LmsView));
    }

    [Fact]
    public void HasAny_Rejects_Empty_Permissions()
    {
        var claims = new JwtClaims(Guid.NewGuid(), Guid.NewGuid(), Array.Empty<string>());
        Assert.False(LaboratoryAuthz.HasAny(claims, LaboratoryAuthz.LmsView));
    }

    [Fact]
    public void Catalogue_Capability_Constants_Match_PdCat01_And_PdCat04()
    {
        Assert.Equal("lms.catalogue.view", LaboratoryAuthz.CatalogueView);
        Assert.Equal("lms.catalogue.manage", LaboratoryAuthz.CatalogueManage);
        Assert.Equal("lms.catalogue.approve", LaboratoryAuthz.CatalogueApprove);
        Assert.Equal("laboratory.view", LaboratoryAuthz.LegacyLaboratoryView);
        Assert.NotEqual(LaboratoryAuthz.LegacyLaboratoryView, LaboratoryAuthz.LmsView);
    }
}
