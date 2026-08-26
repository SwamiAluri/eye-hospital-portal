using IpManagementService.Models.Domain;
using IpManagementService.Models.Dtos;

namespace IpManagementService.Services;

/// <summary>
/// Pure pre-op readiness rollup (Phase 8). Mirrors FE
/// <c>lib/ip-management/preop-readiness.ts</c> so the workspace modal and ward list
/// share one server-authoritative source.
/// </summary>
public static class PreOpReadinessEngine
{
    private static readonly string[] PaidFinancialStates = ["Paid", "Settled", "Confirmed"];

    private static readonly string[] StepOrder =
    [
        "admit", "evaluation", "consent", "investigations", "pac",
        "bedside", "fasting", "financial", "records",
    ];

    private static readonly HashSet<string> AdmissionGated = new(StringComparer.OrdinalIgnoreCase)
    {
        "evaluation", "pac", "bedside", "records",
    };

    public sealed record InvestigationSlice(int Completed, int Total, int Blocking);
    public sealed record PacSlice(string? AssessmentStatus);
    public sealed record WardSlice(IReadOnlyList<WardChecklistItemDto> Items);

    public static PreOpReadinessDto Compute(
        string clinicalState,
        string? financialState,
        IReadOnlyList<PreOpCompletionDto> completions,
        IReadOnlyList<PreOpSectionClearanceDto>? sectionClearances,
        InvestigationSlice? investigation,
        WardSlice? ward,
        PacSlice? pac)
    {
        var steps = StepOrder.Select(key => ComputeStep(
            key, clinicalState, financialState, completions, sectionClearances, investigation, ward, pac)).ToList();

        var countable = steps.Where(s => s.HasCount && !s.Locked).ToList();
        var readySteps = countable.Count(s => s.Status == "completed");
        var blockers = steps.Sum(s => s.Blocking);

        return new PreOpReadinessDto(steps, readySteps, countable.Count, blockers);
    }

    /// <summary>Ward list summary: ready countable steps / countable steps.</summary>
    public static (int Completed, int Total) Summary(PreOpReadinessDto dto)
        => (dto.ReadySteps, dto.CountableSteps);

    private static StepReadinessDto ComputeStep(
        string key,
        string clinicalState,
        string? financialState,
        IReadOnlyList<PreOpCompletionDto> completions,
        IReadOnlyList<PreOpSectionClearanceDto>? sectionClearances,
        InvestigationSlice? investigation,
        WardSlice? ward,
        PacSlice? pac)
    {
        var locked = IsStepLocked(key, clinicalState);

        return key switch
        {
            "investigations" => ComputeInvestigations(locked, investigation),
            "pac"            => ComputePac(locked, pac),
            "evaluation"     => ComputeEvaluation(locked, completions, sectionClearances),
            "consent"        => ComputeCategoryStep(key, locked, completions, sectionClearances, "Consent"),
            "financial"      => ComputeFinancial(locked, financialState, completions),
            "fasting"        => ComputeCategoryStep(key, locked, completions, sectionClearances, "Compliance", "Pharmacy Preparation"),
            "bedside"        => ComputeBedside(locked, completions, ward),
            "admit"          => new StepReadinessDto(key, 0, 0, 0, "in-progress", false, false),
            "records"        => new StepReadinessDto(key, 0, 0, 0, locked ? "not-started" : "in-progress", locked, false),
            _                => new StepReadinessDto(key, 0, 0, 0, "not-started", locked, false),
        };
    }

    private static bool IsStepLocked(string key, string clinicalState)
        => AdmissionGated.Contains(key) && clinicalState == ClinicalState.Expected;

    private static StepReadinessDto ComputeInvestigations(bool locked, InvestigationSlice? investigation)
    {
        var completed = investigation?.Completed ?? 0;
        var total = investigation?.Total ?? 0;
        var blocking = locked ? 0 : investigation?.Blocking ?? 0;
        return new StepReadinessDto(
            "investigations",
            completed,
            total,
            blocking,
            locked ? "not-started" : StatusFromProgress(completed, total),
            locked,
            total > 0);
    }

