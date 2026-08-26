using Azure.Storage.Blobs;
using Azure.Storage.Blobs.Models;
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
        string stage = "preauth",
        CancellationToken ct = default)
    {
        var coverageCase = await _db.CoverageCases
            .AsNoTracking()
            .FirstOrDefaultAsync(c => c.Id == coverageCaseId && c.DeletedAt == null, ct)
            ?? throw new KeyNotFoundException($"Coverage case {coverageCaseId} not found.");

        // Upload to Azure Blob Storage (Azurite locally)
        var blobUrl = await UploadToBlobAsync(coverageCaseId, fileName, mimeType, fileStream, ct);

        var doc = new CcmsDocument
        {
            Id               = Guid.NewGuid(),
            TenantId         = coverageCase.TenantId,
            CoverageCase_Id  = coverageCaseId,
            DocumentCategory = stage,
            DocumentType     = documentType,
            DocumentName     = fileName,
            BlobUrl          = blobUrl,
            FileSizeBytes    = fileStream.CanSeek ? fileStream.Length : 0,
            MimeType         = mimeType,
            UploadedAt       = DateTime.UtcNow,
            CreatedAt        = DateTime.UtcNow,
            UpdatedAt        = DateTime.UtcNow,
            CreatedByUserId  = actorUserId,
            UpdatedByUserId  = actorUserId,
            Status           = "active"
        };

        _db.Documents.Add(doc);
        await _db.SaveChangesAsync(ct);
        _log.LogInformation("Document {Name} uploaded for case {CaseId}", fileName, coverageCaseId);
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

        var doc = new CcmsDocument
        {
            Id               = Guid.NewGuid(),
            TenantId         = coverageCase.TenantId,
            CoverageCase_Id  = coverageCaseId,
            DocumentCategory = req.Stage,
            DocumentType     = req.DocumentType,
            DocumentName     = req.DocumentName,
            BlobUrl          = req.BlobUrl,
            FileSizeBytes    = req.FileSizeBytes ?? 0,
            MimeType         = req.MimeType,
            UploadedAt       = DateTime.UtcNow,
            CreatedAt        = DateTime.UtcNow,
            UpdatedAt        = DateTime.UtcNow,
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
            q = q.Where(d => d.DocumentCategory == stage);
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

    // ── Private: Azure Blob Storage upload ────────────────────────────────────

    private async Task<string> UploadToBlobAsync(
        Guid caseId, string fileName, string mimeType,
        Stream content, CancellationToken ct)
    {
        var connStr = _config["AzureWebJobsStorage"]
            ?? _config["Values:AzureWebJobsStorage"]
            ?? "UseDevelopmentStorage=true";

        var serviceClient   = new BlobServiceClient(connStr);
        var containerClient = serviceClient.GetBlobContainerClient(ContainerName);
        await containerClient.CreateIfNotExistsAsync(PublicAccessType.None, cancellationToken: ct);

        // Unique blob name: cases/<caseId>/<timestamp>_<filename>
        var blobName   = $"cases/{caseId}/{DateTime.UtcNow:yyyyMMddHHmmss}_{SanitizeName(fileName)}";
        var blobClient = containerClient.GetBlobClient(blobName);

        if (content.CanSeek) content.Seek(0, SeekOrigin.Begin);

        await blobClient.UploadAsync(content, new BlobHttpHeaders { ContentType = mimeType }, cancellationToken: ct);

        return blobClient.Uri.ToString();
    }

    private static string SanitizeName(string name)
        => string.Join("_", name.Split(System.IO.Path.GetInvalidFileNameChars()));

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
