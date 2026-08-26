using AuthService.Models.Domain;

namespace AuthService.Services;

/// <summary>
/// JWT cashier IP bill creation may run for Expected and in-progress admissions.
/// Cancelled or discharged journeys are closed — collection belongs on an existing bill, if any.
/// </summary>
public static class IpEnsureBillRules
{
    public static bool IsClosedClinicalState(string? clinicalState) =>
        clinicalState is "Discharged" or "AdmissionCancelled" or "CancelledSurgery";

    public static bool IsEligible(PatientJourneyReadOnly journey)
    {
        if (journey.DeletedAt is not null) return false;
        if (journey.IsDischarged) return false;
        if (IsClosedClinicalState(journey.ClinicalState)) return false;
        return true;
    }
}
