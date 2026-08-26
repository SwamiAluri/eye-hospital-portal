namespace AuthService.Models.Domain;

// ServiceCatalog entity was removed — replaced by ServiceVariant (ServiceCatalogV2.cs)

public class OpdBillItem
{
    public Guid Id { get; set; }
    public Guid TenantId { get; set; }
    
    // Bill Reference
    public Guid OpdBillId { get; set; }
    
    // Service Reference
    public Guid? ServiceVariantId { get; set; }
    public string ServiceCode { get; set; } = string.Empty;
    public string ServiceName { get; set; } = string.Empty;
    public string ServiceCategory { get; set; } = string.Empty;
    public string? Description { get; set; }
    
    // Quantity & Pricing
    public int Quantity { get; set; } = 1;
    public decimal UnitPrice { get; set; }
    public decimal Subtotal { get; set; } // quantity * unit_price
    
    // Discount
    public decimal DiscountAmount { get; set; }
    public decimal DiscountPercentage { get; set; }
    public string? DiscountReason { get; set; }
    
    // Tax
    public decimal TaxAmount { get; set; }
    public decimal TaxPercentage { get; set; }
    
    // Total
    public decimal TotalAmount { get; set; } // subtotal - discount + tax
    
    // Provider Information
    public Guid? PerformedByUserId { get; set; }
    public DateTime? PerformedAt { get; set; }
    public Guid? DepartmentId { get; set; }
    
    // Status
    public string Status { get; set; } = "pending"; // pending, completed, cancelled
    
    // Notes
    public string? Notes { get; set; }

    /// <summary>BILL-030: Package | PackageDiscount | Implant | Consumable | Room | Procedure | Manual.</summary>
    public string SourceType { get; set; } = "Manual";
    public Guid? SourceRefId { get; set; }
    public string? IdempotencyKey { get; set; }
    
    // Standard Fields
    public DateTime CreatedAt { get; set; }
    public DateTime? UpdatedAt { get; set; }
    public Guid CreatedByUserId { get; set; }
    public Guid? UpdatedByUserId { get; set; }
    public DateTime? DeletedAt { get; set; }
    
    // Navigation
    public virtual OpdBill? OpdBill { get; set; }
    public virtual ServiceVariant? ServiceVariant { get; set; }
    public virtual Department? Department { get; set; }
}
