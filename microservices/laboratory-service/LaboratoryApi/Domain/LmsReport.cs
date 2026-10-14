namespace LaboratoryApi.Domain;

/// <summary>
/// L-REP-01 Enterprise LMS Report aggregate (LaboratoryApi SoT).
/// Not legacy Pathology reporting. Not CanonicalDocument. Not ResultStatus.
/// </summary>
public class LmsReport
{
    public Guid Id { get; set; }
    public Guid TenantId { get; set; }
    public Guid OperatingBranchId { get; set; }
    public Guid PatientId { get; set; }
    public Guid OrderId { get; set; }

    /// <summary>Report-domain status. Draft → Final (L-REP-02A); Final → Released (L-REP-02B).</summary>
    public string Status { get; set; } = ReportStatuses.Draft;

    public int CurrentVersionNumber { get; set; }

    /// <summary>L-REP-02A — server UTC when Status became Final. Null while Draft.</summary>
    public DateTime? FinalizedAtUtc { get; set; }

    /// <summary>L-REP-02A — actor who Finalized. Null while Draft.</summary>
    public Guid? FinalizedByUserId { get; set; }

    /// <summary>L-REP-02B — server UTC when Status became Released. Null until Released.</summary>
    public DateTime? ReleasedAtUtc { get; set; }

    /// <summary>L-REP-02B — actor who Released. Null until Released.</summary>
    public Guid? ReleasedByUserId { get; set; }

    /// <summary>
    /// L-REP-03 CUT A — immutable business Report Number on the Report aggregate.
    /// Assigned only after Released via separate assign-number operation (not Release).
    /// </summary>
    public string? BusinessReportNumber { get; set; }

    /// <summary>L-REP-03 — UTC when BusinessReportNumber was assigned.</summary>
    public DateTime? BusinessReportNumberAssignedAtUtc { get; set; }

    /// <summary>L-REP-03 — actor who assigned BusinessReportNumber.</summary>
    public Guid? BusinessReportNumberAssignedByUserId { get; set; }

    /// <summary>
    /// L-REP-03 CUT B — current official Official PDF artifact pointer (LaboratoryApi SoT).
    /// Updated only after successful generation; never points at a failed artifact.
    /// </summary>
    public Guid? CurrentOfficialArtifactId { get; set; }

    public DateTime CreatedAtUtc { get; set; }
    public Guid CreatedByUserId { get; set; }
    public DateTime UpdatedAtUtc { get; set; }
    public Guid UpdatedByUserId { get; set; }
    public int RowVersion { get; set; }

    public ICollection<LmsReportVersion> Versions { get; set; } = new List<LmsReportVersion>();
}
