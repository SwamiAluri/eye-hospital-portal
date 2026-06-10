using System;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using AuthService.Models.Identity;

namespace AuthService.Models.Domain;

[Table("appointments")]
public class Appointment
{
    [Column("id")]
    public Guid Id { get; set; }

    [Column("tenant_id")]
    public required Guid TenantId { get; set; }

    [Column("patient_id")]
    public required Guid PatientId { get; set; }

    [Column("doctor_id")]
    public required Guid DoctorId { get; set; }

    [Column("appointment_date")]
    public required DateTime AppointmentDate { get; set; }

    [Column("start_time")]
    public TimeSpan? StartTime { get; set; }

    [Column("end_time")]
    public TimeSpan? EndTime { get; set; }

    [Column("appointment_type")]
    [StringLength(50)]
    public required string AppointmentType { get; set; }

    [Column("consultation_type")]
    [StringLength(50)]
    public string? ConsultationType { get; set; }

    [Column("duration_minutes")]
    public required int DurationMinutes { get; set; }

    [Column("priority")]
    [StringLength(20)]
    public string Priority { get; set; } = "normal"; // low, normal, high, urgent

    [Column("status")]
    [StringLength(20)]
    public required string Status { get; set; } // Scheduled, Confirmed, Cancelled, Completed

    [Column("is_recurring")]
    public bool IsRecurring { get; set; } = false;

    [Column("recurring_pattern")]
    [StringLength(50)]
    public string? RecurringPattern { get; set; }

    [Column("parent_appointment_id")]
    public Guid? ParentAppointmentId { get; set; }

    [Column("patient_phone")]
    [StringLength(20)]
    public string? PatientPhone { get; set; }

    [Column("patient_email")]
    [StringLength(255)]
    public string? PatientEmail { get; set; }

    [Column("reason_for_visit")]
    public string? ReasonForVisit { get; set; }

    [Column("department_id")]
    public Guid? DepartmentId { get; set; }

    [Column("notes")]
    public string? Notes { get; set; }

    [Column("cancellation_reason")]
    public string? CancellationReason { get; set; }

    [Column("reminder_sent")]
    public bool ReminderSent { get; set; }

    [Column("created_at")]
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    [Column("updated_at")]
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;

    [Column("deleted_at")]
    public DateTime? DeletedAt { get; set; }

    // Navigation properties
    public virtual Patient? Patient { get; set; }
    public virtual AppUser? Doctor { get; set; }
    public virtual Department? Department { get; set; }
    public virtual Appointment? ParentAppointment { get; set; }
    public virtual ICollection<Appointment>? ChildAppointments { get; set; }
    public virtual ICollection<AppointmentReminder>? Reminders { get; set; }
    public virtual ICollection<AppointmentConflict>? Conflicts { get; set; }
}