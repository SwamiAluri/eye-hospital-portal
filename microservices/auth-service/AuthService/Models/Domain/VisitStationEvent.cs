using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using AuthService.Models.Identity;

namespace AuthService.Models.Domain;

/// <summary>
/// Audit trail for patient journey through OPD stations (optometrist, doctor, counselor, etc.)
/// </summary>
[Table("visit_station_events")]
public class VisitStationEvent
{
    [Key]
    [Column("id")]
    public Guid Id { get; set; }

    [Required]
    [Column("tenant_id")]
    public Guid TenantId { get; set; }

    [Required]
    [Column("branch_id")]
    public Guid BranchId { get; set; }

    [Required]
    [Column("visit_id")]
    public Guid VisitId { get; set; }

    [Required]
    [Column("patient_id")]
    public Guid PatientId { get; set; }

    [Required]
    [Column("station")]
    [MaxLength(50)]
    public string Station { get; set; } = string.Empty;

    [Required]
    [Column("event_type")]
    [MaxLength(30)]
    public string EventType { get; set; } = string.Empty; // queued, started, completed, skipped, referred

    [Column("pass_number")]
    public int PassNumber { get; set; } = 1;

    [Column("reason_code")]
    [MaxLength(50)]
    public string? ReasonCode { get; set; }

    [Column("reason_notes")]
    public string? ReasonNotes { get; set; }

    [Column("assigned_to_user_id")]
    public Guid? AssignedToUserId { get; set; }

    [Column("room_code")]
    [MaxLength(50)]
    public string? RoomCode { get; set; }

    [Column("queue_item_id")]
    public Guid? QueueItemId { get; set; }

    [Column("metadata")]
    public string Metadata { get; set; } = "{}";

    [Required]
    [Column("created_at")]
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    [Column("created_by_user_id")]
    public Guid? CreatedByUserId { get; set; }

    [ForeignKey("VisitId")]
    public virtual Visit? Visit { get; set; }

    [ForeignKey("PatientId")]
    public virtual Patient? Patient { get; set; }

    [ForeignKey("AssignedToUserId")]
    public virtual AppUser? AssignedToUser { get; set; }
}
