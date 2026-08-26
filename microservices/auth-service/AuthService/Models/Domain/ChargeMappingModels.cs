using System.ComponentModel.DataAnnotations.Schema;

namespace AuthService.Models.Domain;

[Table("service_variant_item_map")]
public class ServiceVariantItemMap
{
    public Guid Id { get; set; }
    public Guid TenantId { get; set; }
    public Guid ItemId { get; set; }
    public Guid ServiceVariantId { get; set; }
    public bool IsChargeable { get; set; } = true;
    public string? NonChargeableReason { get; set; }
    public DateTime EffectiveFrom { get; set; } = DateTime.UtcNow;
    public DateTime? EffectiveTo { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public Guid? CreatedByUserId { get; set; }
    public DateTime? UpdatedAt { get; set; }
    public Guid? UpdatedByUserId { get; set; }
}

[Table("charge_exception")]
public class ChargeException
{
    public Guid Id { get; set; }
    public Guid TenantId { get; set; }
    public Guid? ItemId { get; set; }
    public Guid? PackageTemplateId { get; set; }
    public Guid? PackageComponentId { get; set; }
    public string SourceType { get; set; } = "Consumable";
    public Guid? SourceRefId { get; set; }
    public Guid? OpdBillId { get; set; }
    public Guid? PatientJourneyId { get; set; }
    public decimal Quantity { get; set; } = 1;
    public decimal EstimatedValue { get; set; }
    public string Status { get; set; } = ChargeExceptionStatus.Open;
    public string? Reason { get; set; }
    public string? IdempotencyKey { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime? ResolvedAt { get; set; }
    public Guid? ResolvedByUserId { get; set; }
}

public static class ChargeExceptionStatus
{
    public const string Open = "Open";
    public const string Resolved = "Resolved";
    public const string NeedsAdjustment = "NeedsAdjustment";
    public const string NonChargeable = "NonChargeable";
}

[Table("package_component_map")]
public class PackageComponentMap
{
    public Guid Id { get; set; }
    public Guid TenantId { get; set; }
    public Guid PackageTemplateId { get; set; }
    public string ComponentKey { get; set; } = string.Empty;
    public string ComponentName { get; set; } = string.Empty;
    public Guid? ServiceVariantId { get; set; }
    public string Allocation { get; set; } = "Fixed";
    public bool CoversConsumable { get; set; }
    public int SortOrder { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime? UpdatedAt { get; set; }
    public Guid? CreatedByUserId { get; set; }
    public Guid? UpdatedByUserId { get; set; }
}

/// <summary>Read-only projection of inventory items (same Postgres database).</summary>
[Table("inv_item_master")]
public class InvItemMasterRead
{
    public Guid Id { get; set; }
    public Guid TenantId { get; set; }
    public string ItemName { get; set; } = string.Empty;
    public string ItemType { get; set; } = string.Empty;
    public DateTime? DeletedAt { get; set; }
    public string Status { get; set; } = "active";
}

/// <summary>Read-only projection of OT issues used to rank unmapped items and write INV-050 charge status.</summary>
[Table("inv_surgery_consumables")]
public class InvSurgeryConsumableRead
{
    public Guid Id { get; set; }
    public Guid TenantId { get; set; }
    public Guid? JourneyId { get; set; }
    public Guid ItemId { get; set; }
    public decimal Quantity { get; set; }
    public decimal Amount { get; set; }
    public string ChargeStatus { get; set; } = "Pending";
    public Guid? ChargeItemId { get; set; }
    public string? ConsumableStatus { get; set; }
    public DateTime IssuedAt { get; set; }
    public DateTime? DeletedAt { get; set; }
}

/// <summary>INV-051. Read-only clinical implant registry (IP-owned table, same Postgres).</summary>
[Table("journey_implant_usage")]
public class JourneyImplantUsageRead
{
    public Guid Id { get; set; }
    public Guid TenantId { get; set; }
    public Guid JourneyId { get; set; }
    public Guid PatientId { get; set; }
    public string Eye { get; set; } = string.Empty;
    public Guid? ItemId { get; set; }
    public string? CatalogRef { get; set; }
    public string? Brand { get; set; }
    public string? Model { get; set; }
    public decimal? Power { get; set; }
    public string? SerialNumber { get; set; }
    public string UsageStatus { get; set; } = "Implanted";
    public Guid? SurgeonUserId { get; set; }
    public DateTime ScannedAt { get; set; }
    public Guid? InventoryTxnId { get; set; }
    public Guid? ChargeItemId { get; set; }
    public string ChargeStatus { get; set; } = "Pending";
    public string? WastageReason { get; set; }
    public DateTime? DeletedAt { get; set; }
}

/// <summary>INV-051. Read-only stock movements (inventory-owned table, same Postgres).</summary>
[Table("inv_stock_ledger")]
public class InvStockLedgerRead
{
    public Guid Id { get; set; }
    public Guid TenantId { get; set; }
    public Guid StoreId { get; set; }
    public Guid ItemId { get; set; }
    public Guid? StockBatchId { get; set; }
    public string TransactionType { get; set; } = string.Empty;
    public string? ReferenceId { get; set; }
    public string? ReferenceNumber { get; set; }
    public decimal QuantityOut { get; set; }
    public decimal UnitRate { get; set; }
    public decimal TotalValue { get; set; }
    public DateTime TransactionDate { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime? DeletedAt { get; set; }
}

/// <summary>INV-051. Purchase rate for wastage cost. Never used as a patient charge.</summary>
[Table("inv_stock_batches")]
public class InvStockBatchRead
{
    public Guid Id { get; set; }
    public Guid TenantId { get; set; }
    public Guid ItemId { get; set; }
    public decimal PurchaseRate { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime? DeletedAt { get; set; }
    public bool IsActive { get; set; } = true;
}
