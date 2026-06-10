using System;
using System.ComponentModel.DataAnnotations;

namespace AuthService.DTOs.Visit;

// ============ Response DTOs ============

public class VisitDto
{
    public Guid Id { get; set; }
    public Guid TenantId { get; set; }
    public Guid PatientId { get; set; }
    public string? PatientName { get; set; }
    public string? PatientMrn { get; set; }
    public Guid AppointmentId { get; set; }
    public Guid? OpdBillId { get; set; }
    public string? BillNumber { get; set; }
    public Guid BranchId { get; set; }
    public string? BranchName { get; set; }
    public Guid? ConsultantId { get; set; }
    public string? ConsultantName { get; set; }
    public Guid? DepartmentId { get; set; }
    public string? DepartmentName { get; set; }
    public string VisitType { get; set; } = null!;
    public string VisitCategory { get; set; } = null!;
    public string Status { get; set; } = null!;
    public string TokenNumber { get; set; } = null!;
    public int TokenSequence { get; set; }
    public DateTime? CheckedInAt { get; set; }
    public Guid? CheckedInBy { get; set; }
    public string? CheckedInByName { get; set; }
    public string? CurrentStation { get; set; }
    public Guid? AssignedTo { get; set; }
    public string? AssignedToName { get; set; }
    public DateTime? AssignedAt { get; set; }
    public DateTime? CompletedAt { get; set; }
    public Guid? CompletedBy { get; set; }
    public string? CompletedByName { get; set; }
    public string? Outcome { get; set; }
    public string? OutcomeNotes { get; set; }
    public bool IsEmergency { get; set; }
    public string? EmergencyReason { get; set; }
    public string? Notes { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime? UpdatedAt { get; set; }
}

public class VisitListDto
{
    public Guid Id { get; set; }
    public Guid PatientId { get; set; }
    public string PatientName { get; set; } = null!;
    public string PatientMrn { get; set; } = null!;
    public string TokenNumber { get; set; } = null!;
    public string VisitType { get; set; } = null!;
    public string Status { get; set; } = null!;
    public string? CurrentStation { get; set; }
    public string? AssignedToName { get; set; }
    public string? ConsultantName { get; set; }
    public DateTime? CheckedInAt { get; set; }
    public bool IsEmergency { get; set; }
    public DateTime CreatedAt { get; set; }
}

// ============ Check-In DTOs ============

public class CheckInRequestDto
{
    [Required]
    public Guid AppointmentId { get; set; }
    
    public bool IsEmergency { get; set; } = false;
    
    public string? EmergencyReason { get; set; }
    
    public string? Notes { get; set; }
}

public class CheckInValidationDto
{
    public bool PatientValid { get; set; }
    public string? PatientMessage { get; set; }
    
    public bool AppointmentValid { get; set; }
    public string? AppointmentMessage { get; set; }
    
    public bool BillValid { get; set; }
    public string? BillMessage { get; set; }
    public Guid? BillId { get; set; }
    
    public bool PaymentValid { get; set; }
    public string? PaymentMessage { get; set; }
    public decimal? AmountDue { get; set; }
    
    public bool CanCheckIn => PatientValid && AppointmentValid && BillValid && PaymentValid;
    public bool CanEmergencyCheckIn => PatientValid && AppointmentValid;
}

public class CheckInResultDto
{
    public bool Success { get; set; }
    public string? Message { get; set; }
    public VisitDto? Visit { get; set; }
    public string? TokenNumber { get; set; }
    public CheckInValidationDto? Validation { get; set; }
}

// ============ Queue / Routing DTOs ============

public class SendToRequestDto
{
    [Required]
    public Guid VisitId { get; set; }
    
    [Required]
    public string Station { get; set; } = null!; // optometrist, doctor, pharmacy, etc.
    
    public Guid? AssignToUserId { get; set; }
    
    public string? Reason { get; set; }

    /// <summary>Routing reason code from master data (e.g. INITIAL_REFRACTION, POST_INVESTIGATION).</summary>
    public string? ReasonCode { get; set; }
}

public class VisitQueueDto
{
    public Guid Id { get; set; }
    public string TokenNumber { get; set; } = null!;
    public string PatientName { get; set; } = null!;
    public string PatientMrn { get; set; } = null!;
    public string VisitType { get; set; } = null!;
    public string Status { get; set; } = null!;
    public DateTime? CheckedInAt { get; set; }
    public int WaitingMinutes { get; set; }
    public string? CurrentStation { get; set; }
    public Guid? AssignedTo { get; set; }
    public string? AssignedToName { get; set; }
    public bool IsEmergency { get; set; }
    public string Priority { get; set; } = "normal";
}

// ============ Visit Completion ============

public class CompleteVisitRequestDto
{
    [Required]
    public Guid VisitId { get; set; }
    
    [Required]
    public string Outcome { get; set; } = null!; // treated, referred, surgery_planned, follow_up_scheduled
    
    public string? OutcomeNotes { get; set; }
}
