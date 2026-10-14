using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace AuthService.Models.Domain;

/// <summary>
/// Read-only projection of vital_sign, owned by IP Management.
/// The table already exists. This mapping is excluded from EF migrations.
/// </summary>
[Table("vital_sign")]
public class VitalSignReadOnly
{
    [Key]
    [Column("id")]
    public Guid Id { get; set; }

    [Column("tenant_id")]
    public Guid TenantId { get; set; }

    [Column("journey_id")]
    public Guid JourneyId { get; set; }

    [Column("recorded_at")]
    public DateTime RecordedAt { get; set; }

    [Column("temperature")]
    public decimal? Temperature { get; set; }

    [Column("blood_pressure_systolic")]
    public int? BloodPressureSystolic { get; set; }

    [Column("blood_pressure_diastolic")]
    public int? BloodPressureDiastolic { get; set; }

    [Column("pulse_rate")]
    public int? PulseRate { get; set; }

    [Column("respiratory_rate")]
    public int? RespiratoryRate { get; set; }

    [Column("oxygen_saturation")]
    public decimal? OxygenSaturation { get; set; }

    [Column("weight")]
    public decimal? Weight { get; set; }

    [Column("height")]
    public decimal? Height { get; set; }

    [Column("notes")]
    public string? Notes { get; set; }

    [Column("context")]
    public string? Context { get; set; }

    [Column("recorded_by_user_id")]
    public Guid RecordedByUserId { get; set; }

    [Column("created_at")]
    public DateTime CreatedAt { get; set; }

    [Column("updated_at")]
    public DateTime UpdatedAt { get; set; }

    [Column("deleted_at")]
    public DateTime? DeletedAt { get; set; }

    [Column("status")]
    public string Status { get; set; } = "active";
}
