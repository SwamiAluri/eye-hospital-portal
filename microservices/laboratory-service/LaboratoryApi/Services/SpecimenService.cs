using System.Collections.Concurrent;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using LaboratoryApi.Data;
using LaboratoryApi.Domain;
using Microsoft.EntityFrameworkCore;

namespace LaboratoryApi.Services;

public interface ISpecimenService
{
    Task<SpecimenDetailDto> GetAsync(Guid tenantId, Guid specimenId, CancellationToken ct = default);
    Task<SpecimenDetailDto?> GetByCollectionTaskAsync(
        Guid tenantId, Guid collectionTaskId, CancellationToken ct = default);
    Task<PagedResult<SpecimenListItemDto>> ListAsync(
        Guid tenantId, SpecimenListQuery query, CancellationToken ct = default);
    Task<IReadOnlyList<SpecimenRejectionReasonDto>> ListRejectionReasonsAsync(
        Guid tenantId, CancellationToken ct = default);
    Task<SpecimenDetailDto> CompleteCollectionAsync(
        Guid tenantId, Guid actorId, Guid collectionTaskId, CompleteCollectionRequest req,
        CancellationToken ct = default);
    Task<SpecimenDetailDto> ReceiveAsync(
        Guid tenantId, Guid actorId, Guid specimenId, ReceiveSpecimenRequest req,
        CancellationToken ct = default);
    Task<SpecimenDetailDto> RejectAsync(
        Guid tenantId, Guid actorId, Guid specimenId, RejectSpecimenRequest req,
        CancellationToken ct = default);
}

/// <summary>L-COL-01C Complete Collection + L-COL-01D Receive/Reject.</summary>
public sealed class SpecimenService : ISpecimenService
{
    private readonly LaboratoryDbContext _db;
    private readonly IPlatformAuditClient _audit;
    private readonly IPlatformReferenceClient _platform;

    private static readonly JsonSerializerOptions JsonOpts = HttpRequestDataExtensions.JsonOpts;
    private static readonly ConcurrentDictionary<string, SemaphoreSlim> SequenceGates = new();

    public SpecimenService(
        LaboratoryDbContext db,
        IPlatformAuditClient audit,
        IPlatformReferenceClient platform)
    {
        _db = db;
        _audit = audit;
        _platform = platform;
    }

    public async Task<SpecimenDetailDto> GetAsync(Guid tenantId, Guid specimenId, CancellationToken ct = default)
        => await MapDetailAsync(tenantId, specimenId, ct);

    public async Task<SpecimenDetailDto?> GetByCollectionTaskAsync(
        Guid tenantId, Guid collectionTaskId, CancellationToken ct = default)
    {
        var id = await _db.Specimens.AsNoTracking()
            .Where(s => s.TenantId == tenantId && s.CollectionTaskId == collectionTaskId)
            .Select(s => s.Id)
            .FirstOrDefaultAsync(ct);
        if (id == Guid.Empty) return null;
        return await MapDetailAsync(tenantId, id, ct);
    }

    public async Task<PagedResult<SpecimenListItemDto>> ListAsync(
        Guid tenantId, SpecimenListQuery query, CancellationToken ct = default)
    {
        var page = query.Page < 1 ? 1 : query.Page;
        var pageSize = query.PageSize is < 1 or > 100 ? 25 : query.PageSize;

        var q = _db.Specimens.AsNoTracking().Where(s => s.TenantId == tenantId);

        if (!string.IsNullOrWhiteSpace(query.Status))
            q = q.Where(s => s.Status == query.Status.Trim());
        if (query.CollectionBranchId is { } cbid)
            q = q.Where(s => s.CollectionBranchId == cbid);
        if (query.ReceivingBranchId is { } rbid)
            q = q.Where(s => s.ReceivingBranchId == rbid || s.CollectionBranchId == rbid);

        if (!string.IsNullOrWhiteSpace(query.Search))
        {
            var s = query.Search.Trim().ToLower();
            q = q.Where(x =>
                x.Id.ToString().ToLower().Contains(s)
                || (x.Accession != null && x.Accession.ToLower().Contains(s))
                || (x.PatientMrnSnapshot != null && x.PatientMrnSnapshot.ToLower().Contains(s))
                || (x.PatientNameSnapshot != null && x.PatientNameSnapshot.ToLower().Contains(s)));
        }

        var total = await q.CountAsync(ct);
        var rows = await q.OrderByDescending(s => s.CollectedAt)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .ToListAsync(ct);

        var orderIds = rows.Select(r => r.OrderId).Distinct().ToList();
        var orders = await _db.Orders.AsNoTracking()
            .Where(o => o.TenantId == tenantId && orderIds.Contains(o.Id))
            .ToDictionaryAsync(o => o.Id, ct);

        var specimenIds = rows.Select(r => r.Id).ToList();
        var barcodes = await _db.SpecimenBarcodes.AsNoTracking()
            .Where(b => b.TenantId == tenantId && b.IsActive && specimenIds.Contains(b.SpecimenId))
            .ToDictionaryAsync(b => b.SpecimenId, b => b.BarcodeValue, ct);

        var items = rows.Select(r =>
        {
            orders.TryGetValue(r.OrderId, out var order);
            barcodes.TryGetValue(r.Id, out var barcode);
            return new SpecimenListItemDto(
                r.Id,
                r.Accession,
                barcode,
                r.Status,
                r.PatientMrnSnapshot,
                r.PatientNameSnapshot,
                r.OrderId,
                order?.OrderNumber ?? string.Empty,
                r.CollectedAt,
                r.CollectionBranchId,
                r.ReceivingBranchId,
                r.RowVersion);
        }).ToList();

        return new PagedResult<SpecimenListItemDto>(items, page, pageSize, total);
    }

