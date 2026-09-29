using AuthService.Services;

namespace AuthService.Services.Transcription;

/// <summary>
/// Private blob URL for Azure Speech trusted-service access. No SAS, no account key.
/// </summary>
public static class CounselingAudioBlobReference
{
    public static bool TryCreatePrivateContentUrl(string? storageAccountName, string? objectKey, out string url)
    {
        url = "";
        if (string.IsNullOrWhiteSpace(storageAccountName) || string.IsNullOrWhiteSpace(objectKey))
            return false;
        if (storageAccountName.Contains('.') || storageAccountName.Contains('/') || storageAccountName.Contains('?'))
            return false;
        if (objectKey.Contains('?', StringComparison.Ordinal)
            || objectKey.Contains("://", StringComparison.Ordinal)
            || objectKey.Contains("..", StringComparison.Ordinal))
            return false;

        url = $"https://{storageAccountName}.blob.core.windows.net/{SessionAudioObjectKey.ContainerName}/{objectKey}";
        return !url.Contains('?', StringComparison.Ordinal);
    }
}
