namespace LaboratoryApi.Domain;

/// <summary>Per-tenant daily sequence for COL-YYYYMMDD-XXXXXX task numbers.</summary>
public class LmsCollectionTaskNumberSequence
{
    public Guid Id { get; set; }
    public Guid TenantId { get; set; }
    public DateOnly SequenceDate { get; set; }
    public int LastValue { get; set; }
}
