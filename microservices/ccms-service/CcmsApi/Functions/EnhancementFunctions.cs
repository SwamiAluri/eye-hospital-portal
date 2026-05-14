using System.Net;
using System.Text.Json;
using CcmsApi.Services;
using Microsoft.Azure.Functions.Worker;
using Microsoft.Azure.Functions.Worker.Http;

namespace CcmsApi.Functions;

public class EnhancementFunctions
{
    private readonly EnhancementService _svc;
    private readonly JwtService _jwt;

    public EnhancementFunctions(EnhancementService svc, JwtService jwt)
    {
        _svc = svc;
        _jwt = jwt;
    }

    // GET /api/ccms/coverage-cases/{id}/enhancements
    [Function("ListEnhancements")]
    public async Task<HttpResponseData> List(
        [HttpTrigger(AuthorizationLevel.Anonymous, "get", Route = "ccms/coverage-cases/{id:guid}/enhancements")] HttpRequestData req, Guid id)
    {
        if (!_jwt.ValidateAndExtract(req, out var claims, out var err))
            return await req.UnauthorizedAsync(err);

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

        var body = await JsonSerializer.DeserializeAsync<CreateEnhancementRequest>(req.Body);
        if (body is null) return req.CreateResponse(HttpStatusCode.BadRequest);

        var result = await _svc.CreateAsync(id, claims!.UserId, body);
        var resp = req.CreateResponse(HttpStatusCode.Created);
        await resp.WriteAsJsonAsync(result);
        return resp;
    }

    // POST /api/ccms/enhancements/{id}/decide
    [Function("DecideEnhancement")]
    public async Task<HttpResponseData> Decide(
        [HttpTrigger(AuthorizationLevel.Anonymous, "post", Route = "ccms/enhancements/{id:guid}/decide")] HttpRequestData req, Guid id)
    {
        if (!_jwt.ValidateAndExtract(req, out var claims, out var err))
            return await req.UnauthorizedAsync(err);

        var body = await JsonSerializer.DeserializeAsync<DecideEnhancementRequest>(req.Body);
        if (body is null) return req.CreateResponse(HttpStatusCode.BadRequest);

        var result = await _svc.DecideAsync(id, claims!.UserId, body);
        return await req.OkJsonAsync(result);
    }
}
