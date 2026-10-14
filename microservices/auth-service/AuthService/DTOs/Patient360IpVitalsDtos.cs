namespace AuthService.DTOs;

/// <summary>
/// Patient 360 IP vital observation. Measurement time is vital_sign.recorded_at.
/// </summary>
public class Patient360IpVitalItemDto
{
    public Guid Id { get; set; }
    public DateTime RecordedAt { get; set; }
    public string Context { get; set; } = "";
    public decimal? Temperature { get; set; }
    public int? BloodPressureSystolic { get; set; }
    public int? BloodPressureDiastolic { get; set; }
    public int? PulseRate { get; set; }
    public int? RespiratoryRate { get; set; }
    public decimal? OxygenSaturation { get; set; }
    public decimal? Weight { get; set; }
    public decimal? Height { get; set; }
}

public class Patient360IpVitalsPageDto
{
    public List<Patient360IpVitalItemDto> Items { get; set; } = new();
    public int TotalCount { get; set; }
    public int PageNumber { get; set; }
    public int PageSize { get; set; }
}
