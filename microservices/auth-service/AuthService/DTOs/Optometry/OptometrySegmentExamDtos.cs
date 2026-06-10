namespace AuthService.DTOs.Optometry;

public class OptometrySegmentExamDto
{
    public Guid Id { get; set; }
    public Guid VisitId { get; set; }
    public Guid PatientId { get; set; }
    public string SegmentKey { get; set; } = string.Empty;
    public object? Data { get; set; }
    public DateTime UpdatedAt { get; set; }
}

public class SaveOptometrySegmentExamRequest
{
    public Guid PatientId { get; set; }
    public object Data { get; set; } = new { };
}
