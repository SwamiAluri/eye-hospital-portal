namespace AuthService.Services;

/// <summary>Canonical <c>bed_inventory.bed_type</c> values. Occupancy FSM is type-agnostic.</summary>
public static class BedInventoryTypes
{
    public const string General = "General";
    public const string Icu = "ICU";
    public const string Emergency = "Emergency";
    public const string Isolation = "Isolation";
    public const string Pediatric = "Pediatric";
    public const string Maternity = "Maternity";
    public const string Recliner = "Recliner";
    public const string DayCareChair = "DayCareChair";
}
