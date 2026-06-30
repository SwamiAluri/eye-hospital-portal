using IpManagementService.Services;
using Xunit;

namespace IpManagementService.Tests;

public class InvestigationItemConfigHelperTests
{
    [Fact]
    public void GetWardTargetKey_reads_from_item_config()
    {
        var json = """{"wardTargetKey":"blood_sugar","valueType":"numeric"}""";
        Assert.Equal("blood_sugar", InvestigationItemConfigHelper.GetWardTargetKey(json, "fallback"));
    }

    [Fact]
    public void IsCritical_uses_config_when_present()
    {
        var json = """{"isCritical":true}""";
        Assert.True(InvestigationItemConfigHelper.IsCritical(json, "blood_sugar"));
    }

    [Fact]
    public void IsCritical_defaults_for_serum_creatinine()
    {
        Assert.True(InvestigationItemConfigHelper.IsCritical(null, "serum_creatinine"));
    }
}
