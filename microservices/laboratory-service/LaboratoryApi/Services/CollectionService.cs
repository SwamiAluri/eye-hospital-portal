using System.Collections.Concurrent;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using LaboratoryApi.Data;
using LaboratoryApi.Domain;
using Microsoft.EntityFrameworkCore;

namespace LaboratoryApi.Services;

public interface ICollectionService
{
    Task<PagedResult<CollectionTaskListItemDto>> ListAsync(
        Guid tenantId, CollectionTaskListQuery query, CancellationToken ct = default);
    Task<CollectionTaskDetailDto> GetAsync(Guid tenantId, Guid taskId, CancellationToken ct = default);
    Task<CollectionPlanContextDto> GetPlanContextAsync(Guid tenantId, Guid orderId, CancellationToken ct = default);
    Task<CollectionTaskDetailDto> CreateAsync(
        Guid tenantId, Guid actorId, CreateCollectionTaskRequest req, CancellationToken ct = default);
    Task<CollectionTaskDetailDto> TransitionAsync(
        Guid tenantId, Guid actorId, Guid taskId, TransitionCollectionTaskRequest req, CancellationToken ct = default);
    Task<CollectionTaskDetailDto> ClaimAsync(
        Guid tenantId, Guid actorId, Guid taskId, ClaimCollectionTaskRequest req, CancellationToken ct = default);
    Task<CollectionTaskDetailDto> AssignAsync(
        Guid tenantId, Guid actorId, Guid taskId, AssignCollectionTaskRequest req, CancellationToken ct = default);
    Task<CollectionTaskDetailDto> ReleaseAsync(
        Guid tenantId, Guid actorId, Guid taskId, ReleaseCollectionTaskRequest req, CancellationToken ct = default);
}

/// <summary>L-COL-01B CollectionTask planning foundation. No Specimen / Receiving.</summary>
public sealed class CollectionService : ICollectionService
{
    private readonly LaboratoryDbContext _db;
    private readonly IPlatformAuditClient _audit;
    private readonly IPlatformReferenceClient _platform;

    private static readonly JsonSerializerOptions JsonOpts = HttpRequestDataExtensions.JsonOpts;
    private static readonly ConcurrentDictionary<string, SemaphoreSlim> SequenceGates = new();

    public CollectionService(
        LaboratoryDbContext db,
        IPlatformAuditClient audit,
        IPlatformReferenceClient platform)
    {
        _db = db;
        _audit = audit;
        _platform = platform;
    }

    public async Task<PagedResult<CollectionTaskListItemDto>> ListAsync(
        Guid tenantId, CollectionTaskListQuery query, CancellationToken ct = default)
    {
        var page = query.Page < 1 ? 1 : query.Page;
        var pageSize = query.PageSize is < 1 or > 100 ? 25 : query.PageSize;

        var q = _db.CollectionTasks.AsNoTracking().Where(t => t.TenantId == tenantId);

        if (!string.IsNullOrWhiteSpace(query.Status))
            q = q.Where(t => t.Status == query.Status.Trim());
        if (query.CollectionBranchId is { } bid)
            q = q.Where(t => t.CollectionBranchId == bid);
        if (query.OrderId is { } oid)
            q = q.Where(t => t.OrderId == oid);
        if (!string.IsNullOrWhiteSpace(query.Search))
        {
            // PD-COL-SEARCH-01 — case-insensitive TaskNumber contains (Orders-aligned).
            var s = query.Search.Trim().ToLower();
            q = q.Where(t => t.TaskNumber.ToLower().Contains(s));
        }

        var total = await q.CountAsync(ct);
        var tasks = await q.OrderByDescending(t => t.CreatedAt)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .ToListAsync(ct);

        var orderIds = tasks.Select(t => t.OrderId).Distinct().ToList();
        var orders = await _db.Orders.AsNoTracking()
            .Where(o => o.TenantId == tenantId && orderIds.Contains(o.Id))
            .ToDictionaryAsync(o => o.Id, ct);
        var versionIds = orders.Values.Where(o => o.CurrentVersionId != null)
            .Select(o => o.CurrentVersionId!.Value).ToList();
        var versions = await _db.OrderVersions.AsNoTracking()
            .Where(v => v.TenantId == tenantId && versionIds.Contains(v.Id))
            .ToDictionaryAsync(v => v.Id, ct);
        var taskIds = tasks.Select(t => t.Id).ToList();
        var linkCounts = await _db.CollectionTaskOrderTests.AsNoTracking()
            .Where(l => l.TenantId == tenantId && taskIds.Contains(l.CollectionTaskId))
            .GroupBy(l => l.CollectionTaskId)
            .Select(g => new { TaskId = g.Key, Count = g.Count() })
            .ToDictionaryAsync(x => x.TaskId, x => x.Count, ct);

        var items = tasks.Select(t =>
        {
            orders.TryGetValue(t.OrderId, out var order);
            LmsOrderVersion? ver = null;
            if (order?.CurrentVersionId is { } vid)
                versions.TryGetValue(vid, out ver);
            linkCounts.TryGetValue(t.Id, out var count);
            return new CollectionTaskListItemDto(
                t.Id,
                t.TaskNumber,
                t.OrderId,
                order?.OrderNumber ?? string.Empty,
                t.CollectionBranchId,
                t.Status,
                t.ClaimedByUserId,
                t.AssignedToUserId,
                ver?.PatientNameSnapshot,
                ver?.PatientMrnSnapshot,
                count,
                t.CreatedAt,
                t.RowVersion);
        }).ToList();

        return new PagedResult<CollectionTaskListItemDto>(items, page, pageSize, total);
    }

