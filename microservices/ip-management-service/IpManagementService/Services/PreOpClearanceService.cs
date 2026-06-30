using System.Globalization;
using Microsoft.EntityFrameworkCore;
using Npgsql;
using IpManagementService.Data;
using IpManagementService.Models.Domain;
using IpManagementService.Models.Dtos;

namespace IpManagementService.Services;

/// <summary>
/// Manages the Pre-Op Clearance workflow:
/// - Section items catalogue
/// - Clearance record lifecycle (init → approved/deferred)
/// - Checklist completion tracking (per item)
/// - Pre-op vitals (stored in vital_sign with context='PreOp')
/// - Document uploads via AzureBlobStorageService
/// - Multi-department section coordination (RequestSection / RespondToSection / ConfirmSection)
/// - Final approval: validates blocking items, transitions journey Expected → Admitted
///   (or bypassed via IsEmergency for urgent cases)
/// </summary>
public class PreOpClearanceService
{
    private readonly IpManagementDbContext    _db;
    private readonly IAzureBlobStorageService _blob;
    private readonly IPreOpNotificationClient _notify;
    private readonly CounsellorChecklistService _counsellorChecklist;
    private readonly WardChecklistAutoSyncService _wardSync;
    private readonly JourneyMutationGuardService _mutationGuard;

    public PreOpClearanceService(
        IpManagementDbContext    db,
        IAzureBlobStorageService blob,
        IPreOpNotificationClient notify,
        CounsellorChecklistService counsellorChecklist,
        WardChecklistAutoSyncService wardSync,
        JourneyMutationGuardService mutationGuard)
    {
        _db     = db;
        _blob   = blob;
        _notify = notify;
        _counsellorChecklist = counsellorChecklist;
        _wardSync = wardSync;
        _mutationGuard = mutationGuard;
    }

    // ── Section Items ──────────────────────────────────────────────────────────

    /// <summary>
    /// Returns the catalogue items relevant to this journey, filtered
    /// to the tenant's custom items and the global defaults.
    /// Optionally filtered by paymentMode for the Financial category.
    /// </summary>
    public async Task<List<PreOpSectionItemDto>> GetSectionItemsAsync(
        Guid tenantId, string? paymentMode = null)
    {
        // Fetch global defaults (tenant_id IS NULL) + tenant-specific overrides
        var items = await _db.PreOpSectionItems
            .Where(i => (i.TenantId == null || i.TenantId == tenantId)
                        && i.DeletedAt == null
                        && i.IsActive)
            .OrderBy(i => i.Category)
            .ThenBy(i => i.DisplayOrder)
            .ToListAsync();

        // Filter patient-type-specific items based on paymentMode
        items = items
            .Where(i => i.PatientTypeFilter == null
                        || (paymentMode != null && paymentMode
                            .Equals(i.PatientTypeFilter, StringComparison.OrdinalIgnoreCase)))
            .ToList();

        return items.Select(MapItem).ToList();
    }

    // ── Clearance ──────────────────────────────────────────────────────────────

    /// <summary>
    /// Ensures clearance exists and counsellor P0 completions are copied to ward.
    /// Call when a journey lands in Expected (list/detail/onboard) — not only on first ward tab open.
    /// </summary>
    public async Task EnsureJourneyOnboardedAsync(Guid journeyId, Guid tenantId, Guid userId)
    {
        await GetOrInitClearanceAsync(
            journeyId, tenantId, userId,
            new InitPreOpClearanceRequest(null, null));
    }

    /// <summary>
    /// Returns the clearance for this journey, creating it if it does not exist.
    /// Patient remains in Expected state throughout — admission is triggered only
    /// via ApprovePreOpAsync (or emergency admit with IsEmergency = true).
    /// </summary>
    public async Task<PreOpClearanceDto> GetOrInitClearanceAsync(
        Guid journeyId, Guid tenantId, Guid userId, InitPreOpClearanceRequest req)
    {
        var clearance = await _db.PreOpClearances
            .FirstOrDefaultAsync(c => c.JourneyId == journeyId
                                      && c.TenantId == tenantId
                                      && c.DeletedAt == null);

        // Resolve the payer once — prefer the caller's snapshot, else the journey's
        // own payment_mode (migration 146). Drives payer-specific row seeding.
        var journey = await _db.PatientJourneys
            .FirstOrDefaultAsync(j => j.Id == journeyId && j.TenantId == tenantId && j.DeletedAt == null);
        var effectivePaymentMode = !string.IsNullOrWhiteSpace(req.PaymentModeSnapshot)
            ? req.PaymentModeSnapshot
            : journey?.PaymentMode;

        if (clearance is null)
        {
            // First time — create the clearance row
            clearance = new PreOpClearance
            {
                Id                  = Guid.NewGuid(),
                TenantId            = tenantId,
                JourneyId           = journeyId,
                PaymentModeSnapshot = effectivePaymentMode,
                InsurancePreauthId  = req.InsurancePreauthId,
                OverallStatus       = "InProgress",
                OverallClearance    = false,
                IsDeferred          = false,
                CreatedByUserId     = userId,
                UpdatedByUserId     = userId,
                CreatedAt           = DateTime.UtcNow,
                UpdatedAt           = DateTime.UtcNow,
                Status              = "active",
            };
            _db.PreOpClearances.Add(clearance);

            // SAVE FIRST: persist clearance + audit log before seeding completions.
            // pre_op_completions has a FK → pre_op_clearance(id). Without an EF navigation property
            // configured, EF Core cannot determine insert order and may insert completion rows
            // before the clearance row exists in the DB → Postgres FK constraint violation.
            //
            // RACE CONDITION: In React StrictMode (dev) effects fire twice, so two concurrent
            // requests can both read null, then both attempt INSERT → 23505 unique violation.
            // We catch this and re-fetch the row the winning request just committed.
            try
            {
                await _db.SaveChangesAsync();
            }
            catch (DbUpdateException ex)
                when (ex.InnerException is PostgresException pg && pg.SqlState == "23505")
            {
                // Another concurrent request already created the clearance. Clear EF state
                // and return the existing row; completions were also seeded by the winner.
                _db.ChangeTracker.Clear();
                clearance = await _db.PreOpClearances
                    .FirstOrDefaultAsync(c => c.JourneyId == journeyId
                                              && c.TenantId == tenantId
                                              && c.DeletedAt == null);
                if (clearance is null) throw; // genuine error — re-throw original
                return MapClearance(clearance);
            }

            // Now fetch catalog items and seed per-item completion rows
            var catalogItems = await _db.PreOpSectionItems
                .Where(i => (i.TenantId == null || i.TenantId == tenantId)
                            && i.DeletedAt == null
                            && i.IsActive)
                .ToListAsync();

            // Filter by payment mode if applicable
            var paymentMode = effectivePaymentMode;
            var relevantItems = catalogItems
                .Where(i => i.FormContext != CounsellorChecklistService.OutpatientFormContext
                            && i.FormCode != WardChecklistService.WardFormCode
                            && i.FormCode != WardInvestigationChecklistService.InvestigationFormCode
                            && i.FormCode != WardPostOpChecklistService.WardPostOpFormCode
                            && i.FormCode != WardPostOpChecklistService.WardPostOpSafetyFormCode
                            && (i.PatientTypeFilter == null
                                || (paymentMode != null && paymentMode
                                    .Equals(i.PatientTypeFilter, StringComparison.OrdinalIgnoreCase))))
                .ToList();

            foreach (var item in relevantItems)
            {
                _db.PreOpCompletions.Add(new PreOpCompletion
                {
                    Id                = Guid.NewGuid(),
                    TenantId          = tenantId,
                    ClearanceId       = clearance.Id,
                    ItemId            = item.Id,
                    IsCompleted       = false,
                    IsBypassed        = false,
                    CreatedByUserId   = userId,
                    UpdatedByUserId   = userId,
                    CreatedAt         = DateTime.UtcNow,
                    UpdatedAt         = DateTime.UtcNow,
                    Status            = "active",
                });
            }

            await _db.SaveChangesAsync();

            // Copy counsellor outpatient checklist into ward completions (non-blocking)
            if (journey?.CounselingSessionId is Guid sessionId)
            {
                await _counsellorChecklist.CopyOutpatientCompletionsToClearanceAsync(
                    sessionId, clearance.Id, tenantId, userId);
            }
        }

        // Seed any payer-specific rows that are missing — covers in-flight journeys
        // whose clearance was created before the payer was known (idempotent).
        await EnsurePayerItemsSeededAsync(clearance, tenantId, userId, effectivePaymentMode);

        // Auto-track the department-owned Financial rows from canonical signals so the
        // ward never hand-enters them (payer ← counselling, advance ← billing).
        await EnsureFinancialDerivedAsync(clearance, journey, tenantId, userId);

        return MapClearance(clearance);
    }