    private static StepReadinessDto ComputePac(bool locked, PacSlice? pac)
    {
        var done = pac?.AssessmentStatus == "Completed" ? 1 : 0;
        var started = pac?.AssessmentStatus is not null and not "" and not "NotStarted";
        var status = locked ? "not-started"
            : done == 1 ? "completed"
            : started ? "in-progress"
            : "not-started";
        return new StepReadinessDto(
            "pac",
            done,
            1,
            locked || done == 1 ? 0 : 1,
            status,
            locked,
            true);
    }

    private static readonly HashSet<string> EvaluationReadinessExclude = new(StringComparer.OrdinalIgnoreCase)
    {
        "risk_classification",
        "doctor_evaluation_completed",
    };

    private static StepReadinessDto ComputeEvaluation(
        bool locked,
        IReadOnlyList<PreOpCompletionDto> completions,
        IReadOnlyList<PreOpSectionClearanceDto>? sectionClearances)
    {
        var items = completions.Where(c =>
            string.Equals(c.Category, "Evaluation", StringComparison.OrdinalIgnoreCase)
            && !EvaluationReadinessExclude.Contains(c.ItemKey)
            && c.FormCode != WardChecklistService.WardFormCode
            && c.FormCode != WardInvestigationChecklistService.InvestigationFormCode).ToList();

        var blockingItems = items.Where(i => i.IsBlocking).ToList();
        var pool = blockingItems.Count > 0 ? blockingItems : items;
        var completed = pool.Count(i => i.IsCompleted || i.IsBypassed);
        var blocking = blockingItems.Count(i => !(i.IsCompleted || i.IsBypassed));
        var sectionStatus = SectionStatusFor(sectionClearances, "Evaluation");
        var status = DeriveStatus(locked, completed, pool.Count, sectionStatus);

        return new StepReadinessDto(
            "evaluation",
            completed,
            pool.Count,
            locked ? 0 : blocking,
            status,
            locked,
            pool.Count > 0);
    }

    private static StepReadinessDto ComputeCategoryStep(
        string key,
        bool locked,
        IReadOnlyList<PreOpCompletionDto> completions,
        IReadOnlyList<PreOpSectionClearanceDto>? sectionClearances,
        params string[] categories)
    {
        var c = CountByCategories(completions, categories);
        var sectionStatus = key switch
        {
            "evaluation" => SectionStatusFor(sectionClearances, "Evaluation"),
            _             => null,
        };
        var status = DeriveStatus(locked, c.Completed, c.Total, sectionStatus);
        return new StepReadinessDto(key, c.Completed, c.Total, locked ? 0 : c.Blocking, status, locked, c.Total > 0);
    }

    private static StepReadinessDto ComputeFinancial(
        bool locked,
        string? financialState,
        IReadOnlyList<PreOpCompletionDto> completions)
    {
        var c = CountByCategories(completions, "Financial");
        if (c.Total == 0 && !string.IsNullOrWhiteSpace(financialState))
        {
            var paid = PaidFinancialStates.Contains(financialState);
            return new StepReadinessDto(
                "financial",
                paid ? 1 : 0,
                1,
                0,
                paid ? "completed" : "in-progress",
                locked,
                true);
        }

        return new StepReadinessDto(
            "financial",
            c.Completed,
            c.Total,
            locked ? 0 : c.Blocking,
            DeriveStatus(locked, c.Completed, c.Total),
            locked,
            c.Total > 0);
    }

    private static StepReadinessDto ComputeBedside(
        bool locked,
        IReadOnlyList<PreOpCompletionDto> completions,
        WardSlice? ward)
    {
        var ot = CountByCategories(completions, "OT Preparation");
        var nurseWard = (ward?.Items ?? [])
            .Where(i => PreOpBedsideItems.NurseWardKeys.Contains(i.ItemKey) && i.AppliesToJourney)
            .ToList();
        var rehomed = completions.Where(c => PreOpBedsideItems.NurseRehomedKeys.Contains(c.ItemKey)).ToList();
        var nurseCompleted =
            nurseWard.Count(i => i.IsCompleted || i.IsBypassed)
            + rehomed.Count(c => c.IsCompleted || c.IsBypassed);
        var nurseTotal = nurseWard.Count + rehomed.Count;
        var completed = nurseCompleted + ot.Completed;
        var total = nurseTotal + ot.Total;

        return new StepReadinessDto(
            "bedside",
            completed,
            total,
            locked ? 0 : ot.Blocking,
            locked ? "not-started" : StatusFromProgress(completed, total),
            locked,
            total > 0);
    }

