using System.Collections.Concurrent;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using LaboratoryApi.Data;
using LaboratoryApi.Domain;
using Microsoft.EntityFrameworkCore;

namespace LaboratoryApi.Services;

public interface IOrderService
{
    Task<OrderDetailDto> CreateDraftAsync(Guid tenantId, Guid actorId, CreateOrderDraftRequest req, CancellationToken ct = default);
    Task<OrderDetailDto> UpdateDraftAsync(Guid tenantId, Guid actorId, Guid orderId, UpdateOrderDraftRequest req, CancellationToken ct = default);
    Task<OrderDetailDto> GetAsync(Guid tenantId, Guid orderId, CancellationToken ct = default);
    Task<PagedResult<OrderListItemDto>> ListAsync(Guid tenantId, OrderListQuery query, CancellationToken ct = default);
    Task<OrderDetailDto> SubmitAsync(Guid tenantId, Guid actorId, Guid orderId, SubmitOrderRequest req, CancellationToken ct = default);
    Task<OrderDetailDto> AmendAsync(Guid tenantId, Guid actorId, Guid orderId, AmendOrderRequest req, CancellationToken ct = default);
    Task<OrderDetailDto> CancelAsync(Guid tenantId, Guid actorId, Guid orderId, CancelOrderRequest req, CancellationToken ct = default);
    Task<IReadOnlyList<OrderVersionDto>> GetVersionsAsync(Guid tenantId, Guid orderId, CancellationToken ct = default);
}

public sealed class OrderService : IOrderService
{
    private readonly LaboratoryDbContext _db;
    private readonly IPlatformAuditClient _audit;
    private readonly IPlatformReferenceClient _platform;
    private readonly ICatalogueService _catalogue;

    private static readonly JsonSerializerOptions JsonOpts = HttpRequestDataExtensions.JsonOpts;

    /// <summary>Process-wide gate for InMemory/non-relational sequence allocation (tests).</summary>
    private static readonly ConcurrentDictionary<string, SemaphoreSlim> SequenceGates = new();

    public OrderService(
        LaboratoryDbContext db,
        IPlatformAuditClient audit,
        IPlatformReferenceClient platform,
        ICatalogueService catalogue)
    {
        _db = db;
        _audit = audit;
        _platform = platform;
        _catalogue = catalogue;
    }

    public async Task<OrderDetailDto> CreateDraftAsync(
        Guid tenantId, Guid actorId, CreateOrderDraftRequest req, CancellationToken ct = default)
    {
        if (!string.IsNullOrWhiteSpace(req.ClientOrderNumber))
            throw new OrderDomainException("Client-supplied order numbers are not permitted.", code: "order_number_client_forbidden");

        var hash = HashRequest(req);
        var idem = await ClaimIdempotencyAsync(tenantId, req.IdempotencyKey, "create", hash, ct);
        if (idem.Replay is not null)
            return idem.Replay;

        var idemCompleted = false;
        try
        {
            // Avoid catalogue concurrency tokens remaining tracked from prior operations in the same scope.
            _db.ChangeTracker.Clear();

            ValidateCompositionBasics(req.OrderSource, req.Priority, req.PriorityReason, req.ClinicalIndication,
                req.AcknowledgementEvidence, req.Selections);

            var ctx = await ValidateContextAsync(
                tenantId, req.PatientId, req.VisitId, req.OrderingProviderUserId, req.ResponsibleClinicianUserId,
                req.OperatingBranchId, captureSnapshots: false, ct);

            // Draft: resolve selections for type display only (Active not required until submit)
            var selectionMeta = await LoadSelectionMetaForDraftAsync(tenantId, req.Selections, ct);

            var now = DateTime.UtcNow;
            var orderId = Guid.NewGuid();
            var versionId = Guid.NewGuid();
            var orderNumber = await AllocateOrderNumberAsync(tenantId, now, ct);

            // Insert order without CurrentVersionId first: lms_orders.current_version_id FK
            // references lms_order_versions, and versions reference orders — a single insert with
            // both sides set fails on PostgreSQL (InMemory tests do not enforce this FK).
            var order = new LmsOrder
            {
                Id = orderId,
                TenantId = tenantId,
                OrderNumber = orderNumber,
                Status = OrderStatuses.Draft,
                CurrentVersionId = null,
                CurrentVersionNumber = 1,
                OperatingBranchId = req.OperatingBranchId,
                CreatedAt = now,
                CreatedBy = actorId,
                RowVersion = 1,
            };

            var version = BuildVersion(
                versionId, tenantId, orderId, 1, actorId, now,
                req.PatientId, null, null, null,
                req.VisitId,
                req.OrderingProviderUserId, null,
                req.ResponsibleClinicianUserId, null,
                req.OperatingBranchId,
                req.OrderSource, req.Priority, req.PriorityReason, req.ClinicalIndication, req.Notes,
                req.ConsentReference, req.ConsentTemplateVersionRef, req.AcknowledgementEvidence,
                req.PayerContextRef, req.AuthorizationReference, req.FinancialDispositionRef, req.ServiceCatalogRef,
                amendmentReason: null);

            // Draft may still show provider names for UX readability without freezing patient snapshots
            version.OrderingProviderNameSnapshot = ctx.Ordering.DisplayName;
            version.ResponsibleClinicianNameSnapshot = ctx.Responsible.DisplayName;

            ApplySelections(version, tenantId, selectionMeta);

            _db.Orders.Add(order);
            _db.OrderVersions.Add(version);

            try
            {
                await _db.SaveChangesAsync(ct);
                order.CurrentVersionId = versionId;
                await _db.SaveChangesAsync(ct);
            }
            catch (DbUpdateException ex) when (IsUniqueViolation(ex))
            {
                throw new OrderDomainException("Order number or idempotency conflict.", statusCode: 409, code: "conflict");
            }

            try
            {
                await _audit.WriteAsync(
                    tenantId, actorId, OrderAuditActions.CreateDraft, OrderAuditResourceTypes.Order, orderId, ct: ct,
                    newValues: $"status={OrderStatuses.Draft}; orderNumber={orderNumber}");
            }
            catch (CatalogueDomainException)
            {
                // Clear FK before deleting version (same circular FK constraint as create).
                order.CurrentVersionId = null;
                await _db.SaveChangesAsync(ct);
                _db.OrderSelections.RemoveRange(version.Selections);
                _db.OrderVersions.Remove(version);
                _db.Orders.Remove(order);
                await _db.SaveChangesAsync(ct);
                throw new OrderDomainException(
                    "Order mutation aborted: platform audit write failed.",
                    statusCode: 503,
                    code: "audit_unavailable");
            }

            var detail = await MapDetailAsync(tenantId, orderId, ct);
            await CompleteIdempotencyAsync(tenantId, idem.ClaimId, detail, ct);
            idemCompleted = true;
            return detail;
        }
        finally
        {
            if (!idemCompleted)
                await ReleaseIdempotencyClaimAsync(tenantId, idem.ClaimId, ct);
        }
    }