    public async Task<CollectionTaskDetailDto> GetAsync(
        Guid tenantId, Guid taskId, CancellationToken ct = default)
        => await MapDetailAsync(tenantId, taskId, ct);

    public async Task<CollectionPlanContextDto> GetPlanContextAsync(
        Guid tenantId, Guid orderId, CancellationToken ct = default)
    {
        var order = await _db.Orders.AsNoTracking()
            .FirstOrDefaultAsync(o => o.Id == orderId && o.TenantId == tenantId, ct)
            ?? throw new CollectionDomainException("Order not found.", statusCode: 404, code: "not_found");

        if (order.Status == OrderStatuses.Draft)
            throw new CollectionDomainException(
                "Draft orders cannot be planned for collection.", code: "order_not_submitted");
        if (order.Status == OrderStatuses.Cancelled)
            throw new CollectionDomainException(
                "Cancelled orders cannot be planned for collection.", code: "order_cancelled");
        if (order.Status != OrderStatuses.Submitted)
            throw new CollectionDomainException(
                "Only Submitted orders can be planned for collection.", code: "order_not_submitted");
        if (order.CurrentVersionId is null)
            throw new CollectionDomainException("Order has no current version.", code: "order_invalid");

        var version = await _db.OrderVersions.AsNoTracking()
            .FirstAsync(v => v.Id == order.CurrentVersionId && v.TenantId == tenantId, ct);

        var tests = await _db.OrderTests.AsNoTracking()
            .Where(t => t.OrderVersionId == version.Id && t.TenantId == tenantId)
            .OrderBy(t => t.SortOrder)
            .ToListAsync(ct);

        var plannedIds = await _db.CollectionTaskOrderTests.AsNoTracking()
            .Where(l => l.TenantId == tenantId && l.OrderId == orderId)
            .Join(
                _db.CollectionTasks.AsNoTracking().Where(t =>
                    t.TenantId == tenantId && t.Status != CollectionTaskStatuses.Cancelled),
                l => l.CollectionTaskId,
                t => t.Id,
                (l, _) => l.OrderTestId)
            .Distinct()
            .ToListAsync(ct);
        var plannedSet = plannedIds.ToHashSet();

        var dtoTests = tests.Select(t => new CollectionPlanContextOrderTestDto(
            t.Id,
            t.DisplayNameSnapshot,
            t.InternalOrderCodeSnapshot,
            t.Status,
            t.SortOrder,
            plannedSet.Contains(t.Id))).ToList();

        return new CollectionPlanContextDto(
            order.Id,
            order.OrderNumber,
            order.Status,
            order.OperatingBranchId,
            version.PatientId,
            version.PatientMrnSnapshot,
            version.PatientNameSnapshot,
            version.VisitId,
            dtoTests);
    }

