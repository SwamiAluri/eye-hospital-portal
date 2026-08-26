namespace AuthService.Services;

/// <summary>Canonical bed_inventory FSM used by IP journey occupancy (Wave 3).</summary>
public static class BedLifecyclePolicy
{
    public const string Available = "Available";
    public const string Reserved = "Reserved";
    public const string Occupied = "Occupied";
    public const string Cleaning = "Cleaning";
    public const string Maintenance = "Under_Maintenance";

    public static string Next(string current, string action)
    {
        var from = string.IsNullOrWhiteSpace(current) ? Available : current.Trim();
        return action.Trim().ToLowerInvariant() switch
        {
            "reserve" when from is Available or Cleaning => Reserved,
            "occupy" when from is Available or Reserved or Occupied => Occupied,
            "transfer-out" when from is Occupied or Reserved => Cleaning,
            "vacate" when from is Occupied or Reserved => Cleaning,
            "cleaned" when from is Cleaning => Available,
            "release" => Available,
            _ => throw new InvalidOperationException(
                $"Bed cannot '{action}' from status '{from}'."),
        };
    }
}
