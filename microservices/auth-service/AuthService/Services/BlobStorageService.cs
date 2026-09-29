using Azure;
using Azure.Storage.Blobs;
using Azure.Storage.Blobs.Models;
using AuthService.Services.Interfaces;
using SixLabors.ImageSharp;
using SixLabors.ImageSharp.Processing;

namespace AuthService.Services;

/// <summary>
/// Azure Blob Storage service implementation for file uploads
/// Handles patient photo uploads with thumbnail generation
/// </summary>
public class BlobStorageService : IBlobStorageService
{
    private readonly BlobServiceClient _blobServiceClient;
    private readonly SessionAudioBlobClients _sessionAudio;
    private readonly ILogger<BlobStorageService> _logger;
    private readonly IConfiguration _configuration;

    public BlobStorageService(
        BlobServiceClient blobServiceClient,
        ILogger<BlobStorageService> logger,
        IConfiguration configuration,
        SessionAudioBlobClients? sessionAudio = null)
    {
        _sessionAudio = sessionAudio ?? new SessionAudioBlobClients(blobServiceClient, null);
        _blobServiceClient = _sessionAudio.Development;
        _logger = logger;
        _configuration = configuration;
    }

    /// <summary>
    /// Uploads a file to Azure Blob Storage
    /// </summary>
    public async Task<string> UploadFileAsync(
        string fileName, 
        Stream fileStream, 
        string contentType, 
        string containerName = "patient-photos")
    {
        try
        {
            // Get container client (creates container if doesn't exist)
            var containerClient = _blobServiceClient.GetBlobContainerClient(containerName);
            await containerClient.CreateIfNotExistsAsync(PublicAccessType.None);

            // Generate unique blob name with timestamp to avoid conflicts
            var uniqueFileName = $"{Path.GetFileNameWithoutExtension(fileName)}_{DateTime.UtcNow:yyyyMMddHHmmss}{Path.GetExtension(fileName)}";
            var blobClient = containerClient.GetBlobClient(uniqueFileName);

            // Set content type for proper browser rendering
            var blobHttpHeaders = new BlobHttpHeaders
            {
                ContentType = contentType
            };

            // Upload file
            await blobClient.UploadAsync(fileStream, new BlobUploadOptions
            {
                HttpHeaders = blobHttpHeaders,
                Conditions = null
            });

            _logger.LogInformation("File uploaded to blob storage: {BlobName} in container {ContainerName}", 
                uniqueFileName, containerName);

            return blobClient.Uri.ToString();
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error uploading file {FileName} to blob storage", fileName);
            throw;
        }
    }

