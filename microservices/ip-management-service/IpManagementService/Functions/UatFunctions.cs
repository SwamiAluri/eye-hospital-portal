using System.Net;
using System.Text.Json;
using System.Text.Json.Serialization;
using Microsoft.Azure.Functions.Worker;
using Microsoft.Azure.Functions.Worker.Http;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Hosting;
using IpManagementService.Services;
using IpManagementService.Services.Uat;

namespace IpManagementService.Functions;

public class UatFunctions
{
    private readonly UatDatasetService _seed;
    private readonly UatWorkflowSimulator _sim;
    private readonly JwtService _jwt;
    private readonly JourneyCommandAuthContext _commandAuth;
    private readonly IHostEnvironment _env;
    private readonly IConfiguration _config;

    private static readonly JsonSerializerOptions Json = new()
    {
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
        DefaultIgnoreCondition = JsonIgnoreCondition.WhenWritingNull,
    };

    public UatFunctions(
        UatDatasetService seed,
        UatWorkflowSimulator sim,
        JwtService jwt,
        JourneyCommandAuthContext commandAuth,
        IHostEnvironment env,
        IConfiguration config)
    {
        _seed = seed;
        _sim = sim;
        _jwt = jwt;
        _commandAuth = commandAuth;
        _env = env;
        _config = config;
    }

    [Function("UatStatus")]
    public async Task<HttpResponseData> Status(
        [HttpTrigger(AuthorizationLevel.Function, "get", Route = "dev/uat/status")]
        HttpRequestData req)
    {
        try
        {
            var (_, tenantId) = _jwt.ValidateAndExtract(req);
            var tid = _jwt.ExtractTenantId(req, tenantId);
            var branchId = RequireBranch(req);
            var dto = await _seed.StatusAsync(tid, branchId);
            return await Ok(req, dto);
        }
        catch (UnauthorizedAccessException ex) { return await Unauthorized(req, ex.Message); }
        catch (ArgumentException ex) { return await BadRequest(req, ex.Message); }
        catch (Exception ex) { return await Error(req, ex.Message); }
    }

    [Function("UatSeed")]
    public async Task<HttpResponseData> Seed(
        [HttpTrigger(AuthorizationLevel.Function, "post", Route = "dev/uat/seed")]
        HttpRequestData req)
        => await Run(req, (tid, branch, user) => _seed.SeedAsync(tid, branch, user));

    [Function("UatReset")]
    public async Task<HttpResponseData> Reset(
        [HttpTrigger(AuthorizationLevel.Function, "post", Route = "dev/uat/reset")]
        HttpRequestData req)
        => await Run(req, (tid, _, user) => _seed.ResetAsync(tid, user));

    [Function("UatReseed")]
    public async Task<HttpResponseData> Reseed(
        [HttpTrigger(AuthorizationLevel.Function, "post", Route = "dev/uat/reseed")]
        HttpRequestData req)
        => await Run(req, (tid, branch, user) => _seed.ReseedAsync(tid, branch, user));

    [Function("UatSimulate")]
    public async Task<HttpResponseData> Simulate(
        [HttpTrigger(AuthorizationLevel.Function, "post", Route = "dev/uat/simulate/{action}")]
        HttpRequestData req, string action)
    {
        try
        {
            Guard();
            var (userId, tenantId) = _jwt.ValidateAndExtract(req);
            _commandAuth.Bind(req, _jwt);
            var tid = _jwt.ExtractTenantId(req, tenantId);
            var branchId = RequireBranch(req);
            var body = await JsonSerializer.DeserializeAsync<UatSimulateRequest>(req.Body, Json)
                       ?? new UatSimulateRequest();
            body.Action = action;
            var result = await _sim.SimulateAsync(tid, branchId, userId, body);
            return await Ok(req, result);
        }
        catch (UnauthorizedAccessException ex) { return await Unauthorized(req, ex.Message); }
        catch (KeyNotFoundException ex) { return await NotFound(req, ex.Message); }
        catch (InvalidOperationException ex) { return await Conflict(req, ex.Message); }
        catch (ArgumentException ex) { return await BadRequest(req, ex.Message); }
        catch (Exception ex) { return await Error(req, ex.GetBaseException().Message); }
    }

