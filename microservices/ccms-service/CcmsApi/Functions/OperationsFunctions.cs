using System.Net;
using System.Text.Json;
using CcmsApi.Data;
using CcmsApi.Services;
using Microsoft.Azure.Functions.Worker;
using Microsoft.Azure.Functions.Worker.Http;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;

namespace CcmsApi.Functions;

/// <summary>
/// Operations-role endpoints — pre-auth queue, process status management.
/// </summary>
public class OperationsFunctions
{
    private readonly CcmsDbContext _db;
    private readonly JwtService _jwt;
    private readonly ILogger<OperationsFunctions> _log;

    public OperationsFunctions(CcmsDbContext db, JwtService jwt, ILogger<OperationsFunctions> log)
    {
        _db  = db;
        _jwt = jwt;
        _log = log;
    }

    // ── GET /ccms/operations/preauth-queue ────────────────────────────────────
    // Returns all authorizations pending ops action, enriched with case + payer.
    [Function("GetPreAuthQueue")]
    public async Task<HttpResponseData> GetPreAuthQueue(
        [HttpTrigger(AuthorizationLevel.Anonymous, "get",
            Route = "ccms/operations/preauth-queue")] HttpRequestData req)
    {
        if (!_jwt.ValidateAndExtract(req, out var claims, out var err))
            return await req.UnauthorizedAsync(err);

        var tenantId = claims!.TenantId;

        // States that require operations attention
        var pendingStates = new[] { "PREAUTH_SENT", "WAITING_APPROVAL", "CLARIFICATION_REQUIRED", "PARTIAL_APPROVAL" };

        var queue = await _db.CoverageAuthorizations
            .AsNoTracking()
            .Where(a =>
                a.TenantId == tenantId &&
                a.DeletedAt == null &&
                pendingStates.Contains(a.Status))
            .OrderBy(a => a.SubmittedAt ?? a.CreatedAt)
            .Select(a => new PreAuthQueueItem
            {
                AuthId               = a.Id,
                CaseCaseId           = a.CoverageCase_Id,
                PreAuthNumber        = a.PreAuthNumber,
                Status               = a.Status,
                ProcessStatus        = a.ProcessStatus,
                RequestedAmount      = a.RequestedAmount,
                ApprovedAmount       = a.ApprovedAmount,
                TpaReferenceNumber   = a.TpaReferenceNumber,
                SubmittedAt          = a.SubmittedAt,
                TpaResponseAt        = a.ReceivedAt,
                DaysWaiting          = a.SubmittedAt.HasValue
                    ? (int)(DateTime.UtcNow - a.SubmittedAt.Value).TotalDays
                    : 0,
                // Case fields joined via navigation or separate query below
                CaseNumber           = null,
                InsurerName          = null,
                PatientName          = null,
            })
            .ToListAsync();

        // Enrich with case data (minimal N+1, single batch join)
        if (queue.Count > 0)
        {
            var caseIds = queue.Select(q => q.CaseCaseId).Distinct().ToList();
            var cases = await _db.CoverageCases
                .AsNoTracking()
                .Where(c => caseIds.Contains(c.Id) && c.DeletedAt == null)
                .Select(c => new { c.Id, c.CaseNumber, c.InsurerName, c.PatientName, c.CurrentState, c.SessionId })
                .ToDictionaryAsync(c => c.Id);

            foreach (var item in queue)
            {
                if (cases.TryGetValue(item.CaseCaseId, out var c))
                {
                    item.CaseNumber   = c.CaseNumber;
                    item.InsurerName  = c.InsurerName;
                    item.PatientName  = c.PatientName;
                    item.CaseState    = c.CurrentState;
                    item.SessionId    = c.SessionId;
                }
            }

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
                .ToListAsync();

            var draftSet = draftCaseIds.ToHashSet();
            foreach (var item in queue)
                item.HasInboundDraft = draftSet.Contains(item.CaseCaseId);
        }

        return await req.OkJsonAsync(queue);
    }

