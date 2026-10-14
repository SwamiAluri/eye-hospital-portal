using AuthService.Models.Domain;
using AuthService.Services;
using AuthService.Services.Interfaces;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using AuthService.Context;

namespace AuthService.Controllers;

/// <summary>
/// Internal service→Auth CanonicalDocument contracts (CCMS register, LMS Official PDF register/content).
/// No SAS / public Blob URLs.
/// </summary>
[ApiController]
[Route("api/internal/canonical-documents")]
public sealed class InternalCanonicalDocumentController : ControllerBase
{
    private readonly ICanonicalDocumentIdentityService _identity;
    private readonly IBlobStorageService _blob;
    private readonly AppDbContext _db;
    private readonly IConfiguration _config;
    private readonly ILogger<InternalCanonicalDocumentController> _log;

    public InternalCanonicalDocumentController(
        ICanonicalDocumentIdentityService identity,
        IBlobStorageService blob,
        AppDbContext db,
        IConfiguration config,
        ILogger<InternalCanonicalDocumentController> log)
    {
        _identity = identity;
        _blob = blob;
        _db = db;
        _config = config;
        _log = log;
    }

    public sealed record RegisterExternalRequest(
        Guid TenantId,
        Guid PatientId,
        Guid UserId,
        Guid CcmsDocumentId,
        string ContentHash,
        long SizeBytes,
        string FileName,
        string MimeType,
        string Classification,
        string StorageContainer,
        string StorageObjectKey,
        string? StorageBackend = null);

    public sealed record RegisterExternalResponse(
        Guid CanonicalDocumentId,
        bool Created,
        Guid AssociationId);

    public sealed record RegisterLmsOfficialPdfRequest(
        Guid TenantId,
        Guid PatientId,
        Guid UserId,
        Guid ArtifactId,
        string ContentBase64,
        string FileName,
        string MimeType,
        string ContentHash,
        long SizeBytes);

    public sealed record RemoveAssociationRequest(Guid TenantId, Guid CcmsDocumentId);

    public sealed record LookupByEntitiesRequest(
        string Domain,
        string EntityType,
        Guid[] EntityIds);

    public sealed record LookupByEntitiesItem(Guid EntityId, Guid CanonicalDocumentId);

    public sealed record LmsOfficialPdfContentRequest(
        Guid TenantId,
        Guid ArtifactId,
        Guid? CanonicalDocumentId = null);

    /// <summary>
    /// Resolve-or-create canonical identity for an existing CCMS blob (no patient-documents copy),
    /// then ensure domain=ccms / entityType=CcmsDocument association.
    /// </summary>
    [HttpPost("register-external")]
    public async Task<IActionResult> RegisterExternal(
        [FromBody] RegisterExternalRequest req,
        CancellationToken cancellationToken)
    {
        if (!IsAuthorized())
            return Unauthorized(new { error = "Invalid or missing internal API key." });

        if (req is null
            || req.TenantId == Guid.Empty
            || req.PatientId == Guid.Empty
            || req.UserId == Guid.Empty
            || req.CcmsDocumentId == Guid.Empty
            || string.IsNullOrWhiteSpace(req.ContentHash)
            || string.IsNullOrWhiteSpace(req.StorageContainer)
            || string.IsNullOrWhiteSpace(req.StorageObjectKey)
            || req.SizeBytes <= 0)
        {
            return BadRequest(new { error = "tenantId, patientId, userId, ccmsDocumentId, contentHash, sizeBytes, and storage location are required." });
        }

        try
        {
            var resolve = await _identity.ResolveOrCreateExternalAsync(
                req.TenantId,
                req.PatientId,
                req.UserId,
                req.ContentHash.Trim().ToLowerInvariant(),
                req.SizeBytes,
                req.FileName ?? "document",
                string.IsNullOrWhiteSpace(req.MimeType) ? "application/octet-stream" : req.MimeType,
                string.IsNullOrWhiteSpace(req.Classification) ? "general" : req.Classification,
                string.IsNullOrWhiteSpace(req.StorageBackend)
                    ? CanonicalDocumentStorage.BackendAzureBlob
                    : req.StorageBackend!,
                req.StorageContainer,
                req.StorageObjectKey,
                cancellationToken);

            var association = await _identity.EnsureAssociationAsync(
                resolve.Document.Id,
                CanonicalDocumentAssociations.CcmsDomain,
                CanonicalDocumentAssociations.CcmsDocumentEntityType,
                req.CcmsDocumentId,
                string.IsNullOrWhiteSpace(req.Classification) ? "general" : req.Classification.Trim(),
                req.UserId,
                role: "primary",
                cancellationToken);

            _log.LogInformation(
                "CCMS canonical register-external: ccmsDocumentId={CcmsDocumentId} canonicalDocumentId={CanonicalDocumentId} created={Created}",
                req.CcmsDocumentId,
                resolve.Document.Id,
                resolve.Created);

            return Ok(new RegisterExternalResponse(resolve.Document.Id, resolve.Created, association.Id));
        }
        catch (ArgumentException ex)
        {
            _log.LogWarning(ex, "CCMS canonical register-external rejected for ccmsDocumentId={CcmsDocumentId}", req.CcmsDocumentId);
            return BadRequest(new { error = "Invalid registration payload." });
        }
        catch (Exception ex)
        {
            _log.LogError(ex, "CCMS canonical register-external failed for ccmsDocumentId={CcmsDocumentId}", req.CcmsDocumentId);
            return StatusCode(StatusCodes.Status500InternalServerError, new { error = "Canonical registration failed." });
        }
    }

