namespace LaboratoryApi.Domain;

/// <summary>
/// Explicit M:N-capable Specimen ↔ OrderTest link (PD-COL-SPC-01).
/// Unique (SpecimenId, OrderTestId); OrderTestId alone is not unique (future recollection).
/// </summary>
public class LmsSpecimenOrderTest
{
    public Guid Id { get; set; }
    public Guid TenantId { get; set; }
    public Guid SpecimenId { get; set; }
    public Guid OrderId { get; set; }
    public Guid OrderTestId { get; set; }
    public int SortOrder { get; set; }

    public LmsSpecimen? Specimen { get; set; }
}
