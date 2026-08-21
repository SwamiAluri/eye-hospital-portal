using System.Net;
using System.Text.Json;
using CcmsApi.Services;
using Microsoft.Azure.Functions.Worker;
using Microsoft.Azure.Functions.Worker.Http;

namespace CcmsApi.Functions;

public class EnhancementFunctions
{
    private static readonly JsonSerializerOptions JsonOpts = new() { PropertyNameCaseInsensitive = true };

    private readonly EnhancementService _svc;
    private readonly JwtService _jwt;

    public EnhancementFunctions(EnhancementService svc, JwtService jwt)
    {
        _svc = svc;
        _jwt = jwt;
    }

    // GET /api/ccms/enhancements?status=active|submitted|approved|rejected|all&take=100
    [Function("ListOpenEnhancements")]
    public async Task<HttpResponseData> ListOpen(
        [HttpTrigger(AuthorizationLevel.Anonymous, "get", Route = "ccms/enhancements")] HttpRequestData req)
    {
        if (!_jwt.ValidateAndExtract(req, out var claims, out var err))
            return await req.UnauthorizedAsync(err);

        if (await CcmsAuthz.ForbidUnlessAsync(req, claims!,
                "ccms.enhancement.write", "ccms.authorization.read", "ccms.preauth.process",
                "ccms.coverage_case.read", "ccms.workflow.admin") is { } forbidden)
            return forbidden;

        var status = req.Query["status"];
        var take = int.TryParse(req.Query["take"], out var t) ? t : 100;

        var list = await _svc.ListAsync(claims!.TenantId, status, take);
        return await req.OkJsonAsync(list);
    }

    // GET /api/ccms/coverage-cases/{id}/enhancement-gap?eligibleAmount=12345
    [Function("EvaluateEnhancementGap")]
    public async Task<HttpResponseData> EvaluateGap(
        [HttpTrigger(AuthorizationLevel.Anonymous, "get", Route = "ccms/coverage-cases/{id:guid}/enhancement-gap")] HttpRequestData req,
        Guid id)
    {
        if (!_jwt.ValidateAndExtract(req, out var claims, out var err))
            return await req.UnauthorizedAsync(err);

        if (await CcmsAuthz.ForbidUnlessAsync(req, claims!,
                "ccms.enhancement.write", "ccms.authorization.read", "ccms.preauth.process",
                "ccms.coverage_case.read", "ccms.workflow.admin") is { } forbidden)
            return forbidden;

        if (!decimal.TryParse(req.Query["eligibleAmount"], out var eligible))
            return req.CreateResponse(HttpStatusCode.BadRequest);

        try
        {
            var gap = await _svc.EvaluateGapForCaseAsync(id, eligible);
            return await req.OkJsonAsync(gap);
        }
        catch (KeyNotFoundException)
        {
            return req.CreateResponse(HttpStatusCode.NotFound);
        }
    }

    // GET /api/ccms/coverage-cases/{id}/enhancements
    [Function("ListEnhancements")]
    public async Task<HttpResponseData> List(
        [HttpTrigger(AuthorizationLevel.Anonymous, "get", Route = "ccms/coverage-cases/{id:guid}/enhancements")] HttpRequestData req, Guid id)
    {
        if (!_jwt.ValidateAndExtract(req, out var claims, out var err))
            return await req.UnauthorizedAsync(err);

        if (await CcmsAuthz.ForbidUnlessAsync(req, claims!,
                "ccms.enhancement.write", "ccms.authorization.read", "ccms.preauth.process",
                "ccms.coverage_case.read", "ccms.workflow.admin") is { } forbidden)
            return forbidden;

        var list = await _svc.GetByCaseIdAsync(id);
        return await req.OkJsonAsync(list);
    }

