namespace IpManagementService.Models.Domain;

/// <summary>Values for patient_journey.clinical_state</summary>
public static class ClinicalState
{
    public const string Expected           = "Expected";
    public const string Admitted           = "Admitted";
    public const string ReadyForSurgery    = "ReadyForSurgery";
    public const string SentToOT           = "SentToOT";
    public const string InOT               = "InOT";
    public const string SurgeryCompleted   = "SurgeryCompleted";
    public const string PostOp             = "PostOp";
    public const string ReadyForDischarge  = "ReadyForDischarge";
    public const string Discharged         = "Discharged";

    /// <summary>
    /// Off-ramp branch (Phase 1). A cancelled surgical case parks here instead of
    /// silently reverting to Expected; the only exit is Rebook → Expected.
    /// Not part of the forward graph.
    /// </summary>
    public const string CancelledSurgery   = "CancelledSurgery";

    /// <summary>
    /// Terminal off-ramp: admission cancelled before irreversible clinical activity.
    /// Valid only from Expected. Not part of the forward graph.
    /// </summary>
    public const string AdmissionCancelled = "AdmissionCancelled";
}

/// <summary>Values for patient_journey.ot_state</summary>
public static class OtState
{
    public const string NotSent    = "NotSent";
    public const string SentToOT   = "SentToOT";
    public const string Accepted   = "Accepted";
    public const string InProgress = "InProgress";
    public const string Completed  = "Completed";
}

/// <summary>
/// Values for patient_journey.financial_state.
/// Phase 3: clinical / ward workflow compatibility only — not Billing or CCMS settlement SoT.
/// Settled may emit a BillFinalized bridge event; charges and payer settlement remain elsewhere.
/// </summary>
public static class FinancialState
{
    public const string NotCreated    = "NotCreated";
    public const string Draft         = "Draft";
    public const string Estimated     = "Estimated";
    public const string Confirmed     = "Confirmed";
    public const string PartiallyPaid = "PartiallyPaid";
    public const string Paid          = "Paid";
    public const string Settled       = "Settled";
}

/// <summary>Values for patient_journey.post_op_state</summary>
public static class PostOpState
{
    public const string NotStarted = "NotStarted";
    public const string InProgress = "InProgress";
    public const string Completed  = "Completed";
}

/// <summary>
/// Classification of how the clinical episode closed. Independent of ClinicalState
/// (still Discharged). Product aliases: NORMAL → Routine, LAMA → Lama.
/// </summary>
public static class DischargeType
{
    public const string Routine  = "Routine";
    public const string Lama     = "Lama";
    public const string Transfer = "Transfer";
    public const string Death    = "Death";
    public const string Other    = "Other";

    public static readonly HashSet<string> All =
    [
        Routine, Lama, Transfer, Death, Other,
    ];

    public static string Normalize(string? value)
    {
        if (string.IsNullOrWhiteSpace(value)) return Routine;
        var v = value.Trim();
        if (v.Equals("NORMAL", StringComparison.OrdinalIgnoreCase)
            || v.Equals("Routine", StringComparison.OrdinalIgnoreCase))
            return Routine;
        if (v.Equals("LAMA", StringComparison.OrdinalIgnoreCase)
            || v.Equals("Lama", StringComparison.OrdinalIgnoreCase)
            || v.Equals("DAMA", StringComparison.OrdinalIgnoreCase))
            return Lama;
        if (v.Equals("TRANSFER", StringComparison.OrdinalIgnoreCase)
            || v.Equals("Transfer", StringComparison.OrdinalIgnoreCase)
            || v.Equals("Referred", StringComparison.OrdinalIgnoreCase))
            return Transfer;
        if (v.Equals("DEATH", StringComparison.OrdinalIgnoreCase)
            || v.Equals("Death", StringComparison.OrdinalIgnoreCase))
            return Death;
        if (v.Equals("OTHER", StringComparison.OrdinalIgnoreCase)
            || v.Equals("Other", StringComparison.OrdinalIgnoreCase))
            return Other;
        throw new InvalidOperationException($"Unknown discharge type '{value}'.");
    }
}

/// <summary>Historical bed/ward assignment kinds. Occupancy SoT remains Auth.</summary>
public static class BedAssignmentType
{
    public const string Initial      = "Initial";
    public const string Transfer     = "Transfer";
    public const string Release      = "Release";
    public const string Cancellation = "Cancellation";
    public const string Discharge    = "Discharge";
    public const string Reoccupy     = "Reoccupy";
}

/// <summary>Discharge gate categories — clinical state is never flipped by financial/coverage.</summary>
public static class DischargeBlockerCategory
{
    public const string Clinical     = "Clinical";
    public const string Financial    = "Financial";
    public const string Coverage     = "Coverage";
    public const string Operational  = "Operational";
}
