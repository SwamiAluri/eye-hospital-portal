using Microsoft.EntityFrameworkCore;
using Npgsql;
using IpManagementService.Data;
using IpManagementService.Models.Domain;
using IpManagementService.Models.Dtos;

namespace IpManagementService.Services;

/// <summary>Form 1 — Ward Investigation Pre-op (WARD_INVESTIGATION_PREOP).</summary>
public class WardInvestigationChecklistService
{
    public const string InvestigationFormCode    = "WARD_INVESTIGATION_PREOP";
    public const string InvestigationFormContext = "ward_investigation";

    private readonly IpManagementDbContext         _db;
    private readonly PreOpClearanceService         _preOp;
    private readonly ChecklistPhaseStatusService   _phaseStatus;
    private readonly WardChecklistAutoSyncService  _wardSync;
    private readonly JourneyMutationGuardService _mutationGuard;

    public WardInvestigationChecklistService(
        IpManagementDbContext db,
        PreOpClearanceService preOp,
        ChecklistPhaseStatusService phaseStatus,
        WardChecklistAutoSyncService wardSync,
        JourneyMutationGuardService mutationGuard)
    {
        _db            = db;
        _preOp         = preOp;
        _phaseStatus   = phaseStatus;
        _wardSync      = wardSync;
        _mutationGuard = mutationGuard;
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

        await _preOp.RefreshCounsellorCopiesAsync(journeyId, tenantId, userId);

        return await BuildDtoAsync(journey, clearance.Id, tenantId);
    }

    public async Task<WardInvestigationSummaryDto> GetSummaryAsync(Guid journeyId, Guid tenantId, Guid userId)
    {
        var checklist = await GetChecklistAsync(journeyId, tenantId, userId);
        var items = checklist.Items
            .Where(i => i.AppliesToJourney)
            .Select(i => new WardInvestigationSummaryItemDto(
                i.ItemKey,
                i.ItemLabel,
                i.ResultValue,
                i.ResultUnit,
                i.EntryStatus,
                i.IsCritical,
                i.AppliesToJourney))
            .ToList();

        return new WardInvestigationSummaryDto(
            journeyId,
            items,
            checklist.UnverifiedCriticalKeys);
    }

    public async Task<IReadOnlyList<string>> GetUnverifiedCriticalWarningsAsync(
        Guid journeyId, Guid tenantId, Guid userId)
    {
        var checklist = await GetChecklistAsync(journeyId, tenantId, userId);
        return checklist.UnverifiedCriticalKeys
            .Select(k => $"Critical investigation '{k}' is not ward-verified.")
            .ToList();
    }

    public async Task<WardInvestigationChecklistDto> SaveCompletionAsync(
        Guid journeyId, Guid itemId, Guid tenantId, Guid userId,
        SaveWardInvestigationCompletionRequest req, string? completedByRole = null)
    {
        await RequireJourneyAsync(journeyId, tenantId);

        var item = await RequireInvestigationItemAsync(itemId);

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
        await _wardSync.SyncFromInvestigationsAsync(journeyId, tenantId, userId, dto);
        return dto;
    }

    public async Task<WardInvestigationChecklistDto> SaveResultAsync(
        Guid journeyId, Guid itemId, Guid tenantId, Guid userId,
        SaveWardInvestigationResultRequest req, string? completedByRole = null)
    {
        if (string.IsNullOrWhiteSpace(req.ResultValue))
            throw new ArgumentException("Result value is required.");

        await _mutationGuard.EnsureMutableAsync(journeyId, tenantId);
        await RequireInvestigationItemAsync(itemId);

        var clearance  = await RequireClearanceAsync(journeyId, tenantId);
        await EnsureCompletionRowsAsync(clearance.Id, tenantId, userId);

        var completion = await _db.PreOpCompletions
            .FirstOrDefaultAsync(c => c.ClearanceId == clearance.Id
                                      && c.ItemId == itemId
                                      && c.DeletedAt == null)
            ?? throw new KeyNotFoundException($"Completion for item {itemId} not found.");

        var trimmedValue = req.ResultValue.Trim();
        var valueChanged = !string.Equals(completion.ResultValue, trimmedValue, StringComparison.Ordinal);

        completion.ResultValue        = trimmedValue;
        completion.ResultUnit         = req.ResultUnit?.Trim();
        completion.ReferenceRange     = req.ReferenceRange?.Trim();
        completion.ResultFlag           = NormalizeResultFlag(req.ResultFlag);
        completion.ResultSource         = string.IsNullOrWhiteSpace(req.ResultSource)
                                          ? "manual_ward"
                                          : req.ResultSource.Trim();
        completion.ExternalReportNote   = req.ExternalReportNote?.Trim();
        completion.Notes                = req.Notes ?? completion.Notes;
        completion.IsCompleted          = true;
        completion.IsBypassed           = false;
        completion.BypassReason         = null;
        completion.CompletedByUserId    = userId;
        completion.CompletedByRole      = completedByRole;
        completion.CompletedAt          = DateTime.UtcNow;
        completion.EnteredByUserId      = userId;
        completion.EnteredAt            = DateTime.UtcNow;
        completion.EntryStatus          = "entered";
        completion.Source               = "ward_investigation";
        completion.UpdatedByUserId      = userId;
        completion.UpdatedAt            = DateTime.UtcNow;

        if (valueChanged && completion.VerifiedAt.HasValue)
        {
            completion.VerifiedByUserId = null;
            completion.VerifiedAt       = null;
        }

        await _db.SaveChangesAsync();

        var journey = await RequireJourneyAsync(journeyId, tenantId);
        var dto       = await BuildDtoAsync(journey, clearance.Id, tenantId);
        await SyncPhaseStatusAsync(journeyId, tenantId, dto);
        await _wardSync.SyncFromInvestigationsAsync(journeyId, tenantId, userId, dto);
        return dto;
    }

