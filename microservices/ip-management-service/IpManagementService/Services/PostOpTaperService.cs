using IpManagementService.Data;
using IpManagementService.Models.Domain;
using IpManagementService.Models.Dtos;
using Microsoft.EntityFrameworkCore;

namespace IpManagementService.Services;

/// <summary>
/// W-08 B1 eyedrop taper. Active plan is replace-all; previous rows stay as history.
/// </summary>
public class PostOpTaperService
{
    private readonly IpManagementDbContext _db;
    private readonly JourneyCommandAuthContext _commandAuth;

    public PostOpTaperService(
        IpManagementDbContext db,
        JourneyCommandAuthContext? commandAuth = null)
    {
        _db = db;
        _commandAuth = commandAuth ?? new JourneyCommandAuthContext();
    }

    public async Task<PostOpTaperDto> GetAsync(Guid journeyId, Guid tenantId)
    {
        await RequireJourneyAsync(journeyId, tenantId);
        var rows = await _db.PostOpTaperSteps.AsNoTracking()
            .Where(s => s.JourneyId == journeyId && s.TenantId == tenantId)
            .OrderBy(s => s.DrugName)
            .ThenBy(s => s.StepNo)
            .ThenByDescending(s => s.CreatedAt)
            .ToListAsync();
        var names = await ResolveNamesAsync(rows.Select(r => r.CreatedBy).Distinct());
        var mapped = rows.Select(r => Map(r, names)).ToList();
        return new PostOpTaperDto(
            mapped.Where(s => s.DeletedAt is null).ToList(),
            mapped.Where(s => s.DeletedAt is not null).ToList());
    }

    public async Task<PostOpTaperDto> ReplaceAsync(
        Guid journeyId, Guid tenantId, Guid userId, SavePostOpTaperRequest req)
    {
        _commandAuth.RequirePostOpManage();
        await RequireJourneyAsync(journeyId, tenantId);

        var incoming = (req.Steps ?? []).ToList();
        var prepared = PrepareSteps(incoming);

        var now = DateTime.UtcNow;
        var active = await _db.PostOpTaperSteps
            .Where(s => s.JourneyId == journeyId && s.TenantId == tenantId && s.DeletedAt == null)
            .ToListAsync();
        foreach (var row in active)
            row.DeletedAt = now;

        foreach (var step in prepared)
        {
            _db.PostOpTaperSteps.Add(new PostOpTaperStep
            {
                Id = Guid.NewGuid(),
                TenantId = tenantId,
                JourneyId = journeyId,
                DrugName = step.DrugName,
                Eye = step.Eye,
                StepNo = step.StepNo,
                FrequencyLabel = step.FrequencyLabel,
                Days = step.Days,
                Instructions = step.Instructions,
                CreatedAt = now,
                CreatedBy = userId,
            });
        }

        await _db.SaveChangesAsync();
        return await GetAsync(journeyId, tenantId);
    }

    private static List<(string DrugName, string Eye, int StepNo, string FrequencyLabel, int Days, string? Instructions)>
        PrepareSteps(IReadOnlyList<SavePostOpTaperStepRequest> incoming)
    {
        var counters = new Dictionary<string, int>(StringComparer.OrdinalIgnoreCase);
        var seen = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
        var prepared = new List<(string, string, int, string, int, string?)>();

        foreach (var raw in incoming)
        {
            var drug = (raw.DrugName ?? "").Trim();
            if (drug.Length == 0)
                throw new ArgumentException("Drug name is required.");
            if (drug.Length > 160)
                throw new ArgumentException("Drug name is too long.");

            var eye = NormalizeEye(raw.Eye)
                ?? throw new ArgumentException("Eye must be RIGHT (OD), LEFT (OS), or BOTH (OU).");

            var freq = (raw.FrequencyLabel ?? "").Trim();
            if (freq.Length == 0)
                throw new ArgumentException("How often is required.");
            if (freq.Length > 80)
                throw new ArgumentException("Frequency is too long.");

            if (raw.Days <= 0)
                throw new ArgumentException("Days must be greater than zero.");

            var key = $"{drug}|{eye}";
            var stepNo = raw.StepNo is int n && n > 0
                ? n
                : counters.GetValueOrDefault(key) + 1;
            counters[key] = Math.Max(counters.GetValueOrDefault(key), stepNo);

            var unique = $"{key}|{stepNo}";
            if (!seen.Add(unique))
                throw new ArgumentException($"Duplicate step {stepNo} for {drug} {eye}.");

            prepared.Add((drug, eye, stepNo, freq, raw.Days, string.IsNullOrWhiteSpace(raw.Instructions) ? null : raw.Instructions.Trim()));
        }

        return prepared;
    }

    internal static string? NormalizeEye(string? value)
    {
        var raw = (value ?? "").Trim().ToUpperInvariant();
        if (raw is "OD" or "OS" or "OU") return raw;
        if (raw is "RE" || raw.Contains("RIGHT", StringComparison.Ordinal)) return "OD";
        if (raw is "LE" || raw.Contains("LEFT", StringComparison.Ordinal)) return "OS";
        if (raw is "BOTH" || raw.Contains("BILAT", StringComparison.Ordinal)) return "OU";
        return null;
    }

    private async Task RequireJourneyAsync(Guid journeyId, Guid tenantId)
    {
        var exists = await _db.PatientJourneys.AnyAsync(
            j => j.Id == journeyId && j.TenantId == tenantId && j.DeletedAt == null);
        if (!exists)
            throw new KeyNotFoundException($"Journey {journeyId} not found.");
    }

    private async Task<Dictionary<Guid, string>> ResolveNamesAsync(IEnumerable<Guid> ids)
    {
        var list = ids.Where(id => id != Guid.Empty).Distinct().ToList();
        if (list.Count == 0)
            return new Dictionary<Guid, string>();
        return await _db.StaffUsers.AsNoTracking()
            .Where(u => list.Contains(u.Id))
            .ToDictionaryAsync(
                u => u.Id,
                u => $"{u.FirstName} {u.LastName}".Trim());
    }

    private static PostOpTaperStepDto Map(PostOpTaperStep row, IReadOnlyDictionary<Guid, string> names)
        => new(
            row.Id,
            row.DrugName,
            row.Eye,
            row.StepNo,
            row.FrequencyLabel,
            row.Days,
            row.Instructions,
            row.CreatedAt,
            row.CreatedBy,
            names.TryGetValue(row.CreatedBy, out var name) && !string.IsNullOrWhiteSpace(name) ? name : null,
            row.DeletedAt);
}
