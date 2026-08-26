namespace IpManagementService.Models.Dtos;

public class RecordImplantRequest
{
    public Guid?    ItemId         { get; set; }
    public string?  CatalogRef     { get; set; }
    public string?  SerialNumber   { get; set; }
    public string?  BatchNumber    { get; set; }
    public string?  UdiBarcode     { get; set; }
    public decimal? Power          { get; set; }
    public string   Eye            { get; set; } = string.Empty;
    public string   UsageStatus    { get; set; } = "Implanted";
    public Guid?    SurgeonUserId  { get; set; }
    public string?  WastageReason  { get; set; }
    public bool     AcknowledgeMismatch { get; set; }
    public string?  MismatchReason { get; set; }
}

public class UpdateImplantRequest
{
    public string UsageStatus { get; set; } = string.Empty;
    public string Reason      { get; set; } = string.Empty;
}

public record ImplantUsageDto(
    Guid      Id,
    Guid      JourneyId,
    Guid      PatientId,
    string    Eye,
    Guid?     ItemId,
    string?   CatalogRef,
    string?   Brand,
    string?   Model,
    decimal?  Power,
    string?   SerialNumber,
    string?   BatchNumber,
    string?   UdiBarcode,
    string    UsageStatus,
    Guid?     SurgeonUserId,
    DateTime  ScannedAt,
    Guid?     ScannedByUserId,
    Guid?     ChargeItemId,
    string    ChargeStatus,
    string?   WastageReason,
    string?   Warning = null
);
