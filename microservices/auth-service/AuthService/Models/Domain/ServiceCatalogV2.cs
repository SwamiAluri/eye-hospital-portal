using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace AuthService.Models.Domain;

// ============================================================================
// SERVICE CATALOG V2 — Domain Entities
// Hierarchy:
//   service_categories → catalog_services → service_variants
//                                           ├─ variant_prices  (global + branch overrides)
//                                           └─ variant_iol_mapping → iol_master → iol_prices
// All catalog tables: global (no tenant_id), UUID PKs.
// Pricing is fully normalised — no default_price columns on variants or IOLs.
// ============================================================================

[Table("service_categories")]
public class ServiceCategory
{
    [Key]
    [Column("id")]
    public Guid Id { get; set; }

    [Required]
    [Column("name")]
    [MaxLength(200)]
    public string Name { get; set; } = string.Empty;

    [Required]
    [Column("code")]
    [MaxLength(50)]
    public string Code { get; set; } = string.Empty;

    [Column("description")]
    public string? Description { get; set; }

    [Column("display_order")]
    public int DisplayOrder { get; set; } = 0;

    [Column("is_active")]
    public bool IsActive { get; set; } = true;

    [Column("created_at")]
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    [Column("updated_at")]
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;

    [Column("created_by_user_id")]
    public Guid? CreatedByUserId { get; set; }

    [Column("updated_by_user_id")]
    public Guid? UpdatedByUserId { get; set; }

    [Column("deleted_at")]
    public DateTime? DeletedAt { get; set; }

    [Column("status")]
    [MaxLength(50)]
    public string Status { get; set; } = "active";

    // Navigation
    public virtual ICollection<CatalogService> Services { get; set; } = new List<CatalogService>();
}

[Table("catalog_services")]
public class CatalogService
{
    [Key]
    [Column("id")]
    public Guid Id { get; set; }

    [Required]
    [Column("category_id")]
    public Guid CategoryId { get; set; }

    [Required]
    [Column("service_name")]
    [MaxLength(200)]
    public string ServiceName { get; set; } = string.Empty;

    [Column("service_code")]
    [MaxLength(50)]
    public string? ServiceCode { get; set; }

    [Column("description")]
    public string? Description { get; set; }

    [Column("is_active")]
    public bool IsActive { get; set; } = true;

    [Column("display_order")]
    public int DisplayOrder { get; set; } = 0;

    [Column("created_at")]
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    [Column("updated_at")]
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;

    [Column("created_by_user_id")]
    public Guid? CreatedByUserId { get; set; }

    [Column("updated_by_user_id")]
    public Guid? UpdatedByUserId { get; set; }

    [Column("deleted_at")]
    public DateTime? DeletedAt { get; set; }

    [Column("status")]
    [MaxLength(50)]
    public string Status { get; set; } = "active";

    // Navigation
    [ForeignKey("CategoryId")]
    public virtual ServiceCategory Category { get; set; } = null!;

    public virtual ICollection<ServiceVariant> Variants { get; set; } = new List<ServiceVariant>();
}

[Table("service_variants")]
public class ServiceVariant
{
    [Key]
    [Column("id")]
    public Guid Id { get; set; }

    [Required]
    [Column("catalog_service_id")]
    public Guid CatalogServiceId { get; set; }

    [Required]
    [Column("variant_name")]
    [MaxLength(200)]
    public string VariantName { get; set; } = string.Empty;

    [Column("variant_code")]
    [MaxLength(50)]
    public string? VariantCode { get; set; }

    /// <summary>PER_EYE | BOTH_EYES | FIXED</summary>
    [Column("price_type")]
    [MaxLength(20)]
    public string PriceType { get; set; } = "PER_EYE";

    [Column("has_iol_options")]
    public bool HasIolOptions { get; set; } = false;

    [Column("description")]
    public string? Description { get; set; }

    [Column("is_active")]
    public bool IsActive { get; set; } = true;

    [Column("display_order")]
    public int DisplayOrder { get; set; } = 0;

    /// <summary>Internal-only brand/sub-type options (e.g. ["Supraphob", "Premium"]).  NOT exposed to patient or insurance views.</summary>
    [Column("sub_options")]
    public string[]? SubOptions { get; set; }

    [Column("created_at")]
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    [Column("updated_at")]
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;

    [Column("created_by_user_id")]
    public Guid? CreatedByUserId { get; set; }

    [Column("updated_by_user_id")]
    public Guid? UpdatedByUserId { get; set; }

    [Column("deleted_at")]
    public DateTime? DeletedAt { get; set; }

    [Column("status")]
    [MaxLength(50)]
    public string Status { get; set; } = "active";

    // Navigation
    [ForeignKey("CatalogServiceId")]
    public virtual CatalogService CatalogService { get; set; } = null!;

    public virtual ICollection<VariantIolMapping> IolMappings { get; set; } = new List<VariantIolMapping>();
    public virtual ICollection<VariantPrice> Prices { get; set; } = new List<VariantPrice>();
}

[Table("iol_master")]
public class IolMaster
{
    [Key]
    [Column("id")]
    public Guid Id { get; set; }

    [Required]
    [Column("model_name")]
    [MaxLength(200)]
    public string ModelName { get; set; } = string.Empty;

    [Required]
    [Column("brand_manufacturer")]
    [MaxLength(200)]
    public string BrandManufacturer { get; set; } = string.Empty;

    [Column("iol_type")]
    [MaxLength(50)]
    public string IolType { get; set; } = "Monofocal";

    [Column("origin")]
    [MaxLength(50)]
    public string Origin { get; set; } = "Imported";

