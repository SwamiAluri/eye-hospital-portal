using Azure.Storage.Blobs;
using Azure.Storage.Blobs.Models;
using Azure.Storage.Sas;
using CcmsApi.Data;
using CcmsApi.Models.Domain;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;

namespace CcmsApi.Services;

public class DocumentEngineService
{
    private readonly CcmsDbContext _db;
    private readonly IConfiguration _config;
    private readonly ILogger<DocumentEngineService> _log;
    private readonly AuthServiceClient? _auth;

    private const string ContainerName = "ccms-documents";

    public DocumentEngineService(
        CcmsDbContext db,
        IConfiguration config,
        ILogger<DocumentEngineService> log,
        AuthServiceClient? auth = null)
    {
        _db     = db;
        _config = config;
        _log    = log;
        _auth   = auth;
    }

    // ── Upload (real file → Blob Storage) ─────────────────────────────────────

    public async Task<CcmsDocument> UploadFileAsync(
        Guid coverageCaseId,
        Guid actorUserId,
        Stream fileStream,
        string fileName,
        string mimeType,
        string documentType,
        string stage = CcmsDocumentStages.Preauth,
        CancellationToken ct = default)
    {
        var category = CcmsDocumentStages.Normalize(stage);
        var documentName = CcmsDocumentFileNames.Resolve(fileName, null, documentType);
        if (fileStream.CanSeek && fileStream.Length <= 0)
            throw new InvalidOperationException("Uploaded file is empty.");

        var coverageCase = await _db.CoverageCases
            .AsNoTracking()
            .FirstOrDefaultAsync(c => c.Id == coverageCaseId && c.DeletedAt == null, ct)
            ?? throw new KeyNotFoundException($"Coverage case {coverageCaseId} not found.");

        // Buffer once: SHA-256 of actual bytes + blob upload (no Azure MD5 identity).
        var bytes = await CcmsCanonicalDocumentRules.ReadAllBytesAsync(fileStream, ct);
        if (bytes.Length == 0)
            throw new InvalidOperationException("Uploaded file is empty.");
        var contentHash = CcmsCanonicalDocumentRules.ComputeSha256Hex(bytes);

        string? uploadedBlobName = null;
        string blobUrl;
        try
        {
            await using var uploadStream = new MemoryStream(bytes, writable: false);
            blobUrl = await UploadToBlobAsync(coverageCaseId, documentName, mimeType, uploadStream, ct);
            uploadedBlobName = ExtractBlobName(blobUrl);
        }
        catch
        {
            throw;
        }

        var now = DateTime.UtcNow;
        var replacedIds = await SoftDeletePriorDocumentsAsync(
            coverageCaseId, documentType, category, actorUserId, now, ct);
        var doc = new CcmsDocument
        {
            Id               = Guid.NewGuid(),
            TenantId         = coverageCase.TenantId,
            CoverageCase_Id  = coverageCaseId,
            DocumentCategory = category,
            DocumentType     = documentType,
            DocumentName     = documentName,
            BlobUrl          = blobUrl,
            FileSizeBytes    = bytes.LongLength,
            MimeType         = mimeType,
            UploadedAt       = now,
            UploadedByUserId = actorUserId,
            CreatedAt        = now,
            UpdatedAt        = now,
            CreatedByUserId  = actorUserId,
            UpdatedByUserId  = actorUserId,
            Status           = "active",
            RowVersion       = 1,
        };

        _db.Documents.Add(doc);
        try
        {
            await _db.SaveChangesAsync(ct);
        }
        catch (Exception ex)
        {
            if (uploadedBlobName is not null)
                await TryDeleteBlobAsync(uploadedBlobName, ct);
            _log.LogError(ex, "Failed to persist document {Type} for case {CaseId}", documentType, coverageCaseId);
            throw;
        }

        // Association lifecycle for replaced rows (CCMS remains SoT; no global canonical delete).
        foreach (var priorId in replacedIds)
            await TryRemoveCanonicalAssociationAsync(coverageCase.TenantId, priorId, ct);

        await TryRegisterCanonicalAsync(
            coverageCase.TenantId,
            coverageCase.PatientId,
            actorUserId,
            doc,
            contentHash,
            uploadedBlobName ?? ExtractBlobName(blobUrl),
            ct);

        _log.LogInformation("Document {Name} uploaded for case {CaseId}", documentName, coverageCaseId);
        return doc;
    }

