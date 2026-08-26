namespace InventoryApi.Models.Entities;

public class StockBatch
{
    public Guid Id { get; set; }
    public Guid TenantId { get; set; }
    public Guid StoreId { get; set; }
    public Guid ItemId { get; set; }
    public Guid? InvoiceId { get; set; }
    public Guid? PurchaseItemId { get; set; }
    public string BatchNumber { get; set; } = string.Empty;
    public DateTime? ExpiryDate { get; set; }
    public string? Barcode { get; set; }
    public bool RequiresColdStorage { get; set; } = false;
    public decimal Mrp { get; set; }
    public decimal PurchaseRate { get; set; }
    public decimal QuantityIn { get; set; }
    public decimal QuantityOut { get; set; } = 0;
    public decimal QuantityAvailable { get; set; }
    public bool IsConsignment { get; set; }
    public Guid? VendorId { get; set; }
    public bool IsActive { get; set; } = true;
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }
    public Guid? CreatedByUserId { get; set; }
    public Guid? UpdatedByUserId { get; set; }
    public DateTime? DeletedAt { get; set; }
    public string Status { get; set; } = "active";

    // Navigation
    public StoreMaster? Store { get; set; }
    public ItemMaster? Item { get; set; }
    public PurchaseInvoice? Invoice { get; set; }
    public ICollection<StockLedger> Ledgers { get; set; } = [];
}