    // The UI sends abbreviated flags (H/L/N); the DB CHECK constraint
    // (pre_op_completions_result_flag_check) only accepts the full vocabulary.
    private static string? NormalizeResultFlag(string? flag) =>
        string.IsNullOrWhiteSpace(flag) ? null : flag.Trim().ToUpperInvariant() switch
        {
            "H" or "HIGH"     => "High",
            "L" or "LOW"      => "Low",
            "N" or "NORMAL"   => "Normal",
            "C" or "CRITICAL" => "Critical",
            _                 => null,
        };

    public async Task<WardInvestigationChecklistDto> VerifyAsync(
        Guid journeyId, Guid itemId, Guid tenantId, Guid userId,
        VerifyWardInvestigationRequest req, string? completedByRole = null)
    {
        await _mutationGuard.EnsureMutableAsync(journeyId, tenantId);
        await RequireInvestigationItemAsync(itemId);

        var clearance  = await RequireClearanceAsync(journeyId, tenantId);
        var completion = await _db.PreOpCompletions
            .FirstOrDefaultAsync(c => c.ClearanceId == clearance.Id
                                      && c.ItemId == itemId
                                      && c.DeletedAt == null)
            ?? throw new KeyNotFoundException($"Completion for item {itemId} not found.");

        if (string.IsNullOrWhiteSpace(completion.ResultValue))
            throw new InvalidOperationException("Cannot verify an investigation without a result value.");

        if (completion.EntryStatus == "verified")
            throw new InvalidOperationException("Investigation is already verified.");

        var now = DateTime.UtcNow;
        completion.EntryStatus       = "verified";
        completion.VerifiedByUserId  = userId;
        completion.VerifiedAt        = now;
        completion.IsCompleted       = true;
        completion.CompletedByUserId = userId;
        completion.CompletedByRole   = completedByRole;
        completion.CompletedAt     ??= now;
        if (!string.IsNullOrWhiteSpace(req.Notes))
            completion.Notes = req.Notes;
        completion.UpdatedByUserId   = userId;
        completion.UpdatedAt       = now;

        _db.JourneyAuditLogs.Add(JourneyClinicalAudit.Entry(
            tenantId, journeyId, userId, "InvestigationVerified", "Investigation",
            "entered", "verified", correlationId: completion.Id));
        await _db.SaveChangesAsync();

        var journey = await RequireJourneyAsync(journeyId, tenantId);
        var dto       = await BuildDtoAsync(journey, clearance.Id, tenantId);
        await SyncPhaseStatusAsync(journeyId, tenantId, dto);
        await _wardSync.SyncFromInvestigationsAsync(journeyId, tenantId, userId, dto);
        return dto;
    }

    public async Task<WardInvestigationChecklistDto> UploadDocumentAsync(
        Guid journeyId, Guid itemId, Guid tenantId, Guid userId,
        UploadInvestigationDocumentRequest req)
    {
        await _mutationGuard.EnsureMutableAsync(journeyId, tenantId);
        var item = await RequireInvestigationItemAsync(itemId);

        var clearance  = await RequireClearanceAsync(journeyId, tenantId);
        await EnsureCompletionRowsAsync(clearance.Id, tenantId, userId);

        var completion = await _db.PreOpCompletions
            .FirstOrDefaultAsync(c => c.ClearanceId == clearance.Id
                                      && c.ItemId == itemId
                                      && c.DeletedAt == null)
            ?? throw new KeyNotFoundException($"Completion for item {itemId} not found.");

        var bytes = Convert.FromBase64String(req.FileData);
        await using var stream = new MemoryStream(bytes);

        var docType = string.IsNullOrWhiteSpace(req.DocumentType)
            ? DocumentTypeForItemKey(item.ItemKey)
            : req.DocumentType;

        var doc = await _preOp.UploadDocumentAsync(
            journeyId, tenantId, userId,
            docType, req.FileName, req.ContentType, stream);

        completion.DocumentId      = doc.Id;
        completion.UpdatedByUserId = userId;
        completion.UpdatedAt       = DateTime.UtcNow;

        await _db.SaveChangesAsync();

        var journey = await RequireJourneyAsync(journeyId, tenantId);
        var dto       = await BuildDtoAsync(journey, clearance.Id, tenantId);
        await SyncPhaseStatusAsync(journeyId, tenantId, dto);
        return dto;
    }

