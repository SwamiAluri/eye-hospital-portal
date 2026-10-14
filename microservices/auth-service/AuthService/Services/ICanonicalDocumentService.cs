using System;
using System.Collections.Generic;
using System.IO;
using System.Threading;
using System.Threading.Tasks;
using AuthService.Models.Domain;
using Microsoft.AspNetCore.Http;

namespace AuthService.Services;

public record CanonicalDocumentMetadataDto(
    Guid Id,
    Guid PatientId,
    string FileName,
    string MimeType,
    long SizeBytes,
    string Classification,
    string Status,
    DateTime CreatedAt,
    Guid CreatedByUserId,
    Guid? SupersededByDocumentId = null);

public record CanonicalDocumentMetadataPage(
    IReadOnlyList<CanonicalDocumentMetadataDto> Documents,
    int TotalCount,
    int PageNumber,
    int PageSize);

public record CanonicalDocumentContent(
    Stream Content,
    string ContentType,
    string FileName,
    long ContentLength);

public record CanonicalDocumentDuplicateCandidateDto(
    Guid Id,
    string FileName,
    string Classification,
    string Status,
    DateTime CreatedAt,
    bool ContentHashMatch);

public sealed class CanonicalDocumentDuplicateException : Exception
{
    public CanonicalDocumentDuplicateException(CanonicalDocumentDuplicateCandidateDto candidate)
        : base("A document with the same patient context and document type is already available.")
    {
        Candidate = candidate;
    }

    public CanonicalDocumentDuplicateCandidateDto Candidate { get; }
}

public sealed class CanonicalDocumentStaleReplacementException : Exception
{
    public CanonicalDocumentStaleReplacementException()
        : base("The document to replace is no longer current.")
    {
    }
}

public record CanonicalDocumentUploadRequest(
    string? Classification,
    string? DuplicateResolution,
    Guid? ReplaceDocumentId);

public interface ICanonicalDocumentService
{
    Task<CanonicalDocumentMetadataDto> UploadGeneralAsync(
        Guid tenantId,
        Guid patientId,
        Guid userId,
        IFormFile file,
        CanonicalDocumentUploadRequest? request = null,
        CancellationToken cancellationToken = default);

    Task<CanonicalDocumentMetadataPage> ListGeneralByPatientAsync(
        Guid tenantId,
        Guid patientId,
        int pageNumber,
        int pageSize,
        CancellationToken cancellationToken = default);

    Task<CanonicalDocumentContent?> OpenContentAsync(
        Guid tenantId,
        Guid patientId,
        Guid documentId,
        CancellationToken cancellationToken = default);

    /// <summary>
    /// Soft-deletes an MPI General document. Creator-only; retains physical blob.
    /// </summary>
    Task SoftDeleteGeneralAsync(
        Guid tenantId,
        Guid patientId,
        Guid documentId,
        Guid currentUserId,
        CancellationToken cancellationToken = default);
}
