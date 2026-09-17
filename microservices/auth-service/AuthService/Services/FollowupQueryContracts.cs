using System;

namespace AuthService.Services;

/// <summary>
/// Phase 2B / Phase2X — Follow-up Center query contracts (populations, pagination, alert mapping,
/// intention classification/write validation). Due-date heuristics are intentionally NOT defined here.
/// Phase2X Slice 2: Active EXIT is NOT driven by the clinical surgery-completion journey signal
/// (or OT/discharge/booking). See docs/audits/counsellor-followup-analytics-phase2x-slice2-lifecycle-blockers.md.
/// </summary>
public static class FollowupQueryContracts
{
    /// <summary>Authoritative Active allowlist — do not add master-only intentions without a business decision.</summary>
    public static readonly string[] ActiveIntentions =
    {
        "WillingWeek",
        "WillingMonth",
        "WillingQuarter",
        "WillingCallToConfirm",
        "Undecided",
        "WaitingFinancial",
        "WaitingFear",
    };

    public static readonly string[] ColdIntentions =
    {
        "Declined",
        "ReferredElsewhere",
    };

    /// <summary>
    /// Master-seeded intentions that are NOT part of Active (or Cold). Leave orphan — do not silent-include or remap.
    /// </summary>
    public static readonly string[] OrphanIntentions =
    {
        "WillingNow",
        "WillingTwoWeeks",
        "WillingSixMonths",
        "SecondOpinion",
    };

    public const int DefaultPageSize = 20;
    public const int MaxPageSize = 100;

    public static string NormalizeSearch(string? q)
    {
        if (string.IsNullOrWhiteSpace(q)) return string.Empty;
        return q.Trim().ToLowerInvariant();
    }

    public static (int page, int pageSize) NormalizePagination(int page, int pageSize)
    {
        if (page < 1) page = 1;
        if (pageSize < 1) pageSize = DefaultPageSize;
        if (pageSize > MaxPageSize) pageSize = MaxPageSize;
        return (page, pageSize);
    }

    /// <summary>
    /// Phase2Y (PD6): Never-contacted is NOT a priority. Do not map LastContactDate == null to Medium.
    /// Residual EscalationStatus echo only — Follow-up Center must not present this as formal priority.
    /// lastContactDate is ignored (kept for call-site compatibility).
    /// </summary>
    public static string MapAlertLevel(string? escalationStatus, DateTime? lastContactDate)
    {
        _ = lastContactDate; // Phase2Y: never-contacted must not invent Medium/High/Critical
        if (escalationStatus == "SupervisorAlert") return "Critical";
        if (escalationStatus == "Escalated") return "High";
        if (escalationStatus == "Overdue") return "Medium";
        return "Normal";
    }

    /// <summary>
    /// Counts EscalationStatus in {SupervisorAlert, Escalated}. Not a hospital-approved priority model (PD6).
    /// Follow-up Center no longer surfaces this as a "High Priority" KPI.
    /// </summary>
    public static bool IsUrgentHigh(string? escalationStatus)
        => escalationStatus == "SupervisorAlert" || escalationStatus == "Escalated";

    public static bool IsActiveIntention(string? intention)
        => intention != null && Array.IndexOf(ActiveIntentions, intention) >= 0;

    public static bool IsColdIntention(string? intention)
        => intention != null && Array.IndexOf(ColdIntentions, intention) >= 0;

    public static bool IsOrphanIntention(string? intention)
        => intention != null && Array.IndexOf(OrphanIntentions, intention) >= 0;

    /// <summary>Classifies a PatientIntention value for Follow-up / write validation (Phase2X).</summary>
    public static PatientIntentionKind ClassifyPatientIntention(string? intention)
    {
        if (string.IsNullOrWhiteSpace(intention))
            return PatientIntentionKind.None;

        var trimmed = intention.Trim();
        if (IsActiveIntention(trimmed)) return PatientIntentionKind.Active;
        if (IsColdIntention(trimmed)) return PatientIntentionKind.Cold;
        if (IsOrphanIntention(trimmed)) return PatientIntentionKind.Orphan;
        return PatientIntentionKind.Unknown;
    }

    /// <summary>
    /// Write-path validation: Active, Cold, and known orphans may be persisted.
    /// Unknown values must not enter counselling intention writes (and therefore cannot enter Active).
    /// Does not mutate historical rows — apply only when assigning a new value.
    /// </summary>
    public static void EnsureWritablePatientIntention(string intention)
    {
        if (string.IsNullOrWhiteSpace(intention))
            throw new ArgumentException("Patient intention cannot be empty.", nameof(intention));

        var kind = ClassifyPatientIntention(intention);
        if (kind == PatientIntentionKind.Unknown)
        {
            throw new ArgumentException(
                $"Invalid patient intention '{intention.Trim()}'. Value is not an approved Active, Cold, or known master intention.",
                nameof(intention));
        }
    }

    /// <summary>
    /// Normalizes a non-null write value: trim; allow clear via whitespace → null;
    /// validate Active/Cold/Orphan; reject Unknown.
    /// </summary>
    public static string? NormalizeWritablePatientIntention(string? intention)
    {
        if (intention == null) return null;
        if (string.IsNullOrWhiteSpace(intention)) return null;
        var trimmed = intention.Trim();
        EnsureWritablePatientIntention(trimmed);
        return trimmed;
    }
}

/// <summary>Phase2X intention classification kinds.</summary>
public enum PatientIntentionKind
{
    /// <summary>Null / whitespace — no intention set.</summary>
    None = 0,
    /// <summary>Approved Active Follow-up allowlist member.</summary>
    Active = 1,
    /// <summary>Approved Cold intention.</summary>
    Cold = 2,
    /// <summary>Known master/orphan — persistable but never Active population.</summary>
    Orphan = 3,
    /// <summary>Unrecognized — must not be written.</summary>
    Unknown = 4,
}
