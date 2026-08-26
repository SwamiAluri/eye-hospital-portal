using IpManagementService.Models.Domain;
using IpManagementService.Services;
using Xunit;

namespace IpManagementService.Tests;

/// <summary>Phase 9 acceptance: ownership and scenario invariants, traced without assuming prior phases.</summary>
public class Phase9AcceptanceTests
{
    [Fact]
    public void Scenario1_Cash_ClinicalPath_DoesNotRequirePaidSettled()
    {
        StateTransitionValidator.ValidateClinical(ClinicalState.Expected, ClinicalState.Admitted);
        StateTransitionValidator.ValidateClinical(ClinicalState.Admitted, ClinicalState.ReadyForSurgery);
        StateTransitionValidator.ValidateClinical(ClinicalState.ReadyForSurgery, ClinicalState.SentToOT);
        StateTransitionValidator.ValidateOt(OtState.NotSent, OtState.SentToOT);
        StateTransitionValidator.ValidateOt(OtState.SentToOT, OtState.Accepted);
        StateTransitionValidator.ValidateClinical(ClinicalState.SentToOT, ClinicalState.InOT);
        StateTransitionValidator.ValidateClinical(ClinicalState.InOT, ClinicalState.SurgeryCompleted);
        StateTransitionValidator.ValidateClinical(ClinicalState.SurgeryCompleted, ClinicalState.PostOp);
        StateTransitionValidator.ValidateClinical(ClinicalState.PostOp, ClinicalState.ReadyForDischarge);
        StateTransitionValidator.ValidateClinical(ClinicalState.ReadyForDischarge, ClinicalState.Discharged);
        Assert.Throws<ArgumentException>(() =>
            StateTransitionValidator.ValidateFinancial(FinancialState.Confirmed, FinancialState.Paid));
        Assert.False(DischargeFinancialClearancePolicy.IsOutstanding(
            coverageBased: false, balanceDue: 0m, patientShareAmount: null, ccmsUnavailable: false));
    }

    [Fact]
    public void Scenario2_Insurance_PatientShareBlocks_NotTpaBalance()
    {
        Assert.False(DischargeFinancialClearancePolicy.IsOutstanding(
            coverageBased: true, balanceDue: 80_000m, patientShareAmount: 0m, ccmsUnavailable: false));
        Assert.True(DischargeFinancialClearancePolicy.IsOutstanding(
            coverageBased: true, balanceDue: 0m, patientShareAmount: 5_000m, ccmsUnavailable: false, patientCollected: 0));
    }

    [Fact]
    public void Scenario3_ClinicallyReady_FinanciallyBlocked_StatesStayIndependent()
    {
        var clinicalOk = Record.Exception(() =>
            StateTransitionValidator.ValidateClinical(ClinicalState.PostOp, ClinicalState.ReadyForDischarge));
        Assert.Null(clinicalOk);
        Assert.True(DischargeFinancialClearancePolicy.IsOutstanding(
            coverageBased: false, balanceDue: 1_200m, patientShareAmount: null, ccmsUnavailable: false));
        Assert.Equal("Financial", DischargeBlockerCategory.Financial);
    }

    [Fact]
    public void Scenario4_EmergencyFc_FailClosedWithoutDedicatedPermission()
    {
        var ctx = new JourneyCommandAuthContext();
        ctx.Bind(["ward.checklist.edit", "ip.admit"]);
        Assert.Throws<UnauthorizedAccessException>(ctx.RequireEmergencyFc);
        ctx.Bind(["ip.emergency_fc.apply"]);
        Assert.Null(Record.Exception(ctx.RequireEmergencyFc));
    }

    [Fact]
    public void Scenario5_CancelToday_AllowedBeforeOtAccept_BlockedAfter()
    {
        var ok = Record.Exception(() =>
            StateTransitionValidator.ValidateCancelToday(ClinicalState.ReadyForSurgery, OtState.NotSent));
        Assert.Null(ok);
        Assert.Throws<InvalidOperationException>(() =>
            StateTransitionValidator.ValidateCancelToday(ClinicalState.SentToOT, OtState.Accepted));
        StateTransitionValidator.ValidateClinical(ClinicalState.CancelledSurgery, ClinicalState.Expected);
    }

    [Fact]
    public void Scenario6_WardTransfer_HistoryKindsAreDistinctFromOccupancySot()
    {
        Assert.Equal("Initial", BedAssignmentType.Initial);
        Assert.Equal("Transfer", BedAssignmentType.Transfer);
        Assert.Equal("Cancellation", BedAssignmentType.Cancellation);
        Assert.Equal("Discharge", BedAssignmentType.Discharge);
    }

    [Fact]
    public void Scenario6_OtBillingGate_DoesNotUseJourneyPaid()
    {
        var journey = new PatientJourney { FinancialState = FinancialState.Paid, BalanceDue = 0 };
        Assert.False(SurgicalSafetyService.IsBillingGateSatisfied(journey, new SurgicalSafetyChecklist()));
        journey.OpdBillId = Guid.NewGuid();
        Assert.True(SurgicalSafetyService.IsBillingGateSatisfied(journey, new SurgicalSafetyChecklist()));
    }

    [Fact]
    public void Scenario7_Readmission_DoesNotReuseDischargedClinicalNode()
    {
        Assert.Throws<InvalidOperationException>(() =>
            StateTransitionValidator.ValidateClinical(ClinicalState.Discharged, ClinicalState.Admitted));
        var reopen = Record.Exception(() =>
            StateTransitionValidator.ValidateClinical(ClinicalState.Discharged, ClinicalState.ReadyForDischarge));
        Assert.Null(reopen);
    }

    [Fact]
    public void Scenario8_RefundIsBillingLedgerNotIpPaidMutation()
    {
        Assert.Throws<ArgumentException>(() =>
            StateTransitionValidator.ValidateFinancial(FinancialState.Paid, FinancialState.Settled));
    }
}
