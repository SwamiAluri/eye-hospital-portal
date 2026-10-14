using AuthService.Models.Domain.Dtos;

namespace AuthService.Services;

/// <summary>
/// Security boundary: maps full matcher results to the create-scoped registration DTO.
/// Never copies ContactNumber, Email, DifferenceReason, or MatchConfidence.
/// DUP-C3A.2b: adds server-authored matched/different attribute signals from request + match.
/// </summary>
public static class RegistrationDuplicateCheckMapper
{
    public const string SafeDuplicateMessage =
        "Possible matching patients were found. Review before creating a new patient.";

    public const string SafeNoDuplicateMessage = "No matching patients were found.";

    public static RegistrationDuplicateCheckResult Map(
        DuplicateCheckResult source,
        DuplicateCheckRequest request,
        IReadOnlyDictionary<Guid, string?>? gendersByPatientId = null)
    {
        gendersByPatientId ??= new Dictionary<Guid, string?>();
        var matches = (source.Matches ?? new List<PatientDuplicateMatch>())
            .Select(m => MapCandidate(m, request, gendersByPatientId))
            .ToList();

        return new RegistrationDuplicateCheckResult
        {
            IsDuplicate = source.IsDuplicate,
            Message = source.IsDuplicate || matches.Count > 0
                ? SafeDuplicateMessage
                : SafeNoDuplicateMessage,
            Matches = matches,
        };
    }

    /// <summary>
    /// Backward-compatible overload for mapper-only unit fixtures that do not supply a request.
    /// Evidence lists are empty when request is unavailable.
    /// </summary>
    public static RegistrationDuplicateCheckResult Map(
        DuplicateCheckResult source,
        IReadOnlyDictionary<Guid, string?>? gendersByPatientId = null)
    {
        gendersByPatientId ??= new Dictionary<Guid, string?>();
        var matches = (source.Matches ?? new List<PatientDuplicateMatch>())
            .Select(m => MapCandidateWithoutEvidence(m, gendersByPatientId))
            .ToList();

        return new RegistrationDuplicateCheckResult
        {
            IsDuplicate = source.IsDuplicate,
            Message = source.IsDuplicate || matches.Count > 0
                ? SafeDuplicateMessage
                : SafeNoDuplicateMessage,
            Matches = matches,
        };
    }

    private static RegistrationDuplicateCandidate MapCandidate(
        PatientDuplicateMatch match,
        DuplicateCheckRequest request,
        IReadOnlyDictionary<Guid, string?> gendersByPatientId)
    {
        gendersByPatientId.TryGetValue(match.Id, out var gender);
        var (matched, different) = RegistrationDuplicateMatchEvidenceBuilder.Build(request, match);
        return new RegistrationDuplicateCandidate
        {
            Id = match.Id,
            MedicalRecordNumber = match.MedicalRecordNumber ?? "",
            FirstName = match.FirstName ?? "",
            LastName = match.LastName ?? "",
            DateOfBirth = match.DateOfBirth,
            Gender = string.IsNullOrWhiteSpace(gender) ? null : gender.Trim(),
            MatchType = match.MatchType ?? "",
            MatchedAttributes = matched,
            DifferentAttributes = different,
        };
    }

    private static RegistrationDuplicateCandidate MapCandidateWithoutEvidence(
        PatientDuplicateMatch match,
        IReadOnlyDictionary<Guid, string?> gendersByPatientId)
    {
        gendersByPatientId.TryGetValue(match.Id, out var gender);
        return new RegistrationDuplicateCandidate
        {
            Id = match.Id,
            MedicalRecordNumber = match.MedicalRecordNumber ?? "",
            FirstName = match.FirstName ?? "",
            LastName = match.LastName ?? "",
            DateOfBirth = match.DateOfBirth,
            Gender = string.IsNullOrWhiteSpace(gender) ? null : gender.Trim(),
            MatchType = match.MatchType ?? "",
            MatchedAttributes = new List<string>(),
            DifferentAttributes = new List<string>(),
        };
    }
}