    // Department-owned Financial rows that are derived from canonical signals, never
    // ticked by the ward: payment mode (counselling/registration) + advance (billing).
    private const string PaymentModeConfirmedKey = "payment_mode_confirmed";
    private const string AdvancePaidKey          = "advance_paid";

    /// <summary>
    /// Reconciles the two department-fed Financial completions with the journey's
    /// canonical financial signals so the ward sees a read-only, always-correct status:
    ///   • payment_mode_confirmed ← journey.PaymentMode is set (counselling/registration)
    ///   • advance_paid           ← journey.TotalAdvances/TotalPaid &gt; 0 (billing)
    /// Idempotent; runs on every clearance init/refresh.
    /// </summary>
    private async Task EnsureFinancialDerivedAsync(
        PreOpClearance clearance, PatientJourney? journey, Guid tenantId, Guid userId)
    {
        if (journey is null) return;

        var rows = await (
            from c in _db.PreOpCompletions
            join i in _db.PreOpSectionItems on c.ItemId equals i.Id
            where c.ClearanceId == clearance.Id
                  && c.TenantId == tenantId
                  && c.DeletedAt == null
                  && (i.ItemKey == PaymentModeConfirmedKey || i.ItemKey == AdvancePaidKey)
            select new { Completion = c, i.ItemKey }
        ).ToListAsync();

        if (rows.Count == 0) return;

        var paymentModeKnown = !string.IsNullOrWhiteSpace(journey.PaymentMode);
        var advanceReceived  = (journey.TotalAdvances ?? 0m) > 0m || (journey.TotalPaid ?? 0m) > 0m;

        var changed = false;
        foreach (var r in rows)
        {
            var desired = r.ItemKey == PaymentModeConfirmedKey ? paymentModeKnown : advanceReceived;
            var c = r.Completion;
            if (c.IsCompleted == desired) continue;

            c.IsCompleted     = desired;
            c.IsBypassed      = false;
            c.Source          = "system_derived";
            c.UpdatedByUserId = userId;
            c.UpdatedAt       = DateTime.UtcNow;
            if (desired)
            {
                c.CompletedAt   = DateTime.UtcNow;
                c.CompletedByRole = "system";
                c.Notes = r.ItemKey == PaymentModeConfirmedKey
                    ? $"Auto: payer {journey.PaymentMode}"
                    : "Auto: advance/payment recorded in billing";
            }
            else
            {
                c.CompletedAt = null;
            }
            changed = true;
        }

        if (changed) await _db.SaveChangesAsync();
    }

    /// <summary>
    /// Idempotently seeds the payer-specific Financial completion rows for a clearance
    /// once the payment mode is known. Also records the snapshot if it was missing.
    /// Safe to call on every init — only inserts rows that do not already exist.
    /// </summary>
    private async Task EnsurePayerItemsSeededAsync(
        PreOpClearance clearance, Guid tenantId, Guid userId, string? paymentMode)
    {
        if (string.IsNullOrWhiteSpace(paymentMode)) return;

        var changed = false;

        if (string.IsNullOrWhiteSpace(clearance.PaymentModeSnapshot))
        {
            clearance.PaymentModeSnapshot = paymentMode;
            clearance.UpdatedByUserId = userId;
            clearance.UpdatedAt = DateTime.UtcNow;
            changed = true;
        }

        var existingItemIds = await _db.PreOpCompletions
            .Where(c => c.ClearanceId == clearance.Id && c.DeletedAt == null)
            .Select(c => c.ItemId)
            .ToListAsync();

        // Payer-specific catalog items (PatientTypeFilter != null), excluding the
        // checklists owned by other forms — mirrors the first-seed filter above.
        var payerItems = await _db.PreOpSectionItems
            .Where(i => (i.TenantId == null || i.TenantId == tenantId)
                        && i.DeletedAt == null
                        && i.IsActive
                        && i.PatientTypeFilter != null
                        && i.FormContext != CounsellorChecklistService.OutpatientFormContext
                        && i.FormCode != WardChecklistService.WardFormCode
                        && i.FormCode != WardInvestigationChecklistService.InvestigationFormCode
                        && i.FormCode != WardPostOpChecklistService.WardPostOpFormCode
                        && i.FormCode != WardPostOpChecklistService.WardPostOpSafetyFormCode)
            .ToListAsync();

        var toSeed = payerItems
            .Where(i => paymentMode.Equals(i.PatientTypeFilter, StringComparison.OrdinalIgnoreCase)
                        && !existingItemIds.Contains(i.Id))
            .ToList();

        foreach (var item in toSeed)
        {
            _db.PreOpCompletions.Add(new PreOpCompletion
            {
                Id              = Guid.NewGuid(),
                TenantId        = tenantId,
                ClearanceId     = clearance.Id,
                ItemId          = item.Id,
                IsCompleted     = false,
                IsBypassed      = false,
                CreatedByUserId = userId,
                UpdatedByUserId = userId,
                CreatedAt       = DateTime.UtcNow,
                UpdatedAt       = DateTime.UtcNow,
                Status          = "active",
            });
            changed = true;
        }

        if (changed) await _db.SaveChangesAsync();
    }

    /// <summary>
    /// Re-applies counsellor outpatient completions onto ward clearance rows (e.g. after counsellor saves a draft).
    /// </summary>
    public async Task RefreshCounsellorCopiesAsync(Guid journeyId, Guid tenantId, Guid userId)
    {
        var clearance = await _db.PreOpClearances
            .FirstOrDefaultAsync(c => c.JourneyId == journeyId
                                      && c.TenantId == tenantId
                                      && c.DeletedAt == null);
        if (clearance is null) return;

        var journey = await _db.PatientJourneys
            .FirstOrDefaultAsync(j => j.Id == journeyId && j.TenantId == tenantId && j.DeletedAt == null);
        if (journey?.CounselingSessionId is not Guid sessionId) return;

        await _counsellorChecklist.CopyOutpatientCompletionsToClearanceAsync(
            sessionId, clearance.Id, tenantId, userId);
    }

