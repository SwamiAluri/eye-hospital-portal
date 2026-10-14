using System;
using System.IO;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using AuthService.Context;
using AuthService.Models.Domain;
using AuthService.Services.Interfaces;
using Microsoft.AspNetCore.Http;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;

namespace AuthService.Services;

public sealed class CanonicalDocumentService : ICanonicalDocumentService
{
    private readonly AppDbContext _db;
    private readonly IBlobStorageService _blob;
    private readonly ICanonicalDocumentIdentityService _identity;
    private readonly ILogger<CanonicalDocumentService> _log;

    public CanonicalDocumentService(
        AppDbContext db,
        IBlobStorageService blob,
        ILogger<CanonicalDocumentService> log,
        ICanonicalDocumentIdentityService identity)
    {
        _db = db;
        _blob = blob;
        _log = log;
        _identity = identity;
    }

    public async Task<CanonicalDocumentMetadataDto> UploadGeneralAsync(
        Guid tenantId,
        Guid patientId,
        Guid userId,
        IFormFile file,
        CanonicalDocumentUploadRequest? request = null,
        CancellationToken cancellationToken = default)
    {
        if (file is null || file.Length <= 0)
            throw new ArgumentException("No file provided.");
        if (file.Length > CanonicalDocumentFileRules.MaxBytes)
            throw new ArgumentException("File exceeds the 20 MB maximum.");

        var patientExists = await _db.Patients.AsNoTracking().AnyAsync(
            p => p.Id == patientId && p.TenantId == tenantId && p.DeletedAt == null,
            cancellationToken);
        if (!patientExists)
            throw new KeyNotFoundException("Patient not found.");

        await using var buffer = new MemoryStream();
        await file.CopyToAsync(buffer, cancellationToken);
        var bytes = buffer.ToArray();
        var displayName = CanonicalDocumentFileRules.SanitizeDisplayName(file.FileName);
        if (!CanonicalDocumentFileRules.TryDetectMime(bytes, displayName, file.ContentType, out var mime, out var error))
            throw new ArgumentException(error);

        var classValue = CanonicalDocumentFileRules.NormalizeClassification(request?.Classification);
        var hash = _identity.ComputeContentHash(bytes);
        var resolution = request?.DuplicateResolution?.Trim();

        var candidate = await FindActiveMatchAsync(tenantId, patientId, classValue, hash, cancellationToken);
        if (candidate is not null && string.IsNullOrEmpty(resolution))
        {
            throw new CanonicalDocumentDuplicateException(ToCandidate(candidate, hash));
        }

        CanonicalDocument? replaceTarget = null;
        if (string.Equals(resolution, CanonicalDocumentDuplicateResolutions.Replace, StringComparison.Ordinal))
        {
            if (request?.ReplaceDocumentId is not Guid replaceId || replaceId == Guid.Empty)
                throw new ArgumentException("Replace requires the current document identifier.");
            replaceTarget = await LoadActiveMatchByIdAsync(tenantId, patientId, replaceId, cancellationToken);
            if (replaceTarget is null || !IsMatch(replaceTarget, classValue, hash))
                throw new CanonicalDocumentStaleReplacementException();

            // Release active hash uniqueness before creating/resolving the replacement identity.
            replaceTarget.Status = CanonicalDocumentStatuses.Superseded;
            await _db.SaveChangesAsync(cancellationToken);
        }
        else if (!string.IsNullOrEmpty(resolution) &&
                 !string.Equals(resolution, CanonicalDocumentDuplicateResolutions.KeepBoth, StringComparison.Ordinal))
        {
            throw new ArgumentException("Duplicate resolution is not valid.");
        }

        // Exact content identity: KeepBoth with the same hash reuses one CanonicalDocument (no second blob).
        // Classification-only KeepBoth still creates a new identity when the hash differs.
        var resolved = await _identity.ResolveOrCreateAsync(
            tenantId,
            patientId,
            userId,
            bytes,
            displayName,
            mime,
            classValue,
            cancellationToken);

        await _identity.EnsureAssociationAsync(
            resolved.Document.Id,
            CanonicalDocumentAssociations.MpiDomain,
            CanonicalDocumentAssociations.PatientEntityType,
            patientId,
            "general",
            userId,
            cancellationToken: cancellationToken);

        if (replaceTarget is not null)
        {
            // Reload tracked entity if detached after resolve path.
            var tracked = await _db.CanonicalDocuments
                .FirstAsync(d => d.Id == replaceTarget.Id, cancellationToken);
            tracked.Status = CanonicalDocumentStatuses.Superseded;
            tracked.SupersededByDocumentId = resolved.Document.Id;
            await _db.SaveChangesAsync(cancellationToken);
        }

        var document = await _db.CanonicalDocuments.AsNoTracking()
            .FirstAsync(d => d.Id == resolved.Document.Id, cancellationToken);
        return ToDto(document);
    }