    public async Task<CollectionTaskDetailDto> CreateAsync(
        Guid tenantId, Guid actorId, CreateCollectionTaskRequest req, CancellationToken ct = default)
    {
        var hash = HashRequest(new
        {
            req.OrderId,
            req.CollectionBranchId,
            OrderTestIds = req.OrderTestIds.OrderBy(x => x).ToArray(),
            req.LocationText,
            req.Notes,
        });
        var idem = await ClaimIdempotencyAsync(tenantId, req.IdempotencyKey, "create", hash, ct);
        if (idem.Replay is not null)
            return idem.Replay;

        var completed = false;
        try
        {
            _db.ChangeTracker.Clear();

            if (req.CollectionBranchId == Guid.Empty)
                throw new CollectionDomainException("CollectionBranchId is required.", code: "branch_required");
            if (req.OrderTestIds is null || req.OrderTestIds.Count == 0)
                throw new CollectionDomainException(
                    "At least one OrderTest must be selected explicitly.", code: "order_tests_required");
            if (req.OrderTestIds.Distinct().Count() != req.OrderTestIds.Count)
                throw new CollectionDomainException("Duplicate OrderTest selections are not allowed.", code: "order_tests_duplicate");

            var order = await _db.Orders.AsNoTracking()
                .FirstOrDefaultAsync(o => o.Id == req.OrderId && o.TenantId == tenantId, ct)
                ?? throw new CollectionDomainException("Order not found.", statusCode: 404, code: "not_found");

            if (order.Status == OrderStatuses.Draft)
                throw new CollectionDomainException(
                    "Draft orders cannot be planned for collection.", code: "order_not_submitted");
            if (order.Status == OrderStatuses.Cancelled)
                throw new CollectionDomainException(
                    "Cancelled orders cannot be planned for collection.", code: "order_cancelled");
            if (order.Status != OrderStatuses.Submitted)
                throw new CollectionDomainException(
                    "Only Submitted orders can be planned for collection.", code: "order_not_submitted");
            if (order.CurrentVersionId is null)
                throw new CollectionDomainException("Order has no current version.", code: "order_invalid");

            var version = await _db.OrderVersions.AsNoTracking()
                .FirstAsync(v => v.Id == order.CurrentVersionId && v.TenantId == tenantId, ct);

            var tests = await _db.OrderTests.AsNoTracking()
                .Where(t => t.TenantId == tenantId
                            && t.OrderVersionId == version.Id
                            && req.OrderTestIds.Contains(t.Id))
                .ToListAsync(ct);

            if (tests.Count != req.OrderTestIds.Count)
                throw new CollectionDomainException(
                    "One or more OrderTests do not belong to this order.", code: "order_test_mismatch");

            foreach (var t in tests)
            {
                if (t.Status != OrderTestStatuses.Ordered)
                    throw new CollectionDomainException(
                        "Only Ordered OrderTests are eligible for collection planning.",
                        code: "order_test_not_eligible");
            }

            var alreadyLinked = await _db.CollectionTaskOrderTests.AsNoTracking()
                .Where(l => l.TenantId == tenantId && req.OrderTestIds.Contains(l.OrderTestId))
                .Join(
                    _db.CollectionTasks.AsNoTracking().Where(t =>
                        t.TenantId == tenantId && t.Status != CollectionTaskStatuses.Cancelled),
                    l => l.CollectionTaskId,
                    t => t.Id,
                    (l, _) => l.OrderTestId)
                .Distinct()
                .ToListAsync(ct);
            if (alreadyLinked.Count > 0)
                throw new CollectionDomainException(
                    "One or more OrderTests are already assigned to an active collection task.",
                    code: "order_test_already_planned");

            var now = DateTime.UtcNow;
            var taskId = Guid.NewGuid();
            var taskNumber = await AllocateTaskNumberAsync(tenantId, now, ct);

            var task = new LmsCollectionTask
            {
                Id = taskId,
                TenantId = tenantId,
                TaskNumber = taskNumber,
                OrderId = order.Id,
                CollectionBranchId = req.CollectionBranchId,
                LocationText = TrimOrNull(req.LocationText),
                Status = CollectionTaskStatuses.Planned,
                Notes = TrimOrNull(req.Notes),
                CreatedAt = now,
                CreatedBy = actorId,
                RowVersion = 1,
            };

            var sort = 0;
            foreach (var otId in req.OrderTestIds)
            {
                task.OrderTests.Add(new LmsCollectionTaskOrderTest
                {
                    Id = Guid.NewGuid(),
                    TenantId = tenantId,
                    CollectionTaskId = taskId,
                    OrderId = order.Id,
                    OrderTestId = otId,
                    SortOrder = sort++,
                });
            }

            _db.CollectionTasks.Add(task);
            await _db.SaveChangesAsync(ct);

            try
            {
                await _audit.WriteAsync(
                    tenantId, actorId, CollectionAuditActions.CreateTask,
                    CollectionAuditResourceTypes.CollectionTask, taskId, ct: ct,
                    newValues: $"status={CollectionTaskStatuses.Planned}; taskNumber={taskNumber}; orderId={order.Id}; tests={req.OrderTestIds.Count}");
            }
            catch (CatalogueDomainException)
            {
                _db.CollectionTaskOrderTests.RemoveRange(task.OrderTests);
                _db.CollectionTasks.Remove(task);
                await _db.SaveChangesAsync(ct);
                throw new CollectionDomainException(
                    "Collection mutation aborted: platform audit write failed.",
                    statusCode: 503,
                    code: "audit_unavailable");
            }

            var detail = await MapDetailAsync(tenantId, taskId, ct);
            await CompleteIdempotencyAsync(tenantId, idem.ClaimId, detail, ct);
            completed = true;
            return detail;
        }
        finally
        {
            if (!completed)
                await ReleaseIdempotencyClaimAsync(tenantId, idem.ClaimId, ct);
        }
    }