    // ── Upload (metadata only, file already in Blob Storage) ──────────────────

    public async Task<CcmsDocument> UploadAsync(
        Guid coverageCaseId, Guid actorUserId,
        UploadDocumentRequest req, CancellationToken ct = default)
    {
        var coverageCase = await _db.CoverageCases
            .AsNoTracking()
            .FirstOrDefaultAsync(c => c.Id == coverageCaseId && c.DeletedAt == null, ct)
            ?? throw new KeyNotFoundException($"Coverage case {coverageCaseId} not found.");

        var category = CcmsDocumentStages.Normalize(req.Stage);
        var documentName = CcmsDocumentFileNames.Resolve(null, req.DocumentName, req.DocumentType);
        var now = DateTime.UtcNow;
        var replacedIds = await SoftDeletePriorDocumentsAsync(
            coverageCaseId, req.DocumentType, category, actorUserId, now, ct);

        var doc = new CcmsDocument
        {
            Id               = Guid.NewGuid(),
            TenantId         = coverageCase.TenantId,
            CoverageCase_Id  = coverageCaseId,
            DocumentCategory = category,
            DocumentType     = req.DocumentType,
            DocumentName     = documentName,
            BlobUrl          = req.BlobUrl,
            FileSizeBytes    = req.FileSizeBytes ?? 0,
            MimeType         = req.MimeType,
            UploadedAt       = now,
            UploadedByUserId = actorUserId,
            CreatedAt        = now,
            UpdatedAt        = now,
            CreatedByUserId  = actorUserId,
            UpdatedByUserId  = actorUserId,
            Status           = "active"
        };

        _db.Documents.Add(doc);
        await _db.SaveChangesAsync(ct);

        foreach (var priorId in replacedIds)
            await TryRemoveCanonicalAssociationAsync(coverageCase.TenantId, priorId, ct);

        // JSON/metadata path has no trusted content bytes — do not fabricate a hash.
        // Historical ensure registers when bytes can be streamed later.
        return doc;
    }

    public async Task<CcmsDocument> AttachPacsStudyAsync(
        Guid coverageCaseId,
        Guid actorUserId,
        string studyUid,
        string? accessionNumber = null,
        CancellationToken ct = default)
    {
        if (string.IsNullOrWhiteSpace(studyUid))
            throw new ArgumentException("DICOM study UID is required.");

        var uid = studyUid.Trim();
        var blobUrl = $"pacs://study/{uid}";

        var existing = await _db.Documents
            .FirstOrDefaultAsync(d => d.CoverageCase_Id == coverageCaseId
                                      && d.BlobUrl == blobUrl
                                      && d.DeletedAt == null, ct);
        if (existing is not null)
            return existing;

        var coverageCase = await _db.CoverageCases
            .AsNoTracking()
            .FirstOrDefaultAsync(c => c.Id == coverageCaseId && c.DeletedAt == null, ct)
            ?? throw new KeyNotFoundException($"Coverage case {coverageCaseId} not found.");

        var doc = new CcmsDocument
        {
            Id = Guid.NewGuid(),
            TenantId = coverageCase.TenantId,
            CoverageCase_Id = coverageCaseId,
            DocumentCategory = "claim",
            DocumentType = "dicom_study",
            DocumentName = string.IsNullOrWhiteSpace(accessionNumber)
                ? uid
                : $"{accessionNumber.Trim()} ({uid})",
            BlobUrl = blobUrl,
            FileSizeBytes = 0,
            MimeType = "application/dicom",
            UploadedAt = DateTime.UtcNow,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow,
            CreatedByUserId = actorUserId,
            UpdatedByUserId = actorUserId,
            UploadedByUserId = actorUserId,
            Status = "active",
        };
        _db.Documents.Add(doc);
        await _db.SaveChangesAsync(ct);
        _log.LogInformation("PACS study {StudyUid} attached to case {CaseId}", uid, coverageCaseId);
        return doc;
    }

