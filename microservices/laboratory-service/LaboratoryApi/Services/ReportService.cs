using System.Collections.Concurrent;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using LaboratoryApi.Data;
using LaboratoryApi.Domain;
using Microsoft.EntityFrameworkCore;

namespace LaboratoryApi.Services;

public interface IReportService
{
    Task<ReportDetailDto> CreateDraftAsync(
        Guid tenantId, Guid actorUserId, CreateReportDraftRequest req, CancellationToken ct = default);

    Task<ReportDetailDto> AppendVersionAsync(
        Guid tenantId, Guid actorUserId, Guid reportId, AppendReportVersionRequest req,
        CancellationToken ct = default);

    Task<ReportDetailDto> FinalizeAsync(
        Guid tenantId, Guid actorUserId, Guid reportId, FinalizeReportRequest req,
        CancellationToken ct = default);

    Task<ReportDetailDto> ReleaseAsync(
        Guid tenantId, Guid actorUserId, Guid reportId, ReleaseReportRequest req,
        CancellationToken ct = default);

    Task<ReportDetailDto> AssignNumberAsync(
        Guid tenantId, Guid actorUserId, Guid reportId, AssignReportNumberRequest req,
        CancellationToken ct = default);

    Task<ReportDetailDto> GetAsync(Guid tenantId, Guid actorUserId, Guid reportId, Guid operatingBranchId,
        CancellationToken ct = default);

    Task<ReportVersionDto> GetVersionAsync(
        Guid tenantId, Guid actorUserId, Guid reportId, int versionNumber, Guid operatingBranchId,
        CancellationToken ct = default);

    Task<ReportListPageDto> ListAsync(
        Guid tenantId, Guid actorUserId, ReportListQuery query, CancellationToken ct = default);

    Task<ReportEligibleSourcesPageDto> ListEligibleSourcesAsync(
        Guid tenantId, Guid actorUserId, Guid operatingBranchId, Guid? orderId = null,
        int page = 1, int pageSize = 50, CancellationToken ct = default);
}

/// <summary>
/// LMS Report — Draft (L-REP-01) + Finalize (L-REP-02A) + Release metadata (L-REP-02B)
/// + Business Report Number assignment (L-REP-03 CUT A).
/// Does not mutate ResultStatus, attach CanonicalDocument, generate PDF, or bridge Pathology.
/// ReleaseAsync does not assign Report Number.
/// </summary>
public sealed class ReportService : IReportService
{
    private static readonly JsonSerializerOptions JsonOpts = new()
    {
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
    };

    /// <summary>InMemory / non-Npgsql only — not production concurrency correctness.</summary>
    private static readonly ConcurrentDictionary<string, SemaphoreSlim> SequenceGates = new();

    private readonly LaboratoryDbContext _db;
    private readonly IPlatformAuditClient _audit;
    private readonly IPlatformReferenceClient _platform;

    public ReportService(
        LaboratoryDbContext db,
        IPlatformAuditClient audit,
        IPlatformReferenceClient platform)
    {
        _db = db;
        _audit = audit;
        _platform = platform;
    }

    public async Task<ReportDetailDto> CreateDraftAsync(
        Guid tenantId, Guid actorUserId, CreateReportDraftRequest req, CancellationToken ct = default)
    {
        if (req.OperatingBranchId == Guid.Empty)
            throw new TestingDomainException(
                "Operating branch is required.", statusCode: 400, code: "operating_branch_required");

        if (string.IsNullOrWhiteSpace(req.IdempotencyKey))
            throw new TestingDomainException(
                "Idempotency key is required.", statusCode: 400, code: "idempotency_key_required");

        if (req.Sources is null || req.Sources.Count == 0)
            throw new TestingDomainException(
                "At least one ClinicallyAuthorized ResultVersion is required.",
                statusCode: 400, code: "sources_required");

        await _platform.ValidateUserBranchAsync(tenantId, actorUserId, req.OperatingBranchId, ct);

        var normalizedSources = NormalizeSources(req.Sources);
        var hash = HashRequest(new
        {
            req.OperatingBranchId,
            Sources = normalizedSources.Select(s => new { s.ResultId, s.ResultVersionNumber }).ToList(),
        });

        var claim = await ClaimIdempotencyAsync(
            tenantId, req.IdempotencyKey, ReportIdempotencyOperations.CreateReportDraft, hash, ct);
        if (claim.ReplayJson is not null)
            return DeserializeDetail(claim.ReplayJson);

        try
        {
            var resolved = await ResolveEligibleSourcesAsync(
                tenantId, req.OperatingBranchId, normalizedSources, ct);

            var now = DateTime.UtcNow;
            var reportId = Guid.NewGuid();
            var versionId = Guid.NewGuid();
            var report = new LmsReport
            {
                Id = reportId,
                TenantId = tenantId,
                OperatingBranchId = req.OperatingBranchId,
                PatientId = resolved.PatientId,
                OrderId = resolved.OrderId,
                Status = ReportStatuses.Draft,
                CurrentVersionNumber = 1,
                CreatedAtUtc = now,
                CreatedByUserId = actorUserId,
                UpdatedAtUtc = now,
                UpdatedByUserId = actorUserId,
                RowVersion = 1,
            };

            var version = new LmsReportVersion
            {
                Id = versionId,
                TenantId = tenantId,
                ReportId = reportId,
                VersionNumber = 1,
                PatientId = resolved.PatientId,
                OrderId = resolved.OrderId,
                OperatingBranchId = req.OperatingBranchId,
                CreatedAtUtc = now,
                CreatedByUserId = actorUserId,
            };

            foreach (var src in resolved.Sources)
            {
                version.Sources.Add(BuildSourceRow(tenantId, versionId, src));
            }

            // Claims first (pre-check + stage inserts); Report principal added before SaveChanges.
            await EnsureDraftSourceClaimsAsync(
                tenantId, reportId, excludeReportId: null, resolved.Sources, ct);
            _db.Reports.Add(report);
            _db.ReportVersions.Add(version);
            try
            {
                await _db.SaveChangesAsync(ct);
            }
            catch (DbUpdateException ex) when (IsDraftSourceClaimUniqueViolation(ex))
            {
                throw new TestingDomainException(
                    "That ResultVersion is already included in another Draft Report.",
                    statusCode: 409, code: "report_source_already_in_draft");
            }

            try
            {
                await _audit.WriteAsync(
                    tenantId, actorUserId,
                    ReportAuditActions.CreateReportDraft,
                    ReportAuditResources.LmsReport,
                    report.Id,
                    details:
                    $"reportId={report.Id}; version=1; status={report.Status}; orderId={report.OrderId}; patientId={report.PatientId}; sources={resolved.Sources.Count}; operatingBranchId={req.OperatingBranchId}",
                    ct: ct);
            }
            catch
            {
                await RevertReportAsync(tenantId, report.Id, ct);
                throw new TestingDomainException(
                    "Audit unavailable. Report draft was not completed.",
                    statusCode: 503, code: "audit_unavailable");
            }

            var dto = await ToDetailAsync(tenantId, report.Id, ct);
            await CompleteIdempotencyAsync(tenantId, claim.ClaimId, report.Id, dto, ct);
            return dto;
        }
        catch
        {
            await TryAbandonIdempotencyAsync(tenantId, claim.ClaimId, ct);
            throw;
        }
    }

