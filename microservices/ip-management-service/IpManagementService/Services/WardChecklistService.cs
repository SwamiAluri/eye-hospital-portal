using Microsoft.EntityFrameworkCore;
using IpManagementService.Data;
using IpManagementService.Models.Domain;
using IpManagementService.Models.Dtos;

namespace IpManagementService.Services;

/// <summary>
/// Form 2 — Ward Checklist (17 items). Uses pre_op_completions via clearance record.
/// Does not block admission (all items non-blocking).
/// </summary>
public class WardChecklistService
{
    public const string WardFormCode    = "WARD_CHECKLIST";
    public const string WardFormContext = "ward";

    private readonly IpManagementDbContext         _db;
    private readonly PreOpClearanceService         _preOp;
    private readonly ChecklistPhaseStatusService   _phaseStatus;

    public WardChecklistService(
        IpManagementDbContext db,
        PreOpClearanceService preOp,
        ChecklistPhaseStatusService phaseStatus)
    {
        _db          = db;
        _preOp       = preOp;
        _phaseStatus = phaseStatus;
    }

    public async Task<WardChecklistDto> GetWardChecklistAsync(
        Guid journeyId, Guid tenantId, Guid userId, string? paymentMode = null)
    {
        var journey = await RequireJourneyAsync(journeyId, tenantId);

        await _preOp.GetOrInitClearanceAsync(
            journeyId, tenantId, userId,
            new InitPreOpClearanceRequest(paymentMode, null));

        var clearance = await _db.PreOpClearances
            .FirstAsync(c => c.JourneyId == journeyId && c.TenantId == tenantId && c.DeletedAt == null);

        await EnsureWardCompletionRowsAsync(clearance.Id, tenantId, userId);

        return await BuildDtoAsync(journey, clearance.Id, tenantId);
    }

    public async Task<WardChecklistDto> SaveCompletionAsync(
        Guid journeyId,
        Guid itemId,
        Guid tenantId,
        Guid userId,
        SaveWardChecklistCompletionRequest req)
    {
        var journey = await RequireJourneyAsync(journeyId, tenantId);

        var item = await _db.PreOpSectionItems
            .FirstOrDefaultAsync(i => i.Id == itemId
                                      && i.FormCode == WardFormCode
                                      && i.DeletedAt == null)
            ?? throw new KeyNotFoundException($"Ward checklist item {itemId} not found.");

        await _preOp.SaveCompletionAsync(
            journeyId, tenantId, userId, itemId,
            new SavePreOpCompletionRequest(
                itemId,
                req.IsCompleted,
                req.IsBypassed ?? false,
                req.BypassReason,
                req.Notes,
                null));

        await ApplyItemSideEffectsAsync(journey, item.ItemKey, req.IsCompleted || (req.IsBypassed ?? false), userId);

        var refreshed = await RequireJourneyAsync(journeyId, tenantId);
        var clearance = await _db.PreOpClearances
            .FirstAsync(c => c.JourneyId == journeyId && c.TenantId == tenantId && c.DeletedAt == null);

        var dto = await BuildDtoAsync(refreshed, clearance.Id, tenantId);
        await SyncPhaseStatusAsync(journeyId, tenantId, dto);
        return dto;
    }

    private async Task SyncPhaseStatusAsync(Guid journeyId, Guid tenantId, WardChecklistDto dto)
    {
        var complete = dto.TotalItems > 0 && dto.CompletedItems >= dto.TotalItems;
        await _phaseStatus.UpdateAsync(journeyId, tenantId, d => d["ward_checklist_complete"] = complete);
    }

    private async Task EnsureWardCompletionRowsAsync(Guid clearanceId, Guid tenantId, Guid userId)
    {
        var wardItemIds = await _db.PreOpSectionItems
            .Where(i => i.FormCode == WardFormCode
                        && i.FormContext == WardFormContext
                        && (i.TenantId == null || i.TenantId == tenantId)
                        && i.DeletedAt == null
                        && i.IsActive)
            .Select(i => i.Id)
            .ToListAsync();

        var existingList = await _db.PreOpCompletions
            .Where(c => c.ClearanceId == clearanceId
                        && c.DeletedAt == null
                        && wardItemIds.Contains(c.ItemId))
            .Select(c => c.ItemId)
            .ToListAsync();
        var existing = existingList.ToHashSet();

        var now = DateTime.UtcNow;
        foreach (var itemId in wardItemIds.Where(id => !existing.Contains(id)))
        {
            _db.PreOpCompletions.Add(new PreOpCompletion
            {
                Id              = Guid.NewGuid(),
                TenantId        = tenantId,
                ClearanceId     = clearanceId,
                ItemId          = itemId,
                IsCompleted     = false,
                IsBypassed      = false,
                Source          = "ward",
                CreatedByUserId = userId,
                UpdatedByUserId = userId,
                CreatedAt       = now,
                UpdatedAt       = now,
                Status          = "active",
            });
        }

        if (wardItemIds.Any(id => !existing.Contains(id)))
            await _db.SaveChangesAsync();
    }

    private async Task ApplyItemSideEffectsAsync(
        PatientJourney journey, string itemKey, bool done, Guid userId)
    {
        var now = DateTime.UtcNow;

        if (itemKey == "ward_check_in_time")
            journey.WardCheckInAt = done ? (journey.WardCheckInAt ?? now) : null;
        else if (itemKey == "informed_surgeon_anaesthesia_ot")
            journey.InformedOtTeamAt = done ? (journey.InformedOtTeamAt ?? now) : null;

        journey.UpdatedAt       = now;
        journey.UpdatedByUserId = userId;
        await _db.SaveChangesAsync();
    }

    private async Task<WardChecklistDto> BuildDtoAsync(
        PatientJourney journey, Guid clearanceId, Guid tenantId)
    {
        var items = await (
            from cp in _db.PreOpCompletions
            join item in _db.PreOpSectionItems on cp.ItemId equals item.Id
            where cp.ClearanceId == clearanceId
                  && cp.DeletedAt == null
                  && item.FormCode == WardFormCode
                  && item.FormContext == WardFormContext
            orderby item.DisplayOrder
            select new { cp, item }
        ).ToListAsync();

        var dtos = items.Select(x => new WardChecklistItemDto(
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
            x.cp.CompletedByRole)).ToList();

        var completed = dtos.Count(i => i.IsCompleted || i.IsBypassed);

        return new WardChecklistDto(
            journey.Id,
            dtos.Count,
            completed,
            journey.FinancialState,
            journey.BalanceDue,
            journey.EmergencyFcApplied,
            journey.WardCheckInAt,
            journey.InformedOtTeamAt,
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
