namespace AuthService.DTOs;

/// <summary>
/// Patient 360 closed-episode context from patient_journey.
/// Admission timestamp is patient_journey.admitted_at.
/// </summary>
public class Patient360InpatientHistoryItemDto
{
    public Guid Id { get; set; }
    public DateTime? AdmittedAt { get; set; }
    public DateTime? DischargedAt { get; set; }
    public string ClinicalState { get; set; } = "";
}

public class Patient360InpatientHistoryPageDto
{
    public List<Patient360InpatientHistoryItemDto> Items { get; set; } = new();
    public int TotalCount { get; set; }
    public int PageNumber { get; set; }
    public int PageSize { get; set; }
}
