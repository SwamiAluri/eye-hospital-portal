using System.Net;
using System.Text.Json;
using CcmsApi.Services;
using Microsoft.Azure.Functions.Worker;
using Microsoft.Azure.Functions.Worker.Http;

namespace CcmsApi.Functions;

public class SettlementFunctions
{
    private readonly SettlementReconciliationService _svc;
    private readonly JwtService _jwt;

    public SettlementFunctions(SettlementReconciliationService svc, JwtService jwt)
    {
        _svc = svc;
        _jwt = jwt;
    }

    // POST /api/ccms/coverage-cases/{id}/settlements
    [Function("RecordSettlement")]
    public async Task<HttpResponseData> Record(
        [HttpTrigger(AuthorizationLevel.Anonymous, "post", Route = "ccms/coverage-cases/{id:guid}/settlements")] HttpRequestData req, Guid id)
    {
        if (!_jwt.ValidateAndExtract(req, out var claims, out var err))
            return await req.UnauthorizedAsync(err);

        var body = await JsonSerializer.DeserializeAsync<RecordSettlementRequest>(req.Body);
        if (body is null) return req.CreateResponse(HttpStatusCode.BadRequest);

        try
        {
            var result = await _svc.RecordSettlementAsync(id, claims!.UserId, body);
            var resp = req.CreateResponse(HttpStatusCode.Created);
            await resp.WriteAsJsonAsync(result);
            return resp;
        }
        catch (KeyNotFoundException)
        {
            return req.CreateResponse(HttpStatusCode.NotFound);
        }
        catch (InvalidOperationException ex)
        {
            var resp = req.CreateResponse(HttpStatusCode.UnprocessableEntity);
            await resp.WriteAsJsonAsync(new { error = ex.Message });
            return resp;
        }
    }

    // GET /api/ccms/coverage-cases/{id}/settlements
    [Function("GetSettlements")]
    public async Task<HttpResponseData> GetForCase(
        [HttpTrigger(AuthorizationLevel.Anonymous, "get", Route = "ccms/coverage-cases/{id:guid}/settlements")] HttpRequestData req, Guid id)
    {
        if (!_jwt.ValidateAndExtract(req, out var claims, out var err))
            return await req.UnauthorizedAsync(err);

        var list = await _svc.GetByCaseIdAsync(id);
        return await req.OkJsonAsync(list);
    }

    // POST /api/ccms/coverage-cases/{id}/reconcile
    [Function("ReconcileCase")]
    public async Task<HttpResponseData> Reconcile(
        [HttpTrigger(AuthorizationLevel.Anonymous, "post", Route = "ccms/coverage-cases/{id:guid}/reconcile")] HttpRequestData req, Guid id)
    {
        if (!_jwt.ValidateAndExtract(req, out var claims, out var err))
            return await req.UnauthorizedAsync(err);

        try
        {
            await _svc.ReconcileAsync(id, claims!.UserId);
            return req.CreateResponse(HttpStatusCode.NoContent);
        }
        catch (KeyNotFoundException)
        {
            return req.CreateResponse(HttpStatusCode.NotFound);
        }
        catch (InvalidOperationException ex)
        {
            var resp = req.CreateResponse(HttpStatusCode.UnprocessableEntity);
            await resp.WriteAsJsonAsync(new { error = ex.Message });
            return resp;
        }
    }

    // POST /api/ccms/coverage-cases/{id}/close
    [Function("CloseCoverageCase")]
    public async Task<HttpResponseData> CloseCase(
        [HttpTrigger(AuthorizationLevel.Anonymous, "post", Route = "ccms/coverage-cases/{id:guid}/close")] HttpRequestData req, Guid id)
    {
        if (!_jwt.ValidateAndExtract(req, out var claims, out var err))
            return await req.UnauthorizedAsync(err);

        try
        {
            await _svc.CloseCaseAsync(id, claims!.UserId);
            return req.CreateResponse(HttpStatusCode.NoContent);
        }
        catch (KeyNotFoundException)
        {
            return req.CreateResponse(HttpStatusCode.NotFound);
        }
        catch (InvalidOperationException ex)
        {
            var resp = req.CreateResponse(HttpStatusCode.UnprocessableEntity);
            await resp.WriteAsJsonAsync(new { error = ex.Message });
            return resp;
        }
    }

    // GET /api/ccms/settlements/aging
    [Function("GetSettlementAging")]
    public async Task<HttpResponseData> GetAging(
        [HttpTrigger(AuthorizationLevel.Anonymous, "get", Route = "ccms/settlements/aging")] HttpRequestData req)
    {
        if (!_jwt.ValidateAndExtract(req, out var claims, out var err))
            return await req.UnauthorizedAsync(err);

        var report = await _svc.GetAgingReportAsync();
        return await req.OkJsonAsync(report);
    }
}
