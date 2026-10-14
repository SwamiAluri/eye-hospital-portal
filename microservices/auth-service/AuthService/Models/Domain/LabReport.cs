using System;
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace AuthService.Models.Domain;

[Table("lab_reports")]
public class LabReport
{
    [Key]
    [Column("id")]
    public Guid Id { get; set; }

    [Required]
    [Column("tenant_id")]
    public Guid TenantId { get; set; }

    [Required]
    [Column("patient_id")]
    public Guid PatientId { get; set; }

    [Column("visit_id")]
    public Guid? VisitId { get; set; }

    /// <summary>Authoritative clinical catalog test when ordered from L2 catalog (nullable for legacy rows).</summary>
    [Column("test_definition_id")]
    public Guid? TestDefinitionId { get; set; }

    /// <summary>Authoritative panel when ordered as a panel (nullable).</summary>
    [Column("panel_id")]
    public Guid? PanelId { get; set; }

    [Required]
    [Column("test_name")]
    [MaxLength(300)]
    public string TestName { get; set; } = string.Empty;

    [Column("test_code")]
    [MaxLength(50)]
    public string? TestCode { get; set; }

    [Column("test_category")]
    [MaxLength(100)]
    public string? TestCategory { get; set; } // hematology, biochemistry, microbiology, pathology, ophthalmology

    /// <summary>Structured clinical indication / reason (L2). Not a substitute for Notes.</summary>
    [Column("clinical_indication")]
    [MaxLength(1000)]
    public string? ClinicalIndication { get; set; }

    [Column("ordered_by_name")]
    [MaxLength(200)]
    public string? OrderedByName { get; set; }

    [Column("ordered_by_id")]
    public Guid? OrderedById { get; set; }

    [Column("ordered_at")]
    public DateTime? OrderedAt { get; set; }

    [Column("sample_collected_at")]
    public DateTime? SampleCollectedAt { get; set; }

    [Column("completed_at")]
    public DateTime? CompletedAt { get; set; }

    [Column("result_value")]
    [MaxLength(200)]
    public string? ResultValue { get; set; }

    [Column("result_unit")]
    [MaxLength(50)]
    public string? ResultUnit { get; set; }

    [Column("reference_range")]
    [MaxLength(200)]
    public string? ReferenceRange { get; set; }

    [Column("interpretation")]
    [MaxLength(20)]
    public string? Interpretation { get; set; } // normal, abnormal, critical, high, low

    [Column("lab_name")]
    [MaxLength(200)]
    public string? LabName { get; set; }

    [Column("technician_name")]
    [MaxLength(200)]
    public string? TechnicianName { get; set; }

    [Column("verified_by_name")]
    [MaxLength(200)]
    public string? VerifiedByName { get; set; }

    [Column("specimen_type")]
    [MaxLength(100)]
    public string? SpecimenType { get; set; } // blood, urine, tissue, swab

    [Column("priority")]
    [MaxLength(20)]
    public string Priority { get; set; } = "routine"; // routine, urgent, stat

    [Column("notes")]
    [MaxLength(2000)]
    public string? Notes { get; set; }

    [Column("report_url")]
    [MaxLength(500)]
    public string? ReportUrl { get; set; }

    [Required]
    [Column("status")]
    [MaxLength(30)]
    public string Status { get; set; } = "ordered"; // ordered, sample_collected, in_progress, completed, cancelled, on_hold

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

    [ForeignKey("PatientId")]
    public virtual Patient? Patient { get; set; }

    [ForeignKey(nameof(TestDefinitionId))]
    public virtual LaboratoryTestDefinition? TestDefinition { get; set; }

    [ForeignKey(nameof(PanelId))]
    public virtual LaboratoryPanel? Panel { get; set; }

    public virtual ICollection<LabReportItem> Items { get; set; } = new List<LabReportItem>();

    /// <summary>Populated on read when an active lab canonical association exists. Not persisted.</summary>
    [NotMapped]
    public Guid? CanonicalDocumentId { get; set; }

    /// <summary>Display name of the attached canonical report file. Not persisted.</summary>
    [NotMapped]
    public string? CanonicalFileName { get; set; }

    /// <summary>MIME type of the attached canonical report file. Not persisted.</summary>
    [NotMapped]
    public string? CanonicalMimeType { get; set; }

    /// <summary>Patient display name for worklist reads. Not persisted.</summary>
    [NotMapped]
    public string? PatientDisplayName { get; set; }

    /// <summary>Patient MRN for worklist reads. Not persisted.</summary>
    [NotMapped]
    public string? MedicalRecordNumber { get; set; }
}
