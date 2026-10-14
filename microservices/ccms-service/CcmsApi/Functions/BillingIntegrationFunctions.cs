using System.Net;
using System.Text.Json;
using CcmsApi.Data;
using CcmsApi.Services;
using Microsoft.Azure.Functions.Worker;
using Microsoft.Azure.Functions.Worker.Http;
using Microsoft.EntityFrameworkCore;

namespace CcmsApi.Functions;

public class BillingIntegrationFunctions
{
    private readonly CoverageAllocationEngine _svc;
    private readonly CcmsDbContext _db;
    private readonly JwtService _jwt;

    public BillingIntegrationFunctions(CoverageAllocationEngine svc, CcmsDbContext db, JwtService jwt)
    {
        _svc = svc;
        _db  = db;
        _jwt = jwt;
    }

    // POST /api/ccms/coverage-cases/{id}/billing/allocate
    [Function("AllocateBill")]
    public async Task<HttpResponseData> Allocate(
        [HttpTrigger(AuthorizationLevel.Anonymous, "post", Route = "ccms/coverage-cases/{id:guid}/billing/allocate")] HttpRequestData req, Guid id)
    {
        if (!_jwt.ValidateAndExtract(req, out var claims, out var err))
            return await req.UnauthorizedAsync(err);

        var body = await JsonSerializer.DeserializeAsync<AllocateBillRequest>(req.Body);
        if (body is null) return req.CreateResponse(HttpStatusCode.BadRequest);

        try
        {
            var result = await _svc.AllocateAsync(id, claims!.UserId, body);
            var resp = req.CreateResponse(HttpStatusCode.Created);
            await resp.WriteAsJsonAsync(result);
            return resp;
        }
        catch (KeyNotFoundException)
        {
            return req.CreateResponse(HttpStatusCode.NotFound);
        }
    }

    // GET /api/ccms/coverage-cases/{id}/billing
    [Function("GetBillingSummary")]
    public async Task<HttpResponseData> GetSummary(
        [HttpTrigger(AuthorizationLevel.Anonymous, "get", Route = "ccms/coverage-cases/{id:guid}/billing")] HttpRequestData req, Guid id)
    {
        if (!_jwt.ValidateAndExtract(req, out var claims, out var err))
            return await req.UnauthorizedAsync(err);
        if (await CcmsAuthz.ForbidUnlessAsync(req, claims!, "ccms.billing.read") is { } forbidden)
            return forbidden;

        var result = await _svc.GetByCaseIdAsync(id);
        if (result is null) return req.CreateResponse(HttpStatusCode.NotFound);
        return await req.OkJsonAsync(result);
    }

    // GET /api/ccms/billing-summaries/{id}/allocations
    [Function("GetCoverageAllocations")]
    public async Task<HttpResponseData> GetAllocations(
        [HttpTrigger(AuthorizationLevel.Anonymous, "get", Route = "ccms/billing-summaries/{id:guid}/allocations")] HttpRequestData req, Guid id)
    {
        if (!_jwt.ValidateAndExtract(req, out var claims, out var err))
            return await req.UnauthorizedAsync(err);
        if (await CcmsAuthz.ForbidUnlessAsync(req, claims!, "ccms.billing.read") is { } forbidden)
            return forbidden;

        var list = await _svc.GetAllocationsBySummaryAsync(id);
        return await req.OkJsonAsync(list);
    }

    // POST /api/ccms/coverage-cases/{id}/billing/import-from-bill
    // Pulls IP billing transaction lines for the case's journey/session and returns them
    // pre-formatted as AllocateBillRequest line items, ready for the allocation flow.
    [Function("ImportBillLines")]
    public async Task<HttpResponseData> ImportFromBill(
        [HttpTrigger(AuthorizationLevel.Anonymous, "post",
            Route = "ccms/coverage-cases/{id:guid}/billing/import-from-bill")] HttpRequestData req, Guid id)
    {
        if (!_jwt.ValidateAndExtract(req, out var claims, out var err))
            return await req.UnauthorizedAsync(err);

        var body = await System.Text.Json.JsonSerializer.DeserializeAsync<ImportBillRequest>(req.Body);

        // Resolve the coverage case to get journeyId / sessionId
        var coverageCase = await _db.CoverageCases
            .AsNoTracking()
            .FirstOrDefaultAsync(c => c.Id == id && c.TenantId == claims!.TenantId && c.DeletedAt == null);
        if (coverageCase is null) return req.CreateResponse(HttpStatusCode.NotFound);

        var journeyId = body?.JourneyId ?? coverageCase.JourneyId;
        var sessionId = body?.SessionId ?? coverageCase.SessionId;

        // Query ip_billing_transactions (joined from the shared DB schema, migration 82)
        // Returned as a draft AllocateBillRequest the FE can confirm/edit before calling allocate.
        List<BillingTransactionRow> rows;
        try
        {
            rows = await _db.Set<BillingTransactionRow>()
                .FromSqlRaw(
                    @"SELECT id, transaction_type AS ""TransactionType"", description AS ""Description"",
                             amount AS ""Amount"", false AS ""IsExcluded""
                      FROM ip_billing_transactions
                      WHERE tenant_id = {0}
                        AND deleted_at IS NULL
                        AND ({1}::uuid IS NULL OR patient_journey_id = {1}::uuid)
                      ORDER BY created_at",
                    claims!.TenantId,
                    journeyId?.ToString() ?? (object)DBNull.Value)
                .AsNoTracking()
                .ToListAsync();
        }
        catch
        {
            // ip_billing_transactions may not be in the CCMS DB; return empty draft
            rows = new List<BillingTransactionRow>();
        }

        var totalAmount = rows.Sum(r => r.Amount);
        var draft = new
        {
            billId         = body?.BillId,
            billDate       = DateTime.UtcNow.ToString("yyyy-MM-dd"),
            totalBillAmount = totalAmount,
            lineItems      = rows.Select(r => new
            {
                type         = r.TransactionType ?? "Other",
                description  = r.Description ?? "Billing line",
                billedAmount = r.Amount,
                isExcluded   = r.IsExcluded,
            }),
            sourceJourneyId = journeyId,
            sourceSessionId = sessionId,
            rowCount        = rows.Count,
        };

        return await req.OkJsonAsync(draft);
    }

    // GET /api/ccms/coverage-cases/{id}/billing/full
    [Function("GetBillingWithAllocations")]
    public async Task<HttpResponseData> GetWithAllocations(
        [HttpTrigger(AuthorizationLevel.Anonymous, "get",
            Route = "ccms/coverage-cases/{id:guid}/billing/full")] HttpRequestData req, Guid id)
    {
        if (!_jwt.ValidateAndExtract(req, out var claims, out var err))
            return await req.UnauthorizedAsync(err);
        if (await CcmsAuthz.ForbidUnlessAsync(req, claims!, "ccms.billing.read") is { } forbidden)
            return forbidden;

        var result = await _svc.GetWithAllocationsAsync(id);
        if (result is null) return req.CreateResponse(HttpStatusCode.NoContent);
        return await req.OkJsonAsync(result);
    }
}

// ── Supporting types ──────────────────────────────────────────────────────────

public record ImportBillRequest(
    Guid?    BillId,
    Guid?    JourneyId,
    Guid?    SessionId
);

/// <summary>Keyless entity for reading ip_billing_transactions rows via raw SQL.</summary>
public class BillingTransactionRow
{
    public Guid    Id              { get; set; }
    public string? TransactionType { get; set; }
    public string? Description     { get; set; }
    public decimal Amount          { get; set; }
    public bool    IsExcluded      { get; set; }
}
