namespace LaboratoryApi.Domain;

/// <summary>Ordered panel membership referencing a specific component catalogue version.</summary>
public class LmsCataloguePanelComponent
{
    public Guid Id { get; set; }
    public Guid TenantId { get; set; }
    public Guid PanelVersionId { get; set; }

    public Guid ComponentCatalogueItemId { get; set; }
    public Guid ComponentVersionId { get; set; }

    public int SortOrder { get; set; }
    public bool IsRequired { get; set; } = true;

    public LmsCatalogueVersion? PanelVersion { get; set; }
}
