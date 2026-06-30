using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using Npgsql;
using IpManagementService.Data;
using IpManagementService.Models.Domain;
using IpManagementService.Models.Dtos;

namespace IpManagementService.Services;

/// <summary>Form 4 — Ward post-op checklist (7 items + 2 Form 1 safety items).</summary>
public class WardPostOpChecklistService
{
    public const string WardPostOpFormCode       = "WARD_POSTOP";
    public const string WardPostOpSafetyFormCode = "WARD_POSTOP_SAFETY";
    public const string WardPostOpFormContext    = "ward_postop";

    private static readonly string[] PostOpFormCodes =
        [WardPostOpFormCode, WardPostOpSafetyFormCode];

    private readonly IpManagementDbContext           _db;
    private readonly PreOpClearanceService           _preOp;
    private readonly ChecklistPhaseStatusService   _phaseStatus;
    private readonly JourneyMutationGuardService _mutationGuard;

    public WardPostOpChecklistService(
        IpManagementDbContext db,
        PreOpClearanceService preOp,
        ChecklistPhaseStatusService phaseStatus,
        JourneyMutationGuardService mutationGuard)
    {
        _db            = db;
        _preOp         = preOp;
        _phaseStatus   = phaseStatus;
        _mutationGuard = mutationGuard;
    }

    public async Task<WardPostOpChecklistDto> GetChecklistAsync(
        Guid journeyId, Guid tenantId, Guid userId)
    {
        var journey = await RequireJourneyAsync(journeyId, tenantId);

        await _preOp.GetOrInitClearanceAsync(
            journeyId, tenantId, userId,
            new InitPreOpClearanceRequest(null, null));

        var clearance = await _db.PreOpClearances
            .FirstAsync(c => c.JourneyId == journeyId && c.TenantId == tenantId && c.DeletedAt == null);

        await EnsureCompletionRowsAsync(clearance.Id, tenantId, userId);
        await SyncAutoItemsAsync(journey, clearance.Id, tenantId, userId);

        return await BuildDtoAsync(journey, clearance.Id, tenantId);
    }

    public async Task<WardPostOpChecklistDto> SaveCompletionAsync(
        Guid journeyId, Guid itemId, Guid tenantId, Guid userId,
        SaveWardPostOpCompletionRequest req)
    {
        var journey = await RequireJourneyAsync(journeyId, tenantId);

        var item = await _db.PreOpSectionItems
            .FirstOrDefaultAsync(i => i.Id == itemId
                                      && PostOpFormCodes.Contains(i.FormCode!)
                                      && i.DeletedAt == null)
            ?? throw new KeyNotFoundException($"Post-op checklist item {itemId} not found.");

        await _preOp.SaveCompletionAsync(
            journeyId, tenantId, userId, itemId,
            new SavePreOpCompletionRequest(
                itemId,
                req.IsCompleted,
                req.IsBypassed ?? false,
                req.BypassReason,
                req.Notes,
                null));

        var refreshed = await RequireJourneyAsync(journeyId, tenantId);
        var clearance = await _db.PreOpClearances
            .FirstAsync(c => c.JourneyId == journeyId && c.TenantId == tenantId && c.DeletedAt == null);

        var dto = await BuildDtoAsync(refreshed, clearance.Id, tenantId);
        await SyncPhaseStatusAsync(journeyId, tenantId, refreshed, dto);
        return dto;
    }

    public async Task<WardPostOpChecklistDto> SaveIolStickerChecksAsync(
        Guid journeyId, Guid tenantId, Guid userId, SaveIolStickerChecksRequest req)
    {
        await _mutationGuard.EnsureMutableAsync(journeyId, tenantId);
        var journey = await RequireJourneyAsync(journeyId, tenantId);

        journey.WardPostopIolChecks = JsonSerializer.Serialize(new
        {
            barcodeScan     = req.BarcodeScan,
            stickerInFile   = req.StickerInFile,
            inventoryMatch  = req.InventoryMatch,
        });
        journey.UpdatedAt       = DateTime.UtcNow;
        journey.UpdatedByUserId = userId;
        await _db.SaveChangesAsync();

        await _preOp.GetOrInitClearanceAsync(
            journeyId, tenantId, userId,
            new InitPreOpClearanceRequest(null, null));

        var clearance = await _db.PreOpClearances
            .FirstAsync(c => c.JourneyId == journeyId && c.TenantId == tenantId && c.DeletedAt == null);

        // Optional: auto-complete IOL sticker item when any sub-check is done
        var iolItem = await _db.PreOpSectionItems
            .FirstOrDefaultAsync(i => i.ItemKey == "iol_power_sticker"
                                      && i.FormCode == WardPostOpFormCode
                                      && i.DeletedAt == null);
        if (iolItem != null)
        {
            var anyChecked = req.BarcodeScan || req.StickerInFile || req.InventoryMatch;
            await _preOp.SaveCompletionAsync(
                journeyId, tenantId, userId, iolItem.Id,
                new SavePreOpCompletionRequest(
                    iolItem.Id, anyChecked, false, null, null, null));
        }

        var refreshed = await RequireJourneyAsync(journeyId, tenantId);
        return await BuildDtoAsync(refreshed, clearance.Id, tenantId);
    }

