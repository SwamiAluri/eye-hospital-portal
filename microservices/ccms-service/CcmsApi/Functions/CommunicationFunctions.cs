using System.Net;
using System.Text.Json;
using CcmsApi.Services;
using Microsoft.Azure.Functions.Worker;
using Microsoft.Azure.Functions.Worker.Http;

namespace CcmsApi.Functions;

public class CommunicationFunctions
{
    private readonly CommunicationEngineService _svc;
    private readonly JwtService _jwt;

    public CommunicationFunctions(CommunicationEngineService svc, JwtService jwt)
    {
        _svc = svc;
        _jwt = jwt;
    }

    // POST /api/ccms/coverage-cases/{id}/communications
    [Function("LogCommunication")]
    public async Task<HttpResponseData> Log(
        [HttpTrigger(AuthorizationLevel.Anonymous, "post", Route = "ccms/coverage-cases/{id:guid}/communications")] HttpRequestData req, Guid id)
    {
        if (!_jwt.ValidateAndExtract(req, out var claims, out var err))
            return await req.UnauthorizedAsync(err);

        var body = await JsonSerializer.DeserializeAsync<LogCommunicationRequest>(req.Body);
        if (body is null) return req.CreateResponse(HttpStatusCode.BadRequest);

        var result = await _svc.LogAsync(id, claims!.UserId, body);
        var resp = req.CreateResponse(HttpStatusCode.Created);
        await resp.WriteAsJsonAsync(result);
        return resp;
    }

    // GET /api/ccms/coverage-cases/{id}/communications
    [Function("GetCommunications")]
    public async Task<HttpResponseData> GetForCase(
        [HttpTrigger(AuthorizationLevel.Anonymous, "get", Route = "ccms/coverage-cases/{id:guid}/communications")] HttpRequestData req, Guid id)
    {
        if (!_jwt.ValidateAndExtract(req, out var claims, out var err))
            return await req.UnauthorizedAsync(err);

        var list = await _svc.GetByCaseAsync(id);
        return await req.OkJsonAsync(list);
    }

    // GET /api/ccms/communication-templates?channel=
    [Function("GetCommunicationTemplates")]
    public async Task<HttpResponseData> GetTemplates(
        [HttpTrigger(AuthorizationLevel.Anonymous, "get", Route = "ccms/communication-templates")] HttpRequestData req)
    {
        if (!_jwt.ValidateAndExtract(req, out var claims, out var err))
            return await req.UnauthorizedAsync(err);

        var channel = req.Query["channel"];
        var list = await _svc.GetTemplatesAsync(claims!.TenantId, channel);
        return await req.OkJsonAsync(list);
    }
}
