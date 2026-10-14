using System.Globalization;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using LaboratoryApi.Data;
using LaboratoryApi.Domain;
using Microsoft.EntityFrameworkCore;

namespace LaboratoryApi.Services;

public interface IResultService
{
    Task<TestingWorkQueuePageDto> ListWorkQueueAsync(
        Guid tenantId, Guid actorUserId, TestingWorkQueueQuery query, CancellationToken ct = default);

    Task<TestingWorkItemDetailDto> GetWorkItemAsync(
        Guid tenantId, Guid actorUserId, Guid orderTestId, Guid specimenId, Guid operatingBranchId,
        CancellationToken ct = default);

    Task<ResultDraftDto> GetDraftAsync(Guid tenantId, Guid resultId, CancellationToken ct = default);

    Task<ResultDraftDto> CreateDraftAsync(
        Guid tenantId, Guid actorUserId, CreateResultDraftRequest req, CancellationToken ct = default);

    Task<ResultDraftDto> UpdateDraftAsync(
        Guid tenantId, Guid actorUserId, Guid resultId, UpdateResultDraftRequest req,
        CancellationToken ct = default);

    Task<ResultDraftDto> VerifyAsync(
        Guid tenantId, Guid actorUserId, Guid resultId, VerifyResultRequest req,
        CancellationToken ct = default);

    Task<ResultDraftDto> AuthorizeAsync(
        Guid tenantId, Guid actorUserId, Guid resultId, AuthorizeResultRequest req,
        CancellationToken ct = default);
}

public sealed class ResultService : IResultService
{
    private static readonly JsonSerializerOptions JsonOpts = new()
    {
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
    };

    private readonly LaboratoryDbContext _db;
    private readonly IPlatformAuditClient _audit;
    private readonly IPlatformReferenceClient _platform;

    public ResultService(
        LaboratoryDbContext db, IPlatformAuditClient audit, IPlatformReferenceClient platform)
    {
        _db = db;
        _audit = audit;
        _platform = platform;
    }

    public async Task<TestingWorkQueuePageDto> ListWorkQueueAsync(
        Guid tenantId, Guid actorUserId, TestingWorkQueueQuery query, CancellationToken ct = default)
    {
        if (query.OperatingBranchId is null || query.OperatingBranchId == Guid.Empty)
            throw new TestingDomainException(
                "Operating branch is required for the Testing work queue.",
                statusCode: 400, code: "operating_branch_required");

        await _platform.ValidateUserBranchAsync(tenantId, actorUserId, query.OperatingBranchId.Value, ct);

        var page = Math.Max(1, query.Page);
        var pageSize = Math.Clamp(query.PageSize, 1, 100);

        // Scalar member-init projection (not record ctor / entity-wrapper) so Npgsql can
        // translate Count + OrderBy(ReceivedAtUtc) + Skip/Take. Drafts attached after page load.
        var baseQuery = EligibleWorkScalarQuery(tenantId, query.OperatingBranchId.Value);

        if (!string.IsNullOrWhiteSpace(query.Search))
        {
            var s = query.Search.Trim().ToLowerInvariant();
            baseQuery = baseQuery.Where(x =>
                x.OrderNumber.ToLower().Contains(s)
                || (x.PatientMrn != null && x.PatientMrn.ToLower().Contains(s))
                || (x.PatientName != null && x.PatientName.ToLower().Contains(s))
                || (x.Accession != null && x.Accession.ToLower().Contains(s))
                || x.TestDisplayName.ToLower().Contains(s)
                || x.InternalOrderCode.ToLower().Contains(s)
                || x.OrderTestId.ToString().ToLower().Contains(s)
                || x.SpecimenId.ToString().ToLower().Contains(s));
        }

        if (!string.IsNullOrWhiteSpace(query.Priority))
        {
            var p = query.Priority.Trim();
            baseQuery = baseQuery.Where(x => x.Priority == p);
        }

        if (query.HasDraft == true)
        {
            baseQuery = baseQuery.Where(x => _db.Results.AsNoTracking().Any(r =>
                r.TenantId == tenantId
                && r.OrderTestId == x.OrderTestId
                && r.SpecimenId == x.SpecimenId));
        }
        else if (query.HasDraft == false)
        {
            baseQuery = baseQuery.Where(x => !_db.Results.AsNoTracking().Any(r =>
                r.TenantId == tenantId
                && r.OrderTestId == x.OrderTestId
                && r.SpecimenId == x.SpecimenId));
        }

        if (!string.IsNullOrWhiteSpace(query.ResultStatus))
        {
            // Explicit filter (e.g. Draft for verification, TechnicalVerified for authorization).
            var status = query.ResultStatus.Trim();
            baseQuery = baseQuery.Where(x => _db.Results.AsNoTracking().Any(r =>
                r.TenantId == tenantId
                && r.OrderTestId == x.OrderTestId
                && r.SpecimenId == x.SpecimenId
                && r.Status == status));
        }
        else
        {
            // L-TST-01A actionable Testing work queue default: no Result yet, or Draft only.
            // TechnicalVerified / ClinicallyAuthorized (and any other non-Draft) are excluded.
            baseQuery = baseQuery.Where(x => !_db.Results.AsNoTracking().Any(r =>
                r.TenantId == tenantId
                && r.OrderTestId == x.OrderTestId
                && r.SpecimenId == x.SpecimenId
                && r.Status != ResultStatuses.Draft));
        }

        var total = await baseQuery.CountAsync(ct);
        var rows = await baseQuery
            .OrderByDescending(x => x.ReceivedAtUtc)
            .ThenBy(x => x.SortOrder)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .ToListAsync(ct);

        var specimenIds = rows.Select(r => r.SpecimenId).Distinct().ToList();
        var orderTestIds = rows.Select(r => r.OrderTestId).Distinct().ToList();

        var barcodes = await _db.SpecimenBarcodes.AsNoTracking()
            .Where(b => b.TenantId == tenantId && specimenIds.Contains(b.SpecimenId) && b.IsActive)
            .Select(b => new { b.SpecimenId, b.BarcodeValue })
            .ToListAsync(ct);
        var barcodeMap = barcodes
            .GroupBy(b => b.SpecimenId)
            .ToDictionary(g => g.Key, g => g.First().BarcodeValue);

        var drafts = await _db.Results.AsNoTracking()
            .Where(r =>
                r.TenantId == tenantId
                && orderTestIds.Contains(r.OrderTestId)
                && specimenIds.Contains(r.SpecimenId))
            .Select(r => new
            {
                r.OrderTestId,
                r.SpecimenId,
                r.Id,
                r.Status,
                r.RowVersion,
                r.UpdatedAtUtc,
            })
            .ToListAsync(ct);
        var draftMap = drafts.ToDictionary(
            d => (d.OrderTestId, d.SpecimenId),
            d => d);

        var items = rows.Select(x =>
        {
            draftMap.TryGetValue((x.OrderTestId, x.SpecimenId), out var draft);
            return new TestingWorkQueueItemDto(
                OrderTestId: x.OrderTestId,
                OrderId: x.OrderId,
                OrderNumber: x.OrderNumber,
                Priority: x.Priority,
                PatientId: x.PatientId,
                PatientMrn: x.PatientMrn,
                PatientName: x.PatientName,
                SpecimenId: x.SpecimenId,
                SpecimenStatus: x.SpecimenStatus,
                Accession: x.Accession,
                BarcodeValue: barcodeMap.GetValueOrDefault(x.SpecimenId),
                ReceivingBranchId: x.ReceivingBranchId,
                CollectionBranchId: x.CollectionBranchId,
                ReceivedAtUtc: x.ReceivedAtUtc,
                CollectedAtUtc: x.CollectedAtUtc,
                CatalogueItemId: x.CatalogueItemId,
                CatalogueVersionId: x.CatalogueVersionId,
                CatalogueType: x.CatalogueType,
                TestDisplayName: x.TestDisplayName,
                InternalOrderCode: x.InternalOrderCode,
                ResultDatatype: x.ResultDatatype,
                PermittedUnits: x.PermittedUnits,
                ResultId: draft?.Id,
                ResultStatus: draft?.Status,
                ResultRowVersion: draft?.RowVersion,
                DraftUpdatedAtUtc: draft?.UpdatedAtUtc);
        }).ToList();

        return new TestingWorkQueuePageDto(items, total, page, pageSize);
    }