    public async Task<CanonicalDocumentMetadataPage> ListGeneralByPatientAsync(
        Guid tenantId,
        Guid patientId,
        int pageNumber,
        int pageSize,
        CancellationToken cancellationToken = default)
    {
        var patientExists = await _db.Patients.AsNoTracking().AnyAsync(
            p => p.Id == patientId && p.TenantId == tenantId && p.DeletedAt == null,
            cancellationToken);
        if (!patientExists)
            throw new KeyNotFoundException("Patient not found.");

        var (page, size) = FollowupQueryContracts.NormalizePagination(pageNumber, pageSize);
        var filtered =
            from document in _db.CanonicalDocuments.AsNoTracking()
            join association in _db.CanonicalDocumentAssociations.AsNoTracking()
                on document.Id equals association.DocumentId
            where document.TenantId == tenantId
               && document.PatientId == patientId
               && document.DeletedAt == null
               && association.Domain == CanonicalDocumentAssociations.MpiDomain
               && association.EntityType == CanonicalDocumentAssociations.PatientEntityType
               && association.EntityId == patientId
            select document;

        var total = await filtered.CountAsync(cancellationToken);
        var rows = await filtered
            .OrderByDescending(d => d.CreatedAt)
            .ThenByDescending(d => d.Id)
            .Skip((page - 1) * size)
            .Take(size)
            .ToListAsync(cancellationToken);

        return new CanonicalDocumentMetadataPage(
            rows.Select(ToDto).ToList(),
            total,
            page,
            size);
    }

    public async Task<CanonicalDocumentContent?> OpenContentAsync(
        Guid tenantId,
        Guid patientId,
        Guid documentId,
        CancellationToken cancellationToken = default)
    {
        var document = await (
            from row in _db.CanonicalDocuments.AsNoTracking()
            join association in _db.CanonicalDocumentAssociations.AsNoTracking()
                on row.Id equals association.DocumentId
            where row.Id == documentId
               && row.TenantId == tenantId
               && row.PatientId == patientId
               && row.DeletedAt == null
               && (row.Status == CanonicalDocumentStatuses.Active || row.Status == CanonicalDocumentStatuses.Superseded)
               && association.Domain == CanonicalDocumentAssociations.MpiDomain
               && association.EntityType == CanonicalDocumentAssociations.PatientEntityType
               && association.EntityId == patientId
            select row).FirstOrDefaultAsync(cancellationToken);

        if (document is null)
            return null;

        // Source-owned external storage (future CCMS registration) is not opened via MPI download.
        if (!string.Equals(document.StorageContainer, CanonicalDocumentStorage.ContainerName, StringComparison.Ordinal))
            return null;

        var read = await _blob.OpenReadExactAsync(
            document.StorageContainer,
            document.StorageObjectKey,
            cancellationToken);
        if (read is null)
            return null;

        return new CanonicalDocumentContent(read.Content, document.MimeType, document.FileName, read.ContentLength);
    }