    /// <summary>
    /// L-REP-03 CUT B — register Official PDF bytes into private Blob + CanonicalDocument,
    /// associated as enterprise_lms / LmsReportOfficialPdfArtifact (never Pathology lab/LabReport).
    /// </summary>
    [HttpPost("register-lms-official-pdf")]
    public async Task<IActionResult> RegisterLmsOfficialPdf(
        [FromBody] RegisterLmsOfficialPdfRequest req,
        CancellationToken cancellationToken)
    {
        if (!IsAuthorized())
            return Unauthorized(new { error = "Invalid or missing internal API key." });

        if (req is null
            || req.TenantId == Guid.Empty
            || req.PatientId == Guid.Empty
            || req.UserId == Guid.Empty
            || req.ArtifactId == Guid.Empty
            || string.IsNullOrWhiteSpace(req.ContentBase64)
            || string.IsNullOrWhiteSpace(req.ContentHash)
            || req.SizeBytes <= 0)
        {
            return BadRequest(new
            {
                error = "tenantId, patientId, userId, artifactId, contentBase64, contentHash, and sizeBytes are required.",
            });
        }

        byte[] bytes;
        try
        {
            bytes = Convert.FromBase64String(req.ContentBase64);
        }
        catch (FormatException)
        {
            return BadRequest(new { error = "contentBase64 is invalid." });
        }

        if (bytes.Length == 0 || bytes.LongLength != req.SizeBytes)
            return BadRequest(new { error = "content size mismatch." });

        var computed = _identity.ComputeContentHash(bytes);
        if (!string.Equals(computed, req.ContentHash.Trim(), StringComparison.OrdinalIgnoreCase))
            return BadRequest(new { error = "contentHash mismatch." });

        try
        {
            var resolve = await _identity.ResolveOrCreateAsync(
                req.TenantId,
                req.PatientId,
                req.UserId,
                bytes,
                string.IsNullOrWhiteSpace(req.FileName) ? "official-report.pdf" : req.FileName.Trim(),
                string.IsNullOrWhiteSpace(req.MimeType) ? "application/pdf" : req.MimeType.Trim(),
                classification: "LmsOfficialPdf",
                cancellationToken);

            var association = await _identity.EnsureAssociationAsync(
                resolve.Document.Id,
                CanonicalDocumentAssociations.EnterpriseLmsDomain,
                CanonicalDocumentAssociations.LmsReportOfficialPdfArtifactEntityType,
                req.ArtifactId,
                category: "LmsOfficialPdf",
                req.UserId,
                role: "primary",
                cancellationToken);

            _log.LogInformation(
                "LMS Official PDF canonical register: artifactId={ArtifactId} canonicalDocumentId={CanonicalDocumentId} created={Created}",
                req.ArtifactId,
                resolve.Document.Id,
                resolve.Created);

            return Ok(new RegisterExternalResponse(resolve.Document.Id, resolve.Created, association.Id));
        }
        catch (ArgumentException ex)
        {
            _log.LogWarning(ex, "LMS Official PDF canonical register rejected for artifactId={ArtifactId}", req.ArtifactId);
            return BadRequest(new { error = "Invalid registration payload." });
        }
        catch (Exception ex)
        {
            _log.LogError(ex, "LMS Official PDF canonical register failed for artifactId={ArtifactId}", req.ArtifactId);
            return StatusCode(StatusCodes.Status500InternalServerError, new { error = "Canonical registration failed." });
        }
    }

