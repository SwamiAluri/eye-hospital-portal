using CcmsApi.Models.Domain;

namespace CcmsApi.Services;

/// <summary>Validates that a persisted CCMS document row represents a real uploaded file.</summary>
public static class CcmsDocumentUploadValidator
{
    public static bool IsCompleteFileDocument(CcmsDocument doc)
    {
        if (doc is null) return false;
        if (string.IsNullOrWhiteSpace(doc.DocumentType)) return false;
        if (string.IsNullOrWhiteSpace(doc.DocumentName)) return false;
        if (doc.FileSizeBytes <= 0) return false;
        if (string.IsNullOrWhiteSpace(doc.MimeType)) return false;

        var blob = doc.BlobUrl?.Trim() ?? string.Empty;
        if (string.IsNullOrEmpty(blob)) return false;

        return DocumentEngineService.IsPointerUrl(blob) || blob.StartsWith("http", StringComparison.OrdinalIgnoreCase);
    }

    public static void EnsureCompleteFileDocument(CcmsDocument doc)
    {
        if (IsCompleteFileDocument(doc)) return;
        throw new InvalidOperationException(
            "Document upload did not persist a complete file record (blob URL, MIME type, and size are required).");
    }
}
