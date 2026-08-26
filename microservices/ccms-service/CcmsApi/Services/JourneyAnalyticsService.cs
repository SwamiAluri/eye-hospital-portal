using CcmsApi.Data;
using Microsoft.EntityFrameworkCore;

namespace CcmsApi.Services;

public record JourneyKpiSnapshot(
    int CoverageCases,
    int EmergencyFcCount,
    int ApprovedCount,
    int PartialApprovalCount,
    int RejectedCount,
    int ClaimSubmittedCount,
    int ClaimQueryOpenCount,
    int SettledCount,
    double? AvgPreauthTurnaroundHours,
    double? AvgDischargeToSettlementHours);

public class JourneyAnalyticsService
{
    private readonly CcmsDbContext _db;

    public JourneyAnalyticsService(CcmsDbContext db) => _db = db;

    public async Task<JourneyKpiSnapshot> GetSnapshotAsync(Guid tenantId, CancellationToken ct = default)
    {
        var cases = await _db.CoverageCases.AsNoTracking()
            .Where(c => c.TenantId == tenantId && c.DeletedAt == null)
            .Select(c => new { c.CurrentState, c.EmergencyFcApplied })
            .ToListAsync(ct);

        // DischargedAt is not on coverage case — use process timestamps from authorizations instead.
        var auths = await _db.CoverageAuthorizations.AsNoTracking()
            .Where(a => a.TenantId == tenantId && a.DeletedAt == null)
            .Select(a => new { a.SubmittedAt, a.ReceivedAt })
            .ToListAsync(ct);

        var preauthHours = auths
            .Where(a => a.SubmittedAt.HasValue && a.ReceivedAt.HasValue)
            .Select(a => (a.ReceivedAt!.Value - a.SubmittedAt!.Value).TotalHours)
            .ToList();

        var settlements = await _db.Settlements.AsNoTracking()
            .Where(s => s.TenantId == tenantId && s.DeletedAt == null && s.SettledAt != null)
            .Select(s => s.SettledAt)
            .ToListAsync(ct);

        var claims = await _db.ClaimPackets.AsNoTracking()
            .Where(p => p.TenantId == tenantId && p.DeletedAt == null)
            .Select(p => p.QueryStatus)
            .ToListAsync(ct);

        return new JourneyKpiSnapshot(
            CoverageCases: cases.Count,
            EmergencyFcCount: cases.Count(c => c.EmergencyFcApplied),
            ApprovedCount: cases.Count(c => c.CurrentState == "APPROVED" || c.CurrentState == "ADMISSION_READY"),
            PartialApprovalCount: cases.Count(c => c.CurrentState == "PARTIAL_APPROVAL"),
            RejectedCount: cases.Count(c => c.CurrentState == "REJECTED"),
            ClaimSubmittedCount: cases.Count(c =>
                c.CurrentState is "CLAIM_SUBMITTED" or "CLAIM_IN_PROCESS" or "CLAIM_QUERY_RAISED"),
            ClaimQueryOpenCount: claims.Count(s => s is "query_raised" or "additional_info_required"),
            SettledCount: settlements.Count,
            AvgPreauthTurnaroundHours: preauthHours.Count == 0 ? null : preauthHours.Average(),
            AvgDischargeToSettlementHours: null);
    }
}
