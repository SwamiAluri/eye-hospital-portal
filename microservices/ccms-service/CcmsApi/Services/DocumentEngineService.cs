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

    private const string ContainerName = "ccms-documents";

    public DocumentEngineService(
        CcmsDbContext db,
        IConfiguration config,
        ILogger<DocumentEngineService> log)
    {
        _db     = db;
        _config = config;
        _log    = log;
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

        // Upload to Azure Blob Storage (Azurite locally)
        string? uploadedBlobName = null;
        string blobUrl;
        try
        {
            blobUrl = await UploadToBlobAsync(coverageCaseId, documentName, mimeType, fileStream, ct);
            uploadedBlobName = ExtractBlobName(blobUrl);
        }
        catch
        {
            throw;
        }

        var now = DateTime.UtcNow;
        await SoftDeletePriorDocumentsAsync(coverageCaseId, documentType, category, actorUserId, now, ct);
        var doc = new CcmsDocument
        {
            Id               = Guid.NewGuid(),
            TenantId         = coverageCase.TenantId,
            CoverageCase_Id  = coverageCaseId,
            DocumentCategory = category,
            DocumentType     = documentType,
            DocumentName     = documentName,
            BlobUrl          = blobUrl,
            FileSizeBytes    = fileStream.CanSeek ? fileStream.Length : 0,
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
        await SoftDeletePriorDocumentsAsync(
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

    // ── Delete (soft) ─────────────────────────────────────────────────────────

    public async Task DeleteAsync(Guid docId, Guid actorUserId, CancellationToken ct = default)
    {
        var doc = await _db.Documents.FirstOrDefaultAsync(d => d.Id == docId && d.DeletedAt == null, ct)
            ?? throw new KeyNotFoundException($"Document {docId} not found.");
        doc.DeletedAt       = DateTime.UtcNow;
        doc.UpdatedAt       = DateTime.UtcNow;
        doc.UpdatedByUserId = actorUserId;
        await _db.SaveChangesAsync(ct);
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

    private async Task SoftDeletePriorDocumentsAsync(
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
        foreach (var old in prior)
        {
            old.DeletedAt       = now;
            old.UpdatedAt       = now;
            old.UpdatedByUserId = actorUserId;
        }
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
