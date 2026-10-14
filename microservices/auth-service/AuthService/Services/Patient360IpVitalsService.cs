using AuthService.Context;
using AuthService.DTOs;
using Microsoft.EntityFrameworkCore;

namespace AuthService.Services;

public interface IPatient360IpVitalsService
{
    Task<Patient360IpVitalsPageDto> ListAsync(
        Guid tenantId,
        Guid userId,
        Guid patientId,
        int pageNumber,
        int pageSize,
        CancellationToken cancellationToken = default);
}

/// <summary>
/// Patient 360 historical IP vitals. Reads vital_sign through patient_journey.
/// Does not call the journey vitals route and does not write observations.
/// </summary>
public class Patient360IpVitalsService : IPatient360IpVitalsService
{
    public static readonly string[] IncludedStates =
    {
        "Admitted",
        "ReadyForSurgery",
        "SentToOT",
        "InOT",
        "SurgeryCompleted",
        "PostOp",
        "ReadyForDischarge",
        "Discharged",
        "CancelledSurgery",
    };

    private readonly AppDbContext _context;
    private readonly IFollowupBranchAccessService _branchAccess;

    public Patient360IpVitalsService(AppDbContext context, IFollowupBranchAccessService branchAccess)
    {
        _context = context;
        _branchAccess = branchAccess;
    }

    public async Task<Patient360IpVitalsPageDto> ListAsync(
        Guid tenantId,
        Guid userId,
        Guid patientId,
        int pageNumber,
        int pageSize,
        CancellationToken cancellationToken = default)
    {
        if (tenantId == Guid.Empty)
            throw new UnauthorizedAccessException("Tenant ID not found in token");

        (pageNumber, pageSize) = Patient360DiagnosticPaging.Normalize(pageNumber, pageSize);

        var branches = await _branchAccess.ResolveAccessibleBranchesAsync(
            tenantId, userId, requestedBranchId: null, cancellationToken);
        if (branches.Count == 0)
        {
            return new Patient360IpVitalsPageDto
            {
                PageNumber = pageNumber,
                PageSize = pageSize,
            };
        }

        var branchIds = branches as Guid[] ?? branches.ToArray();
        var query =
            from vital in _context.VitalSigns.AsNoTracking()
            join journey in _context.PatientJourneys.AsNoTracking()
                on vital.JourneyId equals journey.Id
            where journey.TenantId == tenantId
                && vital.TenantId == tenantId
                && journey.PatientId == patientId
                && journey.BranchId != null
                && branchIds.Contains(journey.BranchId.Value)
                && journey.DeletedAt == null
                && vital.DeletedAt == null
                && IncludedStates.Contains(journey.ClinicalState)
                && (vital.Context == null || vital.Context == "PreOp")
            select new { vital, journey };

        var total = await query.CountAsync(cancellationToken);
        var items = await query
            .OrderByDescending(row => row.vital.RecordedAt)
            .ThenByDescending(row => row.vital.Id)
            .Skip((pageNumber - 1) * pageSize)
            .Take(pageSize)
            .Select(row => new Patient360IpVitalItemDto
            {
                Id = row.vital.Id,
                RecordedAt = row.vital.RecordedAt,
                Context = row.vital.Context == null ? "Ward" : row.vital.Context,
                Temperature = row.vital.Temperature,
                BloodPressureSystolic = row.vital.BloodPressureSystolic,
                BloodPressureDiastolic = row.vital.BloodPressureDiastolic,
                PulseRate = row.vital.PulseRate,
                RespiratoryRate = row.vital.RespiratoryRate,
                OxygenSaturation = row.vital.OxygenSaturation,
                Weight = row.vital.Weight,
                Height = row.vital.Height,
            })
            .ToListAsync(cancellationToken);

        return new Patient360IpVitalsPageDto
        {
            Items = items,
            TotalCount = total,
            PageNumber = pageNumber,
            PageSize = pageSize,
        };
    }
}
