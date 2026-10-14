namespace LaboratoryApi.Domain;

/// <summary>Tenant-scoped idempotency for Collection mutations (AD-COL-05). Separate from Orders store.</summary>
public class LmsCollectionIdempotencyRecord
{
    public Guid Id { get; set; }
    public Guid TenantId { get; set; }
    public string IdempotencyKey { get; set; } = string.Empty;
    public string Operation { get; set; } = string.Empty;
    public string RequestHash { get; set; } = string.Empty;
    public Guid CollectionTaskId { get; set; }
    public string ResponseJson { get; set; } = string.Empty;
    public DateTime CreatedAt { get; set; }
}
