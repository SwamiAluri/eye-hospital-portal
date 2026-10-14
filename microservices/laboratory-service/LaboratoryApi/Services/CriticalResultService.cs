using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using LaboratoryApi.Data;
using LaboratoryApi.Domain;
using Microsoft.EntityFrameworkCore;

namespace LaboratoryApi.Services;

public interface ICriticalResultService
{
    Task<CriticalEventDto> CreateAsync(
        Guid tenantId, Guid actorUserId, Guid resultId, CreateCriticalEventRequest req,
        CancellationToken ct = default);

    Task<CriticalEventDto> AcknowledgeAsync(
        Guid tenantId, Guid actorUserId, Guid resultId, Guid criticalEventId,
        AcknowledgeCriticalEventRequest req, CancellationToken ct = default);

    Task<IReadOnlyList<CriticalEventDto>> ListForResultAsync(
        Guid tenantId, Guid actorUserId, Guid resultId, Guid operatingBranchId,
        CancellationToken ct = default);

    Task<CriticalWorkQueuePageDto> ListWorkQueueAsync(
        Guid tenantId, Guid actorUserId, CriticalWorkQueueQuery query,
        CancellationToken ct = default);
}

/// <summary>
/// L-CRT-01 — Manual Critical classification + acknowledgement.
/// Does not change ResultStatus. Does not invent thresholds/escalation.
/// </summary>
public sealed class CriticalResultService : ICriticalResultService
{
    private static readonly JsonSerializerOptions JsonOpts = new()
    {
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
    };

    private readonly LaboratoryDbContext _db;
    private readonly IPlatformAuditClient _audit;
    private readonly IPlatformReferenceClient _platform;
    private readonly IPlatformNotificationClient _notifications;

    public CriticalResultService(
        LaboratoryDbContext db,
        IPlatformAuditClient audit,
        IPlatformReferenceClient platform,
        IPlatformNotificationClient notifications)
    {
        _db = db;
        _audit = audit;
        _platform = platform;
        _notifications = notifications;
    }

