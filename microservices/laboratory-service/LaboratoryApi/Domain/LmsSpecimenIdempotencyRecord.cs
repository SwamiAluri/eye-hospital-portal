namespace LaboratoryApi.Domain;

/// <summary>Tenant-scoped Specimen operation idempotency (PD-COL-SPC-19). Separate from Order/Collection stores.</summary>
public class LmsSpecimenIdempotencyRecord
{
    public Guid Id { get; set; }
    public Guid TenantId { get; set; }
    public string IdempotencyKey { get; set; } = string.Empty;
    public string Operation { get; set; } = string.Empty;
    public string RequestHash { get; set; } = string.Empty;
    public Guid SpecimenId { get; set; }
    public string ResponseJson { get; set; } = string.Empty;
    public DateTime CreatedAt { get; set; }
}