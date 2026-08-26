using AuthService.Services;
using Xunit;

namespace AuthService.Tests;

public class IolFinancialClassifierTests
{
    private static IolFinancialClassifier.CoverageSnapshot Snap(
        int slots = 1,
        int covered = 0,
        Guid? variant = null,
        Guid? iolId = null,
        string? code = null)
        => new(
            slots,
            covered,
            variant is Guid v ? new HashSet<Guid> { v } : new HashSet<Guid>(),
            iolId is Guid i ? new HashSet<Guid> { i } : new HashSet<Guid>(),
            code is null
                ? new HashSet<string>(StringComparer.OrdinalIgnoreCase)
                : new HashSet<string>(StringComparer.OrdinalIgnoreCase) { code },
            new HashSet<Guid>());

    [Fact]
    public void NoPackageIol_IsExtra()
    {
        var variant = Guid.NewGuid();
        Assert.Equal(
            IolFinancialClassifier.Class.Extra,
            IolFinancialClassifier.Classify(true, variant, null, null, Snap(slots: 0)));
    }

    [Fact]
    public void MatchingInclusionVariant_WithSlot_IsCovered()
    {
        var variant = Guid.NewGuid();
        Assert.Equal(
            IolFinancialClassifier.Class.Covered,
            IolFinancialClassifier.Classify(true, variant, null, null, Snap(slots: 1, variant: variant)));
    }

    [Fact]
    public void MatchingInclusion_WhenSlotConsumed_IsExtra()
    {
        var variant = Guid.NewGuid();
        Assert.Equal(
            IolFinancialClassifier.Class.Extra,
            IolFinancialClassifier.Classify(true, variant, null, null, Snap(slots: 1, covered: 1, variant: variant)));
    }

    [Fact]
    public void DifferentVariant_WithOpenSlot_IsUnproven()
    {
        Assert.Equal(
            IolFinancialClassifier.Class.Unproven,
            IolFinancialClassifier.Classify(true, Guid.NewGuid(), null, null, Snap(slots: 1, variant: Guid.NewGuid())));
    }

    [Fact]
    public void ProductCode_MatchesCounsellingPremium()
    {
        Assert.True(IolFinancialClassifier.MatchesCoveredIdentity(
            null, null, "ALCON-SN60WF", Snap(code: "alcon-sn60wf")));
    }

    [Fact]
    public void ModelNameIsNotIdentity()
    {
        Assert.False(IolFinancialClassifier.IsIolInclusionComponent("Procedure", "Phaco surgery"));
        Assert.True(IolFinancialClassifier.IsIolInclusionComponent("IolAllowance", "IOL allowance"));
        Assert.True(IolFinancialClassifier.IsPremiumUpgradeLine("Premium IOL upgrade", "Package:x:PremiumIolUpgrade"));
    }

    [Fact]
    public void IncludedSlotCount_UpgradeAlone_IsOne()
        => Assert.Equal(1, IolFinancialClassifier.IncludedSlotCount(0, 1));

    [Fact]
    public void IncludedSlotCount_UpgradeDoesNotAddASecondSlot()
        => Assert.Equal(1, IolFinancialClassifier.IncludedSlotCount(1, 1));

    [Fact]
    public void UnpricedMatchingProductCode_IsCovered()
    {
        Assert.Equal(
            IolFinancialClassifier.Class.Covered,
            IolFinancialClassifier.Classify(
                false, null, null, "ALCON-SN60WF", Snap(slots: 1, code: "ALCON-SN60WF")));
    }

    [Fact]
    public void UnpricedUnknownCode_WithOpenSlot_IsUnproven()
    {
        Assert.Equal(
            IolFinancialClassifier.Class.Unproven,
            IolFinancialClassifier.Classify(
                false, null, Guid.NewGuid(), "UNKNOWN-SKU", Snap(slots: 1, variant: Guid.NewGuid())));
    }

    [Fact]
    public void Unpriced_WithNoPackageIol_IsExtra()
    {
        Assert.Equal(
            IolFinancialClassifier.Class.Extra,
            IolFinancialClassifier.Classify(false, null, Guid.NewGuid(), "UNKNOWN-SKU", Snap(slots: 0)));
    }
}