    // ── GET /ccms/operations/preauth-queue/summary ────────────────────────────
    [Function("GetPreAuthQueueSummary")]
    public async Task<HttpResponseData> GetPreAuthQueueSummary(
        [HttpTrigger(AuthorizationLevel.Anonymous, "get",
            Route = "ccms/operations/preauth-queue/summary")] HttpRequestData req)
    {
        if (!_jwt.ValidateAndExtract(req, out var claims, out var err))
            return await req.UnauthorizedAsync(err);

        var tenantId = claims!.TenantId;
        var pendingStates = new[] { "PREAUTH_SENT", "WAITING_APPROVAL", "CLARIFICATION_REQUIRED", "PARTIAL_APPROVAL" };

        var counts = await _db.CoverageAuthorizations
            .AsNoTracking()
            .Where(a => a.TenantId == tenantId && a.DeletedAt == null && pendingStates.Contains(a.Status))
            .GroupBy(a => a.Status)
            .Select(g => new { Status = g.Key, Count = g.Count() })
            .ToListAsync();

        var pendingCaseIds = await _db.CoverageAuthorizations
            .AsNoTracking()
            .Where(a => a.TenantId == tenantId && a.DeletedAt == null && pendingStates.Contains(a.Status))
            .Select(a => a.CoverageCase_Id)
            .Distinct()
            .ToListAsync();

        var inboundToReview = pendingCaseIds.Count == 0
            ? 0
            : await _db.CommunicationLogs
                .AsNoTracking()
                .Where(l =>
                    l.DeletedAt == null &&
                    l.TenantId == tenantId &&
                    l.Direction == "inbound" &&
                    pendingCaseIds.Contains(l.CoverageCase_Id) &&
                    l.MetadataJson != null &&
                    l.MetadataJson.Contains("draft_ready"))
                .Select(l => l.CoverageCase_Id)
                .Distinct()
                .CountAsync();

        return await req.OkJsonAsync(new
        {
            total            = counts.Sum(c => c.Count),
            byStatus         = counts,
            waitingApproval  = counts.FirstOrDefault(c => c.Status == "WAITING_APPROVAL")?.Count  ?? 0,
            clarificationDue = counts.FirstOrDefault(c => c.Status == "CLARIFICATION_REQUIRED")?.Count ?? 0,
            inboundToReview,
        });
    }

    // ── GET /ccms/operations/claims-queue ─────────────────────────────────────
    // Claims that have been submitted and are awaiting TPA acknowledgment / processing.
    [Function("GetClaimsQueue")]
    public async Task<HttpResponseData> GetClaimsQueue(
        [HttpTrigger(AuthorizationLevel.Anonymous, "get",
            Route = "ccms/operations/claims-queue")] HttpRequestData req)
    {
        if (!_jwt.ValidateAndExtract(req, out var claims, out var err))
            return await req.UnauthorizedAsync(err);

        var tenantId = claims!.TenantId;

        var pendingStates = new[] { "CLAIM_SUBMITTED", "CLAIM_IN_PROCESS", "CLAIM_READY" };

        var claimItems = await _db.ClaimPackets
            .AsNoTracking()
            .Where(c => c.TenantId == tenantId && c.DeletedAt == null && pendingStates.Contains(c.Status))
            .OrderByDescending(c => c.SubmittedAt ?? c.CreatedAt)
            .ToListAsync();

        if (claimItems.Count == 0)
            return await req.OkJsonAsync(Array.Empty<object>());

        var caseIds = claimItems.Select(c => c.CoverageCase_Id).Distinct().ToList();
        var caseMap = await _db.CoverageCases
            .AsNoTracking()
            .Where(c => caseIds.Contains(c.Id) && c.DeletedAt == null)
            .Select(c => new { c.Id, c.CaseNumber, c.PatientName, c.InsurerName, c.CurrentState })
            .ToDictionaryAsync(c => c.Id);

        var result = claimItems.Select(cl => new
        {
            claimId        = cl.Id,
            claimNumber    = cl.ClaimNumber,
            caseId         = cl.CoverageCase_Id,
            caseNumber     = caseMap.TryGetValue(cl.CoverageCase_Id, out var cs) ? cs.CaseNumber : null,
            patientName    = caseMap.TryGetValue(cl.CoverageCase_Id, out var cs2) ? cs2.PatientName : null,
            insurerName    = caseMap.TryGetValue(cl.CoverageCase_Id, out var cs3) ? cs3.InsurerName : null,
            caseState      = caseMap.TryGetValue(cl.CoverageCase_Id, out var cs4) ? cs4.CurrentState : null,
            status         = cl.Status,
            claimedAmount  = cl.ClaimedAmount,
            submittedAt    = cl.SubmittedAt,
            ageInDays      = cl.SubmittedAt.HasValue
                ? (int)(DateTime.UtcNow - cl.SubmittedAt.Value).TotalDays
                : 0,
        });

        return await req.OkJsonAsync(result);
    }

