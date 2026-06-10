using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using AuthService.Models.Identity;

namespace AuthService.Models.Domain;

[Table("examination_drafts")]
public class ExaminationDraft
{
    [Key]
    [Column("id")]
    public Guid Id { get; set; }

    [Required]
    [Column("patient_id")]
    public Guid PatientId { get; set; }

    [Required]
    [Column("doctor_id")]
    public Guid DoctorId { get; set; }

    [Required]
    [Column("tenant_id")]
    public Guid TenantId { get; set; }

    [Column("visit_id")]
    public Guid? VisitId { get; set; }

    [Required]
    [Column("timestamp")]
    public DateTime Timestamp { get; set; }

    [Required]
    [Column("expires_at")]
    public DateTime ExpiresAt { get; set; }

    [Required]
    [Column("data", TypeName = "jsonb")]
    public string Data { get; set; } = "{}";

    [Required]
    [Column("completion_percentage")]
    public int CompletionPercentage { get; set; }

    [Column("created_at")]
    public DateTime CreatedAt { get; set; }

    [Column("updated_at")]
    public DateTime UpdatedAt { get; set; }

    [Column("created_by_user_id")]
    public Guid? CreatedByUserId { get; set; }

    [Column("updated_by_user_id")]
    public Guid? UpdatedByUserId { get; set; }

    // Navigation properties
    [ForeignKey("PatientId")]
    public virtual Patient? Patient { get; set; }

    [ForeignKey("DoctorId")]
    public virtual AppUser? Doctor { get; set; }

    [ForeignKey("TenantId")]
    public virtual Tenant? Tenant { get; set; }

    [ForeignKey("VisitId")]
    public virtual Visit? Visit { get; set; }
}
