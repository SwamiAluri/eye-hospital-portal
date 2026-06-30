using AuthService.Services;
using Xunit;

namespace AuthService.Tests.Services;

public class PatientHubQueueLabelsTests
{
    [Theory]
    [InlineData("Optometry", "Optometrist")]
    [InlineData("Doctor", "Doctor")]
    [InlineData("Counselling", "Counselor")]
    [InlineData("Billing", "Front Desk")]
    [InlineData("Pharmacy", "Pharmacy")]
    public void MapQueueTypeToRole_MapsOphthalmologyStations(string queueType, string expected)
    {
        Assert.Equal(expected, PatientHubQueueLabels.MapQueueTypeToRole(queueType));
    }

    [Fact]
    public void MapQueueTypeToRole_ReturnsNullForEmpty()
    {
        Assert.Null(PatientHubQueueLabels.MapQueueTypeToRole(null));
        Assert.Null(PatientHubQueueLabels.MapQueueTypeToRole(""));
    }
}