    /// <summary>
    /// Pointer to an Auth <c>biometry_records</c> row. Does not copy measurements;
    /// Auth remains the biometry SoT. Idempotent on <c>biometry://record/{id}</c>.
    /// </summary>
    public async Task<CcmsDocument> AttachBiometryRecordAsync(
        Guid coverageCaseId,
        Guid actorUserId,
        Guid biometryRecordId,
        string? eye = null,
        DateTime? examinationDate = null,
        decimal? calculatedIol = null,
        string? device = null,
        CancellationToken ct = default)
    {
        if (biometryRecordId == Guid.Empty)
            throw new ArgumentException("Biometry record id is required.");

        var blobUrl = $"biometry://record/{biometryRecordId:D}";

        var existing = await _db.Documents
            .FirstOrDefaultAsync(d => d.CoverageCase_Id == coverageCaseId
                                      && d.BlobUrl == blobUrl
                                      && d.DeletedAt == null, ct);
        if (existing is not null)
            return existing;

        var coverageCase = await _db.CoverageCases
            .AsNoTracking()
            .FirstOrDefaultAsync(c => c.Id == coverageCaseId && c.DeletedAt == null, ct)
            ?? throw new KeyNotFoundException($"Coverage case {coverageCaseId} not found.");

        var doc = new CcmsDocument
        {
            Id = Guid.NewGuid(),
            TenantId = coverageCase.TenantId,
            CoverageCase_Id = coverageCaseId,
            DocumentCategory = "preauth",
            DocumentType = "biometry_record",
            DocumentName = FormatBiometryName(eye, examinationDate, calculatedIol, device),
            BlobUrl = blobUrl,
            FileSizeBytes = 0,
            MimeType = "application/vnd.hospital.biometry",
            UploadedAt = DateTime.UtcNow,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow,
            CreatedByUserId = actorUserId,
            UpdatedByUserId = actorUserId,
            UploadedByUserId = actorUserId,
            Status = "active",
        };
        _db.Documents.Add(doc);
        await _db.SaveChangesAsync(ct);
        _log.LogInformation("Biometry {RecordId} attached to case {CaseId}", biometryRecordId, coverageCaseId);
        return doc;
    }

    public async Task<List<CcmsDocument>> GetByCaseAsync(
        Guid coverageCaseId, string? stage = null, CancellationToken ct = default)
    {
        var q = _db.Documents.AsNoTracking()
            .Where(d => d.CoverageCase_Id == coverageCaseId && d.DeletedAt == null);
        if (!string.IsNullOrEmpty(stage))
            q = q.Where(d => d.DocumentCategory == CcmsDocumentStages.Normalize(stage));
        return await q.OrderByDescending(d => d.CreatedAt).ToListAsync(ct);
    }