    public async Task<ReportDetailDto> AppendVersionAsync(
        Guid tenantId, Guid actorUserId, Guid reportId, AppendReportVersionRequest req,
        CancellationToken ct = default)
    {
        if (req.OperatingBranchId == Guid.Empty)
            throw new TestingDomainException(
                "Operating branch is required.", statusCode: 400, code: "operating_branch_required");

        if (string.IsNullOrWhiteSpace(req.IdempotencyKey))
            throw new TestingDomainException(
                "Idempotency key is required.", statusCode: 400, code: "idempotency_key_required");

        if (req.Sources is null || req.Sources.Count == 0)
            throw new TestingDomainException(
                "At least one ClinicallyAuthorized ResultVersion is required.",
                statusCode: 400, code: "sources_required");

        await _platform.ValidateUserBranchAsync(tenantId, actorUserId, req.OperatingBranchId, ct);

        var normalizedSources = NormalizeSources(req.Sources);
        var hash = HashRequest(new
        {
            reportId,
            req.OperatingBranchId,
            req.ExpectedRowVersion,
            Sources = normalizedSources.Select(s => new { s.ResultId, s.ResultVersionNumber }).ToList(),
        });

        var claim = await ClaimIdempotencyAsync(
            tenantId, req.IdempotencyKey, ReportIdempotencyOperations.AppendReportVersion, hash, ct);
        if (claim.ReplayJson is not null)
            return DeserializeDetail(claim.ReplayJson);

        try
        {
            var report = await _db.Reports
                .FirstOrDefaultAsync(r => r.Id == reportId && r.TenantId == tenantId, ct)
                ?? throw new TestingDomainException("Report not found.", statusCode: 404, code: "not_found");

            if (report.OperatingBranchId != req.OperatingBranchId)
                throw new TestingDomainException(
                    "Report is outside the authorized operating branch context.",
                    statusCode: 403, code: "branch_unauthorized");

            if (!string.Equals(report.Status, ReportStatuses.Draft, StringComparison.Ordinal))
                throw new TestingDomainException(
                    "Only Draft reports can receive a new ReportVersion in this foundation.",
                    statusCode: 409, code: "invalid_state");

            if (report.RowVersion != req.ExpectedRowVersion)
                throw new TestingDomainException(
                    "Report was modified by another request.",
                    statusCode: 409, code: "concurrency_conflict");

            var resolved = await ResolveEligibleSourcesAsync(
                tenantId, req.OperatingBranchId, normalizedSources, ct);

            if (resolved.PatientId != report.PatientId || resolved.OrderId != report.OrderId)
                throw new TestingDomainException(
                    "Source Results must match the Report patient and order context.",
                    statusCode: 409, code: "context_mismatch");

            var now = DateTime.UtcNow;
            var nextVersion = report.CurrentVersionNumber + 1;
            var versionId = Guid.NewGuid();
            var version = new LmsReportVersion
            {
                Id = versionId,
                TenantId = tenantId,
                ReportId = report.Id,
                VersionNumber = nextVersion,
                PatientId = report.PatientId,
                OrderId = report.OrderId,
                OperatingBranchId = report.OperatingBranchId,
                CreatedAtUtc = now,
                CreatedByUserId = actorUserId,
            };

            foreach (var src in resolved.Sources)
                version.Sources.Add(BuildSourceRow(tenantId, versionId, src));

            await EnsureDraftSourceClaimsAsync(
                tenantId, report.Id, excludeReportId: report.Id, resolved.Sources, ct);

            report.CurrentVersionNumber = nextVersion;
            report.UpdatedAtUtc = now;
            report.UpdatedByUserId = actorUserId;
            report.RowVersion++;

            _db.ReportVersions.Add(version); // report already tracked

            try
            {
                await _db.SaveChangesAsync(ct);
            }
            catch (DbUpdateConcurrencyException)
            {
                throw new TestingDomainException(
                    "Report was modified by another request.",
                    statusCode: 409, code: "concurrency_conflict");
            }
            catch (DbUpdateException ex) when (IsDraftSourceClaimUniqueViolation(ex))
            {
                throw new TestingDomainException(
                    "That ResultVersion is already included in another Draft Report.",
                    statusCode: 409, code: "report_source_already_in_draft");
            }

            try
            {
                await _audit.WriteAsync(
                    tenantId, actorUserId,
                    ReportAuditActions.AppendReportVersion,
                    ReportAuditResources.LmsReportVersion,
                    version.Id,
                    details:
                    $"reportId={report.Id}; version={nextVersion}; sources={resolved.Sources.Count}; operatingBranchId={req.OperatingBranchId}",
                    ct: ct);
            }
            catch
            {
                await RevertAppendAsync(tenantId, report.Id, version.Id, nextVersion - 1, req.ExpectedRowVersion, ct);
                throw new TestingDomainException(
                    "Audit unavailable. ReportVersion append was not completed.",
                    statusCode: 503, code: "audit_unavailable");
            }

            var dto = await ToDetailAsync(tenantId, report.Id, ct);
            await CompleteIdempotencyAsync(tenantId, claim.ClaimId, report.Id, dto, ct);
            return dto;
        }
        catch
        {
            await TryAbandonIdempotencyAsync(tenantId, claim.ClaimId, ct);
            throw;
        }
    }

    public async Task<ReportDetailDto> FinalizeAsync(
        Guid tenantId, Guid actorUserId, Guid reportId, FinalizeReportRequest req,
        CancellationToken ct = default)
    {
        if (req.OperatingBranchId == Guid.Empty)
            throw new TestingDomainException(
                "Operating branch is required.", statusCode: 400, code: "operating_branch_required");

        if (string.IsNullOrWhiteSpace(req.IdempotencyKey))
            throw new TestingDomainException(
                "Idempotency key is required.", statusCode: 400, code: "idempotency_key_required");

        await _platform.ValidateUserBranchAsync(tenantId, actorUserId, req.OperatingBranchId, ct);

        var hash = HashRequest(new
        {
            reportId,
            req.OperatingBranchId,
            req.ExpectedRowVersion,
        });

        var claim = await ClaimIdempotencyAsync(
            tenantId, req.IdempotencyKey, ReportIdempotencyOperations.FinalizeReport, hash, ct);
        if (claim.ReplayJson is not null)
            return DeserializeDetail(claim.ReplayJson);

        try
        {
            var report = await _db.Reports
                .FirstOrDefaultAsync(r => r.Id == reportId && r.TenantId == tenantId, ct)
                ?? throw new TestingDomainException("Report not found.", statusCode: 404, code: "not_found");

            if (report.OperatingBranchId != req.OperatingBranchId)
                throw new TestingDomainException(
                    "Report is outside the authorized operating branch context.",
                    statusCode: 403, code: "branch_unauthorized");

            if (string.Equals(report.Status, ReportStatuses.Final, StringComparison.Ordinal))
                throw new TestingDomainException(
                    "Report is already Final.",
                    statusCode: 409, code: "invalid_state");

            if (!string.Equals(report.Status, ReportStatuses.Draft, StringComparison.Ordinal))
                throw new TestingDomainException(
                    "Only Draft reports can be Finalized.",
                    statusCode: 409, code: "invalid_state");

            if (report.RowVersion != req.ExpectedRowVersion)
                throw new TestingDomainException(
                    "Report was modified by another request.",
                    statusCode: 409, code: "concurrency_conflict");

            if (report.CurrentVersionNumber < 1)
                throw new TestingDomainException(
                    "Report has no current ReportVersion.",
                    statusCode: 409, code: "version_missing");

            var currentVersion = await _db.ReportVersions.AsNoTracking()
                .FirstOrDefaultAsync(v =>
                    v.TenantId == tenantId
                    && v.ReportId == report.Id
                    && v.VersionNumber == report.CurrentVersionNumber, ct)
                ?? throw new TestingDomainException(
                    "Current ReportVersion not found.",
                    statusCode: 409, code: "version_missing");

            var sourceCount = await _db.ReportVersionSources.AsNoTracking()
                .CountAsync(s => s.TenantId == tenantId && s.ReportVersionId == currentVersion.Id, ct);
            if (sourceCount < 1)
                throw new TestingDomainException(
                    "Report has no bound ResultVersion sources.",
                    statusCode: 409, code: "sources_required");

            var frozenVersionNumber = report.CurrentVersionNumber;
            var previousRowVersion = report.RowVersion;
            var now = DateTime.UtcNow;

            report.Status = ReportStatuses.Final;
            report.FinalizedAtUtc = now;
            report.FinalizedByUserId = actorUserId;
            report.UpdatedAtUtc = now;
            report.UpdatedByUserId = actorUserId;
            report.RowVersion++;

            try
            {
                await _db.SaveChangesAsync(ct);
            }
            catch (DbUpdateConcurrencyException)
            {
                throw new TestingDomainException(
                    "Report was modified by another request.",
                    statusCode: 409, code: "concurrency_conflict");
            }

            try
            {
                await _audit.WriteAsync(
                    tenantId, actorUserId,
                    ReportAuditActions.FinalizeReport,
                    ReportAuditResources.LmsReport,
                    report.Id,
                    details:
                    $"reportId={report.Id}; status={report.Status}; version={frozenVersionNumber}; finalizedBy={actorUserId}; operatingBranchId={req.OperatingBranchId}",
                    ct: ct);
            }
            catch
            {
                await RevertFinalizeAsync(
                    tenantId, report.Id, previousRowVersion, ct);
                throw new TestingDomainException(
                    "Audit unavailable. Report finalization was not completed.",
                    statusCode: 503, code: "audit_unavailable");
            }

            var dto = await ToDetailAsync(tenantId, report.Id, ct);
            await CompleteIdempotencyAsync(tenantId, claim.ClaimId, report.Id, dto, ct);
            return dto;
        }
        catch
        {
            await TryAbandonIdempotencyAsync(tenantId, claim.ClaimId, ct);
            throw;
        }
    }

