namespace LaboratoryApi.Domain;

/// <summary>Stable LMS order identity. Versioned clinical content lives on <see cref="LmsOrderVersion"/>.</summary>
public class LmsOrder
{
    public Guid Id { get; set; }
    public Guid TenantId { get; set; }

    /// <summary>Human-facing business id: LAB-YYYYMMDD-NNNNNN. Server-generated, immutable.</summary>
    public string OrderNumber { get; set; } = string.Empty;

    /// <summary>Draft | Submitted | Cancelled</summary>
    public string Status { get; set; } = OrderStatuses.Draft;

    public Guid? CurrentVersionId { get; set; }
    public int CurrentVersionNumber { get; set; }

    public Guid OperatingBranchId { get; set; }

    public DateTime CreatedAt { get; set; }
    public Guid CreatedBy { get; set; }
    public DateTime? UpdatedAt { get; set; }
    public Guid? UpdatedBy { get; set; }

    public DateTime? CancelledAt { get; set; }
    public Guid? CancelledBy { get; set; }
    public string? CancelReason { get; set; }

    public int RowVersion { get; set; }

    public LmsOrderVersion? CurrentVersion { get; set; }
    public ICollection<LmsOrderVersion> Versions { get; set; } = new List<LmsOrderVersion>();
}
