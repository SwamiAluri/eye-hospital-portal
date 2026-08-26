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
    public void ValidateClinical_allows_ready_for_surgery_back_to_admitted()
    {
        var ex = Record.Exception(() =>
            StateTransitionValidator.ValidateClinical(
                ClinicalState.ReadyForSurgery, ClinicalState.Admitted));
        Assert.Null(ex);
    }

    [Fact]
    public void ValidateClinical_still_blocks_ready_for_surgery_skip_to_post_op()
    {
        Assert.Throws<InvalidOperationException>(() =>
            StateTransitionValidator.ValidateClinical(
                ClinicalState.ReadyForSurgery, ClinicalState.PostOp));
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

    [Fact]
    public void ValidateCancelAdmission_allows_expected()
    {
        var ex = Record.Exception(
            () => StateTransitionValidator.ValidateCancelAdmission(ClinicalState.Expected));
        Assert.Null(ex);
    }

    [Theory]
    [InlineData(ClinicalState.Admitted)]
    [InlineData(ClinicalState.ReadyForSurgery)]
    [InlineData(ClinicalState.InOT)]
    [InlineData(ClinicalState.CancelledSurgery)]
    public void ValidateCancelAdmission_blocks_after_expected(string clinical)
    {
        Assert.Throws<InvalidOperationException>(
            () => StateTransitionValidator.ValidateCancelAdmission(clinical));
    }

    [Fact]
    public void ValidateTypedDischarge_AllowsLamaAndDeath_FromAdmitted()
    {
        var lama = Record.Exception(() =>
            StateTransitionValidator.ValidateTypedDischarge(ClinicalState.Admitted, DischargeType.Lama));
        var death = Record.Exception(() =>
            StateTransitionValidator.ValidateTypedDischarge(ClinicalState.Admitted, DischargeType.Death));
        Assert.Null(lama);
        Assert.Null(death);
    }

    [Fact]
    public void ValidateTypedDischarge_DuplicateFromDischarged_IsBlocked()
    {
        Assert.Throws<InvalidOperationException>(() =>
            StateTransitionValidator.ValidateTypedDischarge(ClinicalState.Discharged, DischargeType.Routine));
    }

    [Fact]
    public void ValidateClinical_DuplicateSurgeryComplete_IsBlocked()
    {
        Assert.Throws<InvalidOperationException>(() =>
            StateTransitionValidator.ValidateClinical(ClinicalState.SurgeryCompleted, ClinicalState.SurgeryCompleted));
    }

    [Fact]
    public void ValidateFinancial_blocks_paid_and_settled_from_ip()
    {
        Assert.Throws<ArgumentException>(
            () => StateTransitionValidator.ValidateFinancial(
                FinancialState.Confirmed, FinancialState.Paid));
        Assert.Throws<ArgumentException>(
            () => StateTransitionValidator.ValidateFinancial(
                FinancialState.PartiallyPaid, FinancialState.Paid));
        Assert.Throws<ArgumentException>(
            () => StateTransitionValidator.ValidateFinancial(
                FinancialState.Paid, FinancialState.Settled));
    }
}
