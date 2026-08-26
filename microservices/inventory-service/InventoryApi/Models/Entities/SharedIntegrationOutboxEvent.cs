namespace InventoryApi.Models.Entities;

/// <summary>
/// Shared IP integration outbox (same Postgres table). Inventory writes ConsumablesConsumed
/// / ConsumablesReturned here so IP's existing processor delivers charges — no third outbox.
/// </summary>
public class SharedIntegrationOutboxEvent
{
    public Guid     Id             { get; set; }
    public Guid     TenantId       { get; set; }
    public string   EventType      { get; set; } = string.Empty;
    public string   AggregateType  { get; set; } = "PatientJourney";
    public Guid     AggregateId    { get; set; }
    public Guid?    CorrelationId  { get; set; }
    public string   PayloadJson    { get; set; } = "{}";
    public string   IdempotencyKey { get; set; } = string.Empty;
    public DateTime OccurredAt     { get; set; }
    public string   Status         { get; set; } = "Pending";
    public int      RetryCount     { get; set; }
    public DateTime? LastAttemptAt { get; set; }
    public DateTime? ProcessedAt   { get; set; }
    public string?  Error          { get; set; }
    public DateTime CreatedAt      { get; set; }
    public DateTime UpdatedAt      { get; set; }
}

public static class InventoryIntegrationEventTypes
{
    public const string ConsumablesConsumed = "ConsumablesConsumed";
    public const string ConsumablesReturned = "ConsumablesReturned";
}