    /// <summary>Returns the full clearance detail with completions, docs, and pre-op vitals.</summary>
    public async Task<PreOpClearanceDetailDto?> GetClearanceDetailAsync(Guid journeyId, Guid tenantId)
    {
        var clearance = await _db.PreOpClearances
            .FirstOrDefaultAsync(c => c.JourneyId == journeyId
                                      && c.TenantId == tenantId
                                      && c.DeletedAt == null);
        if (clearance is null) return null;

        var journey = await _db.PatientJourneys.AsNoTracking()
            .FirstOrDefaultAsync(j => j.Id == journeyId && j.TenantId == tenantId && j.DeletedAt == null);
        var clinicalState = journey?.ClinicalState ?? ClinicalState.Expected;

        // Completions joined to item metadata
        var completions = await (
            from cp in _db.PreOpCompletions
            join item in _db.PreOpSectionItems on cp.ItemId equals item.Id
            where cp.ClearanceId == clearance.Id && cp.DeletedAt == null
            select new { cp, item }
        ).ToListAsync();

        var documents = await _db.PreOpDocuments
            .Where(d => d.ClearanceId == clearance.Id && d.DeletedAt == null)
            .OrderBy(d => d.CreatedAt)
            .ToListAsync();

        var preOpVitals = await _db.VitalSigns
            .Where(v => v.JourneyId == journeyId
                        && v.TenantId == tenantId
                        && v.Context == "PreOp"
                        && v.DeletedAt == null)
            .OrderByDescending(v => v.RecordedAt)
            .Select(v => new VitalSignDto(
                v.Id, v.JourneyId, v.RecordedAt,
                v.Temperature, v.BloodPressureSystolic, v.BloodPressureDiastolic,
                v.PulseRate, v.RespiratoryRate, v.OxygenSaturation,
                v.Weight, v.Height, v.Notes, "PreOp",
                v.RecordedByUserId, v.CreatedAt))
            .ToListAsync();

        var completionDtos = MapDeptCompletionDtos(completions.Select(x => (x.cp, x.item)));

        var docDtos = documents.Select(MapDocument).ToList();

        // Structured consent signatory records (1:1 with consent completions), with
        // captured-by / surgeon names resolved from the read-only users table.
        var completionIds = completions.Select(x => x.cp.Id).ToList();
        var consentRows = await _db.PreOpConsentDetails
            .Where(d => completionIds.Contains(d.CompletionId))
            .ToListAsync();

        var consentUserIds = consentRows
            .SelectMany(d => new[] { d.CapturedByUserId, d.SurgeonUserId })
            .Where(g => g.HasValue).Select(g => g!.Value).Distinct().ToList();
        var consentNames = consentUserIds.Count == 0
            ? new Dictionary<Guid, string>()
            : await _db.StaffUsers
                .Where(u => consentUserIds.Contains(u.Id))
                .Select(u => new { u.Id, u.FirstName, u.LastName })
                .ToDictionaryAsync(u => u.Id, u => $"{u.FirstName} {u.LastName}".Trim());
        string? ConsentName(Guid? id) =>
            id.HasValue && consentNames.TryGetValue(id.Value, out var n) && !string.IsNullOrWhiteSpace(n) ? n : null;

        var consentDetailDtos = consentRows.Select(d => new PreOpConsentDetailDto(
            d.Id, d.CompletionId, d.PatientSigned, d.WitnessName, d.WitnessRelation,
            d.SurgeonUserId, ConsentName(d.SurgeonUserId), d.ConsentVersion, d.Method,
            d.SignedAt, d.CapturedByUserId, ConsentName(d.CapturedByUserId),
            d.RevokedAt, d.RevokedReason)).ToList();

        // Load section clearances (returns empty list if none requested yet)
        var sectionClearances = await _db.PreOpSectionClearances
            .Where(s => s.ClearanceId == clearance.Id && s.DeletedAt == null)
            .OrderBy(s => s.SectionCategory)
            .ToListAsync();

        var sectionClearanceDtos = sectionClearances
            .Select(s => SectionDisplayStatusHelper.MapSectionClearance(s, journeyId, clinicalState, completionDtos))
            .ToList();

        // Compute summary statistics
        var totalItems        = completionDtos.Count;
        var completedItems    = completionDtos.Count(c => c.IsCompleted || c.IsBypassed);
        var blockingIncomplete = completionDtos.Count(c => c.IsBlocking && !c.IsCompleted && !c.IsBypassed);
        var readyToAdmit      = blockingIncomplete == 0 && totalItems > 0;

        return new PreOpClearanceDetailDto(
            MapClearance(clearance),
            completionDtos,
            docDtos,
            preOpVitals,
            totalItems, completedItems, blockingIncomplete, readyToAdmit,
            sectionClearanceDtos, consentDetailDtos);
    }

    /// <summary>P2 dept-clearance rollup for ward list rows (R4.1).</summary>
    public async Task<Dictionary<Guid, (int Completed, int Total, bool NeedsAttention)>> GetP2RollupBatchAsync(
        IReadOnlyList<Guid> journeyIds, Guid tenantId)
    {
        if (journeyIds.Count == 0) return new Dictionary<Guid, (int, int, bool)>();

        var journeys = await _db.PatientJourneys.AsNoTracking()
            .Where(j => journeyIds.Contains(j.Id) && j.TenantId == tenantId && j.DeletedAt == null)
            .Select(j => new { j.Id, j.ClinicalState })
            .ToListAsync();

        var eligibleIds = journeys
            .Where(j => j.ClinicalState is ClinicalState.Expected
                                     or ClinicalState.Admitted
                                     or ClinicalState.ReadyForSurgery)
            .Select(j => j.Id)
            .ToList();

        if (eligibleIds.Count == 0) return new Dictionary<Guid, (int, int, bool)>();

        var clearances = await _db.PreOpClearances
            .Where(c => eligibleIds.Contains(c.JourneyId) && c.TenantId == tenantId && c.DeletedAt == null)
            .ToListAsync();

        var clearanceByJourney = clearances.ToDictionary(c => c.JourneyId);
        var clearanceIds = clearances.Select(c => c.Id).ToList();

        var sections = await _db.PreOpSectionClearances
            .Where(s => clearanceIds.Contains(s.ClearanceId) && s.DeletedAt == null)
            .ToListAsync();

        var completions = await (
            from cp in _db.PreOpCompletions
            join item in _db.PreOpSectionItems on cp.ItemId equals item.Id
            where clearanceIds.Contains(cp.ClearanceId) && cp.DeletedAt == null
            select new { cp, item }
        ).ToListAsync();

        var clinicalByJourney = journeys.ToDictionary(j => j.Id, j => j.ClinicalState);
        var result = new Dictionary<Guid, (int Completed, int Total, bool NeedsAttention)>();

        foreach (var journeyId in eligibleIds)
        {
            if (!clearanceByJourney.TryGetValue(journeyId, out var clearance)) continue;

            var clinicalState = clinicalByJourney[journeyId];
            var completionDtos = MapDeptCompletionDtos(
                completions
                    .Where(x => x.cp.ClearanceId == clearance.Id)
                    .Select(x => (x.cp, x.item)));

            var sectionDtos = sections
                .Where(s => s.ClearanceId == clearance.Id)
                .Select(s => SectionDisplayStatusHelper.MapSectionClearance(
                    s, journeyId, clinicalState, completionDtos))
                .ToList();

            var rollup = SectionDisplayStatusHelper.ComputeDeptRollup(sectionDtos, completionDtos);
            if (rollup.Total > 0)
                result[journeyId] = rollup;
        }

        return result;
    }

    // ── Completions ────────────────────────────────────────────────────────────

    /// <summary>Saves completion status for a single checklist item.</summary>
    public async Task<PreOpCompletionDto> SaveCompletionAsync(
        Guid journeyId, Guid tenantId, Guid userId,
        Guid itemId, SavePreOpCompletionRequest req,
        string? completedByRole = null)
    {
        await _mutationGuard.EnsureMutableAsync(journeyId, tenantId);
        var clearance = await RequireClearanceAsync(journeyId, tenantId);

        var existing = await _db.PreOpCompletions
            .FirstOrDefaultAsync(c => c.ClearanceId == clearance.Id
                                      && c.ItemId     == itemId
                                      && c.DeletedAt  == null);

        var done = req.IsCompleted || req.IsBypassed;

        if (existing is not null)
        {
            existing.IsCompleted       = req.IsCompleted;
            existing.IsBypassed        = req.IsBypassed;
            existing.BypassReason      = req.BypassReason;
            existing.Notes             = req.Notes;
            existing.DocumentId        = req.DocumentId ?? existing.DocumentId;
            existing.CompletedByUserId = done ? userId : null;
            existing.CompletedAt       = done ? DateTime.UtcNow : null;
            existing.CompletedByRole   = done ? completedByRole : null;
            if (done && existing.Source == "copied_from_counsellor")
                existing.Source = "ward";
            existing.UpdatedByUserId   = userId;
            existing.UpdatedAt         = DateTime.UtcNow;
        }
        else
        {
            existing = new PreOpCompletion
            {
                Id                 = Guid.NewGuid(),
                TenantId           = tenantId,
                ClearanceId        = clearance.Id,
                ItemId             = itemId,
                IsCompleted        = req.IsCompleted,
                IsBypassed         = req.IsBypassed,
                BypassReason       = req.BypassReason,
                Notes              = req.Notes,
                DocumentId         = req.DocumentId,
                CompletedByUserId  = done ? userId : null,
                CompletedAt        = done ? DateTime.UtcNow : null,
                CompletedByRole    = done ? completedByRole : null,
                Source             = "ward",
                CreatedByUserId    = userId,
                UpdatedByUserId    = userId,
                CreatedAt          = DateTime.UtcNow,
                UpdatedAt          = DateTime.UtcNow,
                Status             = "active",
            };
            _db.PreOpCompletions.Add(existing);
        }

        // Typed result columns (data governance): persist a structured value instead of
        // overloading Notes. For `last_food_time` this carries the ISO intake timestamp.
        if (req.ResultValue is not null)
        {
            var trimmed = string.IsNullOrWhiteSpace(req.ResultValue) ? null : req.ResultValue.Trim();
            existing.ResultValue     = trimmed;
            existing.ResultUnit      = string.IsNullOrWhiteSpace(req.ResultUnit) ? null : req.ResultUnit.Trim();
            existing.EntryStatus     = trimmed is null ? "draft" : "entered";
            existing.EnteredByUserId = trimmed is null ? null : userId;
            existing.EnteredAt       = trimmed is null ? null : DateTime.UtcNow;
        }

        await _db.SaveChangesAsync();

        var item = await _db.PreOpSectionItems
            .FirstOrDefaultAsync(i => i.Id == itemId)
            ?? throw new KeyNotFoundException($"PreOpSectionItem {itemId} not found.");

        // Server-authoritative fasting derivation (D5): entering the single NPO writer
        // recomputes `fasting_hours` + `fasting_confirmed` so the safety facts are never
        // trusted from the client. Clearing the time resets both.
        if (string.Equals(item.ItemKey, FastingLastFoodKey, StringComparison.Ordinal))
        {
            await CascadeFastingDerivationAsync(clearance.Id, item, req, tenantId, userId);
        }

        return new PreOpCompletionDto(
            existing.Id, existing.ClearanceId, existing.ItemId,
            item.ItemKey, item.ItemLabel, item.Category,
            item.IsBlocking, item.RequiresDocument,
            existing.IsCompleted, existing.IsBypassed, existing.BypassReason,
            existing.Notes, existing.DocumentId,
            existing.CompletedByUserId, existing.CompletedAt, existing.UpdatedAt,
            item.FormCode, existing.Source,
            existing.ResultValue, existing.ResultUnit, existing.EntryStatus,
            existing.EnteredAt, existing.CompletedByRole);
    }

