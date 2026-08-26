namespace IpManagementService.Services;

/// <summary>W-01 — idempotent write of OPD fields onto patient_journey.</summary>
public static class OpdJourneyCopy
{
    public static bool ShouldWrite(string? existing, string? incoming, bool forceRefresh)
    {
        if (string.IsNullOrWhiteSpace(incoming)) return false;
        if (forceRefresh) return true;
        return string.IsNullOrWhiteSpace(existing);
    }

    public static string? MapEye(string? eye)
    {
        var e = (eye ?? string.Empty).Trim().ToUpperInvariant();
        return e switch
        {
            "RE" or "OD" or "RIGHT" or "R" => "OD",
            "LE" or "OS" or "LEFT" or "L" => "OS",
            "BE" or "OU" or "BOTH" or "BOTH_EYES" => "OU",
            "" => null,
            _ => e,
        };
    }
}
