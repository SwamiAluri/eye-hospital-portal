namespace LaboratoryApi.Domain;

/// <summary>Tenant-scoped idempotency for order create/submit (and amend/cancel keys when used).</summary>
public class LmsOrderIdempotencyRecord
{
    public Guid Id { get; set; }
    public Guid TenantId { get; set; }
    public string IdempotencyKey { get; set; } = string.Empty;
    public string Operation { get; set; } = string.Empty;
    public string RequestHash { get; set; } = string.Empty;
    public Guid OrderId { get; set; }
    public string ResponseJson { get; set; } = string.Empty;
    public DateTime CreatedAt { get; set; }
}
