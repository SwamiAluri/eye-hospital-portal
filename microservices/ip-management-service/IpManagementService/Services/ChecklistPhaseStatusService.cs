using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using IpManagementService.Data;
using IpManagementService.Models.Domain;

namespace IpManagementService.Services;

/// <summary>Updates checklist_phase_status JSONB on patient_journey.</summary>
public class ChecklistPhaseStatusService
{
    private static readonly JsonSerializerOptions JsonOpts = new()
    {
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
        WriteIndented        = false,
    };

    private readonly IpManagementDbContext _db;

    public ChecklistPhaseStatusService(IpManagementDbContext db) => _db = db;

    public async Task<Dictionary<string, bool>> GetAsync(Guid journeyId, Guid tenantId)
    {
        var j = await _db.PatientJourneys
            .AsNoTracking()
            .FirstOrDefaultAsync(x => x.Id == journeyId && x.TenantId == tenantId && x.DeletedAt == null);
        return Parse(j?.ChecklistPhaseStatus);
    }

    public async Task UpdateAsync(Guid journeyId, Guid tenantId, Action<Dictionary<string, bool>> mutate)
    {
        var j = await _db.PatientJourneys
            .FirstOrDefaultAsync(x => x.Id == journeyId && x.TenantId == tenantId && x.DeletedAt == null)
            ?? throw new KeyNotFoundException($"Journey {journeyId} not found.");

        var dict = Parse(j.ChecklistPhaseStatus);
        mutate(dict);
        j.ChecklistPhaseStatus = JsonSerializer.Serialize(dict, JsonOpts);
        j.UpdatedAt            = DateTime.UtcNow;
        await _db.SaveChangesAsync();
    }

    public static Dictionary<string, bool> Parse(string? json)
    {
        if (string.IsNullOrWhiteSpace(json)) return new Dictionary<string, bool>();
        try
        {
            return JsonSerializer.Deserialize<Dictionary<string, bool>>(json, JsonOpts)
                   ?? new Dictionary<string, bool>();
        }
        catch
        {
            return new Dictionary<string, bool>();
        }
    }
}
