namespace LaboratoryApi.Domain;

/// <summary>Tenant-scoped Result operation idempotency (separate from Specimen/Order stores).</summary>
public class LmsResultIdempotencyRecord
{
    public Guid Id { get; set; }
    public Guid TenantId { get; set; }
    public string IdempotencyKey { get; set; } = string.Empty;
    public string Operation { get; set; } = string.Empty;
    public string RequestHash { get; set; } = string.Empty;
    public Guid ResultId { get; set; }
    public string ResponseJson { get; set; } = string.Empty;
    public DateTime CreatedAt { get; set; }
}
