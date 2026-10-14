namespace LaboratoryApi.Domain;

/// <summary>
/// Immutable ReportVersion after creation. Snapshot provenance via Sources.
/// Regeneration creates a new version — never mutate in place.
/// </summary>
public class LmsReportVersion
{
    public Guid Id { get; set; }
    public Guid TenantId { get; set; }
    public Guid ReportId { get; set; }
    public int VersionNumber { get; set; }

    public Guid PatientId { get; set; }
    public Guid OrderId { get; set; }
    public Guid OperatingBranchId { get; set; }

    public DateTime CreatedAtUtc { get; set; }
    public Guid CreatedByUserId { get; set; }

    public LmsReport? Report { get; set; }
    public ICollection<LmsReportVersionSource> Sources { get; set; } = new List<LmsReportVersionSource>();
}