    // ── Fasting & Medication: server-side derivation (D5) ─────────────────────────

    private const string FastingLastFoodKey      = "last_food_time";
    private const string FastingHoursKey         = "fasting_hours";
    private const string FastingConfirmedKey     = "fasting_confirmed";
    private const double FastingMinHoursDefault  = 6.0;   // light meal (ASA)
    private const double FastingMaxPlausibleHours = 24.0; // beyond this = stale/typo, never "confirmed"

    /// <summary>ASA-tiered fasting threshold derived from the intake type (ResultUnit).</summary>
    private static double FastingThresholdFor(string? intakeType) =>
        (intakeType ?? string.Empty).Trim().ToLowerInvariant() switch
        {
            "clear" or "clear_fluids" or "fluids" => 2.0,
            "solid" or "solids" or "heavy" or "fatty" => 8.0,
            _ => FastingMinHoursDefault,
        };

    /// <summary>Recompute and upsert the two derived fasting completions from the NPO writer.</summary>
    private async Task CascadeFastingDerivationAsync(
        Guid clearanceId, PreOpSectionItem lastFoodItem,
        SavePreOpCompletionRequest req, Guid tenantId, Guid userId)
    {
        var raw = !string.IsNullOrWhiteSpace(req.ResultValue) ? req.ResultValue : req.Notes;
        double? hours = null;
        if (!string.IsNullOrWhiteSpace(raw)
            && DateTime.TryParse(raw, CultureInfo.InvariantCulture,
                DateTimeStyles.AssumeLocal | DateTimeStyles.AdjustToUniversal, out var parsed))
        {
            hours = (DateTime.UtcNow - parsed.ToUniversalTime()).TotalHours;
        }

        var threshold = FastingThresholdFor(req.ResultUnit);
        var confirmed = hours.HasValue && hours.Value >= threshold && hours.Value <= FastingMaxPlausibleHours;

        await UpsertDerivedCompletionAsync(
            clearanceId, lastFoodItem, FastingHoursKey, tenantId, userId,
            isCompleted: hours.HasValue,
            resultValue: hours.HasValue ? hours.Value.ToString("0.0", CultureInfo.InvariantCulture) : null,
            resultUnit: hours.HasValue ? "h" : null);

        await UpsertDerivedCompletionAsync(
            clearanceId, lastFoodItem, FastingConfirmedKey, tenantId, userId,
            isCompleted: confirmed,
            resultValue: null, resultUnit: null);
    }

    /// <summary>Upsert a derived sibling completion (same form/category) for a given item key.</summary>
    private async Task UpsertDerivedCompletionAsync(
        Guid clearanceId, PreOpSectionItem sibling, string itemKey,
        Guid tenantId, Guid userId, bool isCompleted, string? resultValue, string? resultUnit)
    {
        var completion = await (
            from c in _db.PreOpCompletions
            join i in _db.PreOpSectionItems on c.ItemId equals i.Id
            where c.ClearanceId == clearanceId && c.DeletedAt == null && i.ItemKey == itemKey
            select c
        ).FirstOrDefaultAsync();

        if (completion is null)
        {
            var item = await _db.PreOpSectionItems.FirstOrDefaultAsync(i =>
                i.ItemKey == itemKey
                && i.Category == sibling.Category
                && i.FormCode == sibling.FormCode
                && i.FormContext == sibling.FormContext
                && i.DeletedAt == null
                && (i.TenantId == null || i.TenantId == tenantId));
            if (item is null) return; // derived row not configured for this tenant — skip safely

            completion = new PreOpCompletion
            {
                Id              = Guid.NewGuid(),
                TenantId        = tenantId,
                ClearanceId     = clearanceId,
                ItemId          = item.Id,
                CreatedByUserId = userId,
                CreatedAt       = DateTime.UtcNow,
                Status          = "active",
            };
            _db.PreOpCompletions.Add(completion);
        }

        var now = DateTime.UtcNow;
        completion.IsCompleted       = isCompleted;
        completion.IsBypassed        = false;
        completion.ResultValue       = resultValue;
        completion.ResultUnit        = resultUnit;
        completion.EntryStatus       = isCompleted ? "entered" : "draft";
        completion.CompletedByUserId = isCompleted ? userId : null;
        completion.CompletedAt       = isCompleted ? now : null;
        completion.CompletedByRole   = isCompleted ? "system" : null;
        completion.Source            = "derived";
        completion.UpdatedByUserId   = userId;
        completion.UpdatedAt         = now;

        await _db.SaveChangesAsync();
    }

    /// <summary>Batch-update completions in a single round-trip.</summary>
    public async Task<List<PreOpCompletionDto>> BatchSaveCompletionsAsync(
        Guid journeyId, Guid tenantId, Guid userId, BatchSavePreOpCompletionsRequest req)
    {
        var results = new List<PreOpCompletionDto>();
        foreach (var item in req.Items)
            results.Add(await SaveCompletionAsync(journeyId, tenantId, userId, item.ItemId, item));
        return results;
    }

    // ── Consent capture ──────────────────────────────────────────────────────────

    /// <summary>
    /// Captures a structured consent signatory record and marks the consent
    /// completion as done. Surgical consent (item key surgery_consent_signed) requires
    /// a linked signed document. Returns the refreshed clearance detail.
    /// </summary>
    public async Task<PreOpClearanceDetailDto?> CaptureConsentAsync(
        Guid journeyId, Guid tenantId, Guid userId,
        Guid itemId, CaptureConsentRequest req,
        string? completedByRole = null)
    {
        await _mutationGuard.EnsureMutableAsync(journeyId, tenantId);
        var clearance = await RequireClearanceAsync(journeyId, tenantId);

        var item = await _db.PreOpSectionItems
            .FirstOrDefaultAsync(i => i.Id == itemId)
            ?? throw new KeyNotFoundException($"PreOpSectionItem {itemId} not found.");

        if (!string.Equals(item.Category, "Consent", StringComparison.OrdinalIgnoreCase))
            throw new ArgumentException("This item is not a consent item.");

        var existing = await _db.PreOpCompletions
            .FirstOrDefaultAsync(c => c.ClearanceId == clearance.Id
                                      && c.ItemId    == itemId
                                      && c.DeletedAt == null);

        var documentId = req.DocumentId ?? existing?.DocumentId;

        // Surgical consent must have a signed document on file (medico-legal).
        if (item.ItemKey == "surgery_consent_signed" && documentId is null)
            throw new ArgumentException("A signed consent document is required to complete surgical consent.");

        var now = DateTime.UtcNow;

        if (existing is not null)
        {
            existing.IsCompleted       = true;
            existing.IsBypassed        = false;
            existing.BypassReason      = null;
            existing.DocumentId        = documentId;
            existing.Notes             = req.Notes ?? existing.Notes;
            existing.CompletedByUserId = userId;
            existing.CompletedByRole   = completedByRole;
            existing.CompletedAt       = now;
            if (existing.Source == "copied_from_counsellor") existing.Source = "ward";
            existing.UpdatedByUserId   = userId;
            existing.UpdatedAt         = now;
        }
        else
        {
            existing = new PreOpCompletion
            {
                Id                = Guid.NewGuid(),
                TenantId          = tenantId,
                ClearanceId       = clearance.Id,
                ItemId            = itemId,
                IsCompleted       = true,
                IsBypassed        = false,
                DocumentId        = documentId,
                Notes             = req.Notes,
                CompletedByUserId = userId,
                CompletedByRole   = completedByRole,
                CompletedAt       = now,
                Source            = "ward",
                CreatedByUserId   = userId,
                UpdatedByUserId   = userId,
                CreatedAt         = now,
                UpdatedAt         = now,
                Status            = "active",
            };
            _db.PreOpCompletions.Add(existing);
        }

        // Persist the completion first so the consent-detail FK is satisfiable.
        await _db.SaveChangesAsync();

        var detailRow = await _db.PreOpConsentDetails
            .FirstOrDefaultAsync(d => d.CompletionId == existing.Id);
        if (detailRow is null)
        {
            detailRow = new PreOpConsentDetail
            {
                Id           = Guid.NewGuid(),
                TenantId     = tenantId,
                CompletionId = existing.Id,
                CreatedAt    = now,
            };
            _db.PreOpConsentDetails.Add(detailRow);
        }

        detailRow.PatientSigned    = req.PatientSigned;
        detailRow.WitnessName      = string.IsNullOrWhiteSpace(req.WitnessName) ? null : req.WitnessName.Trim();
        detailRow.WitnessRelation  = string.IsNullOrWhiteSpace(req.WitnessRelation) ? null : req.WitnessRelation.Trim();
        detailRow.SurgeonUserId    = req.SurgeonUserId;
        detailRow.ConsentVersion   = string.IsNullOrWhiteSpace(req.ConsentVersion) ? null : req.ConsentVersion.Trim();
        detailRow.Method           = string.IsNullOrWhiteSpace(req.Method) ? "Upload" : req.Method.Trim();
        detailRow.SignedAt         = req.SignedAt ?? now;
        detailRow.CapturedByUserId = userId;
        // A fresh capture supersedes any prior revocation.
        detailRow.RevokedAt        = null;
        detailRow.RevokedReason    = null;
        detailRow.RevokedByUserId  = null;
        detailRow.UpdatedAt        = now;

        await _db.SaveChangesAsync();

        return await GetClearanceDetailAsync(journeyId, tenantId);
    }