    /// <summary>
    /// Removes only the CCMS association for a soft-deleted/replaced CcmsDocument.
    /// Does not globally delete a canonical document still referenced elsewhere.
    /// </summary>
    [HttpPost("remove-association")]
    public async Task<IActionResult> RemoveAssociation(
        [FromBody] RemoveAssociationRequest req,
        CancellationToken cancellationToken)
    {
        if (!IsAuthorized())
            return Unauthorized(new { error = "Invalid or missing internal API key." });

        if (req is null || req.TenantId == Guid.Empty || req.CcmsDocumentId == Guid.Empty)
            return BadRequest(new { error = "tenantId and ccmsDocumentId are required." });

        try
        {
            var links = await _db.CanonicalDocumentAssociations
                .AsNoTracking()
                .Where(a =>
                    a.Domain == CanonicalDocumentAssociations.CcmsDomain
                    && a.EntityType == CanonicalDocumentAssociations.CcmsDocumentEntityType
                    && a.EntityId == req.CcmsDocumentId)
                .Select(a => new { a.DocumentId })
                .ToListAsync(cancellationToken);

            var removed = 0;
            foreach (var link in links)
            {
                if (await _identity.RemoveAssociationAsync(
                        req.TenantId,
                        link.DocumentId,
                        CanonicalDocumentAssociations.CcmsDomain,
                        CanonicalDocumentAssociations.CcmsDocumentEntityType,
                        req.CcmsDocumentId,
                        cancellationToken))
                {
                    removed++;
                }
            }

            _log.LogInformation(
                "CCMS canonical remove-association: ccmsDocumentId={CcmsDocumentId} removed={Removed}",
                req.CcmsDocumentId,
                removed);

            return Ok(new { success = true, removed });
        }
        catch (Exception ex)
        {
            _log.LogError(ex, "CCMS canonical remove-association failed for ccmsDocumentId={CcmsDocumentId}", req.CcmsDocumentId);
            return StatusCode(StatusCodes.Status500InternalServerError, new { error = "Association removal failed." });
        }
    }

