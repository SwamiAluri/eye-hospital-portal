using Azure.Identity;
using Azure.Storage.Blobs;
using Microsoft.Extensions.Configuration;

namespace AuthService.Services;

/// <summary>
/// Session-audio destination. Patient photos stay on the connection-string client.
/// Private Azure mode uses the existing Speech storage account and DefaultAzureCredential.
/// </summary>
public sealed class SessionAudioBlobClients
{
    public SessionAudioBlobClients(BlobServiceClient development, BlobServiceClient? privateAzure)
    {
        Development = development;
        PrivateAzure = privateAzure;
    }

    public BlobServiceClient Development { get; }

    public BlobServiceClient? PrivateAzure { get; }

    public bool UsesPrivateAzure(string containerName) =>
        containerName == SessionAudioObjectKey.ContainerName && PrivateAzure != null;

    public BlobServiceClient ForExact(string containerName) =>
        UsesPrivateAzure(containerName) ? PrivateAzure! : Development;

    public static SessionAudioBlobClients Create(IConfiguration configuration, BlobServiceClient development)
    {
        if (!SessionAudioStorageTarget.UsesPrivateAzureAccount(configuration, out var accountUri))
            return new SessionAudioBlobClients(development, null);

        var credential = new DefaultAzureCredential(new DefaultAzureCredentialOptions
        {
            ExcludeInteractiveBrowserCredential = true,
        });
        return new SessionAudioBlobClients(development, new BlobServiceClient(accountUri, credential));
    }
}

public static class SessionAudioStorageTarget
{
    public static bool UsesPrivateAzureAccount(IConfiguration configuration, out Uri accountUri)
    {
        accountUri = null!;
        if (!configuration.GetValue("AzureSpeech:TrustedBlobAccess", false))
            return false;
        return TryAccountUri(configuration["AzureSpeech:StorageAccountName"], out accountUri);
    }

    public static bool TryAccountUri(string? storageAccountName, out Uri accountUri)
    {
        accountUri = null!;
        if (string.IsNullOrWhiteSpace(storageAccountName))
            return false;
        if (storageAccountName.Contains('.')
            || storageAccountName.Contains('/')
            || storageAccountName.Contains('?')
            || storageAccountName.Contains('\\'))
            return false;

        accountUri = new Uri($"https://{storageAccountName}.blob.core.windows.net");
        return accountUri.Query.Length == 0;
    }
}
