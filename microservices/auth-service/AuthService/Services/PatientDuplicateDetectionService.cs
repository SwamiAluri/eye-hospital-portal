using AuthService.Context;
using AuthService.Models.Domain;
using AuthService.Models.Domain.Dtos;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;

namespace AuthService.Services
{
    /// <summary>
    /// Service for detecting duplicate patients using 4-level matching algorithm
    /// Level 1: Exact name + DOB (100% confidence)
    /// Level 2: Phone number match (95% confidence)
    /// Level 3: Email match (90% confidence)
    /// Level 4: Fuzzy name + same DOB using Levenshtein distance (80-99% confidence)
    /// </summary>
    public interface IPatientDuplicateDetectionService
    {
        /// <summary>
        /// Check for duplicate patients based on provided criteria
        /// </summary>
        /// <param name="request">Patient details to check</param>
        /// <param name="tenantId">Tenant ID to scope the search</param>
        /// <param name="excludePatientId">Optional patient ID to exclude (for updates)</param>
        /// <returns>Duplicate check result with matches and confidence scores</returns>
        Task<DuplicateCheckResult> CheckDuplicatesAsync(
            DuplicateCheckRequest request, 
            Guid tenantId, 
            Guid? excludePatientId = null
        );
    }

    public class PatientDuplicateDetectionService : IPatientDuplicateDetectionService
    {
        private readonly AppDbContext _context;
        private readonly ILogger<PatientDuplicateDetectionService> _logger;

        public PatientDuplicateDetectionService(
            AppDbContext context,
            ILogger<PatientDuplicateDetectionService> logger)
        {
            _context = context;
            _logger = logger;
        }

        public async Task<DuplicateCheckResult> CheckDuplicatesAsync(
            DuplicateCheckRequest request, 
            Guid tenantId, 
            Guid? excludePatientId = null)
        {
            excludePatientId ??= request.ExcludePatientId;
            _logger.LogInformation(
                "Checking duplicates for patient: {FirstName} {LastName}, DOB: {DOB}, Tenant: {TenantId}",
                request.FirstName, request.LastName, request.DateOfBirth, tenantId
            );

            var matches = new List<PatientDuplicateMatch>();

            // Level 1: Exact name + DOB match (100% confidence)
            await CheckExactNameDOBMatches(request, tenantId, excludePatientId, matches);

            // Level 2: Phone number match (95% confidence)
            if (!string.IsNullOrWhiteSpace(request.ContactNumber))
            {
                await CheckPhoneMatches(request, tenantId, excludePatientId, matches);
            }

            // Level 3: Email match (90% confidence)
            if (!string.IsNullOrWhiteSpace(request.Email))
            {
                await CheckEmailMatches(request, tenantId, excludePatientId, matches);
            }

            // Level 4: Fuzzy name match + same DOB (80-99% confidence based on similarity)
            await CheckFuzzyNameMatches(request, tenantId, excludePatientId, matches);

            // Order by confidence (highest first)
            matches = matches.OrderByDescending(m => m.MatchConfidence).ToList();

            var isDuplicate = matches.Any(m => m.MatchConfidence >= 0.80m);
            var message = matches.Any() 
                ? $"Found {matches.Count} possible duplicate(s). Highest confidence: {matches.First().MatchConfidence:P0}" 
                : "No duplicates found";

            _logger.LogInformation(
                "Duplicate check completed. Found {MatchCount} matches. IsDuplicate: {IsDuplicate}",
                matches.Count, isDuplicate
            );

            return new DuplicateCheckResult
            {
                IsDuplicate = isDuplicate,
                Message = message,
                Matches = matches
            };
        }

