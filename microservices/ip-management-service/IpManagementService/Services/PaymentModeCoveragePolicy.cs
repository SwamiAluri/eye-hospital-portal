namespace IpManagementService.Services;

/// <summary>
/// Determines whether IP admission must obtain a canonical CCMS coverage decision.
/// Aligned with CCMS counselling auto-create payment types (IntegrationFunctions)
/// plus journey-documented modes (ESI, Camp is non-coverage sponsorship).
/// </summary>
public static class PaymentModeCoveragePolicy
{
    private static readonly HashSet<string> CoverageBasedModes = new(StringComparer.OrdinalIgnoreCase)
    {
        "Insurance",
        "TPA",
        "CoPay",
        "CGHS",
        "SGHS",
        "GovernmentScheme",
        "ESH",
        "Arograshree",
        "Railway",
        "ESI",
    };

    /// <summary>
    /// Coverage-based modes require CCMS validation and fail closed when CCMS is unavailable.
    /// Cash / Card / UPI / Camp / unknown-empty do not depend on CCMS availability.
    /// </summary>
    public static bool IsCoverageBased(string? paymentMode)
    {
        if (string.IsNullOrWhiteSpace(paymentMode)) return false;
        return CoverageBasedModes.Contains(paymentMode.Trim());
    }
}
