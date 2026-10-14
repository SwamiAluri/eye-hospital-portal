using System;
using System.IO;
using System.Linq;
using System.Security.Cryptography;
using System.Threading;
using System.Threading.Tasks;
using AuthService.Context;
using AuthService.Models.Domain;
using AuthService.Services.Interfaces;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;

namespace AuthService.Services;

public sealed class CanonicalDocumentIdentityService : ICanonicalDocumentIdentityService
{
    private readonly AppDbContext _db;
    private readonly IBlobStorageService _blob;
    private readonly ILogger<CanonicalDocumentIdentityService> _log;

    public CanonicalDocumentIdentityService(
        AppDbContext db,
        IBlobStorageService blob,
        ILogger<CanonicalDocumentIdentityService> log)
    {
        _db = db;
        _blob = blob;
        _log = log;
    }

    public string ComputeContentHash(byte[] content)
    {
        if (content is null || content.Length == 0)
            throw new ArgumentException("Content is required to compute a hash.");
        return Convert.ToHexString(SHA256.HashData(content)).ToLowerInvariant();
    }

    public async Task<CanonicalDocumentResolveResult> ResolveOrCreateAsync(
        Guid tenantId,
        Guid patientId,
        Guid userId,
        byte[] content,
        string fileName,
        string mimeType,
        string classification,
        CancellationToken cancellationToken = default)
    {
        if (content is null || content.Length == 0)
            throw new ArgumentException("Content is required.");
        if (string.IsNullOrWhiteSpace(mimeType))
            throw new ArgumentException("MIME type is required.");

        var hash = ComputeContentHash(content);
        var existing = await FindActiveByHashAsync(tenantId, patientId, hash, cancellationToken);
        if (existing is not null)
            return new CanonicalDocumentResolveResult(existing, Created: false, BlobUploaded: false);

        var documentId = Guid.NewGuid();
        var now = DateTime.UtcNow;
        var objectKey = CanonicalDocumentStorage.ObjectKey(tenantId, documentId);
        var displayName = CanonicalDocumentFileRules.SanitizeDisplayName(fileName);

        await using var stream = new MemoryStream(content, writable: false);
        try
        {
            await _blob.UploadExactKeyAsync(
                CanonicalDocumentStorage.ContainerName,
                objectKey,
                stream,
                mimeType,
                cancellationToken);
        }
        catch (Exception ex)
        {
            _log.LogError(ex, "Canonical identity blob upload failed.");
            throw;
        }

        var document = new CanonicalDocument
        {
            Id = documentId,
            TenantId = tenantId,
            PatientId = patientId,
            StorageBackend = CanonicalDocumentStorage.BackendAzureBlob,
            StorageContainer = CanonicalDocumentStorage.ContainerName,
            StorageObjectKey = objectKey,
            FileName = displayName,
            MimeType = mimeType,
            SizeBytes = content.LongLength,
            ContentHash = hash,
            Classification = string.IsNullOrWhiteSpace(classification) ? "general" : classification.Trim(),
            Status = CanonicalDocumentStatuses.Active,
            CreatedByUserId = userId,
            CreatedAt = now,
        };

        _db.CanonicalDocuments.Add(document);
        try
        {
            await _db.SaveChangesAsync(cancellationToken);
            return new CanonicalDocumentResolveResult(document, Created: true, BlobUploaded: true);
        }
        catch (DbUpdateException ex) when (IsLikelyUniqueConflict(ex))
        {
            _db.Entry(document).State = EntityState.Detached;
            await CompensateBlobAsync(CanonicalDocumentStorage.ContainerName, objectKey, cancellationToken);
            var winner = await FindActiveByHashAsync(tenantId, patientId, hash, cancellationToken)
                ?? throw new InvalidOperationException(
                    "Canonical document uniqueness conflict could not be resolved.", ex);
            return new CanonicalDocumentResolveResult(winner, Created: false, BlobUploaded: false);
        }
        catch
        {
            await CompensateBlobAsync(CanonicalDocumentStorage.ContainerName, objectKey, cancellationToken);
            throw;
        }
    }

    public async Task<CanonicalDocumentResolveResult> ResolveOrCreateExternalAsync(
        Guid tenantId,
        Guid patientId,
        Guid userId,
        string contentHash,
        long sizeBytes,
        string fileName,
        string mimeType,
        string classification,
        string storageBackend,
        string storageContainer,
        string storageObjectKey,
        CancellationToken cancellationToken = default)
    {
        if (string.IsNullOrWhiteSpace(contentHash))
            throw new ArgumentException("Content hash is required.");
        if (string.IsNullOrWhiteSpace(storageContainer) || string.IsNullOrWhiteSpace(storageObjectKey))
            throw new ArgumentException("External storage location is required.");
        if (string.Equals(storageContainer, CanonicalDocumentStorage.ContainerName, StringComparison.OrdinalIgnoreCase)
            && !string.Equals(storageBackend, CanonicalDocumentStorage.BackendAzureBlob, StringComparison.OrdinalIgnoreCase))
        {
            // Allowed; external is typically a different container (e.g. ccms-documents).
        }

        var hash = contentHash.Trim().ToLowerInvariant();
        var existing = await FindActiveByHashAsync(tenantId, patientId, hash, cancellationToken);
        if (existing is not null)
            return new CanonicalDocumentResolveResult(existing, Created: false, BlobUploaded: false);

        var documentId = Guid.NewGuid();
        var document = new CanonicalDocument
        {
            Id = documentId,
            TenantId = tenantId,
            PatientId = patientId,
            StorageBackend = string.IsNullOrWhiteSpace(storageBackend)
                ? CanonicalDocumentStorage.BackendAzureBlob
                : storageBackend.Trim(),
            StorageContainer = storageContainer.Trim(),
            StorageObjectKey = storageObjectKey.Trim(),
            FileName = CanonicalDocumentFileRules.SanitizeDisplayName(fileName),
            MimeType = mimeType,
            SizeBytes = sizeBytes,
            ContentHash = hash,
            Classification = string.IsNullOrWhiteSpace(classification) ? "general" : classification.Trim(),
            Status = CanonicalDocumentStatuses.Active,
            CreatedByUserId = userId,
            CreatedAt = DateTime.UtcNow,
        };

        _db.CanonicalDocuments.Add(document);
        try
        {
            await _db.SaveChangesAsync(cancellationToken);
            return new CanonicalDocumentResolveResult(document, Created: true, BlobUploaded: false);
        }
        catch (DbUpdateException ex) when (IsLikelyUniqueConflict(ex))
        {
            _db.Entry(document).State = EntityState.Detached;
            var winner = await FindActiveByHashAsync(tenantId, patientId, hash, cancellationToken)
                ?? throw new InvalidOperationException(
                    "Canonical document uniqueness conflict could not be resolved.", ex);
            return new CanonicalDocumentResolveResult(winner, Created: false, BlobUploaded: false);
        }
    }

