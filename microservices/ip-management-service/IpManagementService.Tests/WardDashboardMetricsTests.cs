using IpManagementService.Models.Domain;
using IpManagementService.Models.Dtos;
using IpManagementService.Services;
using Xunit;

namespace IpManagementService.Tests;

public class WardDashboardMetricsTests
{
    private static readonly WardDashboardFacetsDto EmptyFacets =
        new(Array.Empty<string>(), Array.Empty<string>(), Array.Empty<string>(), Array.Empty<string>());

    private static WardDashboardMetrics.Row Row(
        string state,
        DateTime? scheduled = null,
        DateTime? cancelled = null,
        string? otReturn = null,
        bool pendingRebook = false,
        decimal balance = 0,
        string? admissionType = null,
        bool emergencyFc = false,
        bool pacCompleted = false,
        int unverifiedCritical = 0)
        => new(state, scheduled, cancelled, otReturn, pendingRebook,
               balance, admissionType, emergencyFc, pacCompleted, unverifiedCritical);

    [Fact]
    public void Compute_stage_counts_include_all()
    {
        var rows = new[]
        {
            Row(ClinicalState.Expected),
            Row(ClinicalState.Expected),
            Row(ClinicalState.Admitted),
            Row(ClinicalState.CancelledSurgery),
        };
        var summary = WardDashboardMetrics.Compute(rows, DateTime.UtcNow, EmptyFacets);

        Assert.Equal(2, summary.StageCounts[ClinicalState.Expected]);
        Assert.Equal(1, summary.StageCounts[ClinicalState.Admitted]);
        Assert.Equal(1, summary.StageCounts[ClinicalState.CancelledSurgery]);
        Assert.Equal(4, summary.StageCounts["All"]);
    }

    [Fact]
    public void Compute_ot_load_counts_today_active_scheduled()
    {
        var today = new DateTime(2026, 6, 30, 8, 0, 0, DateTimeKind.Utc);
        var rows = new[]
        {
            Row(ClinicalState.Admitted, scheduled: today),                 // counts
            Row(ClinicalState.ReadyForSurgery, scheduled: today.AddHours(6)), // counts (same date)
            Row(ClinicalState.Discharged, scheduled: today),               // excluded (discharged)
            Row(ClinicalState.CancelledSurgery, scheduled: today),         // excluded (cancelled)
            Row(ClinicalState.Admitted, scheduled: today.AddDays(1)),      // excluded (other day)
        };
        var summary = WardDashboardMetrics.Compute(rows, today, EmptyFacets);
        Assert.Equal(2, summary.OtLoadToday);
    }

    [Fact]
    public void Compute_pac_pending_only_from_admitted_onward()
    {
        var rows = new[]
        {
            Row(ClinicalState.Expected, pacCompleted: false),       // not counted (PAC locked pre-admit)
            Row(ClinicalState.Admitted, pacCompleted: false),       // counts
            Row(ClinicalState.ReadyForSurgery, pacCompleted: true), // not counted (done)
        };
        var summary = WardDashboardMetrics.Compute(rows, DateTime.UtcNow, EmptyFacets);
        Assert.Equal(1, summary.PacPending);
    }

    [Fact]
    public void Compute_critical_financial_delayed_rebook_cancelled_emergency()
    {
        var today = new DateTime(2026, 6, 30, 0, 0, 0, DateTimeKind.Utc);
        var rows = new[]
        {
            Row(ClinicalState.Admitted, unverifiedCritical: 2),                       // critical
            Row(ClinicalState.ReadyForSurgery, balance: 5000m),                       // financial
            Row(ClinicalState.Expected, scheduled: today.AddDays(-1)),                // delayed (past)
            Row(ClinicalState.ReadyForSurgery, otReturn: "Returned by OT"),           // delayed (OT return)
            Row(ClinicalState.Expected, pendingRebook: true),                         // rebook
            Row(ClinicalState.CancelledSurgery, cancelled: today),                    // cancelled today
            Row(ClinicalState.Admitted, admissionType: "Emergency"),                  // emergency
            Row(ClinicalState.Admitted, emergencyFc: true),                           // emergency
        };
        var summary = WardDashboardMetrics.Compute(rows, today, EmptyFacets);

        Assert.Equal(1, summary.CriticalLabs);
        Assert.Equal(1, summary.FinancialPending);
        Assert.Equal(2, summary.Delayed);
        Assert.Equal(1, summary.RebookRequired);
        Assert.Equal(1, summary.CancelledToday);
        Assert.Equal(2, summary.EmergencyCount);
    }
}
