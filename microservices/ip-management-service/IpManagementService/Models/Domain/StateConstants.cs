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

/// <summary>Values for patient_journey.financial_state</summary>
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