    public async Task<CanonicalDocumentAssociation> EnsureAssociationAsync(
        Guid documentId,
        string domain,
        string entityType,
        Guid entityId,
        string category,
        Guid userId,
        string role = "primary",
        CancellationToken cancellationToken = default)
    {
        if (string.IsNullOrWhiteSpace(domain) || string.IsNullOrWhiteSpace(entityType))
            throw new ArgumentException("Association domain and entity type are required.");

        var existing = await _db.CanonicalDocumentAssociations
            .FirstOrDefaultAsync(
                a => a.DocumentId == documentId
                     && a.Domain == domain
                     && a.EntityType == entityType
                     && a.EntityId == entityId,
                cancellationToken);
        if (existing is not null)
            return existing;

        var association = new CanonicalDocumentAssociation
        {
            Id = Guid.NewGuid(),
            DocumentId = documentId,
            Domain = domain.Trim(),
            EntityType = entityType.Trim(),
            EntityId = entityId,
            Category = string.IsNullOrWhiteSpace(category) ? "general" : category.Trim(),
            Role = string.IsNullOrWhiteSpace(role) ? "primary" : role.Trim(),
            CreatedByUserId = userId,
            CreatedAt = DateTime.UtcNow,
        };

        _db.CanonicalDocumentAssociations.Add(association);
        try
        {
            await _db.SaveChangesAsync(cancellationToken);
            return association;
        }
        catch (DbUpdateException ex) when (IsLikelyUniqueConflict(ex))
        {
            _db.Entry(association).State = EntityState.Detached;
            return await _db.CanonicalDocumentAssociations
                       .FirstAsync(
                           a => a.DocumentId == documentId
                                && a.Domain == domain
                                && a.EntityType == entityType
                                && a.EntityId == entityId,
                           cancellationToken);
        }
    }

    public async Task<bool> RemoveAssociationAsync(
        Guid tenantId,
        Guid documentId,
        string domain,
        string entityType,
        Guid entityId,
        CancellationToken cancellationToken = default)
    {
        var document = await _db.CanonicalDocuments
            .FirstOrDefaultAsync(
                d => d.Id == documentId && d.TenantId == tenantId && d.DeletedAt == null,
                cancellationToken);
        if (document is null)
            return false;

        var association = await _db.CanonicalDocumentAssociations
            .FirstOrDefaultAsync(
                a => a.DocumentId == documentId
                     && a.Domain == domain
                     && a.EntityType == entityType
                     && a.EntityId == entityId,
                cancellationToken);
        if (association is null)
            return false;

        _db.CanonicalDocumentAssociations.Remove(association);

        var remaining = await _db.CanonicalDocumentAssociations
            .CountAsync(a => a.DocumentId == documentId && a.Id != association.Id, cancellationToken);
        if (remaining == 0)
            document.DeletedAt = DateTime.UtcNow;

        await _db.SaveChangesAsync(cancellationToken);
        return true;
    }

    private Task<CanonicalDocument?> FindActiveByHashAsync(
        Guid tenantId,
        Guid patientId,
        string hash,
        CancellationToken cancellationToken) =>
        _db.CanonicalDocuments
            .Where(d =>
                d.TenantId == tenantId
                && d.PatientId == patientId
                && d.ContentHash == hash
                && d.DeletedAt == null
                && d.Status == CanonicalDocumentStatuses.Active)
            .OrderBy(d => d.CreatedAt)
            .ThenBy(d => d.Id)
            .FirstOrDefaultAsync(cancellationToken);

    private async Task CompensateBlobAsync(string container, string objectKey, CancellationToken cancellationToken)
    {
        try
        {
            await _blob.DeleteExactKeyAsync(container, objectKey, cancellationToken);
        }
        catch (Exception cleanup)
        {
            _log.LogError(
                cleanup,
                "Failed to compensate orphan canonical blob. Container={Container} KeyPresent={KeyPresent}",
                container,
                !string.IsNullOrEmpty(objectKey));
        }
    }

    private static bool IsLikelyUniqueConflict(DbUpdateException ex)
    {
        var message = ex.InnerException?.Message ?? ex.Message;
        return message.Contains("ux_canonical_documents_tenant_patient_hash", StringComparison.OrdinalIgnoreCase)
               || message.Contains("ux_canonical_document_association_once", StringComparison.OrdinalIgnoreCase)
               || message.Contains("unique", StringComparison.OrdinalIgnoreCase)
               || message.Contains("duplicate", StringComparison.OrdinalIgnoreCase);
    }
}
