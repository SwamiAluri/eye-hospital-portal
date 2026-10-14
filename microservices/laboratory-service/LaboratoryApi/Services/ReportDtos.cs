namespace LaboratoryApi.Services;

public record ReportSourceResultRef(Guid ResultId, int ResultVersionNumber);

public record CreateReportDraftRequest(
    Guid OperatingBranchId,
    string IdempotencyKey,
    IReadOnlyList<ReportSourceResultRef> Sources);

public record AppendReportVersionRequest(
    Guid OperatingBranchId,
    string IdempotencyKey,
    int ExpectedRowVersion,
    IReadOnlyList<ReportSourceResultRef> Sources);

public record FinalizeReportRequest(
    Guid OperatingBranchId,
    string IdempotencyKey,
    int ExpectedRowVersion);

public record ReleaseReportRequest(
    Guid OperatingBranchId,
    string IdempotencyKey,
    int ExpectedRowVersion);

public record AssignReportNumberRequest(
    Guid OperatingBranchId,
    string IdempotencyKey,
    int ExpectedRowVersion);

public record ReportListQuery(
    Guid? OperatingBranchId,
    Guid? PatientId,
    Guid? OrderId,
    string? Status,
    int Page,
    int PageSize);

public record ReportSourceSnapshotDto(
    Guid Id,
    Guid ResultId,
    Guid ResultVersionId,
    int ResultVersionNumber,
    Guid OrderTestId,
    Guid SpecimenId,
    Guid CatalogueItemId,
    Guid CatalogueVersionId,
    string ResultDatatype,
    string? NumericValue,
    string? QualitativeValue,
    string? Unit,
    string? Comment,
    string ResultStatusAtSnapshot,
    Guid? AuthorizedByUserId,
    DateTime? AuthorizedAtUtc);

public record ReportVersionDto(
    Guid Id,
    Guid ReportId,
    int VersionNumber,
    Guid PatientId,
    Guid OrderId,
    Guid OperatingBranchId,
    DateTime CreatedAtUtc,
    Guid CreatedByUserId,
    IReadOnlyList<ReportSourceSnapshotDto> Sources);

public record ReportDetailDto(
    Guid Id,
    Guid TenantId,
    Guid OperatingBranchId,
    Guid PatientId,
    Guid OrderId,
    string OrderNumber,
    string Status,
    int CurrentVersionNumber,
    DateTime? FinalizedAtUtc,
    Guid? FinalizedByUserId,
    DateTime? ReleasedAtUtc,
    Guid? ReleasedByUserId,
    string? BusinessReportNumber,
    DateTime? BusinessReportNumberAssignedAtUtc,
    Guid? BusinessReportNumberAssignedByUserId,
    DateTime CreatedAtUtc,
    Guid CreatedByUserId,
    DateTime UpdatedAtUtc,
    Guid UpdatedByUserId,
    int RowVersion,
    IReadOnlyList<ReportVersionDto> Versions,
    Guid? CurrentOfficialArtifactId = null,
    OfficialPdfJobDto? OfficialPdfJob = null,
    OfficialPdfArtifactMetadataDto? CurrentOfficialArtifact = null);

public record ReportListItemDto(
    Guid Id,
    Guid OperatingBranchId,
    Guid PatientId,
    Guid OrderId,
    string OrderNumber,
    string Status,
    int CurrentVersionNumber,
    DateTime? FinalizedAtUtc,
    Guid? FinalizedByUserId,
    DateTime? ReleasedAtUtc,
    Guid? ReleasedByUserId,
    string? BusinessReportNumber,
    int SourceCount,
    DateTime CreatedAtUtc,
    Guid CreatedByUserId,
    int RowVersion,
    /// <summary>L-REP-03 CUT C — server-side Official PDF download eligibility (not a security gate).</summary>
    bool OfficialPdfDownloadEligible = false);

public record ReportListPageDto(
    IReadOnlyList<ReportListItemDto> Items,
    int Page,
    int PageSize,
    int TotalCount);

public record ReportEligibleSourceDto(
    Guid ResultId,
    int AuthorizedVersionNumber,
    Guid OrderId,
    string OrderNumber,
    Guid OrderTestId,
    Guid SpecimenId,
    Guid PatientId,
    string? PatientMrn,
    string? PatientName,
    string TestDisplayName,
    string InternalOrderCode,
    string? NumericValue,
    string? QualitativeValue,
    string? Unit);

public record ReportEligibleSourcesPageDto(
    IReadOnlyList<ReportEligibleSourceDto> Items,
    int Page,
    int PageSize,
    int TotalCount);