    public async Task<ReportDetailDto> ReleaseAsync(
        Guid tenantId, Guid actorUserId, Guid reportId, ReleaseReportRequest req,
        CancellationToken ct = default)
    {
        if (req.OperatingBranchId == Guid.Empty)
            throw new TestingDomainException(
                "Operating branch is required.", statusCode: 400, code: "operating_branch_required");

        if (string.IsNullOrWhiteSpace(req.IdempotencyKey))
            throw new TestingDomainException(
                "Idempotency key is required.", statusCode: 400, code: "idempotency_key_required");

        await _platform.ValidateUserBranchAsync(tenantId, actorUserId, req.OperatingBranchId, ct);

        var hash = HashRequest(new
        {
            reportId,
            req.OperatingBranchId,
            req.ExpectedRowVersion,
        });

        var claim = await ClaimIdempotencyAsync(
            tenantId, req.IdempotencyKey, ReportIdempotencyOperations.ReleaseReport, hash, ct);
        if (claim.ReplayJson is not null)
            return DeserializeDetail(claim.ReplayJson);

        try
        {
            var report = await _db.Reports
                .FirstOrDefaultAsync(r => r.Id == reportId && r.TenantId == tenantId, ct)
                ?? throw new TestingDomainException("Report not found.", statusCode: 404, code: "not_found");

            if (report.OperatingBranchId != req.OperatingBranchId)
                throw new TestingDomainException(
                    "Report is outside the authorized operating branch context.",
                    statusCode: 403, code: "branch_unauthorized");

            if (string.Equals(report.Status, ReportStatuses.Released, StringComparison.Ordinal))
                throw new TestingDomainException(
                    "Report is already Released.",
                    statusCode: 409, code: "invalid_state");

            if (!string.Equals(report.Status, ReportStatuses.Final, StringComparison.Ordinal))
                throw new TestingDomainException(
                    "Only Final reports can be Released.",
                    statusCode: 409, code: "invalid_state");

            if (report.RowVersion != req.ExpectedRowVersion)
                throw new TestingDomainException(
                    "Report was modified by another request.",
                    statusCode: 409, code: "concurrency_conflict");

            if (report.CurrentVersionNumber < 1)
                throw new TestingDomainException(
                    "Report has no current ReportVersion.",
                    statusCode: 409, code: "version_missing");

            var frozenVersionNumber = report.CurrentVersionNumber;
            var previousRowVersion = report.RowVersion;
            var now = DateTime.UtcNow;

            report.Status = ReportStatuses.Released;
            report.ReleasedAtUtc = now;
            report.ReleasedByUserId = actorUserId;
            report.UpdatedAtUtc = now;
            report.UpdatedByUserId = actorUserId;
            report.RowVersion++;

            try
            {
                await _db.SaveChangesAsync(ct);
            }
            catch (DbUpdateConcurrencyException)
            {
                throw new TestingDomainException(
                    "Report was modified by another request.",
                    statusCode: 409, code: "concurrency_conflict");
            }

            try
            {
                await _audit.WriteAsync(
                    tenantId, actorUserId,
                    ReportAuditActions.ReleaseReport,
                    ReportAuditResources.LmsReport,
                    report.Id,
                    details:
                    $"reportId={report.Id}; status={report.Status}; version={frozenVersionNumber}; releasedBy={actorUserId}; operatingBranchId={req.OperatingBranchId}",
                    ct: ct);
            }
            catch
            {
                await RevertReleaseAsync(tenantId, report.Id, previousRowVersion, ct);
                throw new TestingDomainException(
                    "Audit unavailable. Report release was not completed.",
                    statusCode: 503, code: "audit_unavailable");
            }

            var dto = await ToDetailAsync(tenantId, report.Id, ct);
            await CompleteIdempotencyAsync(tenantId, claim.ClaimId, report.Id, dto, ct);
            return dto;
        }
        catch
        {
            await TryAbandonIdempotencyAsync(tenantId, claim.ClaimId, ct);
            throw;
        }
    }

    public async Task<ReportDetailDto> AssignNumberAsync(
        Guid tenantId, Guid actorUserId, Guid reportId, AssignReportNumberRequest req,
        CancellationToken ct = default)
    {
        if (req.OperatingBranchId == Guid.Empty)
            throw new TestingDomainException(
                "Operating branch is required.", statusCode: 400, code: "operating_branch_required");

        if (string.IsNullOrWhiteSpace(req.IdempotencyKey))
            throw new TestingDomainException(
                "Idempotency key is required.", statusCode: 400, code: "idempotency_key_required");

        await _platform.ValidateUserBranchAsync(tenantId, actorUserId, req.OperatingBranchId, ct);

        var hash = HashRequest(new
        {
            reportId,
            req.OperatingBranchId,
            req.ExpectedRowVersion,
        });

        var claim = await ClaimIdempotencyAsync(
            tenantId, req.IdempotencyKey, ReportIdempotencyOperations.AssignReportNumber, hash, ct);
        if (claim.ReplayJson is not null)
            return DeserializeDetail(claim.ReplayJson);

        try
        {
            var report = await _db.Reports
                .FirstOrDefaultAsync(r => r.Id == reportId && r.TenantId == tenantId, ct)
                ?? throw new TestingDomainException("Report not found.", statusCode: 404, code: "not_found");

            if (report.OperatingBranchId != req.OperatingBranchId)
                throw new TestingDomainException(
                    "Report is outside the authorized operating branch context.",
                    statusCode: 403, code: "branch_unauthorized");

            if (!string.Equals(report.Status, ReportStatuses.Released, StringComparison.Ordinal))
                throw new TestingDomainException(
                    "Only Released reports can receive a Business Report Number.",
                    statusCode: 409, code: "invalid_state");

            if (!string.IsNullOrWhiteSpace(report.BusinessReportNumber))
                throw new TestingDomainException(
                    "Report Number is already assigned and is immutable.",
                    statusCode: 409, code: "invalid_state");

            if (report.RowVersion != req.ExpectedRowVersion)
                throw new TestingDomainException(
                    "Report was modified by another request.",
                    statusCode: 409, code: "concurrency_conflict");

            var now = DateTime.UtcNow;
            var config = await ResolveReportNumberConfigurationAsync(
                tenantId, report.OperatingBranchId, now, ct);
            var sequenceValue = await AllocateReportNumberSequenceAsync(
                tenantId, report.OperatingBranchId, config, now, ct);
            var number = ReportNumberFormats.FormatNumber(config, sequenceValue, now);

            if (number.Length > ReportNumberFormats.MaxBusinessReportNumberLength)
                throw new TestingDomainException(
                    "Configured Report Number format exceeds maximum length.",
                    statusCode: 503, code: "report_number_configuration_invalid");

            var previousRowVersion = report.RowVersion;
            report.BusinessReportNumber = number;
            report.BusinessReportNumberAssignedAtUtc = now;
            report.BusinessReportNumberAssignedByUserId = actorUserId;
            report.UpdatedAtUtc = now;
            report.UpdatedByUserId = actorUserId;
            report.RowVersion++;

            try
            {
                await _db.SaveChangesAsync(ct);
            }
            catch (DbUpdateConcurrencyException)
            {
                throw new TestingDomainException(
                    "Report was modified by another request.",
                    statusCode: 409, code: "concurrency_conflict");
            }
            catch (DbUpdateException ex) when (IsBusinessReportNumberUniqueViolation(ex))
            {
                throw new TestingDomainException(
                    "Business Report Number uniqueness conflict.",
                    statusCode: 409, code: "report_number_conflict");
            }

            try
            {
                await _audit.WriteAsync(
                    tenantId, actorUserId,
                    ReportAuditActions.AssignReportNumber,
                    ReportAuditResources.LmsReport,
                    report.Id,
                    details:
                    $"reportId={report.Id}; businessReportNumber={number}; status={report.Status}; assignedBy={actorUserId}; operatingBranchId={req.OperatingBranchId}",
                    ct: ct);
            }
            catch
            {
                await RevertAssignNumberAsync(tenantId, report.Id, previousRowVersion, ct);
                throw new TestingDomainException(
                    "Audit unavailable. Report Number assignment was not completed.",
                    statusCode: 503, code: "audit_unavailable");
            }

            var dto = await ToDetailAsync(tenantId, report.Id, ct);
            await CompleteIdempotencyAsync(tenantId, claim.ClaimId, report.Id, dto, ct);
            return dto;
        }
        catch
        {
            await TryAbandonIdempotencyAsync(tenantId, claim.ClaimId, ct);
            throw;
        }
    }

