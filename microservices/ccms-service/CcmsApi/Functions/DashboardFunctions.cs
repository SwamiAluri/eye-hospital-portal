using System.Net;
using CcmsApi.Data;
using CcmsApi.Services;
using Microsoft.Azure.Functions.Worker;
using Microsoft.Azure.Functions.Worker.Http;
using Microsoft.EntityFrameworkCore;

namespace CcmsApi.Functions;

public class DashboardFunctions
{
    private readonly CcmsDbContext _db;
    private readonly JwtService _jwt;

    public DashboardFunctions(CcmsDbContext db, JwtService jwt)
    {
        _db  = db;
        _jwt = jwt;
    }

    // GET /api/ccms/dashboard/summary
    [Function("CcmsDashboardSummary")]
    public async Task<HttpResponseData> Summary(
        [HttpTrigger(AuthorizationLevel.Anonymous, "get", Route = "ccms/dashboard/summary")] HttpRequestData req)
    {
        if (!_jwt.ValidateAndExtract(req, out var claims, out var err))
            return await req.UnauthorizedAsync(err);

        var tenantId = claims!.TenantId;
        var terminalStates = new[] { "CLOSED", "REJECTED", "CANCELLED" };
        var preAuthPendingStates = new[] { "PREAUTH_GENERATED", "PREAUTH_SENT", "WAITING_APPROVAL", "CLARIFICATION_REQUIRED", "RESUBMITTED" };
        var approvedStates = new[] { "APPROVED", "PARTIAL_APPROVAL", "FULL_SETTLEMENT", "RECONCILED" };
        var now = DateTime.UtcNow;
        var mtdStart = new DateTime(now.Year, now.Month, 1, 0, 0, 0, DateTimeKind.Utc);

        var allCases = await _db.CoverageCases
            .AsNoTracking()
            .Where(c => c.TenantId == tenantId && c.DeletedAt == null)
            .Select(c => new { c.CurrentState, c.ApprovedAmount, c.CreatedAt })
            .ToListAsync();

        var totalActiveCases = allCases.Count(c => !terminalStates.Contains(c.CurrentState));
        var pendingPreAuths  = allCases.Count(c => preAuthPendingStates.Contains(c.CurrentState));
        var totalCases       = allCases.Count;
        var rejectedCases    = allCases.Count(c => c.CurrentState == "REJECTED");
        var rejectionRatePct = totalCases > 0 ? Math.Round((double)rejectedCases / totalCases * 100, 1) : 0.0;

        var totalApprovedMtd = allCases
            .Where(c => approvedStates.Contains(c.CurrentState) && c.CreatedAt >= mtdStart)
            .Sum(c => c.ApprovedAmount);

        var totalSettledMtd = await _db.Settlements
            .AsNoTracking()
            .Where(s => s.TenantId == tenantId && s.DeletedAt == null && s.CreatedAt >= mtdStart)
            .SumAsync(s => s.SettledAmount);

        var pendingClaims = await _db.ClaimPackets
            .AsNoTracking()
            .Where(c => c.TenantId == tenantId && c.DeletedAt == null
                && !new[] { "FULL_SETTLEMENT", "RECONCILED", "CLOSED" }.Contains(c.Status))
            .CountAsync();

        var pendingSettlements = await _db.Settlements
            .AsNoTracking()
            .Where(s => s.TenantId == tenantId && s.DeletedAt == null
                && s.ReconciliationStatus == "pending")
            .CountAsync();

        var summary = new
        {
            totalActiveCases         = totalActiveCases,
            pendingPreAuths          = pendingPreAuths,
            pendingClaims            = pendingClaims,
            pendingSettlements       = pendingSettlements,
            totalApprovedAmountMtd   = totalApprovedMtd,
            totalSettledAmountMtd    = totalSettledMtd,
            avgPreAuthTurnaroundHours = 0,
            rejectionRatePct         = rejectionRatePct,
        };

        return await req.OkJsonAsync(summary);
    }