    /// <summary>
    /// Revokes a previously captured consent: clears the completion and stamps the
    /// medico-legal revoke columns (who / when / why). The derived bedside ticks and
    /// the admit gate read the completion, so they flip automatically. Returns the
    /// refreshed clearance detail.
    /// </summary>
    public async Task<PreOpClearanceDetailDto?> RevokeConsentAsync(
        Guid journeyId, Guid tenantId, Guid userId,
        Guid itemId, RevokeConsentRequest req)
    {
        await _mutationGuard.EnsureMutableAsync(journeyId, tenantId);

        if (string.IsNullOrWhiteSpace(req.Reason))
            throw new ArgumentException("A reason is required to revoke consent.");

        var clearance = await RequireClearanceAsync(journeyId, tenantId);

        var item = await _db.PreOpSectionItems
            .FirstOrDefaultAsync(i => i.Id == itemId)
            ?? throw new KeyNotFoundException($"PreOpSectionItem {itemId} not found.");

        if (!string.Equals(item.Category, "Consent", StringComparison.OrdinalIgnoreCase))
            throw new ArgumentException("This item is not a consent item.");

        var completion = await _db.PreOpCompletions
            .FirstOrDefaultAsync(c => c.ClearanceId == clearance.Id
                                      && c.ItemId    == itemId
                                      && c.DeletedAt == null)
            ?? throw new KeyNotFoundException("No consent completion to revoke.");

        var now = DateTime.UtcNow;

        completion.IsCompleted     = false;
        completion.UpdatedByUserId = userId;
        completion.UpdatedAt       = now;

        var detailRow = await _db.PreOpConsentDetails
            .FirstOrDefaultAsync(d => d.CompletionId == completion.Id);
        if (detailRow is not null)
        {
            detailRow.RevokedAt       = now;
            detailRow.RevokedReason   = req.Reason.Trim();
            detailRow.RevokedByUserId = userId;
            detailRow.UpdatedAt       = now;
        }

        await _db.SaveChangesAsync();

        return await GetClearanceDetailAsync(journeyId, tenantId);
    }

    // ── Pre-Op Vitals ──────────────────────────────────────────────────────────

    public async Task<VitalSignDto> AddPreOpVitalAsync(
        Guid journeyId, Guid tenantId, Guid userId, AddPreOpVitalRequest req)
    {
        await _mutationGuard.EnsureMutableAsync(journeyId, tenantId);
        var vital = new VitalSign
        {
            Id                     = Guid.NewGuid(),
            TenantId               = tenantId,
            JourneyId              = journeyId,
            RecordedAt             = req.RecordedAt ?? DateTime.UtcNow,
            Temperature            = req.Temperature,
            BloodPressureSystolic  = req.BloodPressureSystolic,
            BloodPressureDiastolic = req.BloodPressureDiastolic,
            PulseRate              = req.PulseRate,
            RespiratoryRate        = req.RespiratoryRate,
            OxygenSaturation       = req.OxygenSaturation,
            Weight                 = req.Weight,
            Height                 = req.Height,
            Notes                  = req.Notes,
            Context                = "PreOp",
            RecordedByUserId       = userId,
            CreatedAt              = DateTime.UtcNow,
            UpdatedAt              = DateTime.UtcNow,
            Status                 = "active",
        };
        _db.VitalSigns.Add(vital);
        await _db.SaveChangesAsync();

        return new VitalSignDto(
            vital.Id, vital.JourneyId, vital.RecordedAt,
            vital.Temperature, vital.BloodPressureSystolic, vital.BloodPressureDiastolic,
            vital.PulseRate, vital.RespiratoryRate, vital.OxygenSaturation,
            vital.Weight, vital.Height, vital.Notes, "PreOp",
            vital.RecordedByUserId, vital.CreatedAt);
    }

    // ── Documents ──────────────────────────────────────────────────────────────

    /// <summary>
    /// Uploads a file to Azure Blob Storage and creates a PreOpDocument record.
    /// The blob name is: preop/{tenantId}/{journeyId}/{newGuid}/{sanitizedFileName}
    /// </summary>
    public async Task<PreOpDocumentDto> UploadDocumentAsync(
        Guid journeyId, Guid tenantId, Guid userId,
        string documentType, string fileName, string contentType,
        Stream fileContent)
    {
        await _mutationGuard.EnsureMutableAsync(journeyId, tenantId);
        var clearance = await RequireClearanceAsync(journeyId, tenantId);

        // Build a unique, path-structured blob name to avoid collisions
        var blobId   = Guid.NewGuid();
        var safeName = SanitizeFileName(fileName);
        var blobPath = $"preop/{tenantId}/{journeyId}/{blobId}/{safeName}";

        var (fileUrl, fileSizeBytes) = await _blob.UploadAsync(fileContent, blobPath, contentType);

        var doc = new PreOpDocument
        {
            Id               = blobId,
            TenantId         = tenantId,
            ClearanceId      = clearance.Id,
            DocumentType     = documentType,
            FileName         = fileName,
            FileUrl          = fileUrl,
            ContentType      = contentType,
            FileSizeBytes    = fileSizeBytes,
            IsVerified       = false,
            UploadedByUserId = userId,
            CreatedByUserId  = userId,
            UpdatedByUserId  = userId,
            CreatedAt        = DateTime.UtcNow,
            UpdatedAt        = DateTime.UtcNow,
            Status           = "active",
        };
        _db.PreOpDocuments.Add(doc);
        await _db.SaveChangesAsync();

        return MapDocument(doc);
    }

    /// <summary>Marks a document as verified (or unverified) by a doctor / admin.</summary>
    public async Task<PreOpDocumentDto> VerifyDocumentAsync(
        Guid journeyId, Guid tenantId, Guid userId,
        Guid documentId, VerifyPreOpDocumentRequest req)
    {
        await _mutationGuard.EnsureMutableAsync(journeyId, tenantId);
        var doc = await _db.PreOpDocuments
            .FirstOrDefaultAsync(d => d.Id == documentId
                                      && d.TenantId == tenantId
                                      && d.DeletedAt == null)
            ?? throw new KeyNotFoundException($"PreOpDocument {documentId} not found.");

        doc.IsVerified         = req.IsVerified;
        doc.VerifiedByUserId   = req.IsVerified ? userId : null;
        doc.VerifiedAt         = req.IsVerified ? DateTime.UtcNow : null;
        doc.Notes              = req.Notes ?? doc.Notes;
        doc.UpdatedByUserId    = userId;
        doc.UpdatedAt          = DateTime.UtcNow;

        await _db.SaveChangesAsync();
        return MapDocument(doc);
    }

    // ── Approval / Deferral ────────────────────────────────────────────────────

