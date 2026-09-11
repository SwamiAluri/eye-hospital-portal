using AuthService.Services;
using Xunit;

namespace AuthService.Tests;

public class FollowupQueryContractsTests
{
    [Fact]
    public void ActiveIntentions_MatchPhase2AAllowlist_Exactly()
    {
        Assert.Equal(new[]
        {
            "WillingWeek",
            "WillingMonth",
            "WillingQuarter",
            "WillingCallToConfirm",
            "Undecided",
            "WaitingFinancial",
            "WaitingFear",
        }, FollowupQueryContracts.ActiveIntentions);
    }

    [Fact]
    public void ColdIntentions_AreDeclinedAndReferredElsewhere()
    {
        Assert.Equal(new[] { "Declined", "ReferredElsewhere" }, FollowupQueryContracts.ColdIntentions);
    }

    [Fact]
    public void ActiveAllowlist_DoesNotIncludeOrphanMasterIntentions()
    {
        Assert.DoesNotContain("WillingNow", FollowupQueryContracts.ActiveIntentions);
        Assert.DoesNotContain("WillingTwoWeeks", FollowupQueryContracts.ActiveIntentions);
        Assert.DoesNotContain("WillingSixMonths", FollowupQueryContracts.ActiveIntentions);
        Assert.DoesNotContain("SecondOpinion", FollowupQueryContracts.ActiveIntentions);
    }

    [Theory]
    [InlineData(0, 0, 1, 20)]
    [InlineData(-1, 500, 1, 100)]
    [InlineData(2, 10, 2, 10)]
    public void NormalizePagination_Clamps(int page, int pageSize, int expectedPage, int expectedSize)
    {
        var (p, s) = FollowupQueryContracts.NormalizePagination(page, pageSize);
        Assert.Equal(expectedPage, p);
        Assert.Equal(expectedSize, s);
    }

    [Theory]
    [InlineData("SupervisorAlert", null, "Critical")]
    [InlineData("Escalated", null, "High")]
    [InlineData("Overdue", null, "Medium")]
    [InlineData("Normal", null, "Medium")]
    [InlineData("Normal", "2026-01-01", "Normal")]
    public void MapAlertLevel_MatchesControllerSemantics(string escalation, string? lastContact, string expected)
    {
        DateTime? lcd = lastContact == null ? null : DateTime.Parse(lastContact);
        Assert.Equal(expected, FollowupQueryContracts.MapAlertLevel(escalation, lcd));
    }

    [Fact]
    public void IsUrgentHigh_OnlyEscalatedAndSupervisorAlert()
    {
        Assert.True(FollowupQueryContracts.IsUrgentHigh("Escalated"));
        Assert.True(FollowupQueryContracts.IsUrgentHigh("SupervisorAlert"));
        Assert.False(FollowupQueryContracts.IsUrgentHigh("Overdue"));
        Assert.False(FollowupQueryContracts.IsUrgentHigh("Normal"));
    }

    [Fact]
    public void NormalizeSearch_TrimsAndLowercases()
    {
        Assert.Equal("abc", FollowupQueryContracts.NormalizeSearch("  ABC  "));
        Assert.Equal("", FollowupQueryContracts.NormalizeSearch("   "));
    }
}
