namespace LaboratoryApi.Domain;

/// <summary>Tenant-scoped Report operation idempotency (separate from Result store).</summary>
public class LmsReportIdempotencyRecord
{
    public Guid Id { get; set; }
    public Guid TenantId { get; set; }
    public string IdempotencyKey { get; set; } = string.Empty;
    public string Operation { get; set; } = string.Empty;
    public string RequestHash { get; set; } = string.Empty;
    public Guid ReportId { get; set; }
    public string ResponseJson { get; set; } = string.Empty;
    public DateTime CreatedAt { get; set; }
}
