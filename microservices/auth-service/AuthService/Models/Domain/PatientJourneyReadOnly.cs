using System;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace AuthService.Models.Domain
{
    /// <summary>
    /// Read-only projection of the patient_journey table (owned by ip-management-service).
    /// Added to auth-service AppDbContext so the Follow-up Center endpoint can JOIN
    /// discharged patients without creating a circular dependency.
    /// NO EF migrations are generated for this entity — the table was created by migration 81.
    /// </summary>
    [Table("patient_journey")]
    public class PatientJourneyReadOnly
    {
        [Key]
        [Column("id")]
        public Guid Id { get; set; }

        [Column("tenant_id")]
        public Guid TenantId { get; set; }

        [Column("patient_id")]
        public Guid PatientId { get; set; }

        [Column("counseling_session_id")]
        public Guid? CounselingSessionId { get; set; }

        [Column("package_amount")]
        public decimal? PackageAmount { get; set; }

        [Column("branch_id")]
        public Guid? BranchId { get; set; }

        [Column("uhid")]
        [MaxLength(50)]
        public string? Uhid { get; set; }

        [Column("clinical_state")]
        [MaxLength(30)]
        public string ClinicalState { get; set; } = string.Empty;

        [Column("is_discharged")]
        public bool IsDischarged { get; set; }

        [Column("admitted_at")]
        public DateTime? AdmittedAt { get; set; }

        [Column("discharged_at")]
        public DateTime? DischargedAt { get; set; }

        [Column("procedure_name")]
        [MaxLength(300)]
        public string? ProcedureName { get; set; }

        [Column("primary_surgeon_id")]
        public Guid? PrimarySurgeonId { get; set; }

        [Column("created_at")]
        public DateTime CreatedAt { get; set; }

        [Column("deleted_at")]
        public DateTime? DeletedAt { get; set; }

        // Navigation property to patient
        public virtual Patient? Patient { get; set; }
    }
}
