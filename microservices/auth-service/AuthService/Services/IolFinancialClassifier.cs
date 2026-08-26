namespace AuthService.Services;

/// <summary>
/// B5.6/B5.7. Classifies an Implanted ChargeItems line against exploded package IOL
/// economics. Does not post, suppress by model name, or invent a second IOL catalog.
/// </summary>
public static class IolFinancialClassifier
{
    public const string CoveredChargeStatus = "Covered";
    public const string PremiumUpgradeServiceName = "Premium IOL upgrade";

    public enum Class
    {
        Extra,
        Covered,
        Unproven,
    }

    public sealed record CoverageSnapshot(
        int IncludedSlots,
        int CoveredUsagesAlready,
        IReadOnlySet<Guid> InclusionVariantIds,
        IReadOnlySet<Guid> CounsellingIolIds,
        IReadOnlySet<string> CounsellingProductCodes,
        IReadOnlySet<Guid> CoveredUsageIds);

    public static bool IsIolInclusionComponent(string? componentKey, string? componentName)
    {
        var key = (componentKey ?? string.Empty).Trim();
        if (key.Equals("IolAllowance", StringComparison.OrdinalIgnoreCase)
            || key.Equals("Iol", StringComparison.OrdinalIgnoreCase)
            || key.Equals("IOL", StringComparison.OrdinalIgnoreCase))
            return true;
        return (componentName ?? string.Empty).Contains("IOL", StringComparison.OrdinalIgnoreCase);
    }

    public static bool IsPremiumUpgradeLine(string? serviceName, string? idempotencyKey)
        => string.Equals(serviceName, PremiumUpgradeServiceName, StringComparison.OrdinalIgnoreCase)
           || (idempotencyKey?.Contains("PremiumIolUpgrade", StringComparison.OrdinalIgnoreCase) ?? false);

    public static int IncludedSlotCount(int inclusionLineCount, int upgradeLineCount)
        => inclusionLineCount > 0 ? inclusionLineCount : (upgradeLineCount > 0 ? 1 : 0);

    public static bool MatchesCoveredIdentity(
        Guid? resolvedVariantId,
        Guid? itemId,
        string? serviceCode,
        CoverageSnapshot coverage)
    {
        if (resolvedVariantId is Guid variantId
            && variantId != Guid.Empty
            && coverage.InclusionVariantIds.Contains(variantId))
            return true;
        if (itemId is Guid id && id != Guid.Empty && coverage.CounsellingIolIds.Contains(id))
            return true;
        var code = serviceCode?.Trim();
        return !string.IsNullOrEmpty(code) && coverage.CounsellingProductCodes.Contains(code);
    }

    /// <summary>
    /// Identity only. Extra posting still requires a priced catalog in ChargeItems;
    /// Covered / Unproven must not depend on Implant being priceable.
    /// </summary>
    public static Class Classify(
        bool catalogCanPost,
        Guid? resolvedVariantId,
        Guid? itemId,
        string? serviceCode,
        CoverageSnapshot coverage)
    {
        _ = catalogCanPost;
        if (coverage.IncludedSlots <= 0)
            return Class.Extra;

        var remaining = coverage.IncludedSlots - Math.Max(0, coverage.CoveredUsagesAlready);
        var matched = MatchesCoveredIdentity(resolvedVariantId, itemId, serviceCode, coverage);
        if (matched)
            return remaining > 0 ? Class.Covered : Class.Extra;
        return remaining > 0 ? Class.Unproven : Class.Extra;
    }
}
