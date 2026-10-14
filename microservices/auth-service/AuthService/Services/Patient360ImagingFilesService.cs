using AuthService.Context;
using AuthService.Models.Domain.Dtos;
using Microsoft.EntityFrameworkCore;

namespace AuthService.Services;

public interface IPatient360ImagingFilesService
{
    Task<Patient360ImagingFilePageDto> ListAsync(Guid tenantId, Guid patientId, int pageNumber, int pageSize);
}

/// <summary>
/// Patient-scoped imaging file metadata. Joins imaging_images to imaging_orders.patient_id.
/// Does not read blobs and does not project storage locations.
/// </summary>
public class Patient360ImagingFilesService : IPatient360ImagingFilesService
{
    private readonly AppDbContext _context;

    public Patient360ImagingFilesService(AppDbContext context)
    {
        _context = context;
    }

    public async Task<Patient360ImagingFilePageDto> ListAsync(
        Guid tenantId,
        Guid patientId,
        int pageNumber,
        int pageSize)
    {
        if (tenantId == Guid.Empty)
            throw new UnauthorizedAccessException("Tenant ID not found in token");

        (pageNumber, pageSize) = Patient360DiagnosticPaging.Normalize(pageNumber, pageSize);

        var query = _context.ImagingImages.AsNoTracking()
            .Where(image => image.DeletedAt == null && image.TenantId == tenantId)
            .Join(
                _context.ImagingOrders.AsNoTracking().Where(order =>
                    order.TenantId == tenantId && order.PatientId == patientId),
                image => image.ImagingOrderId,
                order => order.Id,
                (image, _) => image);

        var total = await query.CountAsync();
        var items = await query
            .OrderByDescending(image => image.UploadedAt)
            .ThenByDescending(image => image.Id)
            .Skip((pageNumber - 1) * pageSize)
            .Take(pageSize)
            .Select(image => new Patient360ImagingFileDto
            {
                Id = image.Id,
                FileName = image.FileName,
                Modality = image.Modality,
                FileSize = image.FileSize,
                ContentType = image.ContentType,
                UploadedAt = image.UploadedAt,
            })
            .ToListAsync();

        return new Patient360ImagingFilePageDto
        {
            Items = items,
            TotalCount = total,
            PageNumber = pageNumber,
            PageSize = pageSize,
        };
    }
}
