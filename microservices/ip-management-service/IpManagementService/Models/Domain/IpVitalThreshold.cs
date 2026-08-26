namespace IpManagementService.Models.Domain;

/// <summary>
/// Tenant vitals compare for Mark Ready (W-06 A4). Seeded severity is warn;
/// locked decision D-A keeps this a warning even if a row is later set to block.
/// </summary>
public class IpVitalThreshold
{
    public Guid     Id            { get; set; }
    public Guid     TenantId      { get; set; }
    public int      SystolicMax   { get; set; } = 180;
    public int      DiastolicMax  { get; set; } = 110;
    public int      PulseMin      { get; set; } = 40;
    public int      PulseMax      { get; set; } = 140;
    public decimal  Spo2Min       { get; set; } = 92m;
    public decimal  TempMaxC      { get; set; } = 38.5m;
    public string   Severity      { get; set; } = "warn";
    public DateTime CreatedAt     { get; set; }
    public DateTime UpdatedAt     { get; set; }

    public static IpVitalThreshold Defaults(Guid tenantId) => new()
    {
        Id           = Guid.Empty,
        TenantId     = tenantId,
        SystolicMax  = 180,
        DiastolicMax = 110,
        PulseMin     = 40,
        PulseMax     = 140,
        Spo2Min      = 92m,
        TempMaxC     = 38.5m,
        Severity     = "warn",
    };
}