    public async Task<CollectionTaskDetailDto> TransitionAsync(
        Guid tenantId, Guid actorId, Guid taskId, TransitionCollectionTaskRequest req, CancellationToken ct = default)
    {
        var hash = HashRequest(new { taskId, req.ExpectedRowVersion, req.TargetStatus, req.Reason });
        var idem = await ClaimIdempotencyAsync(tenantId, req.IdempotencyKey, "transition", hash, ct);
        if (idem.Replay is not null)
            return idem.Replay;

        var completed = false;
        try
        {
            var task = await LoadTaskTrackedAsync(tenantId, taskId, ct);
            EnsureExpectedRowVersion(task, req.ExpectedRowVersion);
            EnsureNotTerminal(task);

            var target = (req.TargetStatus ?? string.Empty).Trim();
            if (!CollectionTaskStatuses.IsValid(target))
                throw new CollectionDomainException("Target status is invalid.", code: "status_invalid");

            if (!IsAllowedTransition(task.Status, target))
                throw new CollectionDomainException(
                    $"Transition from {task.Status} to {target} is not allowed.",
                    code: "invalid_transition");

            if (target == CollectionTaskStatuses.Cancelled && string.IsNullOrWhiteSpace(req.Reason))
                throw new CollectionDomainException("Cancel reason is required.", code: "cancel_reason_required");

            var prior = task.Status;
            task.Status = target;
            task.UpdatedAt = DateTime.UtcNow;
            task.UpdatedBy = actorId;
            task.RowVersion++;
            if (target == CollectionTaskStatuses.Cancelled)
                task.CancelReason = TrimOrNull(req.Reason);

            try
            {
                await _db.SaveChangesAsync(ct);
            }
            catch (DbUpdateConcurrencyException)
            {
                throw new CollectionDomainException(
                    "Collection task was modified by another user. Reload and retry.",
                    statusCode: 409,
                    code: "concurrency_conflict");
            }

            var action = target == CollectionTaskStatuses.Cancelled
                ? CollectionAuditActions.CancelTask
                : CollectionAuditActions.TransitionTask;

            try
            {
                await _audit.WriteAsync(
                    tenantId, actorId, action, CollectionAuditResourceTypes.CollectionTask, taskId, ct: ct,
                    oldValues: $"status={prior}",
                    newValues: $"status={target}");
            }
            catch (CatalogueDomainException)
            {
                task.Status = prior;
                task.CancelReason = target == CollectionTaskStatuses.Cancelled ? null : task.CancelReason;
                task.RowVersion--;
                await _db.SaveChangesAsync(ct);
                throw new CollectionDomainException(
                    "Collection mutation aborted: platform audit write failed.",
                    statusCode: 503,
                    code: "audit_unavailable");
            }

            var detail = await MapDetailAsync(tenantId, taskId, ct);
            await CompleteIdempotencyAsync(tenantId, idem.ClaimId, detail, ct);
            completed = true;
            return detail;
        }
        finally
        {
            if (!completed)
                await ReleaseIdempotencyClaimAsync(tenantId, idem.ClaimId, ct);
        }
    }

    public async Task<CollectionTaskDetailDto> ClaimAsync(
        Guid tenantId, Guid actorId, Guid taskId, ClaimCollectionTaskRequest req, CancellationToken ct = default)
    {
        var hash = HashRequest(new { taskId, req.ExpectedRowVersion, actorId });
        var idem = await ClaimIdempotencyAsync(tenantId, req.IdempotencyKey, "claim", hash, ct);
        if (idem.Replay is not null)
            return idem.Replay;

        var completed = false;
        try
        {
            var task = await LoadTaskTrackedAsync(tenantId, taskId, ct);
            EnsureExpectedRowVersion(task, req.ExpectedRowVersion);
            EnsureNotTerminal(task);

            // PD-COL-OWN-02: Assigned to another user → claim forbidden.
            if (task.AssignedToUserId is { } assignee && assignee != actorId)
                throw new CollectionDomainException(
                    "Collection task is assigned to another user.",
                    statusCode: 409,
                    code: "claim_conflict");

            if (task.ClaimedByUserId is { } existing && existing != actorId)
                throw new CollectionDomainException(
                    "Collection task is already claimed by another user.",
                    statusCode: 409,
                    code: "claim_conflict");

            if (task.ClaimedByUserId == actorId)
            {
                var already = await MapDetailAsync(tenantId, taskId, ct);
                await CompleteIdempotencyAsync(tenantId, idem.ClaimId, already, ct);
                completed = true;
                return already;
            }

            // Claim never silently modifies AssignedToUserId (PD-COL-OWN-02 rule 8).
            var now = DateTime.UtcNow;
            task.ClaimedByUserId = actorId;
            task.ClaimedAt = now;
            task.UpdatedAt = now;
            task.UpdatedBy = actorId;
            task.RowVersion++;

            try
            {
                await _db.SaveChangesAsync(ct);
            }
            catch (DbUpdateConcurrencyException)
            {
                throw new CollectionDomainException(
                    "Collection task was modified by another user. Reload and retry.",
                    statusCode: 409,
                    code: "concurrency_conflict");
            }

            try
            {
                await _audit.WriteAsync(
                    tenantId, actorId, CollectionAuditActions.ClaimTask,
                    CollectionAuditResourceTypes.CollectionTask, taskId, ct: ct,
                    newValues: $"claimedBy={actorId}");
            }
            catch (CatalogueDomainException)
            {
                task.ClaimedByUserId = null;
                task.ClaimedAt = null;
                task.RowVersion--;
                await _db.SaveChangesAsync(ct);
                throw new CollectionDomainException(
                    "Collection mutation aborted: platform audit write failed.",
                    statusCode: 503,
                    code: "audit_unavailable");
            }

            var detail = await MapDetailAsync(tenantId, taskId, ct);
            await CompleteIdempotencyAsync(tenantId, idem.ClaimId, detail, ct);
            completed = true;
            return detail;
        }
        finally
        {
            if (!completed)
                await ReleaseIdempotencyClaimAsync(tenantId, idem.ClaimId, ct);
        }
    }

