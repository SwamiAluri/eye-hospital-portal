namespace LaboratoryApi.Services;

public class SpecimenDomainException : Exception
{
    public int StatusCode { get; }
    public string Code { get; }

    public SpecimenDomainException(string message, int statusCode = 400, string code = "specimen_error")
        : base(message)
    {
        StatusCode = statusCode;
        Code = code;
    }
}

public record CompleteCollectionRequest(
    int ExpectedCollectionTaskRowVersion,
    bool PatientIdentityConfirmed,
    string? IdempotencyKey = null);

public record ReceiveSpecimenRequest(
    int ExpectedRowVersion,
    Guid ReceivingBranchId,
    bool PatientIdentityConfirmed,
    string ConfirmedMrn,
    string ConfirmedPatientName,
    DateTime ConfirmedDateOfBirth,
    string? ReceivingLocationText = null,
    string? IdempotencyKey = null);

public record RejectSpecimenRequest(
    int ExpectedRowVersion,
    Guid OperatingBranchId,
    string RejectionReasonCode,
    bool PatientIdentityConfirmed,
    string ConfirmedMrn,
    string ConfirmedPatientName,
    DateTime ConfirmedDateOfBirth,
    string? IdempotencyKey = null);

public record SpecimenListQuery(
    string? Status = null,
    Guid? CollectionBranchId = null,
    Guid? ReceivingBranchId = null,
    string? Search = null,
    int Page = 1,
    int PageSize = 25);

public record SpecimenListItemDto(
    Guid Id,
    string? Accession,
    string? BarcodeValue,
    string Status,
    string? PatientMrnSnapshot,
    string? PatientNameSnapshot,
    Guid OrderId,
    string OrderNumber,
    DateTime CollectedAt,
    Guid CollectionBranchId,
    Guid? ReceivingBranchId,
    int RowVersion);

public record SpecimenOrderTestDto(
    Guid Id,
    Guid OrderTestId,
    Guid OrderId,
    int SortOrder,
    string? DisplayNameSnapshot,
    string? InternalOrderCodeSnapshot,
    string? OrderTestStatus);

public record SpecimenRejectionReasonDto(string Code, string Label, int SortOrder);

public record SpecimenDetailDto(
    Guid Id,
    string Status,
    Guid CollectionTaskId,
    string? CollectionTaskNumber,
    Guid OrderId,
    string OrderNumber,
    Guid PatientId,
    string? PatientMrnSnapshot,
    string? PatientNameSnapshot,
    DateTime? PatientDateOfBirthSnapshot,
    Guid CollectionBranchId,
    string? LocationText,
    Guid CollectedByUserId,
    DateTime CollectedAt,
    string? Accession,
    string? BarcodeValue,
    Guid? BarcodeId,
    DateTime? ReceivedAtUtc,
    Guid? ReceivedByUserId,
    Guid? ReceivingBranchId,
    string? ReceivingLocationText,
    string? RejectionReasonCode,
    string? RejectionReasonLabelSnapshot,
    DateTime? RejectedAtUtc,
    Guid? RejectedByUserId,
    DateTime CreatedAt,
    Guid CreatedBy,
    DateTime? UpdatedAt,
    Guid? UpdatedBy,
    int RowVersion,
    IReadOnlyList<SpecimenOrderTestDto> OrderTests);

public record AssignBarcodeRequest(
    int ExpectedRowVersion,
    Guid OperatingBranchId,
    string? IdempotencyKey = null);

public record PrintSpecimenLabelRequest(
    int ExpectedRowVersion,
    Guid OperatingBranchId,
    string? IdempotencyKey = null);

public record ReprintSpecimenLabelRequest(
    int ExpectedRowVersion,
    Guid OperatingBranchId,
    string Reason,
    string? IdempotencyKey = null);

public record SpecimenBarcodeDto(
    Guid Id,
    Guid SpecimenId,
    string BarcodeValue,
    string FormatCode,
    string Symbology,
    DateTime IssuedAtUtc,
    Guid IssuedByUserId,
    bool IsActive,
    int SpecimenRowVersion);

public record SpecimenLabelPayloadDto(
    Guid SpecimenId,
    Guid BarcodeId,
    string BarcodeValue,
    string Symbology,
    string PatientMrn,
    string PatientName,
    string OrderNumber,
    DateTime CollectedAtUtc,
    string? Accession,
    string? SpecimenType,
    string? BranchName,
    Guid PrintEventId,
    string PrintType,
    DateTime PrintedAtUtc,
    int SpecimenRowVersion);