    /// <summary>
    /// Patient-id document metadata. Tenant and soft-delete follow the coverage-case
    /// patient read: JWT tenant on both the case and the document. No branch predicate.
    /// Does not open blobs or build access URLs. Order matches <see cref="GetByCaseAsync"/>.
    /// Optionally enriches with canonicalDocumentId via Auth association lookup (no hashing).
    /// </summary>
    public async Task<PagedResult<CcmsDocumentPatientMetadataDto>> ListMetadataByPatientIdAsync(
        Guid tenantId,
        Guid patientId,
        int page = 1,
        int pageSize = 20,
        bool insuranceOnly = false,
        CancellationToken ct = default)
    {
        var (pageNumber, size) = CcmsPatientListPaging.Normalize(page, pageSize);
        var filtered =
            from document in _db.Documents.AsNoTracking()
            join coverageCase in _db.CoverageCases.AsNoTracking()
                on document.CoverageCase_Id equals coverageCase.Id
            where document.TenantId == tenantId
               && coverageCase.TenantId == tenantId
               && coverageCase.PatientId == patientId
               && document.DeletedAt == null
               && coverageCase.DeletedAt == null
            select document;

        if (insuranceOnly)
        {
            // File-backed insurance/intake (+ claims) types; exclude pointer document types.
            var types = new[]
            {
                "id_proof", "insurance_card_front", "insurance_card_back", "policy_document",
                "doctor_referral", "preauth_form", "previous_claims", "other_1", "other_2",
                "authorization_letter", "discharge_summary", "investigation_reports",
                "clinical_notes", "bills",
            };
            filtered = filtered.Where(d =>
                d.Status == "active"
                && types.Contains(d.DocumentType)
                && d.BlobUrl != null
                && !d.BlobUrl.StartsWith("pacs://")
                && !d.BlobUrl.StartsWith("biometry://"));
        }

        var total = await filtered.CountAsync(ct);
        var rows = await filtered
            .OrderByDescending(document => document.CreatedAt)
            .ThenByDescending(document => document.Id)
            .Skip((pageNumber - 1) * size)
            .Take(size)
            .ToListAsync(ct);

        IReadOnlyDictionary<Guid, Guid> canonicalMap = new Dictionary<Guid, Guid>();
        if (_auth is not null && rows.Count > 0)
            canonicalMap = await _auth.LookupCcmsCanonicalIdsAsync(rows.Select(r => r.Id), ct);

        return new PagedResult<CcmsDocumentPatientMetadataDto>(
            rows.Select(d =>
            {
                var isPointer = IsPointerUrl(d.BlobUrl ?? string.Empty)
                                || CcmsCanonicalDocumentRules.IsPointerDocumentType(d.DocumentType);
                canonicalMap.TryGetValue(d.Id, out var canonicalId);
                return new CcmsDocumentPatientMetadataDto(
                    d.Id,
                    d.CoverageCase_Id,
                    d.DocumentName,
                    d.DocumentType,
                    d.DocumentCategory,
                    d.Status,
                    d.CreatedAt,
                    d.UpdatedAt,
                    d.UploadedAt,
                    d.MimeType,
                    d.FileSizeBytes,
                    canonicalId == Guid.Empty ? null : canonicalId,
                    isPointer);
            }).ToList(),
            total,
            pageNumber,
            size);
    }