    private async Task EnsureCompletionRowsAsync(Guid clearanceId, Guid tenantId, Guid userId)
    {
        var itemIds = await _db.PreOpSectionItems
            .Where(i => PostOpFormCodes.Contains(i.FormCode!)
                        && i.FormContext == WardPostOpFormContext
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
                Source          = "ward_postop",
                CreatedByUserId = userId,
                UpdatedByUserId = userId,
                CreatedAt       = now,
                UpdatedAt       = now,
                Status          = "active",
            });
        }

        if (itemIds.Any(id => !existing.Contains(id)))
        {
            // RACE: concurrent readers can both seed the same (clearance_id, item_id) rows
            // → 23505 on uq_preop_completion. Discard the duplicate insert; the winner's rows
            // are valid and BuildDtoAsync re-reads them.
            try
            {
                await _db.SaveChangesAsync();
            }
            catch (DbUpdateException ex)
                when (ex.InnerException is PostgresException pg && pg.SqlState == "23505")
            {
                _db.ChangeTracker.Clear();
            }
        }
    }

    private async Task SyncAutoItemsAsync(
        PatientJourney journey, Guid clearanceId, Guid tenantId, Guid userId)
    {
        var autoKeys = new List<(string Key, bool Done)>();
        if (journey.ReceivedFromOtAt.HasValue)
            autoKeys.Add(("patient_received_from_ot", true));
        if (journey.WardCheckoutAt.HasValue)
            autoKeys.Add(("ward_checkout_time", true));

        if (autoKeys.Count == 0) return;

        var items = await _db.PreOpSectionItems
            .Where(i => autoKeys.Select(a => a.Key).Contains(i.ItemKey)
                        && i.FormCode == WardPostOpFormCode
                        && i.DeletedAt == null)
            .ToListAsync();

        foreach (var (key, done) in autoKeys)
        {
            var item = items.FirstOrDefault(i => i.ItemKey == key);
            if (item is null || !done) continue;

            var cp = await _db.PreOpCompletions.FirstOrDefaultAsync(c =>
                c.ClearanceId == clearanceId && c.ItemId == item.Id && c.DeletedAt == null);
            if (cp is null || cp.IsCompleted) continue;

            cp.IsCompleted       = true;
            cp.CompletedByUserId = userId;
            cp.CompletedAt       = DateTime.UtcNow;
            cp.UpdatedAt         = DateTime.UtcNow;
            cp.UpdatedByUserId   = userId;
        }

        await _db.SaveChangesAsync();
    }

    private async Task<WardPostOpChecklistDto> BuildDtoAsync(
        PatientJourney journey, Guid clearanceId, Guid tenantId)
    {
        var items = await (
            from cp in _db.PreOpCompletions
            join item in _db.PreOpSectionItems on cp.ItemId equals item.Id
            where cp.ClearanceId == clearanceId
                  && cp.DeletedAt == null
                  && PostOpFormCodes.Contains(item.FormCode!)
                  && item.FormContext == WardPostOpFormContext
            orderby item.DisplayOrder
            select new { cp, item }
        ).ToListAsync();

        var isDayCare = string.Equals(journey.AdmissionType, "DayCare", StringComparison.OrdinalIgnoreCase);

        var dtos = items.Select(x => new WardPostOpItemDto(
            x.item.Id,
            x.item.ItemKey,
            x.item.ItemLabel,
            x.item.Description,
            x.item.FormCode,
            x.item.DisplayOrder,
            x.cp.IsCompleted,
            x.cp.IsBypassed,
            x.cp.Notes,
            x.cp.CompletedAt,
            isDayCare ? false : x.item.IsBlocking)).ToList();

        var completed = dtos.Count(i => i.IsCompleted || i.IsBypassed);

        return new WardPostOpChecklistDto(
            journey.Id,
            dtos.Count,
            completed,
            journey.SentToOtAt,
            journey.ReceivedFromOtAt,
            journey.WardCheckoutAt,
            ParseIolChecks(journey.WardPostopIolChecks),
            dtos);
    }

    private static IolStickerChecksDto ParseIolChecks(string? json)
    {
        if (string.IsNullOrWhiteSpace(json)) return new IolStickerChecksDto(false, false, false);
        try
        {
            using var doc = JsonDocument.Parse(json);
            var root = doc.RootElement;
            return new IolStickerChecksDto(
                root.TryGetProperty("barcodeScan", out var a) && a.GetBoolean(),
                root.TryGetProperty("stickerInFile", out var b) && b.GetBoolean(),
                root.TryGetProperty("inventoryMatch", out var c) && c.GetBoolean());
        }
        catch
        {
            return new IolStickerChecksDto(false, false, false);
        }
    }

    private async Task SyncPhaseStatusAsync(
        Guid journeyId, Guid tenantId, PatientJourney journey, WardPostOpChecklistDto dto)
    {
        var isDayCare = string.Equals(journey.AdmissionType, "DayCare", StringComparison.OrdinalIgnoreCase);
        var blocking  = dto.Items.Where(i => !isDayCare && i.IsBlockingEffective).ToList();
        var complete  = blocking.Count == 0 || blocking.All(i => i.IsCompleted || i.IsBypassed);
        await _phaseStatus.UpdateAsync(journeyId, tenantId, d => d["ward_postop_complete"] = complete);
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
