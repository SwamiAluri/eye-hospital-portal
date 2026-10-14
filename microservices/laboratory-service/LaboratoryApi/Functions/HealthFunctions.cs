using LaboratoryApi.Data;
using LaboratoryApi.Services;
using Microsoft.Azure.Functions.Worker;
using Microsoft.Azure.Functions.Worker.Http;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;

namespace LaboratoryApi.Functions;

/// <summary>
/// L-CAT-01A service foundation endpoints. No catalogue domain.
/// Routes live under /api/lms/* (host routePrefix = api).
/// </summary>
public class HealthFunctions
{
    private readonly LaboratoryDbContext _db;
    private readonly JwtService _jwt;
    private readonly TenantContext _tenantCtx;
    private readonly ILogger<HealthFunctions> _log;

    public HealthFunctions(
        LaboratoryDbContext db,
        JwtService jwt,
        TenantContext tenantCtx,
        ILogger<HealthFunctions> log)
    {
        _db = db;
        _jwt = jwt;
        _tenantCtx = tenantCtx;
        _log = log;
    }

    /// <summary>GET /api/lms/health — anonymous liveness/readiness probe.</summary>
    [Function("LmsHealth")]
    public async Task<HttpResponseData> Health(
        [HttpTrigger(AuthorizationLevel.Anonymous, "get", Route = "lms/health")] HttpRequestData req)
    {
        var dbOk = false;
        string? dbError = null;
        try
        {
            dbOk = await _db.Database.CanConnectAsync();
        }
        catch (Exception ex)
        {
            dbError = ex.GetType().Name;
            _log.LogWarning(ex, "LaboratoryApi health: database connectivity check failed");
        }

        return await req.OkJsonAsync(new
        {
            status = "ok",
            service = "LaboratoryApi",
            domain = "Enterprise LMS",
            slice = "L-CAT-01B",
            catalogueImplemented = true,
            database = new { reachable = dbOk, error = dbError },
            utc = DateTime.UtcNow,
        });
    }

    /// <summary>
    /// GET /api/lms/secure-ping — proves JWT + tenant + lms.view boundary.
    /// Does not expose Pathology laboratory.view.
    /// </summary>
    [Function("LmsSecurePing")]
    public async Task<HttpResponseData> SecurePing(
        [HttpTrigger(AuthorizationLevel.Anonymous, "get", Route = "lms/secure-ping")] HttpRequestData req)
    {
        if (!_jwt.ValidateAndExtract(req, out var claims, out var err))
            return await req.UnauthorizedAsync(err);

        if (await LaboratoryAuthz.ForbidUnlessAsync(req, claims!, LaboratoryAuthz.LmsView) is { } forbidden)
            return forbidden;

        return await req.OkJsonAsync(new
        {
            status = "ok",
            service = "LaboratoryApi",
            userId = claims!.UserId,
            tenantId = claims.TenantId,
            tenantContext = _tenantCtx.TenantId,
            requiredPermission = LaboratoryAuthz.LmsView,
        });
    }
}