    [Function("UatFailureFlags")]
    public async Task<HttpResponseData> Failures(
        [HttpTrigger(AuthorizationLevel.Function, "post", Route = "dev/uat/failures")]
        HttpRequestData req)
    {
        try
        {
            Guard();
            _jwt.ValidateAndExtract(req);
            var body = await JsonSerializer.DeserializeAsync<Dictionary<string, bool>>(req.Body, Json)
                       ?? new Dictionary<string, bool>();
            foreach (var kv in body)
                UatFailureFlags.Set(kv.Key, kv.Value);
            return await Ok(req, UatFailureFlags.Snapshot());
        }
        catch (UnauthorizedAccessException ex) { return await Unauthorized(req, ex.Message); }
        catch (Exception ex) { return await Error(req, ex.Message); }
    }

    private async Task<HttpResponseData> Run<T>(
        HttpRequestData req, Func<Guid, Guid, Guid, Task<T>> work)
    {
        try
        {
            Guard();
            var (userId, tenantId) = _jwt.ValidateAndExtract(req);
            _commandAuth.Bind(req, _jwt);
            var tid = _jwt.ExtractTenantId(req, tenantId);
            var branchId = RequireBranch(req);
            var payload = await work(tid, branchId, userId);
            return await Ok(req, payload!);
        }
        catch (UnauthorizedAccessException ex) { return await Unauthorized(req, ex.Message); }
        catch (ArgumentException ex) { return await BadRequest(req, ex.Message); }
        catch (Exception ex) { return await Error(req, ex.GetBaseException().Message); }
    }

    private void Guard() => UatEnvironment.EnsureEnabled(_env, _config);

    private static Guid RequireBranch(HttpRequestData req)
    {
        var qs = req.Url.Query;
        var q = qs.TrimStart('?').Split('&');
        foreach (var part in q)
        {
            var idx = part.IndexOf('=');
            if (idx <= 0) continue;
            var key = Uri.UnescapeDataString(part[..idx]);
            if (!key.Equals("branchId", StringComparison.OrdinalIgnoreCase)) continue;
            if (Guid.TryParse(Uri.UnescapeDataString(part[(idx + 1)..]), out var id))
                return id;
        }
        throw new ArgumentException("branchId is required.");
    }

    private static async Task<HttpResponseData> Ok(HttpRequestData req, object payload)
    {
        var r = req.CreateResponse(HttpStatusCode.OK);
        r.Headers.Add("Content-Type", "application/json; charset=utf-8");
        await r.WriteStringAsync(JsonSerializer.Serialize(payload, Json));
        return r;
    }

    private static async Task<HttpResponseData> BadRequest(HttpRequestData req, string message)
    {
        var r = req.CreateResponse(HttpStatusCode.BadRequest);
        await r.WriteAsJsonAsync(new { error = message });
        return r;
    }

    private static async Task<HttpResponseData> Unauthorized(HttpRequestData req, string message)
    {
        var r = req.CreateResponse(HttpStatusCode.Unauthorized);
        await r.WriteAsJsonAsync(new { error = message });
        return r;
    }

    private static async Task<HttpResponseData> NotFound(HttpRequestData req, string message)
    {
        var r = req.CreateResponse(HttpStatusCode.NotFound);
        await r.WriteAsJsonAsync(new { error = message });
        return r;
    }

    private static async Task<HttpResponseData> Conflict(HttpRequestData req, string message)
    {
        var r = req.CreateResponse(HttpStatusCode.Conflict);
        await r.WriteAsJsonAsync(new { error = message });
        return r;
    }

    private static async Task<HttpResponseData> Error(HttpRequestData req, string message)
    {
        var r = req.CreateResponse(HttpStatusCode.InternalServerError);
        await r.WriteAsJsonAsync(new { error = message });
        return r;
    }
}
