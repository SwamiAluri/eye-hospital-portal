using System.Net;
using System.Text.Json;
using Microsoft.Azure.Functions.Worker;
using Microsoft.Azure.Functions.Worker.Http;
using Microsoft.Extensions.Caching.Memory;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using CcmsApi.Services;

namespace CcmsApi.Functions;

/// <summary>
/// Runtime admin configuration endpoints.
/// GET /api/ccms/admin/config   — read current runtime settings
/// PUT /api/ccms/admin/config   — update runtime settings (workflow admin only)
/// </summary>
public class AdminFunctions
{
    private readonly JwtService _jwt;
    private readonly IMemoryCache _cache;
    private readonly IConfiguration _config;
    private readonly ILogger<AdminFunctions> _log;

    private const string ConfigCacheKey = "ccms:admin:config";

    public AdminFunctions(
        JwtService jwt,
        IMemoryCache cache,
        IConfiguration config,
        ILogger<AdminFunctions> log)
    {
        _jwt    = jwt;
        _cache  = cache;
        _config = config;
        _log    = log;
    }

    [Function("GetAdminConfig")]
    public async Task<HttpResponseData> GetConfig(
        [HttpTrigger(AuthorizationLevel.Anonymous, "get", Route = "ccms/admin/config")] HttpRequestData req)
    {
        if (!_jwt.ValidateAndExtract(req, out var claims, out var err))
            return await req.UnauthorizedAsync(err);

        var cfg = GetEffectiveConfig();
        return await req.OkJsonAsync(cfg);
    }

    [Function("PutAdminConfig")]
    public async Task<HttpResponseData> PutConfig(
        [HttpTrigger(AuthorizationLevel.Anonymous, "put", Route = "ccms/admin/config")] HttpRequestData req)
    {
        if (!_jwt.ValidateAndExtract(req, out var claims, out var err))
            return await req.UnauthorizedAsync(err);

        // Require workflow admin permission
        var permissions = claims?.SafePermissions ?? Array.Empty<string>();
        if (!permissions.Contains("ccms.workflow.admin") && !permissions.Contains("*"))
        {
            _log.LogWarning("Unauthorised attempt to change CCMS config by user {UserId}", claims?.UserId);
            return req.CreateResponse(HttpStatusCode.Forbidden);
        }

        CcmsRuntimeConfig? body;
        try
        {
            body = await JsonSerializer.DeserializeAsync<CcmsRuntimeConfig>(req.Body);
        }
        catch
        {
            return req.CreateResponse(HttpStatusCode.BadRequest);
        }
        if (body is null) return req.CreateResponse(HttpStatusCode.BadRequest);

        // Cache for 24 h (in a production system, persist to DB or Azure App Config)
        _cache.Set(ConfigCacheKey, body, TimeSpan.FromHours(24));
        _log.LogInformation("CCMS admin config updated by user {UserId}", claims!.UserId);

        return await req.OkJsonAsync(body);
    }

    private CcmsRuntimeConfig GetEffectiveConfig()
    {
        if (_cache.TryGetValue<CcmsRuntimeConfig>(ConfigCacheKey, out var cached) && cached is not null)
            return cached;

        // Build from appsettings / env
        return new CcmsRuntimeConfig
        {
            AdmissionValidation = new AdmissionValidationConfig
            {
                Mode                      = _config["Ccms:AdmissionValidation:Mode"] ?? "fail_open",
                WarningOnMissingPreauth   = bool.TryParse(_config["Ccms:AdmissionValidation:WarnMissingPreauth"], out var w) && w,
                BlockOnExpiredPreauth     = bool.TryParse(_config["Ccms:AdmissionValidation:BlockExpired"], out var b) && b,
                BypassRoles               = (_config["Ccms:AdmissionValidation:BypassRoles"] ?? "admin,super_admin").Split(',').ToList(),
            },
            Integrations = new IntegrationConfig
            {
                BillingImportEnabled           = !bool.TryParse(_config["Ccms:Integrations:BillingImportDisabled"], out var bi) || !bi,
                NotificationDispatchEnabled    = !bool.TryParse(_config["Ccms:Integrations:NotificationsDisabled"], out var nd) || !nd,
            },
            Workflow = new WorkflowConfig
            {
                AutoDraftOnCounselingComplete  = !bool.TryParse(_config["Ccms:Workflow:AutoDraftDisabled"], out var ad) || !ad,
                AutoPreauthOnAdmission         = bool.TryParse(_config["Ccms:Workflow:AutoPreauthOnAdmission"], out var ap) && ap,
            },
        };
    }
}

// ── Config model ──────────────────────────────────────────────────────────────

public record CcmsRuntimeConfig
{
    public AdmissionValidationConfig AdmissionValidation { get; init; } = new();
    public IntegrationConfig          Integrations        { get; init; } = new();
    public WorkflowConfig             Workflow            { get; init; } = new();
}

public record AdmissionValidationConfig
{
    public string       Mode                    { get; init; } = "fail_open";
    public bool         WarningOnMissingPreauth { get; init; } = true;
    public bool         BlockOnExpiredPreauth   { get; init; } = false;
    public List<string> BypassRoles             { get; init; } = new();
}

public record IntegrationConfig
{
    public bool BillingImportEnabled        { get; init; } = true;
    public bool NotificationDispatchEnabled { get; init; } = true;
}

public record WorkflowConfig
{
    public bool AutoDraftOnCounselingComplete { get; init; } = true;
    public bool AutoPreauthOnAdmission        { get; init; } = false;
}