    public async Task<TestingWorkItemDetailDto> GetWorkItemAsync(
        Guid tenantId, Guid actorUserId, Guid orderTestId, Guid specimenId, Guid operatingBranchId,
        CancellationToken ct = default)
    {
        if (operatingBranchId == Guid.Empty)
            throw new TestingDomainException(
                "Operating branch is required.", statusCode: 400, code: "operating_branch_required");

        await _platform.ValidateUserBranchAsync(tenantId, actorUserId, operatingBranchId, ct);

        var row = await EligibleWorkScalarQuery(tenantId, operatingBranchId)
            .Where(x => x.OrderTestId == orderTestId && x.SpecimenId == specimenId)
            .FirstOrDefaultAsync(ct)
            ?? throw new TestingDomainException(
                "Testing work item is not eligible or was not found.",
                statusCode: 404, code: "not_eligible");

        var barcode = await _db.SpecimenBarcodes.AsNoTracking()
            .Where(b => b.TenantId == tenantId && b.SpecimenId == specimenId && b.IsActive)
            .Select(b => b.BarcodeValue)
            .FirstOrDefaultAsync(ct);

        ResultDraftDto? draft = null;
        var result = await _db.Results.AsNoTracking()
            .FirstOrDefaultAsync(r =>
                r.TenantId == tenantId
                && r.OrderTestId == orderTestId
                && r.SpecimenId == specimenId, ct);
        if (result is not null)
            draft = ToDto(result);

        return new TestingWorkItemDetailDto(
            OrderTestId: row.OrderTestId,
            OrderId: row.OrderId,
            OrderNumber: row.OrderNumber,
            Priority: row.Priority,
            PatientId: row.PatientId,
            PatientMrn: row.PatientMrn,
            PatientName: row.PatientName,
            PatientDateOfBirth: row.PatientDateOfBirth,
            SpecimenId: row.SpecimenId,
            SpecimenStatus: row.SpecimenStatus,
            Accession: row.Accession,
            BarcodeValue: barcode,
            ReceivingBranchId: row.ReceivingBranchId,
            CollectionBranchId: row.CollectionBranchId,
            ReceivedAtUtc: row.ReceivedAtUtc,
            CollectedAtUtc: row.CollectedAtUtc,
            CatalogueItemId: row.CatalogueItemId,
            CatalogueVersionId: row.CatalogueVersionId,
            CatalogueType: row.CatalogueType,
            Classification: row.Classification,
            TestDisplayName: row.TestDisplayName,
            InternalOrderCode: row.InternalOrderCode,
            ResultDatatype: row.ResultDatatype,
            PermittedUnits: row.PermittedUnits,
            Draft: draft);
    }

    public async Task<ResultDraftDto> GetDraftAsync(Guid tenantId, Guid resultId, CancellationToken ct = default)
    {
        var result = await _db.Results.AsNoTracking()
            .FirstOrDefaultAsync(r => r.Id == resultId && r.TenantId == tenantId, ct)
            ?? throw new TestingDomainException("Result draft not found.", statusCode: 404, code: "not_found");
        return ToDto(result);
    }

