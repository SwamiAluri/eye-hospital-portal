using IpManagementService.Services;
using Xunit;

namespace IpManagementService.Tests;

public class DischargeFinancialClearancePolicyTests
{
    [Fact]
    public void CashLedgerDue_UsesAuthPatientBalance_WhenBillExists()
    {
        Assert.Equal(500m, DischargeFinancialClearancePolicy.CashLedgerDue(
            billingLedgerAvailable: true, patientBalance: 500m, journeyBalanceDue: 0m));
        Assert.Equal(0m, DischargeFinancialClearancePolicy.CashLedgerDue(
            billingLedgerAvailable: true, patientBalance: 0m, journeyBalanceDue: 80_000m));
    }

    [Fact]
    public void CashLedgerDue_FallsBackToJourney_WhenBillingMissing()
    {
        Assert.Equal(1_200m, DischargeFinancialClearancePolicy.CashLedgerDue(
            billingLedgerAvailable: false, patientBalance: 0m, journeyBalanceDue: 1_200m));
    }

    [Fact]
    public void Cash_Blocks_When_BalanceDue()
    {
        Assert.True(DischargeFinancialClearancePolicy.IsOutstanding(
            coverageBased: false, balanceDue: 500m, patientShareAmount: null, ccmsUnavailable: false));
    }

    [Fact]
    public void Cash_Allows_When_BalanceZero()
    {
        Assert.False(DischargeFinancialClearancePolicy.IsOutstanding(
            coverageBased: false, balanceDue: 0m, patientShareAmount: 999m, ccmsUnavailable: false));
    }

    [Fact]
    public void Coverage_Uses_PatientShare_Not_TpaSettlement()
    {
        Assert.False(DischargeFinancialClearancePolicy.IsOutstanding(
            coverageBased: true, balanceDue: 80_000m, patientShareAmount: 0m, ccmsUnavailable: false));
        Assert.True(DischargeFinancialClearancePolicy.IsOutstanding(
            coverageBased: true, balanceDue: 0m, patientShareAmount: 12_000m, ccmsUnavailable: false));
    }

    [Fact]
    public void Coverage_CcmsDown_Blocks()
    {
        Assert.True(DischargeFinancialClearancePolicy.IsOutstanding(
            coverageBased: true, balanceDue: 0m, patientShareAmount: 0m, ccmsUnavailable: true));
    }

    [Fact]
    public void Coverage_Collected_Reduces_Patient_Obligation()
    {
        Assert.False(DischargeFinancialClearancePolicy.IsOutstanding(
            coverageBased: true, balanceDue: 12_000m, patientShareAmount: 12_000m,
            ccmsUnavailable: false, patientCollected: 12_000m));
        Assert.True(DischargeFinancialClearancePolicy.IsOutstanding(
            coverageBased: true, balanceDue: 12_000m, patientShareAmount: 12_000m,
            ccmsUnavailable: false, patientCollected: 4_000m));
        Assert.Equal(8_000m, DischargeFinancialClearancePolicy.PatientObligationDue(
            coverageBased: true, balanceDue: 12_000m, patientShareAmount: 12_000m,
            ccmsUnavailable: false, patientCollected: 4_000m));
    }
}
