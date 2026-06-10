using System.ComponentModel.DataAnnotations;

namespace AuthService.DTOs.Billing;

// ============================================================================
// SERVICE CATALOG ADMIN — write DTOs (S2)
// Global catalog (no tenant_id). Requires master_data.manage.
// ============================================================================

public class CreateServiceCategoryRequest
{
    [Required, MaxLength(50)]
    public string Code { get; set; } = string.Empty;

    [Required, MaxLength(200)]
    public string Name { get; set; } = string.Empty;

    public string? Description { get; set; }
    public int DisplayOrder { get; set; }
    public bool IsActive { get; set; } = true;
}

public class UpdateServiceCategoryRequest
{
    [MaxLength(50)]
    public string? Code { get; set; }

    [MaxLength(200)]
    public string? Name { get; set; }

    public string? Description { get; set; }
    public int? DisplayOrder { get; set; }
    public bool? IsActive { get; set; }
}

public class CreateCatalogServiceRequest
{
    [Required, MaxLength(200)]
    public string Name { get; set; } = string.Empty;

    [MaxLength(50)]
    public string? Code { get; set; }

    public string? Description { get; set; }
    public int DisplayOrder { get; set; }
    public bool IsActive { get; set; } = true;
}

public class UpdateCatalogServiceRequest
{
    [MaxLength(200)]
    public string? Name { get; set; }

    [MaxLength(50)]
    public string? Code { get; set; }

    public string? Description { get; set; }
    public int? DisplayOrder { get; set; }
    public bool? IsActive { get; set; }
}

public class CreateServiceVariantRequest
{
    [Required, MaxLength(200)]
    public string Name { get; set; } = string.Empty;

    [MaxLength(50)]
    public string? Code { get; set; }

    [Range(0, double.MaxValue)]
    public decimal Price { get; set; }

    [Required, MaxLength(20)]
    public string PriceType { get; set; } = "FIXED";

    public bool HasIolOptions { get; set; }
    public string? Description { get; set; }
    public int DisplayOrder { get; set; }
    public bool IsActive { get; set; } = true;
    public string[]? SubOptions { get; set; }
}

public class UpdateServiceVariantRequest
{
    [MaxLength(200)]
    public string? Name { get; set; }

    [MaxLength(50)]
    public string? Code { get; set; }

    [Range(0, double.MaxValue)]
    public decimal? Price { get; set; }

    [MaxLength(20)]
    public string? PriceType { get; set; }

    public bool? HasIolOptions { get; set; }
    public string? Description { get; set; }
    public int? DisplayOrder { get; set; }
    public bool? IsActive { get; set; }
    public string[]? SubOptions { get; set; }
}

public class AdminCatalogQuery
{
    public bool IncludeInactive { get; set; }
}

// ── IOL master + variant mapping ───────────────────────────────────────────

public class IolMasterAdminDto
{
    public Guid Id { get; set; }
    public string ModelName { get; set; } = string.Empty;
    public string BrandManufacturer { get; set; } = string.Empty;
    public string IolType { get; set; } = string.Empty;
    public string Origin { get; set; } = string.Empty;
    public decimal Price { get; set; }
    public string? ProductCode { get; set; }
    public int DisplayOrder { get; set; }
    public bool IsActive { get; set; }
}

public class CreateIolMasterRequest
{
    [Required, MaxLength(200)]
    public string ModelName { get; set; } = string.Empty;

    [Required, MaxLength(200)]
    public string BrandManufacturer { get; set; } = string.Empty;

    [MaxLength(50)]
    public string IolType { get; set; } = "Monofocal";

    [MaxLength(50)]
    public string Origin { get; set; } = "Imported";

    [Range(0, double.MaxValue)]
    public decimal Price { get; set; }

    [MaxLength(100)]
    public string? ProductCode { get; set; }

    public int DisplayOrder { get; set; }
    public bool IsActive { get; set; } = true;
}

public class UpdateIolMasterRequest
{
    [MaxLength(200)]
    public string? ModelName { get; set; }

    [MaxLength(200)]
    public string? BrandManufacturer { get; set; }

    [MaxLength(50)]
    public string? IolType { get; set; }

    [MaxLength(50)]
    public string? Origin { get; set; }

    [Range(0, double.MaxValue)]
    public decimal? Price { get; set; }

    [MaxLength(100)]
    public string? ProductCode { get; set; }

    public int? DisplayOrder { get; set; }
    public bool? IsActive { get; set; }
}

public class VariantIolMappingAdminDto
{
    public Guid MappingId { get; set; }
    public Guid IolMasterId { get; set; }
    public string ModelName { get; set; } = string.Empty;
    public string BrandManufacturer { get; set; } = string.Empty;
    public decimal Price { get; set; }
    public bool IsDefault { get; set; }
}

public class VariantIolLinkRequest
{
    [Required]
    public Guid IolMasterId { get; set; }

    public bool IsDefault { get; set; }
}

public class SetVariantIolMappingsRequest
{
    [Required]
    public List<VariantIolLinkRequest> Links { get; set; } = new();
}

// ── Branch variant pricing (variant_prices.branch_id) ────────────────────────

public class BranchPricingRowDto
{
    public Guid VariantId { get; set; }
    public string VariantCode { get; set; } = string.Empty;
    public string VariantName { get; set; } = string.Empty;
    public string CategoryCode { get; set; } = string.Empty;
    public decimal GlobalAmount { get; set; }
    public decimal? BranchAmount { get; set; }
}

public class UpsertBranchVariantPriceRequest
{
    [Required]
    public Guid VariantId { get; set; }

    [Range(0, double.MaxValue)]
    public decimal Amount { get; set; }
}
