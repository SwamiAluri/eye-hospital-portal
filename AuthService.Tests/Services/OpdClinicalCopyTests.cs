using AuthService.Services;
using Xunit;

namespace AuthService.Tests.Services;

public class OpdClinicalCopyTests
{
    [Fact]
    public void SecondFinalize_DoesNotBlankExistingIol()
    {
        Assert.False(OpdClinicalCopy.ShouldWrite("+21.00 D", null, forceRefresh: false));
        Assert.False(OpdClinicalCopy.ShouldWrite("+21.00 D", "  ", forceRefresh: false));
        Assert.Equal("+21.00 D", OpdClinicalCopy.FirstNonEmpty(null, "+21.00 D"));
    }

    [Fact]
    public void FirstFill_WritesWhenExistingEmpty()
    {
        Assert.True(OpdClinicalCopy.ShouldWrite(null, "+21.00 D", forceRefresh: false));
        Assert.True(OpdClinicalCopy.ShouldWrite("", "+21.00 D", forceRefresh: false));
    }

    [Fact]
    public void Refresh_OverwritesNonEmpty()
    {
        Assert.True(OpdClinicalCopy.ShouldWrite("+19.00 D", "+21.00 D", forceRefresh: true));
        Assert.False(OpdClinicalCopy.ShouldWrite("+19.00 D", null, forceRefresh: true));
    }

    [Fact]
    public void ResolveIol_PrefersSessionThenBiometryOnFirstFill()
        => Assert.Equal("+21.00 D", OpdClinicalCopy.ResolveIol(null, "+21.00 D", "+22.00 D", preferBiometry: false));

    [Fact]
    public void ResolveIol_PrefersBiometryOnRefresh()
        => Assert.Equal("+22.00 D", OpdClinicalCopy.ResolveIol(null, "+21.00 D", "+22.00 D", preferBiometry: true));

    [Fact]
    public void FormatIol_TwoDecimalsWithSign()
    {
        Assert.Equal("+21.00 D", OpdClinicalCopy.FormatIol(21m));
        Assert.Equal("-1.50 D", OpdClinicalCopy.FormatIol(-1.5m));
    }

    [Fact]
    public void MapEye_CounsellorNotationToJourney()
    {
        Assert.Equal("OD", OpdClinicalCopy.MapEyeToJourney("RE"));
        Assert.Equal("OS", OpdClinicalCopy.MapEyeToJourney("LE"));
        Assert.Equal("OU", OpdClinicalCopy.MapEyeToJourney("BE"));
        Assert.Equal("OD", OpdClinicalCopy.MapEyeToBiometry("RIGHT"));
        Assert.Null(OpdClinicalCopy.MapEyeToBiometry("BE"));
    }
}