    // ── GET /ccms/operations/settlement-queue ─────────────────────────────────
    // Cases with a submitted claim but no full settlement yet (outstanding > 0).
    [Function("GetSettlementQueue")]
    public async Task<HttpResponseData> GetSettlementQueue(
        [HttpTrigger(AuthorizationLevel.Anonymous, "get",
            Route = "ccms/operations/settlement-queue")] HttpRequestData req)
    {
        if (!_jwt.ValidateAndExtract(req, out var claims, out var err))
            return await req.UnauthorizedAsync(err);

        var tenantId = claims!.TenantId;

        // Cases in settlement-related states
        var settlementStates = new[] { "CLAIM_IN_PROCESS", "SETTLEMENT_PENDING", "PARTIAL_SETTLEMENT" };

        var settlementCases = await _db.CoverageCases
            .AsNoTracking()
            .Where(c => c.TenantId == tenantId && c.DeletedAt == null && settlementStates.Contains(c.CurrentState))
            .OrderBy(c => c.CaseNumber)
            .ToListAsync();

        if (settlementCases.Count == 0)
            return await req.OkJsonAsync(Array.Empty<object>());

        var caseIdList = settlementCases.Select(c => c.Id).ToList();

        // Aggregate settlement totals
        var settlementTotals = await _db.Settlements
            .AsNoTracking()
            .Where(s => caseIdList.Contains(s.CoverageCase_Id) && s.DeletedAt == null)
            .GroupBy(s => s.CoverageCase_Id)
            .Select(g => new
            {
                CaseId       = g.Key,
                TotalSettled = g.Sum(s => s.SettledAmount),
            })
            .ToDictionaryAsync(g => g.CaseId);

        // Get latest claim per case
        var latestClaims = await _db.ClaimPackets
            .AsNoTracking()
            .Where(cp => caseIdList.Contains(cp.CoverageCase_Id) && cp.DeletedAt == null)
            .GroupBy(cp => cp.CoverageCase_Id)
            .Select(g => new { CaseId = g.Key, Latest = g.OrderByDescending(x => x.CreatedAt).First() })
            .ToDictionaryAsync(g => g.CaseId, g => g.Latest);

        var result = settlementCases.Select(c =>
        {
            latestClaims.TryGetValue(c.Id, out var claim);
            settlementTotals.TryGetValue(c.Id, out var totals);

            var claimedAmt  = claim?.ClaimedAmount ?? 0;
            var settledAmt  = totals?.TotalSettled ?? 0;
            var outstanding = Math.Max(claimedAmt - settledAmt, 0);
            var oldestDate  = claim?.SubmittedAt ?? c.CreatedAt;
            var ageInDays   = (int)(DateTime.UtcNow - oldestDate).TotalDays;

            return new SettlementQueueItem
            {
                CaseId         = c.Id,
                CaseNumber     = c.CaseNumber,
                PatientName    = c.PatientName,
                InsurerName    = c.InsurerName,
                CaseState      = c.CurrentState,
                ClaimNumber    = claim?.ClaimNumber,
                ClaimId        = claim?.Id,
                ClaimedAmount  = claimedAmt,
                SettledAmount  = settledAmt,
                Outstanding    = outstanding,
                SubmittedAt    = claim?.SubmittedAt,
                AgeInDays      = ageInDays,
            };
        });

        return await req.OkJsonAsync(result);
    }

