using System;
using System.Collections.Generic;

namespace AuthService.Services;

/// <summary>
/// Phase 3I Slice 12 (PD-S12-01 / PD-S12-02) — shared unavailable + operational-open predicates.
/// Reassignment Required is an operational condition, not a counselling lifecycle Status.
/// </summary>
public static class CounsellorOwnershipAvailability
{
    /// <summary>
    /// Operationally open session statuses (Assigned Waiting / not-started + InProgress).
    /// Maps to <see cref="Models.Domain.CounselingSession.Status"/> values.
    /// </summary>
    public static readonly IReadOnlyList<string> OperationalOpenSessionStatuses = new[]
    {
        "Scheduled",
        "InProgress",
    };

    public static bool IsOperationalOpenSessionStatus(string? status)
    {
        if (string.IsNullOrWhiteSpace(status))
            return false;
        return status.Equals("Scheduled", StringComparison.OrdinalIgnoreCase)
            || status.Equals("InProgress", StringComparison.OrdinalIgnoreCase);
    }

    /// <summary>
    /// PD-S12-01 / login-blocked statuses treated as unavailable for ownership remediation and targets.
    /// </summary>
    public static bool IsUnavailableUserStatus(string? userStatus)
    {
        if (string.IsNullOrWhiteSpace(userStatus))
            return false;
        var s = userStatus.Trim().ToLowerInvariant();
        return s is "inactive" or "suspended";
    }
}