    public async Task<OrderDetailDto> UpdateDraftAsync(
        Guid tenantId, Guid actorId, Guid orderId, UpdateOrderDraftRequest req, CancellationToken ct = default)
    {
        ValidateCompositionBasics(req.OrderSource, req.Priority, req.PriorityReason, req.ClinicalIndication,
            req.AcknowledgementEvidence, req.Selections);

        _db.ChangeTracker.Clear();
        var order = await LoadOrderTrackedAsync(tenantId, orderId, ct);
        EnsureExpectedRowVersion(order, req.ExpectedRowVersion);
        if (order.Status != OrderStatuses.Draft)
            throw new OrderDomainException("Only Draft orders can be updated.", statusCode: 409, code: "invalid_state");

        var version = await _db.OrderVersions
            .FirstOrDefaultAsync(v => v.Id == order.CurrentVersionId && v.TenantId == tenantId, ct)
            ?? throw new OrderDomainException("Current order version not found.", statusCode: 404);

        var priorSummary = $"patient={version.PatientId}; source={version.OrderSource}; priority={version.Priority}";
        var priorBranch = order.OperatingBranchId;
        var priorVersion = CaptureVersionDraftState(version);
        var priorSelections = await _db.OrderSelections
            .Where(s => s.OrderVersionId == version.Id && s.TenantId == tenantId)
            .AsNoTracking()
            .ToListAsync(ct);

        var ctx = await ValidateContextAsync(
            tenantId, req.PatientId, req.VisitId, req.OrderingProviderUserId, req.ResponsibleClinicianUserId,
            req.OperatingBranchId, captureSnapshots: false, ct);

        var selectionMeta = await LoadSelectionMetaForDraftAsync(tenantId, req.Selections, ct);

        ApplyVersionDraftFields(version, req, ctx.Ordering, ctx.Responsible);

        var trackedPrior = await _db.OrderSelections
            .Where(s => s.OrderVersionId == version.Id && s.TenantId == tenantId)
            .ToListAsync(ct);
        if (trackedPrior.Count > 0)
            _db.OrderSelections.RemoveRange(trackedPrior);

        var newSelections = selectionMeta.Select(m => new LmsOrderSelection
        {
            Id = Guid.NewGuid(),
            TenantId = tenantId,
            OrderVersionId = version.Id,
            CatalogueItemId = m.CatalogueItemId,
            CatalogueVersionId = m.CatalogueVersionId,
            CatalogueType = m.CatalogueType,
            SortOrder = m.SortOrder,
            DisplayNameSnapshot = m.DisplayName,
            InternalOrderCodeSnapshot = m.InternalOrderCode,
        }).ToList();
        _db.OrderSelections.AddRange(newSelections);

        order.OperatingBranchId = req.OperatingBranchId;
        order.UpdatedAt = DateTime.UtcNow;
        order.UpdatedBy = actorId;
        order.RowVersion++;

        try
        {
            await _db.SaveChangesAsync(ct);
        }
        catch (DbUpdateConcurrencyException)
        {
            throw new OrderDomainException(
                "Order was modified by another user. Reload and retry.",
                statusCode: 409,
                code: "concurrency_conflict");
        }

        try
        {
            await _audit.WriteAsync(
                tenantId, actorId, OrderAuditActions.UpdateDraft, OrderAuditResourceTypes.Order, orderId, ct: ct,
                oldValues: priorSummary,
                newValues: SnapshotVersionSummary(version));
        }
        catch (CatalogueDomainException)
        {
            RestoreVersionDraftState(version, priorVersion);
            order.OperatingBranchId = priorBranch;
            order.RowVersion--;
            _db.OrderSelections.RemoveRange(newSelections);
            foreach (var s in priorSelections)
            {
                _db.OrderSelections.Add(new LmsOrderSelection
                {
                    Id = s.Id,
                    TenantId = s.TenantId,
                    OrderVersionId = s.OrderVersionId,
                    CatalogueItemId = s.CatalogueItemId,
                    CatalogueVersionId = s.CatalogueVersionId,
                    CatalogueType = s.CatalogueType,
                    SortOrder = s.SortOrder,
                    DisplayNameSnapshot = s.DisplayNameSnapshot,
                    InternalOrderCodeSnapshot = s.InternalOrderCodeSnapshot,
                });
            }
            await _db.SaveChangesAsync(ct);
            throw new OrderDomainException(
                "Order mutation aborted: platform audit write failed.",
                statusCode: 503,
                code: "audit_unavailable");
        }

        return await MapDetailAsync(tenantId, orderId, ct);
    }

    public async Task<OrderDetailDto> GetAsync(Guid tenantId, Guid orderId, CancellationToken ct = default)
        => await MapDetailAsync(tenantId, orderId, ct);

    public async Task<PagedResult<OrderListItemDto>> ListAsync(
        Guid tenantId, OrderListQuery query, CancellationToken ct = default)
    {
        var page = Math.Max(1, query.Page);
        var pageSize = Math.Clamp(query.PageSize, 1, 100);

        var q = _db.Orders.AsNoTracking().Where(o => o.TenantId == tenantId);
        if (!string.IsNullOrWhiteSpace(query.Status))
            q = q.Where(o => o.Status == query.Status.Trim());
        if (query.OperatingBranchId is { } bid)
            q = q.Where(o => o.OperatingBranchId == bid);
        if (query.PatientId is { } pid)
        {
            var orderIds = _db.OrderVersions.AsNoTracking()
                .Where(v => v.TenantId == tenantId && v.PatientId == pid)
                .Select(v => v.OrderId)
                .Distinct();
            q = q.Where(o => orderIds.Contains(o.Id));
        }
        if (!string.IsNullOrWhiteSpace(query.Search))
        {
            var s = query.Search.Trim().ToLower();
            q = q.Where(o => o.OrderNumber.ToLower().Contains(s));
        }

        var total = await q.CountAsync(ct);
        var rows = await q.OrderByDescending(o => o.CreatedAt)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .ToListAsync(ct);

        var versionIds = rows.Where(r => r.CurrentVersionId != null).Select(r => r.CurrentVersionId!.Value).ToList();
        var versions = await _db.OrderVersions.AsNoTracking()
            .Where(v => versionIds.Contains(v.Id))
            .ToDictionaryAsync(v => v.Id, ct);

        var items = rows.Select(o =>
        {
            versions.TryGetValue(o.CurrentVersionId ?? Guid.Empty, out var v);
            return new OrderListItemDto(
                o.Id,
                o.OrderNumber,
                o.Status,
                v?.PatientId ?? Guid.Empty,
                v?.PatientNameSnapshot,
                o.OperatingBranchId,
                v?.Priority ?? OrderPriorities.Routine,
                o.CreatedAt,
                o.RowVersion);
        }).ToList();

        return new PagedResult<OrderListItemDto>(items, page, pageSize, total);
    }