    public async Task<CriticalEventDto> CreateAsync(
        Guid tenantId, Guid actorUserId, Guid resultId, CreateCriticalEventRequest req,
        CancellationToken ct = default)
    {
        if (req.OperatingBranchId == Guid.Empty)
            throw new TestingDomainException(
                "Operating branch is required.", statusCode: 400, code: "operating_branch_required");

        await _platform.ValidateUserBranchAsync(tenantId, actorUserId, req.OperatingBranchId, ct);

        var hash = HashRequest(new
        {
            resultId,
            req.OperatingBranchId,
            req.ExpectedResultVersionNumber,
        });

        var claim = await ClaimIdempotencyAsync(
            tenantId, req.IdempotencyKey, CriticalIdempotencyOperations.CreateCriticalEvent, hash, ct);
        if (claim.ReplayJson is not null)
            return DeserializeDto(claim.ReplayJson);

        try
        {
            var result = await _db.Results
                .FirstOrDefaultAsync(r => r.Id == resultId && r.TenantId == tenantId, ct)
                ?? throw new TestingDomainException("Result not found.", statusCode: 404, code: "not_found");

            EnsureClassifiableStatus(result.Status);

            if (req.ExpectedResultVersionNumber is int expected
                && expected != result.CurrentVersionNumber)
                throw new TestingDomainException(
                    "Result version changed; classify the current Result Version only.",
                    statusCode: 409, code: "version_conflict");

            await LoadEligibleContextAsync(
                tenantId, result.OrderTestId, result.SpecimenId, req.OperatingBranchId, ct);

            var versionNumber = result.CurrentVersionNumber;
            var versionExists = await _db.ResultVersions.AsNoTracking().AnyAsync(v =>
                v.TenantId == tenantId
                && v.ResultId == result.Id
                && v.VersionNumber == versionNumber, ct);
            if (!versionExists)
                throw new TestingDomainException(
                    "Current Result Version is missing; cannot classify Critical.",
                    statusCode: 409, code: "version_missing");

            var existing = await _db.CriticalResultEvents
                .FirstOrDefaultAsync(e =>
                    e.TenantId == tenantId
                    && e.ResultId == result.Id
                    && e.ResultVersionNumber == versionNumber, ct);
            if (existing is not null)
                throw new TestingDomainException(
                    "A Critical event already exists for this Result Version.",
                    statusCode: 409, code: "already_critical");

            var orderTestBefore = await _db.OrderTests.AsNoTracking()
                .FirstAsync(t => t.Id == result.OrderTestId && t.TenantId == tenantId, ct);
            if (!string.Equals(orderTestBefore.Status, OrderTestStatuses.Ordered, StringComparison.Ordinal))
                throw new TestingDomainException(
                    "OrderTest must remain Ordered.", statusCode: 409, code: "order_test_not_ordered");

            var now = DateTime.UtcNow;
            var evt = new LmsCriticalResultEvent
            {
                Id = Guid.NewGuid(),
                TenantId = tenantId,
                ResultId = result.Id,
                ResultVersionNumber = versionNumber,
                OperatingBranchId = req.OperatingBranchId,
                Status = CriticalResultEventStatuses.Open,
                ClassifiedByUserId = actorUserId,
                ClassifiedAtUtc = now,
                NotificationIntentStatus = CriticalNotificationIntentStatuses.NotAttempted,
                CreatedAtUtc = now,
                CreatedByUserId = actorUserId,
                UpdatedAtUtc = now,
                UpdatedByUserId = actorUserId,
                RowVersion = 1,
            };

            _db.CriticalResultEvents.Add(evt);
            try
            {
                await _db.SaveChangesAsync(ct);
            }
            catch (DbUpdateException ex) when (IsUniqueViolation(ex))
            {
                throw new TestingDomainException(
                    "A Critical event already exists for this Result Version.",
                    statusCode: 409, code: "already_critical");
            }

            var orderTestAfter = await _db.OrderTests.AsNoTracking()
                .FirstAsync(t => t.Id == result.OrderTestId && t.TenantId == tenantId, ct);
            if (!string.Equals(orderTestAfter.Status, OrderTestStatuses.Ordered, StringComparison.Ordinal))
                throw new TestingDomainException(
                    "OrderTest status must remain Ordered.", statusCode: 500, code: "order_test_mutated");

            if (!string.Equals(result.Status, ResultStatuses.TechnicalVerified, StringComparison.Ordinal)
                && !string.Equals(result.Status, ResultStatuses.ClinicallyAuthorized, StringComparison.Ordinal))
                throw new TestingDomainException(
                    "ResultStatus must remain TechnicalVerified or ClinicallyAuthorized.",
                    statusCode: 500, code: "result_status_mutated");

            try
            {
                await _audit.WriteAsync(
                    tenantId, actorUserId,
                    CriticalAuditActions.CreateCriticalEvent,
                    CriticalAuditResources.LmsCriticalResultEvent,
                    evt.Id,
                    details:
                    $"resultId={result.Id}; resultVersion={versionNumber}; resultStatus={result.Status}; criticalStatus={evt.Status}; operatingBranchId={req.OperatingBranchId}",
                    ct: ct);
            }
            catch
            {
                await RevertCreateAsync(tenantId, evt.Id, ct);
                throw new TestingDomainException(
                    "Audit unavailable. Critical classification was not completed.",
                    statusCode: 503, code: "audit_unavailable");
            }

            await TryEmitNotificationIntentAsync(tenantId, evt, result, ct);

            var dto = await ToDtoAsync(tenantId, evt, result, ct);
            await CompleteIdempotencyAsync(tenantId, claim.ClaimId, result.Id, dto, ct);
            return dto;
        }
        catch
        {
            await TryAbandonIdempotencyAsync(tenantId, claim.ClaimId, ct);
            throw;
        }
    }

