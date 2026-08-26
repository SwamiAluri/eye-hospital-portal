namespace IpManagementService.Models.Domain;

public class JourneyAuditLog
{
    public Guid     Id                  { get; set; }
    public Guid     TenantId            { get; set; }
    public Guid     PatientJourneyId    { get; set; }
    public string   Action              { get; set; } = string.Empty;
    public string?  StateType           { get; set; }
    public string?  OldValue            { get; set; }
    public string?  NewValue            { get; set; }
    public string?  PreviousState       { get; set; } // JSONB snapshot
    public string?  NewState            { get; set; } // JSONB snapshot
    public string?  Notes               { get; set; }
    public Guid?    CorrelationId       { get; set; }
    public Guid?    PerformedByUserId   { get; set; }
    public DateTime PerformedAt         { get; set; }
    public DateTime CreatedAt           { get; set; }
    public DateTime UpdatedAt           { get; set; }
    public DateTime? DeletedAt          { get; set; }
    public string   Status              { get; set; } = "active";
}
