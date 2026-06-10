using System.Text.Json;
using AuthService.Context;
using AuthService.DTOs.Optometry;
using AuthService.Models.Domain;
using AuthService.Services.Interfaces;
using Microsoft.EntityFrameworkCore;

namespace AuthService.Services;

public class OptometrySegmentExamService : IOptometrySegmentExamService
{
    private readonly AppDbContext _context;

    public OptometrySegmentExamService(AppDbContext context)
    {
        _context = context;
    }

    public async Task<IReadOnlyList<OptometrySegmentExamDto>> GetByVisitAsync(Guid visitId, Guid tenantId)
    {
        var rows = await _context.OptometrySegmentExams
            .AsNoTracking()
            .Where(x => x.VisitId == visitId && x.TenantId == tenantId)
            .OrderBy(x => x.SegmentKey)
            .ToListAsync();

        return rows.Select(Map).ToList();
    }

    public async Task<OptometrySegmentExamDto?> GetSegmentAsync(Guid visitId, string segmentKey, Guid tenantId)
    {
        var row = await _context.OptometrySegmentExams
            .AsNoTracking()
            .FirstOrDefaultAsync(x =>
                x.VisitId == visitId &&
                x.TenantId == tenantId &&
                x.SegmentKey == segmentKey);

        return row == null ? null : Map(row);
    }

    public async Task<OptometrySegmentExamDto> UpsertSegmentAsync(
        Guid visitId,
        string segmentKey,
        Guid tenantId,
        Guid patientId,
        Guid userId,
        object data)
    {
        var normalizedKey = segmentKey.Trim().ToLowerInvariant();
        var json = JsonSerializer.Serialize(data);
        var now = DateTime.UtcNow;

        var existing = await _context.OptometrySegmentExams.FirstOrDefaultAsync(x =>
            x.VisitId == visitId &&
            x.TenantId == tenantId &&
            x.SegmentKey == normalizedKey);

        if (existing != null)
        {
            existing.Data = json;
            existing.PatientId = patientId;
            existing.UpdatedBy = userId;
            existing.UpdatedAt = now;
        }
        else
        {
            existing = new OptometrySegmentExam
            {
                Id = Guid.NewGuid(),
                TenantId = tenantId,
                VisitId = visitId,
                PatientId = patientId,
                SegmentKey = normalizedKey,
                Data = json,
                UpdatedBy = userId,
                CreatedAt = now,
                UpdatedAt = now,
            };
            _context.OptometrySegmentExams.Add(existing);
        }

        await _context.SaveChangesAsync();
        return Map(existing);
    }

    private static OptometrySegmentExamDto Map(OptometrySegmentExam row)
    {
        object? data = null;
        try
        {
            data = JsonSerializer.Deserialize<object>(row.Data);
        }
        catch
        {
            data = row.Data;
        }

        return new OptometrySegmentExamDto
        {
            Id = row.Id,
            VisitId = row.VisitId,
            PatientId = row.PatientId,
            SegmentKey = row.SegmentKey,
            Data = data,
            UpdatedAt = row.UpdatedAt,
        };
    }
}