    public async Task<CriticalEventDto> AcknowledgeAsync(
        Guid tenantId, Guid actorUserId, Guid resultId, Guid criticalEventId,
        AcknowledgeCriticalEventRequest req, CancellationToken ct = default)
    {
        if (req.OperatingBranchId == Guid.Empty)
            throw new TestingDomainException(
                "Operating branch is required.", statusCode: 400, code: "operating_branch_required");
        if (req.ExpectedRowVersion <= 0)
            throw new TestingDomainException(
                "ExpectedRowVersion is required.", statusCode: 409, code: "concurrency_conflict");

        var evidence = (req.AcknowledgementEvidence ?? string.Empty).Trim();
        if (evidence.Length == 0)
            throw new TestingDomainException(
                "Acknowledgement evidence is required.",
                statusCode: 400, code: "acknowledgement_evidence_required");

        await _platform.ValidateUserBranchAsync(tenantId, actorUserId, req.OperatingBranchId, ct);

        var hash = HashRequest(new
        {
            resultId,
            criticalEventId,
            req.OperatingBranchId,
            req.ExpectedRowVersion,
            evidence,
        });

        var claim = await ClaimIdempotencyAsync(
            tenantId, req.IdempotencyKey, CriticalIdempotencyOperations.AcknowledgeCriticalEvent, hash, ct);
        if (claim.ReplayJson is not null)
            return DeserializeDto(claim.ReplayJson);

        try
        {
            var evt = await _db.CriticalResultEvents
                .FirstOrDefaultAsync(e =>
                    e.Id == criticalEventId
                    && e.ResultId == resultId
                    && e.TenantId == tenantId, ct)
                ?? throw new TestingDomainException("Critical event not found.", statusCode: 404, code: "not_found");

            if (evt.RowVersion != req.ExpectedRowVersion)
                throw new TestingDomainException(
                    "Critical event was modified by another user.",
                    statusCode: 409, code: "concurrency_conflict");

            if (string.Equals(evt.Status, CriticalResultEventStatuses.Acknowledged, StringComparison.Ordinal))
                throw new TestingDomainException(
                    "Critical event is already acknowledged.",
                    statusCode: 409, code: "already_acknowledged");

            if (!string.Equals(evt.Status, CriticalResultEventStatuses.Open, StringComparison.Ordinal))
                throw new TestingDomainException(
                    "Only Open Critical events can be acknowledged.",
                    statusCode: 409, code: "invalid_state");

            if (evt.OperatingBranchId != req.OperatingBranchId)
                throw new TestingDomainException(
                    "Critical event is outside the authorized operating branch context.",
                    statusCode: 403, code: "branch_unauthorized");

            var result = await _db.Results
                .FirstOrDefaultAsync(r => r.Id == resultId && r.TenantId == tenantId, ct)
                ?? throw new TestingDomainException("Result not found.", statusCode: 404, code: "not_found");

            await LoadEligibleContextAsync(
                tenantId, result.OrderTestId, result.SpecimenId, req.OperatingBranchId, ct);

            var priorStatus = evt.Status;
            var priorAckBy = evt.AcknowledgedByUserId;
            var priorAckAt = evt.AcknowledgedAtUtc;
            var priorEvidence = evt.AcknowledgementEvidence;
            var priorUpdatedAt = evt.UpdatedAtUtc;
            var priorUpdatedBy = evt.UpdatedByUserId;
            var priorRowVersion = evt.RowVersion;

            var now = DateTime.UtcNow;
            evt.Status = CriticalResultEventStatuses.Acknowledged;
            evt.AcknowledgedByUserId = actorUserId;
            evt.AcknowledgedAtUtc = now;
            evt.AcknowledgementEvidence = evidence;
            evt.UpdatedAtUtc = now;
            evt.UpdatedByUserId = actorUserId;
            evt.RowVersion++;

            try
            {
                await _db.SaveChangesAsync(ct);
            }
            catch (DbUpdateConcurrencyException)
            {
                throw new TestingDomainException(
                    "Critical event was modified by another user.",
                    statusCode: 409, code: "concurrency_conflict");
            }

            try
            {
                await _audit.WriteAsync(
                    tenantId, actorUserId,
                    CriticalAuditActions.AcknowledgeCriticalEvent,
                    CriticalAuditResources.LmsCriticalResultEvent,
                    evt.Id,
                    reason: evidence.Length > 500 ? evidence[..500] : evidence,
                    details:
                    $"resultId={result.Id}; resultVersion={evt.ResultVersionNumber}; criticalStatus={evt.Status}; rowVersion={evt.RowVersion}; operatingBranchId={req.OperatingBranchId}",
                    ct: ct);
            }
            catch
            {
                await RevertAcknowledgeAsync(
                    tenantId, evt.Id,
                    priorStatus, priorAckBy, priorAckAt, priorEvidence,
                    priorUpdatedAt, priorUpdatedBy, priorRowVersion, ct);
                throw new TestingDomainException(
                    "Audit unavailable. Critical acknowledgement was not completed.",
                    statusCode: 503, code: "audit_unavailable");
            }

            var dto = await ToDtoAsync(tenantId, evt, result, ct);
            await CompleteIdempotencyAsync(tenantId, claim.ClaimId, result.Id, dto, ct);
            return dto;
        }
        catch
        {
            await TryAbandonIdempotencyAsync(tenantId, claim.ClaimId, ct);
            throw;
        }
    }

