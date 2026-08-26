namespace InventoryApi.Models.Entities;

/// <summary>OT surgery consumable issue — links to surgery session</summary>
public class SurgeryConsumable
{
    public Guid Id { get; set; }
    public Guid TenantId { get; set; }
    public Guid StoreId { get; set; }
    public Guid? SurgeryId { get; set; }
    /// <summary>INV-050. IP patient journey. Null issues are exception-queued, not charged.</summary>
    public Guid? JourneyId { get; set; }
    public Guid ItemId { get; set; }
    public Guid? StockBatchId { get; set; }
    /// <summary>Bulk | PatientSpecific</summary>
    public string IolBillingMode { get; set; } = "Bulk";
    public string? PatientName { get; set; }
    public string? PatientIpNo { get; set; }
    public decimal Quantity { get; set; }
    public decimal UnitRate { get; set; }
    public decimal Amount { get; set; }
    public string? Barcode { get; set; }
    public string? Remarks { get; set; }
    /// <summary>Planned | StockCheckPending | StockAllocated | EscalationRaised | IssuedInOT | ReturnPosted | Closed | Cancelled</summary>
    public string ConsumableStatus { get; set; } = "IssuedInOT";
    public string? EscalationReason { get; set; }
    public decimal ReturnedQuantity { get; set; } = 0;
    public DateTime? ReturnedAt { get; set; }
    public DateTime? ClosedAt { get; set; }
    /// <summary>INV-050 billing projection. Pending | Posted | Suppressed | Exception | UnmappedJourney | Credited.</summary>
    public string ChargeStatus { get; set; } = ConsumableChargeStatus.Pending;
    public Guid? ChargeItemId { get; set; }
    public DateTime IssuedAt { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }
    public Guid? CreatedByUserId { get; set; }
    public Guid? UpdatedByUserId { get; set; }
    public DateTime? DeletedAt { get; set; }
    public string Status { get; set; } = "active";

    // Navigation
    public StoreMaster? Store { get; set; }
    public ItemMaster? Item { get; set; }
    public StockBatch? StockBatch { get; set; }
}

public static class ConsumableChargeStatus
{
    public const string Pending         = "Pending";
    public const string Posted          = "Posted";
    public const string Suppressed      = "Suppressed";
    public const string Exception       = "Exception";
    public const string UnmappedJourney = "UnmappedJourney";
    public const string Credited        = "Credited";
}
