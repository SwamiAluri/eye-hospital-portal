namespace AuthService.DTOs.Billing;

public class UnmappedChargeItemDto
{
    public Guid? ItemId { get; set; }
    public string ItemName { get; set; } = string.Empty;
    public string ItemCode { get; set; } = string.Empty;
    public string ItemType { get; set; } = "Consumable";
    public int UseCount { get; set; }
    public DateTime? LastUsedAt { get; set; }
    public decimal EstimatedValue { get; set; }
    public int OpenExceptionCount { get; set; }
    public Guid? SuggestedVariantId { get; set; }
    public string? LastPatientName { get; set; }
    public string? LastUhid { get; set; }
}

public class ChargeMappingKpisDto
{
    public int UnmappedItemCount { get; set; }
    public decimal BlockedChargeValue { get; set; }
    public int BillsAffected { get; set; }
    public int MappedThisWeek { get; set; }
}

public class ChargeExceptionListDto
{
    public ChargeMappingKpisDto Kpis { get; set; } = new();
    public List<UnmappedChargeItemDto> Items { get; set; } = new();
    public List<PackageComponentStatusDto> UnmappedPackageComponents { get; set; } = new();
}

public class CreateChargeMappingRequest
{
    public Guid ItemId { get; set; }
    public Guid ServiceVariantId { get; set; }
    public bool IsChargeable { get; set; } = true;
    public string? NonChargeableReason { get; set; }
    public DateTime? EffectiveFrom { get; set; }
}

public class ChargeMappingDto
{
    public Guid Id { get; set; }
    public Guid ItemId { get; set; }
    public Guid ServiceVariantId { get; set; }
    public string? VariantName { get; set; }
    public bool IsChargeable { get; set; }
    public string? NonChargeableReason { get; set; }
    public DateTime EffectiveFrom { get; set; }
    public DateTime? EffectiveTo { get; set; }
}

public class PackageComponentStatusDto
{
    public Guid Id { get; set; }
    public Guid PackageTemplateId { get; set; }
    public string PackageName { get; set; } = string.Empty;
    public string ComponentKey { get; set; } = string.Empty;
    public string ComponentName { get; set; } = string.Empty;
    public Guid? ServiceVariantId { get; set; }
    public string? VariantCode { get; set; }
    public string Allocation { get; set; } = "Fixed";
    public bool CoversConsumable { get; set; }
    public decimal? CatalogPrice { get; set; }
    public string Status { get; set; } = "Unmapped";
}

public class SavePackageComponentsRequest
{
    public List<SavePackageComponentLine> Components { get; set; } = new();
}

public class SavePackageComponentLine
{
    public string ComponentKey { get; set; } = string.Empty;
    public string ComponentName { get; set; } = string.Empty;
    public Guid? ServiceVariantId { get; set; }
    public string Allocation { get; set; } = "Fixed";
    public bool CoversConsumable { get; set; }
    public int SortOrder { get; set; }
}

public class ChargeVariantSearchDto
{
    public Guid Id { get; set; }
    public string Code { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
    public decimal Price { get; set; }
}

public class ReplayExceptionsResultDto
{
    public int Posted { get; set; }
    public int NeedsAdjustment { get; set; }
    public int StillUnmapped { get; set; }
    public int MarkedNonChargeable { get; set; }
    /// <summary>
    /// Mapped and priced, but no open OpdBill (or no verified opd_bill_items row).
    /// Exception stays Open — never counted as Posted.
    /// </summary>
    public int BlockedNoBill { get; set; }
}
