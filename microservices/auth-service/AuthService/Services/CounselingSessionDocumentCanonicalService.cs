using System;
using System.IO;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using AuthService.Context;
using AuthService.Models.Counselor;
using AuthService.Models.Domain;
using AuthService.Services.Interfaces;
using Microsoft.AspNetCore.Http;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;

namespace AuthService.Services;

public interface ICounselingSessionDocumentCanonicalService
{
    Task<SessionDocumentDto> UploadAsync(
        Guid tenantId,
        Guid sessionId,
        IFormFile file,
        string? documentType,
        string? documentName,
        Guid userId,
        Guid? expectedPatientId = null,
        CancellationToken cancellationToken = default);

    /// <summary>
    /// Patient 360 Counselling upload — patient-level association, no session.
    /// </summary>
    Task<CanonicalDocumentMetadataDto> UploadPatientLevelAsync(
        Guid tenantId,
        Guid patientId,
        IFormFile file,
        string? documentType,
        Guid userId,
        CancellationToken cancellationToken = default);

    Task<CanonicalDocumentContent?> OpenContentForPatientAsync(
        Guid tenantId,
        Guid patientId,
        Guid canonicalDocumentId,
        CancellationToken cancellationToken = default);
}

/// <summary>
/// Counselling session document upload with shared canonical identity resolution.
/// Ownership: Counselling source row + counselling association; no MPI association.
/// Exact content reuses one CanonicalDocument across domains (no second blob).
/// </summary>
public sealed class CounselingSessionDocumentCanonicalService : ICounselingSessionDocumentCanonicalService
{
    private readonly AppDbContext _db;
    private readonly IBlobStorageService _blob;
    private readonly ICanonicalDocumentIdentityService _identity;
    private readonly ILogger<CounselingSessionDocumentCanonicalService> _log;

    public CounselingSessionDocumentCanonicalService(
        AppDbContext db,
        IBlobStorageService blob,
        ILogger<CounselingSessionDocumentCanonicalService> log,
        ICanonicalDocumentIdentityService identity)
    {
        _db = db;
        _blob = blob;
        _log = log;
        _identity = identity;
    }

    public async Task<SessionDocumentDto> UploadAsync(
        Guid tenantId,
        Guid sessionId,
        IFormFile file,
        string? documentType,
        string? documentName,
        Guid userId,
        Guid? expectedPatientId = null,
        CancellationToken cancellationToken = default)
    {
        if (file is null || file.Length <= 0)
            throw new ArgumentException("No file provided.");
        if (file.Length > CanonicalDocumentFileRules.MaxBytes)
            throw new ArgumentException("File exceeds the 20 MB maximum.");

        if (!CounselingSessionDocumentTypes.TryNormalizeGenericUploadType(documentType, out var type, out var typeError))
            throw new ArgumentException(typeError);

        var session = await _db.CounselingSession.AsNoTracking()
            .FirstOrDefaultAsync(
                s => s.Id == sessionId && s.TenantId == tenantId && s.DeletedAt == null,
                cancellationToken);
        if (session is null)
            throw new KeyNotFoundException("Counseling session not found.");

        if (expectedPatientId is Guid patientId && patientId != Guid.Empty && session.PatientId != patientId)
            throw new UnauthorizedAccessException("Counseling session does not belong to this patient.");

        await using var buffer = new MemoryStream();
        await file.CopyToAsync(buffer, cancellationToken);
        var bytes = buffer.ToArray();
        var displayName = CanonicalDocumentFileRules.SanitizeDisplayName(
            string.IsNullOrWhiteSpace(documentName) ? file.FileName : documentName);
        if (!CanonicalDocumentFileRules.TryDetectMime(bytes, displayName, file.ContentType, out var mime, out var mimeError))
            throw new ArgumentException(mimeError);

        var resolved = await _identity.ResolveOrCreateAsync(
            tenantId,
            session.PatientId,
            userId,
            bytes,
            displayName,
            mime,
            type,
            cancellationToken);

        var sourceDocumentId = Guid.NewGuid();
        var now = DateTime.UtcNow;
        var fileType = Path.GetExtension(displayName).TrimStart('.').ToLowerInvariant();

        var source = new CounselingSessionDocument
        {
            Id = sourceDocumentId,
            TenantId = tenantId,
            SessionId = sessionId,
            DocumentType = type,
            DocumentName = displayName,
            DocumentDescription = null,
            FilePath = CounselingSessionDocumentTypes.CanonicalFilePathMarker(resolved.Document.Id),
            FileType = string.IsNullOrEmpty(fileType) ? null : fileType,
            FileSizeBytes = bytes.LongLength,
            IsVerified = false,
            Status = "active",
            CreatedAt = now,
            CreatedByUserId = userId,
            UpdatedAt = now,
            UpdatedByUserId = userId,
        };

        _db.CounselingSessionDocuments.Add(source);
        await _db.SaveChangesAsync(cancellationToken);

        await _identity.EnsureAssociationAsync(
            resolved.Document.Id,
            CanonicalDocumentAssociations.CounsellingDomain,
            CanonicalDocumentAssociations.CounselingSessionDocumentEntityType,
            sourceDocumentId,
            type,
            userId,
            cancellationToken: cancellationToken);

        return new SessionDocumentDto
        {
            Id = source.Id,
            TenantId = source.TenantId,
            SessionId = source.SessionId,
            DocumentType = source.DocumentType,
            DocumentName = source.DocumentName,
            DocumentDescription = source.DocumentDescription,
            FilePath = source.FilePath,
            FileType = source.FileType,
            FileSizeBytes = source.FileSizeBytes,
            IsVerified = source.IsVerified,
            VerifiedByUserId = source.VerifiedByUserId,
            VerifiedAt = source.VerifiedAt,
            VerificationNotes = source.VerificationNotes,
            Status = source.Status,
            CreatedAt = source.CreatedAt,
            CreatedByUserId = source.CreatedByUserId,
        };
    }