    /// <summary>
    /// Approves pre-op clearance and transitions the journey to Admitted.
    /// Validates all blocking items are complete before allowing admission.
    /// </summary>
    public async Task<PreOpClearanceDto> ApprovePreOpAsync(
        Guid journeyId, Guid tenantId, Guid userId, ApprovePreOpClearanceRequest req)
    {
        await _mutationGuard.EnsureMutableAsync(journeyId, tenantId);
        var clearance = await RequireClearanceAsync(journeyId, tenantId);
        var journey   = await RequireJourneyAsync(journeyId, tenantId);

        // Guard: only approve from Expected state
        if (journey.ClinicalState != ClinicalState.Expected)
        {
            throw new InvalidOperationException(
                $"Journey is in state '{journey.ClinicalState}'; cannot approve pre-op clearance.");
        }

        // Check all blocking items are complete (or bypassed) — skip for emergency admits
        if (!req.IsEmergency)
        {
            var blockingIncompleteCount = await (
                from cp in _db.PreOpCompletions
                join item in _db.PreOpSectionItems on cp.ItemId equals item.Id
                where cp.ClearanceId == clearance.Id
                      && item.IsBlocking
                      && !cp.IsCompleted
                      && !cp.IsBypassed
                      && cp.DeletedAt == null
                select cp.Id
            ).CountAsync();

            if (blockingIncompleteCount > 0)
                throw new InvalidOperationException(
                    $"{blockingIncompleteCount} blocking pre-op item(s) are incomplete. " +
                    "Complete or bypass all blocking items before approving, or use emergency admit.");

            // P1: Gate — reject admission if any section clearances are still unresolved
            var unresolvedSections = await _db.PreOpSectionClearances
                .Where(s => s.ClearanceId == clearance.Id
                            && new[] { "Requested", "OnHold", "NeedsInfo", "Escalated", "RespondedConcerns" }
                                .Contains(s.Status)
                            && s.DeletedAt == null)
                .Select(s => s.SectionCategory)
                .ToListAsync();

            if (unresolvedSections.Count > 0)
                throw new InvalidOperationException(
                    $"Cannot admit patient: {unresolvedSections.Count} pre-op section(s) unresolved — " +
                    string.Join(", ", unresolvedSections) +
                    ". Resolve all sections or use emergency override.");
        }
        else
        {
            // P2: Emergency bypass — auto-create follow-up tasks for high-risk sections
            var highRiskCategories = new[] { "Anaesthesia", "Consent", "Financial" };
            var bypassedSections = await _db.PreOpSectionClearances
                .Where(s => s.ClearanceId == clearance.Id
                            && highRiskCategories.Contains(s.SectionCategory)
                            && new[] { "Requested", "OnHold", "NeedsInfo", "Escalated",
                                       "RespondedConcerns", "NotRequested" }
                                .Contains(s.Status)
                            && s.DeletedAt == null)
                .ToListAsync();

            if (bypassedSections.Count > 0)
            {
                var now = DateTime.UtcNow;
                foreach (var section in bypassedSections)
                {
                    _db.PreOpFollowUpTasks.Add(new PreOpFollowUpTask
                    {
                        TenantId         = tenantId,
                        ClearanceId      = clearance.Id,
                        PatientJourneyId = journeyId,
                        SectionCategory  = section.SectionCategory,
                        ItemKey          = $"{section.SectionCategory}_bypass_followup",
                        ItemLabel        = $"[Emergency Bypass] {section.SectionCategory} — follow up before discharge",
                        BypassReason     = req.ClearanceNotes ?? "Emergency admission override",
                        Urgency          = "High",
                        DueBy            = now.AddHours(24),
                        TaskStatus       = "Pending",
                        CreatedByUserId  = userId,
                        UpdatedByUserId  = userId,
                        CreatedAt        = now,
                        UpdatedAt        = now,
                    });
                }
            }
        }

        var prevSnapshot    = SnapshotClinical(journey.ClinicalState);
        var prevClinical    = journey.ClinicalState;

        // Validate and apply clinical transition → Admitted
        StateTransitionValidator.ValidateClinical(journey.ClinicalState, ClinicalState.Admitted);

        // Apply admission fields to journey (mirrors PatientJourneyService.AdmitAsync)
        journey.ClinicalState          = ClinicalState.Admitted;
        journey.WardId                 = req.WardId ?? journey.WardId;
        journey.AdmissionType          = req.AdmissionType ?? journey.AdmissionType;
        journey.AdmittingDoctorId      = req.AdmittingDoctorId ?? journey.AdmittingDoctorId;
        journey.BedNumber              = req.BedNumber ?? journey.BedNumber;
        journey.RoomNumber             = req.RoomNumber ?? journey.RoomNumber;
        journey.AttendantName          = req.AttendantName ?? journey.AttendantName;
        journey.AttendantPhone         = req.AttendantPhone ?? journey.AttendantPhone;
        journey.AttendantRelationship  = req.AttendantRelationship ?? journey.AttendantRelationship;
        journey.PrimaryNurseId         = req.PrimaryNurseId ?? journey.PrimaryNurseId;
        if (req.PrimarySurgeonId.HasValue) journey.PrimarySurgeonId = req.PrimarySurgeonId;
        journey.AdmittedAt             = DateTime.UtcNow;
        journey.UpdatedAt              = DateTime.UtcNow;
        journey.UpdatedByUserId        = userId;

        // Mark clearance as approved
        clearance.OverallStatus     = "ClearedForAdmission";
        clearance.OverallClearance  = true;
        clearance.ClearedAt         = DateTime.UtcNow;
        clearance.ClearedByUserId   = userId;
        clearance.ClearanceNotes    = req.ClearanceNotes ?? clearance.ClearanceNotes;
        clearance.UpdatedByUserId   = userId;
        clearance.UpdatedAt         = DateTime.UtcNow;

        // Audit log
        _db.JourneyAuditLogs.Add(new JourneyAuditLog
        {
            TenantId          = tenantId,
            PatientJourneyId  = journeyId,
            Action            = "PreOpClearanceApproved",
            StateType         = "ClinicalState",
            OldValue          = prevClinical,
            NewValue          = ClinicalState.Admitted,
            PreviousState     = prevSnapshot,
            NewState          = SnapshotClinical(ClinicalState.Admitted),
            PerformedByUserId = userId,
            PerformedAt       = DateTime.UtcNow,
            CreatedAt         = DateTime.UtcNow,
            UpdatedAt         = DateTime.UtcNow,
        });

        await _db.SaveChangesAsync();
        return MapClearance(clearance);
    }

    /// <summary>Defers the pre-op clearance without cancelling the journey.</summary>
    public async Task<PreOpClearanceDto> DeferPreOpAsync(
        Guid journeyId, Guid tenantId, Guid userId, DeferPreOpClearanceRequest req)
    {
        await _mutationGuard.EnsureMutableAsync(journeyId, tenantId);
        var clearance = await RequireClearanceAsync(journeyId, tenantId);

        clearance.IsDeferred      = true;
        clearance.DeferredReason  = req.DeferredReason;
        clearance.OverallStatus   = "Deferred";
        clearance.UpdatedByUserId = userId;
        clearance.UpdatedAt       = DateTime.UtcNow;

        await _db.SaveChangesAsync();
        return MapClearance(clearance);
    }

    // ── Section Clearance Methods ─────────────────────────────────────────────