    public async Task<ReportDetailDto> GetAsync(
        Guid tenantId, Guid actorUserId, Guid reportId, Guid operatingBranchId, CancellationToken ct = default)
    {
        if (operatingBranchId == Guid.Empty)
            throw new TestingDomainException(
                "Operating branch is required.", statusCode: 400, code: "operating_branch_required");

        await _platform.ValidateUserBranchAsync(tenantId, actorUserId, operatingBranchId, ct);

        var report = await _db.Reports.AsNoTracking()
            .FirstOrDefaultAsync(r => r.Id == reportId && r.TenantId == tenantId, ct)
            ?? throw new TestingDomainException("Report not found.", statusCode: 404, code: "not_found");

        if (report.OperatingBranchId != operatingBranchId)
            throw new TestingDomainException(
                "Report is outside the authorized operating branch context.",
                statusCode: 403, code: "branch_unauthorized");

        return await ToDetailAsync(tenantId, reportId, ct);
    }

    public async Task<ReportVersionDto> GetVersionAsync(
        Guid tenantId, Guid actorUserId, Guid reportId, int versionNumber, Guid operatingBranchId,
        CancellationToken ct = default)
    {
        var detail = await GetAsync(tenantId, actorUserId, reportId, operatingBranchId, ct);
        var version = detail.Versions.FirstOrDefault(v => v.VersionNumber == versionNumber)
            ?? throw new TestingDomainException("ReportVersion not found.", statusCode: 404, code: "not_found");
        return version;
    }

    public async Task<ReportEligibleSourcesPageDto> ListEligibleSourcesAsync(
        Guid tenantId, Guid actorUserId, Guid operatingBranchId, Guid? orderId = null,
        int page = 1, int pageSize = 50, CancellationToken ct = default)
    {
        if (operatingBranchId == Guid.Empty)
            throw new TestingDomainException(
                "Operating branch is required.", statusCode: 400, code: "operating_branch_required");

        await _platform.ValidateUserBranchAsync(tenantId, actorUserId, operatingBranchId, ct);

        page = page < 1 ? 1 : page;
        pageSize = pageSize < 1 ? 25 : Math.Min(pageSize, 100);

        // PD-REP-DRAFT-UNIQUE-01: exclude ResultVersions already claimed by an active Draft Report.
        var claimedVersionIds = _db.ReportDraftSourceClaims.AsNoTracking()
            .Where(c => c.TenantId == tenantId)
            .Select(c => c.ResultVersionId);

        var q =
            from r in _db.Results.AsNoTracking()
            join v in _db.ResultVersions.AsNoTracking()
                on new { r.TenantId, ResultId = r.Id, VersionNumber = r.AuthorizedVersionNumber!.Value }
                equals new { v.TenantId, ResultId = v.ResultId, VersionNumber = v.VersionNumber }
            where r.TenantId == tenantId
                  && r.OperatingBranchId == operatingBranchId
                  && r.Status == ResultStatuses.ClinicallyAuthorized
                  && r.AuthorizedVersionNumber != null
                  && !claimedVersionIds.Contains(v.Id)
            select r;

        if (orderId is Guid oid && oid != Guid.Empty)
            q = q.Where(r => r.OrderId == oid);

        var total = await q.CountAsync(ct);
        var results = await q
            .OrderByDescending(r => r.AuthorizedAtUtc)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .ToListAsync(ct);

        var orderIds = results.Select(r => r.OrderId).Distinct().ToList();
        var orders = await _db.Orders.AsNoTracking()
            .Where(o => o.TenantId == tenantId && orderIds.Contains(o.Id))
            .ToDictionaryAsync(o => o.Id, ct);
        var orderVersionIds = orders.Values
            .Where(o => o.CurrentVersionId is not null)
            .Select(o => o.CurrentVersionId!.Value)
            .ToList();
        var orderVersions = await _db.OrderVersions.AsNoTracking()
            .Where(v => v.TenantId == tenantId && orderVersionIds.Contains(v.Id))
            .ToDictionaryAsync(v => v.Id, ct);
        var otIds = results.Select(r => r.OrderTestId).Distinct().ToList();
        var orderTests = await _db.OrderTests.AsNoTracking()
            .Where(t => t.TenantId == tenantId && otIds.Contains(t.Id))
            .ToDictionaryAsync(t => t.Id, ct);

        var items = new List<ReportEligibleSourceDto>();
        foreach (var r in results)
        {
            orders.TryGetValue(r.OrderId, out var order);
            LmsOrderVersion? ov = null;
            if (order?.CurrentVersionId is Guid vid)
                orderVersions.TryGetValue(vid, out ov);
            orderTests.TryGetValue(r.OrderTestId, out var ot);
            items.Add(new ReportEligibleSourceDto(
                ResultId: r.Id,
                AuthorizedVersionNumber: r.AuthorizedVersionNumber!.Value,
                OrderId: r.OrderId,
                OrderNumber: order?.OrderNumber ?? string.Empty,
                OrderTestId: r.OrderTestId,
                SpecimenId: r.SpecimenId,
                PatientId: ov?.PatientId ?? Guid.Empty,
                PatientMrn: ov?.PatientMrnSnapshot,
                PatientName: ov?.PatientNameSnapshot,
                TestDisplayName: ot?.DisplayNameSnapshot ?? string.Empty,
                InternalOrderCode: ot?.InternalOrderCodeSnapshot ?? string.Empty,
                NumericValue: r.NumericValue,
                QualitativeValue: r.QualitativeValue,
                Unit: r.Unit));
        }

        return new ReportEligibleSourcesPageDto(items, page, pageSize, total);
    }