    public async Task<ResultDraftDto> CreateDraftAsync(
        Guid tenantId, Guid actorUserId, CreateResultDraftRequest req, CancellationToken ct = default)
    {
        if (req.OperatingBranchId == Guid.Empty)
            throw new TestingDomainException(
                "Operating branch is required.", statusCode: 400, code: "operating_branch_required");

        await _platform.ValidateUserBranchAsync(tenantId, actorUserId, req.OperatingBranchId, ct);

        var hash = HashRequest(new
        {
            req.OrderTestId,
            req.SpecimenId,
            req.OperatingBranchId,
            NumericValue = NormalizeOptional(req.NumericValue),
            QualitativeValue = NormalizeOptional(req.QualitativeValue),
            Unit = NormalizeOptional(req.Unit),
            Comment = NormalizeOptional(req.Comment),
        });

        var claim = await ClaimIdempotencyAsync(
            tenantId, req.IdempotencyKey, ResultIdempotencyOperations.CreateResultDraft, hash, ct);
        if (claim.ReplayJson is not null)
            return DeserializeDto(claim.ReplayJson);

        try
        {
            var ctx = await LoadEligibleContextAsync(
                tenantId, req.OrderTestId, req.SpecimenId, req.OperatingBranchId, ct);

            var existing = await _db.Results.AsNoTracking()
                .FirstOrDefaultAsync(r =>
                    r.TenantId == tenantId
                    && r.OrderTestId == req.OrderTestId
                    && r.SpecimenId == req.SpecimenId, ct);
            if (existing is not null)
                throw new TestingDomainException(
                    "A Result Draft already exists for this OrderTest and Specimen.",
                    statusCode: 409, code: "draft_exists");

            var datatype = RequireSupportedDatatype(ctx.CatalogueVersion.ResultDatatype);
            ValidatePayload(datatype, req.NumericValue, req.QualitativeValue, req.Unit, req.Comment,
                ctx.CatalogueVersion.PermittedUnits);

            var now = DateTime.UtcNow;
            var resultId = Guid.NewGuid();
            var result = new LmsResult
            {
                Id = resultId,
                TenantId = tenantId,
                OrderId = ctx.Order.Id,
                OrderTestId = ctx.OrderTest.Id,
                SpecimenId = ctx.Specimen.Id,
                OperatingBranchId = req.OperatingBranchId,
                CatalogueItemId = ctx.OrderTest.CatalogueItemId,
                CatalogueVersionId = ctx.OrderTest.CatalogueVersionId,
                ResultDatatype = datatype,
                Status = ResultStatuses.Draft,
                CurrentVersionNumber = 1,
                NumericValue = NormalizeOptional(req.NumericValue),
                QualitativeValue = NormalizeOptional(req.QualitativeValue),
                Unit = NormalizeOptional(req.Unit),
                Comment = NormalizeOptional(req.Comment),
                CreatedAtUtc = now,
                CreatedByUserId = actorUserId,
                UpdatedAtUtc = now,
                UpdatedByUserId = actorUserId,
                RowVersion = 1,
            };
            var version = new LmsResultVersion
            {
                Id = Guid.NewGuid(),
                TenantId = tenantId,
                ResultId = resultId,
                VersionNumber = 1,
                NumericValue = result.NumericValue,
                QualitativeValue = result.QualitativeValue,
                Unit = result.Unit,
                Comment = result.Comment,
                CreatedAtUtc = now,
                CreatedByUserId = actorUserId,
            };

            // Prove OrderTest immutability: capture status before mutate.
            var orderTestStatusBefore = ctx.OrderTest.Status;

            _db.Results.Add(result);
            _db.ResultVersions.Add(version);
            await _db.SaveChangesAsync(ct);

            var orderTestAfter = await _db.OrderTests.AsNoTracking()
                .FirstAsync(t => t.Id == ctx.OrderTest.Id && t.TenantId == tenantId, ct);
            if (!string.Equals(orderTestAfter.Status, orderTestStatusBefore, StringComparison.Ordinal)
                || !string.Equals(orderTestAfter.Status, OrderTestStatuses.Ordered, StringComparison.Ordinal))
                throw new TestingDomainException(
                    "OrderTest status must remain Ordered.", statusCode: 500, code: "order_test_mutated");

            var dto = ToDto(result);
            try
            {
                await _audit.WriteAsync(
                    tenantId, actorUserId,
                    ResultAuditActions.CreateResultDraft,
                    ResultAuditResources.LmsResult,
                    resultId,
                    details: $"status={ResultStatuses.Draft}; orderTestId={ctx.OrderTest.Id}; specimenId={ctx.Specimen.Id}; version=1",
                    ct: ct);
            }
            catch (Exception)
            {
                await TryDeleteResultAsync(tenantId, resultId, ct);
                throw new TestingDomainException(
                    "Audit unavailable. Result draft was not retained.",
                    statusCode: 503, code: "audit_unavailable");
            }

            await CompleteIdempotencyAsync(tenantId, claim.ClaimId, resultId, dto, ct);
            return dto;
        }
        catch
        {
            await TryAbandonIdempotencyAsync(tenantId, claim.ClaimId, ct);
            throw;
        }
    }

    public async Task<ResultDraftDto> UpdateDraftAsync(
        Guid tenantId, Guid actorUserId, Guid resultId, UpdateResultDraftRequest req,
        CancellationToken ct = default)
    {
        if (req.OperatingBranchId == Guid.Empty)
            throw new TestingDomainException(
                "Operating branch is required.", statusCode: 400, code: "operating_branch_required");
        if (req.ExpectedRowVersion <= 0)
            throw new TestingDomainException(
                "ExpectedRowVersion is required.", statusCode: 409, code: "concurrency_conflict");

        await _platform.ValidateUserBranchAsync(tenantId, actorUserId, req.OperatingBranchId, ct);

        var hash = HashRequest(new
        {
            resultId,
            req.OperatingBranchId,
            req.ExpectedRowVersion,
            NumericValue = NormalizeOptional(req.NumericValue),
            QualitativeValue = NormalizeOptional(req.QualitativeValue),
            Unit = NormalizeOptional(req.Unit),
            Comment = NormalizeOptional(req.Comment),
        });

        var claim = await ClaimIdempotencyAsync(
            tenantId, req.IdempotencyKey, ResultIdempotencyOperations.UpdateResultDraft, hash, ct);
        if (claim.ReplayJson is not null)
            return DeserializeDto(claim.ReplayJson);

        try
        {
            var result = await _db.Results
                .FirstOrDefaultAsync(r => r.Id == resultId && r.TenantId == tenantId, ct)
                ?? throw new TestingDomainException("Result draft not found.", statusCode: 404, code: "not_found");

            if (result.RowVersion != req.ExpectedRowVersion)
                throw new TestingDomainException(
                    "Result draft was modified by another user.",
                    statusCode: 409, code: "concurrency_conflict");

            if (!string.Equals(result.Status, ResultStatuses.Draft, StringComparison.Ordinal))
                throw new TestingDomainException(
                    "Only Draft results can be updated. Technical Verified and Clinically Authorized results are not editable as Draft.",
                    statusCode: 409, code: "invalid_state");

            // Re-validate eligibility (Rejected/Cancelled must fail).
            await LoadEligibleContextAsync(
                tenantId, result.OrderTestId, result.SpecimenId, req.OperatingBranchId, ct);

            var cat = await _db.CatalogueVersions.AsNoTracking()
                .FirstAsync(v => v.Id == result.CatalogueVersionId && v.TenantId == tenantId, ct);
            var datatype = RequireSupportedDatatype(cat.ResultDatatype);
            if (!string.Equals(datatype, result.ResultDatatype, StringComparison.Ordinal))
            {
                // Catalogue snapshot on result is authoritative for the draft aggregate.
                datatype = result.ResultDatatype;
            }

            ValidatePayload(datatype, req.NumericValue, req.QualitativeValue, req.Unit, req.Comment,
                cat.PermittedUnits);

            var orderTestBefore = await _db.OrderTests.AsNoTracking()
                .FirstAsync(t => t.Id == result.OrderTestId && t.TenantId == tenantId, ct);
            if (!string.Equals(orderTestBefore.Status, OrderTestStatuses.Ordered, StringComparison.Ordinal))
                throw new TestingDomainException(
                    "OrderTest must remain Ordered.", statusCode: 409, code: "order_test_not_ordered");

            var priorNumeric = result.NumericValue;
            var priorQualitative = result.QualitativeValue;
            var priorUnit = result.Unit;
            var priorComment = result.Comment;
            var priorVersionNumber = result.CurrentVersionNumber;
            var priorUpdatedAt = result.UpdatedAtUtc;
            var priorUpdatedBy = result.UpdatedByUserId;
            var priorBranch = result.OperatingBranchId;
            var priorRowVersion = result.RowVersion;

            var now = DateTime.UtcNow;
            var nextVersion = result.CurrentVersionNumber + 1;
            var versionId = Guid.NewGuid();
            result.NumericValue = NormalizeOptional(req.NumericValue);
            result.QualitativeValue = NormalizeOptional(req.QualitativeValue);
            result.Unit = NormalizeOptional(req.Unit);
            result.Comment = NormalizeOptional(req.Comment);
            result.CurrentVersionNumber = nextVersion;
            result.UpdatedAtUtc = now;
            result.UpdatedByUserId = actorUserId;
            result.OperatingBranchId = req.OperatingBranchId;
            result.RowVersion++;

            _db.ResultVersions.Add(new LmsResultVersion
            {
                Id = versionId,
                TenantId = tenantId,
                ResultId = result.Id,
                VersionNumber = nextVersion,
                NumericValue = result.NumericValue,
                QualitativeValue = result.QualitativeValue,
                Unit = result.Unit,
                Comment = result.Comment,
                CreatedAtUtc = now,
                CreatedByUserId = actorUserId,
            });

            try
            {
                await _db.SaveChangesAsync(ct);
            }
            catch (DbUpdateConcurrencyException)
            {
                throw new TestingDomainException(
                    "Result draft was modified by another user.",
                    statusCode: 409, code: "concurrency_conflict");
            }

            var orderTestAfter = await _db.OrderTests.AsNoTracking()
                .FirstAsync(t => t.Id == result.OrderTestId && t.TenantId == tenantId, ct);
            if (!string.Equals(orderTestAfter.Status, OrderTestStatuses.Ordered, StringComparison.Ordinal))
                throw new TestingDomainException(
                    "OrderTest status must remain Ordered.", statusCode: 500, code: "order_test_mutated");

            var dto = ToDto(result);
            try
            {
                await _audit.WriteAsync(
                    tenantId, actorUserId,
                    ResultAuditActions.UpdateResultDraft,
                    ResultAuditResources.LmsResult,
                    result.Id,
                    details: $"status={ResultStatuses.Draft}; version={nextVersion}; rowVersion={result.RowVersion}",
                    ct: ct);
            }
            catch
            {
                await RevertUpdateAsync(
                    tenantId, result.Id, versionId,
                    priorNumeric, priorQualitative, priorUnit, priorComment,
                    priorVersionNumber, priorUpdatedAt, priorUpdatedBy, priorBranch, priorRowVersion, ct);
                throw new TestingDomainException(
                    "Audit unavailable. Result draft update was not completed.",
                    statusCode: 503, code: "audit_unavailable");
            }

            await CompleteIdempotencyAsync(tenantId, claim.ClaimId, result.Id, dto, ct);
            return dto;
        }
        catch
        {
            await TryAbandonIdempotencyAsync(tenantId, claim.ClaimId, ct);
            throw;
        }
    }

