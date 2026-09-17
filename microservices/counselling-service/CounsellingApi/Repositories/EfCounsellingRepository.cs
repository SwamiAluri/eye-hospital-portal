using CounsellingApi.Data;
using CounsellingApi.Models;
using CounsellingApi.Models.Entities;
using Microsoft.EntityFrameworkCore;

namespace CounsellingApi.Repositories;

/// <summary>
/// EF Core implementation of <see cref="ICounsellingRepository"/> targeting Azure PostgreSQL.
/// All read operations use <c>AsNoTracking()</c> for performance.
/// Soft-delete filter (<c>deleted_at IS NULL</c>) is applied on every read query.
/// </summary>
public class EfCounsellingRepository : ICounsellingRepository
{
    private readonly ApplicationDbContext _context;

    public EfCounsellingRepository(ApplicationDbContext context)
    {
        _context = context;
    }

    // ── Read ─────────────────────────────────────────────────────────────────

    public async Task<PatientCounselling?> Get(Guid id)
    {
        // Do not JOIN patients — that table is owned by auth-service and may be absent
        // on the counselling connection (Postgres 42P01). Save/Decision must still work.
        var byId = await _context.PatientCounselling
            .AsNoTracking()
            .FirstOrDefaultAsync(x => x.Id == id && x.DeletedAt == null);

        if (byId != null) return byId;

        // Fallback: the frontend passes the auth-service session ID as the record locator.
        // That ID is stored as PatientId on the counselling record (set during Start()).
        return await _context.PatientCounselling
            .AsNoTracking()
            .OrderByDescending(x => x.CreatedAt)
            .FirstOrDefaultAsync(x => x.PatientId == id && x.DeletedAt == null);
    }

    /// <summary>Returns the most recently created active counselling record for a patient.</summary>
    public async Task<PatientCounselling?> GetByPatient(Guid patientId)
    {
        return await _context.PatientCounselling
            .AsNoTracking()
            .OrderByDescending(x => x.CreatedAt)
            .FirstOrDefaultAsync(x => x.PatientId == patientId && x.DeletedAt == null);
    }

    public async Task<(List<PatientCounselling> Items, int Total)> GetList(GetListQuery query)
    {
        var q = _context.PatientCounselling
            .AsNoTracking()
            .Where(x => x.DeletedAt == null);

        if (query.TenantId.HasValue)
            q = q.Where(x => x.TenantId == query.TenantId.Value);

        if (query.PatientId.HasValue)
            q = q.Where(x => x.PatientId == query.PatientId.Value);

        if (!string.IsNullOrWhiteSpace(query.Status))
            q = q.Where(x => x.Status == query.Status);

        var total = await q.CountAsync();

        var items = await q
            .OrderByDescending(x => x.CreatedAt)
            .Skip(Math.Max(0, query.Page - 1) * query.PageSize)
            .Take(query.PageSize)
            .ToListAsync();

        return (items, total);
    }

    // ── Write ────────────────────────────────────────────────────────────────

    public async Task Add(PatientCounselling entity)
    {
        _context.PatientCounselling.Add(entity);
        await _context.SaveChangesAsync();
    }

    /// <summary>
    /// Updates a detached entity (fetched via AsNoTracking).
    /// Attaches it in the Modified state so EF generates an UPDATE statement.
    /// </summary>
    public async Task Update(PatientCounselling entity)
    {
        _context.PatientCounselling.Update(entity);
        await _context.SaveChangesAsync();
    }

    // ── Price Overrides ──────────────────────────────────────────────────────

    public async Task AddPriceOverride(SessionPriceOverride entity)
    {
        _context.SessionPriceOverrides.Add(entity);
        await _context.SaveChangesAsync();
    }

    public async Task<List<SessionPriceOverride>> GetPriceOverrides(Guid counsellingId)
    {
        return await _context.SessionPriceOverrides
            .AsNoTracking()
            .Where(x => x.CounsellingId == counsellingId && x.DeletedAt == null && x.RecordStatus == "active")
            .OrderByDescending(x => x.CreatedAt)
            .ToListAsync();
    }

    public async Task<bool> SoftDeletePriceOverride(Guid overrideId, string performedBy)
    {
        var entity = await _context.SessionPriceOverrides.FindAsync(overrideId);
        if (entity == null || entity.DeletedAt != null) return false;
        entity.DeletedAt        = DateTime.UtcNow;
        entity.RecordStatus     = "inactive";
        entity.UpdatedAt        = DateTime.UtcNow;
        entity.UpdatedByUserId  = performedBy;
        await _context.SaveChangesAsync();
        return true;
    }

    public async Task<SessionPriceOverride?> UpdatePriceOverride(Guid overrideId, decimal overriddenPrice, string reason, string? remarks, string performedBy)
    {
        var entity = await _context.SessionPriceOverrides.FindAsync(overrideId);
        if (entity == null || entity.DeletedAt != null) return null;
        entity.OverriddenPrice  = overriddenPrice;
        entity.Reason           = reason;
        entity.Remarks          = remarks;
        entity.UpdatedAt        = DateTime.UtcNow;
        entity.UpdatedByUserId  = performedBy;
        await _context.SaveChangesAsync();
        return entity;
    }

    public async Task<List<SessionPriceOverride>> GetUnsentStaffOverrides(Guid counsellingId)
    {
        return await _context.SessionPriceOverrides
            .Where(x => x.CounsellingId == counsellingId
                     && x.RequestedByType == "STAFF"
                     && !x.NotificationSent)
            .ToListAsync();
    }

    public async Task MarkNotificationSent(Guid overrideId)
    {
        var entity = await _context.SessionPriceOverrides.FindAsync(overrideId);
        if (entity != null)
        {
            entity.NotificationSent   = true;
            entity.NotificationSentAt = DateTime.UtcNow;
            await _context.SaveChangesAsync();
        }
    }

    // ── Audit Logs ───────────────────────────────────────────────────────────

    /// <summary>
    /// Returns all audit entries for a counselling session, newest first.
    /// Accepts either the Azure record's own UUID or the auth-service session UUID
    /// (stored as PatientId). The fallback mirrors the Get() dual-ID strategy so that
    /// calling getHistory(sessionId) from the frontend always resolves correctly.
    /// </summary>
    public async Task<List<AuditLog>> GetAuditLogs(Guid counsellingId)
    {
        // Primary: direct lookup by CounsellingId (used by Save, Decision, Schedule, etc.)
        var direct = await _context.AuditLogs
            .AsNoTracking()
            .Where(x => x.CounsellingId == counsellingId)
            .OrderByDescending(x => x.PerformedAt)
            .ToListAsync();

        if (direct.Count > 0) return direct;

        // Fallback: the frontend passes the auth-service session UUID as the record locator.
        // StartCounselling stores that UUID as PatientId on the record, so look it up and
        // re-query audit logs using the Azure record's own Id.
        var record = await _context.PatientCounselling
            .AsNoTracking()
            .OrderByDescending(x => x.CreatedAt)
            .FirstOrDefaultAsync(x => x.PatientId == counsellingId && x.DeletedAt == null);

        if (record == null) return direct; // still empty — genuinely no history

        return await _context.AuditLogs
            .AsNoTracking()
            .Where(x => x.CounsellingId == record.Id)
            .OrderByDescending(x => x.PerformedAt)
            .ToListAsync();
    }
}
