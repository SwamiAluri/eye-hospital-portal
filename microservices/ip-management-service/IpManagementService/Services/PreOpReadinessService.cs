using Microsoft.EntityFrameworkCore;
using IpManagementService.Data;
using IpManagementService.Models.Domain;
using IpManagementService.Models.Dtos;

namespace IpManagementService.Services;

/// <summary>
/// Loads canonical pre-op sources and computes readiness via <see cref="PreOpReadinessEngine"/>.
/// </summary>
public class PreOpReadinessService
{
    private readonly IpManagementDbContext               _db;
    private readonly PreOpClearanceService               _preOp;
    private readonly WardInvestigationChecklistService   _investigation;
    private readonly WardChecklistService                _wardChecklist;
    private readonly PacAssessmentService                _pac;

    public PreOpReadinessService(
        IpManagementDbContext db,
        PreOpClearanceService preOp,
        WardInvestigationChecklistService investigation,
        WardChecklistService wardChecklist,
        PacAssessmentService pac)
    {
        _db            = db;
        _preOp         = preOp;
        _investigation = investigation;
        _wardChecklist = wardChecklist;
        _pac           = pac;
    }

    /// <summary>Full rollup for the workspace modal (Phase 8).</summary>
    public async Task<PreOpReadinessDto?> GetReadinessAsync(
        Guid journeyId, Guid tenantId, Guid userId, string? paymentMode = null)
    {
        var journey = await _db.PatientJourneys.AsNoTracking()
            .FirstOrDefaultAsync(j => j.Id == journeyId && j.TenantId == tenantId && j.DeletedAt == null);
        if (journey is null) return null;

        if (!WardReadiness.PreOpStates.Contains(journey.ClinicalState))
            return EmptyForState(journey.ClinicalState);

        var detail = await _preOp.GetClearanceDetailAsync(journeyId, tenantId);
        var investigation = await _investigation.GetChecklistAsync(journeyId, tenantId, userId);
        var ward = await _wardChecklist.GetWardChecklistAsync(
            journeyId, tenantId, userId, paymentMode ?? journey.PaymentMode);
        var pacDto = await _pac.GetAssessmentAsync(journeyId, tenantId);

        return BuildFromSources(
            journey,
            detail?.Completions ?? [],
            detail?.SectionClearances,
            investigation.Items,
            investigation.UnverifiedCriticalKeys,
            ward.Items,
            pacDto.AssessmentStatus);
    }