    public async Task<IReadOnlyList<CriticalEventDto>> ListForResultAsync(
        Guid tenantId, Guid actorUserId, Guid resultId, Guid operatingBranchId,
        CancellationToken ct = default)
    {
        if (operatingBranchId == Guid.Empty)
            throw new TestingDomainException(
                "Operating branch is required.", statusCode: 400, code: "operating_branch_required");

        await _platform.ValidateUserBranchAsync(tenantId, actorUserId, operatingBranchId, ct);

        var result = await _db.Results.AsNoTracking()
            .FirstOrDefaultAsync(r => r.Id == resultId && r.TenantId == tenantId, ct)
            ?? throw new TestingDomainException("Result not found.", statusCode: 404, code: "not_found");

        var events = await _db.CriticalResultEvents.AsNoTracking()
            .Where(e => e.TenantId == tenantId && e.ResultId == resultId)
            .OrderByDescending(e => e.ClassifiedAtUtc)
            .ToListAsync(ct);

        var list = new List<CriticalEventDto>(events.Count);
        foreach (var evt in events)
            list.Add(await ToDtoAsync(tenantId, evt, result, ct));
        return list;
    }

    public async Task<CriticalWorkQueuePageDto> ListWorkQueueAsync(
        Guid tenantId, Guid actorUserId, CriticalWorkQueueQuery query,
        CancellationToken ct = default)
    {
        if (query.OperatingBranchId is null || query.OperatingBranchId == Guid.Empty)
            throw new TestingDomainException(
                "Operating branch is required.", statusCode: 400, code: "operating_branch_required");

        await _platform.ValidateUserBranchAsync(tenantId, actorUserId, query.OperatingBranchId.Value, ct);

        var page = query.Page < 1 ? 1 : query.Page;
        var pageSize = query.PageSize < 1 ? 25 : Math.Min(query.PageSize, 100);
        var statusFilter = string.IsNullOrWhiteSpace(query.Status) ? null : query.Status.Trim();

        var q =
            from evt in _db.CriticalResultEvents.AsNoTracking()
            join result in _db.Results.AsNoTracking() on evt.ResultId equals result.Id
            join order in _db.Orders.AsNoTracking() on result.OrderId equals order.Id
            join orderVersion in _db.OrderVersions.AsNoTracking() on order.CurrentVersionId equals orderVersion.Id
            join orderTest in _db.OrderTests.AsNoTracking() on result.OrderTestId equals orderTest.Id
            where evt.TenantId == tenantId
                  && evt.OperatingBranchId == query.OperatingBranchId.Value
            select new { evt, result, order, orderVersion, orderTest };

        if (statusFilter is not null)
            q = q.Where(x => x.evt.Status == statusFilter);

        if (!string.IsNullOrWhiteSpace(query.Search))
        {
            var s = query.Search.Trim();
            q = q.Where(x =>
                x.order.OrderNumber.Contains(s)
                || x.orderTest.DisplayNameSnapshot.Contains(s)
                || x.orderTest.InternalOrderCodeSnapshot.Contains(s)
                || x.result.Id.ToString().Contains(s));
        }

        var total = await q.CountAsync(ct);
        var rows = await q
            .OrderByDescending(x => x.evt.ClassifiedAtUtc)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .ToListAsync(ct);

        var items = new List<CriticalWorkQueueItemDto>(rows.Count);
        foreach (var row in rows)
        {
            items.Add(new CriticalWorkQueueItemDto(
                CriticalEventId: row.evt.Id,
                ResultId: row.result.Id,
                ResultVersionNumber: row.evt.ResultVersionNumber,
                CriticalStatus: row.evt.Status,
                ResultStatus: row.result.Status,
                OperatingBranchId: row.evt.OperatingBranchId,
                ClassifiedAtUtc: row.evt.ClassifiedAtUtc,
                ClassifiedByUserId: row.evt.ClassifiedByUserId,
                AcknowledgedAtUtc: row.evt.AcknowledgedAtUtc,
                AcknowledgedByUserId: row.evt.AcknowledgedByUserId,
                NotificationIntentStatus: row.evt.NotificationIntentStatus,
                OrderId: row.order.Id,
                OrderNumber: row.order.OrderNumber,
                OrderTestId: row.orderTest.Id,
                SpecimenId: row.result.SpecimenId,
                PatientId: row.orderVersion.PatientId,
                PatientMrn: row.orderVersion.PatientMrnSnapshot,
                PatientName: row.orderVersion.PatientNameSnapshot,
                TestDisplayName: row.orderTest.DisplayNameSnapshot,
                InternalOrderCode: row.orderTest.InternalOrderCodeSnapshot,
                RowVersion: row.evt.RowVersion));
        }

        return new CriticalWorkQueuePageDto(items, page, pageSize, total);
    }

