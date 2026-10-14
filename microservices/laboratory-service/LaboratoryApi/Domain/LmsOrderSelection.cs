namespace LaboratoryApi.Domain;

/// <summary>User-selected catalogue identity on an order version (Test, Panel, or ReferralTest).</summary>
public class LmsOrderSelection
{
    public Guid Id { get; set; }
    public Guid TenantId { get; set; }
    public Guid OrderVersionId { get; set; }

    public Guid CatalogueItemId { get; set; }
    public Guid? CatalogueVersionId { get; set; }
    public string CatalogueType { get; set; } = CatalogueTypes.Test;
    public int SortOrder { get; set; }

    public string? DisplayNameSnapshot { get; set; }
    public string? InternalOrderCodeSnapshot { get; set; }

    public LmsOrderVersion? OrderVersion { get; set; }
}