    public async Task<ReportListPageDto> ListAsync(
        Guid tenantId, Guid actorUserId, ReportListQuery query, CancellationToken ct = default)
    {
        if (query.OperatingBranchId is null || query.OperatingBranchId == Guid.Empty)
            throw new TestingDomainException(
                "Operating branch is required.", statusCode: 400, code: "operating_branch_required");

        await _platform.ValidateUserBranchAsync(tenantId, actorUserId, query.OperatingBranchId.Value, ct);

        var page = query.Page < 1 ? 1 : query.Page;
        var pageSize = query.PageSize < 1 ? 25 : Math.Min(query.PageSize, 100);

        var q = _db.Reports.AsNoTracking()
            .Where(r => r.TenantId == tenantId && r.OperatingBranchId == query.OperatingBranchId.Value);

        if (query.PatientId is Guid patientId && patientId != Guid.Empty)
            q = q.Where(r => r.PatientId == patientId);

        if (query.OrderId is Guid orderId && orderId != Guid.Empty)
            q = q.Where(r => r.OrderId == orderId);

        if (!string.IsNullOrWhiteSpace(query.Status))
            q = q.Where(r => r.Status == query.Status);

        var total = await q.CountAsync(ct);
        var rows = await q
            .OrderByDescending(r => r.CreatedAtUtc)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .ToListAsync(ct);

        var orderIds = rows.Select(r => r.OrderId).Distinct().ToList();
        var orders = await _db.Orders.AsNoTracking()
            .Where(o => o.TenantId == tenantId && orderIds.Contains(o.Id))
            .ToDictionaryAsync(o => o.Id, ct);

        var reportIds = rows.Select(r => r.Id).ToList();
        var currentVersions = await _db.ReportVersions.AsNoTracking()
            .Where(v => v.TenantId == tenantId && reportIds.Contains(v.ReportId))
            .ToListAsync(ct);
        var currentVersionIds = rows
            .Select(r => currentVersions.FirstOrDefault(v =>
                v.ReportId == r.Id && v.VersionNumber == r.CurrentVersionNumber)?.Id)
            .Where(id => id is not null)
            .Select(id => id!.Value)
            .ToList();
        var sourceCountByVersion = await _db.ReportVersionSources.AsNoTracking()
            .Where(s => s.TenantId == tenantId && currentVersionIds.Contains(s.ReportVersionId))
            .GroupBy(s => s.ReportVersionId)
            .Select(g => new { ReportVersionId = g.Key, Count = g.Count() })
            .ToListAsync(ct);
        var sourceCountMap = sourceCountByVersion.ToDictionary(x => x.ReportVersionId, x => x.Count);

        var currentArtifactIds = rows
            .Where(r => r.CurrentOfficialArtifactId is not null)
            .Select(r => r.CurrentOfficialArtifactId!.Value)
            .Distinct()
            .ToList();
        var currentArtifacts = currentArtifactIds.Count == 0
            ? new Dictionary<Guid, LmsReportOfficialPdfArtifact>()
            : await _db.ReportOfficialPdfArtifacts.AsNoTracking()
                .Where(a => a.TenantId == tenantId && currentArtifactIds.Contains(a.Id))
                .ToDictionaryAsync(a => a.Id, ct);

        var items = rows.Select(r =>
        {
            var versionId = currentVersions
                .FirstOrDefault(v => v.ReportId == r.Id && v.VersionNumber == r.CurrentVersionNumber)?.Id;
            var currentSources = versionId is Guid vid && sourceCountMap.TryGetValue(vid, out var c) ? c : 0;
            orders.TryGetValue(r.OrderId, out var order);
            var visibleNumber = string.Equals(r.Status, ReportStatuses.Released, StringComparison.Ordinal)
                ? r.BusinessReportNumber
                : null;
            var downloadEligible =
                string.Equals(r.Status, ReportStatuses.Released, StringComparison.Ordinal)
                && !string.IsNullOrWhiteSpace(r.BusinessReportNumber)
                && r.CurrentOfficialArtifactId is Guid aid
                && currentArtifacts.TryGetValue(aid, out var art)
                && art.ReportId == r.Id
                && string.Equals(art.Status, OfficialPdfArtifactStatuses.Succeeded, StringComparison.Ordinal)
                && art.CanonicalDocumentId is not null
                && art.CanonicalDocumentId != Guid.Empty;
            return new ReportListItemDto(
                Id: r.Id,
                OperatingBranchId: r.OperatingBranchId,
                PatientId: r.PatientId,
                OrderId: r.OrderId,
                OrderNumber: order?.OrderNumber ?? string.Empty,
                Status: r.Status,
                CurrentVersionNumber: r.CurrentVersionNumber,
                FinalizedAtUtc: r.FinalizedAtUtc,
                FinalizedByUserId: r.FinalizedByUserId,
                ReleasedAtUtc: r.ReleasedAtUtc,
                ReleasedByUserId: r.ReleasedByUserId,
                BusinessReportNumber: visibleNumber,
                SourceCount: currentSources,
                CreatedAtUtc: r.CreatedAtUtc,
                CreatedByUserId: r.CreatedByUserId,
                RowVersion: r.RowVersion,
                OfficialPdfDownloadEligible: downloadEligible);
        }).ToList();

        return new ReportListPageDto(items, page, pageSize, total);
    }

    private sealed record ResolvedSource(
        LmsResult Result,
        LmsResultVersion Version,
        Guid PatientId);

    private sealed record ResolvedBundle(
        Guid PatientId,
        Guid OrderId,
        IReadOnlyList<ResolvedSource> Sources);

    private async Task<ResolvedBundle> ResolveEligibleSourcesAsync(
        Guid tenantId,
        Guid operatingBranchId,
        IReadOnlyList<ReportSourceResultRef> sources,
        CancellationToken ct)
    {
        var resolved = new List<ResolvedSource>();
        Guid? patientId = null;
        Guid? orderId = null;

        foreach (var src in sources)
        {
            var result = await _db.Results
                .FirstOrDefaultAsync(r => r.Id == src.ResultId && r.TenantId == tenantId, ct)
                ?? throw new TestingDomainException(
                    "LMS Result not found. Legacy Pathology reports are not valid LMS Report sources.",
                    statusCode: 404, code: "not_found");

            if (result.OperatingBranchId != operatingBranchId)
                throw new TestingDomainException(
                    "Result is outside the authorized operating branch context.",
                    statusCode: 403, code: "branch_unauthorized");

            if (string.Equals(result.Status, ResultStatuses.Draft, StringComparison.Ordinal))
                throw new TestingDomainException(
                    "Draft results are not eligible for Report creation.",
                    statusCode: 409, code: "invalid_state");

            if (string.Equals(result.Status, ResultStatuses.TechnicalVerified, StringComparison.Ordinal))
                throw new TestingDomainException(
                    "TechnicalVerified results are not eligible; ClinicallyAuthorized is required.",
                    statusCode: 409, code: "invalid_state");

            if (!string.Equals(result.Status, ResultStatuses.ClinicallyAuthorized, StringComparison.Ordinal))
                throw new TestingDomainException(
                    "Only ClinicallyAuthorized LMS ResultVersions are eligible.",
                    statusCode: 409, code: "invalid_state");

            if (result.AuthorizedVersionNumber is null
                || result.AuthorizedVersionNumber.Value != src.ResultVersionNumber)
                throw new TestingDomainException(
                    "Requested ResultVersion is not the clinically authorized version.",
                    statusCode: 409, code: "version_not_authorized");

            var version = await _db.ResultVersions
                .AsNoTracking()
                .FirstOrDefaultAsync(v =>
                    v.TenantId == tenantId
                    && v.ResultId == result.Id
                    && v.VersionNumber == src.ResultVersionNumber, ct)
                ?? throw new TestingDomainException(
                    "Source ResultVersion not found.",
                    statusCode: 404, code: "version_missing");

            var order = await _db.Orders.AsNoTracking()
                .FirstOrDefaultAsync(o => o.Id == result.OrderId && o.TenantId == tenantId, ct)
                ?? throw new TestingDomainException("Order not found.", statusCode: 404, code: "not_found");

            var orderVersion = await _db.OrderVersions.AsNoTracking()
                .FirstOrDefaultAsync(v => v.Id == order.CurrentVersionId && v.TenantId == tenantId, ct)
                ?? throw new TestingDomainException(
                    "Order version not found.", statusCode: 404, code: "not_found");

            if (patientId is null)
            {
                patientId = orderVersion.PatientId;
                orderId = result.OrderId;
            }
            else if (patientId != orderVersion.PatientId || orderId != result.OrderId)
            {
                throw new TestingDomainException(
                    "All source Results must share the same patient and order reporting context.",
                    statusCode: 409, code: "context_mismatch");
            }

            // Ensure OrderTest remains Ordered (no Result-side mutation expectations).
            var orderTest = await _db.OrderTests.AsNoTracking()
                .FirstOrDefaultAsync(t => t.Id == result.OrderTestId && t.TenantId == tenantId, ct)
                ?? throw new TestingDomainException("OrderTest not found.", statusCode: 404, code: "not_found");

            if (!string.Equals(orderTest.Status, OrderTestStatuses.Ordered, StringComparison.Ordinal))
                throw new TestingDomainException(
                    "OrderTest must remain Ordered.", statusCode: 409, code: "order_test_not_ordered");

            resolved.Add(new ResolvedSource(result, version, orderVersion.PatientId));
        }

        return new ResolvedBundle(patientId!.Value, orderId!.Value, resolved);
    }

