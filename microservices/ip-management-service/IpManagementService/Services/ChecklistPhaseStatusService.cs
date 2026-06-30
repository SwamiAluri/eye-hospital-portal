using System.Text.Json;
using System.Text.Json.Nodes;
using Microsoft.EntityFrameworkCore;
using IpManagementService.Data;
using IpManagementService.Models.Domain;
using IpManagementService.Models.Dtos;

namespace IpManagementService.Services;

/// <summary>Updates checklist_phase_status JSONB on patient_journey.</summary>
public class ChecklistPhaseStatusService
{
    private static readonly JsonSerializerOptions JsonOpts = new()
    {
        PropertyNamingPolicy   = JsonNamingPolicy.CamelCase,
        WriteIndented          = false,
        PropertyNameCaseInsensitive = true,
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
        var j = await RequireJourneyAsync(journeyId, tenantId);

        var root = ParseRoot(j.ChecklistPhaseStatus);
        var dict = Parse(j.ChecklistPhaseStatus);
        mutate(dict);
        foreach (var (key, value) in dict)
            root[key] = value;

        j.ChecklistPhaseStatus = root.ToJsonString(JsonOpts);
        j.UpdatedAt            = DateTime.UtcNow;
        await _db.SaveChangesAsync();
    }

    public async Task UpdateInvestigationPhaseAsync(
        Guid journeyId,
        Guid tenantId,
        bool complete,
        int verifiedCount,
        int totalApplicable,
        IReadOnlyList<string> unverifiedCritical)
    {
        var j = await RequireJourneyAsync(journeyId, tenantId);
        var root = ParseRoot(j.ChecklistPhaseStatus);

        root["ward_investigation_complete"] = complete;
        root["investigations_verified_count"] = verifiedCount;
        root["investigations_total_applicable"] = totalApplicable;

        var critical = new JsonArray();
        foreach (var key in unverifiedCritical)
            critical.Add(key);
        root["investigations_unverified_critical"] = critical;

        j.ChecklistPhaseStatus = root.ToJsonString(JsonOpts);
        j.UpdatedAt            = DateTime.UtcNow;
        await _db.SaveChangesAsync();
    }

    public static Dictionary<string, bool> Parse(string? json)
    {
        if (string.IsNullOrWhiteSpace(json)) return new Dictionary<string, bool>();
        try
        {
            using var doc = JsonDocument.Parse(json);
            var dict = new Dictionary<string, bool>(StringComparer.OrdinalIgnoreCase);
            foreach (var prop in doc.RootElement.EnumerateObject())
            {
                if (prop.Value.ValueKind is JsonValueKind.True or JsonValueKind.False)
                    dict[prop.Name] = prop.Value.GetBoolean();
            }
            return dict;
        }
        catch
        {
            return new Dictionary<string, bool>();
        }
    }

    public static InvestigationPhaseSummaryDto? ParseInvestigationSummary(string? json)
    {
        if (string.IsNullOrWhiteSpace(json)) return null;
        try
        {
            using var doc = JsonDocument.Parse(json);
            var root = doc.RootElement;
            if (!root.TryGetProperty("investigations_total_applicable", out var totalEl)
                || totalEl.ValueKind != JsonValueKind.Number)
                return null;

            var verified = root.TryGetProperty("investigations_verified_count", out var vEl)
                           && vEl.ValueKind == JsonValueKind.Number
                ? vEl.GetInt32()
                : 0;
            var total = totalEl.GetInt32();

            var critical = new List<string>();
            if (root.TryGetProperty("investigations_unverified_critical", out var arr)
                && arr.ValueKind == JsonValueKind.Array)
            {
                foreach (var item in arr.EnumerateArray())
                {
                    if (item.ValueKind == JsonValueKind.String)
                    {
                        var s = item.GetString();
                        if (!string.IsNullOrWhiteSpace(s)) critical.Add(s);
                    }
                }
            }

            return new InvestigationPhaseSummaryDto(verified, total, critical);
        }
        catch
        {
            return null;
        }
    }

    private static JsonObject ParseRoot(string? json)
    {
        if (string.IsNullOrWhiteSpace(json)) return new JsonObject();
        try
        {
            return JsonNode.Parse(json)?.AsObject() ?? new JsonObject();
        }
        catch
        {
            return new JsonObject();
        }
    }

    private async Task<PatientJourney> RequireJourneyAsync(Guid journeyId, Guid tenantId)
        => await _db.PatientJourneys
               .FirstOrDefaultAsync(x => x.Id == journeyId && x.TenantId == tenantId && x.DeletedAt == null)
           ?? throw new KeyNotFoundException($"Journey {journeyId} not found.");
}
