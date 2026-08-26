namespace InventoryApi.Models.Entities;

public class StockLedger
{
    public Guid Id { get; set; }
    public Guid TenantId { get; set; }
    public Guid StoreId { get; set; }
    public Guid ItemId { get; set; }
    public Guid? StockBatchId { get; set; }
    /// <summary>
    /// GRN_IN | PHARMACY_ISSUE | OT_ISSUE | TRANSFER_OUT | TRANSFER_IN |
    /// RETURN_TO_VENDOR | ADJUSTMENT | PATIENT_IOL_ISSUE | EXPIRY_WRITE_OFF |
    /// IMPLANT_WASTE | IMPLANT_RETURN
    /// </summary>
    public string TransactionType { get; set; } = string.Empty;
    public string? ReferenceId { get; set; }
    public string? ReferenceNumber { get; set; }
    public decimal QuantityIn { get; set; } = 0;
    public decimal QuantityOut { get; set; } = 0;
    public decimal BalanceQuantity { get; set; }
    public decimal UnitRate { get; set; }
    public decimal TotalValue { get; set; }
    public string? Remarks { get; set; }
    /// <summary>Patient name — populated for PATIENT_IOL_ISSUE transactions.</summary>
    public string? PatientName { get; set; }
    /// <summary>Patient IP/MR number — populated for PATIENT_IOL_ISSUE transactions.</summary>
    public string? PatientIpNo { get; set; }
    public DateTime TransactionDate { get; set; }
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