    public async Task<OrderDetailDto> SubmitAsync(
        Guid tenantId, Guid actorId, Guid orderId, SubmitOrderRequest req, CancellationToken ct = default)
    {
        var hash = HashRequest(new { orderId, req.ExpectedRowVersion });
        var op = $"submit:{orderId:D}";
        var idem = await ClaimIdempotencyAsync(tenantId, req.IdempotencyKey, op, hash, ct);
        if (idem.Replay is not null)
            return idem.Replay;

        var idemCompleted = false;
        try
        {
            _db.ChangeTracker.Clear();
            var order = await LoadOrderTrackedAsync(tenantId, orderId, ct);
            EnsureExpectedRowVersion(order, req.ExpectedRowVersion);
            if (order.Status != OrderStatuses.Draft)
                throw new OrderDomainException("Only Draft orders can be submitted.", statusCode: 409, code: "invalid_state");

            var version = await _db.OrderVersions
                .Include(v => v.Selections)
                .FirstAsync(v => v.Id == order.CurrentVersionId && v.TenantId == tenantId, ct);

            var asOf = DateTime.UtcNow;
            var patient = await _platform.ValidatePatientAsync(tenantId, version.PatientId, ct);
            if (version.VisitId is { } visitId)
                await _platform.ValidateVisitAsync(tenantId, visitId, version.PatientId, version.OperatingBranchId, ct);
            var ordering = await _platform.ValidateUserAsync(tenantId, version.OrderingProviderUserId, ct);
            var responsible = await _platform.ValidateUserAsync(tenantId, version.ResponsibleClinicianUserId, ct);

            ValidateCompositionBasics(
                version.OrderSource, version.Priority, version.PriorityReason, version.ClinicalIndication,
                version.AcknowledgementEvidence,
                version.Selections.Select(s => new OrderSelectionInput(s.CatalogueItemId, s.SortOrder)).ToList());

            if (version.Selections.Count == 0)
                throw new OrderDomainException("At least one catalogue selection is required.", code: "selections_required");

            // Atomic explode + pin (avoid navigation RemoveRange ghosts under InMemory)
            var priorTests = await _db.OrderTests
                .Where(t => t.OrderVersionId == version.Id && t.TenantId == tenantId)
                .ToListAsync(ct);
            if (priorTests.Count > 0)
                _db.OrderTests.RemoveRange(priorTests);

            var newTests = new List<LmsOrderTest>();
            var sort = 0;
            foreach (var sel in version.Selections.OrderBy(s => s.SortOrder))
            {
                var (item, catVer) = await _catalogue.ResolveOrderableAsync(
                    tenantId, sel.CatalogueItemId, version.OperatingBranchId, asOf, ct);

                sel.CatalogueVersionId = catVer.Id;
                sel.CatalogueType = item.CatalogueType;
                sel.DisplayNameSnapshot = catVer.DisplayName;
                sel.InternalOrderCodeSnapshot = catVer.InternalOrderCode;

                if (item.CatalogueType == CatalogueTypes.Panel)
                {
                    await ExplodePanelAsync(tenantId, version, sel, item, catVer, asOf, sort, newTests, ct);
                    sort = newTests.Count;
                }
                else
                {
                    newTests.Add(new LmsOrderTest
                    {
                        Id = Guid.NewGuid(),
                        TenantId = tenantId,
                        OrderVersionId = version.Id,
                        CatalogueItemId = item.Id,
                        CatalogueVersionId = catVer.Id,
                        CatalogueVersionNumber = catVer.VersionNumber,
                        CatalogueType = item.CatalogueType,
                        DisplayNameSnapshot = catVer.DisplayName,
                        InternalOrderCodeSnapshot = catVer.InternalOrderCode,
                        Status = OrderTestStatuses.Ordered,
                        SortOrder = sort++,
                    });
                }
            }

            _db.OrderTests.AddRange(newTests);

            version.PatientMrnSnapshot = patient.Mrn;
            version.PatientNameSnapshot = patient.DisplayName;
            version.PatientDateOfBirthSnapshot = patient.DateOfBirth;
            version.OrderingProviderNameSnapshot = ordering.DisplayName;
            version.ResponsibleClinicianNameSnapshot = responsible.DisplayName;
            version.PerformingBranchId = version.OperatingBranchId;
            version.SubmittedAt = asOf;
            version.SubmittedBy = actorId;

            var oldStatus = order.Status;
            order.Status = OrderStatuses.Submitted;
            order.UpdatedAt = asOf;
            order.UpdatedBy = actorId;
            order.RowVersion++;

            try
            {
                await _db.SaveChangesAsync(ct);
            }
            catch (DbUpdateConcurrencyException)
            {
                throw new OrderDomainException(
                    "Order was modified by another user. Reload and retry.",
                    statusCode: 409,
                    code: "concurrency_conflict");
            }

            try
            {
                await _audit.WriteAsync(
                    tenantId, actorId, OrderAuditActions.SubmitOrder, OrderAuditResourceTypes.Order, orderId, ct: ct,
                    oldValues: $"status={oldStatus}",
                    newValues: $"status={OrderStatuses.Submitted}; version={version.VersionNumber}; tests={newTests.Count}");
            }
            catch (CatalogueDomainException)
            {
                // Fail-closed compensate
                order.Status = OrderStatuses.Draft;
                order.RowVersion--;
                version.SubmittedAt = null;
                version.SubmittedBy = null;
                version.PatientMrnSnapshot = null;
                version.PatientNameSnapshot = null;
                version.PatientDateOfBirthSnapshot = null;
                _db.OrderTests.RemoveRange(newTests);
                await _db.SaveChangesAsync(ct);
                throw new OrderDomainException(
                    "Order mutation aborted: platform audit write failed.",
                    statusCode: 503,
                    code: "audit_unavailable");
            }

            var detail = await MapDetailAsync(tenantId, orderId, ct);
            await CompleteIdempotencyAsync(tenantId, idem.ClaimId, detail, ct);
            idemCompleted = true;
            return detail;
        }
        finally
        {
            if (!idemCompleted)
                await ReleaseIdempotencyClaimAsync(tenantId, idem.ClaimId, ct);
        }
    }

