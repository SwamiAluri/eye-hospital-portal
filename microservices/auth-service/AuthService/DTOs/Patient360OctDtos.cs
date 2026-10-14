namespace AuthService.DTOs;

/// <summary>
/// Patient 360 OCT metadata. Allow-list only. No measurements, findings, notes, or storage locations.
/// </summary>
public class Patient360OctScanDto
{
    public Guid Id { get; set; }
    public DateTime ScanDate { get; set; }
    public string Eye { get; set; } = "";
    public string ScanType { get; set; } = "";
    public string? ScanPattern { get; set; }
    public string? ScanSize { get; set; }
    public string? Device { get; set; }
    public string? DeviceModel { get; set; }
    public string Status { get; set; } = "";
}

public class Patient360OctPageDto
{
    public List<Patient360OctScanDto> Items { get; set; } = new();
    public int TotalCount { get; set; }
    public int PageNumber { get; set; }
    public int PageSize { get; set; }
}