    public async Task<CollectionTaskDetailDto> AssignAsync(
        Guid tenantId, Guid actorId, Guid taskId, AssignCollectionTaskRequest req, CancellationToken ct = default)
    {
        var hash = HashRequest(new { taskId, req.ExpectedRowVersion, req.AssignToUserId });
        var idem = await ClaimIdempotencyAsync(tenantId, req.IdempotencyKey, "assign", hash, ct);
        if (idem.Replay is not null)
            return idem.Replay;

        var completed = false;
        try
        {
            if (req.AssignToUserId == Guid.Empty)
                throw new CollectionDomainException("AssignToUserId is required.", code: "assignee_required");

            // PD-COL-OWN-05 — assignee must be active same-tenant holder of lms.collection.collect.
            try
            {
                await _platform.ValidateUserWithPermissionAsync(
                    tenantId, req.AssignToUserId, LaboratoryAuthz.CollectionCollect, ct);
            }
            catch (OrderDomainException ex)
            {
                throw new CollectionDomainException(
                    ex.Message,
                    statusCode: ex.StatusCode is >= 400 and < 500 ? ex.StatusCode : 400,
                    code: ex.Code ?? "assignee_ineligible");
            }

            var task = await LoadTaskTrackedAsync(tenantId, taskId, ct);
            EnsureExpectedRowVersion(task, req.ExpectedRowVersion);
            EnsureNotTerminal(task);

            // PD-COL-OWN-02: while a claim is active, only the claimer may Assign, and only to themselves
            // (Assigned A + Claimed A). Prevents Unassigned+Claimed→Assign-to-other and AssignedA+ClaimedB.
            if (task.ClaimedByUserId is { } claimer)
            {
                if (actorId != claimer || req.AssignToUserId != claimer)
                    throw new CollectionDomainException(
                        "Cannot assign a collection task while another user holds an active claim.",
                        statusCode: 409,
                        code: "assign_conflict");
            }

            // Assign never silently clears ClaimedByUserId (PD-COL-OWN-02 rule 7).
            var prior = task.AssignedToUserId;
            var now = DateTime.UtcNow;
            task.AssignedToUserId = req.AssignToUserId;
            task.AssignedAt = now;
            task.UpdatedAt = now;
            task.UpdatedBy = actorId;
            task.RowVersion++;

            try
            {
                await _db.SaveChangesAsync(ct);
            }
            catch (DbUpdateConcurrencyException)
            {
                throw new CollectionDomainException(
                    "Collection task was modified by another user. Reload and retry.",
                    statusCode: 409,
                    code: "concurrency_conflict");
            }

            try
            {
                await _audit.WriteAsync(
                    tenantId, actorId, CollectionAuditActions.AssignTask,
                    CollectionAuditResourceTypes.CollectionTask, taskId, ct: ct,
                    oldValues: prior is null ? null : $"assignedTo={prior}",
                    newValues: $"assignedTo={req.AssignToUserId}");
            }
            catch (CatalogueDomainException)
            {
                task.AssignedToUserId = prior;
                task.RowVersion--;
                await _db.SaveChangesAsync(ct);
                throw new CollectionDomainException(
                    "Collection mutation aborted: platform audit write failed.",
                    statusCode: 503,
                    code: "audit_unavailable");
            }

            var detail = await MapDetailAsync(tenantId, taskId, ct);
            await CompleteIdempotencyAsync(tenantId, idem.ClaimId, detail, ct);
            completed = true;
            return detail;
        }
        finally
        {
            if (!completed)
                await ReleaseIdempotencyClaimAsync(tenantId, idem.ClaimId, ct);
        }
    }