    // ── GET /ccms/analytics/summary ──────────────────────────────────────────
    // Summary metrics for the CCMS analytics page / reporting views
    [Function("GetAnalyticsSummary")]
    public async Task<HttpResponseData> GetAnalyticsSummary(
        [HttpTrigger(AuthorizationLevel.Anonymous, "get",
            Route = "ccms/analytics/summary")] HttpRequestData req)
    {
        if (!_jwt.ValidateAndExtract(req, out var claims, out var err))
            return await req.UnauthorizedAsync(err);

        var tenantId = claims!.TenantId;

        var cases = await _db.CoverageCases
            .AsNoTracking()
            .Where(c => c.TenantId == tenantId && c.DeletedAt == null)
            .ToListAsync();

        var settlements = await _db.Settlements
            .AsNoTracking()
            .Where(s => s.TenantId == tenantId && s.DeletedAt == null)
            .ToListAsync();

        var byState = cases.GroupBy(c => c.CurrentState)
            .Select(g => new { state = g.Key, count = g.Count() })
            .OrderByDescending(x => x.count)
            .ToList();

        var byPayer = cases.GroupBy(c => c.PayerType)
            .Select(g => new { payerType = g.Key, count = g.Count(), totalApproved = g.Sum(x => x.ApprovedAmount) })
            .OrderByDescending(x => x.count)
            .ToList();

        var totalApproved = cases.Sum(c => c.ApprovedAmount);
        var totalSettled  = settlements.Sum(s => s.SettledAmount);
        var totalOutstanding = totalApproved - totalSettled;

        // Monthly trend (last 6 months)
        var trend = Enumerable.Range(0, 6)
            .Select(i => DateTime.UtcNow.AddMonths(-i))
            .Select(mo => new
            {
                month = mo.ToString("yyyy-MM"),
                label = mo.ToString("MMM yy"),
                newCases    = cases.Count(c => c.CreatedAt.Year == mo.Year && c.CreatedAt.Month == mo.Month),
                closedCases = cases.Count(c => c.CurrentState is "CLOSED" or "RECONCILED"
                                            && c.UpdatedAt.Year == mo.Year && c.UpdatedAt.Month == mo.Month),
                settled     = settlements.Where(s => s.SettledAt.HasValue
                                                  && s.SettledAt.Value.Year == mo.Year
                                                  && s.SettledAt.Value.Month == mo.Month)
                                         .Sum(s => s.SettledAmount),
            })
            .OrderBy(x => x.month)
            .ToList();

        return await req.OkJsonAsync(new
        {
            summary = new
            {
                totalCases       = cases.Count,
                activeCases      = cases.Count(c => c.CurrentState is not ("CLOSED" or "CANCELLED" or "ABORTED")),
                closedCases      = cases.Count(c => c.CurrentState is "CLOSED" or "RECONCILED"),
                totalApproved    = Math.Round(totalApproved, 2),
                totalSettled     = Math.Round(totalSettled, 2),
                totalOutstanding = Math.Round(totalOutstanding, 2),
                approvalRate     = cases.Count == 0 ? 0 : Math.Round(
                    (double)cases.Count(c => c.CurrentState is "APPROVED" or "ADMISSION_READY" or "ADMITTED"
                        or "SURGERY_SCHEDULED" or "SURGERY_COMPLETED" or "BILL_PENDING" or "BILL_FINALIZED"
                        or "CLAIM_READY" or "CLAIM_SUBMITTED" or "CLAIM_IN_PROCESS" or "SETTLEMENT_PENDING"
                        or "PARTIAL_SETTLEMENT" or "FULL_SETTLEMENT" or "RECONCILED" or "CLOSED")
                    / cases.Count * 100, 1),
            },
            byState,
            byPayer,
            trend,
        });
    }
}

// ── DTOs ──────────────────────────────────────────────────────────────────────

public class PreAuthQueueItem
{
    public Guid     AuthId             { get; set; }
    public Guid     CaseCaseId         { get; set; }
    public Guid?    SessionId          { get; set; }   // for session-summaries enrichment
    public string?  CaseNumber         { get; set; }
    public string?  CaseState          { get; set; }
    public string?  PreAuthNumber      { get; set; }
    public string   Status             { get; set; } = string.Empty;
    public string?  ProcessStatus      { get; set; }
    public decimal  RequestedAmount    { get; set; }
    public decimal? ApprovedAmount     { get; set; }
    public string?  TpaReferenceNumber { get; set; }
    public DateTime? SubmittedAt       { get; set; }
    public DateTime? TpaResponseAt     { get; set; }
    public int      DaysWaiting        { get; set; }
    public string?  InsurerName        { get; set; }
    public string?  PatientName        { get; set; }
    /// <summary>Inbound TPA email with parser draft awaiting Record Response.</summary>
    public bool     HasInboundDraft    { get; set; }
}

public class SettlementQueueItem
{
    public Guid      CaseId        { get; set; }
    public string?   CaseNumber    { get; set; }
    public string?   PatientName   { get; set; }
    public string?   InsurerName   { get; set; }
    public string?   CaseState     { get; set; }
    public Guid?     ClaimId       { get; set; }
    public string?   ClaimNumber   { get; set; }
    public decimal   ClaimedAmount { get; set; }
    public decimal   SettledAmount { get; set; }
    public decimal   Outstanding   { get; set; }
    public DateTime? SubmittedAt   { get; set; }
    public int       AgeInDays     { get; set; }
}
