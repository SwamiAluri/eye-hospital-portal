using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace AuthService.Models.Domain;

[Table("patient_recent_views")]
public class PatientRecentView
{
    [Key]
    [Column("id")]
    public Guid Id { get; set; }

    [Column("tenant_id")]
    public Guid TenantId { get; set; }

    [Column("user_id")]
    public Guid UserId { get; set; }

    [Column("patient_id")]
    public Guid PatientId { get; set; }

    [Column("viewed_at")]
    public DateTime ViewedAt { get; set; } = DateTime.UtcNow;

    [ForeignKey(nameof(PatientId))]
    public virtual Patient? Patient { get; set; }
}