    public async Task<OrderDetailDto> AmendAsync(
        Guid tenantId, Guid actorId, Guid orderId, AmendOrderRequest req, CancellationToken ct = default)
    {
        if (string.IsNullOrWhiteSpace(req.AmendmentReason))
            throw new OrderDomainException("Amendment reason is required.", code: "amendment_reason_required");

        var hash = HashRequest(req);
        var op = $"amend:{orderId:D}";
        var idem = await ClaimIdempotencyAsync(tenantId, req.IdempotencyKey, op, hash, ct);
        if (idem.Replay is not null)
            return idem.Replay;

        var idemCompleted = false;
        try
        {
            ValidateCompositionBasics(req.OrderSource, req.Priority, req.PriorityReason, req.ClinicalIndication,
                req.AcknowledgementEvidence, req.Selections);

            _db.ChangeTracker.Clear();
            var order = await LoadOrderTrackedAsync(tenantId, orderId, ct);
            EnsureExpectedRowVersion(order, req.ExpectedRowVersion);
            if (order.Status != OrderStatuses.Submitted)
                throw new OrderDomainException("Only Submitted orders can be amended.", statusCode: 409, code: "invalid_state");

            var asOf = DateTime.UtcNow;
            var ctx = await ValidateContextAsync(
                tenantId, req.PatientId, req.VisitId, req.OrderingProviderUserId, req.ResponsibleClinicianUserId,
                req.OperatingBranchId, captureSnapshots: true, ct);

            var newVersionId = Guid.NewGuid();
            var newVersionNumber = order.CurrentVersionNumber + 1;
            var version = BuildVersion(
                newVersionId, tenantId, orderId, newVersionNumber, actorId, asOf,
                req.PatientId, ctx.Patient!.Mrn, ctx.Patient.DisplayName, ctx.Patient.DateOfBirth,
                req.VisitId,
                req.OrderingProviderUserId, ctx.Ordering.DisplayName,
                req.ResponsibleClinicianUserId, ctx.Responsible.DisplayName,
                req.OperatingBranchId,
                req.OrderSource, req.Priority, req.PriorityReason, req.ClinicalIndication, req.Notes,
                req.ConsentReference, req.ConsentTemplateVersionRef, req.AcknowledgementEvidence,
                req.PayerContextRef, req.AuthorizationReference, req.FinancialDispositionRef, req.ServiceCatalogRef,
                req.AmendmentReason.Trim());
            version.SubmittedAt = asOf;
            version.SubmittedBy = actorId;

            var selectionMeta = await ResolveSelectionsAtSubmitAsync(
                tenantId, req.OperatingBranchId, req.Selections, asOf, ct);
            ApplySelections(version, tenantId, selectionMeta);

            var newTests = new List<LmsOrderTest>();
            var sort = 0;
            foreach (var sel in version.Selections.OrderBy(s => s.SortOrder))
            {
                var (item, catVer) = await _catalogue.ResolveOrderableAsync(
                    tenantId, sel.CatalogueItemId, version.OperatingBranchId, asOf, ct);
                sel.CatalogueVersionId = catVer.Id;
                sel.CatalogueType = item.CatalogueType;
                sel.DisplayNameSnapshot = catVer.DisplayName;
                sel.InternalOrderCodeSnapshot = catVer.InternalOrderCode;

                if (item.CatalogueType == CatalogueTypes.Panel)
                {
                    await ExplodePanelAsync(tenantId, version, sel, item, catVer, asOf, sort, newTests, ct);
                    sort = newTests.Count;
                }
                else
                {
                    newTests.Add(new LmsOrderTest
                    {
                        Id = Guid.NewGuid(),
                        TenantId = tenantId,
                        OrderVersionId = version.Id,
                        CatalogueItemId = item.Id,
                        CatalogueVersionId = catVer.Id,
                        CatalogueVersionNumber = catVer.VersionNumber,
                        CatalogueType = item.CatalogueType,
                        DisplayNameSnapshot = catVer.DisplayName,
                        InternalOrderCodeSnapshot = catVer.InternalOrderCode,
                        Status = OrderTestStatuses.Ordered,
                        SortOrder = sort++,
                    });
                }
            }

            _db.OrderTests.AddRange(newTests);

            var priorVersionId = order.CurrentVersionId;
            var priorVersionNumber = order.CurrentVersionNumber;
            var priorBranch = order.OperatingBranchId;

            _db.OrderVersions.Add(version);
            order.CurrentVersionId = newVersionId;
            order.CurrentVersionNumber = newVersionNumber;
            order.OperatingBranchId = req.OperatingBranchId;
            order.UpdatedAt = asOf;
            order.UpdatedBy = actorId;
            order.RowVersion++;

            try
            {
                await _db.SaveChangesAsync(ct);
            }
            catch (DbUpdateConcurrencyException)
            {
                throw new OrderDomainException(
                    "Order was modified by another user. Reload and retry.",
                    statusCode: 409,
                    code: "concurrency_conflict");
            }

            try
            {
                await _audit.WriteAsync(
                    tenantId, actorId, OrderAuditActions.AmendOrder, OrderAuditResourceTypes.Order, orderId,
                    reason: req.AmendmentReason.Trim(), ct: ct,
                    oldValues: $"version={priorVersionNumber}; versionId={priorVersionId}",
                    newValues: $"version={newVersionNumber}; versionId={newVersionId}");
            }
            catch (CatalogueDomainException)
            {
                order.CurrentVersionId = priorVersionId;
                order.CurrentVersionNumber = priorVersionNumber;
                order.OperatingBranchId = priorBranch;
                order.RowVersion--;
                _db.OrderTests.RemoveRange(newTests);
                _db.OrderSelections.RemoveRange(version.Selections.ToList());
                _db.OrderVersions.Remove(version);
                await _db.SaveChangesAsync(ct);
                throw new OrderDomainException(
                    "Order mutation aborted: platform audit write failed.",
                    statusCode: 503,
                    code: "audit_unavailable");
            }

            var detail = await MapDetailAsync(tenantId, orderId, ct);
            await CompleteIdempotencyAsync(tenantId, idem.ClaimId, detail, ct);
            idemCompleted = true;
            return detail;
        }
        finally
        {
            if (!idemCompleted)
                await ReleaseIdempotencyClaimAsync(tenantId, idem.ClaimId, ct);
        }
    }

    public async Task<OrderDetailDto> CancelAsync(
        Guid tenantId, Guid actorId, Guid orderId, CancelOrderRequest req, CancellationToken ct = default)
    {
        if (string.IsNullOrWhiteSpace(req.Reason))
            throw new OrderDomainException("Cancel reason is required.", code: "cancel_reason_required");

        var hash = HashRequest(new { orderId, req.ExpectedRowVersion, req.Reason });
        var op = $"cancel:{orderId:D}";
        var idem = await ClaimIdempotencyAsync(tenantId, req.IdempotencyKey, op, hash, ct);
        if (idem.Replay is not null)
            return idem.Replay;

        var idemCompleted = false;
        try
        {
            _db.ChangeTracker.Clear();
            var order = await LoadOrderTrackedAsync(tenantId, orderId, ct);
            EnsureExpectedRowVersion(order, req.ExpectedRowVersion);
            if (order.Status == OrderStatuses.Cancelled)
                throw new OrderDomainException("Order is already cancelled.", statusCode: 409, code: "invalid_state");
            if (order.Status is not (OrderStatuses.Draft or OrderStatuses.Submitted))
                throw new OrderDomainException("Order cannot be cancelled from current state.", statusCode: 409, code: "invalid_state");

            var oldStatus = order.Status;
            var now = DateTime.UtcNow;
            order.Status = OrderStatuses.Cancelled;
            order.CancelledAt = now;
            order.CancelledBy = actorId;
            order.CancelReason = req.Reason.Trim();
            order.UpdatedAt = now;
            order.UpdatedBy = actorId;
            order.RowVersion++;

            try
            {
                await _db.SaveChangesAsync(ct);
            }
            catch (DbUpdateConcurrencyException)
            {
                throw new OrderDomainException(
                    "Order was modified by another user. Reload and retry.",
                    statusCode: 409,
                    code: "concurrency_conflict");
            }

            try
            {
                await _audit.WriteAsync(
                    tenantId, actorId, OrderAuditActions.CancelOrder, OrderAuditResourceTypes.Order, orderId,
                    reason: req.Reason.Trim(), ct: ct,
                    oldValues: $"status={oldStatus}",
                    newValues: $"status={OrderStatuses.Cancelled}");
            }
            catch (CatalogueDomainException)
            {
                order.Status = oldStatus;
                order.CancelledAt = null;
                order.CancelledBy = null;
                order.CancelReason = null;
                order.RowVersion--;
                await _db.SaveChangesAsync(ct);
                throw new OrderDomainException(
                    "Order mutation aborted: platform audit write failed.",
                    statusCode: 503,
                    code: "audit_unavailable");
            }

            var detail = await MapDetailAsync(tenantId, orderId, ct);
            await CompleteIdempotencyAsync(tenantId, idem.ClaimId, detail, ct);
            idemCompleted = true;
            return detail;
        }
        finally
        {
            if (!idemCompleted)
                await ReleaseIdempotencyClaimAsync(tenantId, idem.ClaimId, ct);
        }
    }

