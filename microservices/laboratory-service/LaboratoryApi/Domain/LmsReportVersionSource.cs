namespace LaboratoryApi.Domain;

/// <summary>
/// Exact ResultVersion binding + structured snapshot for one source on a ReportVersion.
/// </summary>
public class LmsReportVersionSource
{
    public Guid Id { get; set; }
    public Guid TenantId { get; set; }
    public Guid ReportVersionId { get; set; }

    public Guid ResultId { get; set; }
    public Guid ResultVersionId { get; set; }
    public int ResultVersionNumber { get; set; }

    public Guid OrderTestId { get; set; }
    public Guid SpecimenId { get; set; }
    public Guid CatalogueItemId { get; set; }
    public Guid CatalogueVersionId { get; set; }
    public string ResultDatatype { get; set; } = string.Empty;

    public string? NumericValue { get; set; }
    public string? QualitativeValue { get; set; }
    public string? Unit { get; set; }
    public string? Comment { get; set; }

    /// <summary>ResultStatus at snapshot time (must be ClinicallyAuthorized for this slice).</summary>
    public string ResultStatusAtSnapshot { get; set; } = string.Empty;

    public Guid? AuthorizedByUserId { get; set; }
    public DateTime? AuthorizedAtUtc { get; set; }

    public LmsReportVersion? ReportVersion { get; set; }
}