    private static LmsReportVersionSource BuildSourceRow(
        Guid tenantId, Guid reportVersionId, ResolvedSource src) =>
        new()
        {
            Id = Guid.NewGuid(),
            TenantId = tenantId,
            ReportVersionId = reportVersionId,
            ResultId = src.Result.Id,
            ResultVersionId = src.Version.Id,
            ResultVersionNumber = src.Version.VersionNumber,
            OrderTestId = src.Result.OrderTestId,
            SpecimenId = src.Result.SpecimenId,
            CatalogueItemId = src.Result.CatalogueItemId,
            CatalogueVersionId = src.Result.CatalogueVersionId,
            ResultDatatype = src.Result.ResultDatatype,
            NumericValue = src.Version.NumericValue,
            QualitativeValue = src.Version.QualitativeValue,
            Unit = src.Version.Unit,
            Comment = src.Version.Comment,
            ResultStatusAtSnapshot = ResultStatuses.ClinicallyAuthorized,
            AuthorizedByUserId = src.Result.AuthorizedByUserId,
            AuthorizedAtUtc = src.Result.AuthorizedAtUtc,
        };

    private static IReadOnlyList<ReportSourceResultRef> NormalizeSources(
        IReadOnlyList<ReportSourceResultRef> sources)
    {
        var seen = new HashSet<(Guid, int)>();
        var list = new List<ReportSourceResultRef>();
        foreach (var s in sources)
        {
            if (s.ResultId == Guid.Empty || s.ResultVersionNumber < 1)
                throw new TestingDomainException(
                    "Each source requires ResultId and ResultVersionNumber.",
                    statusCode: 400, code: "invalid_source");

            if (!seen.Add((s.ResultId, s.ResultVersionNumber)))
                throw new TestingDomainException(
                    "Duplicate source ResultVersion in request.",
                    statusCode: 400, code: "duplicate_source");

            list.Add(s);
        }

        return list
            .OrderBy(s => s.ResultId)
            .ThenBy(s => s.ResultVersionNumber)
            .ToList();
    }

    private async Task<ReportDetailDto> ToDetailAsync(Guid tenantId, Guid reportId, CancellationToken ct)
    {
        var report = await _db.Reports.AsNoTracking()
            .FirstAsync(r => r.Id == reportId && r.TenantId == tenantId, ct);

        var order = await _db.Orders.AsNoTracking()
            .FirstAsync(o => o.Id == report.OrderId && o.TenantId == tenantId, ct);

        var versions = await _db.ReportVersions.AsNoTracking()
            .Where(v => v.TenantId == tenantId && v.ReportId == reportId)
            .OrderBy(v => v.VersionNumber)
            .ToListAsync(ct);

        var versionIds = versions.Select(v => v.Id).ToList();
        var sources = await _db.ReportVersionSources.AsNoTracking()
            .Where(s => s.TenantId == tenantId && versionIds.Contains(s.ReportVersionId))
            .ToListAsync(ct);

        var versionDtos = versions.Select(v =>
        {
            var srcDtos = sources
                .Where(s => s.ReportVersionId == v.Id)
                .OrderBy(s => s.ResultId)
                .Select(s => new ReportSourceSnapshotDto(
                    s.Id, s.ResultId, s.ResultVersionId, s.ResultVersionNumber,
                    s.OrderTestId, s.SpecimenId, s.CatalogueItemId, s.CatalogueVersionId,
                    s.ResultDatatype, s.NumericValue, s.QualitativeValue, s.Unit, s.Comment,
                    s.ResultStatusAtSnapshot, s.AuthorizedByUserId, s.AuthorizedAtUtc))
                .ToList();
            return new ReportVersionDto(
                v.Id, v.ReportId, v.VersionNumber, v.PatientId, v.OrderId, v.OperatingBranchId,
                v.CreatedAtUtc, v.CreatedByUserId, srcDtos);
        }).ToList();

        var visibleNumber = string.Equals(report.Status, ReportStatuses.Released, StringComparison.Ordinal)
            ? report.BusinessReportNumber
            : null;
        var visibleAssignedAt = visibleNumber is null ? null : report.BusinessReportNumberAssignedAtUtc;
        var visibleAssignedBy = visibleNumber is null ? null : report.BusinessReportNumberAssignedByUserId;

        OfficialPdfJobDto? pdfJob = null;
        OfficialPdfArtifactMetadataDto? currentArtifact = null;
        var latestJob = await _db.ReportOfficialPdfJobs.AsNoTracking()
            .Where(j => j.TenantId == tenantId && j.ReportId == reportId)
            .OrderByDescending(j => j.RequestedAtUtc)
            .FirstOrDefaultAsync(ct);
        if (latestJob is not null)
        {
            OfficialPdfArtifactMetadataDto? jobArtifact = null;
            if (latestJob.ArtifactId is Guid jAid)
                jobArtifact = await LoadArtifactMetadataAsync(tenantId, jAid, ct);
            pdfJob = new OfficialPdfJobDto(
                latestJob.Id, latestJob.ReportId, latestJob.Status, latestJob.RequestedByUserId,
                latestJob.RequestedAtUtc, latestJob.StartedAtUtc, latestJob.CompletedAtUtc,
                latestJob.AttemptCount, latestJob.ArtifactId, jobArtifact,
                latestJob.FailureCode, latestJob.FailureMessage);
        }

        if (report.CurrentOfficialArtifactId is Guid curAid)
            currentArtifact = await LoadArtifactMetadataAsync(tenantId, curAid, ct);

        return new ReportDetailDto(
            report.Id, report.TenantId, report.OperatingBranchId, report.PatientId, report.OrderId,
            order.OrderNumber, report.Status, report.CurrentVersionNumber,
            report.FinalizedAtUtc, report.FinalizedByUserId,
            report.ReleasedAtUtc, report.ReleasedByUserId,
            visibleNumber, visibleAssignedAt, visibleAssignedBy,
            report.CreatedAtUtc, report.CreatedByUserId, report.UpdatedAtUtc, report.UpdatedByUserId,
            report.RowVersion, versionDtos,
            report.CurrentOfficialArtifactId, pdfJob, currentArtifact);
    }

