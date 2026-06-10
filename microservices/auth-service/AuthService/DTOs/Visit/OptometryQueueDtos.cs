using System.ComponentModel.DataAnnotations;

namespace AuthService.DTOs.Visit;

public class OptometryQueuePatientDto
{
    public string Id { get; set; } = string.Empty;
    public Guid VisitId { get; set; }
    public Guid PatientId { get; set; }
    public string PatientName { get; set; } = string.Empty;
    public string Mrn { get; set; } = string.Empty;
    public int Age { get; set; }
    public string Gender { get; set; } = string.Empty;
    public string TokenNumber { get; set; } = string.Empty;
    public string AppointmentTime { get; set; } = string.Empty;
    public string ChiefComplaint { get; set; } = string.Empty;
    public string Source { get; set; } = "OPD";
    public string Status { get; set; } = "Waiting";
    public string Urgency { get; set; } = "Routine";
    public string? AssignedOptometrist { get; set; }
    public Guid? AssignedToUserId { get; set; }
    public DateTime? WaitingSince { get; set; }
    public List<string> CompletedExams { get; set; } = new();
    public bool HasRedFlags { get; set; }
    public List<string> RedFlags { get; set; } = new();
    public string? VisualAcuityOD { get; set; }
    public string? VisualAcuityOS { get; set; }
    public int? IopOD { get; set; }
    public int? IopOS { get; set; }
    public bool RefractionCompleted { get; set; }
    public int PassNumber { get; set; } = 1;
    public string? ReasonCode { get; set; }
    public string? ReasonLabel { get; set; }
    public bool IsReturnVisit { get; set; }
    public string? RoomCode { get; set; }
}

public class OptometryQueueStatsDto
{
    public int TotalWaiting { get; set; }
    public int InProgress { get; set; }
    public int Completed { get; set; }
    public int Referred { get; set; }
    public int EmergencyCount { get; set; }
    public int UrgentCount { get; set; }
    public int AverageWaitTime { get; set; }
}

public class OptometryCallNextRequestDto
{
    [Required]
    public Guid BranchId { get; set; }

    [Required]
    public string RoomCode { get; set; } = string.Empty;

    public string? OptometristName { get; set; }
}

/// <summary>
/// Opens (or creates) a visit at optometry and starts the examination for a patient found via search.
/// </summary>
public class OptometryOpenExamRequestDto
{
    [Required]
    public Guid BranchId { get; set; }

    [Required]
    public Guid PatientId { get; set; }

    public string? RoomCode { get; set; }

    public string? OptometristName { get; set; }

    public string? ChiefComplaint { get; set; }
}

public class OptometryPatientSearchRowDto
{
    public Guid Id { get; set; }
    public string PatientName { get; set; } = string.Empty;
    public string Mrn { get; set; } = string.Empty;
    public string? Phone { get; set; }
    public string? Gender { get; set; }
    public DateTime? DateOfBirth { get; set; }
}

public class OptometrySkipRequestDto
{
    [Required]
    public string Reason { get; set; } = string.Empty;
}

public class OptometryCompleteRequestDto
{
    public string? NextStation { get; set; }
    public string? ReasonCode { get; set; }
    public string? Notes { get; set; }
}

public class VisitJourneyEventDto
{
    public Guid Id { get; set; }
    public string Station { get; set; } = string.Empty;
    public string EventType { get; set; } = string.Empty;
    public int PassNumber { get; set; }
    public string? ReasonCode { get; set; }
    public string? ReasonNotes { get; set; }
    public string? RoomCode { get; set; }
    public string? AssignedToName { get; set; }
    public DateTime CreatedAt { get; set; }
}