    public async Task<InvestigationDocumentDto?> GetDocumentAsync(
        Guid journeyId, Guid itemId, Guid tenantId)
    {
        await RequireJourneyAsync(journeyId, tenantId);
        await RequireInvestigationItemAsync(itemId);

        var clearance  = await RequireClearanceAsync(journeyId, tenantId);
        var completion = await _db.PreOpCompletions
            .FirstOrDefaultAsync(c => c.ClearanceId == clearance.Id
                                      && c.ItemId == itemId
                                      && c.DeletedAt == null);

        if (completion?.DocumentId is null) return null;

        var doc = await _db.PreOpDocuments
            .FirstOrDefaultAsync(d => d.Id == completion.DocumentId
                                      && d.TenantId == tenantId
                                      && d.DeletedAt == null);

        if (doc is null) return null;

        return new InvestigationDocumentDto(
            doc.Id,
            doc.FileName,
            doc.FileUrl,
            doc.ContentType,
            doc.FileSizeBytes,
            doc.IsVerified);
    }

    public async Task ApplyIntegrationResultAsync(
        Guid journeyId, Guid itemId, Guid tenantId, Guid userId,
        string? resultValue, string? resultUnit, string? referenceRange, string? note)
    {
        if (string.IsNullOrWhiteSpace(resultValue))
        {
            await SaveCompletionAsync(
                journeyId, itemId, tenantId, userId,
                new SaveWardInvestigationCompletionRequest(true, false, null, note ?? "Auto-completed from integration"));
            return;
        }

        await SaveResultAsync(
            journeyId, itemId, tenantId, userId,
            new SaveWardInvestigationResultRequest(
                resultValue,
                resultUnit,
                referenceRange,
                null,
                "integration",
                note,
                note));
    }

    private async Task SyncPhaseStatusAsync(Guid journeyId, Guid tenantId, WardInvestigationChecklistDto dto)
    {
        var applicable = dto.Items.Where(i => i.AppliesToJourney).ToList();
        var complete   = applicable.Count > 0
                         && applicable.All(i => i.IsBypassed
                                                || (i.IsCompleted
                                                    && !string.IsNullOrWhiteSpace(i.ResultValue)));
        var verifiedCount = applicable.Count(i =>
            i.IsBypassed
            || string.Equals(i.EntryStatus, "verified", StringComparison.OrdinalIgnoreCase));
        await _phaseStatus.UpdateInvestigationPhaseAsync(
            journeyId,
            tenantId,
            complete,
            verifiedCount,
            applicable.Count,
            dto.UnverifiedCriticalKeys);
    }

