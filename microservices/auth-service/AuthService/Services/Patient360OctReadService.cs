using AuthService.Context;
using AuthService.DTOs;
using Microsoft.EntityFrameworkCore;

namespace AuthService.Services;

public interface IPatient360OctReadService
{
    Task<Patient360OctPageDto> ListAsync(
        Guid tenantId,
        Guid userId,
        Guid patientId,
        int pageNumber,
        int pageSize,
        CancellationToken cancellationToken = default);
}

/// <summary>
/// Patient 360 historical OCT metadata. Does not call the operational OCT routes.
/// </summary>
public class Patient360OctReadService : IPatient360OctReadService
{
    private readonly AppDbContext _context;
    private readonly IFollowupBranchAccessService _branchAccess;

    public Patient360OctReadService(AppDbContext context, IFollowupBranchAccessService branchAccess)
    {
        _context = context;
        _branchAccess = branchAccess;
    }

    public async Task<Patient360OctPageDto> ListAsync(
        Guid tenantId,
        Guid userId,
        Guid patientId,
        int pageNumber,
        int pageSize,
        CancellationToken cancellationToken = default)
    {
        if (tenantId == Guid.Empty || userId == Guid.Empty)
            throw new UnauthorizedAccessException("Tenant ID not found in token");

        var patientInTenant = await _context.Patients.AsNoTracking()
            .AnyAsync(
                p => p.Id == patientId && p.TenantId == tenantId && p.DeletedAt == null,
                cancellationToken);
        if (!patientInTenant)
            throw new KeyNotFoundException("Patient was not found for this tenant.");

        (pageNumber, pageSize) = Patient360DiagnosticPaging.Normalize(pageNumber, pageSize);

        var branches = await _branchAccess.ResolveAccessibleBranchesAsync(
            tenantId, userId, requestedBranchId: null, cancellationToken);
        if (branches.Count == 0)
        {
            return new Patient360OctPageDto
            {
                PageNumber = pageNumber,
                PageSize = pageSize,
            };
        }

        var branchIds = branches as Guid[] ?? branches.ToArray();
        var query = _context.OctImagingScans.AsNoTracking()
            .Where(scan => scan.TenantId == tenantId
                && scan.PatientId == patientId
                && scan.DeletedAt == null
                && scan.BranchId != null
                && branchIds.Contains(scan.BranchId.Value));

        var total = await query.CountAsync(cancellationToken);
        var items = await query
            .OrderByDescending(scan => scan.ScanDate)
            .ThenByDescending(scan => scan.Id)
            .Skip((pageNumber - 1) * pageSize)
            .Take(pageSize)
            .Select(scan => new Patient360OctScanDto
            {
                Id = scan.Id,
                ScanDate = scan.ScanDate,
                Eye = scan.Eye,
                ScanType = scan.ScanType,
                ScanPattern = scan.ScanPattern,
                ScanSize = scan.ScanSize,
                Device = scan.Device,
                DeviceModel = scan.DeviceModel,
                Status = scan.Status,
            })
            .ToListAsync(cancellationToken);

        return new Patient360OctPageDto
        {
            Items = items,
            TotalCount = total,
            PageNumber = pageNumber,
            PageSize = pageSize,
        };
    }
}
