using IpManagementService.Models.Domain;

namespace IpManagementService.Services;

/// <summary>
/// Shared writer for clinical <c>journey_audit_log</c> rows. Vitals, PAC, medications,
/// checklists, investigations and WHO sign-offs must produce an audit row — not only
/// lifecycle transitions.
/// </summary>
public static class JourneyClinicalAudit
{
    /// <summary>Mark Ready proceeded despite <c>vitals_out_of_range</c> (warn-only). Not missing vitals.</summary>
    public const string VitalsWarningAcknowledged = "VitalsWarningAcknowledged";

    /// <summary>Record implant proceeded with a catalog/planned power mismatch override.</summary>
    public const string ImplantMismatchOverridden = "ImplantMismatchOverridden";

    public static JourneyAuditLog Entry(
        Guid tenantId,
        Guid journeyId,
        Guid userId,
        string action,
        string stateType,
        string? oldValue,
        string? newValue,
        string? notes = null,
        Guid? correlationId = null)
    {
        var now = DateTime.UtcNow;
        return new JourneyAuditLog
        {
            Id = Guid.NewGuid(),
            TenantId = tenantId,
            PatientJourneyId = journeyId,
            Action = action,
            StateType = stateType,
            OldValue = Truncate(oldValue),
            NewValue = Truncate(newValue),
            Notes = notes is { Length: > 2000 } ? notes[..2000] : notes,
            CorrelationId = correlationId ?? journeyId,
            PerformedByUserId = userId,
            PerformedAt = now,
            CreatedAt = now,
            UpdatedAt = now,
            Status = "active",
        };
    }

    private static string? Truncate(string? value)
        => value is null || value.Length <= 50 ? value : value[..50];
}
