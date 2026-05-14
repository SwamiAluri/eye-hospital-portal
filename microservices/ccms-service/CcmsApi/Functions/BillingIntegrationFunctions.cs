using System.Net;
using System.Text.Json;
using CcmsApi.Services;
using Microsoft.Azure.Functions.Worker;
using Microsoft.Azure.Functions.Worker.Http;

namespace CcmsApi.Functions;

public class BillingIntegrationFunctions
{
    private readonly CoverageAllocationEngine _svc;
    private readonly JwtService _jwt;

    public BillingIntegrationFunctions(CoverageAllocationEngine svc, JwtService jwt)
    {
        _svc = svc;
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

        var list = await _svc.GetAllocationsBySummaryAsync(id);
        return await req.OkJsonAsync(list);
    }
}
