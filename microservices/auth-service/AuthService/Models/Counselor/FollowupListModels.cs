using System;
using System.Collections.Generic;

namespace AuthService.Models.Counselor;

/// <summary>Standard paginated Follow-up list envelope (Phase 2B).</summary>
public class FollowupPagedResult<T>
{
    public int Total { get; set; }
    public int Page { get; set; }
    public int PageSize { get; set; }
    public List<T> Items { get; set; } = new();
}

public class ActiveFollowupItemDto
{
    public Guid SessionId { get; set; }
    public Guid PatientId { get; set; }
    public string PatientName { get; set; } = "Unknown";
    public string? Uhid { get; set; }
    public string? Phone { get; set; }
    public Guid? BranchId { get; set; }
    public string? RecommendedSurgery { get; set; }
    public string? PatientIntention { get; set; }
    public DateTime SessionDate { get; set; }
    public DateTime? LastContactDate { get; set; }
    public int ContactAttemptCount { get; set; }
    public string? LastContactOutcome { get; set; }
    public string EscalationStatus { get; set; } = "Normal";
    public DateTime? OverdueSinceDate { get; set; }
    public string AlertLevel { get; set; } = "Normal";
}

public class ColdLeadItemDto
{
    public Guid SessionId { get; set; }
    public Guid PatientId { get; set; }
    public string PatientName { get; set; } = "Unknown";
    public string? Uhid { get; set; }
    public string? Phone { get; set; }
    public Guid? BranchId { get; set; }
    public string? RecommendedSurgery { get; set; }
    public string? PatientIntention { get; set; }
    public DateTime SessionDate { get; set; }
    public DateTime? LastContactDate { get; set; }
    public int ContactAttemptCount { get; set; }
    public string? LastContactOutcome { get; set; }
    public string? AdditionalNotes { get; set; }
}

public class PostSurgeryFollowupItemDto
{
    public Guid JourneyId { get; set; }
    public Guid PatientId { get; set; }
    public string PatientName { get; set; } = "Unknown";
    public string? Uhid { get; set; }
    public string? Phone { get; set; }
    public Guid? BranchId { get; set; }
    public Guid? SessionId { get; set; }
    public string? SurgeryType { get; set; }
    public DateTime? DischargedAt { get; set; }
    public int? DaysSinceDischarge { get; set; }
    public string? ConditionAtDischarge { get; set; }
    public DateTime? DischargeDate { get; set; }
    public int PendingPostOpVisits { get; set; }
}

/// <summary>
/// Server-authoritative Follow-up KPIs.
/// All metrics honor the same filters as list endpoints for their population:
/// branchId + q for all; intention only for Active.
/// Scope is always the filtered population (not the current page).
/// </summary>
public class FollowupStatsDto
{
    /// <summary>Echo of applied filters for client clarity.</summary>
    public FollowupStatsFiltersDto Filters { get; set; } = new();

    public FollowupActiveStatsDto Active { get; set; } = new();
    public FollowupColdStatsDto Cold { get; set; } = new();
    public FollowupPostSurgeryStatsDto PostSurgery { get; set; } = new();
}

public class FollowupStatsFiltersDto
{
    public Guid? BranchId { get; set; }
    /// <summary>Applied to Active only; ignored for Cold and PostSurgery.</summary>
    public string? Intention { get; set; }
    public string? Q { get; set; }
    /// <summary>Always "filtered" — metrics match list totals under the same filters.</summary>
    public string Scope { get; set; } = "filtered";
}

public class FollowupActiveStatsDto
{
    /// <summary>Count of Active population after filters (= list total).</summary>
    public int Total { get; set; }
    /// <summary>EscalationStatus in (SupervisorAlert, Escalated).</summary>
    public int UrgentHigh { get; set; }
    /// <summary>LastContactDate is null.</summary>
    public int NeverContacted { get; set; }
    /// <summary>Average ContactAttemptCount; null when Total == 0.</summary>
    public double? AverageAttempts { get; set; }
}

public class FollowupColdStatsDto
{
    public int Total { get; set; }
    public int Declined { get; set; }
    public int ReferredElsewhere { get; set; }
    public double? AverageAttempts { get; set; }
}

public class FollowupPostSurgeryStatsDto
{
    public int Total { get; set; }
    /// <summary>DischargedAt &lt;= UtcNow - 30 days (authoritative from discharge timestamp).</summary>
    public int Over30Days { get; set; }
    /// <summary>Incomplete post-op visits for patients in the filtered journey set.</summary>
    public int PendingPostOpVisits { get; set; }
    /// <summary>Average days since DischargedAt for journeys with DischargedAt set; null when none.</summary>
    public double? AverageDaysSinceDischarge { get; set; }
}