    public async Task<CollectionTaskDetailDto> ReleaseAsync(
        Guid tenantId, Guid actorId, Guid taskId, ReleaseCollectionTaskRequest req, CancellationToken ct = default)
    {
        var hash = HashRequest(new { taskId, req.ExpectedRowVersion });
        var idem = await ClaimIdempotencyAsync(tenantId, req.IdempotencyKey, "release", hash, ct);
        if (idem.Replay is not null)
            return idem.Replay;

        var completed = false;
        try
        {
            var task = await LoadTaskTrackedAsync(tenantId, taskId, ct);
            EnsureExpectedRowVersion(task, req.ExpectedRowVersion);
            EnsureNotTerminal(task);

            if (task.ClaimedByUserId is null)
            {
                var already = await MapDetailAsync(tenantId, taskId, ct);
                await CompleteIdempotencyAsync(tenantId, idem.ClaimId, already, ct);
                completed = true;
                return already;
            }

            if (task.ClaimedByUserId != actorId)
                throw new CollectionDomainException(
                    "Only the claiming user may release this claim (manage reassignment is out of scope).",
                    statusCode: 403,
                    code: "release_forbidden");

            var prior = task.ClaimedByUserId;
            task.ClaimedByUserId = null;
            task.ClaimedAt = null;
            task.UpdatedAt = DateTime.UtcNow;
            task.UpdatedBy = actorId;
            task.RowVersion++;

            try
            {
                await _db.SaveChangesAsync(ct);
            }
            catch (DbUpdateConcurrencyException)
            {
                throw new CollectionDomainException(
                    "Collection task was modified by another user. Reload and retry.",
                    statusCode: 409,
                    code: "concurrency_conflict");
            }

            try
            {
                await _audit.WriteAsync(
                    tenantId, actorId, CollectionAuditActions.ReleaseTask,
                    CollectionAuditResourceTypes.CollectionTask, taskId, ct: ct,
                    oldValues: $"claimedBy={prior}",
                    newValues: "claimedBy=");
            }
            catch (CatalogueDomainException)
            {
                task.ClaimedByUserId = prior;
                task.RowVersion--;
                await _db.SaveChangesAsync(ct);
                throw new CollectionDomainException(
                    "Collection mutation aborted: platform audit write failed.",
                    statusCode: 503,
                    code: "audit_unavailable");
            }

            var detail = await MapDetailAsync(tenantId, taskId, ct);
            await CompleteIdempotencyAsync(tenantId, idem.ClaimId, detail, ct);
            completed = true;
            return detail;
        }
        finally
        {
            if (!completed)
                await ReleaseIdempotencyClaimAsync(tenantId, idem.ClaimId, ct);
        }
    }

    // ─── helpers ─────────────────────────────────────────────────────────────

    private static bool IsAllowedTransition(string from, string to)
    {
        if (from == to) return false;
        if (CollectionTaskStatuses.IsTerminal(from)) return false;
        if (to == CollectionTaskStatuses.Cancelled) return true;
        return (from, to) switch
        {
            (CollectionTaskStatuses.Planned, CollectionTaskStatuses.Ready) => true,
            (CollectionTaskStatuses.Ready, CollectionTaskStatuses.InProgress) => true,
            (CollectionTaskStatuses.InProgress, CollectionTaskStatuses.Completed) => true,
            _ => false,
        };
    }

    private async Task<LmsCollectionTask> LoadTaskTrackedAsync(Guid tenantId, Guid taskId, CancellationToken ct)
    {
        var task = await _db.CollectionTasks
            .FirstOrDefaultAsync(t => t.Id == taskId && t.TenantId == tenantId, ct);
        if (task is null)
            throw new CollectionDomainException("Collection task not found.", statusCode: 404, code: "not_found");
        return task;
    }

    private static void EnsureExpectedRowVersion(LmsCollectionTask task, int expected)
    {
        if (expected != 0 && expected != task.RowVersion)
            throw new CollectionDomainException(
                "Collection task was modified by another user. Reload and retry.",
                statusCode: 409,
                code: "concurrency_conflict");
    }

    private static void EnsureNotTerminal(LmsCollectionTask task)
    {
        if (CollectionTaskStatuses.IsTerminal(task.Status))
            throw new CollectionDomainException(
                "Terminal collection tasks cannot be mutated.",
                code: "terminal_state");
    }