    /// <summary>
    /// L-REP-03 CUT C — stream LMS Official PDF bytes for LaboratoryApi after association gates.
    /// Association: enterprise_lms / LmsReportOfficialPdfArtifact / EntityId = artifactId.
    /// Internal only — never SAS / public URL / browser-facing resource authority.
    /// </summary>
    [HttpPost("lms-official-pdf/content")]
    public async Task<IActionResult> OpenLmsOfficialPdfContent(
        [FromBody] LmsOfficialPdfContentRequest req,
        CancellationToken cancellationToken)
    {
        if (!IsAuthorized())
            return Unauthorized(new { error = "Invalid or missing internal API key." });

        if (req is null || req.TenantId == Guid.Empty || req.ArtifactId == Guid.Empty)
            return BadRequest(new { error = "tenantId and artifactId are required." });

        if (!Request.Headers.TryGetValue("X-Tenant-ID", out var tenantHeader)
            || !Guid.TryParse(tenantHeader.ToString(), out var headerTenant)
            || headerTenant != req.TenantId)
        {
            return BadRequest(new { error = "X-Tenant-ID must match tenantId.", code = "tenant_mismatch" });
        }

        var document = await (
            from association in _db.CanonicalDocumentAssociations.AsNoTracking()
            join doc in _db.CanonicalDocuments.AsNoTracking() on association.DocumentId equals doc.Id
            where association.Domain == CanonicalDocumentAssociations.EnterpriseLmsDomain
                  && association.EntityType == CanonicalDocumentAssociations.LmsReportOfficialPdfArtifactEntityType
                  && association.EntityId == req.ArtifactId
                  && doc.TenantId == req.TenantId
                  && doc.DeletedAt == null
                  && (doc.Status == CanonicalDocumentStatuses.Active
                      || doc.Status == CanonicalDocumentStatuses.Superseded)
            select doc).FirstOrDefaultAsync(cancellationToken);

        if (document is null)
            return NotFound(new { error = "LMS Official PDF content not found.", code = "not_found" });

        if (req.CanonicalDocumentId is Guid expectedDocId && expectedDocId != Guid.Empty
            && expectedDocId != document.Id)
        {
            return BadRequest(new { error = "canonicalDocumentId mismatch.", code = "canonical_mismatch" });
        }

        if (!string.Equals(document.StorageContainer, CanonicalDocumentStorage.ContainerName, StringComparison.Ordinal))
            return StatusCode(StatusCodes.Status503ServiceUnavailable,
                new { error = "Unexpected storage container.", code = "storage_unavailable" });

        var read = await _blob.OpenReadExactAsync(
            document.StorageContainer,
            document.StorageObjectKey,
            cancellationToken);
        if (read is null)
            return StatusCode(StatusCodes.Status503ServiceUnavailable,
                new { error = "Blob content unavailable.", code = "storage_unavailable" });

        var fileName = string.IsNullOrWhiteSpace(document.FileName) ? "official-report.pdf" : document.FileName;
        return File(read.Content, document.MimeType, fileName);
    }

    /// <summary>
    /// Batch lookup of canonical document ids for CCMS entity associations (no hashing).
    /// </summary>
    [HttpPost("lookup-by-entities")]
    public async Task<IActionResult> LookupByEntities(
        [FromBody] LookupByEntitiesRequest req,
        CancellationToken cancellationToken)
    {
        if (!IsAuthorized())
            return Unauthorized(new { error = "Invalid or missing internal API key." });

        if (req is null
            || string.IsNullOrWhiteSpace(req.Domain)
            || string.IsNullOrWhiteSpace(req.EntityType)
            || req.EntityIds is null
            || req.EntityIds.Length == 0)
        {
            return BadRequest(new { error = "domain, entityType, and entityIds are required." });
        }

        var ids = req.EntityIds.Where(id => id != Guid.Empty).Distinct().Take(200).ToArray();
        if (ids.Length == 0)
            return Ok(new { items = Array.Empty<LookupByEntitiesItem>() });

        var items = await (
            from a in _db.CanonicalDocumentAssociations.AsNoTracking()
            join d in _db.CanonicalDocuments.AsNoTracking() on a.DocumentId equals d.Id
            where a.Domain == req.Domain
                  && a.EntityType == req.EntityType
                  && ids.Contains(a.EntityId)
                  && d.DeletedAt == null
                  && d.Status == CanonicalDocumentStatuses.Active
            select new LookupByEntitiesItem(a.EntityId, a.DocumentId)
        ).ToListAsync(cancellationToken);

        return Ok(new { items });
    }

    private bool IsAuthorized()
    {
        Request.Headers.TryGetValue("X-Internal-Key", out var provided);
        var expected = _config["InternalApi:Key"]
            ?? _config["InternalApiKey"]
            ?? _config["AuthService:InternalApiKey"]
            ?? string.Empty;
        if (string.IsNullOrWhiteSpace(expected))
        {
            _log.LogWarning("InternalApi key is not configured — rejecting canonical-documents call.");
            return false;
        }

        return string.Equals(provided.ToString(), expected, StringComparison.Ordinal);
    }
}