    public async Task<PreOpSectionClearanceDto> RequestSectionAsync(
        Guid journeyId, Guid tenantId, Guid userId, string category, string urgency = "Normal")
    {
        await _mutationGuard.EnsureMutableAsync(journeyId, tenantId);
        var clearance = await RequireClearanceAsync(journeyId, tenantId);

        var existing = await _db.PreOpSectionClearances
            .FirstOrDefaultAsync(s => s.ClearanceId == clearance.Id
                                      && s.SectionCategory == category
                                      && s.DeletedAt == null);

        // Map checklist categories to responsible department codes.
        // Categories: Compliance, Vitals, Lab Tests, Diagnostic Imaging, Evaluation,
        //             Anaesthesia, Consent, Pharmacy Preparation, Financial, OT Preparation, Documents
        var deptCode = category switch
        {
            "Compliance"            => "STD_NURSE",
            "Vitals"                => "STD_NURSE",
            "Lab Tests"             => "STD_LABORATORY",
            "Investigations"        => "STD_LABORATORY",   // legacy alias
            "Diagnostic Imaging"    => "STD_IMAGING",
            "Evaluation"            => "STD_DOCTOR",
            "Anaesthesia"           => "STD_DOCTOR",
            "Consent"               => "STD_COUNSELOR",
            "Pharmacy Preparation"  => "STD_PHARMACY",
            "Financial"             => "STD_BILLING",
            "OT Preparation"        => "STD_INVENTORY",
            "Documents"             => "STD_ADMIN",
            _                       => "STD_ADMIN"
        };

        if (existing == null)
        {
            existing = new PreOpSectionClearance
            {
                Id                      = Guid.NewGuid(),
                TenantId                = tenantId,
                ClearanceId             = clearance.Id,
                SectionCategory         = category,
                ResponsibleDepartmentCode = deptCode,
                Status                  = "Requested",
                RequestedByUserId       = userId,
                RequestedAt             = DateTime.UtcNow,
                Urgency                 = urgency,
                CreatedByUserId         = userId,
                UpdatedByUserId         = userId,
                CreatedAt               = DateTime.UtcNow,
                UpdatedAt               = DateTime.UtcNow
            };
            _db.PreOpSectionClearances.Add(existing);
        }
        else
        {
            existing.Status           = "Requested";
            existing.RequestedByUserId = userId;
            existing.RequestedAt      = DateTime.UtcNow;
            existing.Urgency          = urgency;
            existing.RejectionReason  = null; // clear any prior rejection
            existing.UpdatedByUserId  = userId;
            existing.UpdatedAt        = DateTime.UtcNow;
        }

        await _db.SaveChangesAsync();

        // Fire-and-forget — notify all responsible dept users via auth service SignalR
        _ = _notify.NotifyDepartmentAsync(
            tenantId, null, deptCode,
            "PreOpSectionRequest",
            $"Pre-op section '{category}' requires your clearance",
            $"JourneyId: {journeyId}");

        return await MapSectionClearanceForJourneyAsync(existing, journeyId, tenantId);
    }

    public async Task<PreOpSectionClearanceDto> RespondToSectionAsync(
        Guid journeyId, Guid tenantId, Guid userId, string category, RespondPreOpSectionRequest req)
    {
        await _mutationGuard.EnsureMutableAsync(journeyId, tenantId);
        var clearance = await RequireClearanceAsync(journeyId, tenantId);

        var section = await _db.PreOpSectionClearances
            .FirstOrDefaultAsync(s => s.ClearanceId == clearance.Id
                                      && s.SectionCategory == category
                                      && s.DeletedAt == null)
            ?? throw new KeyNotFoundException(
                $"Section '{category}' has not been requested for journey {journeyId}.");

        section.Status              = req.ResponseStatus; // "RespondedClear" | "RespondedConcerns"
        section.RespondedByUserId   = userId;
        section.RespondedAt         = DateTime.UtcNow;
        section.ResponseNotes       = req.ResponseNotes;
        section.IsExternalResponder = req.IsExternalResponder;
        section.ExternalResponderName    = req.IsExternalResponder ? req.ExternalResponderName : null;
        section.ExternalResponderContact = req.IsExternalResponder ? req.ExternalResponderContact : null;
        section.UpdatedByUserId     = userId;
        section.UpdatedAt           = DateTime.UtcNow;

        await _db.SaveChangesAsync();

        // Fire-and-forget — notify the ward user who originally requested this section
        if (section.RequestedByUserId.HasValue)
        {
            _ = _notify.NotifyUserAsync(
                tenantId, section.RequestedByUserId.Value,
                "PreOpSectionResponse",
                $"Pre-op '{category}' section has been updated",
                $"{req.ResponseStatus}: {req.ResponseNotes ?? "No notes provided"}");
        }

        return await MapSectionClearanceForJourneyAsync(section, journeyId, tenantId);
    }

    public async Task<PreOpSectionClearanceDto> ConfirmSectionAsync(
        Guid journeyId, Guid tenantId, Guid userId, string category, ConfirmPreOpSectionRequest req)
    {
        await _mutationGuard.EnsureMutableAsync(journeyId, tenantId);
        var clearance = await RequireClearanceAsync(journeyId, tenantId);

        var section = await _db.PreOpSectionClearances
            .FirstOrDefaultAsync(s => s.ClearanceId == clearance.Id
                                      && s.SectionCategory == category
                                      && s.DeletedAt == null)
            ?? throw new KeyNotFoundException(
                $"Section '{category}' has not been requested for journey {journeyId}.");

        await AssertNoMandatoryBlockersForSectionAsync(clearance.Id, category);

        section.Status             = "WardConfirmed";
        section.ConfirmedByUserId  = userId;
        section.ConfirmedAt        = DateTime.UtcNow;
        section.ConfirmationNotes  = req.ConfirmationNotes;
        section.UpdatedByUserId    = userId;
        section.UpdatedAt          = DateTime.UtcNow;

        await _db.SaveChangesAsync();

        if (string.Equals(category, "Consent", StringComparison.OrdinalIgnoreCase))
            await _wardSync.SyncConsentSectionConfirmedAsync(journeyId, tenantId, userId);

        // Notify the responsible department that the ward has confirmed their section
        _ = _notify.NotifyDepartmentAsync(
            tenantId, null, section.ResponsibleDepartmentCode,
            "PreOpSectionConfirmed",
            $"Pre-op section '{category}' has been confirmed by ward",
            $"JourneyId: {journeyId}");

        return await MapSectionClearanceForJourneyAsync(section, journeyId, tenantId);
    }

    // ── Extended state actions ─────────────────────────────────────────────────────

    public async Task<PreOpSectionClearanceDto> PutSectionOnHoldAsync(
        Guid journeyId, Guid tenantId, Guid userId, string category, PutSectionOnHoldRequest req)
    {
        await _mutationGuard.EnsureMutableAsync(journeyId, tenantId);
        var clearance = await RequireClearanceAsync(journeyId, tenantId);
        var section   = await _db.PreOpSectionClearances
            .FirstOrDefaultAsync(s => s.ClearanceId == clearance.Id
                                      && s.SectionCategory == category
                                      && s.DeletedAt == null)
            ?? throw new KeyNotFoundException($"Section '{category}' has not been requested for journey {journeyId}.");

        if (section.Status is not ("Requested" or "NeedsInfo" or "Escalated"))
            throw new InvalidOperationException($"Cannot put section '{category}' on hold from status '{section.Status}'.");

        section.Status          = "OnHold";
        section.ResponseNotes   = req.Reason;
        section.RespondedByUserId = userId;
        section.RespondedAt     = DateTime.UtcNow;
        section.UpdatedByUserId = userId;
        section.UpdatedAt       = DateTime.UtcNow;
        await _db.SaveChangesAsync();

        // Notify ward that section is now on hold
        _ = _notify.NotifyDepartmentAsync(
            tenantId, null, "STD_NURSE",
            "PreOpSectionOnHold",
            $"Pre-op section '{category}' has been put on hold: {req.Reason}",
            $"JourneyId: {journeyId}");

        return await MapSectionClearanceForJourneyAsync(section, journeyId, tenantId);
    }

    public async Task<PreOpSectionClearanceDto> RejectSectionAsync(
        Guid journeyId, Guid tenantId, Guid userId, string category, RejectSectionRequest req)
    {
        await _mutationGuard.EnsureMutableAsync(journeyId, tenantId);
        var clearance = await RequireClearanceAsync(journeyId, tenantId);
        var section   = await _db.PreOpSectionClearances
            .FirstOrDefaultAsync(s => s.ClearanceId == clearance.Id
                                      && s.SectionCategory == category
                                      && s.DeletedAt == null)
            ?? throw new KeyNotFoundException($"Section '{category}' has not been requested for journey {journeyId}.");

        section.Status            = "Rejected";
        section.RejectionReason   = req.RejectionReason;
        section.ResponseNotes     = req.Notes;
        section.RespondedByUserId = userId;
        section.RespondedAt       = DateTime.UtcNow;
        section.UpdatedByUserId   = userId;
        section.UpdatedAt         = DateTime.UtcNow;
        await _db.SaveChangesAsync();

        // Notify ward that section was rejected
        _ = _notify.NotifyDepartmentAsync(
            tenantId, null, "STD_NURSE",
            "PreOpSectionRejected",
            $"Pre-op section '{category}' was rejected: {req.RejectionReason}",
            $"JourneyId: {journeyId}");

        return await MapSectionClearanceForJourneyAsync(section, journeyId, tenantId);
    }