    /// <summary>
    /// Idempotent/lazy historical ensure: stream CCMS blob bytes, SHA-256, register external + association.
    /// Does not copy into patient-documents. Pointers and unreadable blobs are excluded (no null-hash).
    /// </summary>
    public async Task<Guid?> EnsureCanonicalRegistrationAsync(
        Guid documentId,
        Guid actorUserId,
        CancellationToken ct = default)
    {
        var doc = await _db.Documents.AsNoTracking()
            .FirstOrDefaultAsync(d => d.Id == documentId && d.DeletedAt == null, ct)
            ?? throw new KeyNotFoundException($"Document {documentId} not found.");

        if (!CcmsCanonicalDocumentRules.IsEligibleFileBackedForCanonical(doc.BlobUrl, doc.DocumentType))
        {
            _log.LogInformation(
                "Skipping canonical ensure for pointer/non-file ccmsDocumentId={DocumentId}",
                documentId);
            return null;
        }

        if (_auth is not null)
        {
            var existing = await _auth.LookupCcmsCanonicalIdsAsync(new[] { documentId }, ct);
            if (existing.TryGetValue(documentId, out var known) && known != Guid.Empty)
                return known;
        }

        var coverageCase = await _db.CoverageCases.AsNoTracking()
            .FirstOrDefaultAsync(c => c.Id == doc.CoverageCase_Id && c.DeletedAt == null, ct)
            ?? throw new KeyNotFoundException($"Coverage case {doc.CoverageCase_Id} not found.");

        byte[] bytes;
        try
        {
            var content = await OpenBlobReadStreamAsync(documentId, doc.CoverageCase_Id, ct);
            await using (content.Stream)
            {
                bytes = await CcmsCanonicalDocumentRules.ReadAllBytesAsync(content.Stream, ct);
            }
        }
        catch (Exception ex)
        {
            _log.LogWarning(
                ex,
                "Historical canonical ensure could not stream bytes for ccmsDocumentId={DocumentId}",
                documentId);
            return null;
        }

        if (bytes.Length == 0)
        {
            _log.LogWarning(
                "Historical canonical ensure refused empty bytes for ccmsDocumentId={DocumentId}",
                documentId);
            return null;
        }

        var hash = CcmsCanonicalDocumentRules.ComputeSha256Hex(bytes);
        var objectKey = ExtractBlobName(doc.BlobUrl!);
        var registerAsUserId = actorUserId != Guid.Empty
            ? actorUserId
            : doc.UploadedByUserId ?? doc.CreatedByUserId ?? Guid.Empty;
        return await TryRegisterCanonicalAsync(
            coverageCase.TenantId,
            coverageCase.PatientId,
            registerAsUserId,
            doc,
            hash,
            objectKey,
            ct);
    }

    // ── Delete (soft) ─────────────────────────────────────────────────────────

    public async Task DeleteAsync(Guid docId, Guid actorUserId, CancellationToken ct = default)
    {
        var doc = await _db.Documents.FirstOrDefaultAsync(d => d.Id == docId && d.DeletedAt == null, ct)
            ?? throw new KeyNotFoundException($"Document {docId} not found.");
        doc.DeletedAt       = DateTime.UtcNow;
        doc.UpdatedAt       = DateTime.UtcNow;
        doc.UpdatedByUserId = actorUserId;
        await _db.SaveChangesAsync(ct);
        await TryRemoveCanonicalAssociationAsync(doc.TenantId, doc.Id, ct);
    }

    /// <summary>
    /// Returns a short-lived read SAS for stored blobs, or the pointer URL unchanged for biometry/pacs.
    /// When <paramref name="coverageCaseId"/> is supplied, the document must belong to that case.
    /// </summary>
    public async Task<DocumentAccessUrlResult> GetReadAccessUrlAsync(
        Guid documentId,
        Guid? coverageCaseId = null,
        CancellationToken ct = default)
    {
        var doc = await _db.Documents.AsNoTracking()
            .FirstOrDefaultAsync(d => d.Id == documentId && d.DeletedAt == null, ct)
            ?? throw new KeyNotFoundException($"Document {documentId} not found.");

        if (coverageCaseId is Guid expected && doc.CoverageCase_Id != expected)
            throw new KeyNotFoundException($"Document {documentId} not found for case {expected}.");

        return await BuildAccessUrlResultAsync(doc, ct);
    }