    public async Task<IReadOnlyList<SpecimenRejectionReasonDto>> ListRejectionReasonsAsync(
        Guid tenantId, CancellationToken ct = default)
    {
        try
        {
            var rows = await _platform.ListActiveMasterValuesAsync(
                tenantId, SpecimenRejectionReasonMaster.EntityType, ct);
            return rows
                .Where(r => SpecimenRejectionReasons.IsApprovedCode(r.Code))
                .OrderBy(r => r.SortOrder)
                .Select(r => new SpecimenRejectionReasonDto(r.Code, r.Label, r.SortOrder))
                .ToList();
        }
        catch (OrderDomainException ex)
        {
            throw new SpecimenDomainException(
                ex.Message, statusCode: ex.StatusCode, code: ex.Code ?? "configuration_unavailable");
        }
    }

    public async Task<SpecimenDetailDto> CompleteCollectionAsync(
        Guid tenantId, Guid actorId, Guid collectionTaskId, CompleteCollectionRequest req,
        CancellationToken ct = default)
    {
        var hash = HashRequest(new
        {
            collectionTaskId,
            req.ExpectedCollectionTaskRowVersion,
            req.PatientIdentityConfirmed,
        });
        var idem = await ClaimIdempotencyAsync(tenantId, req.IdempotencyKey, "complete_collection", hash, ct);
        if (idem.Replay is not null)
            return idem.Replay;

        var completed = false;
        try
        {
            _db.ChangeTracker.Clear();

            if (!req.PatientIdentityConfirmed)
                throw new SpecimenDomainException(
                    "Patient identity confirmation is required before Complete Collection.",
                    code: "patient_identity_not_confirmed");

            var task = await _db.CollectionTasks.AsNoTracking()
                .FirstOrDefaultAsync(t => t.Id == collectionTaskId && t.TenantId == tenantId, ct)
                ?? throw new SpecimenDomainException(
                    "Collection task not found.", statusCode: 404, code: "not_found");

            if (req.ExpectedCollectionTaskRowVersion != 0
                && req.ExpectedCollectionTaskRowVersion != task.RowVersion)
                throw new SpecimenDomainException(
                    "Collection task was modified by another user. Reload and retry.",
                    statusCode: 409,
                    code: "concurrency_conflict");

            if (task.Status != CollectionTaskStatuses.Completed)
                throw new SpecimenDomainException(
                    "Complete Collection requires a Completed collection task.",
                    code: "task_not_completed");

            if (task.CollectionBranchId == Guid.Empty)
                throw new SpecimenDomainException(
                    "Collection branch is required.", code: "branch_required");

            await ValidateBranchAsync(tenantId, actorId, task.CollectionBranchId, ct);

            var existing = await _db.Specimens.AsNoTracking()
                .FirstOrDefaultAsync(s => s.TenantId == tenantId && s.CollectionTaskId == collectionTaskId, ct);
            if (existing is not null)
                throw new SpecimenDomainException(
                    "A Specimen already exists for this collection task.",
                    statusCode: 409,
                    code: "specimen_already_exists");

            var order = await _db.Orders.AsNoTracking()
                .FirstOrDefaultAsync(o => o.Id == task.OrderId && o.TenantId == tenantId, ct)
                ?? throw new SpecimenDomainException("Order not found.", statusCode: 404, code: "order_not_found");

            if (order.Status != OrderStatuses.Submitted)
                throw new SpecimenDomainException(
                    "Complete Collection requires a Submitted order.",
                    code: "order_not_submitted");
            if (order.CurrentVersionId is null)
                throw new SpecimenDomainException("Order has no current version.", code: "order_invalid");

            var version = await _db.OrderVersions.AsNoTracking()
                .FirstAsync(v => v.Id == order.CurrentVersionId && v.TenantId == tenantId, ct);

            var links = await _db.CollectionTaskOrderTests.AsNoTracking()
                .Where(l => l.TenantId == tenantId && l.CollectionTaskId == collectionTaskId)
                .OrderBy(l => l.SortOrder)
                .ToListAsync(ct);
            if (links.Count == 0)
                throw new SpecimenDomainException(
                    "Collection task has no OrderTests.", code: "order_tests_required");

            var otIds = links.Select(l => l.OrderTestId).ToList();
            var tests = await _db.OrderTests.AsNoTracking()
                .Where(t => t.TenantId == tenantId && otIds.Contains(t.Id))
                .ToListAsync(ct);
            if (tests.Count != otIds.Count)
                throw new SpecimenDomainException(
                    "One or more OrderTests linked to the task are missing.",
                    code: "order_test_mismatch");
            foreach (var t in tests)
            {
                if (t.Status != OrderTestStatuses.Ordered)
                    throw new SpecimenDomainException(
                        "OrderTest must remain Ordered for Complete Collection.",
                        code: "order_test_not_eligible");
            }

            var now = DateTime.UtcNow;
            var specimenId = Guid.NewGuid();
            var location = TrimOrNull(task.LocationText);

            var specimen = new LmsSpecimen
            {
                Id = specimenId,
                TenantId = tenantId,
                CollectionTaskId = collectionTaskId,
                OrderId = order.Id,
                PatientId = version.PatientId,
                PatientMrnSnapshot = version.PatientMrnSnapshot,
                PatientNameSnapshot = version.PatientNameSnapshot,
                PatientDateOfBirthSnapshot = version.PatientDateOfBirthSnapshot,
                CollectionBranchId = task.CollectionBranchId,
                LocationText = location,
                CollectedByUserId = actorId,
                CollectedAt = now,
                Status = SpecimenStatuses.Collected,
                CreatedAt = now,
                CreatedBy = actorId,
                RowVersion = 1,
            };

            var sort = 0;
            foreach (var link in links)
            {
                specimen.OrderTests.Add(new LmsSpecimenOrderTest
                {
                    Id = Guid.NewGuid(),
                    TenantId = tenantId,
                    SpecimenId = specimenId,
                    OrderId = order.Id,
                    OrderTestId = link.OrderTestId,
                    SortOrder = sort++,
                });
            }

            _db.Specimens.Add(specimen);

            try
            {
                await _db.SaveChangesAsync(ct);
            }
            catch (DbUpdateException ex) when (IsUniqueViolation(ex))
            {
                throw new SpecimenDomainException(
                    "A Specimen already exists for this collection task.",
                    statusCode: 409,
                    code: "specimen_already_exists");
            }
            catch (DbUpdateConcurrencyException)
            {
                throw new SpecimenDomainException(
                    "Specimen concurrency conflict. Reload and retry.",
                    statusCode: 409,
                    code: "concurrency_conflict");
            }

            try
            {
                await _audit.WriteAsync(
                    tenantId, actorId, SpecimenAuditActions.CreateSpecimen,
                    SpecimenAuditResourceTypes.Specimen, specimenId, ct: ct,
                    newValues:
                    $"status={SpecimenStatuses.Collected}; collectionTaskId={collectionTaskId}; orderId={order.Id}; tests={links.Count}");
                await _audit.WriteAsync(
                    tenantId, actorId, SpecimenAuditActions.CompleteCollection,
                    SpecimenAuditResourceTypes.Specimen, specimenId, ct: ct,
                    newValues:
                    $"collectionTaskId={collectionTaskId}; collectedBy={actorId}; branchId={task.CollectionBranchId}");
            }
            catch (CatalogueDomainException)
            {
                _db.ChangeTracker.Clear();
                var rollback = await _db.Specimens
                    .Include(s => s.OrderTests)
                    .FirstOrDefaultAsync(s => s.Id == specimenId && s.TenantId == tenantId, ct);
                if (rollback is not null)
                {
                    _db.SpecimenOrderTests.RemoveRange(rollback.OrderTests);
                    _db.Specimens.Remove(rollback);
                    await _db.SaveChangesAsync(ct);
                }

                throw new SpecimenDomainException(
                    "Specimen mutation aborted: platform audit write failed.",
                    statusCode: 503,
                    code: "audit_unavailable");
            }

            var detail = await MapDetailAsync(tenantId, specimenId, ct);
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

    public async Task<SpecimenDetailDto> ReceiveAsync(
        Guid tenantId, Guid actorId, Guid specimenId, ReceiveSpecimenRequest req,
        CancellationToken ct = default)
    {
        var hash = HashRequest(new
        {
            specimenId,
            req.ExpectedRowVersion,
            req.ReceivingBranchId,
            req.PatientIdentityConfirmed,
            ConfirmedMrn = Normalize(req.ConfirmedMrn),
            ConfirmedPatientName = Normalize(req.ConfirmedPatientName),
            ConfirmedDateOfBirth = req.ConfirmedDateOfBirth.Date,
            ReceivingLocationText = TrimOrNull(req.ReceivingLocationText),
        });
        var idem = await ClaimIdempotencyAsync(tenantId, req.IdempotencyKey, "receive", hash, ct);
        if (idem.Replay is not null)
            return idem.Replay;

        var completed = false;
        try
        {
            _db.ChangeTracker.Clear();

            if (req.ReceivingBranchId == Guid.Empty)
                throw new SpecimenDomainException("Receiving branch is required.", code: "branch_required");

            await ValidateBranchAsync(tenantId, actorId, req.ReceivingBranchId, ct);
            ValidatePatientConfirmation(req.PatientIdentityConfirmed, req.ConfirmedMrn, req.ConfirmedPatientName, req.ConfirmedDateOfBirth);

            var specimen = await _db.Specimens
                .FirstOrDefaultAsync(s => s.Id == specimenId && s.TenantId == tenantId, ct)
                ?? throw new SpecimenDomainException("Specimen not found.", statusCode: 404, code: "not_found");

            // Receive requires an explicit ExpectedRowVersion (0 is not a skip).
            if (req.ExpectedRowVersion == 0 || req.ExpectedRowVersion != specimen.RowVersion)
                throw new SpecimenDomainException(
                    "Specimen was modified by another user. Reload and retry.",
                    statusCode: 409,
                    code: "concurrency_conflict");

            if (specimen.Status == SpecimenStatuses.Received)
                throw new SpecimenDomainException(
                    "Specimen is already Received.",
                    statusCode: 409,
                    code: "invalid_state");
            if (specimen.Status != SpecimenStatuses.Collected)
                throw new SpecimenDomainException(
                    "Receive is allowed only from Collected.",
                    code: "invalid_state");

            AssertPatientMatches(specimen, req.ConfirmedMrn, req.ConfirmedPatientName, req.ConfirmedDateOfBirth);
            await ValidateOrderAndTestsForReceiveAsync(tenantId, specimen.OrderId, specimen.Id, ct);

            var now = DateTime.UtcNow;
            // Accession allocation is DB-atomic on PostgreSQL (see AllocateAccessionAsync).
            // Sequence may gap if later mutation/audit fails — product-approved.
            var (accession, accessionDate, seq) = await AllocateAccessionAsync(tenantId, now, ct);

            specimen.Accession = accession;
            specimen.AccessionDate = accessionDate;
            specimen.AccessionSequence = seq;
            specimen.Status = SpecimenStatuses.Received;
            specimen.ReceivedAtUtc = now;
            specimen.ReceivedByUserId = actorId;
            specimen.ReceivingBranchId = req.ReceivingBranchId;
            specimen.ReceivingLocationText = TrimOrNull(req.ReceivingLocationText);
            specimen.UpdatedAt = now;
            specimen.UpdatedBy = actorId;
            specimen.RowVersion++;

            try
            {
                await _db.SaveChangesAsync(ct);
            }
            catch (DbUpdateConcurrencyException)
            {
                throw new SpecimenDomainException(
                    "Specimen was modified by another user. Reload and retry.",
                    statusCode: 409,
                    code: "concurrency_conflict");
            }
            catch (DbUpdateException ex) when (IsUniqueViolation(ex))
            {
                throw new SpecimenDomainException(
                    "Accession uniqueness conflict. Retry receive.",
                    statusCode: 409,
                    code: "accession_conflict");
            }

            try
            {
                await _audit.WriteAsync(
                    tenantId, actorId, SpecimenAuditActions.ReceiveSpecimen,
                    SpecimenAuditResourceTypes.Specimen, specimenId, ct: ct,
                    newValues:
                    $"status={SpecimenStatuses.Received}; accession={accession}; branchId={req.ReceivingBranchId}; receivedBy={actorId}");
            }
            catch (CatalogueDomainException)
            {
                await RevertReceiveAsync(tenantId, specimenId, ct);
                throw new SpecimenDomainException(
                    "Specimen mutation aborted: platform audit write failed.",
                    statusCode: 503,
                    code: "audit_unavailable");
            }

            var detail = await MapDetailAsync(tenantId, specimenId, ct);
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

    public async Task<SpecimenDetailDto> RejectAsync(
        Guid tenantId, Guid actorId, Guid specimenId, RejectSpecimenRequest req,
        CancellationToken ct = default)
    {
        var hash = HashRequest(new
        {
            specimenId,
            req.ExpectedRowVersion,
            req.OperatingBranchId,
            RejectionReasonCode = Normalize(req.RejectionReasonCode),
            req.PatientIdentityConfirmed,
            ConfirmedMrn = Normalize(req.ConfirmedMrn),
            ConfirmedPatientName = Normalize(req.ConfirmedPatientName),
            ConfirmedDateOfBirth = req.ConfirmedDateOfBirth.Date,
        });
        var idem = await ClaimIdempotencyAsync(tenantId, req.IdempotencyKey, "reject", hash, ct);
        if (idem.Replay is not null)
            return idem.Replay;

        var completed = false;
        try
        {
            _db.ChangeTracker.Clear();

            if (req.OperatingBranchId == Guid.Empty)
                throw new SpecimenDomainException("Operating branch is required.", code: "branch_required");

            await ValidateBranchAsync(tenantId, actorId, req.OperatingBranchId, ct);
            ValidatePatientConfirmation(req.PatientIdentityConfirmed, req.ConfirmedMrn, req.ConfirmedPatientName, req.ConfirmedDateOfBirth);

            if (!SpecimenRejectionReasons.IsApprovedCode(req.RejectionReasonCode))
                throw new SpecimenDomainException(
                    "Rejection reason is not an approved governed code.",
                    code: "invalid_rejection_reason");

            PlatformMasterValueRef reason;
            try
            {
                reason = await _platform.ValidateMasterValueAsync(
                    tenantId,
                    SpecimenRejectionReasonMaster.EntityType,
                    req.RejectionReasonCode.Trim(),
                    ct);
            }
            catch (OrderDomainException ex)
            {
                throw new SpecimenDomainException(
                    ex.Message,
                    statusCode: ex.StatusCode == 404 ? 400 : ex.StatusCode,
                    code: string.IsNullOrWhiteSpace(ex.Code) ? "invalid_rejection_reason" : ex.Code);
            }

            if (!reason.IsActive)
                throw new SpecimenDomainException(
                    "Rejection reason is inactive.",
                    code: "rejection_reason_inactive");

            var specimen = await _db.Specimens
                .FirstOrDefaultAsync(s => s.Id == specimenId && s.TenantId == tenantId, ct)
                ?? throw new SpecimenDomainException("Specimen not found.", statusCode: 404, code: "not_found");

            // Reject requires an explicit ExpectedRowVersion (0 is not a skip).
            if (req.ExpectedRowVersion == 0 || req.ExpectedRowVersion != specimen.RowVersion)
                throw new SpecimenDomainException(
                    "Specimen was modified by another user. Reload and retry.",
                    statusCode: 409,
                    code: "concurrency_conflict");

            if (specimen.Status != SpecimenStatuses.Collected)
                throw new SpecimenDomainException(
                    "Reject is allowed only from Collected.",
                    code: "invalid_state");

            AssertPatientMatches(specimen, req.ConfirmedMrn, req.ConfirmedPatientName, req.ConfirmedDateOfBirth);

            var now = DateTime.UtcNow;
            specimen.Status = SpecimenStatuses.Rejected;
            specimen.RejectionReasonCode = reason.Code;
            specimen.RejectionReasonLabelSnapshot = reason.Label;
            specimen.RejectedAtUtc = now;
            specimen.RejectedByUserId = actorId;
            specimen.UpdatedAt = now;
            specimen.UpdatedBy = actorId;
            specimen.RowVersion++;

            try
            {
                await _db.SaveChangesAsync(ct);
            }
            catch (DbUpdateConcurrencyException)
            {
                throw new SpecimenDomainException(
                    "Specimen was modified by another user. Reload and retry.",
                    statusCode: 409,
                    code: "concurrency_conflict");
            }

            try
            {
                await _audit.WriteAsync(
                    tenantId, actorId, SpecimenAuditActions.RejectSpecimen,
                    SpecimenAuditResourceTypes.Specimen, specimenId, ct: ct,
                    newValues:
                    $"status={SpecimenStatuses.Rejected}; reason={reason.Code}; rejectedBy={actorId}; branchId={req.OperatingBranchId}");
            }
            catch (CatalogueDomainException)
            {
                await RevertRejectAsync(tenantId, specimenId, ct);
                throw new SpecimenDomainException(
                    "Specimen mutation aborted: platform audit write failed.",
                    statusCode: 503,
                    code: "audit_unavailable");
            }

            var detail = await MapDetailAsync(tenantId, specimenId, ct);
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

    private async Task ValidateOrderAndTestsForReceiveAsync(
        Guid tenantId, Guid orderId, Guid specimenId, CancellationToken ct)
    {
        var order = await _db.Orders.AsNoTracking()
            .FirstOrDefaultAsync(o => o.Id == orderId && o.TenantId == tenantId, ct)
            ?? throw new SpecimenDomainException("Order not found.", statusCode: 404, code: "order_not_found");

        if (order.Status != OrderStatuses.Submitted)
            throw new SpecimenDomainException(
                "Receive requires a Submitted order.",
                code: "order_not_submitted");

        var links = await _db.SpecimenOrderTests.AsNoTracking()
            .Where(l => l.TenantId == tenantId && l.SpecimenId == specimenId)
            .ToListAsync(ct);
        if (links.Count == 0)
            throw new SpecimenDomainException(
                "Specimen has no OrderTests.", code: "order_tests_required");

        var otIds = links.Select(l => l.OrderTestId).ToList();
        var tests = await _db.OrderTests.AsNoTracking()
            .Where(t => t.TenantId == tenantId && otIds.Contains(t.Id))
            .ToListAsync(ct);
        if (tests.Count != otIds.Count)
            throw new SpecimenDomainException(
                "One or more OrderTests linked to the specimen are missing.",
                code: "order_test_mismatch");
        foreach (var t in tests)
        {
            if (t.Status != OrderTestStatuses.Ordered)
                throw new SpecimenDomainException(
                    "OrderTest must remain Ordered for Receive.",
                    code: "order_test_not_eligible");
        }
    }

    /// <summary>
    /// Allocates the next daily accession sequence.
    /// Correctness on PostgreSQL: atomic INSERT … ON CONFLICT DO UPDATE … RETURNING (multi-instance safe).
    /// SemaphoreSlim is used only for non-Npgsql providers (e.g. InMemory tests) and is NOT the
    /// production correctness guarantee.
    /// </summary>
    private async Task<(string Accession, DateOnly Date, int Sequence)> AllocateAccessionAsync(
        Guid tenantId, DateTime utcNow, CancellationToken ct)
    {
        var date = DateOnly.FromDateTime(utcNow);
        int value;

        if (_db.Database.IsNpgsql())
        {
            // Authoritative concurrency mechanism — safe across LaboratoryApi instances.
            var seqId = Guid.NewGuid();
            var allocated = await _db.Database
                .SqlQuery<SequenceAllocRow>($"""
                    INSERT INTO lms_accession_number_sequences (id, tenant_id, sequence_date, last_value)
                    VALUES ({seqId}, {tenantId}, {date}, 1)
                    ON CONFLICT (tenant_id, sequence_date)
                    DO UPDATE SET last_value = lms_accession_number_sequences.last_value + 1
                    RETURNING last_value AS "Value"
                    """)
                .ToListAsync(ct);
            if (allocated.Count != 1)
                throw new SpecimenDomainException(
                    "Failed to allocate accession.", statusCode: 500, code: "accession_alloc_failure");
            value = allocated[0].Value;
        }
        else
        {
            // Test / non-PostgreSQL providers only — not a multi-process correctness mechanism.
            var gateKey = $"acc:{tenantId:N}:{date:yyyyMMdd}";
            var gate = SequenceGates.GetOrAdd(gateKey, _ => new SemaphoreSlim(1, 1));
            await gate.WaitAsync(ct);
            try
            {
                value = 0;
                for (var attempt = 0; attempt < 5; attempt++)
                {
                    try
                    {
                        var seq = await _db.AccessionNumberSequences
                            .FirstOrDefaultAsync(s => s.TenantId == tenantId && s.SequenceDate == date, ct);
                        if (seq is null)
                        {
                            seq = new LmsAccessionNumberSequence
                            {
                                Id = Guid.NewGuid(),
                                TenantId = tenantId,
                                SequenceDate = date,
                                LastValue = 0,
                            };
                            _db.AccessionNumberSequences.Add(seq);
                        }

                        seq.LastValue++;
                        await _db.SaveChangesAsync(ct);
                        value = seq.LastValue;
                        break;
                    }
                    catch (DbUpdateException ex) when (IsUniqueViolation(ex))
                    {
                        foreach (var entry in _db.ChangeTracker.Entries<LmsAccessionNumberSequence>().ToList())
                            entry.State = EntityState.Detached;
                    }
                }

                if (value == 0)
                    throw new SpecimenDomainException(
                        "Failed to allocate accession.", statusCode: 500, code: "accession_alloc_failure");
            }
            finally
            {
                gate.Release();
            }
        }

        // Approved format ACC-YYYYMMDD-NNNNNN is 19 characters (example ACC-20261011-000001).
        var accession = $"ACC-{date:yyyyMMdd}-{value:D6}";
        if (accession.Length != 19)
            throw new SpecimenDomainException(
                "Accession format invalid.", statusCode: 500, code: "accession_format_invalid");
        return (accession, date, value);
    }

    private async Task RevertReceiveAsync(Guid tenantId, Guid specimenId, CancellationToken ct)
    {
        _db.ChangeTracker.Clear();
        var s = await _db.Specimens.FirstOrDefaultAsync(x => x.Id == specimenId && x.TenantId == tenantId, ct)
            ?? throw new SpecimenDomainException(
                "Specimen mutation aborted: audit failed and receive revert target missing.",
                statusCode: 503,
                code: "audit_unavailable");
        s.Status = SpecimenStatuses.Collected;
        s.Accession = null;
        s.AccessionDate = null;
        s.AccessionSequence = null;
        s.ReceivedAtUtc = null;
        s.ReceivedByUserId = null;
        s.ReceivingBranchId = null;
        s.ReceivingLocationText = null;
        s.UpdatedAt = DateTime.UtcNow;
        s.RowVersion++;
        await _db.SaveChangesAsync(ct);
        // Sequence counter is not rolled back — gap may remain (approved).
    }

    private async Task RevertRejectAsync(Guid tenantId, Guid specimenId, CancellationToken ct)
    {
        _db.ChangeTracker.Clear();
        var s = await _db.Specimens.FirstOrDefaultAsync(x => x.Id == specimenId && x.TenantId == tenantId, ct)
            ?? throw new SpecimenDomainException(
                "Specimen mutation aborted: audit failed and reject revert target missing.",
                statusCode: 503,
                code: "audit_unavailable");
        s.Status = SpecimenStatuses.Collected;
        s.RejectionReasonCode = null;
        s.RejectionReasonLabelSnapshot = null;
        s.RejectedAtUtc = null;
        s.RejectedByUserId = null;
        s.UpdatedAt = DateTime.UtcNow;
        s.RowVersion++;
        await _db.SaveChangesAsync(ct);
    }

    private async Task ValidateBranchAsync(Guid tenantId, Guid actorId, Guid branchId, CancellationToken ct)
    {
        try
        {
            await _platform.ValidateUserBranchAsync(tenantId, actorId, branchId, ct);
        }
        catch (OrderDomainException ex)
        {
            throw new SpecimenDomainException(
                ex.Message,
                statusCode: ex.StatusCode == 403 ? 403 : ex.StatusCode,
                code: string.IsNullOrWhiteSpace(ex.Code) ? "branch_unauthorized" : ex.Code);
        }
    }

    private static void ValidatePatientConfirmation(
        bool confirmed, string? mrn, string? name, DateTime dob)
    {
        if (!confirmed)
            throw new SpecimenDomainException(
                "Patient identity confirmation is required.",
                code: "patient_identity_not_confirmed");
        if (string.IsNullOrWhiteSpace(mrn) || string.IsNullOrWhiteSpace(name) || dob == default)
            throw new SpecimenDomainException(
                "Patient MRN, name, and date of birth confirmation are required.",
                code: "patient_confirmation_failure");
    }

    private static void AssertPatientMatches(
        LmsSpecimen specimen, string confirmedMrn, string confirmedName, DateTime confirmedDob)
    {
        if (string.IsNullOrWhiteSpace(specimen.PatientMrnSnapshot)
            || string.IsNullOrWhiteSpace(specimen.PatientNameSnapshot)
            || specimen.PatientDateOfBirthSnapshot is null)
            throw new SpecimenDomainException(
                "Patient context is unavailable on the specimen.",
                code: "patient_context_unavailable");

        if (!string.Equals(Normalize(specimen.PatientMrnSnapshot), Normalize(confirmedMrn), StringComparison.Ordinal)
            || !string.Equals(Normalize(specimen.PatientNameSnapshot), Normalize(confirmedName), StringComparison.Ordinal)
            || specimen.PatientDateOfBirthSnapshot.Value.Date != confirmedDob.Date)
        {
            throw new SpecimenDomainException(
                "Patient identity confirmation does not match specimen context.",
                code: "patient_confirmation_failure");
        }
    }

    private async Task<SpecimenDetailDto> MapDetailAsync(Guid tenantId, Guid specimenId, CancellationToken ct)
    {
        var specimen = await _db.Specimens.AsNoTracking()
            .FirstOrDefaultAsync(s => s.Id == specimenId && s.TenantId == tenantId, ct)
            ?? throw new SpecimenDomainException("Specimen not found.", statusCode: 404, code: "not_found");

        var task = await _db.CollectionTasks.AsNoTracking()
            .FirstOrDefaultAsync(t => t.Id == specimen.CollectionTaskId && t.TenantId == tenantId, ct);
        var order = await _db.Orders.AsNoTracking()
            .FirstOrDefaultAsync(o => o.Id == specimen.OrderId && o.TenantId == tenantId, ct);

        var links = await _db.SpecimenOrderTests.AsNoTracking()
            .Where(l => l.SpecimenId == specimenId && l.TenantId == tenantId)
            .OrderBy(l => l.SortOrder)
            .ToListAsync(ct);
        var otIds = links.Select(l => l.OrderTestId).ToList();
        var tests = await _db.OrderTests.AsNoTracking()
            .Where(t => t.TenantId == tenantId && otIds.Contains(t.Id))
            .ToDictionaryAsync(t => t.Id, ct);

        var otDtos = links.Select(l =>
        {
            tests.TryGetValue(l.OrderTestId, out var ot);
            return new SpecimenOrderTestDto(
                l.Id,
                l.OrderTestId,
                l.OrderId,
                l.SortOrder,
                ot?.DisplayNameSnapshot,
                ot?.InternalOrderCodeSnapshot,
                ot?.Status);
        }).ToList();

        var barcode = await _db.SpecimenBarcodes.AsNoTracking()
            .Where(b => b.TenantId == tenantId && b.SpecimenId == specimenId && b.IsActive)
            .Select(b => new { b.Id, b.BarcodeValue })
            .FirstOrDefaultAsync(ct);

        return new SpecimenDetailDto(
            specimen.Id,
            specimen.Status,
            specimen.CollectionTaskId,
            task?.TaskNumber,
            specimen.OrderId,
            order?.OrderNumber ?? string.Empty,
            specimen.PatientId,
            specimen.PatientMrnSnapshot,
            specimen.PatientNameSnapshot,
            specimen.PatientDateOfBirthSnapshot,
            specimen.CollectionBranchId,
            specimen.LocationText,
            specimen.CollectedByUserId,
            specimen.CollectedAt,
            specimen.Accession,
            barcode?.BarcodeValue,
            barcode?.Id,
            specimen.ReceivedAtUtc,
            specimen.ReceivedByUserId,
            specimen.ReceivingBranchId,
            specimen.ReceivingLocationText,
            specimen.RejectionReasonCode,
            specimen.RejectionReasonLabelSnapshot,
            specimen.RejectedAtUtc,
            specimen.RejectedByUserId,
            specimen.CreatedAt,
            specimen.CreatedBy,
            specimen.UpdatedAt,
            specimen.UpdatedBy,
            specimen.RowVersion,
            otDtos);
    }

    private async Task<IdempotencyClaim> ClaimIdempotencyAsync(
        Guid tenantId, string? key, string operation, string requestHash, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(key))
            return new IdempotencyClaim(null, null);

        var normalized = key.Trim();
        var existing = await _db.SpecimenIdempotencyRecords.AsNoTracking()
            .FirstOrDefaultAsync(r => r.TenantId == tenantId && r.IdempotencyKey == normalized, ct);
        if (existing is not null)
            return new IdempotencyClaim(null, ResolveIdempotentReplay(existing, operation, requestHash));

        var claimId = Guid.NewGuid();
        _db.SpecimenIdempotencyRecords.Add(new LmsSpecimenIdempotencyRecord
        {
            Id = claimId,
            TenantId = tenantId,
            IdempotencyKey = normalized,
            Operation = operation,
            RequestHash = requestHash,
            SpecimenId = Guid.Empty,
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
            foreach (var entry in _db.ChangeTracker.Entries<LmsSpecimenIdempotencyRecord>()
                         .Where(e => e.Entity.Id == claimId).ToList())
                entry.State = EntityState.Detached;

            for (var i = 0; i < 20; i++)
            {
                var raced = await _db.SpecimenIdempotencyRecords.AsNoTracking()
                    .FirstOrDefaultAsync(r => r.TenantId == tenantId && r.IdempotencyKey == normalized, ct);
                if (raced is null)
                    break;
                if (!string.IsNullOrEmpty(raced.ResponseJson) && raced.SpecimenId != Guid.Empty)
                    return new IdempotencyClaim(null, ResolveIdempotentReplay(raced, operation, requestHash));
                await Task.Delay(25, ct);
            }

            var final = await _db.SpecimenIdempotencyRecords.AsNoTracking()
                .FirstOrDefaultAsync(r => r.TenantId == tenantId && r.IdempotencyKey == normalized, ct)
                ?? throw new SpecimenDomainException(
                    "Idempotency key conflict.",
                    statusCode: 409,
                    code: "idempotency_conflict");
            if (string.IsNullOrEmpty(final.ResponseJson) || final.SpecimenId == Guid.Empty)
                throw new SpecimenDomainException(
                    "Idempotent request is still in progress. Retry shortly.",
                    statusCode: 409,
                    code: "idempotency_in_progress");
            return new IdempotencyClaim(null, ResolveIdempotentReplay(final, operation, requestHash));
        }
    }

    private static SpecimenDetailDto ResolveIdempotentReplay(
        LmsSpecimenIdempotencyRecord existing, string operation, string requestHash)
    {
        if (!string.Equals(existing.Operation, operation, StringComparison.Ordinal)
            || !string.Equals(existing.RequestHash, requestHash, StringComparison.Ordinal))
            throw new SpecimenDomainException(
                "Idempotency key was reused with a different request.",
                statusCode: 409,
                code: "idempotency_conflict");
        var detail = JsonSerializer.Deserialize<SpecimenDetailDto>(existing.ResponseJson, JsonOpts);
        if (detail is null)
            throw new SpecimenDomainException(
                "Idempotency replay payload is corrupt.",
                statusCode: 500,
                code: "idempotency_corrupt");
        return detail;
    }

    private async Task CompleteIdempotencyAsync(
        Guid tenantId, Guid? claimId, SpecimenDetailDto detail, CancellationToken ct)
    {
        if (claimId is null) return;
        var record = await _db.SpecimenIdempotencyRecords
            .FirstOrDefaultAsync(r => r.Id == claimId && r.TenantId == tenantId, ct);
        if (record is null) return;
        record.SpecimenId = detail.Id;
        record.ResponseJson = JsonSerializer.Serialize(detail, JsonOpts);
        await _db.SaveChangesAsync(ct);
    }

    private async Task ReleaseIdempotencyClaimAsync(Guid tenantId, Guid? claimId, CancellationToken ct)
    {
        if (claimId is null) return;
        var record = await _db.SpecimenIdempotencyRecords
            .FirstOrDefaultAsync(r => r.Id == claimId && r.TenantId == tenantId, ct);
        if (record is null) return;
        _db.SpecimenIdempotencyRecords.Remove(record);
        await _db.SaveChangesAsync(ct);
    }

    private static string HashRequest(object req)
    {
        var json = JsonSerializer.Serialize(req, JsonOpts);
        var bytes = SHA256.HashData(Encoding.UTF8.GetBytes(json));
        return Convert.ToHexString(bytes);
    }

    private static string Normalize(string? s) => (s ?? string.Empty).Trim();

    private static string? TrimOrNull(string? s) =>
        string.IsNullOrWhiteSpace(s) ? null : s.Trim();

    private static bool IsUniqueViolation(DbUpdateException ex) =>
        ex.InnerException?.Message.Contains("unique", StringComparison.OrdinalIgnoreCase) == true
        || ex.InnerException?.Message.Contains("duplicate", StringComparison.OrdinalIgnoreCase) == true;

    private sealed record IdempotencyClaim(Guid? ClaimId, SpecimenDetailDto? Replay);
    private sealed record SequenceAllocRow(int Value);
}
