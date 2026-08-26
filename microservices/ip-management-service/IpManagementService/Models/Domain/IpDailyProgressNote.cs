namespace IpManagementService.Models.Domain;

public class IpDailyProgressNote
{
    public Guid Id { get; set; }
    public Guid TenantId { get; set; }
    public Guid PatientJourneyId { get; set; }
    public string Note { get; set; } = string.Empty;
    public DateTime RecordedAt { get; set; } = DateTime.UtcNow;
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
    public Guid? CreatedByUserId { get; set; }
    public Guid? UpdatedByUserId { get; set; }
    public DateTime? DeletedAt { get; set; }
    public string Status { get; set; } = "active";
}
