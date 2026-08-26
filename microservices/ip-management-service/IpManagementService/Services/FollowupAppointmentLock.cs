using IpManagementService.Models.Domain;
using IpManagementService.Models.Dtos;

namespace IpManagementService.Services;

/// <summary>
/// W-09 B2. Discharge follow-up is a booked Auth <c>appointment</c>, not a date note.
/// </summary>
public static class FollowupAppointmentLock
{
    public const string MissingCode = "followup_appointment_missing";

    public static DateTime? FloorDate(PatientJourney journey)
        => journey.SurgeryStartedAt
           ?? journey.SurgeryScheduledAt
           ?? journey.AdmittedAt
           ?? journey.CreatedAt;

    public static bool IsSatisfied(
        AuthAppointmentStatus? status,
        DateTime? floorDate,
        Guid expectedPatientId)
    {
        if (status is null || !status.Exists || status.Cancelled)
            return false;
        if (status.AppointmentDate is not DateTime when)
            return false;
        if (status.PatientId is Guid pid && pid != Guid.Empty && pid != expectedPatientId)
            return false;
        if (floorDate is DateTime floor && when.Date < floor.Date)
            return false;
        return true;
    }

    public static async Task AddDischargeBlockAsync(
        List<ChecklistGateWarningDto> warnings,
        Guid? followupAppointmentId,
        PatientJourney journey,
        Guid tenantId,
        IAuthAppointmentStatusClient? client)
    {
        AuthAppointmentStatus? status = null;
        var unreachable = false;

        if (followupAppointmentId is Guid aid && aid != Guid.Empty)
        {
            if (client is null)
            {
                unreachable = true;
            }
            else
            {
                try
                {
                    status = await client.GetStatusAsync(aid, tenantId);
                }
                catch
                {
                    unreachable = true;
                }
            }
        }

        if (!unreachable && IsSatisfied(status, FloorDate(journey), journey.PatientId))
            return;

        warnings.Add(new ChecklistGateWarningDto(
            MissingCode,
            unreachable
                ? "Follow-up appointment could not be verified. Book or link a clinic visit before discharge."
                : "No follow-up appointment is booked. Entering a date here does not reserve a clinic slot.",
            "block",
            CanOverride: true,
            DischargeBlockerCategory.Clinical));
    }
}

/// <summary>
/// Codes that <c>ip.discharge.override</c> may clear on any → Discharged.
/// Other hard blocks stay non-overridable.
/// </summary>
public static class DischargeOverridePolicy
{
    public static bool IsOverridableBlock(string? code)
        => string.Equals(code, "patient_obligation_outstanding", StringComparison.Ordinal)
           || string.Equals(code, FollowupAppointmentLock.MissingCode, StringComparison.Ordinal);

    public static bool ClearsHardBlocks(
        IEnumerable<ChecklistGateWarningDto> warnings,
        bool overrideApplied)
        => overrideApplied
           && warnings.All(w =>
               !string.Equals(w.Severity, "block", StringComparison.OrdinalIgnoreCase)
               || IsOverridableBlock(w.Code));
}