    public async Task<ResultDraftDto> VerifyAsync(
        Guid tenantId, Guid actorUserId, Guid resultId, VerifyResultRequest req,
        CancellationToken ct = default)
    {
        if (req.OperatingBranchId == Guid.Empty)
            throw new TestingDomainException(
                "Operating branch is required.", statusCode: 400, code: "operating_branch_required");
        if (req.ExpectedRowVersion <= 0)
            throw new TestingDomainException(
                "ExpectedRowVersion is required.", statusCode: 409, code: "concurrency_conflict");

        await _platform.ValidateUserBranchAsync(tenantId, actorUserId, req.OperatingBranchId, ct);

        var hash = HashRequest(new
        {
            resultId,
            req.OperatingBranchId,
            req.ExpectedRowVersion,
            req.ExpectedCurrentVersionNumber,
        });

        var claim = await ClaimIdempotencyAsync(
            tenantId, req.IdempotencyKey, ResultIdempotencyOperations.VerifyResult, hash, ct);
        if (claim.ReplayJson is not null)
            return DeserializeDto(claim.ReplayJson);

        try
        {
            var result = await _db.Results
                .FirstOrDefaultAsync(r => r.Id == resultId && r.TenantId == tenantId, ct)
                ?? throw new TestingDomainException("Result not found.", statusCode: 404, code: "not_found");

            if (result.RowVersion != req.ExpectedRowVersion)
                throw new TestingDomainException(
                    "Result was modified by another user.",
                    statusCode: 409, code: "concurrency_conflict");

            if (string.Equals(result.Status, ResultStatuses.TechnicalVerified, StringComparison.Ordinal))
                throw new TestingDomainException(
                    "Result is already Technical Verified.",
                    statusCode: 409, code: "already_verified");

            if (!string.Equals(result.Status, ResultStatuses.Draft, StringComparison.Ordinal))
                throw new TestingDomainException(
                    "Only Draft results can be technically verified.",
                    statusCode: 409, code: "invalid_state");

            if (req.ExpectedCurrentVersionNumber is int expectedVer
                && expectedVer != result.CurrentVersionNumber)
                throw new TestingDomainException(
                    "Result version changed; only the current Result Version can be verified.",
                    statusCode: 409, code: "version_conflict");

            // Reuse authoritative Testing eligibility (Submitted / Ordered / Received / local / branch).
            await LoadEligibleContextAsync(
                tenantId, result.OrderTestId, result.SpecimenId, req.OperatingBranchId, ct);

            var cat = await _db.CatalogueVersions.AsNoTracking()
                .FirstOrDefaultAsync(v => v.Id == result.CatalogueVersionId && v.TenantId == tenantId, ct)
                ?? throw new TestingDomainException(
                    "Catalogue version not found for Result.",
                    statusCode: 409, code: "catalogue_missing");

            // Catalogue must still expose a usable datatype; Result aggregate snapshot is authoritative value type.
            _ = RequireSupportedDatatype(cat.ResultDatatype);
            var datatype = RequireSupportedDatatype(result.ResultDatatype);

            ValidateForVerification(
                datatype,
                result.NumericValue,
                result.QualitativeValue,
                result.Unit,
                result.Comment,
                cat.PermittedUnits);

            // Opaque clinical config refs are not live SoT for L-VER-01 evaluation (PD-VER-09).
            // Do not invent intervals/flags/criticals. Structural checks above are authoritative.

            var versionExists = await _db.ResultVersions.AsNoTracking().AnyAsync(v =>
                v.TenantId == tenantId
                && v.ResultId == result.Id
                && v.VersionNumber == result.CurrentVersionNumber, ct);
            if (!versionExists)
                throw new TestingDomainException(
                    "Current Result Version is missing; cannot verify.",
                    statusCode: 409, code: "version_missing");

            var orderTestBefore = await _db.OrderTests.AsNoTracking()
                .FirstAsync(t => t.Id == result.OrderTestId && t.TenantId == tenantId, ct);
            if (!string.Equals(orderTestBefore.Status, OrderTestStatuses.Ordered, StringComparison.Ordinal))
                throw new TestingDomainException(
                    "OrderTest must remain Ordered.", statusCode: 409, code: "order_test_not_ordered");

            var priorStatus = result.Status;
            var priorVerifiedBy = result.VerifiedByUserId;
            var priorVerifiedAt = result.VerifiedAtUtc;
            var priorVerifiedVersion = result.VerifiedVersionNumber;
            var priorUpdatedAt = result.UpdatedAtUtc;
            var priorUpdatedBy = result.UpdatedByUserId;
            var priorBranch = result.OperatingBranchId;
            var priorRowVersion = result.RowVersion;
            var verifiedVersion = result.CurrentVersionNumber;

            var now = DateTime.UtcNow;
            result.Status = ResultStatuses.TechnicalVerified;
            result.VerifiedByUserId = actorUserId;
            result.VerifiedAtUtc = now;
            result.VerifiedVersionNumber = verifiedVersion;
            result.UpdatedAtUtc = now;
            result.UpdatedByUserId = actorUserId;
            result.OperatingBranchId = req.OperatingBranchId;
            result.RowVersion++;

            try
            {
                await _db.SaveChangesAsync(ct);
            }
            catch (DbUpdateConcurrencyException)
            {
                throw new TestingDomainException(
                    "Result was modified by another user.",
                    statusCode: 409, code: "concurrency_conflict");
            }

            var orderTestAfter = await _db.OrderTests.AsNoTracking()
                .FirstAsync(t => t.Id == result.OrderTestId && t.TenantId == tenantId, ct);
            if (!string.Equals(orderTestAfter.Status, OrderTestStatuses.Ordered, StringComparison.Ordinal))
                throw new TestingDomainException(
                    "OrderTest status must remain Ordered.", statusCode: 500, code: "order_test_mutated");

            var dto = ToDto(result);
            try
            {
                await _audit.WriteAsync(
                    tenantId, actorUserId,
                    ResultAuditActions.VerifyResult,
                    ResultAuditResources.LmsResult,
                    result.Id,
                    details:
                    $"status={ResultStatuses.TechnicalVerified}; verifiedVersion={verifiedVersion}; rowVersion={result.RowVersion}",
                    ct: ct);
            }
            catch
            {
                await RevertVerifyAsync(
                    tenantId, result.Id,
                    priorStatus, priorVerifiedBy, priorVerifiedAt, priorVerifiedVersion,
                    priorUpdatedAt, priorUpdatedBy, priorBranch, priorRowVersion, ct);
                throw new TestingDomainException(
                    "Audit unavailable. Technical Verification was not completed.",
                    statusCode: 503, code: "audit_unavailable");
            }

            await CompleteIdempotencyAsync(tenantId, claim.ClaimId, result.Id, dto, ct);
            return dto;
        }
        catch
        {
            await TryAbandonIdempotencyAsync(tenantId, claim.ClaimId, ct);
            throw;
        }
    }

