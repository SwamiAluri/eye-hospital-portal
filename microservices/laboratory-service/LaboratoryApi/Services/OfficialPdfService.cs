using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using LaboratoryApi.Data;
using LaboratoryApi.Domain;
using Microsoft.EntityFrameworkCore;

namespace LaboratoryApi.Services;

/// <summary>L-REP-03 CUT C — staff download result (caller must dispose Content).</summary>
public sealed class OfficialPdfDownloadResult : IAsyncDisposable
{
    public required LmsOfficialPdfContentStream Content { get; init; }
    public required string FileName { get; init; }
    public required string ContentType { get; init; }

    public ValueTask DisposeAsync() => Content.DisposeAsync();
}

public interface IOfficialPdfService
{
    Task<OfficialPdfGenerationResponse> GenerateAsync(
        Guid tenantId, Guid actorUserId, Guid reportId, GenerateOfficialPdfRequest req,
        CancellationToken ct = default);

    Task<OfficialPdfJobDto?> GetJobAsync(
        Guid tenantId, Guid actorUserId, Guid reportId, Guid jobId, Guid operatingBranchId,
        CancellationToken ct = default);

    /// <summary>L-REP-03 CUT C — download current Official PDF (audit fail-closed before bytes).</summary>
    Task<OfficialPdfDownloadResult> DownloadAsync(
        Guid tenantId, Guid actorUserId, Guid reportId, Guid operatingBranchId,
        CancellationToken ct = default);

    /// <summary>
    /// L-REP-03 CUT D-B — Option B patient-scoped projection of current Official PDF metadata.
    /// Does not accept client branch as sole authz; does not invent CanonicalDocuments.
    /// </summary>
    Task<IReadOnlyList<PatientCurrentOfficialPdfDocumentDto>> ListPatientCurrentOfficialPdfsAsync(
        Guid tenantId, Guid actorUserId, Guid patientId,
        CancellationToken ct = default);

    /// <summary>Timer drain — claim Pending jobs, render, persist, update pointer on success.</summary>
    Task<int> ProcessPendingJobsAsync(int batchSize = 10, CancellationToken ct = default);

    /// <summary>Technical stale-Running recovery (not a product policy).</summary>
    Task<int> RecoverStaleRunningJobsAsync(CancellationToken ct = default);
}

public sealed class OfficialPdfService : IOfficialPdfService
{
    private static readonly JsonSerializerOptions JsonOpts = new()
    {
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
        PropertyNameCaseInsensitive = true,
    };

    private readonly LaboratoryDbContext _db;
    private readonly IPlatformAuditClient _audit;
    private readonly IPlatformReferenceClient _platform;
    private readonly IOfficialPdfRenderer _renderer;
    private readonly IPlatformCanonicalDocumentClient _canonical;

    public OfficialPdfService(
        LaboratoryDbContext db,
        IPlatformAuditClient audit,
        IPlatformReferenceClient platform,
        IOfficialPdfRenderer renderer,
        IPlatformCanonicalDocumentClient canonical)
    {
        _db = db;
        _audit = audit;
        _platform = platform;
        _renderer = renderer;
        _canonical = canonical;
    }

    public async Task<OfficialPdfGenerationResponse> GenerateAsync(
        Guid tenantId, Guid actorUserId, Guid reportId, GenerateOfficialPdfRequest req,
        CancellationToken ct = default)
    {
        if (req.OperatingBranchId == Guid.Empty)
            throw new TestingDomainException(
                "Operating branch is required.", statusCode: 400, code: "operating_branch_required");
        if (string.IsNullOrWhiteSpace(req.IdempotencyKey))
            throw new TestingDomainException(
                "Idempotency key is required.", statusCode: 400, code: "idempotency_key_required");

        await _platform.ValidateUserBranchAsync(tenantId, actorUserId, req.OperatingBranchId, ct);

        var hash = HashRequest(new { reportId, req.OperatingBranchId });
        var claim = await ClaimIdempotencyAsync(
            tenantId, req.IdempotencyKey, ReportIdempotencyOperations.GenerateOfficialPdf, hash, ct);
        if (claim.ReplayJson is not null)
        {
            var replayed = DeserializeResponse(claim.ReplayJson);
            return replayed with { Replayed = true };
        }

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
                    "Only Released reports can generate an Official PDF.",
                    statusCode: 409, code: "invalid_state");

