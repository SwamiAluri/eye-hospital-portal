using System;
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using System.Text.Json.Serialization;

namespace AuthService.Models.Domain;

/// <summary>Laboratory-owned clinical test definition (L2). Optional commercial link via ServiceVariantId.</summary>
[Table("laboratory_test_definitions")]
public class LaboratoryTestDefinition
{
    [Key]
    [Column("id")]
    public Guid Id { get; set; }

    [Required]
    [Column("tenant_id")]
    public Guid TenantId { get; set; }

    [Required]
    [Column("name")]
    [MaxLength(300)]
    public string Name { get; set; } = string.Empty;

    [Required]
    [Column("local_code")]
    [MaxLength(50)]
    public string LocalCode { get; set; } = string.Empty;

    [Column("description")]
    [MaxLength(2000)]
    public string? Description { get; set; }

    [Column("category")]
    [MaxLength(100)]
    public string? Category { get; set; }

    [Column("method")]
    [MaxLength(200)]
    public string? Method { get; set; }

    [Column("turnaround_hours")]
    public int? TurnaroundHours { get; set; }

    /// <summary>Optional billable Service Catalog variant (commercial identity only).</summary>
    [Column("service_variant_id")]
    public Guid? ServiceVariantId { get; set; }

    /// <summary>
    /// Explicit COM-02 Option A non-billable catalog flag.
    /// Null ServiceVariantId alone is UNMAPPED, not non-billable.
    /// </summary>
    [Column("is_non_billable")]
    public bool IsNonBillable { get; set; }

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

    public virtual ICollection<LaboratoryTestSpecimenOption> SpecimenOptions { get; set; } = new List<LaboratoryTestSpecimenOption>();
    public virtual ICollection<LaboratoryAnalyte> Analytes { get; set; } = new List<LaboratoryAnalyte>();
}

[Table("laboratory_test_specimen_options")]
public class LaboratoryTestSpecimenOption
{
    [Key]
    [Column("id")]
    public Guid Id { get; set; }

    [Required]
    [Column("tenant_id")]
    public Guid TenantId { get; set; }

    [Required]
    [Column("test_definition_id")]
    public Guid TestDefinitionId { get; set; }

    [Required]
    [Column("specimen_type")]
    [MaxLength(100)]
    public string SpecimenType { get; set; } = string.Empty;

    [Column("is_default")]
    public bool IsDefault { get; set; }

    [Column("display_order")]
    public int DisplayOrder { get; set; }

    [ForeignKey(nameof(TestDefinitionId))]
    public virtual LaboratoryTestDefinition? TestDefinition { get; set; }
}

[Table("laboratory_panels")]
public class LaboratoryPanel
{
    [Key]
    [Column("id")]
    public Guid Id { get; set; }

    [Required]
    [Column("tenant_id")]
    public Guid TenantId { get; set; }

    [Required]
    [Column("name")]
    [MaxLength(300)]
    public string Name { get; set; } = string.Empty;

    [Required]
    [Column("local_code")]
    [MaxLength(50)]
    public string LocalCode { get; set; } = string.Empty;

    [Column("description")]
    [MaxLength(2000)]
    public string? Description { get; set; }

    [Column("category")]
    [MaxLength(100)]
    public string? Category { get; set; }

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

    public virtual ICollection<LaboratoryPanelItem> Items { get; set; } = new List<LaboratoryPanelItem>();
}

[Table("laboratory_panel_items")]
public class LaboratoryPanelItem
{
    [Key]
    [Column("id")]
    public Guid Id { get; set; }

    [Required]
    [Column("tenant_id")]
    public Guid TenantId { get; set; }

    [Required]
    [Column("panel_id")]
    public Guid PanelId { get; set; }

    [Required]
    [Column("test_definition_id")]
    public Guid TestDefinitionId { get; set; }

    [Column("display_order")]
    public int DisplayOrder { get; set; }

    [Column("is_required")]
    public bool IsRequired { get; set; } = true;

    [ForeignKey(nameof(PanelId))]
    public virtual LaboratoryPanel? Panel { get; set; }

    [ForeignKey(nameof(TestDefinitionId))]
    public virtual LaboratoryTestDefinition? TestDefinition { get; set; }
}

/// <summary>Expected analyte structure for a test (L2 dictionary). Observation persistence is L5.</summary>
[Table("laboratory_analytes")]
public class LaboratoryAnalyte
{
    [Key]
    [Column("id")]
    public Guid Id { get; set; }

    [Required]
    [Column("tenant_id")]
    public Guid TenantId { get; set; }

    [Required]
    [Column("test_definition_id")]
    public Guid TestDefinitionId { get; set; }

    [Required]
    [Column("name")]
    [MaxLength(200)]
    public string Name { get; set; } = string.Empty;

    [Column("local_code")]
    [MaxLength(50)]
    public string? LocalCode { get; set; }

    /// <summary>numeric | text | coded | qualitative</summary>
    [Column("value_type")]
    [MaxLength(30)]
    public string ValueType { get; set; } = "numeric";

    [Column("unit")]
    [MaxLength(50)]
    public string? Unit { get; set; }

    [Column("reference_range_text")]
    [MaxLength(200)]
    public string? ReferenceRangeText { get; set; }

    [Column("display_order")]
    public int DisplayOrder { get; set; }

    [Column("is_active")]
    public bool IsActive { get; set; } = true;

    [Column("created_at")]
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    [Column("updated_at")]
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;

    [Column("deleted_at")]
    public DateTime? DeletedAt { get; set; }

    [ForeignKey(nameof(TestDefinitionId))]
    public virtual LaboratoryTestDefinition? TestDefinition { get; set; }
}

/// <summary>Order line under LabReport for panel/multi-item expansion. Not SQL lab_order_item.</summary>
[Table("lab_report_items")]
public class LabReportItem
{
    [Key]
    [Column("id")]
    public Guid Id { get; set; }

    [Required]
    [Column("tenant_id")]
    public Guid TenantId { get; set; }

    [Required]
    [Column("lab_report_id")]
    public Guid LabReportId { get; set; }

    [Column("test_definition_id")]
    public Guid? TestDefinitionId { get; set; }

    [Required]
    [Column("test_name")]
    [MaxLength(300)]
    public string TestName { get; set; } = string.Empty;

    [Column("test_code")]
    [MaxLength(50)]
    public string? TestCode { get; set; }

    [Column("test_category")]
    [MaxLength(100)]
    public string? TestCategory { get; set; }

    [Column("display_order")]
    public int DisplayOrder { get; set; }

    [Column("created_at")]
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    // JsonIgnore: LabReport ↔ Items cycles abort HTTP after SaveChanges (UAT HTTP 500 / truncated 201).
    [ForeignKey(nameof(LabReportId))]
    [JsonIgnore]
    public virtual LabReport? LabReport { get; set; }

    [ForeignKey(nameof(TestDefinitionId))]
    [JsonIgnore]
    public virtual LaboratoryTestDefinition? TestDefinition { get; set; }
}
