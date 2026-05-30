using CcmsApi.Models.Domain;
using CcmsApi.Models.Dtos;
using Microsoft.Extensions.Logging;

namespace CcmsApi.Services;

public static class WorkspaceSections
{
    public const string Policies        = "policies";
    public const string PreAuths          = "preauths";
    public const string Billing           = "billing";
    public const string Claims            = "claims";
    public const string Settlements       = "settlements";
    public const string Communications    = "communications";
    public const string Documents         = "documents";
    public const string Events            = "events";
    public const string WorkflowHistory   = "workflowhistory";
    public const string WorkflowActions   = "workflowactions";
    public const string Eligibility       = "eligibility";
    public const string PolicyCapture     = "policycapture";

    private static readonly HashSet<string> All = new(StringComparer.OrdinalIgnoreCase)
    {
        Policies, PreAuths, Billing, Claims, Settlements, Communications,
        Documents, Events, WorkflowHistory, WorkflowActions, Eligibility, PolicyCapture,
    };

    public static HashSet<string> Parse(string? sectionsQuery)
    {
        if (string.IsNullOrWhiteSpace(sectionsQuery))
            return new HashSet<string>(All, StringComparer.OrdinalIgnoreCase);

        var selected = sectionsQuery
            .Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
            .Where(All.Contains)
            .ToHashSet(StringComparer.OrdinalIgnoreCase);

        return selected.Count > 0 ? selected : new HashSet<string>(All, StringComparer.OrdinalIgnoreCase);
    }
}

public record WorkflowHistoryEntryDto(
    string FromState,
    string ToState,
    string ActionCode,
    string PerformedAt,
    string? Comment
);

public record CoverageCaseWorkspaceDto(
    CoverageCaseDetailDto Case,
    IReadOnlyList<VisitPolicyDto>? Policies,
    IReadOnlyList<AuthorizationSummaryDto>? PreAuths,
    BillingSummaryWithAllocations? Billing,
    IReadOnlyList<ClaimPacketDto>? Claims,
    IReadOnlyList<SettlementDto>? Settlements,
    IReadOnlyList<CcmsCommunicationLog>? Communications,
    IReadOnlyList<CcmsDocument>? Documents,
    IReadOnlyList<CcmsApprovalEvent>? ApprovalEvents,
    IReadOnlyList<WorkflowHistoryEntryDto>? WorkflowHistory,
    IReadOnlyList<string>? WorkflowActions,
    IReadOnlyList<CcmsEligibilityCheck>? EligibilityChecks,
    CcmsPolicyCapture? PolicyCapture
);

public class CoverageCaseWorkspaceService
{
    private readonly CoverageCaseService _cases;
    private readonly VisitPolicyService _policies;
    private readonly PreAuthorizationService _preAuth;
    private readonly CoverageAllocationEngine _billing;
    private readonly ClaimPacketGeneratorService _claims;
    private readonly SettlementReconciliationService _settlements;
    private readonly CommunicationEngineService _communications;
    private readonly DocumentEngineService _documents;
    private readonly ApprovalEventService _approvalEvents;
    private readonly EligibilityService _eligibility;
    private readonly PolicyCaptureService _policyCapture;
    private readonly IWorkflowEngine _workflow;
    private readonly ILogger<CoverageCaseWorkspaceService> _log;

    public CoverageCaseWorkspaceService(
        CoverageCaseService cases,
        VisitPolicyService policies,
        PreAuthorizationService preAuth,
        CoverageAllocationEngine billing,
        ClaimPacketGeneratorService claims,
        SettlementReconciliationService settlements,
        CommunicationEngineService communications,
        DocumentEngineService documents,
        ApprovalEventService approvalEvents,
        EligibilityService eligibility,
        PolicyCaptureService policyCapture,
        IWorkflowEngine workflow,
        ILogger<CoverageCaseWorkspaceService> log)
    {
        _cases           = cases;
        _policies        = policies;
        _preAuth         = preAuth;
        _billing         = billing;
        _claims          = claims;
        _settlements     = settlements;
        _communications  = communications;
        _documents       = documents;
        _approvalEvents  = approvalEvents;
        _eligibility     = eligibility;
        _policyCapture   = policyCapture;
        _workflow        = workflow;
        _log             = log;
    }

