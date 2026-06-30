namespace IpManagementService.Models.Domain;

/// <summary>
/// Structured medico-legal signatory record for a Consent-category
/// <see cref="PreOpCompletion"/> (one row per completion). Captures who signed
/// (patient / witness / surgeon), the consent form version, signing method and
/// timestamp. Revoke columns are reserved for the next-pass revoke flow.
/// </summary>
public class PreOpConsentDetail
{
    public Guid      Id                { get; set; }
    public Guid      TenantId          { get; set; }
    public Guid      CompletionId      { get; set; }

    public bool      PatientSigned     { get; set; }
    public string?   WitnessName       { get; set; }
    public string?   WitnessRelation   { get; set; }
    public Guid?     SurgeonUserId     { get; set; }
    public string?   ConsentVersion    { get; set; }

    /// <summary>Upload | ESign | Verbal | Video</summary>
    public string    Method            { get; set; } = "Upload";
    public DateTime? SignedAt          { get; set; }
    public Guid?     CapturedByUserId  { get; set; }

    // Reserved for the next-pass revoke flow.
    public DateTime? RevokedAt         { get; set; }
    public string?   RevokedReason     { get; set; }
    public Guid?     RevokedByUserId   { get; set; }

    public DateTime  CreatedAt         { get; set; }
    public DateTime  UpdatedAt         { get; set; }
}
