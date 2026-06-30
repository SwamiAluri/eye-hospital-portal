using IpManagementService.Models.Domain;

namespace IpManagementService.Services;

/// <summary>
/// Enforces valid state machine transitions for patient_journey.
/// Throws InvalidOperationException when a transition is illegal.
/// Does NOT persist — callers are responsible for saving changes.
/// </summary>
public static class StateTransitionValidator
{
    // ── Clinical state ─────────────────────────────────────────────────────────

    private static readonly Dictionary<string, HashSet<string>> ClinicalAllowed = new()
    {
        [ClinicalState.Expected]         = new() { ClinicalState.Admitted },
        [ClinicalState.Admitted]         = new() { ClinicalState.ReadyForSurgery },
        [ClinicalState.ReadyForSurgery]  = new() { ClinicalState.SentToOT },
        // SentToOT → ReadyForSurgery allows OT to return a patient before surgery starts
        [ClinicalState.SentToOT]         = new() { ClinicalState.InOT, ClinicalState.ReadyForSurgery },
        [ClinicalState.InOT]             = new() { ClinicalState.SurgeryCompleted, ClinicalState.ReadyForSurgery },
        [ClinicalState.SurgeryCompleted] = new() { ClinicalState.PostOp },
        [ClinicalState.PostOp]           = new() { ClinicalState.ReadyForDischarge },
        [ClinicalState.ReadyForDischarge]= new() { ClinicalState.Discharged },
        [ClinicalState.Discharged]       = new(),
        // Cancelled-surgery off-ramp (Phase 1): single exit is Rebook → Expected.
        // Entry is via CancelTodaySurgeryAsync (ValidateCancelToday), not the forward graph.
        [ClinicalState.CancelledSurgery] = new() { ClinicalState.Expected },
    };

    // ── OT state ───────────────────────────────────────────────────────────────

    private static readonly Dictionary<string, HashSet<string>> OtAllowed = new()
    {
        [OtState.NotSent]    = new() { OtState.SentToOT },
        [OtState.SentToOT]   = new() { OtState.Accepted },
        [OtState.Accepted]   = new() { OtState.InProgress },
        [OtState.InProgress] = new() { OtState.Completed },
        [OtState.Completed]  = new(),
    };

    // ── Financial state ────────────────────────────────────────────────────────

    private static readonly Dictionary<string, HashSet<string>> FinancialAllowed = new()
    {
        [FinancialState.NotCreated]    = new() { FinancialState.Draft },
        [FinancialState.Draft]         = new() { FinancialState.Estimated },
        [FinancialState.Estimated]     = new() { FinancialState.Confirmed },
        [FinancialState.Confirmed]     = new() { FinancialState.PartiallyPaid, FinancialState.Paid },
        [FinancialState.PartiallyPaid] = new() { FinancialState.Paid },
        [FinancialState.Paid]          = new() { FinancialState.Settled },
        [FinancialState.Settled]       = new(),
    };

    // ── Post-op state ──────────────────────────────────────────────────────────

    private static readonly Dictionary<string, HashSet<string>> PostOpAllowed = new()
    {
        [PostOpState.NotStarted] = new() { PostOpState.InProgress },
        [PostOpState.InProgress] = new() { PostOpState.Completed },
        [PostOpState.Completed]  = new(),
    };

    // ── Public API ─────────────────────────────────────────────────────────────

    public static void ValidateClinical(string from, string to)
        => Validate("ClinicalState", ClinicalAllowed, from, to);

    public static void ValidateOt(string from, string to)
        => Validate("OtState", OtAllowed, from, to);

    public static void ValidateFinancial(string from, string to)
        => Validate("FinancialState", FinancialAllowed, from, to);

    public static void ValidatePostOp(string from, string to)
        => Validate("PostOpState", PostOpAllowed, from, to);

    /// <summary>Additive cancel-today edges (G1) — does not modify forward clinical graph.</summary>
    public static void ValidateCancelToday(string fromClinical, string otState)
    {
        var allowedClinical = new HashSet<string>
        {
            ClinicalState.Expected,
            ClinicalState.Admitted,
            ClinicalState.ReadyForSurgery,
            ClinicalState.SentToOT,
        };

        if (!allowedClinical.Contains(fromClinical))
            throw new InvalidOperationException(
                $"[CancelToday] Cannot cancel from clinical state '{fromClinical}'.");

        if (fromClinical == ClinicalState.SentToOT
            && otState is not (OtState.NotSent or OtState.SentToOT))
        {
            throw new InvalidOperationException(
                "[CancelToday] Cannot cancel after OT has accepted the patient.");
        }
    }

    private static void Validate(
        string dimension,
        Dictionary<string, HashSet<string>> graph,
        string from,
        string to)
    {
        if (!graph.TryGetValue(from, out var allowed))
            throw new InvalidOperationException(
                $"[{dimension}] Unknown state '{from}'.");

        if (!allowed.Contains(to))
            throw new InvalidOperationException(
                $"[{dimension}] Transition '{from}' → '{to}' is not allowed. " +
                $"Allowed: [{string.Join(", ", allowed)}]");
    }
}
