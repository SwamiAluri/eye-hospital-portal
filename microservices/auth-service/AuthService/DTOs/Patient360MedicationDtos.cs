namespace AuthService.DTOs;

/// <summary>
/// Patient 360 clinical prescription history. Allow-list only.
/// </summary>
public class Patient360MedicationLineDto
{
    public Guid Id { get; set; }
    public string MedicationName { get; set; } = "";
    public string? GenericName { get; set; }
    public string Dosage { get; set; } = "";
    public string Form { get; set; } = "";
    public string Route { get; set; } = "";
    public string Frequency { get; set; } = "";
    public int DurationDays { get; set; }
    public DateTime StartDate { get; set; }
    public DateTime? EndDate { get; set; }
}

public class Patient360MedicationHistoryDto
{
    public Guid Id { get; set; }
    public DateTime PrescriptionDate { get; set; }
    public string Status { get; set; } = "";
    public List<Patient360MedicationLineDto> Lines { get; set; } = new();
}

public class Patient360MedicationPageDto
{
    public List<Patient360MedicationHistoryDto> Items { get; set; } = new();
    public int TotalCount { get; set; }
    public int PageNumber { get; set; }
    public int PageSize { get; set; }
}