    // POST /api/ccms/coverage-cases/{id}/enhancements
    [Function("CreateEnhancement")]
    public async Task<HttpResponseData> Create(
        [HttpTrigger(AuthorizationLevel.Anonymous, "post", Route = "ccms/coverage-cases/{id:guid}/enhancements")] HttpRequestData req, Guid id)
    {
        if (!_jwt.ValidateAndExtract(req, out var claims, out var err))
            return await req.UnauthorizedAsync(err);

        if (await CcmsAuthz.ForbidUnlessAsync(req, claims!,
                "ccms.enhancement.write", "ccms.preauth.process", "ccms.workflow.admin") is { } forbidden)
            return forbidden;

        var body = await JsonSerializer.DeserializeAsync<CreateEnhancementRequest>(req.Body, JsonOpts);
        if (body is null) return req.CreateResponse(HttpStatusCode.BadRequest);

        try
        {
            var result = await _svc.CreateAsync(id, claims!.UserId, body);
            var resp = req.CreateResponse(HttpStatusCode.Created);
            await resp.WriteAsJsonAsync(result);
            return resp;
        }
        catch (KeyNotFoundException)
        {
            return req.CreateResponse(HttpStatusCode.NotFound);
        }
        catch (ArgumentException ex)
        {
            var bad = req.CreateResponse(HttpStatusCode.BadRequest);
            await bad.WriteAsJsonAsync(new { message = ex.Message });
            return bad;
        }
        catch (InvalidOperationException ex)
        {
            var conflict = req.CreateResponse(HttpStatusCode.Conflict);
            await conflict.WriteAsJsonAsync(new { message = ex.Message });
            return conflict;
        }
    }

    // POST /api/ccms/enhancements/{id}/submit
    [Function("SubmitEnhancement")]
    public async Task<HttpResponseData> Submit(
        [HttpTrigger(AuthorizationLevel.Anonymous, "post", Route = "ccms/enhancements/{id:guid}/submit")] HttpRequestData req, Guid id)
    {
        if (!_jwt.ValidateAndExtract(req, out var claims, out var err))
            return await req.UnauthorizedAsync(err);

        if (await CcmsAuthz.ForbidUnlessAsync(req, claims!,
                "ccms.enhancement.write", "ccms.preauth.process", "ccms.workflow.admin") is { } forbidden)
            return forbidden;

        var body = await JsonSerializer.DeserializeAsync<SubmitEnhancementRequest>(req.Body, JsonOpts)
                   ?? new SubmitEnhancementRequest(null, null);

        try
        {
            var result = await _svc.SubmitToTpaAsync(id, claims!.UserId, body);
            return await req.OkJsonAsync(result);
        }
        catch (KeyNotFoundException)
        {
            return req.CreateResponse(HttpStatusCode.NotFound);
        }
        catch (InvalidOperationException ex)
        {
            var conflict = req.CreateResponse(HttpStatusCode.Conflict);
            await conflict.WriteAsJsonAsync(new { message = ex.Message });
            return conflict;
        }
    }

    // POST /api/ccms/enhancements/{id}/decide
    [Function("DecideEnhancement")]
    public async Task<HttpResponseData> Decide(
        [HttpTrigger(AuthorizationLevel.Anonymous, "post", Route = "ccms/enhancements/{id:guid}/decide")] HttpRequestData req, Guid id)
    {
        if (!_jwt.ValidateAndExtract(req, out var claims, out var err))
            return await req.UnauthorizedAsync(err);

        if (await CcmsAuthz.ForbidUnlessAsync(req, claims!,
                "ccms.enhancement.write", "ccms.preauth.process", "ccms.workflow.admin") is { } forbidden)
            return forbidden;

        var body = await JsonSerializer.DeserializeAsync<DecideEnhancementRequest>(req.Body, JsonOpts);
        if (body is null) return req.CreateResponse(HttpStatusCode.BadRequest);

        try
        {
            var result = await _svc.DecideAsync(id, claims!.UserId, body);
            return await req.OkJsonAsync(result);
        }
        catch (KeyNotFoundException)
        {
            return req.CreateResponse(HttpStatusCode.NotFound);
        }
        catch (ArgumentException ex)
        {
            var bad = req.CreateResponse(HttpStatusCode.BadRequest);
            await bad.WriteAsJsonAsync(new { message = ex.Message });
            return bad;
        }
        catch (InvalidOperationException ex)
        {
            var conflict = req.CreateResponse(HttpStatusCode.Conflict);
            await conflict.WriteAsJsonAsync(new { message = ex.Message });
            return conflict;
        }
    }
}
