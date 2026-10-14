namespace LaboratoryApi.Domain;

/// <summary>
/// Per-tenant daily sequence for ACC-YYYYMMDD-NNNNNN (L-COL-01D).
/// Separate identifier domain from Order (LAB-*) and CollectionTask (COL-*).
/// </summary>
public class LmsAccessionNumberSequence
{
    public Guid Id { get; set; }
    public Guid TenantId { get; set; }
    public DateOnly SequenceDate { get; set; }
    public int LastValue { get; set; }
}