    public async Task<IReadOnlyList<OrderVersionDto>> GetVersionsAsync(
        Guid tenantId, Guid orderId, CancellationToken ct = default)
    {
        await EnsureOrderExistsAsync(tenantId, orderId, ct);
        var versions = await _db.OrderVersions.AsNoTracking()
            .Where(v => v.OrderId == orderId && v.TenantId == tenantId)
            .OrderBy(v => v.VersionNumber)
            .ToListAsync(ct);
        var result = new List<OrderVersionDto>();
        foreach (var v in versions)
            result.Add(await MapVersionAsync(v, ct));
        return result;
    }

    // ─── helpers ─────────────────────────────────────────────────────────────

    private async Task ExplodePanelAsync(
        Guid tenantId,
        LmsOrderVersion version,
        LmsOrderSelection panelSelection,
        LmsCatalogueItem panelItem,
        LmsCatalogueVersion panelVersion,
        DateTime asOf,
        int sortStart,
        List<LmsOrderTest> target,
        CancellationToken ct)
    {
        var components = await _db.CataloguePanelComponents.AsNoTracking()
            .Where(c => c.TenantId == tenantId && c.PanelVersionId == panelVersion.Id)
            .OrderBy(c => c.SortOrder)
            .ToListAsync(ct);

        if (components.Count == 0)
            throw new OrderDomainException("Panel has no components.", code: "panel_empty");

        var sort = sortStart;
        foreach (var c in components)
        {
            if (c.ComponentCatalogueItemId == panelItem.Id)
                throw new OrderDomainException("Self-referential panel is not allowed.", code: "panel_self_reference");

            var (compItem, compVer) = await _catalogue.ResolveOrderableAsync(
                tenantId, c.ComponentCatalogueItemId, version.OperatingBranchId, asOf, ct);

            if (compItem.CatalogueType == CatalogueTypes.Panel)
                throw new OrderDomainException("Nested panels are not allowed.", code: "panel_nested");

            if (c.ComponentVersionId != compVer.Id)
            {
                var pinned = await _db.CatalogueVersions.AsNoTracking()
                    .FirstOrDefaultAsync(v => v.Id == c.ComponentVersionId && v.TenantId == tenantId, ct)
                    ?? throw new OrderDomainException("Panel component version not found.", code: "panel_component_invalid");
                CatalogueService.EnsureOrderableVersion(pinned, asOf);
                var anyBranch = await _db.CatalogueBranchApplicability.AsNoTracking()
                    .AnyAsync(b => b.TenantId == tenantId && b.CatalogueVersionId == pinned.Id, ct);
                if (anyBranch)
                {
                    var ok = await _db.CatalogueBranchApplicability.AsNoTracking()
                        .AnyAsync(b =>
                            b.TenantId == tenantId
                            && b.CatalogueVersionId == pinned.Id
                            && b.BranchId == version.OperatingBranchId, ct);
                    if (!ok)
                        throw new OrderDomainException(
                            "Panel component is not applicable to the operating branch.",
                            code: "panel_component_branch");
                }
                if (compItem.IsDeleted)
                    throw new OrderDomainException("Panel component parent is deleted.", code: "panel_component_deleted");
                compVer = pinned;
            }

            target.Add(new LmsOrderTest
            {
                Id = Guid.NewGuid(),
                TenantId = tenantId,
                OrderVersionId = version.Id,
                CatalogueItemId = compItem.Id,
                CatalogueVersionId = compVer.Id,
                CatalogueVersionNumber = compVer.VersionNumber,
                CatalogueType = compItem.CatalogueType,
                DisplayNameSnapshot = compVer.DisplayName,
                InternalOrderCodeSnapshot = compVer.InternalOrderCode,
                Status = OrderTestStatuses.Ordered,
                SortOrder = sort++,
                PanelCatalogueItemId = panelItem.Id,
                PanelCatalogueVersionId = panelVersion.Id,
                PanelSelectionId = panelSelection.Id,
            });
        }
    }

    private async Task<List<SelectionMeta>> LoadSelectionMetaForDraftAsync(
        Guid tenantId, IReadOnlyList<OrderSelectionInput> selections, CancellationToken ct)
    {
        var list = new List<SelectionMeta>();
        var i = 0;
        foreach (var s in selections)
        {
            var item = await _db.CatalogueItems.AsNoTracking()
                .FirstOrDefaultAsync(x => x.Id == s.CatalogueItemId && x.TenantId == tenantId && !x.IsDeleted, ct)
                ?? throw new OrderDomainException("Catalogue selection not found.", code: "catalogue_not_found");
            var ver = item.LatestVersionId is null
                ? null
                : await _db.CatalogueVersions.AsNoTracking()
                    .FirstOrDefaultAsync(v => v.Id == item.LatestVersionId && v.TenantId == tenantId, ct);
            list.Add(new SelectionMeta(
                item.Id,
                ver?.Id,
                item.CatalogueType,
                ver?.VersionNumber ?? 0,
                ver?.DisplayName ?? item.Id.ToString("D"),
                ver?.InternalOrderCode ?? "",
                s.SortOrder > 0 ? s.SortOrder : i++));
        }
        return list;
    }

    private async Task<List<SelectionMeta>> ResolveSelectionsAtSubmitAsync(
        Guid tenantId,
        Guid operatingBranchId,
        IReadOnlyList<OrderSelectionInput> selections,
        DateTime asOf,
        CancellationToken ct)
    {
        var list = new List<SelectionMeta>();
        var i = 0;
        foreach (var s in selections)
        {
            var (item, ver) = await _catalogue.ResolveOrderableAsync(
                tenantId, s.CatalogueItemId, operatingBranchId, asOf, ct);
            list.Add(new SelectionMeta(
                item.Id, ver.Id, item.CatalogueType, ver.VersionNumber,
                ver.DisplayName, ver.InternalOrderCode,
                s.SortOrder > 0 ? s.SortOrder : i++));
        }
        return list;
    }

    private static void ApplySelections(LmsOrderVersion version, Guid tenantId, List<SelectionMeta> metas)
    {
        foreach (var m in metas)
        {
            version.Selections.Add(new LmsOrderSelection
            {
                Id = Guid.NewGuid(),
                TenantId = tenantId,
                OrderVersionId = version.Id,
                CatalogueItemId = m.CatalogueItemId,
                CatalogueVersionId = m.CatalogueVersionId,
                CatalogueType = m.CatalogueType,
                SortOrder = m.SortOrder,
                DisplayNameSnapshot = m.DisplayName,
                InternalOrderCodeSnapshot = m.InternalOrderCode,
            });
        }
    }

