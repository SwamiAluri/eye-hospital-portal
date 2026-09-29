using Azure.Storage.Blobs.Models;

namespace AuthService.Services.Interfaces;

/// <summary>
/// Service interface for Azure Blob Storage operations
/// </summary>
public interface IBlobStorageService
{
    /// <summary>
    /// Uploads a file to Azure Blob Storage with automatic container creation
    /// </summary>
    /// <param name="fileName">Name of the file (will be used as blob name)</param>
    /// <param name="fileStream">File content stream</param>
    /// <param name="contentType">MIME type (e.g., image/jpeg, image/png)</param>
    /// <param name="containerName">Container name (default: patient-photos)</param>
    /// <returns>Blob URL of the uploaded file</returns>
    Task<string> UploadFileAsync(string fileName, Stream fileStream, string contentType, string containerName = "patient-photos");

    /// <summary>
    /// Uploads patient photo and generates thumbnail
    /// </summary>
    /// <param name="fileName">Original file name</param>
    /// <param name="fileStream">File content stream</param>
    /// <param name="contentType">MIME type</param>
    /// <param name="tenantId">Tenant ID for folder structure</param>
    /// <param name="patientId">Patient ID for folder structure</param>
    /// <returns>Tuple of (photoUrl, thumbnailUrl)</returns>
    Task<(string photoUrl, string thumbnailUrl)> UploadPatientPhotoAsync(
        string fileName, 
        Stream fileStream, 
        string contentType, 
        Guid tenantId, 
        Guid patientId);

    /// <summary>
    /// Deletes a file from Azure Blob Storage
    /// </summary>
    /// <param name="blobUrl">Full blob URL to delete</param>
    /// <returns>True if deleted successfully, false otherwise</returns>
    Task<bool> DeleteFileAsync(string blobUrl);

    /// <summary>
    /// Checks if a blob exists in storage
    /// </summary>
    /// <param name="blobUrl">Full blob URL to check</param>
    /// <returns>True if exists, false otherwise</returns>
    Task<bool> BlobExistsAsync(string blobUrl);

    /// <summary>
    /// Gets blob metadata
    /// </summary>
    /// <param name="blobUrl">Full blob URL</param>
    /// <returns>Blob properties including size, content type, last modified</returns>
    Task<BlobProperties?> GetBlobPropertiesAsync(string blobUrl);

    /// <summary>
    /// Uploads to an exact object key. Does not rewrite the key. Fails if the blob already exists.
    /// Container is private. Does not return a browser URL.
    /// </summary>
    Task UploadExactKeyAsync(
        string containerName,
        string objectKey,
        Stream content,
        string contentType,
        CancellationToken cancellationToken = default);

    /// <summary>
    /// Opens a private blob for an authorized backend stream. Does not mint a SAS URL.
    /// </summary>
    Task<ExactBlobRead?> OpenReadExactAsync(
        string containerName,
        string objectKey,
        CancellationToken cancellationToken = default);

    /// <summary>
    /// Deletes a private object by exact key. Does not return a browser URL.
    /// </summary>
    Task DeleteExactKeyAsync(
        string containerName,
        string objectKey,
        CancellationToken cancellationToken = default);
}

public sealed class ExactBlobRead : IAsyncDisposable
{
    public required Stream Content { get; init; }
    public required string ContentType { get; init; }
    public long ContentLength { get; init; }

    public ValueTask DisposeAsync() => Content.DisposeAsync();
}

public sealed class BlobObjectKeyConflictException : Exception
{
    public BlobObjectKeyConflictException()
        : base("Object key already exists.")
    {
    }
}
