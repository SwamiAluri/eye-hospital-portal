namespace LaboratoryApi.Domain;

/// <summary>
/// Stable catalogue identity. Versioned definitions live on <see cref="LmsCatalogueVersion"/>.
/// </summary>
public class LmsCatalogueItem
{
    public Guid Id { get; set; }
    public Guid TenantId { get; set; }

    /// <summary>TEST | PANEL | REFERRAL_TEST</summary>
    public string CatalogueType { get; set; } = CatalogueTypes.Test;

    public Guid? CurrentActiveVersionId { get; set; }
    public Guid? LatestVersionId { get; set; }

    public DateTime CreatedAt { get; set; }
    public Guid CreatedBy { get; set; }
    public DateTime? UpdatedAt { get; set; }
    public Guid? UpdatedBy { get; set; }

    /// <summary>Soft-delete only; never hard-delete clinical definitions.</summary>
    public bool IsDeleted { get; set; }
    public DateTime? DeletedAt { get; set; }
    public Guid? DeletedBy { get; set; }

    public LmsCatalogueVersion? CurrentActiveVersion { get; set; }
    public LmsCatalogueVersion? LatestVersion { get; set; }
    public ICollection<LmsCatalogueVersion> Versions { get; set; } = new List<LmsCatalogueVersion>();
}
