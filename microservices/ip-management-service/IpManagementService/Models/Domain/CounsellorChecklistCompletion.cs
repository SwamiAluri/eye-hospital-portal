namespace IpManagementService.Models.Domain;

/// <summary>
/// Outpatient safety checklist completion at Counsellor Desk (pre-journey).
/// Keyed by counseling_session_id; copied to pre_op_completions on ward init.
/// </summary>
public class CounsellorChecklistCompletion
{
    public Guid     Id                    { get; set; }
    public Guid     TenantId              { get; set; }
    public Guid     CounselingSessionId   { get; set; }
    public Guid     ItemId                { get; set; }

    public bool     IsCompleted           { get; set; }
    public bool     IsBypassed            { get; set; }
    public string?  BypassReason          { get; set; }
    public string?  Notes                 { get; set; }

    public Guid?    CompletedByUserId     { get; set; }
    public string?  CompletedByRole       { get; set; }
    public DateTime? CompletedAt          { get; set; }

    public Guid?    CreatedByUserId       { get; set; }
    public Guid?    UpdatedByUserId       { get; set; }
    public DateTime CreatedAt             { get; set; }
    public DateTime UpdatedAt             { get; set; }
    public DateTime? DeletedAt            { get; set; }
    public string   Status                { get; set; } = "active";
}
