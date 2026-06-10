using AuthService.DTOs.Billing;

namespace AuthService.Services.Interfaces;

/// <summary>
/// CRUD for global service catalog (categories → services → variants + global prices).
/// S2 admin API — complements read-only <see cref="IServiceCatalogService"/>.
/// </summary>
public interface IServiceCatalogAdminService
{
    Task<FullCatalogResponse> GetAdminCatalogAsync(bool includeInactive = false);

    Task<ServiceCategoryDto> CreateCategoryAsync(CreateServiceCategoryRequest request, Guid userId);
    Task<ServiceCategoryDto> UpdateCategoryAsync(Guid categoryId, UpdateServiceCategoryRequest request, Guid userId);
    Task DeleteCategoryAsync(Guid categoryId, Guid userId);

    Task<CatalogServiceDto> CreateServiceAsync(Guid categoryId, CreateCatalogServiceRequest request, Guid userId);
    Task<CatalogServiceDto> UpdateServiceAsync(Guid serviceId, UpdateCatalogServiceRequest request, Guid userId);
    Task DeleteServiceAsync(Guid serviceId, Guid userId);

    Task<ServiceVariantDto> CreateVariantAsync(Guid serviceId, CreateServiceVariantRequest request, Guid userId);
    Task<ServiceVariantDto> UpdateVariantAsync(Guid variantId, UpdateServiceVariantRequest request, Guid userId);
    Task DeleteVariantAsync(Guid variantId, Guid userId);

    Task<List<IolMasterAdminDto>> GetIolCatalogAsync(bool includeInactive = false);
    Task<IolMasterAdminDto> CreateIolAsync(CreateIolMasterRequest request, Guid userId);
    Task<IolMasterAdminDto> UpdateIolAsync(Guid iolId, UpdateIolMasterRequest request, Guid userId);
    Task DeleteIolAsync(Guid iolId, Guid userId);

    Task<List<VariantIolMappingAdminDto>> GetVariantIolMappingsAsync(Guid variantId);
    Task<List<VariantIolMappingAdminDto>> SetVariantIolMappingsAsync(
        Guid variantId,
        SetVariantIolMappingsRequest request,
        Guid userId);

    Task<List<BranchPricingRowDto>> GetBranchPricingRowsAsync(Guid branchId);
    Task<BranchVariantPricingDto> UpsertBranchVariantPriceAsync(
        Guid branchId,
        UpsertBranchVariantPriceRequest request,
        Guid userId);
    Task RemoveBranchVariantPriceAsync(Guid branchId, Guid variantId, Guid userId);
}