    /// <summary>
    /// Uploads patient photo with automatic thumbnail generation
    /// Folder structure: patient-photos/{tenantId}/{patientId}/photo.jpg
    /// Thumbnails: patient-photos/{tenantId}/{patientId}/thumb_photo.jpg
    /// </summary>
    public async Task<(string photoUrl, string thumbnailUrl)> UploadPatientPhotoAsync(
        string fileName, 
        Stream fileStream, 
        string contentType, 
        Guid tenantId, 
        Guid patientId)
    {
        try
        {
            var containerName = "patient-photos";
            var containerClient = _blobServiceClient.GetBlobContainerClient(containerName);
            await containerClient.CreateIfNotExistsAsync(PublicAccessType.None);

            // Create tenant/patient folder structure
            var folderPath = $"{tenantId}/{patientId}";
            var photoFileName = $"{folderPath}/{Path.GetFileName(fileName)}";
            var thumbnailFileName = $"{folderPath}/thumb_{Path.GetFileName(fileName)}";

            // Upload original photo
            var photoBlobClient = containerClient.GetBlobClient(photoFileName);
            fileStream.Position = 0; // Reset stream position
            
            var blobHttpHeaders = new BlobHttpHeaders { ContentType = contentType };
            await photoBlobClient.UploadAsync(fileStream, new BlobUploadOptions
            {
                HttpHeaders = blobHttpHeaders,
                Conditions = null
            });

            var photoUrl = photoBlobClient.Uri.ToString();

            // Generate and upload thumbnail (150x150)
            fileStream.Position = 0; // Reset stream for thumbnail generation
            var thumbnailUrl = await GenerateAndUploadThumbnailAsync(
                fileStream, 
                containerClient, 
                thumbnailFileName, 
                contentType);

            _logger.LogInformation(
                "Patient photo uploaded successfully for patient {PatientId} in tenant {TenantId}. Photo: {PhotoUrl}, Thumbnail: {ThumbnailUrl}",
                patientId, tenantId, photoUrl, thumbnailUrl);

            return (photoUrl, thumbnailUrl);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, 
                "Error uploading patient photo for patient {PatientId} in tenant {TenantId}", 
                patientId, tenantId);
            throw;
        }
    }

    /// <summary>
    /// Generates 150x150 thumbnail and uploads to blob storage
    /// Uses SixLabors.ImageSharp for image processing
    /// </summary>
    private async Task<string> GenerateAndUploadThumbnailAsync(
        Stream imageStream, 
        BlobContainerClient containerClient, 
        string thumbnailFileName, 
        string contentType)
    {
        try
        {
            using var image = await Image.LoadAsync(imageStream);
            
            // Resize to 150x150 thumbnail
            image.Mutate(x => x.Resize(new ResizeOptions
            {
                Size = new Size(150, 150),
                Mode = ResizeMode.Crop
            }));

            // Save to memory stream
            using var thumbnailStream = new MemoryStream();
            await image.SaveAsJpegAsync(thumbnailStream);
            thumbnailStream.Position = 0;

            // Upload thumbnail
            var thumbnailBlobClient = containerClient.GetBlobClient(thumbnailFileName);
            var blobHttpHeaders = new BlobHttpHeaders { ContentType = contentType };
            
            await thumbnailBlobClient.UploadAsync(thumbnailStream, new BlobUploadOptions
            {
                HttpHeaders = blobHttpHeaders,
                Conditions = null
            });

            return thumbnailBlobClient.Uri.ToString();
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error generating thumbnail for {FileName}", thumbnailFileName);
            throw;
        }
    }

    /// <summary>
    /// Deletes a blob from storage
    /// </summary>
    public async Task<bool> DeleteFileAsync(string blobUrl)
    {
        try
        {
            var uri = new Uri(blobUrl);
            var blobClient = _blobServiceClient.GetBlobContainerClient(uri.Segments[1].Trim('/'))
                .GetBlobClient(string.Join("", uri.Segments.Skip(2)));

            var result = await blobClient.DeleteIfExistsAsync();
            
            if (result.Value)
            {
                _logger.LogInformation("Blob deleted successfully: {BlobUrl}", blobUrl);
            }

            return result.Value;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error deleting blob {BlobUrl}", blobUrl);
            return false;
        }
    }

    /// <summary>
    /// Checks if blob exists
    /// </summary>
    public async Task<bool> BlobExistsAsync(string blobUrl)
    {
        try
        {
            var uri = new Uri(blobUrl);
            var blobClient = _blobServiceClient.GetBlobContainerClient(uri.Segments[1].Trim('/'))
                .GetBlobClient(string.Join("", uri.Segments.Skip(2)));

            return await blobClient.ExistsAsync();
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error checking blob existence {BlobUrl}", blobUrl);
            return false;
        }
    }

    /// <summary>
    /// Gets blob properties (size, content type, etc.)
    /// </summary>
    public async Task<BlobProperties?> GetBlobPropertiesAsync(string blobUrl)
    {
        try
        {
            var uri = new Uri(blobUrl);
            var blobClient = _blobServiceClient.GetBlobContainerClient(uri.Segments[1].Trim('/'))
                .GetBlobClient(string.Join("", uri.Segments.Skip(2)));

            var properties = await blobClient.GetPropertiesAsync();
            return properties.Value;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error getting blob properties {BlobUrl}", blobUrl);
            return null;
        }
    }

    public async Task UploadExactKeyAsync(
        string containerName,
        string objectKey,
        Stream content,
        string contentType,
        CancellationToken cancellationToken = default)
    {
        SessionAudioObjectKey.Validate(objectKey);
        var serviceClient = _sessionAudio.ForExact(containerName);
        var containerClient = serviceClient.GetBlobContainerClient(containerName);
        if (!_sessionAudio.UsesPrivateAzure(containerName))
            await containerClient.CreateIfNotExistsAsync(PublicAccessType.None, cancellationToken: cancellationToken);
        var blobClient = containerClient.GetBlobClient(objectKey);
        try
        {
            await blobClient.UploadAsync(
                content,
                SessionAudioBlobUpload.CreateNoOverwriteOptions(contentType),
                cancellationToken);
        }
        catch (RequestFailedException ex) when (ex.Status == 409 || ex.ErrorCode == "BlobAlreadyExists")
        {
            _logger.LogWarning("Blob object key conflict in container {Container}", containerName);
            throw new BlobObjectKeyConflictException();
        }

        _logger.LogInformation("Stored object in private container {Container}", containerName);
    }

    public async Task<ExactBlobRead?> OpenReadExactAsync(
        string containerName,
        string objectKey,
        CancellationToken cancellationToken = default)
    {
        SessionAudioObjectKey.Validate(objectKey);
        var serviceClient = _sessionAudio.ForExact(containerName);
        var containerClient = serviceClient.GetBlobContainerClient(containerName);
        var blobClient = containerClient.GetBlobClient(objectKey);
        if (!await blobClient.ExistsAsync(cancellationToken))
            return null;

        var properties = await blobClient.GetPropertiesAsync(cancellationToken: cancellationToken);
        var stream = await blobClient.OpenReadAsync(cancellationToken: cancellationToken);
        return new ExactBlobRead
        {
            Content = stream,
            ContentType = string.IsNullOrWhiteSpace(properties.Value.ContentType)
                ? "application/octet-stream"
                : properties.Value.ContentType,
            ContentLength = properties.Value.ContentLength,
        };
    }

    public async Task DeleteExactKeyAsync(
        string containerName,
        string objectKey,
        CancellationToken cancellationToken = default)
    {
        SessionAudioObjectKey.Validate(objectKey);
        var serviceClient = _sessionAudio.ForExact(containerName);
        var containerClient = serviceClient.GetBlobContainerClient(containerName);
        var blobClient = containerClient.GetBlobClient(objectKey);
        await blobClient.DeleteIfExistsAsync(DeleteSnapshotsOption.IncludeSnapshots, cancellationToken: cancellationToken);
        _logger.LogInformation("Deleted object from private container {Container}", containerName);
    }

    /// <summary>
    /// Copies one development-store object into the private Azure container. Leaves the source in place.
    /// </summary>
    public async Task<string> CopyDevelopmentSessionAudioToPrivateStoreAsync(
        string objectKey,
        CancellationToken cancellationToken = default)
    {
        SessionAudioObjectKey.Validate(objectKey);
        if (_sessionAudio.PrivateAzure == null)
            return "not-configured";

        var source = _sessionAudio.Development
            .GetBlobContainerClient(SessionAudioObjectKey.ContainerName)
            .GetBlobClient(objectKey);
        if (!await source.ExistsAsync(cancellationToken))
            return "source-missing";

        var destination = _sessionAudio.PrivateAzure
            .GetBlobContainerClient(SessionAudioObjectKey.ContainerName)
            .GetBlobClient(objectKey);
        if (await destination.ExistsAsync(cancellationToken))
            return "already-present";

        var properties = await source.GetPropertiesAsync(cancellationToken: cancellationToken);
        var contentType = string.IsNullOrWhiteSpace(properties.Value.ContentType)
            ? "application/octet-stream"
            : properties.Value.ContentType;
        await using var stream = await source.OpenReadAsync(cancellationToken: cancellationToken);
        try
        {
            await destination.UploadAsync(
                stream,
                SessionAudioBlobUpload.CreateNoOverwriteOptions(contentType),
                cancellationToken);
        }
        catch (RequestFailedException ex) when (ex.Status == 409 || ex.ErrorCode == "BlobAlreadyExists")
        {
            return "already-present";
        }

        return "copied";
    }
}