    /// <summary>
    /// Streams blob bytes for preview/download through the CCMS API (JWT-authenticated).
  /// Avoids cross-origin Azurite/CORS issues in the browser PDF viewer.
    /// </summary>
    public async Task<DocumentBlobContent> OpenBlobReadStreamAsync(
        Guid documentId,
        Guid? coverageCaseId = null,
        CancellationToken ct = default)
    {
        var doc = await _db.Documents.AsNoTracking()
            .FirstOrDefaultAsync(d => d.Id == documentId && d.DeletedAt == null, ct)
            ?? throw new KeyNotFoundException($"Document {documentId} not found.");

        if (coverageCaseId is Guid expected && doc.CoverageCase_Id != expected)
            throw new KeyNotFoundException($"Document {documentId} not found for case {expected}.");

        var storedUrl = doc.BlobUrl?.Trim() ?? string.Empty;
        if (string.IsNullOrEmpty(storedUrl))
            throw new InvalidOperationException("Document has no stored location.");

        if (IsPointerUrl(storedUrl))
            throw new InvalidOperationException("Pointer documents cannot be streamed as files.");

        await EnsureBlobExistsAsync(storedUrl, ct);

        var blobName        = ExtractBlobName(storedUrl);
        var serviceClient   = CcmsBlobClients.CreateServiceClient(GetStorageConnectionString());
        var containerClient = serviceClient.GetBlobContainerClient(ContainerName);
        var blobClient      = containerClient.GetBlobClient(blobName);
        var download        = await blobClient.DownloadStreamingAsync(cancellationToken: ct);

        var contentType = !string.IsNullOrWhiteSpace(doc.MimeType)
            ? doc.MimeType!
            : download.Value.Details.ContentType ?? "application/octet-stream";

        return new DocumentBlobContent(
            download.Value.Content,
            contentType,
            doc.DocumentName,
            download.Value.Details.ContentLength);
    }

    /// <summary>Builds a read SAS (or pointer URL) for an already-loaded document row.</summary>
    public DocumentAccessUrlResult BuildAccessUrlResult(CcmsDocument doc)
    {
        var storedUrl = doc.BlobUrl?.Trim() ?? string.Empty;
        if (string.IsNullOrEmpty(storedUrl))
            throw new InvalidOperationException("Document has no stored location.");

        if (IsPointerUrl(storedUrl))
            return new DocumentAccessUrlResult(storedUrl, null, true);

        return new DocumentAccessUrlResult(
            GenerateReadSasUrl(storedUrl),
            DateTimeOffset.UtcNow.AddHours(1),
            false);
    }

    public async Task<DocumentAccessUrlResult> BuildAccessUrlResultAsync(
        CcmsDocument doc,
        CancellationToken ct = default)
    {
        var storedUrl = doc.BlobUrl?.Trim() ?? string.Empty;
        if (string.IsNullOrEmpty(storedUrl))
            throw new InvalidOperationException("Document has no stored location.");

        if (IsPointerUrl(storedUrl))
            return new DocumentAccessUrlResult(storedUrl, null, true);

        await EnsureBlobExistsAsync(storedUrl, ct);
        return BuildAccessUrlResult(doc);
    }

    private async Task EnsureBlobExistsAsync(string blobUrl, CancellationToken ct)
    {
        var blobName = ExtractBlobName(blobUrl);
        var serviceClient   = CcmsBlobClients.CreateServiceClient(GetStorageConnectionString());
        var containerClient = serviceClient.GetBlobContainerClient(ContainerName);
        var blobClient      = containerClient.GetBlobClient(blobName);
        if (!await blobClient.ExistsAsync(ct))
        {
            throw new KeyNotFoundException(
                "Document file is not available in storage. The upload may have been lost or the link is invalid. Please upload the document again.");
        }
    }

    /// <summary>Returns null when SAS cannot be generated (logs warning).</summary>
    public async Task<string?> TryBuildReadAccessUrlAsync(CcmsDocument doc, CancellationToken ct = default)
    {
        try
        {
            var result = await BuildAccessUrlResultAsync(doc, ct);
            return result.Url;
        }
        catch (Exception ex)
        {
            _log.LogWarning(ex, "Could not build read access URL for document {DocumentId}", doc.Id);
            return null;
        }
    }

    private async Task<List<Guid>> SoftDeletePriorDocumentsAsync(
        Guid coverageCaseId,
        string documentType,
        string stage,
        Guid actorUserId,
        DateTime now,
        CancellationToken ct)
    {
        var prior = await _db.Documents
            .Where(d => d.CoverageCase_Id == coverageCaseId
                        && d.DocumentCategory == stage
                        && d.DocumentType == documentType
                        && d.DeletedAt == null)
            .ToListAsync(ct);
        var ids = new List<Guid>(prior.Count);
        foreach (var old in prior)
        {
            old.DeletedAt       = now;
            old.UpdatedAt       = now;
            old.UpdatedByUserId = actorUserId;
            ids.Add(old.Id);
        }
        return ids;
    }

