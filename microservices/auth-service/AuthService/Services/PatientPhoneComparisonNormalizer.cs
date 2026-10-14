using System.Text;

namespace AuthService.Services;

/// <summary>
/// DUP-C3A.1 — Comparison-only phone normalization for duplicate detection.
/// Does not mutate stored <c>Patient.ContactNumber</c> or display formatting.
/// </summary>
/// <remarks>
/// Indian +91 / trunk-0 mobile forms are canonicalized to a 10-digit national mobile
/// only when the digit pattern is unambiguous (91/0 + 10-digit mobile starting 6–9,
/// or bare 10-digit mobile starting 6–9). Other international digit strings keep their
/// full digit sequence — country codes are not stripped arbitrarily.
/// </remarks>
public static class PatientPhoneComparisonNormalizer
{
    /// <summary>
    /// Returns a deterministic comparison key, or null when the input has no digits.
    /// </summary>
    public static string? Normalize(string? raw)
    {
        if (string.IsNullOrWhiteSpace(raw))
            return null;

        var digits = ExtractDigits(raw);
        if (digits.Length == 0)
            return null;

        // 91 + 10-digit Indian mobile
        if (digits.Length == 12
            && digits.StartsWith("91", StringComparison.Ordinal)
            && IsIndianMobile10(digits.AsSpan(2)))
        {
            return digits.Substring(2);
        }

        // Trunk prefix 0 + 10-digit Indian mobile
        if (digits.Length == 11
            && digits[0] == '0'
            && IsIndianMobile10(digits.AsSpan(1)))
        {
            return digits.Substring(1);
        }

        // Bare 10-digit Indian mobile form (comparison key only)
        if (digits.Length == 10 && IsIndianMobile10(digits))
            return digits;

        // Keep full digit string — do not invent / strip other country codes
        return digits;
    }

    private static string ExtractDigits(string raw)
    {
        var sb = new StringBuilder(raw.Length);
        foreach (var ch in raw)
        {
            if (char.IsDigit(ch))
                sb.Append(ch);
        }
        return sb.ToString();
    }

    private static bool IsIndianMobile10(ReadOnlySpan<char> digits) =>
        digits.Length == 10 && digits[0] is >= '6' and <= '9';
}
