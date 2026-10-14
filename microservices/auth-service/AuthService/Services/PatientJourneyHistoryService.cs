using AuthService.Context;
using AuthService.DTOs;
using Microsoft.EntityFrameworkCore;

namespace AuthService.Services;

public interface IPatientJourneyHistoryService
{
    Task<Patient360InpatientHistoryPageDto> ListPatient360Async(
        Guid tenantId,
        Guid userId,
        Guid patientId,
        int pageNumber,
        int pageSize,
        CancellationToken cancellationToken = default);
}

/// <summary>
/// Patient 360 closed inpatient episodes. Reads patient_journey directly.
/// Does not call the IP census list and does not onboard journeys.
/// </summary>
public class PatientJourneyHistoryService : IPatientJourneyHistoryService
{
    public static readonly string[] ClosedStates = { "Discharged", "AdmissionCancelled" };

    private readonly AppDbContext _context;
    private readonly IFollowupBranchAccessService _branchAccess;

    public PatientJourneyHistoryService(AppDbContext context, IFollowupBranchAccessService branchAccess)
    {
        _context = context;
        _branchAccess = branchAccess;
    }

    public async Task<Patient360InpatientHistoryPageDto> ListPatient360Async(
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
            return new Patient360InpatientHistoryPageDto
            {
                PageNumber = pageNumber,
                PageSize = pageSize,
            };
        }

        var branchIds = branches as Guid[] ?? branches.ToArray();
        var query = _context.PatientJourneys.AsNoTracking()
            .Where(journey => journey.TenantId == tenantId
                && journey.PatientId == patientId
                && journey.BranchId != null
                && branchIds.Contains(journey.BranchId.Value)
                && journey.DeletedAt == null
                && ClosedStates.Contains(journey.ClinicalState));

        var total = await query.CountAsync(cancellationToken);
        var items = await query
            .OrderBy(journey => journey.AdmittedAt == null)
            .ThenByDescending(journey => journey.AdmittedAt)
            .ThenByDescending(journey => journey.Id)
            .Skip((pageNumber - 1) * pageSize)
            .Take(pageSize)
            .Select(journey => new Patient360InpatientHistoryItemDto
            {
                Id = journey.Id,
                AdmittedAt = journey.AdmittedAt,
                DischargedAt = journey.DischargedAt,
                ClinicalState = journey.ClinicalState,
            })
            .ToListAsync(cancellationToken);

        return new Patient360InpatientHistoryPageDto
        {
            Items = items,
            TotalCount = total,
            PageNumber = pageNumber,
            PageSize = pageSize,
        };
    }
}
