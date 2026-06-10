using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace AuthService.Models.Domain;

/// <summary>
/// Per-visit optometry segment payload (anterior segment, posterior, retinoscopy, etc.).
/// </summary>
[Table("optometry_segment_exams")]
public class OptometrySegmentExam
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

    /// <summary>e.g. pupil_exam, anterior_segment, posterior_segment, fundus_exam, vitreous_exam, peripheral_retina_exam, wet_retinoscopy</summary>
    [Required]
    [Column("segment_key")]
    [StringLength(64)]
    public string SegmentKey { get; set; } = null!;

    [Required]
    [Column("data")]
    public string Data { get; set; } = "{}";

    [Column("updated_by")]
    public Guid? UpdatedBy { get; set; }

    [Column("created_at")]
    public DateTime CreatedAt { get; set; }

    [Column("updated_at")]
    public DateTime UpdatedAt { get; set; }

    [ForeignKey(nameof(VisitId))]
    public Visit? Visit { get; set; }
}