    private async Task<CollectionTaskDetailDto> MapDetailAsync(Guid tenantId, Guid taskId, CancellationToken ct)
    {
        var task = await _db.CollectionTasks.AsNoTracking()
            .FirstOrDefaultAsync(t => t.Id == taskId && t.TenantId == tenantId, ct)
            ?? throw new CollectionDomainException("Collection task not found.", statusCode: 404, code: "not_found");

        var order = await _db.Orders.AsNoTracking()
            .FirstOrDefaultAsync(o => o.Id == task.OrderId && o.TenantId == tenantId, ct);

        LmsOrderVersion? version = null;
        if (order?.CurrentVersionId is { } vid)
            version = await _db.OrderVersions.AsNoTracking()
                .FirstOrDefaultAsync(v => v.Id == vid && v.TenantId == tenantId, ct);

        var links = await _db.CollectionTaskOrderTests.AsNoTracking()
            .Where(l => l.CollectionTaskId == taskId && l.TenantId == tenantId)
            .OrderBy(l => l.SortOrder)
            .ToListAsync(ct);

        var otIds = links.Select(l => l.OrderTestId).ToList();
        var tests = await _db.OrderTests.AsNoTracking()
            .Where(t => t.TenantId == tenantId && otIds.Contains(t.Id))
            .ToDictionaryAsync(t => t.Id, ct);

        var otDtos = links.Select(l =>
        {
            tests.TryGetValue(l.OrderTestId, out var ot);
            return new CollectionTaskOrderTestDto(
                l.Id,
                l.OrderTestId,
                l.OrderId,
                l.SortOrder,
                ot?.DisplayNameSnapshot,
                ot?.InternalOrderCodeSnapshot,
                ot?.Status);
        }).ToList();

        return new CollectionTaskDetailDto(
            task.Id,
            task.TaskNumber,
            task.OrderId,
            order?.OrderNumber ?? string.Empty,
            task.CollectionBranchId,
            task.LocationText,
            task.Status,
            task.ClaimedByUserId,
            task.ClaimedAt,
            task.AssignedToUserId,
            task.AssignedAt,
            task.Notes,
            task.CancelReason,
            task.CreatedAt,
            task.CreatedBy,
            task.UpdatedAt,
            task.UpdatedBy,
            task.RowVersion,
            version?.PatientNameSnapshot,
            version?.PatientMrnSnapshot,
            version?.PatientDateOfBirthSnapshot,
            version?.PatientId,
            version?.VisitId,
            otDtos);
    }

    private async Task<string> AllocateTaskNumberAsync(Guid tenantId, DateTime utcNow, CancellationToken ct)
    {
        var date = DateOnly.FromDateTime(utcNow);

        if (_db.Database.IsNpgsql())
        {
            var seqId = Guid.NewGuid();
            var allocated = await _db.Database
                .SqlQuery<SequenceAllocRow>($"""
                    INSERT INTO lms_collection_task_number_sequences (id, tenant_id, sequence_date, last_value)
                    VALUES ({seqId}, {tenantId}, {date}, 1)
                    ON CONFLICT (tenant_id, sequence_date)
                    DO UPDATE SET last_value = lms_collection_task_number_sequences.last_value + 1
                    RETURNING last_value AS "Value"
                    """)
                .ToListAsync(ct);
            if (allocated.Count != 1)
                throw new CollectionDomainException("Failed to allocate task number.", statusCode: 500, code: "task_number_alloc");
            return $"COL-{date:yyyyMMdd}-{allocated[0].Value:D6}";
        }

        var gateKey = $"{tenantId:N}:{date:yyyyMMdd}";
        var gate = SequenceGates.GetOrAdd(gateKey, _ => new SemaphoreSlim(1, 1));
        await gate.WaitAsync(ct);
        try
        {
            for (var attempt = 0; attempt < 5; attempt++)
            {
                try
                {
                    var seq = await _db.CollectionTaskNumberSequences
                        .FirstOrDefaultAsync(s => s.TenantId == tenantId && s.SequenceDate == date, ct);
                    if (seq is null)
                    {
                        seq = new LmsCollectionTaskNumberSequence
                        {
                            Id = Guid.NewGuid(),
                            TenantId = tenantId,
                            SequenceDate = date,
                            LastValue = 0,
                        };
                        _db.CollectionTaskNumberSequences.Add(seq);
                    }

                    seq.LastValue++;
                    await _db.SaveChangesAsync(ct);
                    return $"COL-{date:yyyyMMdd}-{seq.LastValue:D6}";
                }
                catch (DbUpdateException ex) when (IsUniqueViolation(ex))
                {
                    foreach (var entry in _db.ChangeTracker.Entries<LmsCollectionTaskNumberSequence>().ToList())
                        entry.State = EntityState.Detached;
                }
            }

            throw new CollectionDomainException("Failed to allocate task number.", statusCode: 500, code: "task_number_alloc");
        }
        finally
        {
            gate.Release();
        }
    }

    private async Task<IdempotencyClaim> ClaimIdempotencyAsync(
        Guid tenantId, string? key, string operation, string requestHash, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(key))
            return new IdempotencyClaim(null, null);

        var normalized = key.Trim();
        var existing = await _db.CollectionIdempotencyRecords.AsNoTracking()
            .FirstOrDefaultAsync(r => r.TenantId == tenantId && r.IdempotencyKey == normalized, ct);
        if (existing is not null)
            return new IdempotencyClaim(null, ResolveIdempotentReplay(existing, operation, requestHash));

