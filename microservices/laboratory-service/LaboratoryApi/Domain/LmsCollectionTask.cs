namespace LaboratoryApi.Domain;

/// <summary>L-COL-01B CollectionTask — planning/work unit. No specimen fields.</summary>
public class LmsCollectionTask
{
    public Guid Id { get; set; }
    public Guid TenantId { get; set; }

    /// <summary>Human-facing: COL-YYYYMMDD-XXXXXX. Server-generated.</summary>
    public string TaskNumber { get; set; } = string.Empty;

    public Guid OrderId { get; set; }

    /// <summary>Authorized Branch ID (PD-COL-05).</summary>
    public Guid CollectionBranchId { get; set; }

    /// <summary>Optional free-text location — not a location master.</summary>
    public string? LocationText { get; set; }

    /// <summary>Planned | Ready | InProgress | Completed | Cancelled</summary>
    public string Status { get; set; } = CollectionTaskStatuses.Planned;

    public Guid? ClaimedByUserId { get; set; }
    public DateTime? ClaimedAt { get; set; }
    public Guid? AssignedToUserId { get; set; }
    public DateTime? AssignedAt { get; set; }

    public string? Notes { get; set; }
    public string? CancelReason { get; set; }

    public DateTime CreatedAt { get; set; }
    public Guid CreatedBy { get; set; }
    public DateTime? UpdatedAt { get; set; }
    public Guid? UpdatedBy { get; set; }

    public int RowVersion { get; set; }

    public ICollection<LmsCollectionTaskOrderTest> OrderTests { get; set; } = new List<LmsCollectionTaskOrderTest>();
}