    private async Task TryEmitNotificationIntentAsync(
        Guid tenantId, LmsCriticalResultEvent evt, LmsResult result, CancellationToken ct)
    {
        try
        {
            var details =
                $"criticalEventId={evt.Id};resultId={result.Id};resultVersion={evt.ResultVersionNumber};branchId={evt.OperatingBranchId}";
            await _notifications.EmitTenantIntentAsync(
                tenantId,
                PlatformNotificationClient.CriticalResultIntentType,
                "Critical laboratory result classified (staff in-app intent).",
                details,
                ct);

            evt.NotificationIntentStatus = CriticalNotificationIntentStatuses.Emitted;
            evt.NotificationIntentDetail = null;
            evt.UpdatedAtUtc = DateTime.UtcNow;
            await _db.SaveChangesAsync(ct);
        }
        catch (TestingDomainException ex) when (ex.Code == "notification_unavailable")
        {
            evt.NotificationIntentStatus = CriticalNotificationIntentStatuses.Unavailable;
            evt.NotificationIntentDetail = "Notification infrastructure unavailable.";
            evt.UpdatedAtUtc = DateTime.UtcNow;
            await _db.SaveChangesAsync(ct);
        }
        catch (Exception)
        {
            evt.NotificationIntentStatus = CriticalNotificationIntentStatuses.Failed;
            evt.NotificationIntentDetail = "Notification intent emission failed.";
            evt.UpdatedAtUtc = DateTime.UtcNow;
            await _db.SaveChangesAsync(ct);
        }
    }

    private static void EnsureClassifiableStatus(string status)
    {
        if (string.Equals(status, ResultStatuses.Draft, StringComparison.Ordinal))
            throw new TestingDomainException(
                "Draft results cannot be classified as Critical.",
                statusCode: 409, code: "invalid_state");

        if (!string.Equals(status, ResultStatuses.TechnicalVerified, StringComparison.Ordinal)
            && !string.Equals(status, ResultStatuses.ClinicallyAuthorized, StringComparison.Ordinal))
            throw new TestingDomainException(
                "Only Technical Verified or Clinically Authorized results can be classified as Critical.",
                statusCode: 409, code: "invalid_state");
    }

