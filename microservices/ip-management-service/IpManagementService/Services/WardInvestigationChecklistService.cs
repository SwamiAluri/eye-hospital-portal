using Microsoft.EntityFrameworkCore;
using IpManagementService.Data;
using IpManagementService.Models.Domain;
using IpManagementService.Models.Dtos;

namespace IpManagementService.Services;

/// <summary>Form 1 — Ward Investigation Pre-op (13 items, WARD_INVESTIGATION_PREOP).</summary>
public class WardInvestigationChecklistService
{
    public const string InvestigationFormCode    = "WARD_INVESTIGATION_PREOP";
    public const string InvestigationFormContext = "ward_investigation";

    private readonly IpManagementDbContext   _db;
    private readonly PreOpClearanceService     _preOp;
    private readonly ChecklistPhaseStatusService _phaseStatus;

    public WardInvestigationChecklistService(
        IpManagementDbContext db,
        PreOpClearanceService preOp,
        ChecklistPhaseStatusService phaseStatus)
    {
        _db          = db;
        _preOp       = preOp;
        _phaseStatus = phaseStatus;
    }

    public async Task<WardInvestigationChecklistDto> GetChecklistAsync(
        Guid journeyId, Guid tenantId, Guid userId)
    {
        var journey = await RequireJourneyAsync(journeyId, tenantId);

        await _preOp.GetOrInitClearanceAsync(
            journeyId, tenantId, userId,
            new InitPreOpClearanceRequest(null, null));

        var clearance = await _db.PreOpClearances
            .FirstAsync(c => c.JourneyId == journeyId && c.TenantId == tenantId && c.DeletedAt == null);

        await EnsureCompletionRowsAsync(clearance.Id, tenantId, userId);

        return await BuildDtoAsync(journey, clearance.Id, tenantId);
    }

    public async Task<WardInvestigationChecklistDto> SaveCompletionAsync(
        Guid journeyId, Guid itemId, Guid tenantId, Guid userId,
        SaveWardInvestigationCompletionRequest req, string? completedByRole = null)
    {
        await RequireJourneyAsync(journeyId, tenantId);

        var item = await _db.PreOpSectionItems
            .FirstOrDefaultAsync(i => i.Id == itemId
                                      && i.FormCode == InvestigationFormCode
                                      && i.DeletedAt == null)
            ?? throw new KeyNotFoundException($"Investigation checklist item {itemId} not found.");

        await _preOp.SaveCompletionAsync(
            journeyId, tenantId, userId, itemId,
            new SavePreOpCompletionRequest(
                itemId,
                req.IsCompleted,
                req.IsBypassed ?? false,
                req.BypassReason,
                req.Notes,
                null),
            completedByRole);

        var journey   = await RequireJourneyAsync(journeyId, tenantId);
        var clearance = await _db.PreOpClearances
            .FirstAsync(c => c.JourneyId == journeyId && c.TenantId == tenantId && c.DeletedAt == null);

        var dto = await BuildDtoAsync(journey, clearance.Id, tenantId);
        await SyncPhaseStatusAsync(journeyId, tenantId, dto);
        return dto;
    }

    private async Task SyncPhaseStatusAsync(Guid journeyId, Guid tenantId, WardInvestigationChecklistDto dto)
    {
        var applicable = dto.Items.Where(i => i.AppliesToJourney).ToList();
        var complete   = applicable.Count > 0
                         && applicable.All(i => i.IsCompleted || i.IsBypassed);
        await _phaseStatus.UpdateAsync(journeyId, tenantId, d => d["ward_investigation_complete"] = complete);
    }

    private async Task EnsureCompletionRowsAsync(Guid clearanceId, Guid tenantId, Guid userId)
    {
        var itemIds = await _db.PreOpSectionItems
            .Where(i => i.FormCode == InvestigationFormCode
                        && i.FormContext == InvestigationFormContext
                        && (i.TenantId == null || i.TenantId == tenantId)
                        && i.DeletedAt == null
                        && i.IsActive)
            .Select(i => i.Id)
            .ToListAsync();

        var existingList = await _db.PreOpCompletions
            .Where(c => c.ClearanceId == clearanceId
                        && c.DeletedAt == null
                        && itemIds.Contains(c.ItemId))
            .Select(c => c.ItemId)
            .ToListAsync();
        var existing = existingList.ToHashSet();

        var now = DateTime.UtcNow;
        foreach (var itemId in itemIds.Where(id => !existing.Contains(id)))
        {
            _db.PreOpCompletions.Add(new PreOpCompletion
            {
                Id              = Guid.NewGuid(),
                TenantId        = tenantId,
                ClearanceId     = clearanceId,
                ItemId          = itemId,
                IsCompleted     = false,
                IsBypassed      = false,
                Source          = "ward_investigation",
                CreatedByUserId = userId,
                UpdatedByUserId = userId,
                CreatedAt       = now,
                UpdatedAt       = now,
                Status          = "active",
            });
        }

        if (itemIds.Any(id => !existing.Contains(id)))
            await _db.SaveChangesAsync();
    }

    private static bool ItemAppliesToJourney(PreOpSectionItem item, PatientJourney journey)
    {
        if (item.ItemKey == "xray_ga_cases")
        {
            var anaes = journey.AnaesthesiaType ?? "";
            return anaes.Contains("General", StringComparison.OrdinalIgnoreCase)
                   || anaes.Contains("GA", StringComparison.OrdinalIgnoreCase);
        }

        if (!string.IsNullOrWhiteSpace(item.SurgeryTypeFilter))
        {
            var proc = journey.ProcedureName ?? "";
            return item.SurgeryTypeFilter
                .Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
                .Any(f => proc.Contains(f, StringComparison.OrdinalIgnoreCase));
        }

        return true;
    }

    private async Task<WardInvestigationChecklistDto> BuildDtoAsync(
        PatientJourney journey, Guid clearanceId, Guid tenantId)
    {
        var items = await (
            from cp in _db.PreOpCompletions
            join item in _db.PreOpSectionItems on cp.ItemId equals item.Id
            where cp.ClearanceId == clearanceId
                  && cp.DeletedAt == null
                  && item.FormCode == InvestigationFormCode
                  && item.FormContext == InvestigationFormContext
            orderby item.DisplayOrder
            select new { cp, item }
        ).ToListAsync();

        var dtos = items.Select(x => new WardInvestigationItemDto(
            x.item.Id,
            x.item.ItemKey,
            x.item.ItemLabel,
            x.item.Description,
            x.item.DisplayOrder,
            x.cp.IsCompleted,
            x.cp.IsBypassed,
            x.cp.Notes,
            x.cp.CompletedAt,
            x.cp.Source,
            ItemAppliesToJourney(x.item, journey))).ToList();

        var applicable = dtos.Where(i => i.AppliesToJourney).ToList();
        var completed  = applicable.Count(i => i.IsCompleted || i.IsBypassed);

        return new WardInvestigationChecklistDto(
            journey.Id,
            applicable.Count,
            completed,
            journey.AnaesthesiaType,
            dtos);
    }

    private async Task<PatientJourney> RequireJourneyAsync(Guid journeyId, Guid tenantId)
    {
        return await _db.PatientJourneys
                   .FirstOrDefaultAsync(j => j.Id == journeyId
                                             && j.TenantId == tenantId
                                             && j.DeletedAt == null)
               ?? throw new KeyNotFoundException($"Journey {journeyId} not found.");
    }
}
