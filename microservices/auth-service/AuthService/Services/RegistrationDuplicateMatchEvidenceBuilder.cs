using System.Text;
using AuthService.Models.Domain.Dtos;

namespace AuthService.Services;

/// <summary>
/// DUP-C3A.2b — Builds PHI-safe matched/different attribute signals from the
/// registration request and an already-loaded <see cref="PatientDuplicateMatch"/>.
/// Uses the same name / phone / email / DOB comparison semantics as the matcher.
/// Does not query the database.
/// </summary>
public static class RegistrationDuplicateMatchEvidenceBuilder
{
    public static (List<string> Matched, List<string> Different) Build(
        DuplicateCheckRequest request,
        PatientDuplicateMatch candidate)
    {
        var matched = new HashSet<string>(StringComparer.Ordinal);
        var different = new HashSet<string>(StringComparer.Ordinal);

        // First / last — always comparable for matcher candidates (required on request).
        ClassifyName(
            NormalizePersonName(request.FirstName),
            NormalizePersonName(candidate.FirstName),
            RegistrationDuplicateAttributeSignals.FirstName,
            matched,
            different);

        ClassifyName(
            NormalizePersonName(request.LastName),
            NormalizePersonName(candidate.LastName),
            RegistrationDuplicateAttributeSignals.LastName,
            matched,
            different);

        if (request.DateOfBirth.HasValue)
        {
            if (request.DateOfBirth.Value.Date == candidate.DateOfBirth.Date)
                matched.Add(RegistrationDuplicateAttributeSignals.DateOfBirth);
            else
                different.Add(RegistrationDuplicateAttributeSignals.DateOfBirth);
        }

        var requestPhone = PatientPhoneComparisonNormalizer.Normalize(request.ContactNumber);
        var candidatePhone = PatientPhoneComparisonNormalizer.Normalize(candidate.ContactNumber);
        if (requestPhone != null && candidatePhone != null)
        {
            if (requestPhone == candidatePhone)
                matched.Add(RegistrationDuplicateAttributeSignals.Phone);
            else
                different.Add(RegistrationDuplicateAttributeSignals.Phone);
        }

        if (!string.IsNullOrWhiteSpace(request.Email) && !string.IsNullOrWhiteSpace(candidate.Email))
        {
            if (string.Equals(request.Email.Trim(), candidate.Email.Trim(), StringComparison.OrdinalIgnoreCase))
                matched.Add(RegistrationDuplicateAttributeSignals.Email);
            else
                different.Add(RegistrationDuplicateAttributeSignals.Email);
        }

        return (Order(matched), Order(different));
    }

    private static void ClassifyName(
        string requestNorm,
        string candidateNorm,
        string signal,
        HashSet<string> matched,
        HashSet<string> different)
    {
        if (requestNorm.Length == 0 || candidateNorm.Length == 0)
            return;

        if (requestNorm == candidateNorm)
            matched.Add(signal);
        else
            different.Add(signal);
    }

    private static List<string> Order(HashSet<string> set) =>
        RegistrationDuplicateAttributeSignals.EmissionOrder
            .Where(set.Contains)
            .ToList();

    /// <summary>
    /// Same trim / collapse-whitespace / case-fold rules as
    /// <see cref="PatientDuplicateDetectionService"/> exact-name comparison.
    /// </summary>
    internal static string NormalizePersonName(string? value)
    {
        if (string.IsNullOrWhiteSpace(value))
            return string.Empty;

        var trimmed = value.Trim();
        var sb = new StringBuilder(trimmed.Length);
        var prevSpace = false;
        foreach (var ch in trimmed)
        {
            if (char.IsWhiteSpace(ch))
            {
                if (!prevSpace)
                {
                    sb.Append(' ');
                    prevSpace = true;
                }
            }
            else
            {
                sb.Append(char.ToLowerInvariant(ch));
                prevSpace = false;
            }
        }

        return sb.ToString();
    }
}