    private sealed record CategoryCount(int Completed, int Total, int Blocking);

    private static CategoryCount CountByCategories(
        IReadOnlyList<PreOpCompletionDto> completions,
        params string[] categories)
    {
        var catSet = new HashSet<string>(categories, StringComparer.OrdinalIgnoreCase);
        var items = completions.Where(c =>
            catSet.Contains(c.Category)
            && c.FormCode != WardChecklistService.WardFormCode
            && c.FormCode != WardInvestigationChecklistService.InvestigationFormCode).ToList();

        var blockingItems = items.Where(i => i.IsBlocking).ToList();
        var pool = blockingItems.Count > 0 ? blockingItems : items;
        var completed = pool.Count(i => i.IsCompleted || i.IsBypassed);
        var blocking = blockingItems.Count(i => !(i.IsCompleted || i.IsBypassed));
        return new CategoryCount(completed, pool.Count, blocking);
    }

    private static string? SectionStatusFor(
        IReadOnlyList<PreOpSectionClearanceDto>? sections,
        string category)
        => sections?.FirstOrDefault(s =>
            string.Equals(s.SectionCategory, category, StringComparison.OrdinalIgnoreCase))?.Status;

    private static string DeriveStatus(bool locked, int completed, int total, string? sectionStatus = null)
    {
        if (locked) return "not-started";
        if (!string.IsNullOrWhiteSpace(sectionStatus)
            && !string.Equals(sectionStatus, "NotRequested", StringComparison.OrdinalIgnoreCase))
            return StatusFromSectionStatus(sectionStatus);
        return StatusFromProgress(completed, total);
    }

    private static string StatusFromProgress(int completed, int total, int blockers = 0)
    {
        if (blockers > 0) return "blocked";
        if (total == 0 || completed == 0) return "not-started";
        if (completed >= total) return "completed";
        return "in-progress";
    }

    private static string StatusFromSectionStatus(string status) => status switch
    {
        "WardConfirmed"     => "completed",
        "RespondedClear"    => "pending-verification",
        "RespondedConcerns" => "needs-info",
        "Requested"         => "in-progress",
        "NeedsInfo"         => "needs-info",
        "OnHold"            => "on-hold",
        "Escalated"         => "on-hold",
        "Rejected"          => "rejected",
        _                   => "not-started",
    };

    /// <summary>Build investigation slice from ward investigation checklist items.</summary>
    public static InvestigationSlice InvestigationFromItems(
        IEnumerable<(PreOpCompletionDto Completion, PreOpSectionItem Item)> rows,
        PatientJourney journey,
        IReadOnlyList<string> unverifiedCriticalKeys)
    {
        var applicable = rows
            .Where(x => x.Item.FormCode == WardInvestigationChecklistService.InvestigationFormCode
                        && ItemAppliesToJourney(x.Item, journey))
            .ToList();
        var completed = applicable.Count(x =>
            x.Completion.IsBypassed
            || (x.Completion.IsCompleted && !string.IsNullOrWhiteSpace(x.Completion.ResultValue)));
        return new InvestigationSlice(
            completed,
            applicable.Count,
            unverifiedCriticalKeys.Count);
    }

    public static WardChecklistItemDto MapWardItem(
        PreOpCompletionDto cp,
        PreOpSectionItem item,
        PatientJourney journey)
        => new(
            item.Id,
            item.ItemKey,
            item.ItemLabel,
            item.Description,
            item.DisplayOrder,
            cp.IsCompleted,
            cp.IsBypassed,
            cp.Notes,
            cp.CompletedAt,
            cp.Source,
            cp.CompletedByRole,
            ItemAppliesToJourney(item, journey));

    private static bool ItemAppliesToJourney(PreOpSectionItem item, PatientJourney journey)
    {
        if (string.IsNullOrWhiteSpace(item.SurgeryTypeFilter)) return true;
        var proc = journey.ProcedureName ?? "";
        return item.SurgeryTypeFilter
            .Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
            .Any(f => proc.Contains(f, StringComparison.OrdinalIgnoreCase));
    }
}
