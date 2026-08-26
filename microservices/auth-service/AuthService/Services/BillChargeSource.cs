namespace AuthService.Services;

/// <summary>
/// Origin of an <c>opd_bill_items</c> row. BILL-030 grouping and BILL-031/032 posting share these codes.
/// </summary>
public static class BillChargeSource
{
    public const string Package = "Package";
    public const string PackageDiscount = "PackageDiscount";
    public const string Implant = "Implant";
    public const string Consumable = "Consumable";
    public const string Room = "Room";
    public const string Procedure = "Procedure";
    public const string Manual = "Manual";

    public static readonly string[] All =
    [
        Package, PackageDiscount, Implant, Consumable, Room, Procedure, Manual,
    ];

    public static string Normalize(string? value)
        => All.FirstOrDefault(s => string.Equals(s, value, StringComparison.OrdinalIgnoreCase))
           ?? Manual;

    /// <summary>PackageDiscount renders inside the Package section at the counter.</summary>
    public static string DisplayGroup(string? sourceType)
    {
        var n = Normalize(sourceType);
        return n == PackageDiscount ? Package : n;
    }
}