    public async Task<ResultDraftDto> AuthorizeAsync(
        Guid tenantId, Guid actorUserId, Guid resultId, AuthorizeResultRequest req,
        CancellationToken ct = default)
    {
        if (req.OperatingBranchId == Guid.Empty)
            throw new TestingDomainException(
                "Operating branch is required.", statusCode: 400, code: "operating_branch_required");
        if (req.ExpectedRowVersion <= 0)
            throw new TestingDomainException(
                "ExpectedRowVersion is required.", statusCode: 409, code: "concurrency_conflict");

        await _platform.ValidateUserBranchAsync(tenantId, actorUserId, req.OperatingBranchId, ct);

        var hash = HashRequest(new
        {
            resultId,
            req.OperatingBranchId,
            req.ExpectedRowVersion,
            req.ExpectedCurrentVersionNumber,
        });

        var claim = await ClaimIdempotencyAsync(
            tenantId, req.IdempotencyKey, ResultIdempotencyOperations.AuthorizeResult, hash, ct);
        if (claim.ReplayJson is not null)
            return DeserializeDto(claim.ReplayJson);

        try
        {
            var result = await _db.Results
                .FirstOrDefaultAsync(r => r.Id == resultId && r.TenantId == tenantId, ct)
                ?? throw new TestingDomainException("Result not found.", statusCode: 404, code: "not_found");

            if (result.RowVersion != req.ExpectedRowVersion)
                throw new TestingDomainException(
                    "Result was modified by another user.",
                    statusCode: 409, code: "concurrency_conflict");

            if (string.Equals(result.Status, ResultStatuses.ClinicallyAuthorized, StringComparison.Ordinal))
                throw new TestingDomainException(
                    "Result is already Clinically Authorized.",
                    statusCode: 409, code: "already_authorized");

            if (!string.Equals(result.Status, ResultStatuses.TechnicalVerified, StringComparison.Ordinal))
                throw new TestingDomainException(
                    "Only Technical Verified results can be clinically authorized.",
                    statusCode: 409, code: "invalid_state");

            if (result.VerifiedVersionNumber is null
                || result.CurrentVersionNumber != result.VerifiedVersionNumber.Value)
                throw new TestingDomainException(
                    "Current Result Version does not match the Technical Verified version.",
                    statusCode: 409, code: "version_conflict");

            if (req.ExpectedCurrentVersionNumber is int expectedVer
                && expectedVer != result.CurrentVersionNumber)
                throw new TestingDomainException(
                    "Result version changed; only the current Result Version can be authorized.",
                    statusCode: 409, code: "version_conflict");

            // Reuse authoritative Testing eligibility (Submitted / Ordered / Received / local / branch).
            await LoadEligibleContextAsync(
                tenantId, result.OrderTestId, result.SpecimenId, req.OperatingBranchId, ct);

            var versionExists = await _db.ResultVersions.AsNoTracking().AnyAsync(v =>
                v.TenantId == tenantId
                && v.ResultId == result.Id
                && v.VersionNumber == result.CurrentVersionNumber, ct);
            if (!versionExists)
                throw new TestingDomainException(
                    "Current Result Version is missing; cannot authorize.",
                    statusCode: 409, code: "version_missing");

            var orderTestBefore = await _db.OrderTests.AsNoTracking()
                .FirstAsync(t => t.Id == result.OrderTestId && t.TenantId == tenantId, ct);
            if (!string.Equals(orderTestBefore.Status, OrderTestStatuses.Ordered, StringComparison.Ordinal))
                throw new TestingDomainException(
                    "OrderTest must remain Ordered.", statusCode: 409, code: "order_test_not_ordered");

            var priorStatus = result.Status;
            var priorAuthorizedBy = result.AuthorizedByUserId;
            var priorAuthorizedAt = result.AuthorizedAtUtc;
            var priorAuthorizedVersion = result.AuthorizedVersionNumber;
            var priorUpdatedAt = result.UpdatedAtUtc;
            var priorUpdatedBy = result.UpdatedByUserId;
            var priorBranch = result.OperatingBranchId;
            var priorRowVersion = result.RowVersion;
            var authorizedVersion = result.CurrentVersionNumber;

            var now = DateTime.UtcNow;
            result.Status = ResultStatuses.ClinicallyAuthorized;
            result.AuthorizedByUserId = actorUserId;
            result.AuthorizedAtUtc = now;
            result.AuthorizedVersionNumber = authorizedVersion;
            result.UpdatedAtUtc = now;
            result.UpdatedByUserId = actorUserId;
            result.OperatingBranchId = req.OperatingBranchId;
            result.RowVersion++;

            try
            {
                await _db.SaveChangesAsync(ct);
            }
            catch (DbUpdateConcurrencyException)
            {
                throw new TestingDomainException(
                    "Result was modified by another user.",
                    statusCode: 409, code: "concurrency_conflict");
            }

            var orderTestAfter = await _db.OrderTests.AsNoTracking()
                .FirstAsync(t => t.Id == result.OrderTestId && t.TenantId == tenantId, ct);
            if (!string.Equals(orderTestAfter.Status, OrderTestStatuses.Ordered, StringComparison.Ordinal))
                throw new TestingDomainException(
                    "OrderTest status must remain Ordered.", statusCode: 500, code: "order_test_mutated");

            var dto = ToDto(result);
            try
            {
                await _audit.WriteAsync(
                    tenantId, actorUserId,
                    ResultAuditActions.AuthorizeResult,
                    ResultAuditResources.LmsResult,
                    result.Id,
                    details:
                    $"status={ResultStatuses.ClinicallyAuthorized}; authorizedVersion={authorizedVersion}; rowVersion={result.RowVersion}; operatingBranchId={req.OperatingBranchId}",
                    ct: ct);
            }
            catch
            {
                await RevertAuthorizeAsync(
                    tenantId, result.Id,
                    priorStatus, priorAuthorizedBy, priorAuthorizedAt, priorAuthorizedVersion,
                    priorUpdatedAt, priorUpdatedBy, priorBranch, priorRowVersion, ct);
                throw new TestingDomainException(
                    "Audit unavailable. Clinical Authorization was not completed.",
                    statusCode: 503, code: "audit_unavailable");
            }

            await CompleteIdempotencyAsync(tenantId, claim.ClaimId, result.Id, dto, ct);
            return dto;
        }
        catch
        {
            await TryAbandonIdempotencyAsync(tenantId, claim.ClaimId, ct);
            throw;
        }
    }

