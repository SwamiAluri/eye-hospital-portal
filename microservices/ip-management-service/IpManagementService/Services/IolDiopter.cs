using System.Globalization;
using System.Text.RegularExpressions;

namespace IpManagementService.Services;

/// <summary>
/// IOL power compare (W-07 A2). Catalog <c>power_increment</c> is a picker step only,
/// never a match tolerance. Empty / unparsable planned power is not a number.
/// </summary>
public static class IolDiopter
{
    private static readonly Regex TrailingUnit = new(
        @"\s*(D|d|diopt(?:er|re)s?)\s*$",
        RegexOptions.CultureInvariant | RegexOptions.Compiled);

    public static decimal Round2(decimal value)
        => Math.Round(value, 2, MidpointRounding.AwayFromZero);

    public static decimal? Round2(decimal? value)
        => value is null ? null : Round2(value.Value);

    public static decimal? Parse(string? raw)
    {
        if (string.IsNullOrWhiteSpace(raw)) return null;
        var s = TrailingUnit.Replace(raw.Trim(), string.Empty).Replace("+", string.Empty, StringComparison.Ordinal);
        s = s.Replace(" ", string.Empty, StringComparison.Ordinal);
        if (!decimal.TryParse(s, NumberStyles.Number, CultureInfo.InvariantCulture, out var value))
            return null;
        return Round2(value);
    }

    public static bool Differs(decimal a, decimal b)
        => Round2(a) != Round2(b);

    public static string Format(decimal value)
    {
        var rounded = Round2(value);
        return rounded >= 0m
            ? $"+{rounded.ToString("0.00", CultureInfo.InvariantCulture)} D"
            : $"{rounded.ToString("0.00", CultureInfo.InvariantCulture)} D";
    }

    public static string NormalizeModel(string? value)
        => string.IsNullOrWhiteSpace(value)
            ? string.Empty
            : string.Join(" ", value.Trim().Split((char[]?)null, StringSplitOptions.RemoveEmptyEntries));
}
