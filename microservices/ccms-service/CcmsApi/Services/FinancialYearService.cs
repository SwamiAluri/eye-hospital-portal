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

    /// <summary>
    /// Resolves a financial year ID from a GUID string or UI label like "2026-27" / "FY 2026-27".
    /// Auto-creates the FY row when the label is valid but not yet in the database.
    /// </summary>
    public async Task<Guid?> ResolveFinancialYearIdAsync(
        Guid tenantId,
        string? labelOrId,
        Guid actorUserId,
        CancellationToken ct = default)
    {
        if (string.IsNullOrWhiteSpace(labelOrId))
            return null;

        var raw = labelOrId.Trim();
        if (Guid.TryParse(raw, out var guid))
            return guid;

        var normalized = raw
            .Replace("FY", "", StringComparison.OrdinalIgnoreCase)
            .Replace(" ", "")
            .Trim();

        var existing = await _db.FinancialYears
            .Where(f => f.TenantId == tenantId && f.DeletedAt == null)
            .ToListAsync(ct);

        foreach (var fy in existing)
        {
            var labelNorm = fy.YearLabel
                .Replace("FY", "", StringComparison.OrdinalIgnoreCase)
                .Replace(" ", "")
                .Trim();
            if (string.Equals(labelNorm, normalized, StringComparison.OrdinalIgnoreCase)
                || string.Equals(fy.YearCode, normalized, StringComparison.OrdinalIgnoreCase))
                return fy.Id;
        }

        // Parse "2026-27" → Apr 2026 – Mar 2027
        var parts = normalized.Split('-', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);
        if (parts.Length != 2 || !int.TryParse(parts[0], out var startYear))
            return null;

        var endSuffix = parts[1];
        var endYear = endSuffix.Length <= 2
            ? startYear / 100 * 100 + int.Parse(endSuffix)
            : int.Parse(endSuffix);
        if (endYear < startYear)
            endYear = startYear / 100 * 100 + int.Parse(endSuffix);

        var fyStart = new DateOnly(startYear, 4, 1);
        var fyEnd = fyStart.AddYears(1).AddDays(-1);
        var yearCode = $"{startYear % 100:D2}{fyEnd.Year % 100:D2}";
        var yearLabel = $"FY {startYear}-{fyEnd.Year % 100:D2}";

        var created = new CcmsFinancialYear
        {
            Id              = Guid.NewGuid(),
            TenantId        = tenantId,
            YearCode        = yearCode,
            YearLabel       = yearLabel,
            StartDate       = fyStart,
            EndDate         = fyEnd,
            IsCurrent       = false,
            CreatedAt       = DateTime.UtcNow,
            UpdatedAt       = DateTime.UtcNow,
            CreatedByUserId = actorUserId,
            UpdatedByUserId = actorUserId,
            Status          = "active",
        };
        _db.FinancialYears.Add(created);
        await _db.SaveChangesAsync(ct);
        _log.LogInformation("Created financial year {Label} for tenant {Tenant}", yearLabel, tenantId);
        return created.Id;
    }
}