    private static LmsOrderVersion BuildVersion(
        Guid id, Guid tenantId, Guid orderId, int versionNumber, Guid actorId, DateTime now,
        Guid patientId, string? mrn, string? patientName, DateTime? dob,
        Guid? visitId,
        Guid orderingId, string? orderingName,
        Guid responsibleId, string? responsibleName,
        Guid operatingBranchId,
        string orderSource, string priority, string? priorityReason, string indication, string? notes,
        string? consentRef, string? consentTpl, string? ack,
        string? payer, string? authz, string? finDisp, string? svcCat,
        string? amendmentReason) =>
        new()
        {
            Id = id,
            TenantId = tenantId,
            OrderId = orderId,
            VersionNumber = versionNumber,
            PatientId = patientId,
            PatientMrnSnapshot = mrn,
            PatientNameSnapshot = patientName,
            PatientDateOfBirthSnapshot = dob,
            VisitId = visitId,
            OrderingProviderUserId = orderingId,
            OrderingProviderNameSnapshot = orderingName,
            ResponsibleClinicianUserId = responsibleId,
            ResponsibleClinicianNameSnapshot = responsibleName,
            OperatingBranchId = operatingBranchId,
            PerformingBranchId = operatingBranchId,
            OrderSource = orderSource.Trim(),
            Priority = priority.Trim(),
            PriorityReason = TrimOrNull(priorityReason),
            ClinicalIndication = indication.Trim(),
            Notes = TrimOrNull(notes),
            ConsentReference = TrimOrNull(consentRef),
            ConsentTemplateVersionRef = TrimOrNull(consentTpl),
            AcknowledgementEvidence = TrimOrNull(ack),
            PayerContextRef = TrimOrNull(payer),
            AuthorizationReference = TrimOrNull(authz),
            FinancialDispositionRef = TrimOrNull(finDisp),
            ServiceCatalogRef = TrimOrNull(svcCat),
            AmendmentReason = TrimOrNull(amendmentReason),
            CreatedAt = now,
            CreatedBy = actorId,
        };

    private async Task<(PlatformPatientRef? Patient, PlatformUserRef Ordering, PlatformUserRef Responsible)> ValidateContextAsync(
        Guid tenantId,
        Guid patientId,
        Guid? visitId,
        Guid orderingId,
        Guid responsibleId,
        Guid operatingBranchId,
        bool captureSnapshots,
        CancellationToken ct)
    {
        if (operatingBranchId == Guid.Empty)
            throw new OrderDomainException("OperatingBranchId is required.", code: "branch_required");

        PlatformPatientRef? patient = null;
        if (captureSnapshots)
            patient = await _platform.ValidatePatientAsync(tenantId, patientId, ct);
        else
            await _platform.ValidatePatientAsync(tenantId, patientId, ct);

        if (visitId is { } vid)
            await _platform.ValidateVisitAsync(tenantId, vid, patientId, operatingBranchId, ct);

        var ordering = await _platform.ValidateUserAsync(tenantId, orderingId, ct);
        var responsible = await _platform.ValidateUserAsync(tenantId, responsibleId, ct);
        return (patient, ordering, responsible);
    }

    private static void ValidateCompositionBasics(
        string orderSource,
        string priority,
        string? priorityReason,
        string clinicalIndication,
        string? acknowledgementEvidence,
        IReadOnlyList<OrderSelectionInput>? selections)
    {
        if (!OrderSources.IsValid(orderSource))
            throw new OrderDomainException("OrderSource is invalid.", code: "order_source_invalid");
        if (!OrderPriorities.IsValid(priority))
            throw new OrderDomainException("Priority is invalid.", code: "priority_invalid");
        var p = priority.Trim();
        if (OrderPriorities.RequiresReason(p) && string.IsNullOrWhiteSpace(priorityReason))
            throw new OrderDomainException("Priority reason is required for Urgent/STAT.", code: "priority_reason_required");
        if (string.IsNullOrWhiteSpace(clinicalIndication))
            throw new OrderDomainException("Clinical indication is required.", code: "indication_required");
        if (string.Equals(orderSource.Trim(), OrderSources.SelfRequested, StringComparison.Ordinal)
            && string.IsNullOrWhiteSpace(acknowledgementEvidence))
            throw new OrderDomainException(
                "SelfRequested orders require acknowledgement evidence.",
                code: "acknowledgement_required");
        if (selections is null || selections.Count == 0)
            throw new OrderDomainException("At least one catalogue selection is required.", code: "selections_required");
        if (selections.Select(s => s.CatalogueItemId).Distinct().Count() != selections.Count)
            throw new OrderDomainException("Duplicate catalogue selections are not allowed.", code: "selections_duplicate");
    }

    private async Task<string> AllocateOrderNumberAsync(Guid tenantId, DateTime utcNow, CancellationToken ct)
    {
        var date = DateOnly.FromDateTime(utcNow);

        // PostgreSQL: atomic upsert + RETURNING (unique on tenant_id + sequence_date).
        if (_db.Database.IsNpgsql())
        {
            var seqId = Guid.NewGuid();
            var allocated = await _db.Database
                .SqlQuery<SequenceAllocRow>($"""
                    INSERT INTO lms_order_number_sequences (id, tenant_id, sequence_date, last_value)
                    VALUES ({seqId}, {tenantId}, {date}, 1)
                    ON CONFLICT (tenant_id, sequence_date)
                    DO UPDATE SET last_value = lms_order_number_sequences.last_value + 1
                    RETURNING last_value AS "Value"
                    """)
                .ToListAsync(ct);
            if (allocated.Count != 1)
                throw new OrderDomainException("Failed to allocate order number.", statusCode: 500, code: "order_number_alloc");
            return $"LAB-{date:yyyyMMdd}-{allocated[0].Value:D6}";
        }

        // InMemory / non-relational: process-wide gate + unique index defense.
        var gateKey = $"{tenantId:N}:{date:yyyyMMdd}";
        var gate = SequenceGates.GetOrAdd(gateKey, _ => new SemaphoreSlim(1, 1));
        await gate.WaitAsync(ct);
        try
        {
            for (var attempt = 0; attempt < 5; attempt++)
            {
                try
                {
                    var seq = await _db.OrderNumberSequences
                        .FirstOrDefaultAsync(s => s.TenantId == tenantId && s.SequenceDate == date, ct);
                    if (seq is null)
                    {
                        seq = new LmsOrderNumberSequence
                        {
                            Id = Guid.NewGuid(),
                            TenantId = tenantId,
                            SequenceDate = date,
                            LastValue = 0,
                        };
                        _db.OrderNumberSequences.Add(seq);
                    }

                    seq.LastValue++;
                    await _db.SaveChangesAsync(ct);
                    return $"LAB-{date:yyyyMMdd}-{seq.LastValue:D6}";
                }
                catch (DbUpdateException ex) when (IsUniqueViolation(ex))
                {
                    foreach (var entry in _db.ChangeTracker.Entries<LmsOrderNumberSequence>().ToList())
                        entry.State = EntityState.Detached;
                }
            }

            throw new OrderDomainException("Failed to allocate order number.", statusCode: 500, code: "order_number_alloc");
        }
        finally
        {
            gate.Release();
        }
    }