    [Column("material")]
    [MaxLength(100)]
    public string? Material { get; set; }

    [Column("a_constant")]
    public decimal? AConstant { get; set; }

    [Column("power_range_min")]
    public decimal? PowerRangeMin { get; set; }

    [Column("power_range_max")]
    public decimal? PowerRangeMax { get; set; }

    [Column("power_increment")]
    public decimal? PowerIncrement { get; set; }

    [Column("currency_code")]
    [MaxLength(10)]
    public string CurrencyCode { get; set; } = "INR";

    [Column("product_code")]
    [MaxLength(100)]
    public string? ProductCode { get; set; }

    [Column("is_active")]
    public bool IsActive { get; set; } = true;

    [Column("display_order")]
    public int DisplayOrder { get; set; } = 0;

    [Column("created_at")]
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    [Column("updated_at")]
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;

    [Column("created_by_user_id")]
    public Guid? CreatedByUserId { get; set; }

    [Column("updated_by_user_id")]
    public Guid? UpdatedByUserId { get; set; }

    [Column("deleted_at")]
    public DateTime? DeletedAt { get; set; }

    [Column("status")]
    [MaxLength(50)]
    public string Status { get; set; } = "active";

    // Navigation
    public virtual ICollection<IolPrice> Prices { get; set; } = new List<IolPrice>();
}

[Table("variant_iol_mapping")]
public class VariantIolMapping
{
    [Key]
    [Column("id")]
    public Guid Id { get; set; }

    [Required]
    [Column("variant_id")]
    public Guid VariantId { get; set; }

    [Required]
    [Column("iol_master_id")]
    public Guid IolMasterId { get; set; }

    [Column("is_default")]
    public bool IsDefault { get; set; } = false;

    [Column("created_at")]
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    [Column("updated_at")]
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;

    [Column("created_by_user_id")]
    public Guid? CreatedByUserId { get; set; }

    [Column("updated_by_user_id")]
    public Guid? UpdatedByUserId { get; set; }

    [Column("deleted_at")]
    public DateTime? DeletedAt { get; set; }

    [Column("status")]
    [MaxLength(50)]
    public string Status { get; set; } = "active";

    // Navigation
    [ForeignKey("VariantId")]
    public virtual ServiceVariant Variant { get; set; } = null!;

    [ForeignKey("IolMasterId")]
    public virtual IolMaster IolMaster { get; set; } = null!;
}

// ============================================================================
// VARIANT PRICES — normalised price table for service_variants
// branch_id NULL  = global tariff (used everywhere by default)
// branch_id ≠ NULL = branch-specific override
// effective_to NULL = currently active record
// ============================================================================
[Table("variant_prices")]
public class VariantPrice
{
    [Key]
    [Column("id")]
    public Guid Id { get; set; }

    [Required]
    [Column("variant_id")]
    public Guid VariantId { get; set; }

    /// <summary>NULL = global tariff; non-null = branch-specific override</summary>
    [Column("branch_id")]
    public Guid? BranchId { get; set; }

    /// <summary>NULL = catalog tariff; non-null = insurer/corporate overlay (ccms_insurance_providers.id)</summary>
    [Column("payer_id")]
    public Guid? PayerId { get; set; }

    [Column("amount")]
    public decimal Amount { get; set; } = 0;

    [Column("effective_from")]
    public DateOnly? EffectiveFrom { get; set; }

    /// <summary>NULL means this price is currently active</summary>
    [Column("effective_to")]
    public DateOnly? EffectiveTo { get; set; }

    [Column("is_active")]
    public bool IsActive { get; set; } = true;

    [Column("created_at")]
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    [Column("updated_at")]
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;

    [Column("created_by_user_id")]
    public Guid? CreatedByUserId { get; set; }

    [Column("updated_by_user_id")]
    public Guid? UpdatedByUserId { get; set; }

    [Column("deleted_at")]
    public DateTime? DeletedAt { get; set; }

    [Column("status")]
    [MaxLength(50)]
    public string Status { get; set; } = "active";

    // Navigation
    [ForeignKey("VariantId")]
    public virtual ServiceVariant Variant { get; set; } = null!;
}

// ============================================================================
// IOL PRICES — normalised price table for iol_master
// ============================================================================
[Table("iol_prices")]
public class IolPrice
{
    [Key]
    [Column("id")]
    public Guid Id { get; set; }

    [Required]
    [Column("iol_master_id")]
    public Guid IolMasterId { get; set; }

    /// <summary>NULL = global tariff; non-null = branch-specific override</summary>
    [Column("branch_id")]
    public Guid? BranchId { get; set; }

    [Column("amount")]
    public decimal Amount { get; set; } = 0;

    [Column("effective_from")]
    public DateOnly? EffectiveFrom { get; set; }

    /// <summary>NULL means this price is currently active</summary>
    [Column("effective_to")]
    public DateOnly? EffectiveTo { get; set; }

    [Column("is_active")]
    public bool IsActive { get; set; } = true;

    [Column("created_at")]
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    [Column("updated_at")]
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;

    [Column("created_by_user_id")]
    public Guid? CreatedByUserId { get; set; }

    [Column("updated_by_user_id")]
    public Guid? UpdatedByUserId { get; set; }

    [Column("deleted_at")]
    public DateTime? DeletedAt { get; set; }

    [Column("status")]
    [MaxLength(50)]
    public string Status { get; set; } = "active";

    // Navigation
    [ForeignKey("IolMasterId")]
    public virtual IolMaster IolMaster { get; set; } = null!;
}
