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
    [InlineData("WillingWeek", PatientIntentionKind.Active)]
    [InlineData("WillingMonth", PatientIntentionKind.Active)]
    [InlineData("WillingQuarter", PatientIntentionKind.Active)]
    [InlineData("WillingCallToConfirm", PatientIntentionKind.Active)]
    [InlineData("Undecided", PatientIntentionKind.Active)]
    [InlineData("WaitingFinancial", PatientIntentionKind.Active)]
    [InlineData("WaitingFear", PatientIntentionKind.Active)]
    [InlineData("Declined", PatientIntentionKind.Cold)]
    [InlineData("ReferredElsewhere", PatientIntentionKind.Cold)]
    [InlineData("WillingNow", PatientIntentionKind.Orphan)]
    [InlineData("WillingTwoWeeks", PatientIntentionKind.Orphan)]
    [InlineData("WillingSixMonths", PatientIntentionKind.Orphan)]
    [InlineData("SecondOpinion", PatientIntentionKind.Orphan)]
    [InlineData("TotallyMadeUp", PatientIntentionKind.Unknown)]
    [InlineData("", PatientIntentionKind.None)]
    [InlineData(null, PatientIntentionKind.None)]
    public void ClassifyPatientIntention_DistinguishesKinds(string? intention, PatientIntentionKind expected)
    {
        Assert.Equal(expected, FollowupQueryContracts.ClassifyPatientIntention(intention));
    }

    [Theory]
    [InlineData("WillingWeek")]
    [InlineData("Declined")]
    [InlineData("WillingNow")]
    [InlineData(" SecondOpinion ")]
    public void EnsureWritable_AllowsActiveColdAndOrphan(string intention)
    {
        FollowupQueryContracts.EnsureWritablePatientIntention(intention);
        Assert.Equal(intention.Trim(), FollowupQueryContracts.NormalizeWritablePatientIntention(intention));
    }

    [Theory]
    [InlineData("NotARealIntention")]
    [InlineData("PendingDecision")]
    [InlineData("Agreed")]
    public void EnsureWritable_RejectsUnknown(string intention)
    {
        Assert.Throws<ArgumentException>(() => FollowupQueryContracts.EnsureWritablePatientIntention(intention));
        Assert.Throws<ArgumentException>(() => FollowupQueryContracts.NormalizeWritablePatientIntention(intention));
    }

    [Fact]
    public void NormalizeWritable_WhitespaceClearsToNull()
    {
        Assert.Null(FollowupQueryContracts.NormalizeWritablePatientIntention("   "));
        Assert.Null(FollowupQueryContracts.NormalizeWritablePatientIntention(null));
    }

    [Fact]
    public void OrphanIntentions_ExactFourKnownMasterCodes()
    {
        Assert.Equal(new[]
        {
            "WillingNow",
            "WillingTwoWeeks",
            "WillingSixMonths",
            "SecondOpinion",
        }, FollowupQueryContracts.OrphanIntentions);
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
    [InlineData("Normal", null, "Normal")]
    [InlineData("Normal", "2026-01-01", "Normal")]
    public void MapAlertLevel_DoesNotTreatNeverContactedAsPriority(string escalation, string? lastContact, string expected)
    {
        DateTime? lcd = lastContact == null ? null : DateTime.Parse(lastContact);
        Assert.Equal(expected, FollowupQueryContracts.MapAlertLevel(escalation, lcd));
    }

    [Fact]
    public void MapAlertLevel_NeverContacted_IsNormal_NotMedium()
    {
        Assert.Equal("Normal", FollowupQueryContracts.MapAlertLevel("Normal", null));
        Assert.Equal("Normal", FollowupQueryContracts.MapAlertLevel(null, null));
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
