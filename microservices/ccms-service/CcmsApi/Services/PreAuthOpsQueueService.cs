using CcmsApi.Data;
using Microsoft.EntityFrameworkCore;

namespace CcmsApi.Services;

/// <summary>
/// Operations pre-auth queue. Workflow state lives on <c>ccms_coverage_cases.current_state</c>;
/// authorization <c>status</c> is the row lifecycle (<c>active</c>), not PREAUTH_SENT.
/// </summary>
public sealed class PreAuthOpsQueueService
{
    /// <summary>
    /// Case states that still need ops / TPA attention. Includes dashboard pending
    /// states plus PARTIAL_APPROVAL (existing ops filter / FE chip).
    /// </summary>
    public static readonly string[] PendingCaseStates =
    {
        "PREAUTH_GENERATED",
        "PREAUTH_SENT",
        "WAITING_APPROVAL",
        "CLARIFICATION_REQUIRED",
        "RESUBMITTED",
        "PARTIAL_APPROVAL",
    };

    private readonly CcmsDbContext _db;

    public PreAuthOpsQueueService(CcmsDbContext db) => _db = db;

    public async Task<List<PreAuthQueueItem>> GetQueueAsync(
        Guid tenantId, CancellationToken ct = default)
    {
        var pending = PendingCaseStates;
        var now = DateTime.UtcNow;

        var rows = await (
            from a in _db.CoverageAuthorizations.AsNoTracking()
            join c in _db.CoverageCases.AsNoTracking() on a.CoverageCase_Id equals c.Id
            where a.TenantId == tenantId
                  && a.DeletedAt == null
                  && c.DeletedAt == null
                  && pending.Contains(c.CurrentState)
            orderby a.SubmittedAt ?? a.CreatedAt
            select new
            {
                a.Id,
                a.CoverageCase_Id,
                a.PreAuthNumber,
                a.ProcessStatus,
                a.RequestedAmount,
                a.ApprovedAmount,
                a.TpaReferenceNumber,
                a.SubmittedAt,
                a.ReceivedAt,
                a.CreatedAt,
                c.CaseNumber,
                c.InsurerName,
                c.PatientName,
                c.CurrentState,
                c.SessionId,
            }).ToListAsync(ct);

        var queue = rows.Select(a => new PreAuthQueueItem
        {
            AuthId             = a.Id,
            CaseCaseId         = a.CoverageCase_Id,
            PreAuthNumber      = a.PreAuthNumber,
            // FE badges/filters expect workflow codes, not authorization lifecycle.
            Status             = a.CurrentState,
            ProcessStatus      = a.ProcessStatus,
            RequestedAmount    = a.RequestedAmount,
            ApprovedAmount     = a.ApprovedAmount,
            TpaReferenceNumber = a.TpaReferenceNumber,
            SubmittedAt        = a.SubmittedAt,
            TpaResponseAt      = a.ReceivedAt,
            DaysWaiting        = (int)(now - (a.SubmittedAt ?? a.CreatedAt)).TotalDays,
            CaseNumber         = a.CaseNumber,
            InsurerName        = a.InsurerName,
            PatientName        = a.PatientName,
            CaseState          = a.CurrentState,
            SessionId          = a.SessionId,
        }).ToList();

        if (queue.Count == 0)
            return queue;

        var caseIds = queue.Select(q => q.CaseCaseId).Distinct().ToList();
        var draftSet = await LoadInboundDraftCaseIdsAsync(tenantId, caseIds, ct);
        foreach (var item in queue)
            item.HasInboundDraft = draftSet.Contains(item.CaseCaseId);

        return queue;
    }

    public async Task<PreAuthQueueSummaryDto> GetSummaryAsync(
        Guid tenantId, CancellationToken ct = default)
    {
        var pending = PendingCaseStates;

        var counts = await (
            from a in _db.CoverageAuthorizations.AsNoTracking()
            join c in _db.CoverageCases.AsNoTracking() on a.CoverageCase_Id equals c.Id
            where a.TenantId == tenantId
                  && a.DeletedAt == null
                  && c.DeletedAt == null
                  && pending.Contains(c.CurrentState)
            group a by c.CurrentState into g
            select new PreAuthQueueStatusCount { Status = g.Key, Count = g.Count() }
            ).ToListAsync(ct);

        var pendingCaseIds = await (
            from a in _db.CoverageAuthorizations.AsNoTracking()
            join c in _db.CoverageCases.AsNoTracking() on a.CoverageCase_Id equals c.Id
            where a.TenantId == tenantId
                  && a.DeletedAt == null
                  && c.DeletedAt == null
                  && pending.Contains(c.CurrentState)
            select a.CoverageCase_Id
            ).Distinct().ToListAsync(ct);

        var inboundToReview = pendingCaseIds.Count == 0
            ? 0
            : (await LoadInboundDraftCaseIdsAsync(tenantId, pendingCaseIds, ct)).Count;

        return new PreAuthQueueSummaryDto
        {
            Total            = counts.Sum(c => c.Count),
            ByStatus         = counts,
            WaitingApproval  = counts.FirstOrDefault(c => c.Status == "WAITING_APPROVAL")?.Count ?? 0,
            ClarificationDue = counts.FirstOrDefault(c => c.Status == "CLARIFICATION_REQUIRED")?.Count ?? 0,
            InboundToReview  = inboundToReview,
        };
    }

    private async Task<HashSet<Guid>> LoadInboundDraftCaseIdsAsync(
        Guid tenantId, List<Guid> caseIds, CancellationToken ct)
    {
        if (caseIds.Count == 0)
            return [];

        var draftCaseIds = await _db.CommunicationLogs
            .AsNoTracking()
            .Where(l =>
                l.DeletedAt == null &&
                l.TenantId == tenantId &&
                l.Direction == "inbound" &&
                caseIds.Contains(l.CoverageCase_Id) &&
                l.MetadataJson != null &&
                l.MetadataJson.Contains("draft_ready"))
            .Select(l => l.CoverageCase_Id)
            .Distinct()
            .ToListAsync(ct);

        return draftCaseIds.ToHashSet();
    }
}

public class PreAuthQueueItem
{
    public Guid      AuthId             { get; set; }
    public Guid      CaseCaseId         { get; set; }
    public Guid?     SessionId          { get; set; }
    public string?   CaseNumber         { get; set; }
    public string?   CaseState          { get; set; }
    public string?   PreAuthNumber      { get; set; }
    public string    Status             { get; set; } = string.Empty;
    public string?   ProcessStatus      { get; set; }
    public decimal   RequestedAmount    { get; set; }
    public decimal?  ApprovedAmount     { get; set; }
    public string?   TpaReferenceNumber { get; set; }
    public DateTime? SubmittedAt        { get; set; }
    public DateTime? TpaResponseAt      { get; set; }
    public int       DaysWaiting        { get; set; }
    public string?   InsurerName        { get; set; }
    public string?   PatientName        { get; set; }
    public bool      HasInboundDraft    { get; set; }
}

public class PreAuthQueueStatusCount
{
    public string Status { get; set; } = string.Empty;
    public int    Count  { get; set; }
}

public class PreAuthQueueSummaryDto
{
    public int Total { get; set; }
    public List<PreAuthQueueStatusCount> ByStatus { get; set; } = [];
    public int WaitingApproval  { get; set; }
    public int ClarificationDue { get; set; }
    public int InboundToReview  { get; set; }
}
