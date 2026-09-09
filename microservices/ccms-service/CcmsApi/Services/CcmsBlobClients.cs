using Azure.Storage.Blobs;

namespace CcmsApi.Services;

/// <summary>
/// Azurite 3.35 does not accept the default Azure SDK service version (2026-04-06).
/// Pin a compatible version for local development storage.
/// </summary>
public static class CcmsBlobClients
{
    // Supported by Azurite 3.35+; safe for Azure production blob endpoints.
    private static readonly BlobClientOptions CompatibleOptions = new(BlobClientOptions.ServiceVersion.V2024_08_04);

    public static BlobServiceClient CreateServiceClient(string connectionString) =>
        new(connectionString, CompatibleOptions);
}
