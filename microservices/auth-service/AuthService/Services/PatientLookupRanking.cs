using AuthService.Models.Domain.Dtos;

namespace AuthService.Services;

/// <summary>Ranked patient suggest ordering — exact MRN → MRN prefix → full name → name prefix → phone.</summary>
public static class PatientLookupRanking
{
    public static int Score(PatientSuggestRowDto row, string needle)
    {
        var mrn = (row.Mrn ?? "").ToLowerInvariant();
        var name = $"{row.FirstName} {row.LastName}".ToLowerInvariant();
        var phone = (row.Phone ?? "").ToLowerInvariant();
        var email = (row.Email ?? "").ToLowerInvariant();

        if (mrn == needle) return 0;
        if (mrn.StartsWith(needle, StringComparison.Ordinal)) return 1;
        if (name == needle) return 2;
        if (name.StartsWith(needle, StringComparison.Ordinal)) return 3;
        if (phone.Contains(needle, StringComparison.Ordinal)) return 4;
        if (email.Contains(needle, StringComparison.Ordinal)) return 5;
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
