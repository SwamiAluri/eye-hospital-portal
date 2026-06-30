using IpManagementService.Models.Domain;
using IpManagementService.Services;
using Xunit;

namespace IpManagementService.Tests;

public class StateTransitionValidatorTests
{
    [Theory]
    [InlineData(ClinicalState.Expected, OtState.NotSent)]
    [InlineData(ClinicalState.Admitted, OtState.NotSent)]
    [InlineData(ClinicalState.ReadyForSurgery, OtState.NotSent)]
    [InlineData(ClinicalState.SentToOT, OtState.SentToOT)]
    public void ValidateCancelToday_allows_eligible_states(string clinical, string ot)
    {
        var ex = Record.Exception(() => StateTransitionValidator.ValidateCancelToday(clinical, ot));
        Assert.Null(ex);
    }

    [Theory]
    [InlineData(ClinicalState.InOT)]
    [InlineData(ClinicalState.SurgeryCompleted)]
    [InlineData(ClinicalState.PostOp)]
    [InlineData(ClinicalState.Discharged)]
    public void ValidateCancelToday_blocks_late_clinical_states(string clinical)
    {
        var ex = Assert.Throws<InvalidOperationException>(
            () => StateTransitionValidator.ValidateCancelToday(clinical, OtState.NotSent));
        Assert.Contains("[CancelToday]", ex.Message);
    }

    [Fact]
    public void ValidateCancelToday_blocks_sent_to_ot_when_ot_accepted()
    {
        var ex = Assert.Throws<InvalidOperationException>(
            () => StateTransitionValidator.ValidateCancelToday(ClinicalState.SentToOT, OtState.Accepted));
        Assert.Contains("accepted", ex.Message, StringComparison.OrdinalIgnoreCase);
    }

    [Fact]
    public void ValidateClinical_forward_path_unchanged_expected_to_admitted()
    {
        var ex = Record.Exception(
            () => StateTransitionValidator.ValidateClinical(ClinicalState.Expected, ClinicalState.Admitted));
        Assert.Null(ex);
    }

    [Fact]
    public void ValidateClinical_forward_path_unchanged_surgery_completed_to_post_op()
    {
        var ex = Record.Exception(
            () => StateTransitionValidator.ValidateClinical(
                ClinicalState.SurgeryCompleted, ClinicalState.PostOp));
        Assert.Null(ex);
    }

    [Fact]
    public void ValidateClinical_still_blocks_skip_states()
    {
        Assert.Throws<InvalidOperationException>(
            () => StateTransitionValidator.ValidateClinical(ClinicalState.Expected, ClinicalState.PostOp));
    }

    [Fact]
    public void ValidateClinical_allows_rebook_cancelled_surgery_to_expected()
    {
        var ex = Record.Exception(
            () => StateTransitionValidator.ValidateClinical(
                ClinicalState.CancelledSurgery, ClinicalState.Expected));
        Assert.Null(ex);
    }

    [Theory]
    [InlineData(ClinicalState.Admitted)]
    [InlineData(ClinicalState.ReadyForSurgery)]
    [InlineData(ClinicalState.Discharged)]
    public void ValidateClinical_blocks_cancelled_surgery_to_any_state_other_than_expected(string to)
    {
        Assert.Throws<InvalidOperationException>(
            () => StateTransitionValidator.ValidateClinical(ClinicalState.CancelledSurgery, to));
    }

    [Fact]
    public void ValidateClinical_does_not_add_cancelled_surgery_into_forward_graph()
    {
        // Entry into CancelledSurgery goes through CancelTodaySurgeryAsync (ValidateCancelToday),
        // never the forward clinical graph.
        Assert.Throws<InvalidOperationException>(
            () => StateTransitionValidator.ValidateClinical(
                ClinicalState.Admitted, ClinicalState.CancelledSurgery));
    }
}
