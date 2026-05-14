using CcmsApi.Data;
using CcmsApi.Models.Domain;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;

namespace CcmsApi.Services;

/// <summary>
/// CCMS financial year resolution service.
/// Resolves the current financial year for a tenant, or creates one if needed.
/// </summary>
public class FinancialYearService
{
    private readonly CcmsDbContext _db;
    private readonly ILogger<FinancialYearService> _log;

    public FinancialYearService(CcmsDbContext db, ILogger<FinancialYearService> log)
    {
        _db  = db;
        _log = log;
    }

    /// <summary>
    /// Returns the current financial year ID for a tenant.
    /// Auto-creates the financial year if it doesn't exist yet.
    /// </summary>
    public async Task<Guid> GetCurrentFinancialYearIdAsync(
        Guid tenantId, Guid actorUserId, CancellationToken ct = default)
    {
        var now = DateTime.UtcNow;

        // Try to find existing current FY for this tenant
        var fy = await _db.FinancialYears
            .FirstOrDefaultAsync(f =>
                f.TenantId == tenantId &&
                f.IsCurrent &&
                f.DeletedAt == null, ct);

        if (fy is not null)
            return fy.Id;

        // No current FY — auto-create based on current date
        // Indian financial year: Apr 1 – Mar 31
        var fyStart = now.Month >= 4
            ? new DateOnly(now.Year, 4, 1)
            : new DateOnly(now.Year - 1, 4, 1);
        var fyEnd = fyStart.AddYears(1).AddDays(-1);

        var yearCode = $"{fyStart.Year % 100:D2}{fyEnd.Year % 100:D2}"; // "2526"
        var yearLabel = $"FY {fyStart.Year}-{fyEnd.Year % 100:D2}";

        fy = new CcmsFinancialYear
        {
            Id                = Guid.NewGuid(),
            TenantId          = tenantId,
            YearCode          = yearCode,
            YearLabel         = yearLabel,
            StartDate         = fyStart,
            EndDate           = fyEnd,
            IsCurrent         = true,
            CreatedAt         = now,
            UpdatedAt         = now,
            CreatedByUserId   = actorUserId,
            UpdatedByUserId   = actorUserId,
            Status            = "active"
        };
        _db.FinancialYears.Add(fy);
        await _db.SaveChangesAsync(ct);

        _log.LogInformation("Auto-created financial year {Label} for tenant {Tenant}", yearLabel, tenantId);
        return fy.Id;
    }

    public async Task<CcmsFinancialYear?> GetByIdAsync(Guid id, CancellationToken ct = default)
        => await _db.FinancialYears.AsNoTracking()
            .FirstOrDefaultAsync(f => f.Id == id && f.DeletedAt == null, ct);

    public async Task<List<CcmsFinancialYear>> ListByTenantAsync(Guid tenantId, CancellationToken ct = default)
        => await _db.FinancialYears.AsNoTracking()
            .Where(f => f.TenantId == tenantId && f.DeletedAt == null)
            .OrderByDescending(f => f.StartDate)
            .ToListAsync(ct);
}