            if (string.IsNullOrWhiteSpace(report.BusinessReportNumber))
                throw new TestingDomainException(
                    "Business Report Number is required before Official PDF generation.",
                    statusCode: 409, code: "report_number_required");

            // Configuration must exist before accepting generation (fail closed; no invented defaults).
            await EnsureConfigurationExistsAsync(tenantId, ct);

            var active = await _db.ReportOfficialPdfJobs
                .AsNoTracking()
                .FirstOrDefaultAsync(j =>
                    j.TenantId == tenantId
                    && j.ReportId == reportId
                    && (j.Status == OfficialPdfJobStatuses.Pending || j.Status == OfficialPdfJobStatuses.Running), ct);

            if (active is not null)
            {
                var existingDto = await ToJobDtoAsync(tenantId, active.Id, ct);
                var existingResponse = new OfficialPdfGenerationResponse(
                    report.Id, report.Status, report.BusinessReportNumber, existingDto!,
                    Replayed: false, ExistingActiveJob: true);
                await CompleteIdempotencyAsync(tenantId, claim.ClaimId, report.Id, existingResponse, ct);
                return existingResponse;
            }

            var job = new LmsReportOfficialPdfJob
            {
                Id = Guid.NewGuid(),
                TenantId = tenantId,
                OperatingBranchId = report.OperatingBranchId,
                ReportId = report.Id,
                Status = OfficialPdfJobStatuses.Pending,
                RequestedByUserId = actorUserId,
                RequestedAtUtc = DateTime.UtcNow,
                AttemptCount = 0,
                RowVersion = 1,
            };
            _db.ReportOfficialPdfJobs.Add(job);

            try
            {
                await _db.SaveChangesAsync(ct);
            }
            catch (DbUpdateException ex) when (IsActiveJobUniqueViolation(ex))
            {
                var raced = await _db.ReportOfficialPdfJobs.AsNoTracking()
                    .FirstAsync(j =>
                        j.TenantId == tenantId
                        && j.ReportId == reportId
                        && (j.Status == OfficialPdfJobStatuses.Pending || j.Status == OfficialPdfJobStatuses.Running), ct);
                var racedDto = await ToJobDtoAsync(tenantId, raced.Id, ct);
                var racedResponse = new OfficialPdfGenerationResponse(
                    report.Id, report.Status, report.BusinessReportNumber, racedDto!,
                    Replayed: false, ExistingActiveJob: true);
                await CompleteIdempotencyAsync(tenantId, claim.ClaimId, report.Id, racedResponse, ct);
                return racedResponse;
            }

            try
            {
                await _audit.WriteAsync(
                    tenantId, actorUserId,
                    ReportAuditActions.RequestOfficialPdf,
                    ReportAuditResources.LmsReport,
                    report.Id,
                    details:
                    $"reportId={report.Id}; jobId={job.Id}; status={job.Status}; businessReportNumber={report.BusinessReportNumber}; operatingBranchId={req.OperatingBranchId}",
                    ct: ct);
            }
            catch
            {
                _db.ReportOfficialPdfJobs.Remove(job);
                await _db.SaveChangesAsync(ct);
                throw new TestingDomainException(
                    "Audit unavailable. Official PDF generation was not accepted.",
                    statusCode: 503, code: "audit_unavailable");
            }

