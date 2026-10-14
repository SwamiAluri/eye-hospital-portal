using System.Security.Cryptography;

namespace CcmsApi.Services;

/// <summary>
/// Slice 3B helpers: insurance/intake eligibility, pointer exclusion, SHA-256 of actual bytes.
/// </summary>
public static class CcmsCanonicalDocumentRules
{
    public const string StorageContainer = "ccms-documents";
    public const string StorageBackend = "azure-blob";

    /// <summary>
    /// Active file-backed Insurance/intake (+ claims) types shown in Patient 360 Insurance.
    /// Excludes pointer types (biometry_record, dicom_study).
    /// </summary>
    private static readonly HashSet<string> InsuranceIntakeTypes = new(StringComparer.OrdinalIgnoreCase)
    {
        "id_proof",
        "insurance_card_front",
        "insurance_card_back",
        "policy_document",
        "doctor_referral",
        "preauth_form",
        "previous_claims",
        "other_1",
        "other_2",
        "authorization_letter",
        "discharge_summary",
        "investigation_reports",
        "clinical_notes",
        "bills",
    };

    public static bool IsPointerDocumentType(string? documentType) =>
        string.Equals(documentType, "biometry_record", StringComparison.OrdinalIgnoreCase)
        || string.Equals(documentType, "dicom_study", StringComparison.OrdinalIgnoreCase);

    public static bool IsInsuranceIntakeType(string? documentType) =>
        !string.IsNullOrWhiteSpace(documentType) && InsuranceIntakeTypes.Contains(documentType.Trim());

    public static bool IsEligibleFileBackedForCanonical(string? blobUrl, string? documentType)
    {
        if (IsPointerDocumentType(documentType))
            return false;
        var url = blobUrl?.Trim() ?? string.Empty;
        if (string.IsNullOrEmpty(url) || DocumentEngineService.IsPointerUrl(url))
            return false;
        return true;
    }

    public static bool IsPatient360InsuranceRow(
        string? documentType,
        string? status,
        string? blobUrl,
        DateTime? deletedAt)
    {
        if (deletedAt is not null)
            return false;
        if (!string.IsNullOrWhiteSpace(status)
            && !string.Equals(status, "active", StringComparison.OrdinalIgnoreCase))
            return false;
        if (!IsInsuranceIntakeType(documentType))
            return false;
        return IsEligibleFileBackedForCanonical(blobUrl, documentType);
    }

    public static string ComputeSha256Hex(byte[] content)
    {
        if (content is null || content.Length == 0)
            throw new ArgumentException("Content is required to compute a hash.");
        return Convert.ToHexString(SHA256.HashData(content)).ToLowerInvariant();
    }

    public static async Task<byte[]> ReadAllBytesAsync(Stream stream, CancellationToken ct)
    {
        if (stream is MemoryStream ms)
        {
            if (ms.CanSeek) ms.Seek(0, SeekOrigin.Begin);
            return ms.ToArray();
        }

        await using var buffer = new MemoryStream();
        if (stream.CanSeek) stream.Seek(0, SeekOrigin.Begin);
        await stream.CopyToAsync(buffer, ct);
        return buffer.ToArray();
    }
}