    private async Task<OfficialPdfArtifactMetadataDto?> LoadArtifactMetadataAsync(
        Guid tenantId, Guid artifactId, CancellationToken ct)
    {
        var a = await _db.ReportOfficialPdfArtifacts.AsNoTracking()
            .FirstOrDefaultAsync(x => x.Id == artifactId && x.TenantId == tenantId, ct);
        if (a is null) return null;
        var template = await _db.ReportPdfTemplateVersions.AsNoTracking()
            .FirstOrDefaultAsync(t => t.Id == a.TemplateVersionId && t.TenantId == tenantId, ct);
        return new OfficialPdfArtifactMetadataDto(
            a.Id, a.ArtifactVersion, a.Status, a.MimeType, a.SizeBytes, a.ContentHash,
            a.CanonicalDocumentId, a.TemplateVersionId,
            template?.VersionNumber ?? 0, template?.TemplateCode ?? string.Empty,
            a.GeneratedByUserId, a.GeneratedAtUtc, a.FailureCode, a.FailureMessage);
    }

    private async Task RevertFinalizeAsync(
        Guid tenantId, Guid reportId, int previousRowVersion, CancellationToken ct)
    {
        var report = await _db.Reports.FirstOrDefaultAsync(r => r.Id == reportId && r.TenantId == tenantId, ct);
        if (report is null) return;

        report.Status = ReportStatuses.Draft;
        report.FinalizedAtUtc = null;
        report.FinalizedByUserId = null;
        report.RowVersion = previousRowVersion;
        report.UpdatedAtUtc = DateTime.UtcNow;
        await _db.SaveChangesAsync(ct);
    }

    private async Task RevertReleaseAsync(
        Guid tenantId, Guid reportId, int previousRowVersion, CancellationToken ct)
    {
        var report = await _db.Reports.FirstOrDefaultAsync(r => r.Id == reportId && r.TenantId == tenantId, ct);
        if (report is null) return;

        report.Status = ReportStatuses.Final;
        report.ReleasedAtUtc = null;
        report.ReleasedByUserId = null;
        report.RowVersion = previousRowVersion;
        report.UpdatedAtUtc = DateTime.UtcNow;
        await _db.SaveChangesAsync(ct);
    }

    private async Task RevertAssignNumberAsync(
        Guid tenantId, Guid reportId, int previousRowVersion, CancellationToken ct)
    {
        var report = await _db.Reports.FirstOrDefaultAsync(r => r.Id == reportId && r.TenantId == tenantId, ct);
        if (report is null) return;

        // Clear assignment; sequence gap is allowed (PD-ART-03b). Number value is not recycled.
        report.BusinessReportNumber = null;
        report.BusinessReportNumberAssignedAtUtc = null;
        report.BusinessReportNumberAssignedByUserId = null;
        report.RowVersion = previousRowVersion;
        report.UpdatedAtUtc = DateTime.UtcNow;
        await _db.SaveChangesAsync(ct);
    }

    private async Task<LmsReportNumberConfiguration> ResolveReportNumberConfigurationAsync(
        Guid tenantId, Guid operatingBranchId, DateTime utcNow, CancellationToken ct)
    {
        var dayStart = new DateTime(utcNow.Year, utcNow.Month, utcNow.Day, 0, 0, 0, DateTimeKind.Utc);
        var candidates = await _db.ReportNumberConfigurations.AsNoTracking()
            .Where(c =>
                c.TenantId == tenantId
                && c.OperatingBranchId == operatingBranchId
                && c.IsActive
                && c.EffectiveFromUtc <= dayStart)
            .OrderByDescending(c => c.EffectiveFromUtc)
            .ThenByDescending(c => c.CreatedAtUtc)
            .ToListAsync(ct);

        if (candidates.Count == 0)
            throw new TestingDomainException(
                "Active Report Number configuration is missing for this operating branch.",
                statusCode: 503, code: "report_number_configuration_missing");

        if (candidates.Count >= 2
            && candidates[0].EffectiveFromUtc == candidates[1].EffectiveFromUtc)
            throw new TestingDomainException(
                "Report Number configuration is ambiguous for this operating branch.",
                statusCode: 503, code: "report_number_configuration_ambiguous");

        var config = candidates[0];
        if (!ReportNumberFormats.IsStructurallyValid(config))
            throw new TestingDomainException(
                "Report Number configuration is invalid.",
                statusCode: 503, code: "report_number_configuration_invalid");
        return config;
    }

    private async Task<int> AllocateReportNumberSequenceAsync(
        Guid tenantId,
        Guid operatingBranchId,
        LmsReportNumberConfiguration config,
        DateTime utcNow,
        CancellationToken ct)
    {
        var periodKey = ReportNumberFormats.ResolvePeriodKey(config, utcNow);

        if (_db.Database.IsNpgsql())
        {
            var seqId = Guid.NewGuid();
            var allocated = await _db.Database
                .SqlQuery<ReportNumberSequenceAllocRow>($"""
                    INSERT INTO lms_report_number_sequences
                        (id, tenant_id, operating_branch_id, sequence_period_key, last_value)
                    VALUES ({seqId}, {tenantId}, {operatingBranchId}, {periodKey}, 1)
                    ON CONFLICT (tenant_id, operating_branch_id, sequence_period_key)
                    DO UPDATE SET last_value = lms_report_number_sequences.last_value + 1
                    RETURNING last_value AS "Value"
                    """)
                .ToListAsync(ct);
            if (allocated.Count != 1)
                throw new TestingDomainException(
                    "Failed to allocate Report Number sequence.",
                    statusCode: 500, code: "report_number_alloc");
            return allocated[0].Value;
        }

        var gateKey = $"rn:{tenantId:N}:{operatingBranchId:N}:{periodKey}";
        var gate = SequenceGates.GetOrAdd(gateKey, _ => new SemaphoreSlim(1, 1));
        await gate.WaitAsync(ct);
        try
        {
            for (var attempt = 0; attempt < 5; attempt++)
            {
                try
                {
                    var seq = await _db.ReportNumberSequences
                        .FirstOrDefaultAsync(s =>
                            s.TenantId == tenantId
                            && s.OperatingBranchId == operatingBranchId
                            && s.SequencePeriodKey == periodKey, ct);
                    if (seq is null)
                    {
                        seq = new LmsReportNumberSequence
                        {
                            Id = Guid.NewGuid(),
                            TenantId = tenantId,
                            OperatingBranchId = operatingBranchId,
                            SequencePeriodKey = periodKey,
                            LastValue = 0,
                        };
                        _db.ReportNumberSequences.Add(seq);
                    }

                    seq.LastValue++;
                    await _db.SaveChangesAsync(ct);
                    return seq.LastValue;
                }
                catch (DbUpdateException ex) when (IsUniqueViolation(ex))
                {
                    foreach (var entry in _db.ChangeTracker.Entries<LmsReportNumberSequence>().ToList())
                        entry.State = EntityState.Detached;
                }
            }

            throw new TestingDomainException(
                "Failed to allocate Report Number sequence.",
                statusCode: 500, code: "report_number_alloc");
        }
        finally
        {
            gate.Release();
        }
    }

    private static bool IsBusinessReportNumberUniqueViolation(DbUpdateException ex)
    {
        var msg = ex.InnerException?.Message ?? ex.Message;
        return msg.Contains("IX_lms_reports_tenant_id_business_report_number", StringComparison.OrdinalIgnoreCase)
               || (msg.Contains("business_report_number", StringComparison.OrdinalIgnoreCase)
                   && msg.Contains("unique", StringComparison.OrdinalIgnoreCase));
    }

    private static bool IsUniqueViolation(DbUpdateException ex)
    {
        var msg = ex.InnerException?.Message ?? ex.Message;
        return msg.Contains("unique", StringComparison.OrdinalIgnoreCase)
               || msg.Contains("duplicate", StringComparison.OrdinalIgnoreCase);
    }

    private sealed record ReportNumberSequenceAllocRow(int Value);

