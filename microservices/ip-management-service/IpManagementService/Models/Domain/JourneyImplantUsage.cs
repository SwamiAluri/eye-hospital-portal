namespace IpManagementService.Models.Domain;

/// <summary>
/// OT-020 clinical implant/IOL registry (FHIR Device / Procedure.usedReference analogue).
/// Billing and inventory are projections driven by the outbox, not this row.
/// </summary>
public class JourneyImplantUsage
{
    public Guid     Id                 { get; set; }
    public Guid     TenantId           { get; set; }
    public Guid     JourneyId          { get; set; }
    public Guid     PatientId          { get; set; }
    public string   Eye                { get; set; } = string.Empty;
    public Guid?    ItemId             { get; set; }
    public string?  CatalogRef         { get; set; }
    public string?  Brand              { get; set; }
    public string?  Model              { get; set; }
    public decimal? Power              { get; set; }
    public string?  SerialNumber       { get; set; }
    public string?  BatchNumber        { get; set; }
    public string?  UdiBarcode         { get; set; }
    public string   UsageStatus        { get; set; } = ImplantUsageStatus.Implanted;
    public Guid?    SurgeonUserId      { get; set; }
    public DateTime ScannedAt          { get; set; }
    public Guid?    ScannedByUserId    { get; set; }
    public Guid?    InventoryTxnId     { get; set; }
    public Guid?    ChargeItemId       { get; set; }
    public string   ChargeStatus       { get; set; } = ImplantChargeStatus.Pending;
    public string?  WastageReason      { get; set; }
    public DateTime CreatedAt          { get; set; }
    public DateTime UpdatedAt          { get; set; }
    public Guid?    CreatedByUserId    { get; set; }
    public Guid?    UpdatedByUserId    { get; set; }
    public DateTime? DeletedAt         { get; set; }
    public string   Status             { get; set; } = "active";
}

public static class ImplantUsageStatus
{
    public const string Implanted     = "Implanted";
    public const string OpenedUnused  = "Opened_Unused";
    public const string Wasted        = "Wasted";
    public const string Returned      = "Returned";
    public const string Reversed      = "Reversed";

    public static readonly HashSet<string> All =
    [
        Implanted, OpenedUnused, Wasted, Returned, Reversed,
    ];

    public static readonly HashSet<string> Recordable =
    [
        Implanted, OpenedUnused, Wasted, Returned,
    ];

    public static readonly HashSet<string> WriteOff =
    [
        OpenedUnused, Wasted,
    ];

    public static bool IsWriteOff(string? status)
        => status is OpenedUnused or Wasted;
}

public static class ImplantChargeStatus
{
    public const string Pending       = "Pending";
    public const string Posted        = "Posted";
    public const string Suppressed    = "Suppressed";
    public const string Exception     = "Exception";
    public const string CreditPending = "CreditPending";
    public const string Credited      = "Credited";
    public const string Covered       = "Covered";
}