    private async Task<LmsOrder> LoadOrderTrackedAsync(Guid tenantId, Guid orderId, CancellationToken ct)
    {
        var order = await _db.Orders.FirstOrDefaultAsync(o => o.Id == orderId && o.TenantId == tenantId, ct);
        if (order is null)
            throw new OrderDomainException("Order not found.", statusCode: 404, code: "not_found");
        return order;
    }

    private async Task EnsureOrderExistsAsync(Guid tenantId, Guid orderId, CancellationToken ct)
    {
        var exists = await _db.Orders.AsNoTracking().AnyAsync(o => o.Id == orderId && o.TenantId == tenantId, ct);
        if (!exists)
            throw new OrderDomainException("Order not found.", statusCode: 404, code: "not_found");
    }

    private static void EnsureExpectedRowVersion(LmsOrder order, int expected)
    {
        if (expected != 0 && expected != order.RowVersion)
            throw new OrderDomainException(
                "Order was modified by another user. Reload and retry.",
                statusCode: 409,
                code: "concurrency_conflict");
    }

    private async Task<OrderDetailDto> MapDetailAsync(Guid tenantId, Guid orderId, CancellationToken ct)
    {
        var order = await _db.Orders.AsNoTracking()
            .FirstOrDefaultAsync(o => o.Id == orderId && o.TenantId == tenantId, ct)
            ?? throw new OrderDomainException("Order not found.", statusCode: 404, code: "not_found");

        OrderVersionDto? current = null;
        if (order.CurrentVersionId is { } vid)
        {
            var v = await _db.OrderVersions.AsNoTracking()
                .FirstAsync(x => x.Id == vid && x.TenantId == tenantId, ct);
            current = await MapVersionAsync(v, ct);
        }

        return new OrderDetailDto(
            order.Id,
            order.OrderNumber,
            order.Status,
            order.CurrentVersionNumber,
            order.OperatingBranchId,
            order.RowVersion,
            order.CreatedAt,
            order.CreatedBy,
            order.UpdatedAt,
            order.UpdatedBy,
            order.CancelledAt,
            order.CancelledBy,
            order.CancelReason,
            current);
    }

    private async Task<OrderVersionDto> MapVersionAsync(LmsOrderVersion v, CancellationToken ct)
    {
        var selections = await _db.OrderSelections.AsNoTracking()
            .Where(s => s.OrderVersionId == v.Id)
            .OrderBy(s => s.SortOrder)
            .Select(s => new OrderSelectionDto(
                s.Id, s.CatalogueItemId, s.CatalogueVersionId, s.CatalogueType, s.SortOrder,
                s.DisplayNameSnapshot, s.InternalOrderCodeSnapshot))
            .ToListAsync(ct);

        var tests = await _db.OrderTests.AsNoTracking()
            .Where(t => t.OrderVersionId == v.Id)
            .OrderBy(t => t.SortOrder)
            .Select(t => new OrderTestDto(
                t.Id, t.CatalogueItemId, t.CatalogueVersionId, t.CatalogueVersionNumber, t.CatalogueType,
                t.DisplayNameSnapshot, t.InternalOrderCodeSnapshot, t.Status, t.SortOrder,
                t.PanelCatalogueItemId, t.PanelCatalogueVersionId, t.PanelSelectionId))
            .ToListAsync(ct);

        return new OrderVersionDto(
            v.Id, v.VersionNumber, v.PatientId, v.PatientMrnSnapshot, v.PatientNameSnapshot,
            v.PatientDateOfBirthSnapshot, v.VisitId,
            v.OrderingProviderUserId, v.OrderingProviderNameSnapshot,
            v.ResponsibleClinicianUserId, v.ResponsibleClinicianNameSnapshot,
            v.OperatingBranchId, v.PerformingBranchId,
            v.OrderSource, v.Priority, v.PriorityReason, v.ClinicalIndication, v.Notes,
            v.ConsentReference, v.ConsentTemplateVersionRef, v.AcknowledgementEvidence,
            v.PayerContextRef, v.AuthorizationReference, v.FinancialDispositionRef, v.ServiceCatalogRef,
            v.AmendmentReason, v.CreatedAt, v.CreatedBy, v.SubmittedAt, v.SubmittedBy,
            selections, tests);
    }

    /// <summary>
    /// Atomically claims tenant+key via unique index insert. Concurrent identical callers:
    /// one claims; the other waits for completion or replays / conflicts on hash.
    /// </summary>
    private async Task<IdempotencyClaim> ClaimIdempotencyAsync(
        Guid tenantId, string? key, string operation, string requestHash, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(key))
            return new IdempotencyClaim(null, null);

        var normalized = key.Trim();
        var existing = await _db.OrderIdempotencyRecords.AsNoTracking()
            .FirstOrDefaultAsync(r => r.TenantId == tenantId && r.IdempotencyKey == normalized, ct);
        if (existing is not null)
            return new IdempotencyClaim(null, ResolveIdempotentReplay(existing, operation, requestHash));

        var claimId = Guid.NewGuid();
        _db.OrderIdempotencyRecords.Add(new LmsOrderIdempotencyRecord
        {
            Id = claimId,
            TenantId = tenantId,
            IdempotencyKey = normalized,
            Operation = operation,
            RequestHash = requestHash,
            OrderId = Guid.Empty,
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
            foreach (var entry in _db.ChangeTracker.Entries<LmsOrderIdempotencyRecord>()
                         .Where(e => e.Entity.Id == claimId).ToList())
                entry.State = EntityState.Detached;

            // Brief wait for the winner to complete the response payload.
            for (var i = 0; i < 20; i++)
            {
                var raced = await _db.OrderIdempotencyRecords.AsNoTracking()
                    .FirstOrDefaultAsync(r => r.TenantId == tenantId && r.IdempotencyKey == normalized, ct);
                if (raced is null)
                    break;
                if (!string.IsNullOrEmpty(raced.ResponseJson) && raced.OrderId != Guid.Empty)
                    return new IdempotencyClaim(null, ResolveIdempotentReplay(raced, operation, requestHash));
                await Task.Delay(25, ct);
            }

            var final = await _db.OrderIdempotencyRecords.AsNoTracking()
                .FirstOrDefaultAsync(r => r.TenantId == tenantId && r.IdempotencyKey == normalized, ct)
                ?? throw new OrderDomainException(
                    "Idempotency key conflict.",
                    statusCode: 409,
                    code: "idempotency_conflict");
            if (string.IsNullOrEmpty(final.ResponseJson) || final.OrderId == Guid.Empty)
                throw new OrderDomainException(
                    "Idempotent request is still in progress. Retry shortly.",
                    statusCode: 409,
                    code: "idempotency_in_progress");
            return new IdempotencyClaim(null, ResolveIdempotentReplay(final, operation, requestHash));
        }
    }

