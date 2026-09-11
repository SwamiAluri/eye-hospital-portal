using System;
using System.Collections.Generic;

namespace AuthService.Services;

/// <summary>
/// Phase 2B — Follow-up Center query contracts (populations, pagination, alert mapping).
/// Due-date heuristics are intentionally NOT defined here.
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

    /// <summary>Matches CounselingController alertLevel derivation (no due-date).</summary>
    public static string MapAlertLevel(string? escalationStatus, DateTime? lastContactDate)
    {
        if (escalationStatus == "SupervisorAlert") return "Critical";
        if (escalationStatus == "Escalated") return "High";
        if (escalationStatus == "Overdue") return "Medium";
        if (lastContactDate == null) return "Medium";
        return "Normal";
    }

    /// <summary>Urgent/High KPI = Critical + High (SupervisorAlert + Escalated).</summary>
    public static bool IsUrgentHigh(string? escalationStatus)
        => escalationStatus == "SupervisorAlert" || escalationStatus == "Escalated";

    public static bool IsActiveIntention(string? intention)
        => intention != null && Array.IndexOf(ActiveIntentions, intention) >= 0;

    public static bool IsColdIntention(string? intention)
        => intention != null && Array.IndexOf(ColdIntentions, intention) >= 0;
}
