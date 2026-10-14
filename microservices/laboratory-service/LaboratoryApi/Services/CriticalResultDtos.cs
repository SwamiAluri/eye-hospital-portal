namespace LaboratoryApi.Services;

public record CreateCriticalEventRequest(
    Guid OperatingBranchId,
    int? ExpectedResultVersionNumber = null,
    string? IdempotencyKey = null);

public record AcknowledgeCriticalEventRequest(
    Guid OperatingBranchId,
    int ExpectedRowVersion,
    string AcknowledgementEvidence,
    string? IdempotencyKey = null);

public record CriticalEventDto(
    Guid Id,
    Guid ResultId,
    int ResultVersionNumber,
    Guid OperatingBranchId,
    string Status,
    string ResultStatus,
    Guid ClassifiedByUserId,
    DateTime ClassifiedAtUtc,
    Guid? AcknowledgedByUserId,
    DateTime? AcknowledgedAtUtc,
    string? AcknowledgementEvidence,
    string NotificationIntentStatus,
    string? NotificationIntentDetail,
    int RowVersion,
    Guid OrderId,
    string? OrderNumber,
    Guid OrderTestId,
    Guid SpecimenId,
    Guid PatientId,
    string? PatientMrn,
    string? PatientName,
    string? TestDisplayName,
    string? InternalOrderCode);

public record CriticalWorkQueueQuery(
    Guid? OperatingBranchId,
    string? Status = null,
    string? Search = null,
    int Page = 1,
    int PageSize = 25);

public record CriticalWorkQueueItemDto(
    Guid CriticalEventId,
    Guid ResultId,
    int ResultVersionNumber,
    string CriticalStatus,
    string ResultStatus,
    Guid OperatingBranchId,
    DateTime ClassifiedAtUtc,
    Guid ClassifiedByUserId,
    DateTime? AcknowledgedAtUtc,
    Guid? AcknowledgedByUserId,
    string NotificationIntentStatus,
    Guid OrderId,
    string OrderNumber,
    Guid OrderTestId,
    Guid SpecimenId,
    Guid PatientId,
    string? PatientMrn,
    string? PatientName,
    string TestDisplayName,
    string InternalOrderCode,
    int RowVersion);

public record CriticalWorkQueuePageDto(
    IReadOnlyList<CriticalWorkQueueItemDto> Items,
    int Page,
    int PageSize,
    int TotalCount);
