using System;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using Microsoft.EntityFrameworkCore;

namespace AuthService.Models.Domain
{
    /// <summary>
    /// Master counselling package linked to service-catalog procedure variant, IOL, and investigations.
    /// Maps to: counselling_package_templates
    /// </summary>
    [Table("counselling_package_templates")]
    public class CounsellingPackageTemplate
    {
        [Column("id")]
        public Guid Id { get; set; }

        [Column("tenant_id")]
        public Guid TenantId { get; set; }

        [Column("code")]
        [MaxLength(50)]
        public string Code { get; set; } = string.Empty;

        [Column("name")]
        [MaxLength(200)]
        public string Name { get; set; } = string.Empty;

        [Column("description")]
        public string? Description { get; set; }

        [Column("category")]
        [MaxLength(50)]
        public string? Category { get; set; }

        [Column("package_amount")]
        [Precision(12, 2)]
        public decimal PackageAmount { get; set; }

        [Column("currency")]
        [MaxLength(10)]
        public string Currency { get; set; } = "INR";

        [Column("procedure_variant_id")]
        public Guid? ProcedureVariantId { get; set; }

        [Column("default_eye")]
        [MaxLength(10)]
        public string DefaultEye { get; set; } = "RE";

        [Column("variant_sub_option")]
        [MaxLength(100)]
        public string? VariantSubOption { get; set; }

        [Column("iol_id")]
        public Guid? IolId { get; set; }

        /// <summary>JSON array of investigation catalog IDs (strings).</summary>
        [Column("investigation_ids", TypeName = "jsonb")]
        public string InvestigationIdsJson { get; set; } = "[]";

        [Column("max_discount_percent")]
        [Precision(5, 2)]
        public decimal MaxDiscountPercent { get; set; } = 50m;

        /// <summary>Maps to legacy counsellor.surgery_package master code (e.g. PHACO_STD).</summary>
        [Column("legacy_master_code")]
        [MaxLength(50)]
        public string? LegacyMasterCode { get; set; }

        [Column("is_default")]
        public bool IsDefault { get; set; }

        [Column("sort_order")]
        public int SortOrder { get; set; }

        [Column("is_active")]
        public bool IsActive { get; set; } = true;

        [Column("created_at")]
        public DateTime CreatedAt { get; set; }

        [Column("updated_at")]
        public DateTime? UpdatedAt { get; set; }

        [Column("created_by_user_id")]
        public Guid? CreatedByUserId { get; set; }

        [Column("updated_by_user_id")]
        public Guid? UpdatedByUserId { get; set; }

        [Column("deleted_at")]
        public DateTime? DeletedAt { get; set; }
    }
}
