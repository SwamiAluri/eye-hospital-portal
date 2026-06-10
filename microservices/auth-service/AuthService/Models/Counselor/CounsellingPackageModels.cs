using System;
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;

namespace AuthService.Models.Counselor
{
    public class CounsellingPackageTemplateDto
    {
        public Guid Id { get; set; }
        public Guid TenantId { get; set; }
        public string Code { get; set; } = string.Empty;
        public string Name { get; set; } = string.Empty;
        public string? Description { get; set; }
        public string? Category { get; set; }
        public decimal PackageAmount { get; set; }
        public string Currency { get; set; } = "INR";
        public Guid? ProcedureVariantId { get; set; }
        public string DefaultEye { get; set; } = "RE";
        public string? VariantSubOption { get; set; }
        public Guid? IolId { get; set; }
        public List<string> InvestigationIds { get; set; } = new();
        public decimal MaxDiscountPercent { get; set; } = 50m;
        public string? LegacyMasterCode { get; set; }
        public bool IsDefault { get; set; }
        public int SortOrder { get; set; }
        public bool IsActive { get; set; } = true;
        public DateTime CreatedAt { get; set; }
        public DateTime? UpdatedAt { get; set; }
    }

    public class CreateCounsellingPackageTemplateRequest
    {
        [Required, MaxLength(50)]
        public string Code { get; set; } = string.Empty;

        [Required, MaxLength(200)]
        public string Name { get; set; } = string.Empty;

        public string? Description { get; set; }
        public string? Category { get; set; }

        [Range(0.01, double.MaxValue)]
        public decimal PackageAmount { get; set; }

        public string Currency { get; set; } = "INR";
        public Guid? ProcedureVariantId { get; set; }
        public string DefaultEye { get; set; } = "RE";
        public string? VariantSubOption { get; set; }
        public Guid? IolId { get; set; }
        public List<string>? InvestigationIds { get; set; }

        [Range(0, 100)]
        public decimal MaxDiscountPercent { get; set; } = 50m;

        public string? LegacyMasterCode { get; set; }
        public bool IsDefault { get; set; }
        public int SortOrder { get; set; }
        public bool IsActive { get; set; } = true;
    }

    public class UpdateCounsellingPackageTemplateRequest
    {
        [MaxLength(200)]
        public string? Name { get; set; }

        public string? Description { get; set; }
        public string? Category { get; set; }
        public decimal? PackageAmount { get; set; }
        public Guid? ProcedureVariantId { get; set; }
        public string? DefaultEye { get; set; }
        public string? VariantSubOption { get; set; }
        public Guid? IolId { get; set; }
        public List<string>? InvestigationIds { get; set; }
        public decimal? MaxDiscountPercent { get; set; }
        public string? LegacyMasterCode { get; set; }
        public bool? IsDefault { get; set; }
        public int? SortOrder { get; set; }
        public bool? IsActive { get; set; }
    }

    /// <summary>Tenant-level counsellor desk configuration.</summary>
    public class CounsellingSettingsDto
    {
        public decimal MaxDiscountPercent { get; set; } = 50m;
        public decimal? MaxDiscountFlat { get; set; }
    }

    public class UpdateCounsellingSettingsRequest
    {
        [Range(0, 100)]
        public decimal MaxDiscountPercent { get; set; } = 50m;

        public decimal? MaxDiscountFlat { get; set; }
    }

    /// <summary>
    /// Estimate fields stored inside counseling_sessions.package_addons_json (counsellor blob).
    /// </summary>
    public class CounsellingEstimateBlobDto
    {
        public string? EstimateMode { get; set; } // package | custom
        public Guid? PackageTemplateId { get; set; }
        public string? DiscountType { get; set; } // flat | percent
        public decimal? DiscountValue { get; set; }
        public string? DiscountReason { get; set; }
        public decimal? DiscountAmount { get; set; }
        public decimal? ItemizedSubtotal { get; set; }
        public decimal? BundleSavings { get; set; }
        public decimal? FinalPayableAmount { get; set; }
    }
}
