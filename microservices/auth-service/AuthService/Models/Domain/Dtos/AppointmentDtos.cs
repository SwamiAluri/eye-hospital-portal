using System;
using System.ComponentModel.DataAnnotations;

namespace AuthService.Models.Domain.Dtos;

public class CreateAppointmentRequest
{
    [Required]
    public Guid PatientId { get; set; }

    [Required]
    public Guid DoctorId { get; set; }

    [Required]
    public DateTime AppointmentDate { get; set; }

    [Required]
    [StringLength(50)]
    public string AppointmentType { get; set; } = null!;

    [StringLength(50)]
    public string? ConsultationType { get; set; }

    [Required]
    [Range(15, 480)] // 15 minutes to 8 hours
    public int DurationMinutes { get; set; }

    public string? Notes { get; set; }
}

public class UpdateAppointmentRequest
{
    [Required]
    public Guid Id { get; set; }

    [Required]
    public DateTime AppointmentDate { get; set; }

    [Required]
    [StringLength(50)]
    public string AppointmentType { get; set; } = null!;

    [StringLength(50)]
    public string? ConsultationType { get; set; }

    [Required]
    [Range(15, 480)]
    public int DurationMinutes { get; set; }

    public string? Notes { get; set; }
}

public class CancelAppointmentRequest
{
    [Required]
    public string CancellationReason { get; set; } = null!;
}

public class AppointmentResponse
{
    public Guid Id { get; set; }
    public Guid PatientId { get; set; }
    public string PatientName { get; set; } = null!;
    public string? PatientMrn { get; set; }
    public Guid DoctorId { get; set; }
    public string DoctorName { get; set; } = null!;
    public Guid? DepartmentId { get; set; }
    public string? DepartmentName { get; set; }
    public DateTime AppointmentDate { get; set; }
    public string? StartTime { get; set; }
    public string? EndTime { get; set; }
    public string AppointmentType { get; set; } = null!;
    public string? ConsultationType { get; set; }
    public int DurationMinutes { get; set; }
    public string? Priority { get; set; }
    public string Status { get; set; } = null!;
    public string? ReasonForVisit { get; set; }
    public string? Notes { get; set; }
    public string? CancellationReason { get; set; }
    public bool? IsRecurring { get; set; }
    public string? RecurringPattern { get; set; }
    public string? PatientPhone { get; set; }
    public string? PatientEmail { get; set; }
    public bool ReminderSent { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }
}