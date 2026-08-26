using CcmsApi.Services;
using FluentAssertions;

namespace CcmsApi.Tests.ServiceTests;

public class CoverageAllocationEngineTests
{
    [Fact]
    public void ComputeSplit_LimitBelowBill_LeavesRemainderOnPatient()
    {
        var split = CoverageAllocationEngine.ComputeSplit(
            totalBillAmount: 20_000m,
            approvedLimit: 10_000m,
            copayPercent: 0,
            deductibleAmount: 0);

        split.InsuranceShare.Should().Be(10_000m);
        split.PatientShare.Should().Be(10_000m);
    }

    [Fact]
    public void ComputeSplit_EnhancementRaisesLimit_ReducesPatientShare_DoesNotZeroIt()
    {
        var before = CoverageAllocationEngine.ComputeSplit(20_000m, 10_000m, 0, 0);
        var after = CoverageAllocationEngine.ComputeSplit(20_000m, 14_000m, 0, 0);

        after.InsuranceShare.Should().Be(14_000m);
        after.PatientShare.Should().Be(6_000m);
        after.PatientShare.Should().BeLessThan(before.PatientShare);
        after.PatientShare.Should().BeGreaterThan(0);
    }

    [Fact]
    public void ComputeSplit_CopayReducesInsurerSlice()
    {
        var split = CoverageAllocationEngine.ComputeSplit(
            totalBillAmount: 10_000m,
            approvedLimit: 10_000m,
            copayPercent: 10,
            deductibleAmount: 0);

        split.CopayAmount.Should().Be(1_000m);
        split.InsuranceShare.Should().Be(9_000m);
        split.PatientShare.Should().Be(1_000m);
    }

    [Fact]
    public void ComputeSplit_ExcludedLinesStayOnPatient()
    {
        var split = CoverageAllocationEngine.ComputeSplit(
            totalBillAmount: 12_000m,
            approvedLimit: 20_000m,
            copayPercent: 0,
            deductibleAmount: 0,
            excludedTotal: 2_000m);

        split.InsuranceShare.Should().Be(10_000m);
        split.PatientShare.Should().Be(2_000m);
        split.DisallowedAmount.Should().Be(2_000m);
    }

    [Fact]
    public void ResolveApprovedLimit_PrefersRaisedCaseAmountOverStalePreauth()
    {
        CoverageAllocationEngine.ResolveApprovedLimit(10_000m, 14_000m).Should().Be(14_000m);
        CoverageAllocationEngine.ResolveApprovedLimit(10_000m, 10_000m).Should().Be(10_000m);
        CoverageAllocationEngine.ResolveApprovedLimit(null, 10_000m).Should().Be(10_000m);
        CoverageAllocationEngine.ResolveApprovedLimit(0m, 10_000m).Should().Be(10_000m);
    }

    [Fact]
    public void InferCopayPercent_RoundTripsComputeSplit()
    {
        var split = CoverageAllocationEngine.ComputeSplit(10_000m, 10_000m, 10m, 500m);
        var inferred = CoverageAllocationEngine.InferCopayPercent(
            split.InsuranceShare, split.CopayAmount, 500m);
        inferred.Should().BeApproximately(10m, 0.01m);
    }

    [Fact]
    public void InferCopayPercent_ZeroCopay_ReturnsZero()
    {
        CoverageAllocationEngine.InferCopayPercent(10_000m, 0, 0).Should().Be(0);
    }
}
