using AuthService.Services;
using Xunit;

namespace AuthService.Tests;

public class OpdBillLedgerCalculatorTests
{
    [Fact]
    public void PartialPayment_LeavesBalance()
    {
        var snap = OpdBillLedgerCalculator.Compute(1000, 0, 0, false,
        [
            new("Payment", 400, "completed"),
        ]);
        Assert.Equal(1000, snap.BilledAmount);
        Assert.Equal(400, snap.Collected);
        Assert.Equal(600, snap.BalanceDue);
        Assert.Equal("partially_paid", snap.DerivedStatus);
    }

    [Fact]
    public void AdvanceThenCharge_NetBalance()
    {
        var snap = OpdBillLedgerCalculator.Compute(5000, 0, 0, false,
        [
            new("Advance", 2000, "completed"),
            new("Payment", 1000, "completed"),
        ]);
        Assert.Equal(3000, snap.Collected);
        Assert.Equal(2000, snap.Advances);
        Assert.Equal(2000, snap.BalanceDue);
    }

    [Fact]
    public void DiscountReducesBilledNotCollected()
    {
        var snap = OpdBillLedgerCalculator.Compute(1000, 0, 0, false,
        [
            new("Discount", 100, "completed"),
            new("Payment", 900, "completed"),
        ]);
        Assert.Equal(900, snap.BilledAmount);
        Assert.Equal(100, snap.DiscountTotal);
        Assert.Equal(0, snap.BalanceDue);
        Assert.Equal("paid", snap.DerivedStatus);
    }

    [Fact]
    public void Scenario8_RefundLine_DoesNotEraseOriginalPayment()
    {
        var snap = OpdBillLedgerCalculator.Compute(
            10_000, 0, 0, isFinalized: false,
            [
                new("Payment", 4_000, "completed"),
                new("Refund", 1_000, "completed"),
            ]);
        Assert.Equal(4_000, snap.Collected + snap.RefundsAndReversals);
        Assert.Equal(1_000, snap.RefundsAndReversals);
        Assert.Equal(3_000, snap.Collected);
        Assert.Equal(BillingRealtimeEvents.RefundCreated, BillingRealtimeEvents.FromPaymentKind("Refund"));
    }

    [Fact]
    public void RefundReducesCollected()
    {
        var snap = OpdBillLedgerCalculator.Compute(1000, 0, 0, false,
        [
            new("Payment", 1000, "completed"),
            new("Refund", 250, "completed"),
        ]);
        Assert.Equal(750, snap.Collected);
        Assert.Equal(250, snap.RefundsAndReversals);
        Assert.Equal(250, snap.BalanceDue);
        Assert.Equal("partially_paid", snap.DerivedStatus);
    }

    [Fact]
    public void ReversalCancelsOriginalPayment()
    {
        var snap = OpdBillLedgerCalculator.Compute(1000, 0, 0, false,
        [
            new("Payment", 400, "completed"),
            new("Reversal", 400, "completed"),
        ]);
        Assert.Equal(0, snap.Collected);
        Assert.Equal(1000, snap.BalanceDue);
    }

    [Fact]
    public void InsuranceSplitsPatientResponsibility()
    {
        var snap = OpdBillLedgerCalculator.Compute(10000, 0, 7000, false,
        [
            new("Payment", 2000, "completed"),
        ]);
        Assert.Equal(7000, snap.InsuranceResponsibility);
        Assert.Equal(3000, snap.PatientResponsibility);
        Assert.Equal(8000, snap.BalanceDue);
    }

    [Fact]
    public void DuplicateLineAmountsAreIndependent_NoSilentMutation()
    {
        var first = OpdBillLedgerCalculator.Compute(100, 0, 0, false, [new("Payment", 40, "completed")]);
        var second = OpdBillLedgerCalculator.Compute(100, 0, 0, false,
        [
            new("Payment", 40, "completed"),
            new("Payment", 40, "completed"),
        ]);
        Assert.Equal(40, first.Collected);
        Assert.Equal(80, second.Collected);
    }

    [Fact]
    public void AdditionalCharge_HigherGrossIncreasesBalance()
    {
        var before = OpdBillLedgerCalculator.Compute(10000, 0, 0, false,
        [
            new("Payment", 10000, "completed"),
        ]);
        var after = OpdBillLedgerCalculator.Compute(12500, 0, 0, false,
        [
            new("Payment", 10000, "completed"),
        ]);
        Assert.Equal(0, before.BalanceDue);
        Assert.Equal(2500, after.BalanceDue);
        Assert.Equal("partially_paid", after.DerivedStatus);
    }

    [Fact]
    public void PackageRevision_UsesRevisedGrossNotRunningTotal()
    {
        var snap = OpdBillLedgerCalculator.Compute(8000, 0, 0, true,
        [
            new("Advance", 3000, "completed"),
            new("Payment", 5000, "completed"),
        ]);
        Assert.Equal(8000, snap.Collected);
        Assert.Equal(0, snap.BalanceDue);
        Assert.Equal("paid", snap.DerivedStatus);
    }
}
