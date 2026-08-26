namespace IpManagementService.Models.Domain;

/// <summary>
/// W-05 A5 inpatient wristband. One active token per journey until <see cref="RevokedAt"/>.
/// Not a second patient identifier — <see cref="BarcodeValue"/> encodes token + UHID + laterality.
/// </summary>
public class JourneySafetyToken
{
    public Guid      Id            { get; set; }
    public Guid      TenantId      { get; set; }
    public Guid      JourneyId     { get; set; }
    public string    TokenCode     { get; set; } = string.Empty;
    public string    BarcodeValue  { get; set; } = string.Empty;
    public string?   Laterality    { get; set; }
    public DateTime? PrintedAt     { get; set; }
    public Guid?     PrintedBy     { get; set; }
    public DateTime? RevokedAt     { get; set; }
    public DateTime  CreatedAt     { get; set; }
    public Guid      CreatedBy     { get; set; }
}
