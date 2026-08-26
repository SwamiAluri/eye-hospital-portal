using System.Net;
using CcmsApi.Services;
using Microsoft.Azure.Functions.Worker;
using Microsoft.Azure.Functions.Worker.Http;

namespace CcmsApi.Functions;

public class AnalyticsFunctions
{
    private readonly JourneyAnalyticsService _svc;
    private readonly JwtService _jwt;

    public AnalyticsFunctions(JourneyAnalyticsService svc, JwtService jwt)
    {
        _svc = svc;
        _jwt = jwt;
    }

    [Function("GetJourneyKpis")]
    public async Task<HttpResponseData> GetJourneyKpis(
        [HttpTrigger(AuthorizationLevel.Anonymous, "get", Route = "ccms/analytics/journey-kpis")] HttpRequestData req)
    {
        if (!_jwt.ValidateAndExtract(req, out var claims, out var err))
            return await req.UnauthorizedAsync(err);

        var snapshot = await _svc.GetSnapshotAsync(claims!.TenantId);
        var resp = req.CreateResponse(HttpStatusCode.OK);
        await resp.WriteAsJsonAsync(snapshot);
        return resp;
    }
}
