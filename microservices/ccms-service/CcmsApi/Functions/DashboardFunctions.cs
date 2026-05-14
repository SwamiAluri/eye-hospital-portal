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

        var list = await _db.CoverageCases
            .AsNoTracking()
            .Where(c => c.TenantId == claims!.TenantId
                && c.DeletedAt == null
                && pendingStates.Contains(c.CurrentState))
            .OrderBy(c => c.CreatedAt)
            .Take(50)
            .Select(c => new
            {
                caseId          = c.Id.ToString(),
                caseNumber      = c.CaseNumber,
                patientId       = c.PatientId.ToString(),
                payerName       = c.PayerType,
                requestedAmount = c.ApprovedAmount,
                currentState    = c.CurrentState,
                ageInHours      = (int)(now - c.CreatedAt).TotalHours,
                urgencyLevel    = (int)(now - c.CreatedAt).TotalHours > 48 ? "high" : "normal",
            })
            .ToListAsync();

        return await req.OkJsonAsync(list);
    }
}
