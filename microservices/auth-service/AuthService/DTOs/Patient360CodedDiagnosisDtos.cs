namespace AuthService.DTOs;

/// <summary>
/// Patient 360 coded diagnosis history. Allow-list only.
/// Status is omitted: patient_diagnosis.status has no controlled vocabulary.
/// </summary>
public class Patient360CodedDiagnosisDto
{
    public Guid Id { get; set; }
    public string Code { get; set; } = "";
    public string Description { get; set; } = "";
    public string? DiagnosisType { get; set; }
    public string? EyeSpecificity { get; set; }
    public string? CodeLaterality { get; set; }
    public DateTime DiagnosedAt { get; set; }
}

public class Patient360CodedDiagnosisPageDto
{
    public List<Patient360CodedDiagnosisDto> Items { get; set; } = new();
    public int TotalCount { get; set; }
    public int PageNumber { get; set; }
    public int PageSize { get; set; }
}
