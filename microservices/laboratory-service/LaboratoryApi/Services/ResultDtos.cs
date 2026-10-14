namespace LaboratoryApi.Services;

public record TestingWorkQueueQuery(
    Guid? OperatingBranchId = null,
    string? Search = null,
    string? Priority = null,
    bool? HasDraft = null,
    /// <summary>When set (e.g. Draft), filter to Results with that status.</summary>
    string? ResultStatus = null,
    int Page = 1,
    int PageSize = 25);

public record TestingWorkQueueItemDto(
    Guid OrderTestId,
    Guid OrderId,
    string OrderNumber,
    string? Priority,
    Guid PatientId,
    string? PatientMrn,
    string? PatientName,
    Guid SpecimenId,
    string SpecimenStatus,
    string? Accession,
    string? BarcodeValue,
    Guid? ReceivingBranchId,
    Guid? CollectionBranchId,
    DateTime? ReceivedAtUtc,
    DateTime? CollectedAtUtc,
    Guid CatalogueItemId,
    Guid CatalogueVersionId,
    string CatalogueType,
    string TestDisplayName,
    string InternalOrderCode,
    string? ResultDatatype,
    string? PermittedUnits,
    Guid? ResultId,
    string? ResultStatus,
    int? ResultRowVersion,
    DateTime? DraftUpdatedAtUtc);

public record TestingWorkQueuePageDto(
    IReadOnlyList<TestingWorkQueueItemDto> Items,
    int TotalCount,
    int Page,
    int PageSize);

public record TestingWorkItemDetailDto(
    Guid OrderTestId,
    Guid OrderId,
    string OrderNumber,
    string? Priority,
    Guid PatientId,
    string? PatientMrn,
    string? PatientName,
    DateTime? PatientDateOfBirth,
    Guid SpecimenId,
    string SpecimenStatus,
    string? Accession,
    string? BarcodeValue,
    Guid? ReceivingBranchId,
    Guid? CollectionBranchId,
    DateTime? ReceivedAtUtc,
    DateTime? CollectedAtUtc,
    Guid CatalogueItemId,
    Guid CatalogueVersionId,
    string CatalogueType,
    string Classification,
    string TestDisplayName,
    string InternalOrderCode,
    string? ResultDatatype,
    string? PermittedUnits,
    ResultDraftDto? Draft);

public record ResultDraftDto(
    Guid Id,
    Guid OrderTestId,
    Guid SpecimenId,
    Guid OrderId,
    Guid OperatingBranchId,
    string Status,
    string ResultDatatype,
    string? NumericValue,
    string? QualitativeValue,
    string? Unit,
    string? Comment,
    int CurrentVersionNumber,
    DateTime CreatedAtUtc,
    Guid CreatedByUserId,
    DateTime UpdatedAtUtc,
    Guid UpdatedByUserId,
    int RowVersion,
    Guid? VerifiedByUserId = null,
    DateTime? VerifiedAtUtc = null,
    int? VerifiedVersionNumber = null,
    Guid? AuthorizedByUserId = null,
    DateTime? AuthorizedAtUtc = null,
    int? AuthorizedVersionNumber = null);

public record CreateResultDraftRequest(
    Guid OrderTestId,
    Guid SpecimenId,
    Guid OperatingBranchId,
    string? NumericValue = null,
    string? QualitativeValue = null,
    string? Unit = null,
    string? Comment = null,
    string? IdempotencyKey = null);

public record UpdateResultDraftRequest(
    Guid OperatingBranchId,
    int ExpectedRowVersion,
    string? NumericValue = null,
    string? QualitativeValue = null,
    string? Unit = null,
    string? Comment = null,
    string? IdempotencyKey = null);

public record VerifyResultRequest(
    Guid OperatingBranchId,
    int ExpectedRowVersion,
    int? ExpectedCurrentVersionNumber = null,
    string? IdempotencyKey = null);

public record AuthorizeResultRequest(
    Guid OperatingBranchId,
    int ExpectedRowVersion,
    int? ExpectedCurrentVersionNumber = null,
    string? IdempotencyKey = null);
