namespace CcmsApi.Services;

/// <summary>
/// Resolves the persisted <c>document_name</c> for CCMS uploads.
/// </summary>
public static class CcmsDocumentFileNames
{
    /// <summary>
    /// Prefer multipart filename; optional explicit fileName only when non-empty.
    /// Never returns null/whitespace.
    /// </summary>
    public static string Resolve(string? multipartFileName, string? explicitFileName, string documentType)
    {
        var fromExplicit = Normalize(explicitFileName);
        if (!string.IsNullOrEmpty(fromExplicit))
            return fromExplicit;

        var fromMultipart = Normalize(multipartFileName);
        if (!string.IsNullOrEmpty(fromMultipart))
            return fromMultipart;

        var fromType = Normalize(documentType?.Replace('_', ' '));
        return string.IsNullOrEmpty(fromType) ? "document" : fromType;
    }

    internal static string? Normalize(string? value)
    {
        if (string.IsNullOrWhiteSpace(value))
            return null;

        var trimmed = value.Trim().Trim('"');
        // Strip path segments browsers may include (e.g. C:\fakepath\file.pdf)
        var name = trimmed;
        var slash = Math.Max(name.LastIndexOf('/'), name.LastIndexOf('\\'));
        if (slash >= 0 && slash < name.Length - 1)
            name = name[(slash + 1)..];

        name = string.Join("_", name.Split(Path.GetInvalidFileNameChars(), StringSplitOptions.RemoveEmptyEntries));
        return string.IsNullOrWhiteSpace(name) ? null : name;
    }

    /// <summary>Extract filename from multipart Content-Disposition (filename and filename*).</summary>
    public static string? FromContentDisposition(Microsoft.Net.Http.Headers.ContentDispositionHeaderValue disposition)
    {
        if (disposition.FileName.HasValue)
        {
            var n = Normalize(disposition.FileName.Value);
            if (!string.IsNullOrEmpty(n))
                return n;
        }

        if (disposition.FileNameStar.HasValue)
        {
            var n = Normalize(disposition.FileNameStar.Value);
            if (!string.IsNullOrEmpty(n))
                return n;
        }

        return null;
    }
}