    public async Task<CanonicalDocumentMetadataDto> UploadPatientLevelAsync(
        Guid tenantId,
        Guid patientId,
        IFormFile file,
        string? documentType,
        Guid userId,
        CancellationToken cancellationToken = default)
    {
        if (file is null || file.Length <= 0)
            throw new ArgumentException("No file provided.");
        if (file.Length > CanonicalDocumentFileRules.MaxBytes)
            throw new ArgumentException("File exceeds the 20 MB maximum.");

        if (!CounselingSessionDocumentTypes.TryNormalizeGenericUploadType(documentType, out var type, out var typeError))
            throw new ArgumentException(typeError);

        var patientExists = await _db.Patients.AsNoTracking().AnyAsync(
            p => p.Id == patientId && p.TenantId == tenantId && p.DeletedAt == null,
            cancellationToken);
        if (!patientExists)
            throw new KeyNotFoundException("Patient not found.");

        await using var buffer = new MemoryStream();
        await file.CopyToAsync(buffer, cancellationToken);
        var bytes = buffer.ToArray();
        var displayName = CanonicalDocumentFileRules.SanitizeDisplayName(file.FileName);
        if (!CanonicalDocumentFileRules.TryDetectMime(bytes, displayName, file.ContentType, out var mime, out var mimeError))
            throw new ArgumentException(mimeError);

        var resolved = await _identity.ResolveOrCreateAsync(
            tenantId,
            patientId,
            userId,
            bytes,
            displayName,
            mime,
            type,
            cancellationToken);

        await _identity.EnsureAssociationAsync(
            resolved.Document.Id,
            CanonicalDocumentAssociations.CounsellingDomain,
            CanonicalDocumentAssociations.CounsellingPatientEntityType,
            patientId,
            type,
            userId,
            cancellationToken: cancellationToken);

        var canonical = await _db.CanonicalDocuments.AsNoTracking()
            .FirstAsync(d => d.Id == resolved.Document.Id, cancellationToken);

        return new CanonicalDocumentMetadataDto(
            canonical.Id,
            canonical.PatientId,
            canonical.FileName,
            canonical.MimeType,
            canonical.SizeBytes,
            canonical.Classification,
            canonical.Status,
            canonical.CreatedAt,
            canonical.CreatedByUserId,
            canonical.SupersededByDocumentId);
    }

    public async Task<CanonicalDocumentContent?> OpenContentForPatientAsync(
        Guid tenantId,
        Guid patientId,
        Guid canonicalDocumentId,
        CancellationToken cancellationToken = default)
    {
        var sessionOwned = await (
            from canonical in _db.CanonicalDocuments.AsNoTracking()
            join association in _db.CanonicalDocumentAssociations.AsNoTracking()
                on canonical.Id equals association.DocumentId
            join source in _db.CounselingSessionDocuments.AsNoTracking()
                on association.EntityId equals source.Id
            join session in _db.CounselingSession.AsNoTracking()
                on source.SessionId equals session.Id
            where canonical.Id == canonicalDocumentId
               && canonical.TenantId == tenantId
               && canonical.PatientId == patientId
               && canonical.DeletedAt == null
               && (canonical.Status == CanonicalDocumentStatuses.Active
                   || canonical.Status == CanonicalDocumentStatuses.Superseded)
               && association.Domain == CanonicalDocumentAssociations.CounsellingDomain
               && association.EntityType == CanonicalDocumentAssociations.CounselingSessionDocumentEntityType
               && source.TenantId == tenantId
               && source.DeletedAt == null
               && source.DocumentType != CounselingSessionDocumentTypes.AudioRecording
               && session.TenantId == tenantId
               && session.PatientId == patientId
               && session.DeletedAt == null
            select canonical).FirstOrDefaultAsync(cancellationToken);

        var resolved = sessionOwned ?? await (
            from row in _db.CanonicalDocuments.AsNoTracking()
            join association in _db.CanonicalDocumentAssociations.AsNoTracking()
                on row.Id equals association.DocumentId
            where row.Id == canonicalDocumentId
               && row.TenantId == tenantId
               && row.PatientId == patientId
               && row.DeletedAt == null
               && (row.Status == CanonicalDocumentStatuses.Active
                   || row.Status == CanonicalDocumentStatuses.Superseded)
               && association.Domain == CanonicalDocumentAssociations.CounsellingDomain
               && association.EntityType == CanonicalDocumentAssociations.CounsellingPatientEntityType
               && association.EntityId == patientId
            select row).FirstOrDefaultAsync(cancellationToken);

        if (resolved is null)
            return null;

        if (!string.Equals(resolved.StorageContainer, CanonicalDocumentStorage.ContainerName, StringComparison.Ordinal))
            return null;

        var read = await _blob.OpenReadExactAsync(
            resolved.StorageContainer,
            resolved.StorageObjectKey,
            cancellationToken);
        if (read is null)
            return null;

        return new CanonicalDocumentContent(read.Content, resolved.MimeType, resolved.FileName, read.ContentLength);
    }
}
