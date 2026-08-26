using System.ComponentModel.DataAnnotations.Schema;

namespace AuthService.Models.Domain;

/// <summary>
/// Transactional outbox for Billing → CCMS. Rows are written in the same
/// SaveChanges as the OpdBill mutation, then delivered with retries.
/// </summary>
[Table("billing_ccms_outbox")]
public class BillingCcmsOutboxEvent
{
    public Guid     Id              { get; set; }
    public Guid     TenantId        { get; set; }
    public string   EventType       { get; set; } = string.Empty;
    public string   AggregateType   { get; set; } = "OpdBill";
    public Guid     AggregateId     { get; set; }
    public Guid?    CorrelationId   { get; set; }
    public string   PayloadJson     { get; set; } = "{}";
    public string   IdempotencyKey  { get; set; } = string.Empty;
    public DateTime OccurredAt      { get; set; }
    public string   Status          { get; set; } = BillingOutboxStatuses.Pending;
    public int      RetryCount      { get; set; }
    public DateTime? LastAttemptAt  { get; set; }
    public DateTime? ProcessedAt    { get; set; }
    public string?  Error           { get; set; }
    [Column("abandon_reason")]
    public string?  AbandonReason   { get; set; }
    [Column("compensating_action")]
    public string?  CompensatingAction { get; set; }
    [Column("abandoned_at")]
    public DateTime? AbandonedAt    { get; set; }
    [Column("abandoned_by_user_id")]
    public Guid?    AbandonedByUserId { get; set; }
    public DateTime CreatedAt       { get; set; }
    public DateTime UpdatedAt       { get; set; }
}

public static class BillingOutboxStatuses
{
    public const string Pending    = "Pending";
    public const string Processing = "Processing";
    public const string Processed  = "Processed";
    public const string Failed     = "Failed";
    public const string Dead       = "Dead";
    public const string Abandoned  = "Abandoned";
}

public static class BillingCcmsEventTypes
{
    public const string BillFinalized            = "BillFinalized";
    public const string PaymentReceived          = "PaymentReceived";
    public const string PaymentReversed          = "PaymentReversed";
    public const string PatientObligationChanged = "PatientObligationChanged";
}