        /// <summary>
        /// Level 1: Check for exact name + DOB matches
        /// </summary>
        private async Task CheckExactNameDOBMatches(
            DuplicateCheckRequest request,
            Guid tenantId,
            Guid? excludePatientId,
            List<PatientDuplicateMatch> matches)
        {
            if (!request.DateOfBirth.HasValue) return;

            var dob = request.DateOfBirth.Value.Date;
            var exactMatches = await _context.Patients
                .Where(p => p.TenantId == tenantId && p.DeletedAt == null)
                .Where(p => p.Id != excludePatientId)
                .Where(p => 
                    p.FirstName.ToLower() == request.FirstName.ToLower() &&
                    p.LastName.ToLower() == request.LastName.ToLower() &&
                    p.DateOfBirth.Date == dob
                )
                .ToListAsync();

            foreach (var match in exactMatches)
            {
                matches.Add(new PatientDuplicateMatch
                {
                    Id = match.Id,
                    MedicalRecordNumber = match.MedicalRecordNumber,
                    FirstName = match.FirstName,
                    LastName = match.LastName,
                    DateOfBirth = match.DateOfBirth,
                    ContactNumber = match.ContactNumber,
                    Email = match.Email,
                    MatchType = "ExactNameDOB",
                    MatchConfidence = 1.0m,
                    DifferenceReason = GetDifferences(request, match)
                });

                _logger.LogWarning(
                    "Exact name+DOB match found: Patient {PatientId}, MRN: {MRN}",
                    match.Id, match.MedicalRecordNumber
                );
            }
        }

        /// <summary>
        /// Level 2: Check for phone number matches
        /// </summary>
        private async Task CheckPhoneMatches(
            DuplicateCheckRequest request,
            Guid tenantId,
            Guid? excludePatientId,
            List<PatientDuplicateMatch> matches)
        {
            var matchedIds = matches.Select(m => m.Id).ToList();
            var phoneMatches = await _context.Patients
                .Where(p => p.TenantId == tenantId && p.DeletedAt == null)
                .Where(p => p.Id != excludePatientId)
                .Where(p => p.ContactNumber == request.ContactNumber)
                .Where(p => !matchedIds.Contains(p.Id)) // Exclude already matched
                .ToListAsync();

            foreach (var match in phoneMatches)
            {
                matches.Add(new PatientDuplicateMatch
                {
                    Id = match.Id,
                    MedicalRecordNumber = match.MedicalRecordNumber,
                    FirstName = match.FirstName,
                    LastName = match.LastName,
                    DateOfBirth = match.DateOfBirth,
                    ContactNumber = match.ContactNumber,
                    Email = match.Email,
                    MatchType = "PhoneMatch",
                    MatchConfidence = 0.95m,
                    DifferenceReason = GetDifferences(request, match)
                });

                _logger.LogWarning(
                    "Phone match found: Patient {PatientId}, MRN: {MRN}, Phone: {Phone}",
                    match.Id, match.MedicalRecordNumber, match.ContactNumber
                );
            }
        }

        /// <summary>
        /// Level 3: Check for email matches
        /// </summary>
        private async Task CheckEmailMatches(
            DuplicateCheckRequest request,
            Guid tenantId,
            Guid? excludePatientId,
            List<PatientDuplicateMatch> matches)
        {
            var matchedIds = matches.Select(m => m.Id).ToList();
            var emailMatches = await _context.Patients
                .Where(p => p.TenantId == tenantId && p.DeletedAt == null)
                .Where(p => p.Id != excludePatientId)
                .Where(p => p.Email != null && p.Email.ToLower() == request.Email!.ToLower())
                .Where(p => !matchedIds.Contains(p.Id))
                .ToListAsync();

            foreach (var match in emailMatches)
            {
                matches.Add(new PatientDuplicateMatch
                {
                    Id = match.Id,
                    MedicalRecordNumber = match.MedicalRecordNumber,
                    FirstName = match.FirstName,
                    LastName = match.LastName,
                    DateOfBirth = match.DateOfBirth,
                    ContactNumber = match.ContactNumber,
                    Email = match.Email,
                    MatchType = "EmailMatch",
                    MatchConfidence = 0.90m,
                    DifferenceReason = GetDifferences(request, match)
                });

                _logger.LogWarning(
                    "Email match found: Patient {PatientId}, MRN: {MRN}, Email: {Email}",
                    match.Id, match.MedicalRecordNumber, match.Email
                );
            }
        }

