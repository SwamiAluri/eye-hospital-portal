using IpManagementService.Data;
using IpManagementService.Models.Domain;
using Microsoft.EntityFrameworkCore;

namespace IpManagementService.Services;

public record DailyProgressNoteDto(Guid Id, string Note, DateTime RecordedAt, Guid? CreatedByUserId);

public class DailyProgressNoteService
{
    private readonly IpManagementDbContext _db;

    public DailyProgressNoteService(IpManagementDbContext db) => _db = db;

    public async Task<List<DailyProgressNoteDto>> ListAsync(Guid journeyId, Guid tenantId)
        => await _db.DailyProgressNotes.AsNoTracking()
            .Where(n => n.PatientJourneyId == journeyId && n.TenantId == tenantId && n.DeletedAt == null)
            .OrderByDescending(n => n.RecordedAt)
            .Select(n => new DailyProgressNoteDto(n.Id, n.Note, n.RecordedAt, n.CreatedByUserId))
            .ToListAsync();

    public async Task<DailyProgressNoteDto> AddAsync(Guid journeyId, Guid tenantId, Guid userId, string note)
    {
        if (string.IsNullOrWhiteSpace(note))
            throw new ArgumentException("Note is required.");

        var journey = await _db.PatientJourneys
            .FirstOrDefaultAsync(j => j.Id == journeyId && j.TenantId == tenantId && j.DeletedAt == null)
            ?? throw new KeyNotFoundException("Journey not found.");

        var row = new IpDailyProgressNote
        {
            Id = Guid.NewGuid(),
            TenantId = tenantId,
            PatientJourneyId = journey.Id,
            Note = note.Trim(),
            RecordedAt = DateTime.UtcNow,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow,
            CreatedByUserId = userId,
            UpdatedByUserId = userId,
            Status = "active",
        };
        _db.DailyProgressNotes.Add(row);
        await _db.SaveChangesAsync();
        return new DailyProgressNoteDto(row.Id, row.Note, row.RecordedAt, row.CreatedByUserId);
    }
}
