namespace LaboratoryApi.Domain;

/// <summary>Individual test work item. Initial status Ordered only in L-ORD-01B.</summary>
public class LmsOrderTest
{
    public Guid Id { get; set; }
    public Guid TenantId { get; set; }
    public Guid OrderVersionId { get; set; }

    public Guid CatalogueItemId { get; set; }
    public Guid CatalogueVersionId { get; set; }
    public int CatalogueVersionNumber { get; set; }
    public string CatalogueType { get; set; } = CatalogueTypes.Test;

    public string DisplayNameSnapshot { get; set; } = string.Empty;
    public string InternalOrderCodeSnapshot { get; set; } = string.Empty;

    public string Status { get; set; } = OrderTestStatuses.Ordered;
    public int SortOrder { get; set; }

    /// <summary>When exploded from a panel, the panel catalogue identity.</summary>
    public Guid? PanelCatalogueItemId { get; set; }
    public Guid? PanelCatalogueVersionId { get; set; }
    public Guid? PanelSelectionId { get; set; }

    public LmsOrderVersion? OrderVersion { get; set; }
}