    public async Task<CoverageCaseWorkspaceDto?> GetAsync(
        Guid caseId,
        HashSet<string> sections,
        CancellationToken ct = default)
    {
        var caseDto = await _cases.GetByIdAsync(caseId);
        if (caseDto is null) return null;

        var instanceId = caseDto.WorkflowInstanceId;

        var tasks = new List<Task>();

        IReadOnlyList<VisitPolicyDto>? policies = null;
        IReadOnlyList<AuthorizationSummaryDto>? preAuths = null;
        BillingSummaryWithAllocations? billing = null;
        IReadOnlyList<ClaimPacketDto>? claims = null;
        IReadOnlyList<SettlementDto>? settlements = null;
        IReadOnlyList<CcmsCommunicationLog>? communications = null;
        IReadOnlyList<CcmsDocument>? documents = null;
        IReadOnlyList<CcmsApprovalEvent>? approvalEvents = null;
        IReadOnlyList<WorkflowHistoryEntryDto>? workflowHistory = null;
        IReadOnlyList<string>? workflowActions = null;
        IReadOnlyList<CcmsEligibilityCheck>? eligibilityChecks = null;
        CcmsPolicyCapture? policyCapture = null;

        if (sections.Contains(WorkspaceSections.Policies))
            tasks.Add(SafeLoad(async () => policies = await _policies.GetByCaseAsync(caseId, ct)));
        if (sections.Contains(WorkspaceSections.PreAuths))
            tasks.Add(SafeLoad(async () => preAuths = await _preAuth.GetByCaseIdAsync(caseId, ct)));
        if (sections.Contains(WorkspaceSections.Billing))
            tasks.Add(SafeLoad(async () => billing = await _billing.GetWithAllocationsAsync(caseId, ct)));
        if (sections.Contains(WorkspaceSections.Claims))
            tasks.Add(SafeLoad(async () => claims = await _claims.GetByCaseIdAsync(caseId, ct)));
        if (sections.Contains(WorkspaceSections.Settlements))
            tasks.Add(SafeLoad(async () => settlements = await _settlements.GetByCaseIdAsync(caseId, ct)));
        if (sections.Contains(WorkspaceSections.Communications))
            tasks.Add(SafeLoad(async () => communications = await _communications.GetByCaseAsync(caseId, ct)));
        if (sections.Contains(WorkspaceSections.Documents))
            tasks.Add(SafeLoad(async () => documents = await _documents.GetByCaseAsync(caseId, null, ct)));
        if (sections.Contains(WorkspaceSections.Events))
            tasks.Add(SafeLoad(async () => approvalEvents = await _approvalEvents.GetEventsByCaseIdAsync(caseId, ct)));
        if (sections.Contains(WorkspaceSections.WorkflowHistory) && instanceId.HasValue)
            tasks.Add(SafeLoad(async () => workflowHistory = await LoadWorkflowHistory(instanceId.Value, ct)));
        if (sections.Contains(WorkspaceSections.WorkflowActions) && instanceId.HasValue)
            tasks.Add(SafeLoad(async () => workflowActions = await LoadWorkflowActions(instanceId.Value, ct)));
        if (sections.Contains(WorkspaceSections.Eligibility))
            tasks.Add(SafeLoad(async () => eligibilityChecks = await _eligibility.GetByCaseAsync(caseId, ct)));
        if (sections.Contains(WorkspaceSections.PolicyCapture))
            tasks.Add(SafeLoad(async () => policyCapture = await _policyCapture.GetLatestAsync(caseId, ct)));

        if (tasks.Count > 0)
            await Task.WhenAll(tasks);

        return new CoverageCaseWorkspaceDto(
            Case: caseDto,
            Policies: policies,
            PreAuths: preAuths,
            Billing: billing,
            Claims: claims,
            Settlements: settlements,
            Communications: communications,
            Documents: documents,
            ApprovalEvents: approvalEvents,
            WorkflowHistory: workflowHistory,
            WorkflowActions: workflowActions,
            EligibilityChecks: eligibilityChecks,
            PolicyCapture: policyCapture
        );
    }

    private async Task SafeLoad(Func<Task> action)
    {
        try { await action(); }
        catch (Exception ex) { _log.LogWarning(ex, "Workspace section load failed"); }
    }

    private async Task<IReadOnlyList<string>> LoadWorkflowActions(Guid instanceId, CancellationToken ct)
    {
        var transitions = await _workflow.GetAvailableTransitionsAsync(instanceId, ct);
        return transitions.Select(t => t.TriggerEvent).Distinct().ToList();
    }

    private async Task<IReadOnlyList<WorkflowHistoryEntryDto>> LoadWorkflowHistory(
        Guid instanceId, CancellationToken ct)
    {
        var rawHistory = await _workflow.GetHistoryAsync(instanceId, ct);
        if (rawHistory.Count == 0) return Array.Empty<WorkflowHistoryEntryDto>();

        var stateIds = rawHistory
            .SelectMany(h => new[] { h.FromStateId, (Guid?)h.ToStateId })
            .Where(sid => sid.HasValue)
            .Select(sid => sid!.Value)
            .Distinct()
            .ToList();

        var statesById = stateIds.Count > 0
            ? await _workflow.ResolveStateCodesAsync(stateIds, ct)
            : new Dictionary<Guid, string>();

        return rawHistory.Select(h =>
        {
            var from = !string.IsNullOrEmpty(h.FromStateCode)
                ? h.FromStateCode
                : h.FromStateId.HasValue && statesById.TryGetValue(h.FromStateId.Value, out var f)
                    ? f : "DRAFT";
            var to = !string.IsNullOrEmpty(h.ToStateCode)
                ? h.ToStateCode
                : statesById.TryGetValue(h.ToStateId, out var t)
                    ? t : "UNKNOWN";
            return new WorkflowHistoryEntryDto(
                FromState: from,
                ToState: to,
                ActionCode: h.TriggerEvent,
                PerformedAt: h.TransitionedAt.ToString("O"),
                Comment: h.Notes
            );
        }).ToList();
    }
}
