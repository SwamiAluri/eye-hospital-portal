namespace AuthService.Models.Domain.Dtos;

/// <summary>
/// DUP-C.2 / DUP-C3A.2b — Minimized duplicate-check response for patient registration (patient.create).
/// Deliberately excludes phone, email, DifferenceReason, and MatchConfidence.
/// Structured attribute signals are safe identifiers only (e.g. "Phone"), never raw values.
/// </summary>
public class RegistrationDuplicateCheckResult
{
    public bool IsDuplicate { get; set; }

    /// <summary>Safe registration message — never includes confidence percentages or PHI.</summary>
    public string Message { get; set; } = "";

    public List<RegistrationDuplicateCandidate> Matches { get; set; } = new();
}

public class RegistrationDuplicateCandidate
{
    public Guid Id { get; set; }
    public string MedicalRecordNumber { get; set; } = "";
    public string FirstName { get; set; } = "";
    public string LastName { get; set; } = "";
    public DateTime DateOfBirth { get; set; }
    public string? Gender { get; set; }
    public string MatchType { get; set; } = "";

    /// <summary>
    /// DUP-C3A.2b — Comparable attributes that match (FirstName, LastName, DateOfBirth, Phone, Email).
    /// Empty list when none; never null. Never contains raw phone/email values.
    /// </summary>
    public List<string> MatchedAttributes { get; set; } = new();

    /// <summary>
    /// DUP-C3A.2b — Comparable attributes that differ. Empty list when none; never null.
    /// </summary>
    public List<string> DifferentAttributes { get; set; } = new();
}
