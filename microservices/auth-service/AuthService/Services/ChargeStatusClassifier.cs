namespace AuthService.Services;

/// <summary>
/// RPT-080. Per-bill charge completeness for the IP billing dashboard.
/// Unmapped (S-14 exception queue) wins over missing charges so finance opens mapping first.
/// </summary>
public static class ChargeStatusClassifier
{
    public const string Complete = "complete";
    public const string MissingCharges = "missing_charges";
    public const string Unmapped = "unmapped";

    public static (string Status, string Label) Classify(int missingChargeCount, int unmappedCount)
    {
        if (unmappedCount > 0)
            return (Unmapped, unmappedCount == 1 ? "1 unmapped" : $"{unmappedCount} unmapped");
        if (missingChargeCount > 0)
            return (MissingCharges, missingChargeCount == 1 ? "1 missing" : $"{missingChargeCount} missing");
        return (Complete, "Complete");
    }
}
