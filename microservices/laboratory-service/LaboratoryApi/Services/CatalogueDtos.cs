namespace LaboratoryApi.Services;

public record CatalogueListQuery(
    string? Search = null,
    string? CatalogueType = null,
    string? Discipline = null,
    string? Status = null,
    string? Classification = null,
    Guid? BranchId = null,
    int Page = 1,
    int PageSize = 25);

public record PanelComponentInput(
    Guid ComponentCatalogueItemId,
    Guid ComponentVersionId,
    int SortOrder,
    bool IsRequired = true);

public record CreateCatalogueDraftRequest(
    string CatalogueType,
    string InternalOrderCode,
    string DisplayName,
    string Discipline,
    string? Synonyms = null,
    string? Method = null,
    string? Classification = null,
    bool Orderable = true,
    string? PreparationInstruction = null,
    string? SpecimenTypeRef = null,
    string? ContainerRef = null,
    string? RequiredVolume = null,
    string? PatientPreparation = null,
    string? ReferralPartnerRef = null,
    string? ServiceCatalogRef = null,
    string? ChangeReason = null,
    DateTime? EffectiveFrom = null,
    DateTime? EffectiveTo = null,
    IReadOnlyList<Guid>? BranchIds = null,
    IReadOnlyList<PanelComponentInput>? PanelComponents = null);

public record UpdateCatalogueDraftRequest(
    string? InternalOrderCode = null,
    string? DisplayName = null,
    string? Discipline = null,
    string? Synonyms = null,
    string? Method = null,
    string? Classification = null,
    bool? Orderable = null,
    string? PreparationInstruction = null,
    string? SpecimenTypeRef = null,
    string? ContainerRef = null,
    string? RequiredVolume = null,
    string? PatientPreparation = null,
    string? ReferralPartnerRef = null,
    string? ServiceCatalogRef = null,
    string? ChangeReason = null,
    DateTime? EffectiveFrom = null,
    DateTime? EffectiveTo = null,
    bool ClearEffectiveTo = false,
    IReadOnlyList<Guid>? BranchIds = null,
    IReadOnlyList<PanelComponentInput>? PanelComponents = null,
    int ExpectedRowVersion = 0);

public record LifecycleActionRequest(
    string? Reason = null,
    DateTime? EffectiveFrom = null,
    DateTime? EffectiveTo = null,
    int ExpectedRowVersion = 0);

public record PanelComponentDto(
    Guid Id,
    Guid ComponentCatalogueItemId,
    Guid ComponentVersionId,
    int SortOrder,
    bool IsRequired,
    string? ComponentDisplayName,
    string? ComponentInternalCode);

public record CatalogueVersionDto(
    Guid Id,
    Guid CatalogueItemId,
    string CatalogueType,
    int VersionNumber,
    string Status,
    string InternalOrderCode,
    string DisplayName,
    string? Synonyms,
    string Discipline,
    string? Method,
    string Classification,
    bool Orderable,
    string? PreparationInstruction,
    string? SpecimenTypeRef,
    string? ContainerRef,
    string? RequiredVolume,
    string? PatientPreparation,
    string? ReferralPartnerRef,
    string? ServiceCatalogRef,
    string? ChangeReason,
    DateTime? EffectiveFrom,
    DateTime? EffectiveTo,
    DateTime CreatedAt,
    Guid CreatedBy,
    DateTime? SubmittedAt,
    Guid? SubmittedBy,
    DateTime? ApprovedAt,
    Guid? ApprovedBy,
    DateTime? ActivatedAt,
    Guid? ActivatedBy,
    DateTime? RetiredAt,
    Guid? RetiredBy,
    DateTime? SupersededAt,
    Guid? SupersededBy,
    Guid? SupersededByVersionId,
    int RowVersion,
    IReadOnlyList<Guid> BranchIds,
    IReadOnlyList<PanelComponentDto> PanelComponents,
    bool IsTenantWide);

public record CatalogueItemDetailDto(
    Guid Id,
    Guid TenantId,
    string CatalogueType,
    Guid? CurrentActiveVersionId,
    Guid? LatestVersionId,
    DateTime CreatedAt,
    Guid CreatedBy,
    CatalogueVersionDto? CurrentVersion,
    IReadOnlyList<CatalogueVersionSummaryDto> VersionHistory);

public record CatalogueVersionSummaryDto(
    Guid Id,
    int VersionNumber,
    string Status,
    string InternalOrderCode,
    string DisplayName,
    DateTime? EffectiveFrom,
    DateTime? EffectiveTo,
    DateTime CreatedAt,
    Guid? SupersededByVersionId);

public record CatalogueListItemDto(
    Guid Id,
    Guid LatestVersionId,
    string CatalogueType,
    string InternalOrderCode,
    string DisplayName,
    string? Synonyms,
    string Discipline,
    string Classification,
    string Status,
    int VersionNumber,
    DateTime? EffectiveFrom,
    DateTime? EffectiveTo,
    bool IsTenantWide,
    IReadOnlyList<Guid> BranchIds);

public record PagedResult<T>(IReadOnlyList<T> Items, int Page, int PageSize, int TotalCount);

public class CatalogueDomainException : Exception
{
    public int StatusCode { get; }
    public string Code { get; }

    public CatalogueDomainException(string message, int statusCode = 400, string code = "validation_error")
        : base(message)
    {
        StatusCode = statusCode;
        Code = code;
    }
}
