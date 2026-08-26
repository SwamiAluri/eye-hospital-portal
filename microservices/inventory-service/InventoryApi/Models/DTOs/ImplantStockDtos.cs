namespace InventoryApi.Models.DTOs;

public static class ImplantStockTxn
{
    public const string OtIssue = "OT_ISSUE";
    public const string PatientIolIssue = "PATIENT_IOL_ISSUE";
    public const string ImplantWaste = "IMPLANT_WASTE";
    public const string ImplantReturn = "IMPLANT_RETURN";
}

public sealed class ApplyImplantStockRequest
{
    public Guid ImplantUsageId { get; set; }
    public Guid JourneyId { get; set; }
    public Guid? ItemId { get; set; }
    public string? CatalogRef { get; set; }
    public string? Brand { get; set; }
    public string? Model { get; set; }
    public string? SerialNumber { get; set; }
    public string? BatchNumber { get; set; }
    public string? UdiBarcode { get; set; }
    public string UsageStatus { get; set; } = "Implanted";
    public string? WastageReason { get; set; }
    public Guid? ActorUserId { get; set; }
    public string? PatientName { get; set; }
    public string? PatientIpNo { get; set; }
}

public sealed class ApplyImplantStockResult
{
    public Guid? LedgerId { get; set; }
    public Guid? ItemId { get; set; }
    public Guid? StoreId { get; set; }
    public string? TransactionType { get; set; }
    public bool Replayed { get; set; }
    public bool Unmapped { get; set; }
    public string? Reason { get; set; }
}