public static class SessionAudioObjectKey
{
    public const string ContainerName = "session-audio";

    public static string Build(Guid tenantId, Guid sessionId, Guid conversationId, Guid recordingId, string extension)
    {
        var normalized = extension.StartsWith('.') ? extension.ToLowerInvariant() : "." + extension.ToLowerInvariant();
        var key = $"{tenantId:D}/{sessionId:D}/{conversationId:D}/{recordingId:D}{normalized}";
        Validate(key);
        return key;
    }

    public static void Validate(string objectKey)
    {
        if (string.IsNullOrWhiteSpace(objectKey)
            || objectKey.Contains("..", StringComparison.Ordinal)
            || objectKey.Contains('\\')
            || objectKey.StartsWith('/')
            || objectKey.Contains('?', StringComparison.Ordinal))
        {
            throw new ArgumentException("Object key is not valid.");
        }
    }
}

public static class SessionAudioBlobUpload
{
    public static BlobUploadOptions CreateNoOverwriteOptions(string contentType) =>
        new()
        {
            HttpHeaders = new BlobHttpHeaders
            {
                ContentType = string.IsNullOrWhiteSpace(contentType) ? "application/octet-stream" : contentType,
            },
            Conditions = new BlobRequestConditions
            {
                IfNoneMatch = new ETag("*"),
            },
        };
}
