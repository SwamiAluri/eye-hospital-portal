using IpManagementService.Models.Domain;

namespace IpManagementService.Services;

/// <summary>
/// Maps clinical / operational transitions to NotificationHub event types.
/// Payloads stay identity-only (journey id + state); clients refetch APIs.
/// </summary>
public static class IpRealtimeEventMapper
{
    public const string PatientAdmitted = "PatientAdmitted";
    public const string BedChanged = "BedChanged";
    public const string PatientSentToOT = "PatientSentToOT";
    public const string PatientAcceptedInOT = "PatientAcceptedInOT";
    public const string SurgeryStarted = "SurgeryStarted";
    public const string SurgeryCompleted = "SurgeryCompleted";
    public const string PostOpUpdated = "PostOpUpdated";
    public const string PatientReadyForDischarge = "PatientReadyForDischarge";
    public const string PatientDischarged = "PatientDischarged";
    public const string PatientCancelled = "PatientCancelled";
    public const string IpJourneyChanged = "IpJourneyChanged";
    public const string JourneyReadyReverted = "JourneyReadyReverted";
    public const string SlotChanged = "SlotChanged";

    public static readonly HashSet<string> DirectEventTypes = new(StringComparer.OrdinalIgnoreCase)
    {
        PatientAdmitted, BedChanged, PatientSentToOT, PatientAcceptedInOT,
        SurgeryStarted, SurgeryCompleted, PostOpUpdated, PatientReadyForDischarge,
        PatientDischarged, PatientCancelled, IpJourneyChanged,
        "WardJourneyChanged", "PreOpMarkReady", JourneyReadyReverted, "PatientReceivedFromOt",
        "ClaimStatusChanged", "PaymentReceived", "PaymentReversed", "BillCreated",
        "BillFinalized", "RefundCreated", "PatientObligationChanged",
        SlotChanged,
    };

    public static string ToHubType(string clinicalStateOrEvent)
    {
        if (string.IsNullOrWhiteSpace(clinicalStateOrEvent))
            return IpJourneyChanged;
        if (DirectEventTypes.Contains(clinicalStateOrEvent))
            return clinicalStateOrEvent;

        return clinicalStateOrEvent switch
        {
            ClinicalState.Admitted => PatientAdmitted,
            ClinicalState.SentToOT => PatientSentToOT,
            ClinicalState.InOT => SurgeryStarted,
            ClinicalState.SurgeryCompleted => SurgeryCompleted,
            ClinicalState.PostOp => PostOpUpdated,
            ClinicalState.ReadyForDischarge => PatientReadyForDischarge,
            ClinicalState.Discharged => PatientDischarged,
            ClinicalState.CancelledSurgery or ClinicalState.AdmissionCancelled => PatientCancelled,
            _ => IpJourneyChanged,
        };
    }
}