    public async Task SoftDeleteGeneralAsync(
        Guid tenantId,
        Guid patientId,
        Guid documentId,
        Guid currentUserId,
        CancellationToken cancellationToken = default)
    {
        var document = await (
            from row in _db.CanonicalDocuments
            join association in _db.CanonicalDocumentAssociations
                on row.Id equals association.DocumentId
            where row.Id == documentId
               && row.TenantId == tenantId
               && row.PatientId == patientId
               && row.DeletedAt == null
               && association.Domain == CanonicalDocumentAssociations.MpiDomain
               && association.EntityType == CanonicalDocumentAssociations.PatientEntityType
               && association.EntityId == patientId
            select row).FirstOrDefaultAsync(cancellationToken);

        if (document is null)
            throw new KeyNotFoundException("Document not found.");

        if (document.CreatedByUserId != currentUserId)
            throw new UnauthorizedAccessException("Only the user who uploaded this document can remove it.");

        // Remove MPI association only; retain shared canonical when other domains still reference it.
        var removed = await _identity.RemoveAssociationAsync(
            tenantId,
            documentId,
            CanonicalDocumentAssociations.MpiDomain,
            CanonicalDocumentAssociations.PatientEntityType,
            patientId,
            cancellationToken);
        if (!removed)
            throw new KeyNotFoundException("Document not found.");
    }

    private async Task<CanonicalDocument?> FindActiveMatchAsync(
        Guid tenantId,
        Guid patientId,
        string classification,
        string hash,
        CancellationToken cancellationToken)
    {
        var active = ActiveMpiQuery(tenantId, patientId);
        var hashMatch = await active
            .Where(d => d.ContentHash == hash)
            .OrderByDescending(d => d.CreatedAt)
            .ThenByDescending(d => d.Id)
            .FirstOrDefaultAsync(cancellationToken);
        if (hashMatch is not null)
            return hashMatch;

        return await active
            .Where(d => d.Classification == classification)
            .OrderByDescending(d => d.CreatedAt)
            .ThenByDescending(d => d.Id)
            .FirstOrDefaultAsync(cancellationToken);
    }

    private Task<CanonicalDocument?> LoadActiveMatchByIdAsync(
        Guid tenantId,
        Guid patientId,
        Guid documentId,
        CancellationToken cancellationToken)
    {
        return ActiveMpiQuery(tenantId, patientId)
            .FirstOrDefaultAsync(d => d.Id == documentId, cancellationToken);
    }

    private IQueryable<CanonicalDocument> ActiveMpiQuery(Guid tenantId, Guid patientId) =>
        from document in _db.CanonicalDocuments
        join association in _db.CanonicalDocumentAssociations
            on document.Id equals association.DocumentId
        where document.TenantId == tenantId
           && document.PatientId == patientId
           && document.DeletedAt == null
           && document.Status == CanonicalDocumentStatuses.Active
           && association.Domain == CanonicalDocumentAssociations.MpiDomain
           && association.EntityType == CanonicalDocumentAssociations.PatientEntityType
           && association.EntityId == patientId
        select document;

    private static bool IsMatch(CanonicalDocument document, string classification, string hash) =>
        string.Equals(document.Classification, classification, StringComparison.Ordinal)
        || string.Equals(document.ContentHash, hash, StringComparison.Ordinal);

    private static CanonicalDocumentDuplicateCandidateDto ToCandidate(CanonicalDocument document, string hash) =>
        new(
            document.Id,
            document.FileName,
            document.Classification,
            document.Status,
            document.CreatedAt,
            string.Equals(document.ContentHash, hash, StringComparison.Ordinal));

    private static CanonicalDocumentMetadataDto ToDto(CanonicalDocument document) => new(
        document.Id,
        document.PatientId,
        document.FileName,
        document.MimeType,
        document.SizeBytes,
        document.Classification,
        document.Status,
        document.CreatedAt,
        document.CreatedByUserId,
        document.SupersededByDocumentId);
}