    /// <summary>
    /// Eligibility as scalar property-init projection (no Result left-join, no positional record ctor).
    /// Null/unsupported ResultDatatype is allowed in the queue listing; Draft create fails honestly later.
    /// </summary>
    private IQueryable<EligibleWorkScalar> EligibleWorkScalarQuery(Guid tenantId, Guid operatingBranchId)
    {
        return
            from link in _db.SpecimenOrderTests.AsNoTracking()
            join specimen in _db.Specimens.AsNoTracking() on link.SpecimenId equals specimen.Id
            join orderTest in _db.OrderTests.AsNoTracking() on link.OrderTestId equals orderTest.Id
            join order in _db.Orders.AsNoTracking() on link.OrderId equals order.Id
            join orderVersion in _db.OrderVersions.AsNoTracking() on order.CurrentVersionId equals orderVersion.Id
            join cat in _db.CatalogueVersions.AsNoTracking() on orderTest.CatalogueVersionId equals cat.Id
            where link.TenantId == tenantId
                  && specimen.TenantId == tenantId
                  && order.TenantId == tenantId
                  && orderTest.TenantId == tenantId
                  && orderVersion.TenantId == tenantId
                  && cat.TenantId == tenantId
                  && order.Status == OrderStatuses.Submitted
                  && orderTest.Status == OrderTestStatuses.Ordered
                  && specimen.Status == SpecimenStatuses.Received
                  && specimen.ReceivingBranchId == operatingBranchId
                  && orderTest.CatalogueType != CatalogueTypes.ReferralTest
                  && cat.Classification == CatalogueClassifications.Local
                  && (orderTest.CatalogueType == CatalogueTypes.Test
                      || orderTest.CatalogueType == CatalogueTypes.Panel)
            select new EligibleWorkScalar
            {
                OrderTestId = orderTest.Id,
                OrderId = order.Id,
                OrderNumber = order.OrderNumber,
                Priority = orderVersion.Priority,
                PatientId = orderVersion.PatientId,
                PatientMrn = specimen.PatientMrnSnapshot,
                PatientName = specimen.PatientNameSnapshot,
                PatientDateOfBirth = specimen.PatientDateOfBirthSnapshot,
                SpecimenId = specimen.Id,
                SpecimenStatus = specimen.Status,
                Accession = specimen.Accession,
                ReceivingBranchId = specimen.ReceivingBranchId,
                CollectionBranchId = specimen.CollectionBranchId,
                ReceivedAtUtc = specimen.ReceivedAtUtc,
                CollectedAtUtc = specimen.CollectedAt,
                CatalogueItemId = orderTest.CatalogueItemId,
                CatalogueVersionId = orderTest.CatalogueVersionId,
                CatalogueType = orderTest.CatalogueType,
                Classification = cat.Classification,
                TestDisplayName = orderTest.DisplayNameSnapshot,
                InternalOrderCode = orderTest.InternalOrderCodeSnapshot,
                ResultDatatype = cat.ResultDatatype,
                PermittedUnits = cat.PermittedUnits,
                SortOrder = orderTest.SortOrder,
            };
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
                "Rejected specimens are not eligible for Testing.",
                statusCode: 409, code: "specimen_rejected");

        if (!string.Equals(specimen.Status, SpecimenStatuses.Received, StringComparison.Ordinal))
            throw new TestingDomainException(
                "Specimen must be Received before Testing.",
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
                "Referral tests are not eligible for local Testing in L-TST-01A.",
                statusCode: 409, code: "referral_not_eligible");