            var jobDto = await ToJobDtoAsync(tenantId, job.Id, ct);
            var response = new OfficialPdfGenerationResponse(
                report.Id, report.Status, report.BusinessReportNumber, jobDto!,
                Replayed: false, ExistingActiveJob: false);
            await CompleteIdempotencyAsync(tenantId, claim.ClaimId, report.Id, response, ct);
            return response;
        }
        catch
        {
            await TryAbandonIdempotencyAsync(tenantId, claim.ClaimId, ct);
            throw;
        }
    }

    public async Task<OfficialPdfJobDto?> GetJobAsync(
        Guid tenantId, Guid actorUserId, Guid reportId, Guid jobId, Guid operatingBranchId,
        CancellationToken ct = default)
    {
        await _platform.ValidateUserBranchAsync(tenantId, actorUserId, operatingBranchId, ct);
        var report = await _db.Reports.AsNoTracking()
            .FirstOrDefaultAsync(r => r.Id == reportId && r.TenantId == tenantId, ct)
            ?? throw new TestingDomainException("Report not found.", statusCode: 404, code: "not_found");
        if (report.OperatingBranchId != operatingBranchId)
            throw new TestingDomainException(
                "Report is outside the authorized operating branch context.",
                statusCode: 403, code: "branch_unauthorized");

        var job = await _db.ReportOfficialPdfJobs.AsNoTracking()
            .FirstOrDefaultAsync(j => j.Id == jobId && j.TenantId == tenantId && j.ReportId == reportId, ct);
        if (job is null) return null;
        return await ToJobDtoAsync(tenantId, job.Id, ct);
    }

    public async Task<OfficialPdfDownloadResult> DownloadAsync(
        Guid tenantId, Guid actorUserId, Guid reportId, Guid operatingBranchId,
        CancellationToken ct = default)
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

        if (!string.Equals(report.Status, ReportStatuses.Released, StringComparison.Ordinal))
            throw new TestingDomainException(
                "Official PDF download requires a Released Report.",
                statusCode: 409, code: "invalid_state");

        if (string.IsNullOrWhiteSpace(report.BusinessReportNumber))
            throw new TestingDomainException(
                "Business Report Number is required before Official PDF download.",
                statusCode: 409, code: "report_number_required");

        if (report.CurrentOfficialArtifactId is not Guid currentArtifactId)
            throw new TestingDomainException(
                "No current Official PDF artifact is available for download.",
                statusCode: 409, code: "invalid_state");

        var artifact = await _db.ReportOfficialPdfArtifacts.AsNoTracking()
            .FirstOrDefaultAsync(a =>
                a.Id == currentArtifactId
                && a.TenantId == tenantId
                && a.ReportId == reportId, ct)
            ?? throw new TestingDomainException(
                "Current Official PDF artifact was not found.",
                statusCode: 404, code: "not_found");

        if (!string.Equals(artifact.Status, OfficialPdfArtifactStatuses.Succeeded, StringComparison.Ordinal))
            throw new TestingDomainException(
                "Current Official PDF artifact is not available for download.",
                statusCode: 409, code: "invalid_state");

        if (artifact.CanonicalDocumentId is not Guid canonicalDocumentId || canonicalDocumentId == Guid.Empty)
            throw new TestingDomainException(
                "Official PDF content is not available.",
                statusCode: 404, code: "not_found");

        var fileName = $"{report.BusinessReportNumber}.pdf";
        try
        {
            await _audit.WriteAsync(
                tenantId, actorUserId,
                ReportAuditActions.DownloadOfficialPdf,
                ReportAuditResources.LmsReport,
                report.Id,
                details:
                $"reportId={report.Id}; artifactId={artifact.Id}; artifactVersion={artifact.ArtifactVersion}; canonicalDocumentId={canonicalDocumentId}; contentHash={artifact.ContentHash}; operatingBranchId={operatingBranchId}; businessReportNumber={report.BusinessReportNumber}",
                ct: ct);
        }
        catch
        {
            throw new TestingDomainException(
                "Audit unavailable. Official PDF download was not completed.",
                statusCode: 503, code: "audit_unavailable");
        }

        var content = await _canonical.OpenOfficialPdfContentAsync(
            new OpenLmsOfficialPdfContentRequest(tenantId, artifact.Id, canonicalDocumentId), ct);

        return new OfficialPdfDownloadResult
        {
            Content = content,
            FileName = fileName,
            ContentType = string.IsNullOrWhiteSpace(content.ContentType)
                ? "application/pdf"
                : content.ContentType,
        };
    }

    public async Task<IReadOnlyList<PatientCurrentOfficialPdfDocumentDto>> ListPatientCurrentOfficialPdfsAsync(
        Guid tenantId, Guid actorUserId, Guid patientId,
        CancellationToken ct = default)
    {
        if (patientId == Guid.Empty)
            throw new TestingDomainException(
                "Patient is required.", statusCode: 400, code: "patient_required");

        // Candidate reports only — currentness is CurrentOfficialArtifactId (MODEL A), not timestamps/hash.
        var candidates = await _db.Reports.AsNoTracking()
            .Where(r =>
                r.TenantId == tenantId
                && r.PatientId == patientId
                && r.Status == ReportStatuses.Released
                && r.BusinessReportNumber != null
                && r.BusinessReportNumber != ""
                && r.CurrentOfficialArtifactId != null)
            .OrderByDescending(r => r.ReleasedAtUtc)
            .ThenByDescending(r => r.Id)
            .ToListAsync(ct);

        var projected = new List<PatientCurrentOfficialPdfDocumentDto>();
        foreach (var report in candidates)
        {
            // PD-D-BRANCH Option B: server-resolved report branch, then validate user for that branch.
            // Unauthorized branch → omit (fail closed for that report); do not trust client branch.
            try
            {
                await _platform.ValidateUserBranchAsync(
                    tenantId, actorUserId, report.OperatingBranchId, ct);
            }
            catch (OrderDomainException ex) when (ex.StatusCode == 403)
            {
                continue;
            }

            var currentArtifactId = report.CurrentOfficialArtifactId!.Value;
            var artifact = await _db.ReportOfficialPdfArtifacts.AsNoTracking()
                .FirstOrDefaultAsync(a =>
                    a.Id == currentArtifactId
                    && a.TenantId == tenantId
                    && a.ReportId == report.Id, ct);
            if (artifact is null)
                continue;
            if (!string.Equals(artifact.Status, OfficialPdfArtifactStatuses.Succeeded, StringComparison.Ordinal))
                continue;
            if (artifact.CanonicalDocumentId is not Guid canonicalDocumentId || canonicalDocumentId == Guid.Empty)
                continue;

            projected.Add(new PatientCurrentOfficialPdfDocumentDto(
                ReportId: report.Id,
                PatientId: report.PatientId,
                OperatingBranchId: report.OperatingBranchId,
                BusinessReportNumber: report.BusinessReportNumber!,
                ReportStatus: report.Status,
                ArtifactId: artifact.Id,
                ArtifactVersion: artifact.ArtifactVersion,
                CanonicalDocumentId: canonicalDocumentId,
                MimeType: string.IsNullOrWhiteSpace(artifact.MimeType)
                    ? OfficialPdfJobMechanics.MimeTypePdf
                    : artifact.MimeType,
                SizeBytes: artifact.SizeBytes,
                GeneratedAtUtc: artifact.GeneratedAtUtc,
                SourceDomain: "enterprise_lms",
                SourceEntityType: "LmsReportOfficialPdfArtifact"));
        }

        return projected;
    }

    public async Task<int> RecoverStaleRunningJobsAsync(CancellationToken ct = default)
    {
        var cutoff = DateTime.UtcNow - OfficialPdfJobMechanics.StaleRunningTtl;
        var stale = await _db.ReportOfficialPdfJobs
            .Where(j => j.Status == OfficialPdfJobStatuses.Running
                        && j.StartedAtUtc != null
                        && j.StartedAtUtc < cutoff)
            .ToListAsync(ct);

        foreach (var job in stale)
        {
            job.Status = OfficialPdfJobStatuses.Failed;
            job.CompletedAtUtc = DateTime.UtcNow;
            job.FailureCode = "stale_running";
            job.FailureMessage = "Generation exceeded technical Running TTL and was marked Failed.";
            job.RowVersion++;
            try
            {
                await _audit.WriteAsync(
                    job.TenantId, job.RequestedByUserId,
                    ReportAuditActions.OfficialPdfFailed,
                    ReportAuditResources.LmsReport,
                    job.ReportId,
                    details: $"reportId={job.ReportId}; jobId={job.Id}; failureCode=stale_running",
                    ct: ct);
            }
            catch
            {
                // Failure audit best-effort for stale recovery; job already Failed.
            }
        }

        if (stale.Count > 0)
            await _db.SaveChangesAsync(ct);
        return stale.Count;
    }

    public async Task<int> ProcessPendingJobsAsync(int batchSize = 10, CancellationToken ct = default)
    {
        await RecoverStaleRunningJobsAsync(ct);

        var pendingIds = await _db.ReportOfficialPdfJobs.AsNoTracking()
            .Where(j => j.Status == OfficialPdfJobStatuses.Pending)
            .OrderBy(j => j.RequestedAtUtc)
            .Select(j => j.Id)
            .Take(batchSize)
            .ToListAsync(ct);

        var processed = 0;
        foreach (var jobId in pendingIds)
        {
            if (await TryProcessJobAsync(jobId, ct))
                processed++;
        }

        return processed;
    }

    private async Task<bool> TryProcessJobAsync(Guid jobId, CancellationToken ct)
    {
        var job = await _db.ReportOfficialPdfJobs
            .FirstOrDefaultAsync(j => j.Id == jobId, ct);
        if (job is null || job.Status != OfficialPdfJobStatuses.Pending)
            return false;

        job.Status = OfficialPdfJobStatuses.Running;
        job.StartedAtUtc = DateTime.UtcNow;
        job.AttemptCount++;
        job.RowVersion++;
        try
        {
            await _db.SaveChangesAsync(ct);
        }
        catch (DbUpdateConcurrencyException)
        {
            return false;
        }

        try
        {
            await ExecuteGenerationAsync(job, ct);
            return true;
        }
        catch (Exception ex)
        {
            await MarkJobFailedAsync(job, "generation_failed", Truncate(ex.Message, 900), ct);
            return true;
        }
    }

    private async Task ExecuteGenerationAsync(LmsReportOfficialPdfJob job, CancellationToken ct)
    {
        var report = await _db.Reports
            .FirstAsync(r => r.Id == job.ReportId && r.TenantId == job.TenantId, ct);

        // Invariants: never change Release / Number / ReportVersion.
        var statusBefore = report.Status;
        var numberBefore = report.BusinessReportNumber;
        var versionBefore = report.CurrentVersionNumber;
        var previousCurrentArtifact = report.CurrentOfficialArtifactId;

        if (!string.Equals(report.Status, ReportStatuses.Released, StringComparison.Ordinal)
            || string.IsNullOrWhiteSpace(report.BusinessReportNumber))
        {
            await MarkJobFailedAsync(job, "invalid_state", "Report is not Released with a Business Report Number.", ct);
            return;
        }

        LmsReportPdfTemplateVersion template;
        LmsReportPdfSignatory signatory;
        try
        {
            (template, signatory) = await ResolveConfigurationAsync(job.TenantId, ct);
        }
        catch (TestingDomainException ex)
        {
            await MarkJobFailedAsync(job, ex.Code ?? "configuration_missing", ex.Message, ct);
            return;
        }

        var version = await _db.ReportVersions
            .AsNoTracking()
            .FirstAsync(v =>
                v.TenantId == job.TenantId
                && v.ReportId == report.Id
                && v.VersionNumber == report.CurrentVersionNumber, ct);

        var sources = await _db.ReportVersionSources.AsNoTracking()
            .Where(s => s.TenantId == job.TenantId && s.ReportVersionId == version.Id)
            .OrderBy(s => s.ResultId)
            .ToListAsync(ct);

        var orderVersion = await _db.OrderVersions.AsNoTracking()
            .Where(v => v.TenantId == job.TenantId && v.OrderId == report.OrderId)
            .OrderByDescending(v => v.VersionNumber)
            .FirstOrDefaultAsync(ct);

        var patientMrn = orderVersion?.PatientMrnSnapshot?.Trim();
        var patientName = orderVersion?.PatientNameSnapshot?.Trim();
        if (string.IsNullOrWhiteSpace(patientMrn) || string.IsNullOrWhiteSpace(patientName))
        {
            await MarkJobFailedAsync(job, "patient_identity_unavailable",
                "Patient MRN and name are required from order snapshot for Official PDF.", ct);
            return;
        }

        var catalogueIds = sources.Select(s => s.CatalogueVersionId).Distinct().ToList();
        var catalogues = await _db.CatalogueVersions.AsNoTracking()
            .Where(c => c.TenantId == job.TenantId && catalogueIds.Contains(c.Id))
            .ToDictionaryAsync(c => c.Id, ct);

        var authUserIds = sources
            .Where(s => s.AuthorizedByUserId.HasValue)
            .Select(s => s.AuthorizedByUserId!.Value)
            .Distinct()
            .ToList();
        var authNames = new Dictionary<Guid, string>();
        foreach (var uid in authUserIds)
        {
            try
            {
                var user = await _platform.ValidateUserAsync(job.TenantId, uid, ct);
                authNames[uid] = user.DisplayName;
            }
            catch
            {
                authNames[uid] = uid.ToString("D");
            }
        }

        var lines = new List<OfficialPdfLineItem>();
        foreach (var src in sources)
        {
            if (!catalogues.TryGetValue(src.CatalogueVersionId, out var cat))
            {
                await MarkJobFailedAsync(job, "catalogue_version_missing",
                    $"Exact CatalogueVersion {src.CatalogueVersionId:D} was not found.", ct);
                return;
            }

            var resultText = !string.IsNullOrWhiteSpace(src.NumericValue)
                ? src.NumericValue!
                : (src.QualitativeValue ?? string.Empty);

            lines.Add(new OfficialPdfLineItem(
                InternalOrderCode: cat.InternalOrderCode,
                TestDisplayName: cat.DisplayName,
                ResultText: resultText,
                Unit: src.Unit,
                Comment: src.Comment,
                SpecimenId: src.SpecimenId,
                AuthorizedByDisplayName: src.AuthorizedByUserId is Guid aid && authNames.TryGetValue(aid, out var n)
                    ? n
                    : null));
        }

        var model = new OfficialPdfRenderModel(
            HospitalLaboratoryName: template.HospitalLaboratoryName,
            LogoContent: template.LogoContent,
            LogoMimeType: template.LogoMimeType,
            BusinessReportNumber: report.BusinessReportNumber!,
            PatientMrn: patientMrn!,
            PatientName: patientName!,
            Lines: lines,
            SignatoryName: signatory.Name,
            SignatoryCredentialsText: signatory.CredentialsText);

        byte[] pdfBytes;
        try
        {
            pdfBytes = _renderer.Render(model);
        }
        catch (Exception ex)
        {
            await MarkJobFailedAsync(job, "render_failed", Truncate(ex.Message, 900), ct);
            return;
        }

        var contentHash = Convert.ToHexString(SHA256.HashData(pdfBytes)).ToLowerInvariant();
        var nextVersion = await AllocateNextArtifactVersionAsync(job.TenantId, report.Id, ct);
        var artifactId = Guid.NewGuid();

        RegisterLmsOfficialPdfDocumentResponse registration;
        try
        {
            registration = await _canonical.RegisterOfficialPdfAsync(
                new RegisterLmsOfficialPdfDocumentRequest(
                    job.TenantId,
                    report.PatientId,
                    job.RequestedByUserId,
                    artifactId,
                    Convert.ToBase64String(pdfBytes),
                    $"{report.BusinessReportNumber}.pdf",
                    OfficialPdfJobMechanics.MimeTypePdf,
                    contentHash,
                    pdfBytes.LongLength),
                ct);
        }
        catch (TestingDomainException ex)
        {
            await MarkJobFailedAsync(job, ex.Code ?? "canonical_registration_failed", ex.Message, ct);
            return;
        }

        var now = DateTime.UtcNow;
        var artifact = new LmsReportOfficialPdfArtifact
        {
            Id = artifactId,
            TenantId = job.TenantId,
            ReportId = report.Id,
            ReportVersionId = version.Id,
            JobId = job.Id,
            ArtifactVersion = nextVersion,
            Status = OfficialPdfArtifactStatuses.Succeeded,
            MimeType = OfficialPdfJobMechanics.MimeTypePdf,
            SizeBytes = pdfBytes.LongLength,
            ContentHash = contentHash,
            CanonicalDocumentId = registration.CanonicalDocumentId,
            TemplateVersionId = template.Id,
            SignatoryId = signatory.Id,
            GeneratedByUserId = job.RequestedByUserId,
            GeneratedAtUtc = now,
        };
        _db.ReportOfficialPdfArtifacts.Add(artifact);

        var trackedTemplate = await _db.ReportPdfTemplateVersions
            .FirstAsync(t => t.Id == template.Id && t.TenantId == job.TenantId, ct);
        if (!trackedTemplate.IsLocked)
        {
            trackedTemplate.IsLocked = true;
            trackedTemplate.LockedAtUtc = now;
        }

        job.Status = OfficialPdfJobStatuses.Succeeded;
        job.CompletedAtUtc = now;
        job.ArtifactId = artifact.Id;
        job.TemplateVersionId = template.Id;
        job.SignatoryId = signatory.Id;
        job.FailureCode = null;
        job.FailureMessage = null;
        job.RowVersion++;

        report.CurrentOfficialArtifactId = artifact.Id;
        report.UpdatedAtUtc = now;
        // Do not change Status, BusinessReportNumber, CurrentVersionNumber, or RowVersion for PDF.

        await _db.SaveChangesAsync(ct);

        // Post-condition invariants
        if (!string.Equals(report.Status, statusBefore, StringComparison.Ordinal)
            || !string.Equals(report.BusinessReportNumber, numberBefore, StringComparison.Ordinal)
            || report.CurrentVersionNumber != versionBefore)
        {
            throw new InvalidOperationException("Official PDF generation violated Report invariants.");
        }

        if (previousCurrentArtifact is not null
            && report.CurrentOfficialArtifactId != artifact.Id
            && report.CurrentOfficialArtifactId != previousCurrentArtifact)
        {
            // pointer must be new success or unchanged prior; after success it is the new artifact
        }

        try
        {
            await _audit.WriteAsync(
                job.TenantId, job.RequestedByUserId,
                ReportAuditActions.OfficialPdfGenerated,
                ReportAuditResources.LmsReport,
                report.Id,
                details:
                $"reportId={report.Id}; jobId={job.Id}; artifactId={artifact.Id}; artifactVersion={artifact.ArtifactVersion}; canonicalDocumentId={artifact.CanonicalDocumentId}; contentHash={contentHash}",
                ct: ct);
        }
        catch
        {
            // Fail-closed: generation succeeded in storage but audit failed — mark job Failed for ops visibility
            // without unreleasing or clearing a successful artifact that already points as current.
            // Revert pointer to previous current and mark this artifact/job failed for consistency.
            report.CurrentOfficialArtifactId = previousCurrentArtifact;
            artifact.Status = OfficialPdfArtifactStatuses.Failed;
            artifact.FailureCode = "audit_unavailable";
            artifact.FailureMessage = "Success audit unavailable; artifact not official.";
            artifact.CanonicalDocumentId = registration.CanonicalDocumentId;
            job.Status = OfficialPdfJobStatuses.Failed;
            job.FailureCode = "audit_unavailable";
            job.FailureMessage = "Success audit unavailable. Official PDF was not finalized.";
            job.CompletedAtUtc = DateTime.UtcNow;
            job.ArtifactId = artifact.Id;
            await _db.SaveChangesAsync(ct);
            try
            {
                await _audit.WriteAsync(
                    job.TenantId, job.RequestedByUserId,
                    ReportAuditActions.OfficialPdfFailed,
                    ReportAuditResources.LmsReport,
                    report.Id,
                    details: $"reportId={report.Id}; jobId={job.Id}; failureCode=audit_unavailable",
                    ct: ct);
            }
            catch
            {
                // avoid recursive failure loops
            }
        }
    }

    private async Task MarkJobFailedAsync(
        LmsReportOfficialPdfJob job, string code, string message, CancellationToken ct)
    {
        // Reload tracked entity if needed
        var tracked = await _db.ReportOfficialPdfJobs
            .FirstAsync(j => j.Id == job.Id, ct);
        var report = await _db.Reports.FirstAsync(r => r.Id == tracked.ReportId && r.TenantId == tracked.TenantId, ct);
        var previousCurrent = report.CurrentOfficialArtifactId;
        var statusBefore = report.Status;
        var numberBefore = report.BusinessReportNumber;

        tracked.Status = OfficialPdfJobStatuses.Failed;
        tracked.CompletedAtUtc = DateTime.UtcNow;
        tracked.FailureCode = code;
        tracked.FailureMessage = Truncate(message, 1000);
        tracked.RowVersion++;

        // Never change current official pointer on failure.
        report.CurrentOfficialArtifactId = previousCurrent;

        await _db.SaveChangesAsync(ct);

        if (!string.Equals(report.Status, statusBefore, StringComparison.Ordinal)
            || !string.Equals(report.BusinessReportNumber, numberBefore, StringComparison.Ordinal))
        {
            throw new InvalidOperationException("Failed Official PDF path mutated Release/Number invariants.");
        }

        try
        {
            await _audit.WriteAsync(
                tracked.TenantId, tracked.RequestedByUserId,
                ReportAuditActions.OfficialPdfFailed,
                ReportAuditResources.LmsReport,
                tracked.ReportId,
                details:
                $"reportId={tracked.ReportId}; jobId={tracked.Id}; failureCode={code}",
                ct: ct);
        }
        catch
        {
            // best-effort failure audit
        }
    }

    private async Task EnsureConfigurationExistsAsync(Guid tenantId, CancellationToken ct)
    {
        _ = await ResolveConfigurationAsync(tenantId, ct);
    }

    private async Task<(LmsReportPdfTemplateVersion Template, LmsReportPdfSignatory Signatory)>
        ResolveConfigurationAsync(Guid tenantId, CancellationToken ct)
    {
        var now = DateTime.UtcNow;
        var template = await _db.ReportPdfTemplateVersions
            .Where(t => t.TenantId == tenantId && t.IsActive && t.EffectiveFromUtc <= now)
            .OrderByDescending(t => t.EffectiveFromUtc)
            .ThenByDescending(t => t.VersionNumber)
            .FirstOrDefaultAsync(ct);
        if (template is null
            || string.IsNullOrWhiteSpace(template.HospitalLaboratoryName)
            || template.LogoContent is null
            || template.LogoContent.Length == 0)
        {
            throw new TestingDomainException(
                "Governed Official PDF template configuration is missing.",
                statusCode: 409, code: "pdf_template_configuration_missing");
        }

        var signatory = await _db.ReportPdfSignatories
            .Where(s => s.TenantId == tenantId && s.IsActive && s.EffectiveFromUtc <= now)
            .OrderByDescending(s => s.EffectiveFromUtc)
            .FirstOrDefaultAsync(ct);
        if (signatory is null
            || string.IsNullOrWhiteSpace(signatory.Name)
            || string.IsNullOrWhiteSpace(signatory.CredentialsText))
        {
            throw new TestingDomainException(
                "Governed laboratory signatory configuration is missing.",
                statusCode: 409, code: "pdf_signatory_configuration_missing");
        }

        return (template, signatory);
    }

    private async Task<int> AllocateNextArtifactVersionAsync(
        Guid tenantId, Guid reportId, CancellationToken ct)
    {
        // Safe under PD-PDF-14 (one active generation per Report): only one Succeeded path runs at a time.
        // Unique (ReportId, ArtifactVersion) remains the database guard.
        var max = await _db.ReportOfficialPdfArtifacts.AsNoTracking()
            .Where(a => a.TenantId == tenantId && a.ReportId == reportId)
            .Select(a => (int?)a.ArtifactVersion)
            .MaxAsync(ct);
        return (max ?? 0) + 1;
    }

    public async Task<OfficialPdfJobDto?> ToJobDtoAsync(Guid tenantId, Guid jobId, CancellationToken ct)
    {
        var job = await _db.ReportOfficialPdfJobs.AsNoTracking()
            .FirstOrDefaultAsync(j => j.Id == jobId && j.TenantId == tenantId, ct);
        if (job is null) return null;

        OfficialPdfArtifactMetadataDto? artifactDto = null;
        if (job.ArtifactId is Guid aid)
        {
            artifactDto = await ToArtifactDtoAsync(tenantId, aid, ct);
        }

        return new OfficialPdfJobDto(
            job.Id, job.ReportId, job.Status, job.RequestedByUserId, job.RequestedAtUtc,
            job.StartedAtUtc, job.CompletedAtUtc, job.AttemptCount, job.ArtifactId, artifactDto,
            job.FailureCode, job.FailureMessage);
    }

    private async Task<OfficialPdfArtifactMetadataDto?> ToArtifactDtoAsync(
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

    internal async Task AttachOfficialPdfToDetailAsync(
        Guid tenantId, LmsReport report, ReportDetailDto detail, CancellationToken ct)
    {
        // Helper used by ReportService via composition if needed — kept for tests.
        await Task.CompletedTask;
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
        Guid tenantId, Guid claimId, Guid reportId, OfficialPdfGenerationResponse dto, CancellationToken ct)
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
            // best-effort
        }
    }

    private static OfficialPdfGenerationResponse DeserializeResponse(string json) =>
        JsonSerializer.Deserialize<OfficialPdfGenerationResponse>(json, JsonOpts)
        ?? throw new TestingDomainException(
            "Corrupt idempotency replay payload.", statusCode: 500, code: "idempotency_corrupt");

    private static string HashRequest(object payload)
    {
        var json = JsonSerializer.Serialize(payload, JsonOpts);
        return Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(json))).ToLowerInvariant();
    }

    private static bool IsActiveJobUniqueViolation(DbUpdateException ex)
    {
        var msg = ex.InnerException?.Message ?? ex.Message;
        return msg.Contains("IX_lms_report_official_pdf_jobs_one_active", StringComparison.OrdinalIgnoreCase)
               || msg.Contains("one_active", StringComparison.OrdinalIgnoreCase);
    }

    private static string Truncate(string? s, int max) =>
        string.IsNullOrEmpty(s) ? string.Empty : s.Length <= max ? s : s[..max];
}
