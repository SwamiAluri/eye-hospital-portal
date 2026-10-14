using AuthService.Context;
using AuthService.DTOs;
using Microsoft.EntityFrameworkCore;

namespace AuthService.Services;

public interface IPatient360MedicationReadService
{
    Task<Patient360MedicationPageDto> ListAsync(
        Guid tenantId,
        Guid userId,
        Guid patientId,
        int pageNumber,
        int pageSize,
        CancellationToken cancellationToken = default);
}

/// <summary>
/// Patient 360 prescription history. Tenant and deleted filters only. No branch rule.
/// </summary>
public class Patient360MedicationReadService : IPatient360MedicationReadService
{
    private static readonly string[] VisibleStatuses = { "active", "completed", "cancelled" };

    private readonly AppDbContext _context;

    public Patient360MedicationReadService(AppDbContext context)
    {
        _context = context;
    }

    public async Task<Patient360MedicationPageDto> ListAsync(
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

        var query = _context.Prescriptions.AsNoTracking()
            .Where(prescription => prescription.PatientId == patientId
                && prescription.TenantId == tenantId
                && prescription.DeletedAt == null
                && VisibleStatuses.Contains(prescription.Status)
                && prescription.Medications.Any(line =>
                    line.PrescriptionId == prescription.Id
                    && line.TenantId == tenantId
                    && line.DeletedAt == null));

        var total = await query.CountAsync(cancellationToken);
        var items = await query
            .OrderByDescending(prescription => prescription.PrescriptionDate)
            .ThenByDescending(prescription => prescription.Id)
            .Skip((pageNumber - 1) * pageSize)
            .Take(pageSize)
            .Select(prescription => new Patient360MedicationHistoryDto
            {
                Id = prescription.Id,
                PrescriptionDate = prescription.PrescriptionDate,
                Status = prescription.Status,
                Lines = prescription.Medications
                    .Where(line => line.TenantId == tenantId && line.DeletedAt == null)
                    .OrderBy(line => line.StartDate)
                    .ThenBy(line => line.Id)
                    .Select(line => new Patient360MedicationLineDto
                    {
                        Id = line.Id,
                        MedicationName = line.MedicationName,
                        GenericName = line.GenericName,
                        Dosage = line.Dosage,
                        Form = line.Form,
                        Route = line.Route,
                        Frequency = line.Frequency,
                        DurationDays = line.DurationDays,
                        StartDate = line.StartDate,
                        EndDate = line.EndDate,
                    })
                    .ToList(),
            })
            .ToListAsync(cancellationToken);

        return new Patient360MedicationPageDto
        {
            Items = items,
            TotalCount = total,
            PageNumber = pageNumber,
            PageSize = pageSize,
        };
    }
}
