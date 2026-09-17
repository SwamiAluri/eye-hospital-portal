using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using AuthService.Context;
using Microsoft.EntityFrameworkCore;

namespace AuthService.Services;

/// <summary>
/// Phase 3I Slice 1 — Waiting List population scope (PD-WL-01 shared queue + PD16 + soft-delete).
/// CounselorId / CreatedByUserId are intentionally NOT visibility filters.
/// </summary>
public static class WaitingListPopulationScope
{
    /// <summary>
    /// Returns session IDs visible on the shared Waiting List for the given
    /// server-authorized branch set. Empty authorizedBranches → empty result (never tenant-wide).
    /// Soft-deleted queue items and soft-deleted counselling sessions are excluded.
    /// </summary>
    public static Task<List<Guid>> QueryVisibleSessionIdsAsync(
        AppDbContext db,
        Guid tenantId,
        IReadOnlyList<Guid> authorizedBranches,
        DateTime? fromDate = null,
        DateTime? toDate = null,
        CancellationToken ct = default)
    {
        // Materialize for EF Contains translation (and empty-set → no rows).
        var branchIds = authorizedBranches as Guid[] ?? authorizedBranches.ToArray();

        return (
            from q in db.CounselorQueue.AsNoTracking()
            join s in db.CounselingSession.AsNoTracking() on q.SessionId equals s.Id
            where q.TenantId == tenantId
               && q.DeletedAt == null
               && s.DeletedAt == null
               && branchIds.Contains(q.BranchId)
               && (fromDate == null || q.AddedToQueueAt >= fromDate)
               && (toDate == null || q.AddedToQueueAt < toDate)
            orderby q.QueuePosition
            select s.Id
        ).ToListAsync(ct);
    }
}
