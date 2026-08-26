using AuthService.Models.Domain;
using AuthService.Services;
using Xunit;

namespace AuthService.Tests;

public class IpEnsureBillRulesTests
{
    [Fact]
    public void ExpectedAdmission_IsEligible()
    {
        var journey = new PatientJourneyReadOnly
        {
            ClinicalState = "Expected",
            IsDischarged = false,
        };
        Assert.True(IpEnsureBillRules.IsEligible(journey));
    }

    [Theory]
    [InlineData("Discharged")]
    [InlineData("AdmissionCancelled")]
    [InlineData("CancelledSurgery")]
    public void ClosedClinicalStates_AreNotEligible(string state)
    {
        var journey = new PatientJourneyReadOnly { ClinicalState = state };
        Assert.False(IpEnsureBillRules.IsEligible(journey));
    }

    [Fact]
    public void DischargedFlag_IsNotEligible()
    {
        var journey = new PatientJourneyReadOnly
        {
            ClinicalState = "Admitted",
            IsDischarged = true,
        };
        Assert.False(IpEnsureBillRules.IsEligible(journey));
    }

    [Fact]
    public void SoftDeleted_IsNotEligible()
    {
        var journey = new PatientJourneyReadOnly
        {
            ClinicalState = "Admitted",
            DeletedAt = DateTime.UtcNow,
        };
        Assert.False(IpEnsureBillRules.IsEligible(journey));
    }
}
