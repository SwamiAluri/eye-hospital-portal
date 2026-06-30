namespace AuthService.Models.Domain.Dtos;

public class PatientOmniSearchHitDto
{
    public string Id { get; set; } = "";
    public string Title { get; set; } = "";
    public string? Subtitle { get; set; }
    public string? Meta { get; set; }
    /// <summary>patient_profile | hub_filter | hub_path</summary>
    public string ActionType { get; set; } = "";
    public string? PatientId { get; set; }
    public Dictionary<string, string>? HubFilter { get; set; }
    public string? Path { get; set; }
}
