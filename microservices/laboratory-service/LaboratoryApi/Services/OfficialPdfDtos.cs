namespace LaboratoryApi.Services;

public record GenerateOfficialPdfRequest(
    Guid OperatingBranchId,
    string IdempotencyKey);

public record OfficialPdfArtifactMetadataDto(
    Guid ArtifactId,
    int ArtifactVersion,
    string Status,
    string MimeType,
    long SizeBytes,
    string? ContentHash,
    Guid? CanonicalDocumentId,
    Guid TemplateVersionId,
    int TemplateVersionNumber,
    string TemplateCode,
    Guid GeneratedByUserId,
    DateTime GeneratedAtUtc,
    string? FailureCode,
    string? FailureMessage);

public record OfficialPdfJobDto(
    Guid JobId,
    Guid ReportId,
    string Status,
    Guid RequestedByUserId,
    DateTime RequestedAtUtc,
    DateTime? StartedAtUtc,
    DateTime? CompletedAtUtc,
    int AttemptCount,
    Guid? ArtifactId,
    OfficialPdfArtifactMetadataDto? Artifact,
    string? FailureCode,
    string? FailureMessage);

public record OfficialPdfGenerationResponse(
    Guid ReportId,
    string ReportStatus,
    string? BusinessReportNumber,
    OfficialPdfJobDto Job,
    bool Replayed,
    bool ExistingActiveJob);

/// <summary>
/// L-REP-03 CUT D-B — patient-scoped current Official PDF discovery projection (not a new CanonicalDocument).
/// </summary>
public record PatientCurrentOfficialPdfDocumentDto(
    Guid ReportId,
    Guid PatientId,
    Guid OperatingBranchId,
    string BusinessReportNumber,
    string ReportStatus,
    Guid ArtifactId,
    int ArtifactVersion,
    Guid CanonicalDocumentId,
    string MimeType,
    long SizeBytes,
    DateTime GeneratedAtUtc,
    string SourceDomain,
    string SourceEntityType);
