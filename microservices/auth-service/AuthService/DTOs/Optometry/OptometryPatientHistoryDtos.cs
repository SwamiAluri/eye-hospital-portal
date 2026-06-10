namespace AuthService.DTOs.Optometry;

public class OptometryPatientHistoryResponse
{
    public Guid PatientId { get; set; }
    public DateTime GeneratedAt { get; set; }
    public List<OptometryVisitExamRecordDto> Visits { get; set; } = new();
}

public class OptometryLatestPriorResponse
{
    public bool Found { get; set; }
    public OptometryVisitExamRecordDto? Visit { get; set; }
}

public class OptometryVisitExamRecordDto
{
    public Guid VisitId { get; set; }
    public Guid PatientId { get; set; }
    public DateTime ExaminationDate { get; set; }
    public string VisitStatus { get; set; } = string.Empty;
    public string? ChiefComplaint { get; set; }
    public DateTime LastUpdatedAt { get; set; }
    public OptometryHistoryUserDto? LastUpdatedBy { get; set; }
    public bool OptometryCompleted { get; set; }
    public DateTime? OptometryCompletedAt { get; set; }
    public OptometryVisitSummaryDto Summary { get; set; } = new();
    public Dictionary<string, object?> Segments { get; set; } = new();
}

public class OptometryHistoryUserDto
{
    public Guid UserId { get; set; }
    public string DisplayName { get; set; } = string.Empty;
}

public class OptometryVisitSummaryDto
{
    public string? MedicalHistoryLine { get; set; }
    public string? DistanceVaLine { get; set; }
    public string? PreviousGlassesLine { get; set; }
    public string? TodaysRxLine { get; set; }
    public string? RefractionLine { get; set; }
    public string? IopNctLine { get; set; }
    public string? KeratometryLine { get; set; }
    public string? AnteriorSegmentLine { get; set; }
    public string? PosteriorSegmentLine { get; set; }
    public List<string> VaSectionsRecorded { get; set; } = new();
    public List<string> IopSectionsRecorded { get; set; } = new();
    public List<string> TabsWithData { get; set; } = new();
}

public class ArchiveOptometryVisitExamRequest
{
    public Guid PatientId { get; set; }
    public object? Snapshot { get; set; }
}
