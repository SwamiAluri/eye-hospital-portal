namespace LaboratoryApi.Domain;

/// <summary>Per-tenant daily sequence for LAB-YYYYMMDD-NNNNNN.</summary>
public class LmsOrderNumberSequence
{
    public Guid Id { get; set; }
    public Guid TenantId { get; set; }
    public DateOnly SequenceDate { get; set; }
    public int LastValue { get; set; }
}
