namespace LaboratoryApi.Domain;

/// <summary>
/// Append-only draft version foundation. Not a released-result amendment workflow.
/// Future released versions must not overwrite history in place.
/// </summary>
public class LmsResultVersion
{
    public Guid Id { get; set; }
    public Guid TenantId { get; set; }
    public Guid ResultId { get; set; }
    public int VersionNumber { get; set; }

    public string? NumericValue { get; set; }
    public string? QualitativeValue { get; set; }
    public string? Unit { get; set; }
    public string? Comment { get; set; }

    public DateTime CreatedAtUtc { get; set; }
    public Guid CreatedByUserId { get; set; }

    public LmsResult? Result { get; set; }
}
