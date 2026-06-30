using AuthService.Context;
using AuthService.Models.Domain;
using AuthService.Models.Domain.Dtos;
using Microsoft.EntityFrameworkCore;

namespace AuthService.Services;

public interface IPatientRecentViewsService
{
    Task RecordViewAsync(Guid tenantId, Guid userId, Guid patientId);
    Task<List<PatientRecentViewDto>> GetRecentAsync(Guid tenantId, Guid userId, int limit = 6);
}

public class PatientRecentViewsService : IPatientRecentViewsService
{
    private readonly AppDbContext _context;

    public PatientRecentViewsService(AppDbContext context)
    {
        _context = context;
    }

    public async Task RecordViewAsync(Guid tenantId, Guid userId, Guid patientId)
    {
        var existing = await _context.PatientRecentViews
            .FirstOrDefaultAsync(v =>
                v.TenantId == tenantId && v.UserId == userId && v.PatientId == patientId);

        if (existing != null)
        {
            existing.ViewedAt = DateTime.UtcNow;
        }
        else
        {
            _context.PatientRecentViews.Add(new PatientRecentView
            {
                TenantId = tenantId,
                UserId = userId,
                PatientId = patientId,
                ViewedAt = DateTime.UtcNow,
            });
        }

        await _context.SaveChangesAsync();

        var overflow = await _context.PatientRecentViews
            .Where(v => v.TenantId == tenantId && v.UserId == userId)
            .OrderByDescending(v => v.ViewedAt)
            .Skip(20)
            .ToListAsync();
        if (overflow.Count > 0)
        {
            _context.PatientRecentViews.RemoveRange(overflow);
            await _context.SaveChangesAsync();
        }
    }

    public async Task<List<PatientRecentViewDto>> GetRecentAsync(Guid tenantId, Guid userId, int limit = 6)
    {
        limit = Math.Clamp(limit, 1, 20);
        return await _context.PatientRecentViews.AsNoTracking()
            .Where(v => v.TenantId == tenantId && v.UserId == userId)
            .OrderByDescending(v => v.ViewedAt)
            .Take(limit)
            .Join(
                _context.Patients.AsNoTracking().Where(p => p.DeletedAt == null),
                v => v.PatientId,
                p => p.Id,
                (v, p) => new PatientRecentViewDto
                {
                    PatientId = p.Id,
                    FirstName = p.FirstName,
                    LastName = p.LastName,
                    Mrn = p.MedicalRecordNumber,
                    PhotoThumbnailUrl = p.PhotoThumbnailUrl,
                    ViewedAt = v.ViewedAt,
                })
            .ToListAsync();
    }
}