    private async Task<Guid?> TryRegisterCanonicalAsync(
        Guid tenantId,
        Guid patientId,
        Guid userId,
        CcmsDocument doc,
        string contentHash,
        string storageObjectKey,
        CancellationToken ct)
    {
        if (_auth is null)
            return null;
        if (!CcmsCanonicalDocumentRules.IsEligibleFileBackedForCanonical(doc.BlobUrl, doc.DocumentType))
            return null;
        if (string.IsNullOrWhiteSpace(contentHash) || doc.FileSizeBytes <= 0)
        {
            _log.LogWarning(
                "Refusing null/empty-hash canonical registration for ccmsDocumentId={DocumentId}",
                doc.Id);
            return null;
        }

        return await _auth.RegisterCcmsDocumentCanonicalAsync(
            tenantId,
            patientId,
            userId,
            doc.Id,
            contentHash,
            doc.FileSizeBytes,
            doc.DocumentName,
            doc.MimeType ?? "application/octet-stream",
            doc.DocumentType,
            CcmsCanonicalDocumentRules.StorageContainer,
            storageObjectKey,
            ct);
    }

    private async Task TryRemoveCanonicalAssociationAsync(
        Guid tenantId,
        Guid ccmsDocumentId,
        CancellationToken ct)
    {
        if (_auth is null)
            return;
        await _auth.RemoveCcmsDocumentAssociationAsync(tenantId, ccmsDocumentId, ct);
    }

    // ── Private: Azure Blob Storage upload ────────────────────────────────────

    private async Task<string> UploadToBlobAsync(
        Guid caseId, string fileName, string mimeType,
        Stream content, CancellationToken ct)
    {
        var connStr = _config["AzureWebJobsStorage"]
            ?? _config["Values:AzureWebJobsStorage"]
            ?? "UseDevelopmentStorage=true";

        var serviceClient   = CcmsBlobClients.CreateServiceClient(connStr);
        var containerClient = serviceClient.GetBlobContainerClient(ContainerName);
        await containerClient.CreateIfNotExistsAsync(PublicAccessType.None, cancellationToken: ct);

        // Unique blob name: cases/<caseId>/<timestamp>_<filename>
        var blobName   = $"cases/{caseId}/{DateTime.UtcNow:yyyyMMddHHmmss}_{SanitizeName(fileName)}";
        var blobClient = containerClient.GetBlobClient(blobName);

        if (content.CanSeek) content.Seek(0, SeekOrigin.Begin);

        await blobClient.UploadAsync(content, new BlobHttpHeaders { ContentType = mimeType }, cancellationToken: ct);

        return blobClient.Uri.ToString();
    }

    private async Task TryDeleteBlobAsync(string blobName, CancellationToken ct)
    {
        try
        {
            var serviceClient   = CcmsBlobClients.CreateServiceClient(GetStorageConnectionString());
            var containerClient = serviceClient.GetBlobContainerClient(ContainerName);
            await containerClient.GetBlobClient(blobName).DeleteIfExistsAsync(cancellationToken: ct);
        }
        catch (Exception ex)
        {
            _log.LogWarning(ex, "Could not roll back blob {BlobName} after failed document save", blobName);
        }
    }

    private static string SanitizeName(string name)
        => string.Join("_", name.Split(System.IO.Path.GetInvalidFileNameChars()));

    internal static bool IsPointerUrl(string url)
    {
        var u = url.Trim();
        return u.StartsWith("biometry://", StringComparison.OrdinalIgnoreCase)
               || u.StartsWith("pacs://", StringComparison.OrdinalIgnoreCase);
    }

