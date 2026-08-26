namespace IpManagementService.Models.Domain;

/// <summary>
/// W-08 B1 eyedrop taper step. Active plan is <c>DeletedAt == null</c>.
/// Replace-all PUT soft-deletes the previous active set rather than editing in place.
/// </summary>
public class PostOpTaperStep
{
    public Guid      Id              { get; set; }
    public Guid      TenantId        { get; set; }
    public Guid      JourneyId       { get; set; }
    public string    DrugName        { get; set; } = string.Empty;
    public string    Eye             { get; set; } = string.Empty;
    public int       StepNo          { get; set; }
    public string    FrequencyLabel  { get; set; } = string.Empty;
    public int       Days            { get; set; }
    public string?   Instructions    { get; set; }
    public DateTime  CreatedAt       { get; set; }
    public Guid      CreatedBy       { get; set; }
    public DateTime? DeletedAt       { get; set; }
}
