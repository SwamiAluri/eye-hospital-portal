using AuthService.Services;
using Xunit;

namespace AuthService.Tests;

public class PatientObligationCalculatorTests
{
    [Fact]
    public void Splits_Bill_Into_Payer_Then_Patient_Then_Paid_Then_Balance()
    {
        var snap = PatientObligationCalculator.Compute(
            billedAmount: 10000,
            payerResponsibility: 7000,
            collected: 2000);

        Assert.Equal(10000, snap.TotalBill);
        Assert.Equal(7000, snap.PayerResponsibility);
        Assert.Equal(3000, snap.PatientResponsibility);
        Assert.Equal(2000, snap.PatientPaid);
        Assert.Equal(1000, snap.PatientBalance);
    }

    [Fact]
    public void CcmsPatientShare_Wins_Over_Billed_Minus_Payer()
    {
        var snap = PatientObligationCalculator.Compute(
            billedAmount: 10000,
            payerResponsibility: 7000,
            collected: 0,
            ccmsPatientShare: 4500);

        Assert.Equal(4500, snap.PatientResponsibility);
        Assert.Equal(4500, snap.PatientBalance);
        Assert.Equal(7000, snap.PayerResponsibility);
    }

    [Fact]
    public void PatientPaid_Never_Exceeds_PatientResponsibility()
    {
        var snap = PatientObligationCalculator.Compute(5000, 0, collected: 9000);
        Assert.Equal(5000, snap.PatientPaid);
        Assert.Equal(0, snap.PatientBalance);
    }

    [Fact]
    public void CollectibleCap_UsesPatientShare_NotTpaInclusiveBalanceDue()
    {
        var snap = PatientObligationCalculator.Compute(
            billedAmount: 105_000m,
            payerResponsibility: 90_000m,
            collected: 0,
            ccmsPatientShare: 15_000m);

        Assert.Equal(15_000m, PatientObligationCalculator.CollectiblePatientCap(snap, ledgerBalanceDue: 105_000m));
        Assert.Equal(0m, PatientObligationCalculator.CollectiblePatientCap(snap, ledgerBalanceDue: 0m));
    }
}