    internal static string ExtractBlobName(string blobUrl)
    {
        var marker = $"/{ContainerName}/";
        var idx = blobUrl.IndexOf(marker, StringComparison.OrdinalIgnoreCase);
        if (idx < 0)
            throw new InvalidOperationException("Unrecognized blob storage URL for this document.");

        var raw = blobUrl[(idx + marker.Length)..];
        var queryIdx = raw.IndexOf('?');
        if (queryIdx >= 0)
            raw = raw[..queryIdx];

        // Uri.ToString() percent-encodes reserved chars (e.g. "(" → "%28") but Azurite/Azure
        // store the blob under the literal key. Decode so GetBlobClient resolves the real object.
        return Uri.UnescapeDataString(raw);
    }

    private string GetStorageConnectionString() =>
        _config["AzureWebJobsStorage"]
        ?? _config["Values:AzureWebJobsStorage"]
        ?? "UseDevelopmentStorage=true";

    private string GenerateReadSasUrl(string blobUrl)
    {
        var blobName = ExtractBlobName(blobUrl);
        var serviceClient   = CcmsBlobClients.CreateServiceClient(GetStorageConnectionString());
        var containerClient = serviceClient.GetBlobContainerClient(ContainerName);
        var blobClient      = containerClient.GetBlobClient(blobName);

        if (!blobClient.CanGenerateSasUri)
            throw new InvalidOperationException("Blob client cannot generate a SAS URI. Check storage credentials.");

        var sas = new BlobSasBuilder
        {
            BlobContainerName = ContainerName,
            BlobName          = blobName,
            Resource          = "b",
            StartsOn          = DateTimeOffset.UtcNow.AddMinutes(-5),
            ExpiresOn         = DateTimeOffset.UtcNow.AddHours(1),
        };
        sas.SetPermissions(BlobSasPermissions.Read);
        return blobClient.GenerateSasUri(sas).ToString();
    }

    internal static string FormatBiometryName(
        string? eye, DateTime? examinationDate, decimal? calculatedIol, string? device)
    {
        var parts = new List<string> { "Biometry print" };
        if (!string.IsNullOrWhiteSpace(eye))
            parts.Add(eye.Trim().ToUpperInvariant());
        if (examinationDate is DateTime d)
            parts.Add(d.ToString("dd MMM yyyy", System.Globalization.CultureInfo.InvariantCulture));
        if (calculatedIol is decimal p)
        {
            var body = p.ToString("0.00", System.Globalization.CultureInfo.InvariantCulture);
            parts.Add(p >= 0 ? $"+{body} D" : $"{body} D");
        }
        if (!string.IsNullOrWhiteSpace(device))
            parts.Add(device.Trim());
        return string.Join(" · ", parts);
    }
}

public record UploadDocumentRequest(
    string  Stage,
    string  DocumentType,
    string  DocumentName,
    string? BlobUrl,
    long?   FileSizeBytes,
    string? MimeType
);

public record AttachPacsStudyRequest(string StudyUid, string? AccessionNumber);

public record AttachBiometryRecordRequest(
    Guid BiometryRecordId,
    string? Eye,
    DateTime? ExaminationDate,
    decimal? CalculatedIol,
    string? Device);

public record DocumentAccessUrlResult(
    string Url,
    DateTimeOffset? ExpiresAt,
    bool IsPointer);

public record DocumentBlobContent(
    Stream Stream,
    string ContentType,
    string FileName,
    long? ContentLength);

/// <summary>Patient 360 metadata. No blob URL, SAS, or storage path.</summary>
public record CcmsDocumentPatientMetadataDto(
    Guid Id,
    Guid CoverageCaseId,
    string DocumentName,
    string DocumentType,
    string DocumentCategory,
    string Status,
    DateTime CreatedAt,
    DateTime UpdatedAt,
    DateTime UploadedAt,
    string? MimeType,
    long FileSizeBytes,
    Guid? CanonicalDocumentId = null,
    bool IsPointer = false);