        var order = await _db.Orders
            .FirstOrDefaultAsync(o => o.Id == link.OrderId && o.TenantId == tenantId, ct)
            ?? throw new TestingDomainException("Order not found.", statusCode: 404, code: "not_found");

        if (!string.Equals(order.Status, OrderStatuses.Submitted, StringComparison.Ordinal))
            throw new TestingDomainException(
                "Order must be Submitted for Testing.",
                statusCode: 409, code: "order_not_submitted");

        var cat = await _db.CatalogueVersions.AsNoTracking()
            .FirstOrDefaultAsync(v => v.Id == orderTest.CatalogueVersionId && v.TenantId == tenantId, ct)
            ?? throw new TestingDomainException(
                "Catalogue version not found for OrderTest.",
                statusCode: 409, code: "catalogue_missing");

        if (!string.Equals(cat.Classification, CatalogueClassifications.Local, StringComparison.OrdinalIgnoreCase))
            throw new TestingDomainException(
                "Only local catalogue orderables are eligible for Testing.",
                statusCode: 409, code: "not_local");

        return (orderTest, order, specimen, cat);
    }

    private static string RequireSupportedDatatype(string? catalogueDatatype)
    {
        var normalized = ResultDatatypes.Normalize(catalogueDatatype);
        if (normalized is null)
            throw new TestingDomainException(
                "Active catalogue definition does not provide a usable result datatype for L-TST-01A.",
                statusCode: 409, code: "unsupported_datatype");
        return normalized;
    }

    private static void ValidatePayload(
        string datatype,
        string? numeric,
        string? qualitative,
        string? unit,
        string? comment,
        string? permittedUnits)
    {
        var n = NormalizeOptional(numeric);
        var q = NormalizeOptional(qualitative);
        var u = NormalizeOptional(unit);
        var c = NormalizeOptional(comment);

        if (n is null && q is null && c is null)
            throw new TestingDomainException(
                "At least one of numeric value, qualitative value, or comment is required.",
                statusCode: 400, code: "value_required");

        if (string.Equals(datatype, ResultDatatypes.Numeric, StringComparison.Ordinal))
        {
            if (q is not null)
                throw new TestingDomainException(
                    "Qualitative value is not permitted for Numeric datatype.",
                    statusCode: 400, code: "invalid_datatype_payload");
            if (n is not null
                && !decimal.TryParse(n, NumberStyles.Number, CultureInfo.InvariantCulture, out _))
                throw new TestingDomainException(
                    "Numeric value is invalid.", statusCode: 400, code: "invalid_numeric");
        }
        else if (string.Equals(datatype, ResultDatatypes.Qualitative, StringComparison.Ordinal))
        {
            if (n is not null)
                throw new TestingDomainException(
                    "Numeric value is not permitted for Qualitative datatype.",
                    statusCode: 400, code: "invalid_datatype_payload");
        }

        if (u is not null && !string.IsNullOrWhiteSpace(permittedUnits))
        {
            var allowed = permittedUnits.Split(',', StringSplitOptions.TrimEntries | StringSplitOptions.RemoveEmptyEntries);
            if (allowed.Length > 0
                && !allowed.Any(a => a.Equals(u, StringComparison.OrdinalIgnoreCase)))
                throw new TestingDomainException(
                    "Unit is not permitted by the catalogue definition.",
                    statusCode: 400, code: "invalid_unit");
        }

        if (c is not null && c.Length > 2000)
            throw new TestingDomainException(
                "Comment exceeds maximum length.", statusCode: 400, code: "comment_too_long");
    }

    /// <summary>
    /// Structural/technical completeness for Draft → TechnicalVerified.
    /// Requires datatype-appropriate primary value (comment-only is insufficient).
    /// Reuses unit/datatype rules from ValidatePayload; does not invent clinical thresholds.
    /// </summary>
    private static void ValidateForVerification(
        string datatype,
        string? numeric,
        string? qualitative,
        string? unit,
        string? comment,
        string? permittedUnits)
    {
        var n = NormalizeOptional(numeric);
        var q = NormalizeOptional(qualitative);

        if (string.Equals(datatype, ResultDatatypes.Numeric, StringComparison.Ordinal))
        {
            if (n is null)
                throw new TestingDomainException(
                    "Numeric result value is required for Technical Verification.",
                    statusCode: 400, code: "value_required");
        }
        else if (string.Equals(datatype, ResultDatatypes.Qualitative, StringComparison.Ordinal))
        {
            if (q is null)
                throw new TestingDomainException(
                    "Qualitative result value is required for Technical Verification.",
                    statusCode: 400, code: "value_required");
        }
        else
        {
            throw new TestingDomainException(
                "Active catalogue definition does not provide a usable result datatype for Verification.",
                statusCode: 409, code: "unsupported_datatype");
        }

        ValidatePayload(datatype, numeric, qualitative, unit, comment, permittedUnits);
    }

    private static ResultDraftDto ToDto(LmsResult r) => new(
        Id: r.Id,
        OrderTestId: r.OrderTestId,
        SpecimenId: r.SpecimenId,
        OrderId: r.OrderId,
        OperatingBranchId: r.OperatingBranchId,
        Status: r.Status,
        ResultDatatype: r.ResultDatatype,
        NumericValue: r.NumericValue,
        QualitativeValue: r.QualitativeValue,
        Unit: r.Unit,
        Comment: r.Comment,
        CurrentVersionNumber: r.CurrentVersionNumber,
        CreatedAtUtc: r.CreatedAtUtc,
        CreatedByUserId: r.CreatedByUserId,
        UpdatedAtUtc: r.UpdatedAtUtc,
        UpdatedByUserId: r.UpdatedByUserId,
        RowVersion: r.RowVersion,
        VerifiedByUserId: r.VerifiedByUserId,
        VerifiedAtUtc: r.VerifiedAtUtc,
        VerifiedVersionNumber: r.VerifiedVersionNumber,
        AuthorizedByUserId: r.AuthorizedByUserId,
        AuthorizedAtUtc: r.AuthorizedAtUtc,
        AuthorizedVersionNumber: r.AuthorizedVersionNumber);

    private static string? NormalizeOptional(string? value) =>
        string.IsNullOrWhiteSpace(value) ? null : value.Trim();

    private static string HashRequest(object payload)
    {
        var json = JsonSerializer.Serialize(payload, JsonOpts);
        var bytes = SHA256.HashData(Encoding.UTF8.GetBytes(json));
        return Convert.ToHexString(bytes).ToLowerInvariant();
    }

    private static ResultDraftDto DeserializeDto(string json) =>
        JsonSerializer.Deserialize<ResultDraftDto>(json, JsonOpts)
        ?? throw new TestingDomainException(
            "Idempotency replay payload is corrupt.", statusCode: 500, code: "idempotency_corrupt");

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
        Guid tenantId, Guid? claimId, Guid resultId, ResultDraftDto dto, CancellationToken ct)
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

    private async Task TryDeleteResultAsync(Guid tenantId, Guid resultId, CancellationToken ct)
    {
        try
        {
            _db.ChangeTracker.Clear();
            var versions = await _db.ResultVersions
                .Where(v => v.TenantId == tenantId && v.ResultId == resultId).ToListAsync(ct);
            _db.ResultVersions.RemoveRange(versions);
            var result = await _db.Results
                .FirstOrDefaultAsync(r => r.Id == resultId && r.TenantId == tenantId, ct);
            if (result is not null) _db.Results.Remove(result);
            await _db.SaveChangesAsync(ct);
        }
        catch { /* best-effort cleanup after audit failure */ }
    }

    private async Task RevertUpdateAsync(
        Guid tenantId, Guid resultId, Guid versionId,
        string? numeric, string? qualitative, string? unit, string? comment,
        int versionNumber, DateTime updatedAt, Guid updatedBy, Guid branchId, int rowVersion,
        CancellationToken ct)
    {
        // Fail-closed: must restore prior draft aggregate and remove the new version row.
        _db.ChangeTracker.Clear();
        var version = await _db.ResultVersions
            .FirstOrDefaultAsync(v => v.Id == versionId && v.TenantId == tenantId, ct);
        if (version is not null) _db.ResultVersions.Remove(version);
        var result = await _db.Results
            .FirstOrDefaultAsync(r => r.Id == resultId && r.TenantId == tenantId, ct)
            ?? throw new TestingDomainException(
                "Audit unavailable and Result draft could not be restored.",
                statusCode: 503, code: "audit_unavailable");

        result.NumericValue = numeric;
        result.QualitativeValue = qualitative;
        result.Unit = unit;
        result.Comment = comment;
        result.CurrentVersionNumber = versionNumber;
        result.UpdatedAtUtc = updatedAt;
        result.UpdatedByUserId = updatedBy;
        result.OperatingBranchId = branchId;
        result.RowVersion = rowVersion;
        await _db.SaveChangesAsync(ct);

        var orphan = await _db.ResultVersions.AsNoTracking()
            .AnyAsync(v => v.Id == versionId && v.TenantId == tenantId, ct);
        if (orphan)
            throw new TestingDomainException(
                "Audit unavailable and orphan ResultVersion could not be removed.",
                statusCode: 503, code: "audit_unavailable");
    }

    private async Task RevertVerifyAsync(
        Guid tenantId, Guid resultId,
        string status, Guid? verifiedBy, DateTime? verifiedAt, int? verifiedVersion,
        DateTime updatedAt, Guid updatedBy, Guid branchId, int rowVersion,
        CancellationToken ct)
    {
        _db.ChangeTracker.Clear();
        var result = await _db.Results
            .FirstOrDefaultAsync(r => r.Id == resultId && r.TenantId == tenantId, ct)
            ?? throw new TestingDomainException(
                "Audit unavailable and Result could not be restored.",
                statusCode: 503, code: "audit_unavailable");

        result.Status = status;
        result.VerifiedByUserId = verifiedBy;
        result.VerifiedAtUtc = verifiedAt;
        result.VerifiedVersionNumber = verifiedVersion;
        result.UpdatedAtUtc = updatedAt;
        result.UpdatedByUserId = updatedBy;
        result.OperatingBranchId = branchId;
        result.RowVersion = rowVersion;
        await _db.SaveChangesAsync(ct);
    }

    private async Task RevertAuthorizeAsync(
        Guid tenantId, Guid resultId,
        string status, Guid? authorizedBy, DateTime? authorizedAt, int? authorizedVersion,
        DateTime updatedAt, Guid updatedBy, Guid branchId, int rowVersion,
        CancellationToken ct)
    {
        _db.ChangeTracker.Clear();
        var result = await _db.Results
            .FirstOrDefaultAsync(r => r.Id == resultId && r.TenantId == tenantId, ct)
            ?? throw new TestingDomainException(
                "Audit unavailable and Result could not be restored.",
                statusCode: 503, code: "audit_unavailable");

        result.Status = status;
        result.AuthorizedByUserId = authorizedBy;
        result.AuthorizedAtUtc = authorizedAt;
        result.AuthorizedVersionNumber = authorizedVersion;
        result.UpdatedAtUtc = updatedAt;
        result.UpdatedByUserId = updatedBy;
        result.OperatingBranchId = branchId;
        result.RowVersion = rowVersion;
        await _db.SaveChangesAsync(ct);
    }

    private static bool IsUniqueViolation(DbUpdateException ex) =>
        ex.InnerException?.Message.Contains("unique", StringComparison.OrdinalIgnoreCase) == true
        || ex.InnerException?.Message.Contains("duplicate", StringComparison.OrdinalIgnoreCase) == true
        || ex.Message.Contains("unique", StringComparison.OrdinalIgnoreCase);

    private sealed class EligibleWorkScalar
    {
        public Guid OrderTestId { get; set; }
        public Guid OrderId { get; set; }
        public string OrderNumber { get; set; } = "";
        public string Priority { get; set; } = "";
        public Guid PatientId { get; set; }
        public string? PatientMrn { get; set; }
        public string? PatientName { get; set; }
        public DateTime? PatientDateOfBirth { get; set; }
        public Guid SpecimenId { get; set; }
        public string SpecimenStatus { get; set; } = "";
        public string? Accession { get; set; }
        public Guid? ReceivingBranchId { get; set; }
        public Guid CollectionBranchId { get; set; }
        public DateTime? ReceivedAtUtc { get; set; }
        public DateTime CollectedAtUtc { get; set; }
        public Guid CatalogueItemId { get; set; }
        public Guid CatalogueVersionId { get; set; }
        public string CatalogueType { get; set; } = "";
        public string Classification { get; set; } = "";
        public string TestDisplayName { get; set; } = "";
        public string InternalOrderCode { get; set; } = "";
        public string? ResultDatatype { get; set; }
        public string? PermittedUnits { get; set; }
        public int SortOrder { get; set; }
    }
}

public sealed class TestingDomainException : Exception
{
    public int StatusCode { get; }
    public string Code { get; }

    public TestingDomainException(string message, int statusCode = 400, string code = "testing_error")
        : base(message)
    {
        StatusCode = statusCode;
        Code = code;
    }
}
