using System;
using System.IO;
using System.Linq;
using System.Text;

namespace AuthService.Services;

public static class CanonicalDocumentFileRules
{
    public const long MaxBytes = 20 * 1024 * 1024;

    public const string Pdf = "application/pdf";
    public const string Jpeg = "image/jpeg";
    public const string Png = "image/png";

    public static readonly string[] AllowedMimeTypes = { Pdf, Jpeg, Png };

    public static string SanitizeDisplayName(string? original)
    {
        var name = Path.GetFileName(original ?? string.Empty).Trim();
        if (string.IsNullOrEmpty(name))
            return "document";

        var builder = new StringBuilder(name.Length);
        foreach (var ch in name)
        {
            if (char.IsControl(ch) || ch == '/' || ch == '\\' || ch == ':')
                continue;
            builder.Append(ch);
        }

        var cleaned = builder.ToString().Trim('.', ' ');
        if (cleaned.Length == 0)
            return "document";
        return cleaned.Length <= 200 ? cleaned : cleaned[..200];
    }

    public static string NormalizeClassification(string? classification)
    {
        var value = (classification ?? string.Empty).Trim();
        if (string.IsNullOrEmpty(value))
            return "general";
        return value.Length <= 50 ? value : value[..50];
    }

    public static bool TryDetectMime(ReadOnlySpan<byte> header, string displayName, string? clientMime, out string mime, out string error)
    {
        mime = string.Empty;
        error = string.Empty;
        var extension = Path.GetExtension(displayName).ToLowerInvariant();
        string? detected = null;
        if (header.Length >= 4 && header[0] == 0x25 && header[1] == 0x50 && header[2] == 0x44 && header[3] == 0x46)
            detected = Pdf;
        else if (header.Length >= 3 && header[0] == 0xFF && header[1] == 0xD8 && header[2] == 0xFF)
            detected = Jpeg;
        else if (header.Length >= 8 &&
                 header[0] == 0x89 && header[1] == 0x50 && header[2] == 0x4E && header[3] == 0x47 &&
                 header[4] == 0x0D && header[5] == 0x0A && header[6] == 0x1A && header[7] == 0x0A)
            detected = Png;

        if (detected is null)
        {
            error = "File type is not allowed.";
            return false;
        }

        var extensionOk = detected switch
        {
            Pdf => extension == ".pdf",
            Jpeg => extension is ".jpg" or ".jpeg",
            Png => extension == ".png",
            _ => false,
        };
        if (!extensionOk)
        {
            error = "File type is not allowed.";
            return false;
        }

        if (!string.IsNullOrWhiteSpace(clientMime))
        {
            var declared = clientMime.Split(';', 2)[0].Trim().ToLowerInvariant();
            if (declared == "image/jpg")
                declared = Jpeg;

            // Browsers often send application/octet-stream for otherwise valid images.
            // Magic bytes + extension remain authoritative; only reject when an allowed
            // client declaration conflicts with the detected type.
            var genericClient =
                string.IsNullOrEmpty(declared)
                || declared is "application/octet-stream" or "binary/octet-stream";
            if (!genericClient)
            {
                if (!AllowedMimeTypes.Contains(declared) || declared != detected)
                {
                    error = "File type is not allowed.";
                    return false;
                }
            }
        }

        mime = detected;
        return true;
    }
}
