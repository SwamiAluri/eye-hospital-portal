using CcmsApi.Data;
using CcmsApi.Models.Domain;
using Microsoft.EntityFrameworkCore;

namespace CcmsApi.Services;

public class DocumentEngineService
{
    private readonly CcmsDbContext _db;

    public DocumentEngineService(CcmsDbContext db) => _db = db;

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
            Id                  = Guid.NewGuid(),
            TenantId            = coverageCase.TenantId,
            CoverageCase_Id     = coverageCaseId,
            DocumentCategory    = req.Stage,
            DocumentType        = req.DocumentType,
            DocumentName        = req.DocumentName,
            BlobUrl             = req.BlobUrl,
            FileSizeBytes       = req.FileSizeBytes ?? 0,
            MimeType            = req.MimeType,
            UploadedAt          = DateTime.UtcNow,
            CreatedAt           = DateTime.UtcNow,
            UpdatedAt           = DateTime.UtcNow,
            CreatedByUserId     = actorUserId,
            UpdatedByUserId     = actorUserId,
            Status              = "active"
        };

        _db.Documents.Add(doc);
        await _db.SaveChangesAsync(ct);
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

    public async Task DeleteAsync(Guid docId, Guid actorUserId, CancellationToken ct = default)
    {
        var doc = await _db.Documents.FirstOrDefaultAsync(d => d.Id == docId && d.DeletedAt == null, ct)
            ?? throw new KeyNotFoundException($"Document {docId} not found.");
        doc.DeletedAt      = DateTime.UtcNow;
        doc.UpdatedAt      = DateTime.UtcNow;
        doc.UpdatedByUserId = actorUserId;
        await _db.SaveChangesAsync(ct);
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
