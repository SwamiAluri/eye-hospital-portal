using AuthService.Services;
using Xunit;

namespace AuthService.Tests.Services;

public class PatientLookupSortHelperTests
{
    [Theory]
    [InlineData("critical", 0)]
    [InlineData("high", 1)]
    [InlineData("medium", 2)]
    [InlineData("low", 3)]
    [InlineData(null, 3)]
    public void AcuityRank_OrdersClinicalPriority(string? acuity, int expected)
    {
        Assert.Equal(expected, PatientLookupSortHelper.AcuityRank(acuity));
    }

    [Theory]
    [InlineData("acuity", true)]
    [InlineData("waitingminutes", true)]
    [InlineData("scheduledat", false)]
    [InlineData("name", false)]
    public void IsEngagementSort_DetectsEngagementKeys(string sortBy, bool expected)
    {
        Assert.Equal(expected, PatientLookupSortHelper.IsEngagementSort(sortBy));
    }
}
