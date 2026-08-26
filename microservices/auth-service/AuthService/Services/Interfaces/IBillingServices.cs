using AuthService.DTOs.Billing;

namespace AuthService.Services.Interfaces;

public interface IServiceCatalogService
{
    Task<FullCatalogResponse> GetFullCatalogAsync();
    Task<List<ServiceCategoryDto>> GetCategoriesAsync();
    Task<List<IolMasterDto>> GetVariantIolOptionsAsync(Guid variantId);
    Task<List<BranchVariantPricingDto>> GetBranchPricingAsync(Guid branchId);
}

public sealed record StagedBillItem(BillItemDto Item, bool Created);

public interface IBillItemService
{
    Task<List<BillItemDto>> GetBillItemsAsync(Guid billId, Guid tenantId);
    Task<BillItemDto?> GetBillItemByIdAsync(Guid id, Guid tenantId);
    Task<BillItemDto> AddBillItemAsync(AddBillItemRequest request, Guid tenantId, Guid userId);
    /// <summary>Stages a line on the shared DbContext without SaveChanges so a batch can commit atomically.</summary>
    Task<StagedBillItem> StageBillItemAsync(AddBillItemRequest request, Guid tenantId, Guid userId);
    Task<BillItemDto> UpdateBillItemAsync(Guid id, UpdateBillItemRequest request, Guid tenantId, Guid userId);
    Task<bool> DeleteBillItemAsync(Guid id, Guid tenantId, Guid userId);
    Task<BillSummaryDto> GetBillSummaryAsync(Guid billId, Guid tenantId);
    Task<BillSummaryDto> RecalculateBillAsync(Guid billId, Guid tenantId);
}
