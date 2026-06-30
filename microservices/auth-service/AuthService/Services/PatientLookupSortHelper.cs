namespace AuthService.Services;

/// <summary>Shared sort helpers for patient hub lookup (acuity rank, engagement fields).</summary>
public static class PatientLookupSortHelper
{
    private static readonly Dictionary<string, int> AcuityOrder = new(StringComparer.OrdinalIgnoreCase)
    {
        ["critical"] = 0,
        ["high"] = 1,
        ["medium"] = 2,
        ["low"] = 3,
    };

    public static int AcuityRank(string? acuity) =>
        AcuityOrder.TryGetValue(acuity ?? "low", out var rank) ? rank : 4;

    public static bool IsEngagementSort(string? sortBy)
    {
        var key = (sortBy ?? "").ToLowerInvariant();
        return key is "acuity" or "waitingminutes";
    }
}
