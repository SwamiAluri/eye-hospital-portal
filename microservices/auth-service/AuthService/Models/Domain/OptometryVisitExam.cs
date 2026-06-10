using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace AuthService.Models.Domain;

/// <summary>
/// Permanent visit-level optometry exam archive (survives draft expiry).
/// </summary>
[Table("optometry_visit_exams")]
public class OptometryVisitExam
{
    [Key]
    [Column("id")]
    public Guid Id { get; set; }

    [Required]
    [Column("tenant_id")]
    public Guid TenantId { get; set; }

    [Required]
    [Column("visit_id")]
    public Guid VisitId { get; set; }

    [Required]
    [Column("patient_id")]
    public Guid PatientId { get; set; }

    [Required]
    [Column("snapshot_json", TypeName = "jsonb")]
    public string SnapshotJson { get; set; } = "{}";

    [Column("completed_at")]
    public DateTime? CompletedAt { get; set; }

    [Column("completed_by")]
    public Guid? CompletedBy { get; set; }

    [Column("created_at")]
    public DateTime CreatedAt { get; set; }

    [Column("updated_at")]
    public DateTime UpdatedAt { get; set; }

    [ForeignKey(nameof(VisitId))]
    public Visit? Visit { get; set; }
}