        var claimId = Guid.NewGuid();
        _db.CollectionIdempotencyRecords.Add(new LmsCollectionIdempotencyRecord
        {
            Id = claimId,
            TenantId = tenantId,
            IdempotencyKey = normalized,
            Operation = operation,
            RequestHash = requestHash,
            CollectionTaskId = Guid.Empty,
            ResponseJson = string.Empty,
            CreatedAt = DateTime.UtcNow,
        });

        try
        {
            await _db.SaveChangesAsync(ct);
            return new IdempotencyClaim(claimId, null);
        }
        catch (DbUpdateException ex) when (IsUniqueViolation(ex))
        {
            foreach (var entry in _db.ChangeTracker.Entries<LmsCollectionIdempotencyRecord>()
                         .Where(e => e.Entity.Id == claimId).ToList())
                entry.State = EntityState.Detached;

            for (var i = 0; i < 20; i++)
            {
                var raced = await _db.CollectionIdempotencyRecords.AsNoTracking()
                    .FirstOrDefaultAsync(r => r.TenantId == tenantId && r.IdempotencyKey == normalized, ct);
                if (raced is null)
                    break;
                if (!string.IsNullOrEmpty(raced.ResponseJson) && raced.CollectionTaskId != Guid.Empty)
                    return new IdempotencyClaim(null, ResolveIdempotentReplay(raced, operation, requestHash));
                await Task.Delay(25, ct);
            }

            var final = await _db.CollectionIdempotencyRecords.AsNoTracking()
                .FirstOrDefaultAsync(r => r.TenantId == tenantId && r.IdempotencyKey == normalized, ct)
                ?? throw new CollectionDomainException(
                    "Idempotency key conflict.",
                    statusCode: 409,
                    code: "idempotency_conflict");
            if (string.IsNullOrEmpty(final.ResponseJson) || final.CollectionTaskId == Guid.Empty)
                throw new CollectionDomainException(
                    "Idempotent request is still in progress. Retry shortly.",
                    statusCode: 409,
                    code: "idempotency_in_progress");
            return new IdempotencyClaim(null, ResolveIdempotentReplay(final, operation, requestHash));
        }
    }

    private static CollectionTaskDetailDto ResolveIdempotentReplay(
        LmsCollectionIdempotencyRecord existing, string operation, string requestHash)
    {
        if (!string.Equals(existing.Operation, operation, StringComparison.Ordinal)
            || !string.Equals(existing.RequestHash, requestHash, StringComparison.Ordinal))
            throw new CollectionDomainException(
                "Idempotency key was reused with a different request.",
                statusCode: 409,
                code: "idempotency_conflict");
        var detail = JsonSerializer.Deserialize<CollectionTaskDetailDto>(existing.ResponseJson, JsonOpts);
        if (detail is null)
            throw new CollectionDomainException(
                "Idempotency replay payload is corrupt.",
                statusCode: 500,
                code: "idempotency_corrupt");
        return detail;
    }

    private async Task CompleteIdempotencyAsync(
        Guid tenantId, Guid? claimId, CollectionTaskDetailDto detail, CancellationToken ct)
    {
        if (claimId is null) return;
        var record = await _db.CollectionIdempotencyRecords
            .FirstOrDefaultAsync(r => r.Id == claimId && r.TenantId == tenantId, ct);
        if (record is null) return;
        record.CollectionTaskId = detail.Id;
        record.ResponseJson = JsonSerializer.Serialize(detail, JsonOpts);
        await _db.SaveChangesAsync(ct);
    }

    private async Task ReleaseIdempotencyClaimAsync(Guid tenantId, Guid? claimId, CancellationToken ct)
    {
        if (claimId is null) return;
        var record = await _db.CollectionIdempotencyRecords
            .FirstOrDefaultAsync(r => r.Id == claimId && r.TenantId == tenantId, ct);
        if (record is null) return;
        _db.CollectionIdempotencyRecords.Remove(record);
        await _db.SaveChangesAsync(ct);
    }

    private static string HashRequest(object req)
    {
        var json = JsonSerializer.Serialize(req, JsonOpts);
        var bytes = SHA256.HashData(Encoding.UTF8.GetBytes(json));
        return Convert.ToHexString(bytes);
    }

    private static string? TrimOrNull(string? s) =>
        string.IsNullOrWhiteSpace(s) ? null : s.Trim();

    private static bool IsUniqueViolation(DbUpdateException ex) =>
        ex.InnerException?.Message.Contains("unique", StringComparison.OrdinalIgnoreCase) == true
        || ex.InnerException?.Message.Contains("duplicate", StringComparison.OrdinalIgnoreCase) == true;

    private sealed record IdempotencyClaim(Guid? ClaimId, CollectionTaskDetailDto? Replay);
    private sealed record SequenceAllocRow(int Value);
}