    /// <summary>
    /// Batch summary for ward list rows — one query bundle, no per-row service fan-out.
    /// </summary>
    public async Task<Dictionary<Guid, (int Completed, int Total)>> GetSummaryBatchAsync(
        IReadOnlyList<PatientJourney> journeys, Guid tenantId)
    {
        var preOp = journeys
            .Where(j => WardReadiness.PreOpStates.Contains(j.ClinicalState))
            .ToList();
        if (preOp.Count == 0) return new Dictionary<Guid, (int, int)>();

        var ids = preOp.Select(j => j.Id).ToList();

        var clearances = await _db.PreOpClearances.AsNoTracking()
            .Where(c => ids.Contains(c.JourneyId) && c.TenantId == tenantId && c.DeletedAt == null)
            .ToListAsync();
        var clearanceByJourney = clearances.ToDictionary(c => c.JourneyId);
        var clearanceIds = clearances.Select(c => c.Id).ToList();

        var joined = await (
            from cp in _db.PreOpCompletions.AsNoTracking()
            join item in _db.PreOpSectionItems.AsNoTracking() on cp.ItemId equals item.Id
            where clearanceIds.Contains(cp.ClearanceId) && cp.DeletedAt == null
            select new { cp, item, cp.ClearanceId }
        ).ToListAsync();

        var sections = await _db.PreOpSectionClearances.AsNoTracking()
            .Where(s => clearanceIds.Contains(s.ClearanceId) && s.DeletedAt == null)
            .ToListAsync();

        var pacRows = await _db.PacAssessments.AsNoTracking()
            .Where(p => ids.Contains(p.PatientJourneyId) && p.TenantId == tenantId && p.DeletedAt == null)
            .Select(p => new { p.PatientJourneyId, p.AssessmentStatus })
            .ToListAsync();
        var pacByJourney = pacRows.ToDictionary(p => p.PatientJourneyId, p => p.AssessmentStatus);

        var result = new Dictionary<Guid, (int, int)>();

        foreach (var journey in preOp)
        {
            if (!clearanceByJourney.TryGetValue(journey.Id, out var clearance))
            {
                result[journey.Id] = (0, 0);
                continue;
            }

            var rows = joined.Where(x => x.ClearanceId == clearance.Id).ToList();
            var completionDtos = rows.Select(x => MapCompletion(x.cp, x.item)).ToList();
            var sectionDtos = sections
                .Where(s => s.ClearanceId == clearance.Id)
                .Select(s => SectionDisplayStatusHelper.MapSectionClearance(
                    s, journey.Id, journey.ClinicalState, completionDtos))
                .ToList();

            var invRows = rows
                .Where(x => x.item.FormCode == WardInvestigationChecklistService.InvestigationFormCode)
                .Select(x => (MapCompletion(x.cp, x.item), x.item));
            var unverified = ChecklistPhaseStatusService
                .ParseInvestigationSummary(journey.ChecklistPhaseStatus)?.UnverifiedCritical
                ?? [];

            var wardItems = rows
                .Where(x => x.item.FormCode == WardChecklistService.WardFormCode
                            && x.item.FormContext == WardChecklistService.WardFormContext)
                .Select(x => PreOpReadinessEngine.MapWardItem(MapCompletion(x.cp, x.item), x.item, journey))
                .ToList();

            pacByJourney.TryGetValue(journey.Id, out var pacStatus);

            var dto = PreOpReadinessEngine.Compute(
                journey.ClinicalState,
                journey.FinancialState,
                completionDtos,
                sectionDtos,
                PreOpReadinessEngine.InvestigationFromItems(invRows, journey, unverified),
                new PreOpReadinessEngine.WardSlice(wardItems),
                new PreOpReadinessEngine.PacSlice(pacStatus));

            result[journey.Id] = PreOpReadinessEngine.Summary(dto);
        }

        return result;
    }

    private static PreOpReadinessDto EmptyForState(string clinicalState)
    {
        var steps = PreOpReadinessEngine.Compute(
            clinicalState, null, [], null, null, null, null);
        return steps with { ReadySteps = 0, CountableSteps = 0, Blockers = 0 };
    }

    private static PreOpReadinessDto BuildFromSources(
        PatientJourney journey,
        IReadOnlyList<PreOpCompletionDto> completions,
        IReadOnlyList<PreOpSectionClearanceDto>? sections,
        IReadOnlyList<WardInvestigationItemDto> investigationItems,
        IReadOnlyList<string> unverifiedCritical,
        IReadOnlyList<WardChecklistItemDto> wardItems,
        string pacStatus)
    {
        var invCompleted = investigationItems.Count(i =>
            i.AppliesToJourney
            && (i.IsBypassed || (i.IsCompleted && !string.IsNullOrWhiteSpace(i.ResultValue))));
        var invTotal = investigationItems.Count(i => i.AppliesToJourney);

        return PreOpReadinessEngine.Compute(
            journey.ClinicalState,
            journey.FinancialState,
            completions,
            sections,
            new PreOpReadinessEngine.InvestigationSlice(
                invCompleted, invTotal, unverifiedCritical.Count),
            new PreOpReadinessEngine.WardSlice(wardItems),
            new PreOpReadinessEngine.PacSlice(pacStatus));
    }

    private static PreOpCompletionDto MapCompletion(PreOpCompletion cp, PreOpSectionItem item)
        => new(
            cp.Id, cp.ClearanceId, cp.ItemId,
            item.ItemKey, item.ItemLabel, item.Category,
            item.IsBlocking, item.RequiresDocument,
            cp.IsCompleted, cp.IsBypassed, cp.BypassReason,
            cp.Notes, cp.DocumentId,
            cp.CompletedByUserId, cp.CompletedAt, cp.UpdatedAt,
            item.FormCode, cp.Source,
            cp.ResultValue, cp.ResultUnit, cp.EntryStatus,
            cp.EnteredAt, cp.CompletedByRole);
}