    private async Task<(LmsOrderTest OrderTest, LmsOrder Order, LmsSpecimen Specimen, LmsCatalogueVersion CatalogueVersion)>
        LoadEligibleContextAsync(
            Guid tenantId, Guid orderTestId, Guid specimenId, Guid operatingBranchId, CancellationToken ct)
    {
        var specimen = await _db.Specimens
            .FirstOrDefaultAsync(s => s.Id == specimenId && s.TenantId == tenantId, ct)
            ?? throw new TestingDomainException("Specimen not found.", statusCode: 404, code: "not_found");

        if (string.Equals(specimen.Status, SpecimenStatuses.Rejected, StringComparison.Ordinal))
            throw new TestingDomainException(
                "Rejected specimens are not eligible.",
                statusCode: 409, code: "specimen_rejected");

        if (!string.Equals(specimen.Status, SpecimenStatuses.Received, StringComparison.Ordinal))
            throw new TestingDomainException(
                "Specimen must be Received.",
                statusCode: 409, code: "specimen_not_received");

        if (specimen.ReceivingBranchId != operatingBranchId)
            throw new TestingDomainException(
                "Specimen is outside the authorized operating branch context.",
                statusCode: 403, code: "branch_unauthorized");

        var link = await _db.SpecimenOrderTests.AsNoTracking()
            .FirstOrDefaultAsync(l =>
                l.TenantId == tenantId && l.SpecimenId == specimenId && l.OrderTestId == orderTestId, ct)
            ?? throw new TestingDomainException(
                "OrderTest is not linked to the Specimen.",
                statusCode: 409, code: "not_linked");

        var orderTest = await _db.OrderTests
            .FirstOrDefaultAsync(t => t.Id == orderTestId && t.TenantId == tenantId, ct)
            ?? throw new TestingDomainException("OrderTest not found.", statusCode: 404, code: "not_found");

        if (!string.Equals(orderTest.Status, OrderTestStatuses.Ordered, StringComparison.Ordinal))
            throw new TestingDomainException(
                "OrderTest must remain Ordered.", statusCode: 409, code: "order_test_not_ordered");

        if (string.Equals(orderTest.CatalogueType, CatalogueTypes.ReferralTest, StringComparison.OrdinalIgnoreCase))
            throw new TestingDomainException(
                "Referral tests are not eligible for local Critical classification.",
                statusCode: 409, code: "referral_not_eligible");

        var order = await _db.Orders
            .FirstOrDefaultAsync(o => o.Id == link.OrderId && o.TenantId == tenantId, ct)
            ?? throw new TestingDomainException("Order not found.", statusCode: 404, code: "not_found");

        if (!string.Equals(order.Status, OrderStatuses.Submitted, StringComparison.Ordinal))
            throw new TestingDomainException(
                "Order must be Submitted.",
                statusCode: 409, code: "order_not_submitted");

        var cat = await _db.CatalogueVersions.AsNoTracking()
            .FirstOrDefaultAsync(v => v.Id == orderTest.CatalogueVersionId && v.TenantId == tenantId, ct)
            ?? throw new TestingDomainException(
                "Catalogue version not found for OrderTest.",
                statusCode: 409, code: "catalogue_missing");

        if (!string.Equals(cat.Classification, CatalogueClassifications.Local, StringComparison.OrdinalIgnoreCase))
            throw new TestingDomainException(
                "Only local catalogue orderables are eligible.",
                statusCode: 409, code: "not_local");

        return (orderTest, order, specimen, cat);
    }

