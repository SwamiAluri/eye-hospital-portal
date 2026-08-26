using System.Globalization;
using System.Text.Json;

namespace AuthService.Services;

/// <summary>
/// W-01 / FR-1.1 — OPD clinical fields onto OT schedule and IP journey.
/// Incoming blanks never overwrite; refresh is explicit.
/// </summary>
public static class OpdClinicalCopy
{
    public static string? FirstNonEmpty(params string?[] values)
    {
        foreach (var value in values)
        {
            if (!string.IsNullOrWhiteSpace(value))
                return value.Trim();
        }
        return null;
    }

    public static bool ShouldWrite(string? existing, string? incoming, bool forceRefresh)
    {
        if (string.IsNullOrWhiteSpace(incoming)) return false;
        if (forceRefresh) return true;
        return string.IsNullOrWhiteSpace(existing);
    }

    public static string? MapEyeToJourney(string? eye)
    {
        var e = (eye ?? string.Empty).Trim().ToUpperInvariant();
        return e switch
        {
            "RE" or "OD" or "RIGHT" or "R" => "OD",
            "LE" or "OS" or "LEFT" or "L" => "OS",
            "BE" or "OU" or "BOTH" or "BOTH_EYES" => "OU",
            "" => null,
            _ => e,
        };
    }

    public static string? MapEyeToBiometry(string? eye)
    {
        var mapped = MapEyeToJourney(eye);
        return mapped is "OD" or "OS" ? mapped : null;
    }

    public static string EyePhrase(string? eye)
    {
        var mapped = MapEyeToJourney(eye);
        return mapped switch
        {
            "OS" => "left eye",
            "OU" => "both eyes",
            _ => "right eye",
        };
    }

    public static string FormatIol(decimal value)
    {
        var rounded = Math.Round(value, 2, MidpointRounding.AwayFromZero);
        return rounded >= 0m
            ? $"+{rounded.ToString("0.00", CultureInfo.InvariantCulture)} D"
            : $"{rounded.ToString("0.00", CultureInfo.InvariantCulture)} D";
    }

    public static string? IolFromBiometry(decimal? calculatedIol, string? iolCalculationsJson)
    {
        if (calculatedIol.HasValue)
            return FormatIol(calculatedIol.Value);

        if (string.IsNullOrWhiteSpace(iolCalculationsJson))
            return null;

        try
        {
            using var doc = JsonDocument.Parse(iolCalculationsJson);
            if (doc.RootElement.ValueKind != JsonValueKind.Array)
                return null;
            foreach (var el in doc.RootElement.EnumerateArray())
            {
                if (el.TryGetProperty("iolPower", out var p) && p.TryGetDecimal(out var power))
                    return FormatIol(power);
                if (el.TryGetProperty("IolPower", out var p2) && p2.TryGetDecimal(out var power2))
                    return FormatIol(power2);
            }
        }
        catch (JsonException)
        {
            return null;
        }

        return null;
    }

    /// <summary>
    /// First fill: session, then biometry. Refresh: biometry, then session.
    /// Never invent a value from empty sources.
    /// </summary>
    public static string? ResolveIol(
        string? existing,
        string? sessionIol,
        string? biometryIol,
        bool preferBiometry)
    {
        if (preferBiometry)
            return FirstNonEmpty(biometryIol, sessionIol, existing);
        return FirstNonEmpty(existing, sessionIol, biometryIol);
    }
}

public class OpdClinicalSnapshotDto
{
    public string? ProcedureName { get; set; }
    public string? EyeOperated { get; set; }
    public string? IolPower { get; set; }
    public bool BiometryMissing { get; set; }
    public string? EyePhrase { get; set; }
    public string? Diagnosis { get; set; }
}