    private static OrderDetailDto ResolveIdempotentReplay(
        LmsOrderIdempotencyRecord existing, string operation, string requestHash)
    {
        if (!string.Equals(existing.Operation, operation, StringComparison.Ordinal)
            || !string.Equals(existing.RequestHash, requestHash, StringComparison.Ordinal))
            throw new OrderDomainException(
                "Idempotency key was reused with a different request.",
                statusCode: 409,
                code: "idempotency_conflict");
        var detail = JsonSerializer.Deserialize<OrderDetailDto>(existing.ResponseJson, JsonOpts);
        if (detail is null)
            throw new OrderDomainException(
                "Idempotency replay payload is corrupt.",
                statusCode: 500,
                code: "idempotency_corrupt");
        return detail;
    }

    private async Task CompleteIdempotencyAsync(
        Guid tenantId, Guid? claimId, OrderDetailDto detail, CancellationToken ct)
    {
        if (claimId is null) return;
        var record = await _db.OrderIdempotencyRecords
            .FirstOrDefaultAsync(r => r.Id == claimId && r.TenantId == tenantId, ct);
        if (record is null) return;
        record.OrderId = detail.Id;
        record.ResponseJson = JsonSerializer.Serialize(detail, JsonOpts);
        await _db.SaveChangesAsync(ct);
    }

    private async Task ReleaseIdempotencyClaimAsync(Guid tenantId, Guid? claimId, CancellationToken ct)
    {
        if (claimId is null) return;
        var record = await _db.OrderIdempotencyRecords
            .FirstOrDefaultAsync(r => r.Id == claimId && r.TenantId == tenantId, ct);
        if (record is null) return;
        _db.OrderIdempotencyRecords.Remove(record);
        await _db.SaveChangesAsync(ct);
    }

    private static VersionDraftState CaptureVersionDraftState(LmsOrderVersion v) => new(
        v.PatientId, v.VisitId,
        v.OrderingProviderUserId, v.OrderingProviderNameSnapshot,
        v.ResponsibleClinicianUserId, v.ResponsibleClinicianNameSnapshot,
        v.OperatingBranchId, v.PerformingBranchId,
        v.OrderSource, v.Priority, v.PriorityReason, v.ClinicalIndication, v.Notes,
        v.ConsentReference, v.ConsentTemplateVersionRef, v.AcknowledgementEvidence,
        v.PayerContextRef, v.AuthorizationReference, v.FinancialDispositionRef, v.ServiceCatalogRef);

    private static void RestoreVersionDraftState(LmsOrderVersion v, VersionDraftState s)
    {
        v.PatientId = s.PatientId;
        v.VisitId = s.VisitId;
        v.OrderingProviderUserId = s.OrderingProviderUserId;
        v.OrderingProviderNameSnapshot = s.OrderingProviderNameSnapshot;
        v.ResponsibleClinicianUserId = s.ResponsibleClinicianUserId;
        v.ResponsibleClinicianNameSnapshot = s.ResponsibleClinicianNameSnapshot;
        v.OperatingBranchId = s.OperatingBranchId;
        v.PerformingBranchId = s.PerformingBranchId;
        v.OrderSource = s.OrderSource;
        v.Priority = s.Priority;
        v.PriorityReason = s.PriorityReason;
        v.ClinicalIndication = s.ClinicalIndication;
        v.Notes = s.Notes;
        v.ConsentReference = s.ConsentReference;
        v.ConsentTemplateVersionRef = s.ConsentTemplateVersionRef;
        v.AcknowledgementEvidence = s.AcknowledgementEvidence;
        v.PayerContextRef = s.PayerContextRef;
        v.AuthorizationReference = s.AuthorizationReference;
        v.FinancialDispositionRef = s.FinancialDispositionRef;
        v.ServiceCatalogRef = s.ServiceCatalogRef;
    }

    private static void ApplyVersionDraftFields(
        LmsOrderVersion version,
        UpdateOrderDraftRequest req,
        PlatformUserRef ordering,
        PlatformUserRef responsible)
    {
        version.PatientId = req.PatientId;
        version.VisitId = req.VisitId;
        version.OrderingProviderUserId = req.OrderingProviderUserId;
        version.OrderingProviderNameSnapshot = ordering.DisplayName;
        version.ResponsibleClinicianUserId = req.ResponsibleClinicianUserId;
        version.ResponsibleClinicianNameSnapshot = responsible.DisplayName;
        version.OperatingBranchId = req.OperatingBranchId;
        version.PerformingBranchId = req.OperatingBranchId;
        version.OrderSource = req.OrderSource.Trim();
        version.Priority = req.Priority.Trim();
        version.PriorityReason = TrimOrNull(req.PriorityReason);
        version.ClinicalIndication = req.ClinicalIndication.Trim();
        version.Notes = TrimOrNull(req.Notes);
        version.ConsentReference = TrimOrNull(req.ConsentReference);
        version.ConsentTemplateVersionRef = TrimOrNull(req.ConsentTemplateVersionRef);
        version.AcknowledgementEvidence = TrimOrNull(req.AcknowledgementEvidence);
        version.PayerContextRef = TrimOrNull(req.PayerContextRef);
        version.AuthorizationReference = TrimOrNull(req.AuthorizationReference);
        version.FinancialDispositionRef = TrimOrNull(req.FinancialDispositionRef);
        version.ServiceCatalogRef = TrimOrNull(req.ServiceCatalogRef);
    }

    private static string HashRequest(object req)
    {
        var json = JsonSerializer.Serialize(req, JsonOpts);
        var bytes = SHA256.HashData(Encoding.UTF8.GetBytes(json));
        return Convert.ToHexString(bytes);
    }

    private static string SnapshotVersionSummary(LmsOrderVersion v) =>
        $"patient={v.PatientId}; source={v.OrderSource}; priority={v.Priority}";

    private static string? TrimOrNull(string? s) =>
        string.IsNullOrWhiteSpace(s) ? null : s.Trim();

    private static bool IsUniqueViolation(DbUpdateException ex) =>
        ex.InnerException?.Message.Contains("unique", StringComparison.OrdinalIgnoreCase) == true
        || ex.InnerException?.Message.Contains("duplicate", StringComparison.OrdinalIgnoreCase) == true;

    private sealed record SelectionMeta(
        Guid CatalogueItemId,
        Guid? CatalogueVersionId,
        string CatalogueType,
        int VersionNumber,
        string DisplayName,
        string InternalOrderCode,
        int SortOrder);

    private sealed record IdempotencyClaim(Guid? ClaimId, OrderDetailDto? Replay);

    private sealed record SequenceAllocRow(int Value);

    private sealed record VersionDraftState(
        Guid PatientId,
        Guid? VisitId,
        Guid OrderingProviderUserId,
        string? OrderingProviderNameSnapshot,
        Guid ResponsibleClinicianUserId,
        string? ResponsibleClinicianNameSnapshot,
        Guid OperatingBranchId,
        Guid PerformingBranchId,
        string OrderSource,
        string Priority,
        string? PriorityReason,
        string ClinicalIndication,
        string? Notes,
        string? ConsentReference,
        string? ConsentTemplateVersionRef,
        string? AcknowledgementEvidence,
        string? PayerContextRef,
        string? AuthorizationReference,
        string? FinancialDispositionRef,
        string? ServiceCatalogRef);
}