    private async Task<CriticalEventDto> ToDtoAsync(
        Guid tenantId, LmsCriticalResultEvent evt, LmsResult result, CancellationToken ct)
    {
        var order = await _db.Orders.AsNoTracking()
            .FirstAsync(o => o.Id == result.OrderId && o.TenantId == tenantId, ct);
        var orderVersion = await _db.OrderVersions.AsNoTracking()
            .FirstAsync(v => v.Id == order.CurrentVersionId && v.TenantId == tenantId, ct);
        var orderTest = await _db.OrderTests.AsNoTracking()
            .FirstAsync(t => t.Id == result.OrderTestId && t.TenantId == tenantId, ct);

        return new CriticalEventDto(
            Id: evt.Id,
            ResultId: evt.ResultId,
            ResultVersionNumber: evt.ResultVersionNumber,
            OperatingBranchId: evt.OperatingBranchId,
            Status: evt.Status,
            ResultStatus: result.Status,
            ClassifiedByUserId: evt.ClassifiedByUserId,
            ClassifiedAtUtc: evt.ClassifiedAtUtc,
            AcknowledgedByUserId: evt.AcknowledgedByUserId,
            AcknowledgedAtUtc: evt.AcknowledgedAtUtc,
            AcknowledgementEvidence: evt.AcknowledgementEvidence,
            NotificationIntentStatus: evt.NotificationIntentStatus,
            NotificationIntentDetail: evt.NotificationIntentDetail,
            RowVersion: evt.RowVersion,
            OrderId: order.Id,
            OrderNumber: order.OrderNumber,
            OrderTestId: orderTest.Id,
            SpecimenId: result.SpecimenId,
            PatientId: orderVersion.PatientId,
            PatientMrn: orderVersion.PatientMrnSnapshot,
            PatientName: orderVersion.PatientNameSnapshot,
            TestDisplayName: orderTest.DisplayNameSnapshot,
            InternalOrderCode: orderTest.InternalOrderCodeSnapshot);
    }

    private async Task RevertCreateAsync(Guid tenantId, Guid eventId, CancellationToken ct)
    {
        _db.ChangeTracker.Clear();
        var row = await _db.CriticalResultEvents
            .FirstOrDefaultAsync(e => e.Id == eventId && e.TenantId == tenantId, ct);
        if (row is null) return;
        _db.CriticalResultEvents.Remove(row);
        await _db.SaveChangesAsync(ct);
    }

    private async Task RevertAcknowledgeAsync(
        Guid tenantId, Guid eventId,
        string priorStatus, Guid? priorAckBy, DateTime? priorAckAt, string? priorEvidence,
        DateTime priorUpdatedAt, Guid priorUpdatedBy, int priorRowVersion,
        CancellationToken ct)
    {
        _db.ChangeTracker.Clear();
        var row = await _db.CriticalResultEvents
            .FirstOrDefaultAsync(e => e.Id == eventId && e.TenantId == tenantId, ct);
        if (row is null) return;
        row.Status = priorStatus;
        row.AcknowledgedByUserId = priorAckBy;
        row.AcknowledgedAtUtc = priorAckAt;
        row.AcknowledgementEvidence = priorEvidence;
        row.UpdatedAtUtc = priorUpdatedAt;
        row.UpdatedByUserId = priorUpdatedBy;
        row.RowVersion = priorRowVersion;
        await _db.SaveChangesAsync(ct);
    }

    private sealed record IdempotencyClaim(Guid? ClaimId, string? ReplayJson);

    private async Task<IdempotencyClaim> ClaimIdempotencyAsync(
        Guid tenantId, string? key, string operation, string requestHash, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(key))
            return new IdempotencyClaim(null, null);

        var normalized = key.Trim();
        var existing = await _db.ResultIdempotencyRecords.AsNoTracking()
            .FirstOrDefaultAsync(r => r.TenantId == tenantId && r.IdempotencyKey == normalized, ct);
        if (existing is not null)
            return new IdempotencyClaim(null, ResolveReplay(existing, operation, requestHash));

