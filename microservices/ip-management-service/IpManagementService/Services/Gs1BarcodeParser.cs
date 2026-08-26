using System.Globalization;

namespace IpManagementService.Services;

/// <summary>
/// GS1-128 / DataMatrix parse for IOL UDI (W-07 A1). AIs: 01 GTIN, 21 serial, 10 lot, 17 expiry.
/// Non-GS1 alphanumeric ≥5 stays a manual serial (symbology raw).
/// </summary>
public static class Gs1BarcodeParser
{
    public const string UnreadableMessage =
        "This barcode could not be read. Enter the serial from the pack. Do not guess the power.";

    private const char Gs = '\u001d';

    public sealed class Result
    {
        public bool IsGs1 { get; init; }
        public bool Parsed { get; init; }
        public bool Unreadable { get; init; }
        public string? Gtin { get; init; }
        public string? Serial { get; init; }
        public string? Lot { get; init; }
        public DateOnly? Expiry { get; init; }
        public string Symbology { get; init; } = "raw";
        public string? ExpiryIso => Expiry?.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture);
    }

    public static Result Parse(string? raw)
    {
        if (string.IsNullOrWhiteSpace(raw))
            return new Result { Unreadable = true, Symbology = "raw" };

        var original = raw.Trim();
        var (payload, symbology) = StripSymbology(original.Replace(" ", string.Empty));
        var looksGs1 = LooksLikeGs1(original, payload, symbology);

        Result? parsed = null;
        if (payload.Contains('(', StringComparison.Ordinal))
            parsed = ParseParenthesized(payload, symbology);
        parsed ??= ParseElementString(payload, symbology);

        if (parsed is { Parsed: true })
            return parsed;

        if (looksGs1)
            return new Result { IsGs1 = true, Unreadable = true, Symbology = symbology == "raw" ? "gs1" : symbology };

        return new Result { Symbology = "raw" };
    }

    public static bool IsManualSerial(string? raw)
    {
        if (string.IsNullOrWhiteSpace(raw)) return false;
        var s = raw.Trim();
        if (s.Length < 5) return false;
        if (LooksLikeGs1(s, s, "raw")) return false;
        return s.All(c => char.IsLetterOrDigit(c) || c is '-' or '_');
    }

    private static (string Payload, string Symbology) StripSymbology(string value)
    {
        if (value.StartsWith("]C1", StringComparison.OrdinalIgnoreCase))
            return (value[3..], "gs1-128");
        if (value.StartsWith("]d2", StringComparison.OrdinalIgnoreCase)
            || value.StartsWith("]e0", StringComparison.OrdinalIgnoreCase))
            return (value[3..], "gs1-datamatrix");
        if (value.StartsWith("]Q3", StringComparison.OrdinalIgnoreCase))
            return (value[3..], "gs1-qr");
        return (value, "raw");
    }

    private static bool LooksLikeGs1(string original, string payload, string symbology)
    {
        if (symbology is not "raw") return true;
        if (original.Contains(Gs) || payload.Contains(Gs)) return true;
        if (payload.Contains("(01)", StringComparison.Ordinal)
            || payload.Contains("(21)", StringComparison.Ordinal)
            || payload.Contains("(17)", StringComparison.Ordinal)
            || payload.Contains("(10)", StringComparison.Ordinal))
            return true;
        return payload.StartsWith("01", StringComparison.Ordinal) && payload.Length >= 3;
    }

    private static Result? ParseParenthesized(string payload, string symbology)
    {
        var fields = new Dictionary<string, string>(StringComparer.Ordinal);
        var i = 0;
        while (i < payload.Length)
        {
            if (payload[i] != '(')
            {
                i++;
                continue;
            }
            var close = payload.IndexOf(')', i + 1);
            if (close < 0) break;
            var ai = payload[(i + 1)..close];
            i = close + 1;
            var next = payload.IndexOf('(', i);
            var value = next < 0 ? payload[i..] : payload[i..next];
            if (ai.Length > 0 && value.Length > 0)
                fields[ai] = value;
            i = next < 0 ? payload.Length : next;
        }

        return FromFields(fields, symbology == "raw" ? "gs1" : symbology);
    }

    private static Result? ParseElementString(string payload, string symbology)
    {
        var fields = new Dictionary<string, string>(StringComparer.Ordinal);
        var s = payload.Replace(Gs.ToString(), "\n");
        var i = 0;
        while (i < s.Length)
        {
            if (s[i] is '\n')
            {
                i++;
                continue;
            }
            if (i + 2 > s.Length) break;
            var ai = s[i..(i + 2)];
            if (ai == "01" && TryTakeDigits(s, i + 2, 14, out var gtin, out var after01))
            {
                fields["01"] = gtin;
                i = after01;
                continue;
            }
            if (ai == "17" && TryTakeDigits(s, i + 2, 6, out var exp, out var after17))
            {
                fields["17"] = exp;
                i = after17;
                continue;
            }
            if (ai is "10" or "21")
            {
                var start = i + 2;
                var end = FindVariableEnd(s, start);
                if (end == start)
                {
                    // Empty variable (malformed extra AI). Skip the AI and continue.
                    i = start;
                    continue;
                }
                fields[ai] = s[start..end];
                i = end;
                continue;
            }
            break;
        }

        return FromFields(fields, symbology == "raw" && fields.Count > 0 ? "gs1" : symbology);
    }

    private static int FindVariableEnd(string s, int start)
    {
        var nl = s.IndexOf('\n', start);
        if (nl >= 0) return nl;
        for (var j = start; j < s.Length; j++)
        {
            if (j + 1 >= s.Length) break;
            var ai = s[j..(j + 2)];
            if (ai == "01" && j + 2 + 14 <= s.Length && DigitsAt(s, j + 2, 14))
                return j;
            if (ai == "17" && j + 2 + 6 <= s.Length && DigitsAt(s, j + 2, 6))
                return j;
            // 10/21 also appear inside serials (e.g. 88213). Require a minimum
            // current value so an embedded pair is not treated as a new AI.
            if (ai is "10" or "21" && j - start >= 4)
                return j;
        }
        return s.Length;
    }

    private static bool DigitsAt(string s, int start, int count)
    {
        if (start + count > s.Length) return false;
        for (var k = 0; k < count; k++)
        {
            if (!char.IsDigit(s[start + k])) return false;
        }
        return true;
    }

    private static bool TryTakeDigits(string s, int start, int count, out string value, out int next)
    {
        value = string.Empty;
        next = start;
        if (start + count > s.Length) return false;
        var slice = s[start..(start + count)];
        if (!slice.All(char.IsDigit)) return false;
        value = slice;
        next = start + count;
        return true;
    }

    private static Result? FromFields(Dictionary<string, string> fields, string symbology)
    {
        fields.TryGetValue("01", out var gtin);
        fields.TryGetValue("21", out var serial);
        fields.TryGetValue("10", out var lot);
        fields.TryGetValue("17", out var expRaw);
        DateOnly? expiry = ParseExpiry(expRaw);

        if (string.IsNullOrEmpty(gtin) && string.IsNullOrEmpty(serial))
            return null;

        return new Result
        {
            IsGs1 = true,
            Parsed = true,
            Gtin = string.IsNullOrEmpty(gtin) ? null : gtin,
            Serial = string.IsNullOrEmpty(serial) ? null : serial,
            Lot = string.IsNullOrEmpty(lot) ? null : lot,
            Expiry = expiry,
            Symbology = symbology is "raw" ? "gs1" : symbology,
        };
    }

    private static DateOnly? ParseExpiry(string? yymmdd)
    {
        if (string.IsNullOrEmpty(yymmdd) || yymmdd.Length != 6 || !yymmdd.All(char.IsDigit))
            return null;
        var yy = int.Parse(yymmdd[..2], CultureInfo.InvariantCulture);
        var mm = int.Parse(yymmdd[2..4], CultureInfo.InvariantCulture);
        var dd = int.Parse(yymmdd[4..6], CultureInfo.InvariantCulture);
        if (mm is < 1 or > 12) return null;
        var year = 2000 + yy;
        if (dd == 0)
            dd = DateTime.DaysInMonth(year, mm);
        if (dd > DateTime.DaysInMonth(year, mm)) return null;
        return new DateOnly(year, mm, dd);
    }
}
