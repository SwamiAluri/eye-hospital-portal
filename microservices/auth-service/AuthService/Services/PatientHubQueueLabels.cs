namespace AuthService.Services;

/// <summary>
/// Display helpers for patient hub queue / station fields (ophthalmology OPD flow).
/// </summary>
public static class PatientHubQueueLabels
{
    public static string? MapQueueTypeToRole(string? queueType)
    {
        if (string.IsNullOrWhiteSpace(queueType)) return null;
        return queueType.ToLowerInvariant() switch
        {
            "optometry" => "Optometrist",
            "doctor" => "Doctor",
            "counselling" or "counseling" => "Counselor",
            "billing" => "Front Desk",
            "pharmacy" => "Pharmacy",
            _ => queueType
        };
    }
}
