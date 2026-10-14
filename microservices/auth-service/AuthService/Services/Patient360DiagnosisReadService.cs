using AuthService.Context;
using AuthService.DTOs;
using Microsoft.EntityFrameworkCore;

namespace AuthService.Services;

public interface IPatient360DiagnosisReadService
{
    Task<Patient360CodedDiagnosisPageDto> ListAsync(
        Guid tenantId,
        Guid userId,
        Guid patientId,
        int pageNumber,
        int pageSize,
        CancellationToken cancellationToken = default);
}

/// <summary>
/// Patient 360 coded diagnosis. Tenant and deleted filters only. No branch rule.
/// Reads patient_diagnosis joined to diagnosis_code. Does not read examination,
/// draft, prescription, counselling, journey, discharge, payer, or OCT diagnosis.
/// </summary>
public class Patient360DiagnosisReadService : IPatient360DiagnosisReadService
{
    private readonly AppDbContext _context;

    public Patient360DiagnosisReadService(AppDbContext context)
    {
        _context = context;
    }

    public async Task<Patient360CodedDiagnosisPageDto> ListAsync(
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
                patient => patient.Id == patientId && patient.TenantId == tenantId && patient.DeletedAt == null,
                cancellationToken);
        if (!patientInTenant)
            throw new KeyNotFoundException("Patient was not found for this tenant.");

        (pageNumber, pageSize) = Patient360DiagnosticPaging.Normalize(pageNumber, pageSize);

        var query =
            from diagnosis in _context.PatientDiagnoses.AsNoTracking()
            join code in _context.DiagnosisCodes.AsNoTracking()
                on diagnosis.DiagnosisCodeId equals code.Id
            where diagnosis.PatientId == patientId
                && diagnosis.TenantId == tenantId
                && diagnosis.DeletedAt == null
                && code.TenantId == tenantId
                && code.DeletedAt == null
            select new Patient360CodedDiagnosisDto
            {
                Id = diagnosis.Id,
                Code = code.Code,
                Description = code.Description,
                DiagnosisType = diagnosis.DiagnosisType,
                EyeSpecificity = diagnosis.EyeSpecificity,
                CodeLaterality = code.Laterality,
                DiagnosedAt = diagnosis.DiagnosedAt,
            };

        var total = await query.CountAsync(cancellationToken);
        var items = await query
            .OrderByDescending(row => row.DiagnosedAt)
            .ThenByDescending(row => row.Id)
            .Skip((pageNumber - 1) * pageSize)
            .Take(pageSize)
            .ToListAsync(cancellationToken);

        return new Patient360CodedDiagnosisPageDto
        {
            Items = items,
            TotalCount = total,
            PageNumber = pageNumber,
            PageSize = pageSize,
        };
    }
}
