using System.Text.RegularExpressions;
using Microsoft.EntityFrameworkCore;
using IpManagementService.Data;
using IpManagementService.Models.Domain;

namespace IpManagementService.Services;

/// <summary>Blocks ward/IP mutations on superseded (merged) patient records (G5).</summary>
public class JourneyMutationGuardService
{
    private static readonly Regex CanonicalIdPattern = new(
        @"Merged into .+? \(([0-9a-fA-F-]{36})\)",
        RegexOptions.Compiled | RegexOptions.CultureInvariant);

    private readonly IpManagementDbContext _db;

    public JourneyMutationGuardService(IpManagementDbContext db) => _db = db;

    public static bool IsPatientMerged(IpPatient? patient)
        => patient?.DeletedAt != null
           || string.Equals(patient?.Status, "Merged", StringComparison.OrdinalIgnoreCase);

    public async Task EnsureMutableAsync(Guid journeyId, Guid tenantId)
    {
        var journey = await _db.PatientJourneys.FirstOrDefaultAsync(
                          j => j.Id == journeyId && j.TenantId == tenantId && j.DeletedAt == null)
                      ?? throw new KeyNotFoundException($"PatientJourney {journeyId} not found.");
        await EnsureMutableAsync(journey);
    }

    public async Task EnsureMutableAsync(PatientJourney journey)
    {
        var patient = await LoadPatientAsync(journey.PatientId);
        if (!IsPatientMerged(patient)) return;

        throw new InvalidOperationException(
            "This medical record was merged into another patient. Open the canonical record to continue.");
    }

    public async Task<PatientMergeInfo> ResolveMergeInfoAsync(IpPatient? patient)
    {
        if (patient is null || !IsPatientMerged(patient))
            return PatientMergeInfo.NotMerged;

        var canonicalId = ParseCanonicalPatientId(patient.SpecialNeeds);
        if (!canonicalId.HasValue)
            return new PatientMergeInfo(true, null, null);

        var canonical = await _db.Patients.FirstOrDefaultAsync(
            p => p.Id == canonicalId.Value && p.DeletedAt == null);

        var uhid = canonical?.HealthId ?? canonical?.MedicalRecordNumber;
        return new PatientMergeInfo(true, canonicalId, uhid);
    }

    public async Task<PatientMergeInfo> ResolveMergeInfoForPatientIdAsync(Guid patientId)
    {
        var patient = await LoadPatientAsync(patientId);
        return await ResolveMergeInfoAsync(patient);
    }

    public async Task<Dictionary<Guid, PatientMergeInfo>> ResolveMergeInfoBatchAsync(
        IEnumerable<Guid> patientIds)
    {
        var ids = patientIds.Distinct().ToList();
        if (ids.Count == 0) return new Dictionary<Guid, PatientMergeInfo>();

        var patients = await _db.Patients
            .Where(p => ids.Contains(p.Id))
            .ToListAsync();

        var canonicalIds = patients
            .Select(p => ParseCanonicalPatientId(p.SpecialNeeds))
            .Where(id => id.HasValue)
            .Select(id => id!.Value)
            .Distinct()
            .ToList();

        var canonicalPatients = canonicalIds.Count == 0
            ? new Dictionary<Guid, IpPatient>()
            : (await _db.Patients
                .Where(p => canonicalIds.Contains(p.Id) && p.DeletedAt == null)
                .ToListAsync())
            .ToDictionary(p => p.Id);

        var result = new Dictionary<Guid, PatientMergeInfo>();
        foreach (var patient in patients)
        {
            if (!IsPatientMerged(patient))
            {
                result[patient.Id] = PatientMergeInfo.NotMerged;
                continue;
            }

            var canonicalId = ParseCanonicalPatientId(patient.SpecialNeeds);
            string? uhid = null;
            if (canonicalId.HasValue && canonicalPatients.TryGetValue(canonicalId.Value, out var canonical))
                uhid = canonical.HealthId ?? canonical.MedicalRecordNumber;

            result[patient.Id] = new PatientMergeInfo(true, canonicalId, uhid);
        }

        return result;
    }

    private async Task<IpPatient?> LoadPatientAsync(Guid patientId)
        => await _db.Patients.FirstOrDefaultAsync(p => p.Id == patientId);

    private static Guid? ParseCanonicalPatientId(string? specialNeeds)
    {
        if (string.IsNullOrWhiteSpace(specialNeeds)) return null;
        var match = CanonicalIdPattern.Match(specialNeeds);
        return match.Success && Guid.TryParse(match.Groups[1].Value, out var id) ? id : null;
    }
}

public record PatientMergeInfo(bool IsMerged, Guid? CanonicalPatientId, string? CanonicalUhid)
{
    public static PatientMergeInfo NotMerged { get; } = new(false, null, null);
}
