using CcmsApi.Data;
using CcmsApi.Models.Domain;
using Microsoft.EntityFrameworkCore;

namespace CcmsApi.Services;

public class CommunicationEngineService
{
    private readonly CcmsDbContext _db;

    public CommunicationEngineService(CcmsDbContext db) => _db = db;

    public async Task<CcmsCommunicationLog> LogAsync(
        Guid coverageCaseId, Guid actorUserId,
        LogCommunicationRequest req, CancellationToken ct = default)
    {
        var coverageCase = await _db.CoverageCases.AsNoTracking()
            .FirstOrDefaultAsync(c => c.Id == coverageCaseId && c.DeletedAt == null, ct)
            ?? throw new KeyNotFoundException($"Coverage case {coverageCaseId} not found.");

        var log = new CcmsCommunicationLog
        {
            Id                  = Guid.NewGuid(),
            TenantId            = coverageCase.TenantId,
            CoverageCase_Id     = coverageCaseId,
            CommunicationType   = req.Channel,
            Direction           = req.Direction ?? "outbound",
            RecipientType       = req.RecipientType,
            RecipientAddress    = req.RecipientRef,
            Subject             = req.Subject,
            BodySummary         = req.Body,
            SentAt              = DateTime.UtcNow,
            CreatedAt           = DateTime.UtcNow,
            UpdatedAt           = DateTime.UtcNow,
            CreatedByUserId     = actorUserId,
            UpdatedByUserId     = actorUserId,
            Status              = "active"
        };

        _db.CommunicationLogs.Add(log);
        await _db.SaveChangesAsync(ct);
        return log;
    }

    public async Task<List<CcmsCommunicationLog>> GetByCaseAsync(
        Guid coverageCaseId, CancellationToken ct = default)
        => await _db.CommunicationLogs.AsNoTracking()
            .Where(l => l.CoverageCase_Id == coverageCaseId && l.DeletedAt == null)
            .OrderByDescending(l => l.CreatedAt)
            .ToListAsync(ct);

    public async Task<List<CcmsCommunicationTemplate>> GetTemplatesAsync(
        Guid tenantId, string? channel = null, CancellationToken ct = default)
    {
        var q = _db.CommunicationTemplates.AsNoTracking()
            .Where(t => t.TenantId == tenantId && t.IsActive && t.DeletedAt == null);
        if (!string.IsNullOrEmpty(channel))
            q = q.Where(t => t.CommunicationType == channel);
        return await q.ToListAsync(ct);
    }
}

public record LogCommunicationRequest(
    string  Channel,
    string? Direction,
    string  RecipientType,
    string? RecipientRef,
    string? Subject,
    string? Body,
    string? TemplateCode
);