    private async Task EnsureCompletionRowsAsync(Guid clearanceId, Guid tenantId, Guid userId)
    {
        var itemIds = await _db.PreOpSectionItems
            .Where(i => i.FormCode == InvestigationFormCode
                        && i.FormContext == InvestigationFormContext
                        && (i.TenantId == null || i.TenantId == tenantId)
                        && i.DeletedAt == null
                        && i.IsActive
                        && i.Status == "active")
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
                EntryStatus     = "draft",
                Source          = "ward_investigation",
                CreatedByUserId = userId,
                UpdatedByUserId = userId,
                CreatedAt       = now,
                UpdatedAt       = now,
                Status          = "active",
            });
        }

        if (itemIds.Any(id => !existing.Contains(id)))
        {
            // RACE CONDITION: the workspace opens with multiple concurrent readers
            // (investigations panel + readiness rollup) that all lazily seed these rows.
            // Two requests can both read zero existing completions, then both INSERT the
            // same (clearance_id, item_id) pairs → 23505 unique violation on uq_preop_completion.
            // The winner's rows are valid; discard our duplicate insert and let BuildDtoAsync
            // re-read the seeded rows. Mirrors the clearance-creation guard in PreOpClearanceService.
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

    private static string DocumentTypeForItemKey(string itemKey) =>
        itemKey is "ascan_done" or "bscan_done" or "xray_ga_cases" or "ecg_done"
            ? "ImagingReport"
            : "LabReport";

    private async Task<WardInvestigationChecklistDto> BuildDtoAsync(
        PatientJourney journey, Guid clearanceId, Guid tenantId)
    {
        var rows = await (
            from cp in _db.PreOpCompletions
            join item in _db.PreOpSectionItems on cp.ItemId equals item.Id
            join doc in _db.PreOpDocuments on cp.DocumentId equals doc.Id into docJoin
            from doc in docJoin.DefaultIfEmpty()
            where cp.ClearanceId == clearanceId
                  && cp.DeletedAt == null
                  && item.FormCode == InvestigationFormCode
                  && item.FormContext == InvestigationFormContext
                  && item.IsActive
                  && item.Status == "active"
            orderby item.DisplayOrder
            select new { cp, item, doc }
        ).ToListAsync();

        // Resolve staff display names for entered/verified user ids (read-only users table).
        var userIds = rows
            .SelectMany(x => new[] { x.cp.EnteredByUserId, x.cp.VerifiedByUserId })
            .Where(id => id.HasValue)
            .Select(id => id!.Value)
            .Distinct()
            .ToList();

        var userNames = userIds.Count == 0
            ? new Dictionary<Guid, string>()
            : await _db.StaffUsers
                .Where(u => userIds.Contains(u.Id))
                .Select(u => new { u.Id, u.FirstName, u.LastName })
                .ToDictionaryAsync(
                    u => u.Id,
                    u => $"{u.FirstName} {u.LastName}".Trim());

        string? NameFor(Guid? id) =>
            id.HasValue && userNames.TryGetValue(id.Value, out var n) && !string.IsNullOrWhiteSpace(n)
                ? n
                : null;

        var dtos = rows.Select(x =>
        {
            var isCritical = InvestigationItemConfigHelper.IsCritical(x.item.ItemConfig, x.item.ItemKey);
            var entryStatus = string.IsNullOrWhiteSpace(x.cp.EntryStatus) ? "draft" : x.cp.EntryStatus;
            var counsellorDraft = entryStatus == "draft"
                                  && x.cp.Source == "copied_from_counsellor"
                                  && !string.IsNullOrWhiteSpace(x.cp.ResultValue);

            return new WardInvestigationItemDto(
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
                ItemAppliesToJourney(x.item, journey),
                x.cp.ResultValue,
                x.cp.ResultUnit,
                x.cp.ReferenceRange,
                x.cp.ResultFlag,
                x.cp.ResultSource,
                entryStatus,
                x.cp.EnteredByUserId,
                x.cp.EnteredAt,
                x.cp.VerifiedByUserId,
                x.cp.VerifiedAt,
                x.cp.DocumentId,
                x.doc?.FileName,
                x.doc?.FileUrl,
                x.cp.ExternalReportNote,
                isCritical,
                counsellorDraft,
                InvestigationItemConfigHelper.GetDefaultUnit(x.item.ItemConfig),
                InvestigationItemConfigHelper.GetValueType(x.item.ItemConfig),
                NameFor(x.cp.EnteredByUserId),
                NameFor(x.cp.VerifiedByUserId));
        }).ToList();

        var applicable = dtos.Where(i => i.AppliesToJourney).ToList();
        var completed  = applicable.Count(i =>
            i.IsBypassed || (i.IsCompleted && !string.IsNullOrWhiteSpace(i.ResultValue)));

        var unverifiedCritical = applicable
            .Where(i => i.IsCritical
                        && !string.IsNullOrWhiteSpace(i.ResultValue)
                        && i.EntryStatus != "verified")
            .Select(i => i.ItemKey)
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .ToList();

        return new WardInvestigationChecklistDto(
            journey.Id,
            applicable.Count,
            completed,
            journey.AnaesthesiaType,
            dtos,
            unverifiedCritical);
    }

    private async Task<PreOpSectionItem> RequireInvestigationItemAsync(Guid itemId)
        => await _db.PreOpSectionItems
               .FirstOrDefaultAsync(i => i.Id == itemId
                                         && i.FormCode == InvestigationFormCode
                                         && i.DeletedAt == null)
           ?? throw new KeyNotFoundException($"Investigation checklist item {itemId} not found.");

    private async Task<PreOpClearance> RequireClearanceAsync(Guid journeyId, Guid tenantId)
        => await _db.PreOpClearances
               .FirstOrDefaultAsync(c => c.JourneyId == journeyId
                                         && c.TenantId == tenantId
                                         && c.DeletedAt == null)
           ?? throw new KeyNotFoundException($"Pre-op clearance for journey {journeyId} not found.");

    private async Task<PatientJourney> RequireJourneyAsync(Guid journeyId, Guid tenantId)
        => await _db.PatientJourneys
               .FirstOrDefaultAsync(j => j.Id == journeyId
                                         && j.TenantId == tenantId
                                         && j.DeletedAt == null)
           ?? throw new KeyNotFoundException($"Journey {journeyId} not found.");
}
