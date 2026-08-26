namespace AuthService.DTOs.Billing;

// ============================================================================
// SERVICE CATALOG V2 DTOs
// ============================================================================
public class ServiceVariantDto
{
    public Guid Id { get; set; }
    public string Code { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
    public decimal Price { get; set; }
    public string PriceType { get; set; } = "FIXED"; // PER_EYE | BOTH_EYES | FIXED
    public bool HasIolOptions { get; set; }
    public int DisplayOrder { get; set; }
    public bool IsActive { get; set; }
    /// <summary>Internal brand/sub-type choices. Null when no sub-options exist. Staff-only — do not expose to patient or insurance output.</summary>
    public string[]? SubOptions { get; set; }
}

public class CatalogServiceDto
{
    public Guid Id { get; set; }
    public string Code { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
    public bool IsActive { get; set; }
    public List<ServiceVariantDto> Variants { get; set; } = new();
}

public class ServiceCategoryDto
{
    public Guid Id { get; set; }
    public string Code { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
    public int DisplayOrder { get; set; }
    public bool IsActive { get; set; }
    public List<CatalogServiceDto> Services { get; set; } = new();
}

public class IolMasterDto
{
    public Guid Id { get; set; }
    public string ModelName { get; set; } = string.Empty;
    public string BrandManufacturer { get; set; } = string.Empty;
    public string IolType { get; set; } = string.Empty;
    public string Origin { get; set; } = string.Empty;
    public decimal Price { get; set; }
    public bool IsDefault { get; set; }
}

public class FullCatalogResponse
{
    public List<ServiceCategoryDto> Categories { get; set; } = new();
}

public class BranchVariantPricingDto
{
    public Guid VariantId { get; set; }
    public decimal Amount { get; set; }
    public DateOnly? EffectiveFrom { get; set; }
    public DateOnly? EffectiveTo { get; set; }
    public bool IsActive { get; set; }
}

// Bill Item DTOs
public class BillItemDto
{
    public Guid Id { get; set; }
    public Guid OpdBillId { get; set; }
    public Guid? ServiceVariantId { get; set; }
    public int Quantity { get; set; }
    public decimal UnitPrice { get; set; }
    public decimal Subtotal { get; set; }
    public decimal DiscountAmount { get; set; }
    public decimal DiscountPercentage { get; set; }
    public string? DiscountReason { get; set; }
    public decimal TaxAmount { get; set; }
    public decimal TaxPercentage { get; set; }
    public decimal TotalAmount { get; set; }
    public Guid? PerformedByUserId { get; set; }
    public string? PerformedByName { get; set; }
    public DateTime? PerformedAt { get; set; }
    public string Status { get; set; } = string.Empty;
    public string? Notes { get; set; }
    public string ServiceCode { get; set; } = string.Empty;
    public string ServiceName { get; set; } = string.Empty;
    public string SourceType { get; set; } = "Manual";
    public Guid? SourceRefId { get; set; }
    public string? IdempotencyKey { get; set; }
}

public class AddBillItemRequest
{
    public Guid OpdBillId { get; set; }
    public Guid? ServiceVariantId { get; set; }
    public string? ServiceCode { get; set; }
    public int Quantity { get; set; } = 1;
    public decimal? UnitPriceOverride { get; set; }
    public decimal DiscountPercentage { get; set; } = 0;
    public string? DiscountReason { get; set; }
    public string? Notes { get; set; }
    public string? ServiceName { get; set; }
    public string? SourceType { get; set; }
    public Guid? SourceRefId { get; set; }
    public string? IdempotencyKey { get; set; }
}

public class UpdateBillItemRequest
{
    public int Quantity { get; set; }
    public decimal? UnitPriceOverride { get; set; }
    public decimal DiscountPercentage { get; set; }
    public string? DiscountReason { get; set; }
    public string Status { get; set; } = "pending";
    public string? Notes { get; set; }
}

public class BillSummaryDto
{
    public Guid BillId { get; set; }
    public string BillNumber { get; set; } = string.Empty;
    public int TotalItems { get; set; }
    public decimal Subtotal { get; set; }
    public decimal TotalDiscount { get; set; }
    public decimal TotalTax { get; set; }
    public decimal NetAmount { get; set; }
    public List<BillItemDto> Items { get; set; } = new();
}
