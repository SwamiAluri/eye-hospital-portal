namespace LaboratoryApi.Domain;

/// <summary>
/// Optional branch applicability using existing platform Branch IDs.
/// No rows ⇒ tenant-wide applicability for the version.
/// </summary>
public class LmsCatalogueBranchApplicability
{
    public Guid Id { get; set; }
    public Guid TenantId { get; set; }
    public Guid CatalogueVersionId { get; set; }

    /// <summary>Existing platform Branch Id (no new org hierarchy).</summary>
    public Guid BranchId { get; set; }

    public LmsCatalogueVersion? CatalogueVersion { get; set; }
}
