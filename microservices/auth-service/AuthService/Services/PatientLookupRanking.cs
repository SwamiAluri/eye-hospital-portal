using AuthService.Models.Domain.Dtos;

namespace AuthService.Services;

/// <summary>Ranked patient suggest ordering — exact MRN/UHID → prefix → full name → name prefix → phone.</summary>
public static class PatientLookupRanking
{
    private static string NormalizeId(string? value) =>
        (value ?? "").Trim().ToLowerInvariant().Replace(" ", "").Replace("-", "").Replace("_", "").Replace("/", "");

    public static int Score(PatientSuggestRowDto row, string needle)
    {
        var needleNorm = NormalizeId(needle);
        var mrn = NormalizeId(row.Mrn);
        var healthId = NormalizeId(row.HealthId);
        var name = $"{row.FirstName} {row.LastName}".ToLowerInvariant();
        var phone = (row.Phone ?? "").ToLowerInvariant();
        var email = (row.Email ?? "").ToLowerInvariant();
        var rawNeedle = (needle ?? "").Trim().ToLowerInvariant();

        if (mrn == needleNorm || (!string.IsNullOrEmpty(healthId) && healthId == needleNorm)) return 0;
        if ((!string.IsNullOrEmpty(mrn) && mrn.StartsWith(needleNorm, StringComparison.Ordinal)) ||
            (!string.IsNullOrEmpty(healthId) && healthId.StartsWith(needleNorm, StringComparison.Ordinal)))
            return 1;
        if (name == rawNeedle) return 2;
        if (name.StartsWith(rawNeedle, StringComparison.Ordinal)) return 3;
        if (phone.Contains(rawNeedle, StringComparison.Ordinal)) return 4;
        if (email.Contains(rawNeedle, StringComparison.Ordinal)) return 5;
        return 6;
    }

    public static IEnumerable<PatientSuggestRowDto> Rank(
        IEnumerable<PatientSuggestRowDto> rows,
        string needle)
    {
        var normalized = (needle ?? "").Trim().ToLowerInvariant();
        return rows
            .OrderBy(r => Score(r, normalized))
            .ThenBy(r => r.LastName, StringComparer.OrdinalIgnoreCase)
            .ThenBy(r => r.FirstName, StringComparer.OrdinalIgnoreCase);
    }
}