    /// <summary>
    /// PD-REP-DRAFT-UNIQUE-01 — claim ResultVersions for a Draft Report.
    /// When <paramref name="excludeReportId"/> is set, existing claims owned by that Report are kept.
    /// </summary>
    private async Task EnsureDraftSourceClaimsAsync(
        Guid tenantId,
        Guid reportId,
        Guid? excludeReportId,
        IReadOnlyList<ResolvedSource> sources,
        CancellationToken ct)
    {
        var versionIds = sources.Select(s => s.Version.Id).Distinct().ToList();
        var existing = await _db.ReportDraftSourceClaims
            .Where(c => c.TenantId == tenantId && versionIds.Contains(c.ResultVersionId))
            .ToListAsync(ct);

        foreach (var src in sources)
        {
            var claim = existing.FirstOrDefault(c => c.ResultVersionId == src.Version.Id);
            if (claim is null)
            {
                _db.ReportDraftSourceClaims.Add(new LmsReportDraftSourceClaim
                {
                    Id = Guid.NewGuid(),
                    TenantId = tenantId,
                    ResultVersionId = src.Version.Id,
                    ReportId = reportId,
                    ResultId = src.Result.Id,
                    ResultVersionNumber = src.Version.VersionNumber,
                    CreatedAtUtc = DateTime.UtcNow,
                });
                continue;
            }

            if (excludeReportId is Guid owned && claim.ReportId == owned)
                continue;

            throw new TestingDomainException(
                "That ResultVersion is already included in another Draft Report.",
                statusCode: 409, code: "report_source_already_in_draft");
        }
    }

    private static bool IsDraftSourceClaimUniqueViolation(DbUpdateException ex)
    {
        var msg = ex.InnerException?.Message ?? ex.Message;
        return msg.Contains("lms_report_draft_source_claims", StringComparison.OrdinalIgnoreCase)
               || msg.Contains("IX_lms_report_draft_source_claims_tenant_id_result_version_id",
                   StringComparison.OrdinalIgnoreCase)
               || (msg.Contains("unique", StringComparison.OrdinalIgnoreCase)
                   && msg.Contains("result_version_id", StringComparison.OrdinalIgnoreCase));
    }

    private async Task RevertReportAsync(Guid tenantId, Guid reportId, CancellationToken ct)
    {
        var claims = await _db.ReportDraftSourceClaims
            .Where(c => c.TenantId == tenantId && c.ReportId == reportId)
            .ToListAsync(ct);
        _db.ReportDraftSourceClaims.RemoveRange(claims);

        var versions = await _db.ReportVersions
            .Where(v => v.TenantId == tenantId && v.ReportId == reportId)
            .ToListAsync(ct);
        var versionIds = versions.Select(v => v.Id).ToList();
        var sources = await _db.ReportVersionSources
            .Where(s => s.TenantId == tenantId && versionIds.Contains(s.ReportVersionId))
            .ToListAsync(ct);
        _db.ReportVersionSources.RemoveRange(sources);
        _db.ReportVersions.RemoveRange(versions);
        var report = await _db.Reports.FirstOrDefaultAsync(r => r.Id == reportId && r.TenantId == tenantId, ct);
        if (report is not null)
            _db.Reports.Remove(report);
        await _db.SaveChangesAsync(ct);
    }

    private async Task RevertAppendAsync(
        Guid tenantId, Guid reportId, Guid versionId, int previousVersionNumber, int previousRowVersion,
        CancellationToken ct)
    {
        var sources = await _db.ReportVersionSources
            .Where(s => s.TenantId == tenantId && s.ReportVersionId == versionId)
            .ToListAsync(ct);
        _db.ReportVersionSources.RemoveRange(sources);
        var version = await _db.ReportVersions
            .FirstOrDefaultAsync(v => v.Id == versionId && v.TenantId == tenantId, ct);
        if (version is not null)
            _db.ReportVersions.Remove(version);

        var report = await _db.Reports.FirstOrDefaultAsync(r => r.Id == reportId && r.TenantId == tenantId, ct);
        if (report is not null)
        {
            report.CurrentVersionNumber = previousVersionNumber;
            report.RowVersion = previousRowVersion;
            report.UpdatedAtUtc = DateTime.UtcNow;
        }

        await _db.SaveChangesAsync(ct);
    }

    private async Task<(Guid ClaimId, string? ReplayJson)> ClaimIdempotencyAsync(
        Guid tenantId, string key, string operation, string hash, CancellationToken ct)
    {
        var existing = await _db.ReportIdempotencyRecords
            .FirstOrDefaultAsync(r => r.TenantId == tenantId && r.IdempotencyKey == key, ct);

        if (existing is not null)
        {
            if (!string.Equals(existing.RequestHash, hash, StringComparison.Ordinal)
                || !string.Equals(existing.Operation, operation, StringComparison.Ordinal))
                throw new TestingDomainException(
                    "Idempotency key was reused with a different request.",
                    statusCode: 409, code: "idempotency_conflict");

            if (!string.IsNullOrEmpty(existing.ResponseJson))
                return (existing.Id, existing.ResponseJson);

            throw new TestingDomainException(
                "A conflicting in-flight request exists for this idempotency key.",
                statusCode: 409, code: "idempotency_conflict");
        }

        var claim = new LmsReportIdempotencyRecord
        {
            Id = Guid.NewGuid(),
            TenantId = tenantId,
            IdempotencyKey = key,
            Operation = operation,
            RequestHash = hash,
            ReportId = Guid.Empty,
            ResponseJson = string.Empty,
            CreatedAt = DateTime.UtcNow,
        };
        _db.ReportIdempotencyRecords.Add(claim);
        try
        {
            await _db.SaveChangesAsync(ct);
        }
        catch (DbUpdateException)
        {
            var raced = await _db.ReportIdempotencyRecords.AsNoTracking()
                .FirstOrDefaultAsync(r => r.TenantId == tenantId && r.IdempotencyKey == key, ct);
            if (raced is not null
                && string.Equals(raced.RequestHash, hash, StringComparison.Ordinal)
                && string.Equals(raced.Operation, operation, StringComparison.Ordinal)
                && !string.IsNullOrEmpty(raced.ResponseJson))
                return (raced.Id, raced.ResponseJson);

            throw new TestingDomainException(
                "Idempotency key was reused with a different request.",
                statusCode: 409, code: "idempotency_conflict");
        }

        return (claim.Id, null);
    }

    private async Task CompleteIdempotencyAsync(
        Guid tenantId, Guid claimId, Guid reportId, ReportDetailDto dto, CancellationToken ct)
    {
        var row = await _db.ReportIdempotencyRecords
            .FirstAsync(r => r.Id == claimId && r.TenantId == tenantId, ct);
        row.ReportId = reportId;
        row.ResponseJson = JsonSerializer.Serialize(dto, JsonOpts);
        await _db.SaveChangesAsync(ct);
    }

    private async Task TryAbandonIdempotencyAsync(Guid tenantId, Guid claimId, CancellationToken ct)
    {
        try
        {
            var row = await _db.ReportIdempotencyRecords
                .FirstOrDefaultAsync(r => r.Id == claimId && r.TenantId == tenantId, ct);
            if (row is not null && string.IsNullOrEmpty(row.ResponseJson))
            {
                _db.ReportIdempotencyRecords.Remove(row);
                await _db.SaveChangesAsync(ct);
            }
        }
        catch
        {
            // best-effort abandon
        }
    }

    private static ReportDetailDto DeserializeDetail(string json) =>
        JsonSerializer.Deserialize<ReportDetailDto>(json, JsonOpts)
        ?? throw new TestingDomainException(
            "Corrupt idempotency replay payload.", statusCode: 500, code: "idempotency_corrupt");

    private static string HashRequest(object payload)
    {
        var json = JsonSerializer.Serialize(payload, JsonOpts);
        var bytes = SHA256.HashData(Encoding.UTF8.GetBytes(json));
        return Convert.ToHexString(bytes).ToLowerInvariant();
    }
}
