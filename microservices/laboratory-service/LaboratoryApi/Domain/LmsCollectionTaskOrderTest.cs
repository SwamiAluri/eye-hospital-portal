namespace LaboratoryApi.Domain;

/// <summary>Explicit CollectionTask ↔ OrderTest planning association (not SpecimenOrderTest).</summary>
public class LmsCollectionTaskOrderTest
{
    public Guid Id { get; set; }
    public Guid TenantId { get; set; }
    public Guid CollectionTaskId { get; set; }
    public Guid OrderId { get; set; }
    public Guid OrderTestId { get; set; }
    public int SortOrder { get; set; }

    public LmsCollectionTask? CollectionTask { get; set; }
}
