using IpManagementService.Services;
using Xunit;

namespace IpManagementService.Tests;

public class PaymentModeCoveragePolicyTests
{
    [Theory]
    [InlineData("Insurance")]
    [InlineData("TPA")]
    [InlineData("CoPay")]
    [InlineData("CGHS")]
    [InlineData("SGHS")]
    [InlineData("GovernmentScheme")]
    [InlineData("ESI")]
    [InlineData("ESH")]
    [InlineData("Arograshree")]
    [InlineData("Railway")]
    [InlineData("insurance")] // case-insensitive
    public void CoverageBasedModes_RequireCcms(string mode)
    {
        Assert.True(PaymentModeCoveragePolicy.IsCoverageBased(mode));
    }

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData("   ")]
    [InlineData("Cash")]
    [InlineData("Card")]
    [InlineData("UPI")]
    [InlineData("Camp")]
    public void NonCoverageModes_DoNotRequireCcms(string? mode)
    {
        Assert.False(PaymentModeCoveragePolicy.IsCoverageBased(mode));
    }
}

/// <summary>Legacy mirror tests retained; prefer <see cref="CcmsAdmissionClientUnavailableTests"/>.</summary>
public class CcmsAdmissionValidationFailClosedTests
{
    [Fact]
    public void CoverageBased_Unavailable_Blocks()
    {
        var result = CcmsAdmissionValidation.ForCcmsUnavailable(coverageBased: true);
        Assert.False(result.Allowed);
        Assert.Equal("BLOCK", result.Decision);
        Assert.True(result.CcmsUnavailable);
    }

    [Fact]
    public void Cash_Unavailable_Allows()
    {
        var result = CcmsAdmissionValidation.ForCcmsUnavailable(coverageBased: false);
        Assert.True(result.Allowed);
        Assert.Equal("ALLOW", result.Decision);
        Assert.True(result.CcmsUnavailable);
    }
}
