using AuthService.Services;
using Xunit;

namespace AuthService.Tests;

public class BedWardMatcherTests
{
    [Fact]
    public void PrefersWardId_EvenWhenNamesDiffer()
    {
        var wardId = Guid.NewGuid();
        Assert.True(BedWardMatcher.Matches(wardId, "Other Name", wardId, "Day Care Ward"));
        Assert.False(BedWardMatcher.Matches(Guid.NewGuid(), "Day Care Ward", wardId, "Day Care Ward"));
    }

    [Fact]
    public void FallsBackToWardName_WhenWardIdIsNull()
    {
        var wardId = Guid.NewGuid();
        Assert.True(BedWardMatcher.Matches(null, "Day Care Ward", wardId, "day care ward"));
        Assert.False(BedWardMatcher.Matches(null, "Wave7", wardId, "Day Care Ward"));
    }

    [Fact]
    public void NameOnlyFilter_IsCaseInsensitive()
    {
        Assert.True(BedWardMatcher.Matches(null, "General Ward", null, "general ward"));
        Assert.False(BedWardMatcher.Matches(null, "Wave7", null, "General Ward"));
    }

    [Fact]
    public void NoFilter_ReturnsAll()
        => Assert.True(BedWardMatcher.Matches(null, "Wave7", null, null));

    [Fact]
    public void ResolveWardId_Wave7Alias_PrefersDayCareOnSameBranch()
    {
        var tenant = Guid.NewGuid();
        var branch = Guid.NewGuid();
        var dayCare = Guid.NewGuid();
        var surgical = Guid.NewGuid();
        var otherBranchDayCare = Guid.NewGuid();

        var wards = new[]
        {
            new BedWardMatcher.WardNameRow(surgical, tenant, branch, "Surgical Ward", "Surgical"),
            new BedWardMatcher.WardNameRow(dayCare, tenant, branch, "Day Care Ward", "DayCare"),
            new BedWardMatcher.WardNameRow(otherBranchDayCare, tenant, Guid.NewGuid(), "Day Care Ward", "DayCare"),
        };

        Assert.Equal(dayCare, BedWardMatcher.ResolveWardId(tenant, branch, "Wave7", wards));
        Assert.Equal(dayCare, BedWardMatcher.ResolveWardId(tenant, branch, "wave 7", wards));
        Assert.Null(BedWardMatcher.ResolveWardId(tenant, branch, "West Wing", wards));
    }

    [Fact]
    public void ResolveWardId_ExactNameWinsOverAlias()
    {
        var tenant = Guid.NewGuid();
        var branch = Guid.NewGuid();
        var named = Guid.NewGuid();
        var dayCare = Guid.NewGuid();
        var wards = new[]
        {
            new BedWardMatcher.WardNameRow(named, tenant, branch, "Wave7", "General"),
            new BedWardMatcher.WardNameRow(dayCare, tenant, branch, "Day Care Ward", "DayCare"),
        };

        Assert.Equal(named, BedWardMatcher.ResolveWardId(tenant, branch, "Wave7", wards));
    }
}
