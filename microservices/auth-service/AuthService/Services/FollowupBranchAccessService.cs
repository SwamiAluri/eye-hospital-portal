using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using AuthService.Context;
using Microsoft.EntityFrameworkCore;

namespace AuthService.Services;

/// <summary>
/// Phase2X PD16 — server-side branch authorization for Follow-up Center,
/// Analytics, session list, and Phase 3I Waiting List.
/// Client-supplied branchId is never a security boundary.
/// Extended for Counsellor patient/session workflows (Phase 2Z UAT hardening).
/// </summary>
public interface IFollowupBranchAccessService
{
    /// <summary>
    /// Resolves the caller's accessible branch set, optionally narrowed by a requested branchId.
    /// Throws <see cref="UnauthorizedAccessException"/> when requestedBranchId is outside authorization.
    /// Empty result means no accessible branches (no tenant-wide fallback).
    /// </summary>
    Task<IReadOnlyList<Guid>> ResolveAccessibleBranchesAsync(
        Guid tenantId,
        Guid userId,
        Guid? requestedBranchId,
        CancellationToken ct = default);

    /// <summary>
    /// Resolves a single effective branch for write/search operations.
    /// When <paramref name="requestedBranchId"/> is set, it must be authorized (else 403 semantics).
    /// When omitted: exactly one accessible branch is used; zero or many without a request
    /// throws <see cref="InvalidOperationException"/> (caller maps to 400).
    /// </summary>
    Task<Guid> ResolveEffectiveBranchAsync(
        Guid tenantId,
        Guid userId,
        Guid? requestedBranchId,
        CancellationToken ct = default);
}

public class FollowupBranchAccessService : IFollowupBranchAccessService
{
    private readonly AppDbContext _context;

    public FollowupBranchAccessService(AppDbContext context)
    {
        _context = context;
    }

    public async Task<IReadOnlyList<Guid>> ResolveAccessibleBranchesAsync(
        Guid tenantId,
        Guid userId,
        Guid? requestedBranchId,
        CancellationToken ct = default)
    {
        var now = DateTime.UtcNow;

        var fromAssignments = await _context.UserBranches
            .AsNoTracking()
            .Where(ub => ub.TenantId == tenantId
                      && ub.UserId == userId
                      && ub.Status == "active"
                      && ub.EffectiveFrom <= now
                      && (ub.EffectiveUntil == null || ub.EffectiveUntil > now))
            .Select(ub => ub.BranchId)
            .Distinct()
            .ToListAsync(ct);

        var accessible = new HashSet<Guid>(fromAssignments);

        var primaryBranchId = await _context.Users
            .AsNoTracking()
            .Where(u => u.Id == userId && u.TenantId == tenantId)
            .Select(u => u.BranchId)
            .FirstOrDefaultAsync(ct);

        if (primaryBranchId.HasValue)
            accessible.Add(primaryBranchId.Value);

        if (requestedBranchId.HasValue)
        {
            if (!accessible.Contains(requestedBranchId.Value))
            {
                throw new UnauthorizedAccessException(
                    "Branch is not authorized for this caller.");
            }

            return new[] { requestedBranchId.Value };
        }

        return accessible.ToList();
    }

    public async Task<Guid> ResolveEffectiveBranchAsync(
        Guid tenantId,
        Guid userId,
        Guid? requestedBranchId,
        CancellationToken ct = default)
    {
        var accessible = await ResolveAccessibleBranchesAsync(tenantId, userId, requestedBranchId, ct);

        if (requestedBranchId.HasValue)
            return requestedBranchId.Value;

        if (accessible.Count == 1)
            return accessible[0];

        if (accessible.Count == 0)
        {
            throw new InvalidOperationException(
                "No authorized branch is assigned to this user. Ask an administrator to assign a branch.");
        }

        throw new InvalidOperationException(
            "Branch selection is required. Select an authorized branch and try again.");
    }
}
