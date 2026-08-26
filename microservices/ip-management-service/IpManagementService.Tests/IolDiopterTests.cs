using IpManagementService.Services;
using Xunit;

namespace IpManagementService.Tests;

public class IolDiopterTests
{
    [Theory]
    [InlineData("21", 21.00)]
    [InlineData("21.00", 21.00)]
    [InlineData("+21.00 D", 21.00)]
    [InlineData("21.00D", 21.00)]
    [InlineData("  +21.5  ", 21.50)]
    [InlineData("-1.5 d", -1.50)]
    [InlineData("21.001", 21.00)]
    public void Parse_RoundsToTwoDecimals(string raw, double expected)
        => Assert.Equal((decimal)expected, IolDiopter.Parse(raw));

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData("   ")]
    [InlineData("n/a")]
    [InlineData("unknown")]
    public void Parse_EmptyOrUnreadable_IsNull(string? raw)
        => Assert.Null(IolDiopter.Parse(raw));

    [Fact]
    public void TwentyOne_Equals_TwentyOnePointZeroZero()
        => Assert.False(IolDiopter.Differs(IolDiopter.Parse("21")!.Value, 21.00m));

    [Fact]
    public void CatalogHalfDiopterStep_IsNotAMatch()
        => Assert.True(IolDiopter.Differs(21.00m, 21.50m));

    [Fact]
    public void Format_IncludesSignAndUnit()
    {
        Assert.Equal("+21.00 D", IolDiopter.Format(21m));
        Assert.Equal("-1.50 D", IolDiopter.Format(-1.5m));
    }
}
