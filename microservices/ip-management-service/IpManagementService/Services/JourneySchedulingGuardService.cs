using Microsoft.EntityFrameworkCore;
using IpManagementService.Data;
using IpManagementService.Models.Domain;

namespace IpManagementService.Services;

/// <summary>
/// Same-day single-eye duplicate journey guard (G6) at ip-management layer.
/// Complements auth-service OtFinalizeService.ValidateSameDaySingleEyeGuardAsync.
/// </summary>
public class JourneySchedulingGuardService
{
    private readonly IpManagementDbContext _db;

    public JourneySchedulingGuardService(IpManagementDbContext db) => _db = db;

    public async Task ValidateSameDaySingleEyeAsync(
        Guid tenantId,
        Guid patientId,
        string? eye,
        DateTime? surgeryDate,
        Guid? excludeJourneyId = null)
    {
        if (!IsSingleEye(eye) || !surgeryDate.HasValue) return;

        var date = surgeryDate.Value.Date;

        var query = _db.PatientJourneys.Where(j =>
            j.TenantId == tenantId
            && j.PatientId == patientId
            && j.DeletedAt == null
            && j.SurgeryScheduledAt != null
            && j.SurgeryScheduledAt.Value.Date == date
            && j.ClinicalState != ClinicalState.Discharged);

        if (excludeJourneyId.HasValue)
            query = query.Where(j => j.Id != excludeJourneyId.Value);

        var conflictingEyes = await query
            .Select(j => j.EyeOperated)
            .ToListAsync();

        if (conflictingEyes.Any(e => IsSingleEye(e)))
        {
            throw new InvalidOperationException(
                $"Same-day single-eye scheduling blocked: patient already has a single-eye journey on {date:yyyy-MM-dd}. " +
                "Use one bilateral (BE) journey or choose a different date.");
        }

        if (conflictingEyes.Any(IsBilateralEye))
        {
            throw new InvalidOperationException(
                $"Same-day scheduling blocked: patient already has a bilateral (BE) journey on {date:yyyy-MM-dd}.");
        }
    }

    private static bool IsBilateralEye(string? eye)
    {
        if (string.IsNullOrWhiteSpace(eye)) return false;
        var e = eye.Trim().ToUpperInvariant();
        return e is "BE" or "OU" or "BOTH" or "BOTH_EYES";
    }

    private static bool IsSingleEye(string? eye)
        => !string.IsNullOrWhiteSpace(eye) && !IsBilateralEye(eye);
}
