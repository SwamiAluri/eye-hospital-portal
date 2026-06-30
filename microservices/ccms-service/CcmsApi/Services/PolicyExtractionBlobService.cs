using Azure.Storage.Blobs;
using Azure.Storage.Blobs.Models;
using Microsoft.Extensions.Configuration;

namespace CcmsApi.Services;

/// <summary>Uploads policy card images to blob storage for OCR audit trail.</summary>
public class PolicyExtractionBlobService
{
    private const string ContainerName = "ccms-policy-extraction";
    private readonly IConfiguration _config;

    public PolicyExtractionBlobService(IConfiguration config) => _config = config;

    public async Task<string> UploadAsync(
        Stream content, string fileName, string mimeType,
        Guid tenantId, Guid caseId, string sessionId, string side,
        CancellationToken ct = default)
    {
        var connStr = _config["AzureWebJobsStorage"]
            ?? _config["Values:AzureWebJobsStorage"]
            ?? "UseDevelopmentStorage=true";

        var serviceClient   = new BlobServiceClient(connStr);
        var containerClient = serviceClient.GetBlobContainerClient(ContainerName);
        await containerClient.CreateIfNotExistsAsync(PublicAccessType.None, cancellationToken: ct);

        var safeName = string.Join("_", fileName.Split(Path.GetInvalidFileNameChars()));
        var blobName = $"tenants/{tenantId}/cases/{caseId}/{sessionId}/{side}_{DateTime.UtcNow:yyyyMMddHHmmss}_{safeName}";
        var blobClient = containerClient.GetBlobClient(blobName);

        if (content.CanSeek) content.Seek(0, SeekOrigin.Begin);
        await blobClient.UploadAsync(content, new BlobHttpHeaders { ContentType = mimeType }, cancellationToken: ct);

        return blobClient.Uri.ToString();
    }
}
