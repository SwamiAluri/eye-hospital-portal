namespace AuthService.DTOs.Queue;

public class QueueDisplayBranchPayloadDto
{
    public Guid BranchId { get; set; }
    public string BranchName { get; set; } = string.Empty;
    public string Mode { get; set; } = "branch";
    public int RotationSeconds { get; set; } = 10;
    public DateTime GeneratedAt { get; set; } = DateTime.UtcNow;
    public List<QueueDisplayTickerMessageDto> TickerMessages { get; set; } = new();
    public List<QueueDisplayRoomSlideDto> Slides { get; set; } = new();
}

public class QueueDisplayTickerMessageDto
{
    public string En { get; set; } = string.Empty;
    public string Te { get; set; } = string.Empty;
}

public class QueueDisplayRoomSlideDto
{
    public string Station { get; set; } = string.Empty;
    public string StationLabel { get; set; } = string.Empty;
    public string? StationLabelTe { get; set; }
    public string RoomCode { get; set; } = string.Empty;
    public string DisplayLabel { get; set; } = string.Empty;
    public string? DisplayLabelTe { get; set; }
    public QueueDisplayPatientDto? NowServing { get; set; }
    public List<QueueDisplayPatientDto> NextQueue { get; set; } = new();
    public string? StaffName { get; set; }
}

public class QueueDisplayPatientDto
{
    public Guid? VisitId { get; set; }
    public Guid? PatientId { get; set; }
    public string TokenNumber { get; set; } = string.Empty;
    public string PatientName { get; set; } = string.Empty;
    public string Gender { get; set; } = string.Empty;
    public string AgeCategory { get; set; } = "Adult";
    public string Urgency { get; set; } = "Routine";
    public bool IsReturnVisit { get; set; }
    public int PassNumber { get; set; } = 1;
    public string? ReasonLabel { get; set; }
}

public class ServiceRoomConfigDto
{
    public string Code { get; set; } = string.Empty;
    public string Label { get; set; } = string.Empty;
    public string RoomCode { get; set; } = string.Empty;
    public string Station { get; set; } = string.Empty;
    public string? TvDisplayLabel { get; set; }
    public string? TvDisplayLabelTe { get; set; }
    public bool IsActive { get; set; } = true;
}
