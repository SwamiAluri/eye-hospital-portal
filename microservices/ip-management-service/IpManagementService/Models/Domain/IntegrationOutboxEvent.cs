namespace IpManagementService.Models.Domain;

/// <summary>
/// Transactional outbox for reliable IP → CCMS lifecycle integration (Phase 2).
/// Events are written in the same DB transaction as the clinical change, then
/// delivered asynchronously with retries.
/// </summary>
public class IntegrationOutboxEvent
{
    public Guid     Id              { get; set; }
    public Guid     TenantId        { get; set; }
    public string   EventType       { get; set; } = string.Empty;
    public string   AggregateType   { get; set; } = "PatientJourney";
    public Guid     AggregateId     { get; set; }
    public Guid?    CorrelationId   { get; set; }
    public string   PayloadJson     { get; set; } = "{}";
    public string   IdempotencyKey  { get; set; } = string.Empty;
    public DateTime OccurredAt      { get; set; }
    /// <summary>Pending | Processing | Processed | Failed | Dead | Abandoned</summary>
    public string   Status          { get; set; } = OutboxStatuses.Pending;
    public int      RetryCount      { get; set; }
    public DateTime? LastAttemptAt  { get; set; }
    public DateTime? ProcessedAt    { get; set; }
    public string?  Error           { get; set; }
    public string?  AbandonReason   { get; set; }
    public string?  CompensatingAction { get; set; }
    public DateTime? AbandonedAt    { get; set; }
    public Guid?    AbandonedByUserId { get; set; }
    public DateTime CreatedAt       { get; set; }
    public DateTime UpdatedAt       { get; set; }
}

public static class OutboxStatuses
{
    public const string Pending    = "Pending";
    public const string Processing = "Processing";
    public const string Processed  = "Processed";
    public const string Failed     = "Failed";
    public const string Dead       = "Dead";
    public const string Abandoned  = "Abandoned";
}

public static class IntegrationEventTypes
{
    public const string JourneyAdmitted              = "JourneyAdmitted";
    public const string JourneyReadyForOt            = "JourneyReadyForOt";
    public const string SurgeryCompleted             = "SurgeryCompleted";
    public const string PatientClinicallyDischarged  = "PatientClinicallyDischarged";
    public const string JourneyReadyReverted         = "JourneyReadyReverted";
    public const string BillFinalized                = "BillFinalized";
    public const string EmergencyFcApplied           = "EmergencyFcApplied";
    public const string PatientObligationChanged     = "PatientObligationChanged";
    public const string PaymentReceived              = "PaymentReceived";
    public const string PaymentReversed              = "PaymentReversed";
    public const string ClaimStatusChanged           = "ClaimStatusChanged";
    public const string ImplantUsed                  = "ImplantUsed";
    public const string ImplantUsageReversed         = "ImplantUsageReversed";
    public const string ConsumablesConsumed          = "ConsumablesConsumed";
    public const string ConsumablesReturned          = "ConsumablesReturned";
    public const string BedTransferred               = "BedTransferred";
    /// <summary>IP-013. Ack-only for CCMS; OT board / slot analytics consume the outbox row.</summary>
    public const string JourneyScheduled             = "JourneyScheduled";
}