    // GET /api/ccms/dashboard/pending-preauths
    [Function("CcmsPendingPreAuths")]
    public async Task<HttpResponseData> PendingPreAuths(
        [HttpTrigger(AuthorizationLevel.Anonymous, "get", Route = "ccms/dashboard/pending-preauths")] HttpRequestData req)
    {
        if (!_jwt.ValidateAndExtract(req, out var claims, out var err))
            return await req.UnauthorizedAsync(err);

        var pendingStates = new[] { "PREAUTH_GENERATED", "PREAUTH_SENT", "WAITING_APPROVAL", "CLARIFICATION_REQUIRED", "RESUBMITTED" };
        var now = DateTime.UtcNow;

        // Load cases + their latest authorization's requested amount
        var cases = await _db.CoverageCases
            .AsNoTracking()
            .Where(c => c.TenantId == claims!.TenantId
                && c.DeletedAt == null
                && pendingStates.Contains(c.CurrentState))
            .OrderBy(c => c.CreatedAt)
            .Take(50)
            .Select(c => new
            {
                caseId          = c.Id.ToString(),
                caseId_guid     = c.Id,
                caseNumber      = c.CaseNumber,
                patientId       = c.PatientId.ToString(),
                patientName     = c.PatientName,
                payerName       = c.InsurerName ?? c.PayerType,
                currentState    = c.CurrentState,
                ageInHours      = (int)(now - c.CreatedAt).TotalHours,
                urgencyLevel    = (int)(now - c.CreatedAt).TotalHours > 48 ? "high" : "normal",
                counsellorDraftJson = c.CounsellorDraftJson,
            })
            .ToListAsync();

        // Enrich with requested amount from authorizations
        var caseGuids = cases.Select(c => c.caseId_guid).ToList();
        var authAmounts = await _db.CoverageAuthorizations
            .AsNoTracking()
            .Where(a => a.TenantId == claims!.TenantId
                && a.DeletedAt == null
                && caseGuids.Contains(a.CoverageCase_Id))
            .GroupBy(a => a.CoverageCase_Id)
            .Select(g => new { CaseId = g.Key, RequestedAmount = g.Max(a => a.RequestedAmount) })
            .ToDictionaryAsync(x => x.CaseId, x => x.RequestedAmount);

        var list = cases.Select(c =>
        {
            // Requested amount: authorization > draft JSON > 0
            decimal reqAmt = 0;
            if (authAmounts.TryGetValue(c.caseId_guid, out var authAmt) && authAmt > 0)
            {
                reqAmt = authAmt;
            }
            else if (!string.IsNullOrEmpty(c.counsellorDraftJson))
            {
                try
                {
                    using var doc = System.Text.Json.JsonDocument.Parse(c.counsellorDraftJson);
                    foreach (var key in new[] { "estimatedAmount", "sessionPackageRate", "EstimatedAmount" })
                    {
                        if (doc.RootElement.TryGetProperty(key, out var val)
                            && val.ValueKind == System.Text.Json.JsonValueKind.Number
                            && val.TryGetDecimal(out var d) && d > 0)
                        {
                            reqAmt = d;
                            break;
                        }
                    }
                }
                catch { /* ignore */ }
            }

            return new
            {
                caseId          = c.caseId,
                caseNumber      = c.caseNumber,
                patientId       = c.patientId,
                patientName     = c.patientName,
                payerName       = c.payerName,
                requestedAmount = reqAmt,
                currentState    = c.currentState,
                ageInHours      = c.ageInHours,
                urgencyLevel    = c.urgencyLevel,
            };
        }).ToList();

        return await req.OkJsonAsync(list);
    }

    // GET /api/ccms/dashboard/state-distribution
    [Function("CcmsDashboardStateDistribution")]
    public async Task<HttpResponseData> StateDistribution(
        [HttpTrigger(AuthorizationLevel.Anonymous, "get", Route = "ccms/dashboard/state-distribution")] HttpRequestData req)
    {
        if (!_jwt.ValidateAndExtract(req, out var claims, out var err))
            return await req.UnauthorizedAsync(err);

        var counts = await _db.CoverageCases
            .AsNoTracking()
            .Where(c => c.TenantId == claims!.TenantId && c.DeletedAt == null)
            .GroupBy(c => c.CurrentState)
            .Select(g => new { state = g.Key, count = g.Count() })
            .ToListAsync();

        var total = counts.Sum(c => c.count);
        var list = counts
            .OrderByDescending(c => c.count)
            .Select(c => new
            {
                state = c.state,
                count = c.count,
                percentage = total == 0 ? 0 : Math.Round(c.count * 100.0 / total, 1),
            })
            .ToList();

        return await req.OkJsonAsync(list);
    }

    // GET /api/ccms/dashboard/cash-flow
    [Function("CcmsDashboardCashFlow")]
    public async Task<HttpResponseData> CashFlow(
        [HttpTrigger(AuthorizationLevel.Anonymous, "get", Route = "ccms/dashboard/cash-flow")] HttpRequestData req)
    {
        if (!_jwt.ValidateAndExtract(req, out var claims, out var err))
            return await req.UnauthorizedAsync(err);

        var tenantId = claims!.TenantId;
        var claimsRows = await _db.ClaimPackets
            .AsNoTracking()
            .Where(c => c.TenantId == tenantId && c.DeletedAt == null)
            .Select(c => new { At = c.SubmittedAt ?? c.CreatedAt, c.ClaimedAmount })
            .ToListAsync();

        var settlements = await _db.Settlements
            .AsNoTracking()
            .Where(s => s.TenantId == tenantId && s.DeletedAt == null)
            .Select(s => new { At = s.SettledAt ?? s.CreatedAt, s.SettledAmount })
            .ToListAsync();

        var months = Enumerable.Range(0, 6)
            .Select(i => DateTime.UtcNow.AddMonths(-5 + i))
            .Select(mo => new DateTime(mo.Year, mo.Month, 1, 0, 0, 0, DateTimeKind.Utc))
            .ToList();

        var list = months.Select(mo =>
        {
            var next = mo.AddMonths(1);
            var claimed = claimsRows.Where(c => c.At >= mo && c.At < next).Sum(c => c.ClaimedAmount);
            var settled = settlements.Where(s => s.At >= mo && s.At < next).Sum(s => s.SettledAmount);
            return new
            {
                period = mo.ToString("MMM yyyy"),
                claimed,
                settled,
                pending = Math.Max(claimed - settled, 0),
            };
        }).ToList();

        return await req.OkJsonAsync(list);
    }
}
