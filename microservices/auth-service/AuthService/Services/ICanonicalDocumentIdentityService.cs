using System;
using System.Threading;
using System.Threading.Tasks;
using AuthService.Models.Domain;

namespace AuthService.Services;

/// <summary>
/// Hospital-wide canonical document identity: tenant + patient + content hash → one document.
/// Domain adapters create associations; they must not invent a second identity for the same bytes.
/// </summary>
public interface ICanonicalDocumentIdentityService
{
    string ComputeContentHash(byte[] content);

    /// <summary>
    /// Resolve an existing active canonical document by hash, or create one blob + row.
    /// Concurrent creators: uniqueness + retry reuses the winner; compensates orphan blobs.
    /// </summary>
    Task<CanonicalDocumentResolveResult> ResolveOrCreateAsync(
        Guid tenantId,
        Guid patientId,
        Guid userId,
        byte[] content,
        string fileName,
        string mimeType,
        string classification,
        CancellationToken cancellationToken = default);

    /// <summary>
    /// Identity for a source-owned blob (e.g. CCMS <c>ccms-documents</c>) without copying bytes
    /// into <c>patient-documents</c>. Full CCMS adapter is a later slice; this is the contract.
    /// </summary>
    Task<CanonicalDocumentResolveResult> ResolveOrCreateExternalAsync(
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
        CancellationToken cancellationToken = default);

    Task<CanonicalDocumentAssociation> EnsureAssociationAsync(
        Guid documentId,
        string domain,
        string entityType,
        Guid entityId,
        string category,
        Guid userId,
        string role = "primary",
        CancellationToken cancellationToken = default);

    /// <summary>
    /// Removes one association. Soft-deletes the canonical document only when no associations remain.
    /// Physical blob is retained.
    /// </summary>
    Task<bool> RemoveAssociationAsync(
        Guid tenantId,
        Guid documentId,
        string domain,
        string entityType,
        Guid entityId,
        CancellationToken cancellationToken = default);
}

public sealed record CanonicalDocumentResolveResult(
    CanonicalDocument Document,
    bool Created,
    bool BlobUploaded);
