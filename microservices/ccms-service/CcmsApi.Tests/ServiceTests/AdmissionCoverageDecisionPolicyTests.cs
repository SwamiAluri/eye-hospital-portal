using CcmsApi.Models.Domain;
using CcmsApi.Services;
using FluentAssertions;
using Xunit;

namespace CcmsApi.Tests.ServiceTests;

public class AdmissionCoverageDecisionPolicyTests
{
    private static CcmsCoverageCase Case(string state, bool emergencyFc = false) => new()
    {
        Id = Guid.NewGuid(),
        TenantId = Guid.NewGuid(),
        CaseNumber = "CCMS-TEST-01",
        CurrentState = state,
        PayerType = "insurance",
        PaymentType = "Insurance",
        ApprovedAmount = 25_000m,
        PreAuthNumber = "PA-1",
        EmergencyFcApplied = emergencyFc,
        UpdatedAt = DateTime.UtcNow,
        CreatedAt = DateTime.UtcNow,
        CreatedByUserId = Guid.NewGuid(),
        UpdatedByUserId = Guid.NewGuid(),
        Status = "active",
    };

    [Theory]
    [InlineData("APPROVED")]
    [InlineData("ADMISSION_READY")]
    public void ReadyStates_Allow(string state)
    {
        var result = AdmissionCoverageDecisionPolicy.Decide(Case(state));
        result.Allowed.Should().BeTrue();
        result.Decision.Should().Be(AdmissionCoverageDecisionPolicy.DecisionAllow);
        result.CaseId.Should().NotBeNull();
        result.CoverageState.Should().Be(state);
    }

    [Fact]
    public void PartialApproval_WarnsButAllows()
    {
        var result = AdmissionCoverageDecisionPolicy.Decide(Case("PARTIAL_APPROVAL"));
        result.Allowed.Should().BeTrue();
        result.Decision.Should().Be(AdmissionCoverageDecisionPolicy.DecisionWarn);
        result.WarningLevel.Should().Be("warning");
    }

    [Theory]
    [InlineData("DRAFT")]
    [InlineData("ELIGIBILITY_PENDING")]
    [InlineData("ELIGIBILITY_VERIFIED")]
    [InlineData("POLICY_CAPTURED")]
    [InlineData("AUTHORIZATION_REQUIRED")]
    [InlineData("PREAUTH_GENERATED")]
    [InlineData("PREAUTH_SENT")]
    [InlineData("WAITING_APPROVAL")]
    [InlineData("CLARIFICATION_REQUIRED")]
    [InlineData("RESUBMITTED")]
    [InlineData("REJECTED")]
    [InlineData("EXPIRED")]
    [InlineData("CANCELLED")]
    [InlineData("ABORTED")]
    public void NonReadyStates_Block(string state)
    {
        var result = AdmissionCoverageDecisionPolicy.Decide(Case(state));
        result.Allowed.Should().BeFalse();
        result.Decision.Should().Be(AdmissionCoverageDecisionPolicy.DecisionBlock);
        result.BlockReason.Should().NotBeNullOrWhiteSpace();
        result.RequiresEmergencyFcOverride.Should().BeTrue();
        result.CaseId.Should().NotBeNull();
    }

    [Theory]
    [InlineData("WAITING_APPROVAL")]
    [InlineData("PREAUTH_SENT")]
    [InlineData("PREAUTH_GENERATED")]
    [InlineData("CLARIFICATION_REQUIRED")]
    [InlineData("RESUBMITTED")]
    public void PendingStates_WithEmergencyFc_WarnAndAllow(string state)
    {
        var result = AdmissionCoverageDecisionPolicy.Decide(Case(state), emergencyFcApplied: true);
        result.Allowed.Should().BeTrue();
        result.Decision.Should().Be(AdmissionCoverageDecisionPolicy.DecisionWarn);
        result.IsEmergencyFinancialClearance.Should().BeTrue();
    }

    [Fact]
    public void Rejected_WithEmergencyFc_StillBlocks()
    {
        // Emergency FC does not override terminal rejection — payment mode change
        // or a new authorization is required.
        var result = AdmissionCoverageDecisionPolicy.Decide(Case("REJECTED"), emergencyFcApplied: true);
        result.Allowed.Should().BeFalse();
        result.Decision.Should().Be(AdmissionCoverageDecisionPolicy.DecisionBlock);
    }

    [Fact]
    public void NoCase_AllowsInformational()
    {
        var result = AdmissionCoverageDecisionPolicy.Decide(null);
        result.Allowed.Should().BeTrue();
        result.WarningMessage.Should().Contain("No coverage case");
    }
}
