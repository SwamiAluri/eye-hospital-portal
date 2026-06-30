using Microsoft.EntityFrameworkCore;
using Npgsql;

using IpManagementService.Data;

using IpManagementService.Models.Domain;

using IpManagementService.Models.Dtos;



namespace IpManagementService.Services;



/// <summary>

/// Outpatient Safety Checklist at Counsellor Desk (Form 1 — Outpatient section).

/// Stored against counseling_session_id; copied to ward pre_op_completions on clearance init.

/// </summary>

public class CounsellorChecklistService

{

    public const string OutpatientFormCode    = "OUTPATIENT_SAFETY";
    public const string OutpatientFormContext = "counsellor";

    public const string InvestigationFormCode    = "COUNSELLOR_INVESTIGATION_PREOP";
    public const string InvestigationFormContext = "counsellor_investigation";

    /// <summary>Counsellor pre-op investigation item_key → ward §1 item_key (1:1).</summary>
    public static readonly IReadOnlyDictionary<string, string> CounsellorInvestigationToWardItemKeys =
        new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase)
        {
            ["couns_preop_blood_sugar"]       = "blood_sugar",
            ["couns_preop_serum_creatinine"]  = "serum_creatinine",
            ["couns_preop_blood_urea"]        = "blood_urea",
            ["couns_preop_hiv_done"]          = "hiv_done",
            ["couns_preop_hba1c_done"]        = "hba1c_done",
            ["couns_preop_hemoglobin"]        = "hemoglobin",
            ["couns_preop_ascan_done"]        = "ascan_done",
            ["couns_preop_hbsag_done"]        = "hbsag_done",
            ["couns_preop_hcv_done"]          = "hcv_done",
        };

    /// <summary>Outpatient item_key → ward / investigation item_keys for semantic copy.</summary>

    public static readonly IReadOnlyDictionary<string, string[]> OutpatientToWardItemKeys =

        new Dictionary<string, string[]>(StringComparer.OrdinalIgnoreCase)

        {

            ["outpatient_ascan_confirmed"]      = ["ward_ascan_confirmed", "ascan_done"],

            ["outpatient_informed_consent"]     = ["consent_patient_signed", "consent_confirmed"],

            ["outpatient_serology_blood_tests"] = ["investigation_reports_available", "hiv_done", "blood_urea", "serum_creatinine", "blood_sugar"],

            ["physician_cardiac_fitness"]       = ["physician_fitness"],

            ["other_eye_fundus_seen"]           = ["investigation_reports_available"],

            ["conj_culture_done"]               = ["investigation_reports_available"],

            ["one_eye_culture"]                 = ["investigation_reports_available"],

            ["patient_risk_labels"]             = ["known_allergies_documented"],

            ["anticoagulant_stopped"]           = ["preop_medication_given"],

            ["mo_advice_confirmed"]             = ["patient_identity_confirmed"],

            ["preop_hygiene_instructions"]      = ["vitals_checked"],

        };



    private readonly IpManagementDbContext _db;



    public CounsellorChecklistService(IpManagementDbContext db) => _db = db;



    public async Task<CounsellorOutpatientChecklistDto> GetOutpatientChecklistAsync(

        Guid counselingSessionId, Guid tenantId)

    {

        var items = await GetOutpatientCatalogAsync(tenantId);



        var completions = await _db.CounsellorChecklistCompletions

            .Where(c => c.CounselingSessionId == counselingSessionId

                        && c.TenantId == tenantId

                        && c.DeletedAt == null)

            .ToDictionaryAsync(c => c.ItemId);



        var dtos = items.Select(item =>

        {

            completions.TryGetValue(item.Id, out var comp);

            return new CounsellorOutpatientItemDto(

                item.Id,

                item.ItemKey,

                item.ItemLabel,

                item.Description,

                item.DisplayOrder,

                comp?.IsCompleted ?? false,

                comp?.IsBypassed ?? false,

                comp?.Notes,

                comp?.CompletedAt,

                comp?.CompletedByRole);

        }).ToList();



        var completed = dtos.Count(i => i.IsCompleted || i.IsBypassed);



        return new CounsellorOutpatientChecklistDto(

            counselingSessionId,

            dtos.Count,

            completed,

            dtos);

    }



    public async Task<CounsellorOutpatientChecklistDto> SaveCompletionAsync(

        Guid counselingSessionId,

        Guid itemId,

        Guid tenantId,

        Guid userId,

        SaveCounsellorCompletionRequest req,

        string? completedByRole = null)

    {

        var item = await _db.PreOpSectionItems

            .FirstOrDefaultAsync(i => i.Id == itemId

                                      && i.FormCode == OutpatientFormCode

                                      && i.DeletedAt == null

                                      && i.IsActive)

            ?? throw new KeyNotFoundException($"Outpatient checklist item {itemId} not found.");



        var existing = await _db.CounsellorChecklistCompletions

            .FirstOrDefaultAsync(c => c.CounselingSessionId == counselingSessionId

                                      && c.ItemId == itemId

                                      && c.TenantId == tenantId

                                      && c.DeletedAt == null);



        var now = DateTime.UtcNow;

        var done = req.IsCompleted || (req.IsBypassed ?? false);



        if (existing is null)

        {

            existing = new CounsellorChecklistCompletion

            {

                Id                  = Guid.NewGuid(),

                TenantId            = tenantId,

                CounselingSessionId = counselingSessionId,

                ItemId              = itemId,

                CreatedByUserId     = userId,

                CreatedAt           = now,

                Status              = "active",

            };

            _db.CounsellorChecklistCompletions.Add(existing);

        }



        existing.IsCompleted       = req.IsCompleted;

        existing.IsBypassed        = req.IsBypassed ?? false;

        existing.BypassReason      = req.BypassReason;

        existing.Notes             = req.Notes;

        existing.CompletedByUserId = done ? userId : null;

        existing.CompletedAt       = done ? now : null;

        existing.CompletedByRole   = done && item.ItemKey == "fellow_workup_done"

            ? completedByRole

            : existing.CompletedByRole;

        existing.UpdatedByUserId   = userId;

        existing.UpdatedAt         = now;



        await _db.SaveChangesAsync();



        return await GetOutpatientChecklistAsync(counselingSessionId, tenantId);
    }

    public async Task<CounsellorPreOpInvestigationChecklistDto> GetPreOpInvestigationChecklistAsync(
        Guid counselingSessionId, Guid tenantId)
    {
        var items = await GetInvestigationCatalogAsync(tenantId);

        var completions = await _db.CounsellorChecklistCompletions
            .Where(c => c.CounselingSessionId == counselingSessionId
                        && c.TenantId == tenantId
                        && c.DeletedAt == null)
            .ToDictionaryAsync(c => c.ItemId);

        var dtos = items.Select(item =>
        {
            completions.TryGetValue(item.Id, out var comp);
            var wardKey = InvestigationItemConfigHelper.GetWardTargetKey(item.ItemConfig, item.ItemKey)
                ?? CounsellorInvestigationToWardItemKeys.GetValueOrDefault(item.ItemKey, item.ItemKey);

            return new CounsellorPreOpInvestigationItemDto(
                item.Id,
                item.ItemKey,
                wardKey,
                item.ItemLabel,
                item.Description,
                item.DisplayOrder,
                comp?.ResultValue,
                comp?.ResultUnit,
                comp?.EntryStatus ?? "draft",
                comp?.Notes,
                comp?.UpdatedAt,
                InvestigationItemConfigHelper.GetDefaultUnit(item.ItemConfig),
                InvestigationItemConfigHelper.GetValueType(item.ItemConfig));
        }).ToList();

        var draftCount = dtos.Count(i => !string.IsNullOrWhiteSpace(i.ResultValue));

        return new CounsellorPreOpInvestigationChecklistDto(
            counselingSessionId,
            dtos.Count,
            draftCount,
            dtos);
    }

    public async Task<CounsellorPreOpInvestigationChecklistDto> SaveInvestigationResultAsync(
        Guid counselingSessionId,
        Guid itemId,
        Guid tenantId,
        Guid userId,
        SaveCounsellorInvestigationResultRequest req)
    {
        var item = await _db.PreOpSectionItems
            .FirstOrDefaultAsync(i => i.Id == itemId
                                      && i.FormCode == InvestigationFormCode
                                      && i.DeletedAt == null
                                      && i.IsActive)
            ?? throw new KeyNotFoundException($"Counsellor investigation item {itemId} not found.");

        var existing = await _db.CounsellorChecklistCompletions
            .FirstOrDefaultAsync(c => c.CounselingSessionId == counselingSessionId
                                      && c.ItemId == itemId
                                      && c.TenantId == tenantId
                                      && c.DeletedAt == null);

        var now = DateTime.UtcNow;
        var hasValue = !string.IsNullOrWhiteSpace(req.ResultValue);

        if (existing is null)
        {
            existing = new CounsellorChecklistCompletion
            {
                Id                  = Guid.NewGuid(),
                TenantId            = tenantId,
                CounselingSessionId = counselingSessionId,
                ItemId              = itemId,
                CreatedByUserId     = userId,
                CreatedAt           = now,
                Status              = "active",
            };
            _db.CounsellorChecklistCompletions.Add(existing);
        }

        existing.ResultValue     = hasValue ? req.ResultValue.Trim() : null;
        existing.ResultUnit      = hasValue ? req.ResultUnit?.Trim() : null;
        existing.EntryStatus     = "draft";
        existing.Notes           = req.Notes?.Trim();
        existing.IsCompleted     = hasValue;
        existing.IsBypassed      = false;
        existing.BypassReason    = null;
        existing.CompletedByUserId = hasValue ? userId : null;
        existing.CompletedAt     = hasValue ? now : null;
        existing.UpdatedByUserId = userId;
        existing.UpdatedAt       = now;

        await _db.SaveChangesAsync();

        return await GetPreOpInvestigationChecklistAsync(counselingSessionId, tenantId);
    }

    /// <summary>

    /// Copies counsellor outpatient completions into ward pre_op_completions after clearance init,

    /// including semantic mapping to Form 2 + WARD_INVESTIGATION_PREOP item keys.

    /// </summary>

    public async Task CopyOutpatientCompletionsToClearanceAsync(

        Guid counselingSessionId,

        Guid clearanceId,

        Guid tenantId,

        Guid userId)

    {

        var counsellorCompletions = await (

            from cc in _db.CounsellorChecklistCompletions

            join item in _db.PreOpSectionItems on cc.ItemId equals item.Id

            where cc.CounselingSessionId == counselingSessionId

                  && cc.TenantId == tenantId

                  && cc.DeletedAt == null

                  && (cc.IsCompleted || cc.IsBypassed || !string.IsNullOrWhiteSpace(cc.ResultValue))

            select new { cc, item }

        ).ToListAsync();



        if (counsellorCompletions.Count == 0)

            return;



        var wardCompletions = await _db.PreOpCompletions

            .Where(c => c.ClearanceId == clearanceId

                        && c.TenantId == tenantId

                        && c.DeletedAt == null)

            .ToListAsync();



        var wardByItemId = wardCompletions.ToDictionary(c => c.ItemId);

        var now          = DateTime.UtcNow;



        void ApplyCopy(PreOpCompletion ward, CounsellorChecklistCompletion cc)

        {

            if (ward.EntryStatus is "entered" or "verified")

                return;

            if (ward.Source == "ward" && (ward.IsCompleted || ward.IsBypassed))

                return;



            ward.IsCompleted            = cc.IsCompleted;

            ward.IsBypassed             = cc.IsBypassed;

            ward.BypassReason           = cc.BypassReason;

            ward.Notes                  = cc.Notes;

            if (!string.IsNullOrWhiteSpace(cc.ResultValue))
            {
                ward.ResultValue   = cc.ResultValue;
                ward.ResultUnit    = cc.ResultUnit;
                ward.EntryStatus   = "draft";
                ward.ResultSource  = "counsellor";
                ward.IsCompleted   = cc.IsCompleted || !string.IsNullOrWhiteSpace(cc.ResultValue);
            }

            ward.CompletedByUserId      = cc.CompletedByUserId;

            ward.CompletedAt            = cc.CompletedAt;

            ward.CompletedByRole        = cc.CompletedByRole;

            ward.Source                 = "copied_from_counsellor";

            ward.CopiedAt               = now;

            ward.CounsellorCompletionId = cc.Id;

            ward.UpdatedByUserId        = userId;

            ward.UpdatedAt              = now;

        }



        // Direct copy for matching outpatient item_ids (legacy path)

        foreach (var row in counsellorCompletions)

        {

            if (wardByItemId.TryGetValue(row.cc.ItemId, out var ward))

                ApplyCopy(ward, row.cc);

        }



        // Semantic mapping → ward checklist + investigation items

        var targetKeys = counsellorCompletions

            .Where(r => OutpatientToWardItemKeys.ContainsKey(r.item.ItemKey))

            .SelectMany(r => OutpatientToWardItemKeys[r.item.ItemKey])

            .Distinct(StringComparer.OrdinalIgnoreCase)

            .ToList();



        if (targetKeys.Count > 0)

        {

            var targetItems = await _db.PreOpSectionItems

                .Where(i => targetKeys.Contains(i.ItemKey)

                            && i.DeletedAt == null

                            && i.IsActive

                            && (i.FormCode == WardChecklistService.WardFormCode

                                || i.FormCode == WardInvestigationChecklistService.InvestigationFormCode))

                .ToListAsync();



            foreach (var row in counsellorCompletions)

            {

                if (!OutpatientToWardItemKeys.TryGetValue(row.item.ItemKey, out var mappedKeys))

                    continue;



                foreach (var target in targetItems.Where(t => mappedKeys.Contains(t.ItemKey, StringComparer.OrdinalIgnoreCase)))

                {

                    if (!wardByItemId.TryGetValue(target.Id, out var ward))

                    {

                        ward = new PreOpCompletion

                        {

                            Id              = Guid.NewGuid(),

                            TenantId        = tenantId,

                            ClearanceId     = clearanceId,

                            ItemId          = target.Id,

                            IsCompleted     = false,

                            IsBypassed      = false,

                            Source          = "ward",

                            CreatedByUserId = userId,

                            UpdatedByUserId = userId,

                            CreatedAt       = now,

                            UpdatedAt       = now,

                            Status          = "active",

                        };

                        _db.PreOpCompletions.Add(ward);

                        wardByItemId[target.Id] = ward;

                    }



                    ApplyCopy(ward, row.cc);

                }

            }

        }

        // Counsellor pre-op investigation drafts → ward §1 (1:1 by item key)
        var investigationTargetKeys = counsellorCompletions
            .Where(r => CounsellorInvestigationToWardItemKeys.ContainsKey(r.item.ItemKey)
                        && !string.IsNullOrWhiteSpace(r.cc.ResultValue))
            .Select(r => CounsellorInvestigationToWardItemKeys[r.item.ItemKey])
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .ToList();

        if (investigationTargetKeys.Count > 0)
        {
            var investigationTargets = await _db.PreOpSectionItems
                .Where(i => investigationTargetKeys.Contains(i.ItemKey)
                            && i.FormCode == WardInvestigationChecklistService.InvestigationFormCode
                            && i.DeletedAt == null
                            && i.IsActive)
                .ToListAsync();

            foreach (var row in counsellorCompletions)
            {
                if (string.IsNullOrWhiteSpace(row.cc.ResultValue)
                    || !CounsellorInvestigationToWardItemKeys.TryGetValue(row.item.ItemKey, out var wardKey))
                    continue;

                var target = investigationTargets.FirstOrDefault(t =>
                    t.ItemKey.Equals(wardKey, StringComparison.OrdinalIgnoreCase));
                if (target is null) continue;

                if (!wardByItemId.TryGetValue(target.Id, out var ward))
                {
                    ward = new PreOpCompletion
                    {
                        Id              = Guid.NewGuid(),
                        TenantId        = tenantId,
                        ClearanceId     = clearanceId,
                        ItemId          = target.Id,
                        IsCompleted     = false,
                        IsBypassed      = false,
                        Source          = "ward",
                        CreatedByUserId = userId,
                        UpdatedByUserId = userId,
                        CreatedAt       = now,
                        UpdatedAt       = now,
                        Status          = "active",
                    };
                    _db.PreOpCompletions.Add(ward);
                    wardByItemId[target.Id] = ward;
                }

                ApplyCopy(ward, row.cc);
            }
        }

        // RACE: this runs on every investigation/clearance read (init + RefreshCounsellorCopies)
        // for counselled patients, and inserts mapped ward/§1 completion rows. Concurrent readers
        // (investigations panel + readiness rollup) can both insert the same (clearance_id, item_id)
        // → 23505 on uq_preop_completion. Discard the loser's duplicate work; the winner already
        // applied the same copy and BuildDtoAsync re-reads the committed rows.
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

    private async Task<List<PreOpSectionItem>> GetInvestigationCatalogAsync(Guid tenantId)
    {
        return await _db.PreOpSectionItems
            .Where(i => i.FormCode == InvestigationFormCode
                        && i.FormContext == InvestigationFormContext
                        && (i.TenantId == null || i.TenantId == tenantId)
                        && i.DeletedAt == null
                        && i.IsActive)
            .OrderBy(i => i.DisplayOrder)
            .ToListAsync();
    }

    private async Task<List<PreOpSectionItem>> GetOutpatientCatalogAsync(Guid tenantId)

    {

        return await _db.PreOpSectionItems

            .Where(i => i.FormCode == OutpatientFormCode

                        && i.FormContext == OutpatientFormContext

                        && (i.TenantId == null || i.TenantId == tenantId)

                        && i.DeletedAt == null

                        && i.IsActive)

            .OrderBy(i => i.DisplayOrder)

            .ToListAsync();

    }

}


