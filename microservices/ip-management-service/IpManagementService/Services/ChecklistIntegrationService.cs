using Microsoft.EntityFrameworkCore;
using IpManagementService.Data;
using IpManagementService.Models.Dtos;

namespace IpManagementService.Services;

/// <summary>Phase 2 — LIS / imaging webhooks auto-complete ward investigation items.</summary>
public class ChecklistIntegrationService
{
    private readonly IpManagementDbContext              _db;
    private readonly WardInvestigationChecklistService  _investigation;

    public ChecklistIntegrationService(
        IpManagementDbContext db,
        WardInvestigationChecklistService investigation)
    {
        _db            = db;
        _investigation = investigation;
    }

    public async Task<IntegrationWebhookResultDto> ProcessLisResultAsync(
        Guid tenantId, Guid userId, LisIntegrationWebhookRequest req)
    {
        if (!string.Equals(req.Status, "Completed", StringComparison.OrdinalIgnoreCase))
            return new IntegrationWebhookResultDto(req.JourneyId, 0, Array.Empty<string>());

        var keys = InvestigationKeywordRegistry.MatchLisKeys(req.TestCode ?? "", req.TestName ?? "");
        return await CompleteInvestigationItemsAsync(tenantId, userId, req.JourneyId, keys);
    }

    public async Task<IntegrationWebhookResultDto> ProcessImagingResultAsync(
        Guid tenantId, Guid userId, ImagingIntegrationWebhookRequest req)
    {
        if (!string.Equals(req.Status, "Completed", StringComparison.OrdinalIgnoreCase))
            return new IntegrationWebhookResultDto(req.JourneyId, 0, Array.Empty<string>());

        var keys = InvestigationKeywordRegistry.MatchImagingKeys(req.Modality ?? "", req.StudyType ?? "");
        return await CompleteInvestigationItemsAsync(tenantId, userId, req.JourneyId, keys);
    }

    private async Task<IntegrationWebhookResultDto> CompleteInvestigationItemsAsync(
        Guid tenantId, Guid userId, Guid journeyId, IReadOnlyList<string> itemKeys)
    {
        if (itemKeys.Count == 0)
            return new IntegrationWebhookResultDto(journeyId, 0, Array.Empty<string>());

        var clearance = await _db.PreOpClearances
            .FirstOrDefaultAsync(c => c.JourneyId == journeyId
                                      && c.TenantId == tenantId
                                      && c.DeletedAt == null);
        if (clearance is null)
            return new IntegrationWebhookResultDto(journeyId, 0, Array.Empty<string>());

        var items = await _db.PreOpSectionItems
            .Where(i => i.FormCode == WardInvestigationChecklistService.InvestigationFormCode
                        && itemKeys.Contains(i.ItemKey)
                        && i.IsActive
                        && i.DeletedAt == null)
            .ToListAsync();

        var updated = new List<string>();
        foreach (var item in items)
        {
            var completion = await _db.PreOpCompletions
                .FirstOrDefaultAsync(c => c.ClearanceId == clearance.Id
                                          && c.ItemId == item.Id
                                          && c.DeletedAt == null);
            if (completion is { IsCompleted: true }) continue;

            await _investigation.SaveCompletionAsync(
                journeyId, item.Id, tenantId, userId,
                new SaveWardInvestigationCompletionRequest(true, false, null,
                    "Auto-completed from integration webhook"));
            updated.Add(item.ItemKey);
        }

        return new IntegrationWebhookResultDto(journeyId, updated.Count, updated);
    }
}
