using AuthService.Models.Domain;

namespace AuthService.Services;

public interface IAcuityScoringService
{
    string Compute(
        bool isEmergencyVisit,
        string? queuePriority,
        bool hasSevereAllergy,
        bool hasCriticalNote,
        bool hasAbnormalVitals,
        bool hasUrgentIpState);
}

public class AcuityScoringService : IAcuityScoringService
{
    private static readonly HashSet<string> HighQueuePriorities = new(StringComparer.OrdinalIgnoreCase)
    {
        "emergency", "urgent"
    };

    public string Compute(
        bool isEmergencyVisit,
        string? queuePriority,
        bool hasSevereAllergy,
        bool hasCriticalNote,
        bool hasAbnormalVitals,
        bool hasUrgentIpState)
    {
        if (isEmergencyVisit) return "critical";
        if (hasCriticalNote || hasUrgentIpState) return "high";
        if (hasSevereAllergy || hasAbnormalVitals) return "high";
        if (!string.IsNullOrEmpty(queuePriority) && HighQueuePriorities.Contains(queuePriority)) return "high";
        if (string.Equals(queuePriority, "follow-up", StringComparison.OrdinalIgnoreCase)) return "medium";
        return "low";
    }

    public static bool IsSevereAllergy(Patient patient)
    {
        var allergies = (patient.Allergies ?? patient.KnownAllergiesDetails ?? "").ToLowerInvariant();
        if (string.IsNullOrWhiteSpace(allergies) || allergies.Contains("nkda") || allergies.Contains("none")) return false;
        return allergies.Contains("severe") || allergies.Contains("anaphylaxis") || allergies.Contains("penicillin");
    }

    public static bool IsAbnormalVitals(PatientVitalSigns? vitals)
    {
        if (vitals == null) return false;
        if (vitals.BloodPressureSystolic is > 180 or < 90) return true;
        if (vitals.BloodPressureDiastolic is > 120 or < 60) return true;
        if (vitals.HeartRate is > 120 or < 50) return true;
        if (vitals.OxygenSaturation is < 92) return true;
        return false;
    }
}
