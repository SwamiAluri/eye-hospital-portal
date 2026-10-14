namespace LaboratoryApi.Domain;

/// <summary>L-COL-01D Specimen lifecycle — Collected / Received / Rejected.</summary>
public static class SpecimenStatuses
{
    public const string Collected = "Collected";
    public const string Received = "Received";
    public const string Rejected = "Rejected";

    public static readonly HashSet<string> All = new(StringComparer.Ordinal)
    {
        Collected,
        Received,
        Rejected,
    };

    public static bool IsValid(string? v) =>
        !string.IsNullOrWhiteSpace(v) && All.Contains(v.Trim());
}

public static class SpecimenAuditActions
{
    public const string CreateSpecimen = "CREATE_SPECIMEN";
    public const string CompleteCollection = "COMPLETE_COLLECTION";
    public const string ReceiveSpecimen = "RECEIVE_SPECIMEN";
    public const string RejectSpecimen = "REJECT_SPECIMEN";
}

public static class SpecimenAuditResourceTypes
{
    public const string Specimen = "LmsSpecimen";
}

/// <summary>
/// MasterValue entity type for governed LMS specimen rejection reasons (CONFIG-A).
/// Codes are tenant-scoped MasterValue rows — not clinical diagnoses.
/// </summary>
public static class SpecimenRejectionReasonMaster
{
    public const string EntityType = "lms.specimen_rejection_reason";
    public const string GroupKey = "lab_diagnostics";
}

/// <summary>Approved MVP rejection reasons (exact codes/labels — do not invent more).</summary>
public static class SpecimenRejectionReasons
{
    public static readonly IReadOnlyList<(string Code, string Label)> Approved =
    [
        ("PATIENT_IDENTITY_MISMATCH", "Patient identity mismatch"),
        ("SPECIMEN_MISMATCH", "Specimen does not match order"),
        ("SPECIMEN_QUALITY_UNACCEPTABLE", "Specimen quality unacceptable"),
        ("INSUFFICIENT_SPECIMEN", "Insufficient specimen"),
        ("WRONG_CONTAINER", "Incorrect specimen container"),
        ("DAMAGED_CONTAINER", "Container damaged or compromised"),
        ("LABELING_ERROR", "Specimen labeling error"),
        ("TRANSPORT_CONDITION_FAILURE", "Transport condition failure"),
        ("SPECIMEN_CONTAMINATION_SUSPECTED", "Specimen contamination suspected"),
        ("OTHER_GOVERNED_REASON", "Other governed rejection reason"),
    ];

    public static bool IsApprovedCode(string? code) =>
        !string.IsNullOrWhiteSpace(code)
        && Approved.Any(r => string.Equals(r.Code, code.Trim(), StringComparison.Ordinal));
}
