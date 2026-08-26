using AuthService.Services;
using Xunit;

namespace AuthService.Tests;

public class BedLifecyclePolicyTests
{
    [Theory]
    [InlineData("Available", "reserve", "Reserved")]
    [InlineData("Reserved", "occupy", "Occupied")]
    [InlineData("Occupied", "vacate", "Cleaning")]
    [InlineData("Cleaning", "cleaned", "Available")]
    [InlineData("Occupied", "transfer-out", "Cleaning")]
    public void Transitions(string from, string action, string expected)
        => Assert.Equal(expected, BedLifecyclePolicy.Next(from, action));

    [Fact]
    public void Occupy_FromAvailable_IsAllowed()
        => Assert.Equal("Occupied", BedLifecyclePolicy.Next("Available", "occupy"));

    [Fact]
    public void Fsm_IsUnchanged_ForDayCareTypes()
    {
        Assert.Equal("Occupied", BedLifecyclePolicy.Next("Available", "occupy"));
        Assert.Equal("Cleaning", BedLifecyclePolicy.Next("Occupied", "vacate"));
        Assert.Equal("Available", BedLifecyclePolicy.Next("Cleaning", "cleaned"));
    }
}
