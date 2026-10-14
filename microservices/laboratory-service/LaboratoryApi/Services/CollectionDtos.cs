namespace LaboratoryApi.Services;

public class CollectionDomainException : Exception
{
    public int StatusCode { get; }
    public string? Code { get; }

    public CollectionDomainException(string message, int statusCode = 400, string? code = null)
        : base(message)
    {
        StatusCode = statusCode;
        Code = code;
    }
}

public record CreateCollectionTaskRequest(
    Guid OrderId,
    Guid CollectionBranchId,
    IReadOnlyList<Guid> OrderTestIds,
    string? LocationText = null,
    string? Notes = null,
    string? IdempotencyKey = null);

public record TransitionCollectionTaskRequest(
    int ExpectedRowVersion,
    string TargetStatus,
    string? Reason = null,
    string? IdempotencyKey = null);

public record ClaimCollectionTaskRequest(
    int ExpectedRowVersion,
    string? IdempotencyKey = null);

public record AssignCollectionTaskRequest(
    int ExpectedRowVersion,
    Guid AssignToUserId,
    string? IdempotencyKey = null);

public record ReleaseCollectionTaskRequest(
    int ExpectedRowVersion,
    string? IdempotencyKey = null);

public record CollectionTaskListQuery(
    string? Status = null,
    Guid? CollectionBranchId = null,
    Guid? OrderId = null,
    string? Search = null,
    int Page = 1,
    int PageSize = 25);

public record CollectionTaskOrderTestDto(
    Guid Id,
    Guid OrderTestId,
    Guid OrderId,
    int SortOrder,
    string? DisplayNameSnapshot,
    string? InternalOrderCodeSnapshot,
    string? OrderTestStatus);

public record CollectionTaskListItemDto(
    Guid Id,
    string TaskNumber,
    Guid OrderId,
    string OrderNumber,
    Guid CollectionBranchId,
    string Status,
    Guid? ClaimedByUserId,
    Guid? AssignedToUserId,
    string? PatientNameSnapshot,
    string? PatientMrnSnapshot,
    int OrderTestCount,
    DateTime CreatedAt,
    int RowVersion);

public record CollectionTaskDetailDto(
    Guid Id,
    string TaskNumber,
    Guid OrderId,
    string OrderNumber,
    Guid CollectionBranchId,
    string? LocationText,
    string Status,
    Guid? ClaimedByUserId,
    DateTime? ClaimedAt,
    Guid? AssignedToUserId,
    DateTime? AssignedAt,
    string? Notes,
    string? CancelReason,
    DateTime CreatedAt,
    Guid CreatedBy,
    DateTime? UpdatedAt,
    Guid? UpdatedBy,
    int RowVersion,
    string? PatientNameSnapshot,
    string? PatientMrnSnapshot,
    DateTime? PatientDateOfBirthSnapshot,
    Guid? PatientId,
    Guid? VisitId,
    IReadOnlyList<CollectionTaskOrderTestDto> OrderTests);

public record CollectionPlanContextOrderTestDto(
    Guid OrderTestId,
    string DisplayNameSnapshot,
    string InternalOrderCodeSnapshot,
    string Status,
    int SortOrder,
    bool AlreadyPlanned);

public record CollectionPlanContextDto(
    Guid OrderId,
    string OrderNumber,
    string OrderStatus,
    Guid OperatingBranchId,
    Guid PatientId,
    string? PatientMrnSnapshot,
    string? PatientNameSnapshot,
    Guid? VisitId,
    IReadOnlyList<CollectionPlanContextOrderTestDto> OrderTests);
