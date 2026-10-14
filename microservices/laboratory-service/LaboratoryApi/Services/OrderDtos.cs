using LaboratoryApi.Domain;

namespace LaboratoryApi.Services;

public class OrderDomainException : Exception
{
    public int StatusCode { get; }
    public string? Code { get; }

    public OrderDomainException(string message, int statusCode = 400, string? code = null)
        : base(message)
    {
        StatusCode = statusCode;
        Code = code;
    }
}

public record OrderSelectionInput(Guid CatalogueItemId, int SortOrder = 0);

public record CreateOrderDraftRequest(
    Guid PatientId,
    Guid? VisitId,
    Guid OrderingProviderUserId,
    Guid ResponsibleClinicianUserId,
    Guid OperatingBranchId,
    string OrderSource,
    string Priority,
    string? PriorityReason,
    string ClinicalIndication,
    string? Notes,
    IReadOnlyList<OrderSelectionInput> Selections,
    string? ConsentReference = null,
    string? ConsentTemplateVersionRef = null,
    string? AcknowledgementEvidence = null,
    string? PayerContextRef = null,
    string? AuthorizationReference = null,
    string? FinancialDispositionRef = null,
    string? ServiceCatalogRef = null,
    string? ClientOrderNumber = null,
    string? IdempotencyKey = null);

public record UpdateOrderDraftRequest(
    int ExpectedRowVersion,
    Guid PatientId,
    Guid? VisitId,
    Guid OrderingProviderUserId,
    Guid ResponsibleClinicianUserId,
    Guid OperatingBranchId,
    string OrderSource,
    string Priority,
    string? PriorityReason,
    string ClinicalIndication,
    string? Notes,
    IReadOnlyList<OrderSelectionInput> Selections,
    string? ConsentReference = null,
    string? ConsentTemplateVersionRef = null,
    string? AcknowledgementEvidence = null,
    string? PayerContextRef = null,
    string? AuthorizationReference = null,
    string? FinancialDispositionRef = null,
    string? ServiceCatalogRef = null);

public record SubmitOrderRequest(int ExpectedRowVersion, string? IdempotencyKey = null);

public record AmendOrderRequest(
    int ExpectedRowVersion,
    string AmendmentReason,
    Guid PatientId,
    Guid? VisitId,
    Guid OrderingProviderUserId,
    Guid ResponsibleClinicianUserId,
    Guid OperatingBranchId,
    string OrderSource,
    string Priority,
    string? PriorityReason,
    string ClinicalIndication,
    string? Notes,
    IReadOnlyList<OrderSelectionInput> Selections,
    string? ConsentReference = null,
    string? ConsentTemplateVersionRef = null,
    string? AcknowledgementEvidence = null,
    string? PayerContextRef = null,
    string? AuthorizationReference = null,
    string? FinancialDispositionRef = null,
    string? ServiceCatalogRef = null,
    string? IdempotencyKey = null);

public record CancelOrderRequest(int ExpectedRowVersion, string Reason, string? IdempotencyKey = null);

public record OrderListQuery(
    string? Status = null,
    Guid? PatientId = null,
    Guid? OperatingBranchId = null,
    string? Search = null,
    int Page = 1,
    int PageSize = 25);

public record OrderSelectionDto(
    Guid Id,
    Guid CatalogueItemId,
    Guid? CatalogueVersionId,
    string CatalogueType,
    int SortOrder,
    string? DisplayNameSnapshot,
    string? InternalOrderCodeSnapshot);

public record OrderTestDto(
    Guid Id,
    Guid CatalogueItemId,
    Guid CatalogueVersionId,
    int CatalogueVersionNumber,
    string CatalogueType,
    string DisplayNameSnapshot,
    string InternalOrderCodeSnapshot,
    string Status,
    int SortOrder,
    Guid? PanelCatalogueItemId,
    Guid? PanelCatalogueVersionId,
    Guid? PanelSelectionId);

public record OrderVersionDto(
    Guid Id,
    int VersionNumber,
    Guid PatientId,
    string? PatientMrnSnapshot,
    string? PatientNameSnapshot,
    DateTime? PatientDateOfBirthSnapshot,
    Guid? VisitId,
    Guid OrderingProviderUserId,
    string? OrderingProviderNameSnapshot,
    Guid ResponsibleClinicianUserId,
    string? ResponsibleClinicianNameSnapshot,
    Guid OperatingBranchId,
    Guid PerformingBranchId,
    string OrderSource,
    string Priority,
    string? PriorityReason,
    string ClinicalIndication,
    string? Notes,
    string? ConsentReference,
    string? ConsentTemplateVersionRef,
    string? AcknowledgementEvidence,
    string? PayerContextRef,
    string? AuthorizationReference,
    string? FinancialDispositionRef,
    string? ServiceCatalogRef,
    string? AmendmentReason,
    DateTime CreatedAt,
    Guid CreatedBy,
    DateTime? SubmittedAt,
    Guid? SubmittedBy,
    IReadOnlyList<OrderSelectionDto> Selections,
    IReadOnlyList<OrderTestDto> Tests);

public record OrderDetailDto(
    Guid Id,
    string OrderNumber,
    string Status,
    int CurrentVersionNumber,
    Guid OperatingBranchId,
    int RowVersion,
    DateTime CreatedAt,
    Guid CreatedBy,
    DateTime? UpdatedAt,
    Guid? UpdatedBy,
    DateTime? CancelledAt,
    Guid? CancelledBy,
    string? CancelReason,
    OrderVersionDto? CurrentVersion);

public record OrderListItemDto(
    Guid Id,
    string OrderNumber,
    string Status,
    Guid PatientId,
    string? PatientNameSnapshot,
    Guid OperatingBranchId,
    string Priority,
    DateTime CreatedAt,
    int RowVersion);

public record OrderablesQuery(
    Guid OperatingBranchId,
    string? Search = null,
    string? CatalogueType = null,
    string? Discipline = null,
    string? Classification = null,
    int Page = 1,
    int PageSize = 25);

public record OrderableItemDto(
    Guid CatalogueItemId,
    Guid CatalogueVersionId,
    int VersionNumber,
    string CatalogueType,
    string InternalOrderCode,
    string DisplayName,
    string? Synonyms,
    string Discipline,
    string Classification,
    bool Orderable,
    DateTime? EffectiveFrom,
    DateTime? EffectiveTo,
    string? PreparationInstruction,
    string? SpecimenTypeRef,
    string? ExpectedTatConfigRef,
    string? ReferralPartnerRef,
    string? ServiceCatalogRef,
    IReadOnlyList<Guid> BranchIds,
    bool IsTenantWide);
