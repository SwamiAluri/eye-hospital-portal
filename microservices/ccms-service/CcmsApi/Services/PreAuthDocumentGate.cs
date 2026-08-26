using CcmsApi.Models.Domain;

namespace CcmsApi.Services;

/// <summary>
/// Pre-auth packet completeness. Required slots come from
/// <c>ccms_document_requirements</c> (AppliesAt = preauth). Empty master = no extra docs.
/// </summary>
public static class PreAuthDocumentGate
{
    public const string PreAuthStage = "preauth";

    public static bool IsPreAuthStage(string? appliesAt)
        => string.Equals(appliesAt, PreAuthStage, StringComparison.OrdinalIgnoreCase);

    /// <summary>
    /// Global rows (no payer FKs) apply to every case. Scoped rows apply when any
    /// configured provider id matches the case.
    /// </summary>
    public static bool RequirementAppliesToCase(CcmsDocumentRequirement req, CcmsCoverageCase coverageCase)
    {
        var scoped = req.InsuranceProviderId.HasValue
                     || req.TpaProviderId.HasValue
                     || req.GovernmentSchemeId.HasValue;
        if (!scoped)
            return true;

        if (req.InsuranceProviderId.HasValue
            && req.InsuranceProviderId == coverageCase.InsuranceProviderId)
            return true;
        if (req.TpaProviderId.HasValue
            && req.TpaProviderId == coverageCase.TpaProviderId)
            return true;
        if (req.GovernmentSchemeId.HasValue
            && req.GovernmentSchemeId == coverageCase.GovernmentSchemeId)
            return true;
        return false;
    }

    public static List<CcmsDocumentRequirement> ApplicablePreAuthRequirements(
        IEnumerable<CcmsDocumentRequirement> requirements,
        CcmsCoverageCase coverageCase)
        => requirements
            .Where(r => r.DeletedAt == null
                        && IsPreAuthStage(r.AppliesAt)
                        && RequirementAppliesToCase(r, coverageCase))
            .ToList();

    public static List<CcmsDocumentRequirement> MissingRequired(
        IEnumerable<CcmsDocumentRequirement> applicable,
        IEnumerable<CcmsDocument> documents)
    {
        var onFile = documents
            .Where(d => d.DeletedAt == null)
            .Select(d => d.DocumentType)
            .Where(t => !string.IsNullOrWhiteSpace(t))
            .ToHashSet(StringComparer.OrdinalIgnoreCase);

        return applicable
            .Where(r => r.IsRequired && !string.IsNullOrWhiteSpace(r.DocumentType) && !onFile.Contains(r.DocumentType))
            .GroupBy(r => r.DocumentType, StringComparer.OrdinalIgnoreCase)
            .Select(g => g.First())
            .ToList();
    }

    public static string FormatBlockMessage(IReadOnlyList<CcmsDocumentRequirement> missing)
    {
        var names = missing
            .Select(r => string.IsNullOrWhiteSpace(r.DocumentName) ? r.DocumentType : r.DocumentName)
            .ToList();
        if (names.Count == 0)
            return "Pre-authorization cannot be sent until required documents are attached.";
        if (names.Count == 1)
            return $"Pre-authorization cannot be sent until {names[0]} is attached.";
        var head = string.Join(", ", names.Take(names.Count - 1));
        return $"Pre-authorization cannot be sent until {head} and {names[^1]} are attached.";
    }
}
