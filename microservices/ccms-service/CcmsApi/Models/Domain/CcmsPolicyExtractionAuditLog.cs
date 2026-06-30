namespace CcmsApi.Models.Domain;

/// <summary>
/// Audit trail for AI policy-card extraction sessions (front/back insurance card OCR).
/// Document blobs may be purged after 90 days; this row is kept for compliance.
/// </summary>
public class CcmsPolicyExtractionAuditLog
{
    public Guid     Id                    { get; set; }
    public Guid     TenantId              { get; set; }
    public Guid     UserId                { get; set; }
    public Guid     CoverageCase_Id       { get; set; }
    public string   SessionId             { get; set; } = string.Empty;
    public string?  IdempotencyKey        { get; set; }
    public string   Outcome               { get; set; } = "Confirmed";
    public string   OriginalFilename      { get; set; } = string.Empty;
    public string?  FrontDocumentUrl      { get; set; }
    public string?  BackDocumentUrl       { get; set; }
    public DateTime BlobPurgeAt           { get; set; }
    public bool     BlobPurged            { get; set; }
    public string   ProviderModel         { get; set; } = string.Empty;
    public int      ProcessingMs          { get; set; }
    public int      HighFieldCount        { get; set; }
    public int      ReviewFieldCount      { get; set; }
    public int      LowFieldCount         { get; set; }
    public int      FieldOverrideCount    { get; set; }
    public string?  OverriddenFieldsJson  { get; set; }
    public Guid?    CreatedPolicyId       { get; set; }
    public DateTime CreatedAt             { get; set; }
}
