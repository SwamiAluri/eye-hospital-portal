using System;
using System.Collections.Generic;

namespace AuthService.Services;

/// <summary>
/// Certified counseling_session_documents document_type vocabulary (DB CHECK).
/// Generic upload excludes AudioRecording (separate conversation pipeline).
/// </summary>
public static class CounselingSessionDocumentTypes
{
    public const string ReferralLetter = "ReferralLetter";
    public const string PreviousReport = "PreviousReport";
    public const string InsuranceCard = "InsuranceCard";
    public const string PolicyDocument = "PolicyDocument";
    public const string IDProof = "IDProof";
    public const string AddressProof = "AddressProof";
    public const string LabReport = "LabReport";
    public const string Imaging = "Imaging";
    public const string Other = "Other";
    public const string AudioRecording = "AudioRecording";

    public static readonly IReadOnlyList<string> GenericUploadAllowed = new[]
    {
        ReferralLetter,
        PreviousReport,
        InsuranceCard,
        PolicyDocument,
        IDProof,
        AddressProof,
        LabReport,
        Imaging,
        Other,
    };

    public static bool TryNormalizeGenericUploadType(string? documentType, out string normalized, out string error)
    {
        normalized = string.Empty;
        error = string.Empty;
        var value = (documentType ?? string.Empty).Trim();
        if (string.IsNullOrEmpty(value))
        {
            error = "Document type is required.";
            return false;
        }

        if (string.Equals(value, AudioRecording, StringComparison.Ordinal))
        {
            error = "AudioRecording is not allowed on the generic document upload path.";
            return false;
        }

        foreach (var allowed in GenericUploadAllowed)
        {
            if (string.Equals(value, allowed, StringComparison.Ordinal))
            {
                normalized = allowed;
                return true;
            }
        }

        error = "Document type is not a certified Counselling document type.";
        return false;
    }

    public static string CanonicalFilePathMarker(Guid canonicalDocumentId) =>
        $"canonical:{canonicalDocumentId:D}";
}