        /// <summary>
        /// Level 4: Check for fuzzy name matches with same DOB using Levenshtein distance
        /// </summary>
        private async Task CheckFuzzyNameMatches(
            DuplicateCheckRequest request,
            Guid tenantId,
            Guid? excludePatientId,
            List<PatientDuplicateMatch> matches)
        {
            if (!request.DateOfBirth.HasValue) return;

            var dob = request.DateOfBirth.Value.Date;
            var matchedIds = matches.Select(m => m.Id).ToList();
            var sameDobPatients = await _context.Patients
                .Where(p => p.TenantId == tenantId && p.DeletedAt == null)
                .Where(p => p.Id != excludePatientId)
                .Where(p => p.DateOfBirth.Date == dob)
                .Where(p => !matchedIds.Contains(p.Id))
                .ToListAsync();

            foreach (var patient in sameDobPatients)
            {
                var requestFullName = $"{request.FirstName} {request.LastName}".ToLower();
                var patientFullName = $"{patient.FirstName} {patient.LastName}".ToLower();
                
                var distance = LevenshteinDistance(requestFullName, patientFullName);
                var maxLength = Math.Max(requestFullName.Length, patientFullName.Length);
                var similarity = 1.0m - ((decimal)distance / maxLength);

                // If similarity >= 80% (e.g., "Jon Smith" vs "John Smith", "Shaikh" vs "Sheikh")
                if (similarity >= 0.80m)
                {
                    matches.Add(new PatientDuplicateMatch
                    {
                        Id = patient.Id,
                        MedicalRecordNumber = patient.MedicalRecordNumber,
                        FirstName = patient.FirstName,
                        LastName = patient.LastName,
                        DateOfBirth = patient.DateOfBirth,
                        ContactNumber = patient.ContactNumber,
                        Email = patient.Email,
                        MatchType = "FuzzyNameDOB",
                        MatchConfidence = similarity,
                        DifferenceReason = $"Name similarity: {similarity:P0}. {GetDifferences(request, patient)}"
                    });

                    _logger.LogInformation(
                        "Fuzzy name match found: Patient {PatientId}, MRN: {MRN}, Similarity: {Similarity:P0}",
                        patient.Id, patient.MedicalRecordNumber, similarity
                    );
                }
            }
        }

        /// <summary>
        /// Calculate Levenshtein distance between two strings
        /// Returns the minimum number of single-character edits (insertions, deletions, substitutions)
        /// required to change one string into the other
        /// </summary>
        private static int LevenshteinDistance(string s, string t)
        {
            int n = s.Length;
            int m = t.Length;
            int[,] d = new int[n + 1, m + 1];

            // Handle edge cases
            if (n == 0) return m;
            if (m == 0) return n;

            // Initialize first column and row
            for (int i = 0; i <= n; i++) d[i, 0] = i;
            for (int j = 0; j <= m; j++) d[0, j] = j;

            // Calculate distances
            for (int j = 1; j <= m; j++)
            {
                for (int i = 1; i <= n; i++)
                {
                    int cost = (s[i - 1] == t[j - 1]) ? 0 : 1;
                    d[i, j] = Math.Min(
                        Math.Min(
                            d[i - 1, j] + 1,      // deletion
                            d[i, j - 1] + 1       // insertion
                        ),
                        d[i - 1, j - 1] + cost    // substitution
                    );
                }
            }

            return d[n, m];
        }

        /// <summary>
        /// Generate human-readable description of differences between new patient and existing patient
        /// </summary>
        private static string GetDifferences(DuplicateCheckRequest request, Patient existing)
        {
            var differences = new List<string>();
            
            if (request.FirstName?.ToLower() != existing.FirstName?.ToLower())
                differences.Add($"First Name: '{request.FirstName}' vs '{existing.FirstName}'");
            
            if (request.LastName?.ToLower() != existing.LastName?.ToLower())
                differences.Add($"Last Name: '{request.LastName}' vs '{existing.LastName}'");
            
            if (request.DateOfBirth.HasValue && request.DateOfBirth.Value.Date != existing.DateOfBirth.Date)
                differences.Add($"DOB: {request.DateOfBirth:yyyy-MM-dd} vs {existing.DateOfBirth:yyyy-MM-dd}");
            
            if (request.ContactNumber != existing.ContactNumber)
                differences.Add($"Phone: '{request.ContactNumber ?? "N/A"}' vs '{existing.ContactNumber ?? "N/A"}'");
            
            if (request.Email?.ToLower() != existing.Email?.ToLower())
                differences.Add($"Email: '{request.Email ?? "N/A"}' vs '{existing.Email ?? "N/A"}'");
            
            return differences.Any() ? string.Join(", ", differences) : "Same details (possible exact duplicate)";
        }
    }
}