    public async Task<PreOpSectionClearanceDto> RequestMoreInfoAsync(
        Guid journeyId, Guid tenantId, Guid userId, string category, RequestMoreInfoRequest req)
    {
        await _mutationGuard.EnsureMutableAsync(journeyId, tenantId);
        var clearance = await RequireClearanceAsync(journeyId, tenantId);
        var section   = await _db.PreOpSectionClearances
            .FirstOrDefaultAsync(s => s.ClearanceId == clearance.Id
                                      && s.SectionCategory == category
                                      && s.DeletedAt == null)
            ?? throw new KeyNotFoundException($"Section '{category}' has not been requested for journey {journeyId}.");

        if (section.Status is not ("Requested" or "OnHold"))
            throw new InvalidOperationException($"Cannot request more info for section '{category}' from status '{section.Status}'.");

        section.Status            = "NeedsInfo";
        section.ResponseNotes     = req.InfoNeeded;
        section.RespondedByUserId = userId;
        section.RespondedAt       = DateTime.UtcNow;
        section.UpdatedByUserId   = userId;
        section.UpdatedAt         = DateTime.UtcNow;
        await _db.SaveChangesAsync();

        // Notify ward that dept needs more information
        _ = _notify.NotifyDepartmentAsync(
            tenantId, null, "STD_NURSE",
            "PreOpSectionNeedsInfo",
            $"Pre-op section '{category}' needs more info: {req.InfoNeeded}",
            $"JourneyId: {journeyId}");

        return await MapSectionClearanceForJourneyAsync(section, journeyId, tenantId);
    }

    public async Task<PreOpSectionClearanceDto> EscalateSectionAsync(
        Guid journeyId, Guid tenantId, Guid userId, string category, EscalateSectionRequest req)
    {
        await _mutationGuard.EnsureMutableAsync(journeyId, tenantId);
        var clearance = await RequireClearanceAsync(journeyId, tenantId);
        var section   = await _db.PreOpSectionClearances
            .FirstOrDefaultAsync(s => s.ClearanceId == clearance.Id
                                      && s.SectionCategory == category
                                      && s.DeletedAt == null)
            ?? throw new KeyNotFoundException($"Section '{category}' has not been requested for journey {journeyId}.");

        section.Status          = "Escalated";
        section.Urgency         = req.Urgency;
        section.ResponseNotes   = req.Reason;
        section.UpdatedByUserId = userId;
        section.UpdatedAt       = DateTime.UtcNow;
        await _db.SaveChangesAsync();

        // Notify the responsible dept with high-urgency flag
        _ = _notify.NotifyDepartmentAsync(
            tenantId, null, section.ResponsibleDepartmentCode,
            "PreOpSectionEscalated",
            $"[ESCALATED] Pre-op section '{category}' requires urgent attention: {req.Reason}",
            $"JourneyId: {journeyId}");

        return await MapSectionClearanceForJourneyAsync(section, journeyId, tenantId);
    }

    // ── Private Helpers ───────────────────────────────────────────────────────────────────

    /// <summary>
    /// Sets PostgreSQL session variable so RLS policies allow tenant-scoped reads/writes.
    /// Azure PostgreSQL does not grant BYPASSRLS to the postgres user, so this must be
    /// called before every EF query that touches an RLS-protected table.
    /// </summary>
    private Task EnsureRlsAsync(Guid tenantId) =>
        _db.Database.ExecuteSqlRawAsync(
            "SELECT set_config('app.current_tenant_id', {0}, false)", tenantId.ToString());

    private async Task<PreOpClearance> RequireClearanceAsync(Guid journeyId, Guid tenantId)
    {
        await EnsureRlsAsync(tenantId);
        return await _db.PreOpClearances
                   .FirstOrDefaultAsync(c => c.JourneyId == journeyId
                                             && c.TenantId  == tenantId
                                             && c.DeletedAt == null)
               ?? throw new KeyNotFoundException(
                   $"No pre-op clearance found for journey {journeyId}. Call /init first.");
    }

    private async Task<PatientJourney> RequireJourneyAsync(Guid id, Guid tenantId)
    {
        await EnsureRlsAsync(tenantId);
        return await _db.PatientJourneys
                   .FirstOrDefaultAsync(j => j.Id == id && j.TenantId == tenantId && j.DeletedAt == null)
               ?? throw new KeyNotFoundException($"PatientJourney {id} not found.");
    }

    private static string SnapshotClinical(string state)
        => System.Text.Json.JsonSerializer.Serialize(new { ClinicalState = state });

    private static string SanitizeFileName(string name)
    {
        var invalid = System.IO.Path.GetInvalidFileNameChars();
        return string.Join("_", name.Split(invalid, StringSplitOptions.RemoveEmptyEntries)).Trim('.');
    }

    private async Task AssertNoMandatoryBlockersForSectionAsync(Guid clearanceId, string category)
    {
        var openBlockers = await (
            from cp in _db.PreOpCompletions
            join item in _db.PreOpSectionItems on cp.ItemId equals item.Id
            where cp.ClearanceId == clearanceId
                  && cp.DeletedAt == null
                  && item.DeletedAt == null
                  && item.Category == category
                  && item.IsBlocking
                  && !cp.IsCompleted
                  && !cp.IsBypassed
            select item.ItemLabel
        ).ToListAsync();

        if (openBlockers.Count == 0) return;

        throw new InvalidOperationException(
            $"Cannot confirm section '{category}': {openBlockers.Count} mandatory blocker(s) remain open.");
    }

    private static PreOpClearanceDto MapClearance(PreOpClearance c) => new(
        c.Id, c.JourneyId, c.PaymentModeSnapshot, c.InsurancePreauthId,
        c.OverallStatus, c.OverallClearance, c.IsDeferred, c.DeferredReason,
        c.ClearedAt, c.ClearedByUserId, c.ClearanceNotes, c.CreatedAt, c.UpdatedAt);

    private static PreOpSectionItemDto MapItem(PreOpSectionItem i) => new(
        i.Id, i.Category, i.ItemKey, i.ItemLabel, i.Description,
        i.DepartmentOwner, i.IsMandatory, i.IsBlocking, i.RequiresDocument,
        i.PatientTypeFilter, i.SurgeryTypeFilter, i.DisplayOrder);

    private static PreOpDocumentDto MapDocument(PreOpDocument d) => new(
        d.Id, d.ClearanceId, d.DocumentType, d.FileName, d.FileUrl,
        d.ContentType, d.FileSizeBytes, d.IsVerified, d.VerifiedByUserId,
        d.VerifiedAt, d.Notes, d.UploadedByUserId, d.CreatedAt);

    private static List<PreOpCompletionDto> MapDeptCompletionDtos(
        IEnumerable<(PreOpCompletion cp, PreOpSectionItem item)> completions)
    {
        return completions
            .Where(x => x.item.FormCode != WardChecklistService.WardFormCode
                        && x.item.FormCode != WardInvestigationChecklistService.InvestigationFormCode
                        && x.item.FormCode != CounsellorChecklistService.OutpatientFormCode
                        && x.item.FormCode != WardPostOpChecklistService.WardPostOpFormCode
                        && x.item.FormCode != WardPostOpChecklistService.WardPostOpSafetyFormCode)
            .Select(x => new PreOpCompletionDto(
                x.cp.Id, x.cp.ClearanceId, x.cp.ItemId,
                x.item.ItemKey, x.item.ItemLabel, x.item.Category,
                x.item.IsBlocking, x.item.RequiresDocument,
                x.cp.IsCompleted, x.cp.IsBypassed, x.cp.BypassReason,
                x.cp.Notes, x.cp.DocumentId,
                x.cp.CompletedByUserId, x.cp.CompletedAt, x.cp.UpdatedAt,
                x.item.FormCode, x.cp.Source,
                x.cp.ResultValue, x.cp.ResultUnit, x.cp.EntryStatus,
                x.cp.EnteredAt, x.cp.CompletedByRole))
            .ToList();
    }

    private async Task<PreOpSectionClearanceDto> MapSectionClearanceForJourneyAsync(
        PreOpSectionClearance section, Guid journeyId, Guid tenantId)
    {
        var journey = await _db.PatientJourneys.AsNoTracking()
            .FirstOrDefaultAsync(j => j.Id == journeyId && j.TenantId == tenantId && j.DeletedAt == null);
        var clinicalState = journey?.ClinicalState ?? ClinicalState.Expected;

        var completions = await (
            from cp in _db.PreOpCompletions
            join item in _db.PreOpSectionItems on cp.ItemId equals item.Id
            where cp.ClearanceId == section.ClearanceId && cp.DeletedAt == null
            select new { cp, item }
        ).ToListAsync();

        var completionDtos = MapDeptCompletionDtos(completions.Select(x => (x.cp, x.item)));
        return SectionDisplayStatusHelper.MapSectionClearance(section, journeyId, clinicalState, completionDtos);
    }
}
