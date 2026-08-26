using IpManagementService.Models.Domain;

namespace IpManagementService.Services;

/// <summary>IP-011 — reverse Mark Ready (ReadyForSurgery → Admitted).</summary>
public static class UnmarkReadyRules
{
    public const int MinReasonLength = 10;

    public static bool IsUnmarkReady(string fromClinical, string toClinical)
        => fromClinical == ClinicalState.ReadyForSurgery
           && toClinical == ClinicalState.Admitted;

    public static void Validate(string otState, string? reason)
    {
        if (otState != OtState.NotSent)
            throw new InvalidOperationException(
                "Cannot revert Ready for OT after the patient has been sent to theatre.");

        var trimmed = reason?.Trim() ?? "";
        if (trimmed.Length < MinReasonLength)
            throw new ArgumentException(
                $"A reason of at least {MinReasonLength} characters is required to revert Ready for OT.");
    }
}
