namespace CcmsApi.Models.Dtos;

public enum ExtractionConfidence { High, Review, Low }

public record ExtractedField<T>(
    T? Value,
    string? SourceText,
    ExtractionConfidence Confidence,
    string? MismatchReason
);

public record ExtractionCandidate(Guid Id, string Name, decimal Score);

public record ExtractedPolicyFields(
    ExtractedField<string>  InsurerName,
    ExtractedField<string>  PolicyNumber,
    ExtractedField<string>  CardNumber,
    ExtractedField<string>  MembershipNumber,
    ExtractedField<string>  InsuredName,
    ExtractedField<string>  RelationshipToInsured,
    ExtractedField<string>  CompanyName,
    ExtractedField<string>  ContactNumber,
    ExtractedField<decimal?> SumInsured,
    ExtractedField<decimal?> CoPayPercent,
    ExtractedField<DateTime?> ValidFrom,
    ExtractedField<DateTime?> ValidTo,
    ExtractedField<string>  TpaName
);

public record PolicyExtractionPreview(
    string SessionId,
    string? FrontDocumentUrl,
    string? BackDocumentUrl,
    string OriginalFilename,
    string ProviderModel,
    int ProcessingMs,
    bool HasDuplicateWarning,
    string? DuplicateWarningDetail,
    ExtractedPolicyFields Fields,
    IReadOnlyList<ExtractionCandidate> InsurerCandidates,
    Guid? ResolvedInsuranceProviderId
);

public record ConfirmPolicyExtractionRequest(
    string   SessionId,
    string   PolicyNumber,
    string?  CardNumber,
    string?  MembershipNumber,
    string?  InsurerName,
    Guid?    InsuranceProviderId,
    string?  InsuredName,
    string?  RelationshipToInsured,
    string?  CompanyName,
    string?  ContactNumber,
    decimal? SumInsured,
    decimal? CoPayPercent,
    bool     IsPrimary = true,
    bool     ApplyToCoverageDraft = true,
    string?  FrontDocumentUrl = null,
    string?  BackDocumentUrl = null,
    string?  OriginalFilename = null,
    string?  ProviderModel = null,
    int?     ProcessingMs = null,
    int?     HighFieldCount = null,
    int?     ReviewFieldCount = null,
    int?     LowFieldCount = null,
    int?     FieldOverrideCount = null,
    string?  OverriddenFieldsJson = null,
    string?  IdempotencyKey = null
);

public record ConfirmPolicyExtractionResponse(
    Guid PolicyId,
    string PolicyNumber,
    Guid? InsuranceProviderId,
    string? InsurerName
);
