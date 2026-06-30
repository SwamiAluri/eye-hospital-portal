namespace IpManagementService.Models.Domain;

/// <summary>
/// Represents a single checklist item completion within a pre_op_clearance.
/// One row per (clearance_id + item_id).
/// </summary>
public class PreOpCompletion
{
    public Guid     Id                    { get; set; }
    public Guid     TenantId              { get; set; }
    public Guid     ClearanceId           { get; set; }
    public Guid     ItemId                { get; set; }

    public bool     IsCompleted           { get; set; } = false;
    public bool     IsBypassed            { get; set; } = false;
    public string?  BypassReason          { get; set; }

    public string?  Notes                 { get; set; }

    public string?  ResultValue           { get; set; }
    public string?  ResultUnit            { get; set; }
    public string?  ReferenceRange        { get; set; }
    public string?  ResultFlag            { get; set; }
    public string?  ResultSource          { get; set; }
    public string   EntryStatus           { get; set; } = "draft";
    public Guid?    EnteredByUserId       { get; set; }
    public DateTime? EnteredAt            { get; set; }
    public Guid?    VerifiedByUserId      { get; set; }
    public DateTime? VerifiedAt           { get; set; }
    public string?  ExternalReportNote    { get; set; }

    /// <summary>Linked pre_op_document row for items where RequiresDocument is true.</summary>
    public Guid?    DocumentId            { get; set; }

    public Guid?    CompletedByUserId     { get; set; }
    public string?  CompletedByRole       { get; set; }
    public DateTime? CompletedAt          { get; set; }

    /// <summary>ward | counsellor | copied_from_counsellor</summary>
    public string?  Source                { get; set; }
    public DateTime? CopiedAt             { get; set; }
    public Guid?    CounsellorCompletionId { get; set; }

    public Guid?    CreatedByUserId       { get; set; }
    public Guid?    UpdatedByUserId       { get; set; }
    public DateTime CreatedAt             { get; set; }
    public DateTime UpdatedAt             { get; set; }
    public DateTime? DeletedAt            { get; set; }
    public string   Status                { get; set; } = "active";
}
