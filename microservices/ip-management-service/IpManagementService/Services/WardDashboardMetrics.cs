using IpManagementService.Models.Domain;
using IpManagementService.Models.Dtos;

namespace IpManagementService.Services;

/// <summary>
/// Pre-op clinical states for which the ward readiness meter renders.
/// Summary numbers now come from <see cref="PreOpReadinessEngine"/> (Phase 8).
/// </summary>
public static class WardReadiness
{
    public static readonly IReadOnlyList<string> PreOpStates = new[]
    {
        ClinicalState.Expected,
        ClinicalState.Admitted,
        ClinicalState.ReadyForSurgery,
    };
}

/// <summary>
/// Pure KPI-count calculator for the ward command center (Phase 2). Takes a flattened
/// projection of the branch's journeys and a reference date, and returns the dashboard
/// summary. Facets are computed by the caller and passed through. No database access.
/// </summary>
public static class WardDashboardMetrics
{
    public sealed record Row(
        string ClinicalState,
        DateTime? SurgeryScheduledAt,
        DateTime? SurgeryCancelledAt,
        string? OtReturnReason,
        bool PendingRebook,
        decimal BalanceDue,
        string? AdmissionType,
        bool EmergencyFcApplied,
        bool PacCompleted,
        int UnverifiedCriticalCount);

    public static WardDashboardSummaryDto Compute(
        IReadOnlyList<Row> rows,
        DateTime referenceDateUtc,
        WardDashboardFacetsDto facets)
    {
        var date = referenceDateUtc.Date;
        var stage = new Dictionary<string, int>();
        int otLoad = 0, pacPending = 0, critical = 0, financial = 0,
            delayed = 0, cancelledToday = 0, rebook = 0, emergency = 0;

        foreach (var r in rows)
        {
            stage[r.ClinicalState] = stage.GetValueOrDefault(r.ClinicalState) + 1;

            var isPreOp = WardReadiness.PreOpStates.Contains(r.ClinicalState);
            var isActive = r.ClinicalState != ClinicalState.Discharged
                        && r.ClinicalState != ClinicalState.CancelledSurgery;

            if (isActive && r.SurgeryScheduledAt?.Date == date) otLoad++;

            // PAC is locked until admission, so PAC-pending counts from Admitted onward.
            if ((r.ClinicalState == ClinicalState.Admitted
                 || r.ClinicalState == ClinicalState.ReadyForSurgery)
                && !r.PacCompleted) pacPending++;

            if (isPreOp && r.UnverifiedCriticalCount > 0) critical++;

            if (isPreOp && r.BalanceDue > 0) financial++;

            if (isPreOp
                && ((r.SurgeryScheduledAt is { } s && s.Date < date)
                    || !string.IsNullOrEmpty(r.OtReturnReason)))
                delayed++;

            if (r.ClinicalState == ClinicalState.CancelledSurgery
                && r.SurgeryCancelledAt?.Date == date) cancelledToday++;

            if (r.PendingRebook) rebook++;

            if (isActive
                && (string.Equals(r.AdmissionType, "Emergency", StringComparison.OrdinalIgnoreCase)
                    || r.EmergencyFcApplied)) emergency++;
        }

        stage["All"] = rows.Count;

        return new WardDashboardSummaryDto(
            stage, otLoad, pacPending, critical, financial,
            delayed, cancelledToday, rebook, emergency, facets);
    }
}
