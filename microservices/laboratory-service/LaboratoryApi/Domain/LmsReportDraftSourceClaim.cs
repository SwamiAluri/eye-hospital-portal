namespace LaboratoryApi.Domain;

/// <summary>
/// PD-REP-DRAFT-UNIQUE-01 — race-safe exclusivity: one ResultVersion may belong to
/// at most one active Draft Report per tenant. Does not replace immutable
/// <see cref="LmsReportVersionSource"/> snapshots; allows the same ResultVersion
/// across ReportVersions of the owning Draft Report.
/// </summary>
public class LmsReportDraftSourceClaim
{
    public Guid Id { get; set; }
    public Guid TenantId { get; set; }
    public Guid ResultVersionId { get; set; }
    public Guid ReportId { get; set; }
    public Guid ResultId { get; set; }
    public int ResultVersionNumber { get; set; }
    public DateTime CreatedAtUtc { get; set; }
}