        var claimId = Guid.NewGuid();
        _db.ResultIdempotencyRecords.Add(new LmsResultIdempotencyRecord
        {
            Id = claimId,
            TenantId = tenantId,
            IdempotencyKey = normalized,
            Operation = operation,
            RequestHash = requestHash,
            ResultId = Guid.Empty,
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
            foreach (var entry in _db.ChangeTracker.Entries<LmsResultIdempotencyRecord>()
                         .Where(e => e.Entity.Id == claimId).ToList())
                entry.State = EntityState.Detached;

            for (var i = 0; i < 20; i++)
            {
                var raced = await _db.ResultIdempotencyRecords.AsNoTracking()
                    .FirstOrDefaultAsync(r => r.TenantId == tenantId && r.IdempotencyKey == normalized, ct);
                if (raced is null) break;
                if (!string.IsNullOrEmpty(raced.ResponseJson) && raced.ResultId != Guid.Empty)
                    return new IdempotencyClaim(null, ResolveReplay(raced, operation, requestHash));
                await Task.Delay(25, ct);
            }

            var final = await _db.ResultIdempotencyRecords.AsNoTracking()
                .FirstOrDefaultAsync(r => r.TenantId == tenantId && r.IdempotencyKey == normalized, ct)
                ?? throw new TestingDomainException(
                    "Idempotency key conflict.", statusCode: 409, code: "idempotency_conflict");
            if (string.IsNullOrEmpty(final.ResponseJson) || final.ResultId == Guid.Empty)
                throw new TestingDomainException(
                    "Idempotent request is still in progress. Retry shortly.",
                    statusCode: 409, code: "idempotency_in_progress");
            return new IdempotencyClaim(null, ResolveReplay(final, operation, requestHash));
        }
    }

    private static string ResolveReplay(LmsResultIdempotencyRecord existing, string operation, string requestHash)
    {
        if (!string.Equals(existing.Operation, operation, StringComparison.Ordinal)
            || !string.Equals(existing.RequestHash, requestHash, StringComparison.Ordinal))
            throw new TestingDomainException(
                "Idempotency key was reused with a different request.",
                statusCode: 409, code: "idempotency_conflict");
        return existing.ResponseJson;
    }

    private async Task CompleteIdempotencyAsync(
        Guid tenantId, Guid? claimId, Guid resultId, CriticalEventDto dto, CancellationToken ct)
    {
        if (claimId is null) return;
        var row = await _db.ResultIdempotencyRecords
            .FirstOrDefaultAsync(r => r.Id == claimId && r.TenantId == tenantId, ct);
        if (row is null) return;
        row.ResultId = resultId;
        row.ResponseJson = JsonSerializer.Serialize(dto, JsonOpts);
        await _db.SaveChangesAsync(ct);
    }

    private async Task TryAbandonIdempotencyAsync(Guid tenantId, Guid? claimId, CancellationToken ct)
    {
        if (claimId is null) return;
        try
        {
            _db.ChangeTracker.Clear();
            var row = await _db.ResultIdempotencyRecords
                .FirstOrDefaultAsync(r => r.Id == claimId && r.TenantId == tenantId, ct);
            if (row is null || !string.IsNullOrEmpty(row.ResponseJson)) return;
            _db.ResultIdempotencyRecords.Remove(row);
            await _db.SaveChangesAsync(ct);
        }
        catch { /* best-effort */ }
    }

    private static CriticalEventDto DeserializeDto(string json) =>
        JsonSerializer.Deserialize<CriticalEventDto>(json, JsonOpts)
        ?? throw new TestingDomainException(
            "Idempotency replay payload is corrupt.", statusCode: 500, code: "idempotency_corrupt");

    private static string HashRequest(object payload)
    {
        var json = JsonSerializer.Serialize(payload, JsonOpts);
        var bytes = SHA256.HashData(Encoding.UTF8.GetBytes(json));
        return Convert.ToHexString(bytes);
    }

    private static bool IsUniqueViolation(DbUpdateException ex)
    {
        var msg = ex.InnerException?.Message ?? ex.Message;
        return msg.Contains("unique", StringComparison.OrdinalIgnoreCase)
               || msg.Contains("duplicate", StringComparison.OrdinalIgnoreCase)
               || msg.Contains("IX_lms_critical_result_events", StringComparison.OrdinalIgnoreCase);
    }
}
