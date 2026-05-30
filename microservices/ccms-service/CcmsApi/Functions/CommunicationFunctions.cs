using System.Net;
using System.Text.Json;
using CcmsApi.Services;
using Microsoft.Azure.Functions.Worker;
using Microsoft.Azure.Functions.Worker.Http;

namespace CcmsApi.Functions;

public class CommunicationFunctions
{
    private readonly CommunicationEngineService _svc;
    private readonly CommunicationDispatchService _dispatch;
    private readonly JwtService _jwt;

    public CommunicationFunctions(
        CommunicationEngineService svc,
        CommunicationDispatchService dispatch,
        JwtService jwt)
    {
        _svc = svc;
        _dispatch = dispatch;
        _jwt = jwt;
    }

    // POST /api/ccms/coverage-cases/{id}/communications
    [Function("LogCommunication")]
    public async Task<HttpResponseData> Log(
        [HttpTrigger(AuthorizationLevel.Anonymous, "post", Route = "ccms/coverage-cases/{id:guid}/communications")] HttpRequestData req, Guid id)
    {
        if (!_jwt.ValidateAndExtract(req, out var claims, out var err))
            return await req.UnauthorizedAsync(err);

        var body = await JsonSerializer.DeserializeAsync<LogCommunicationRequest>(req.Body, CcmsApi.Services.HttpRequestDataExtensions.DeserializeOpts);
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

    // POST /api/ccms/coverage-cases/{id}/communications/send
    [Function("SendCommunication")]
    public async Task<HttpResponseData> Send(
        [HttpTrigger(AuthorizationLevel.Anonymous, "post", Route = "ccms/coverage-cases/{id:guid}/communications/send")] HttpRequestData req, Guid id)
    {
        if (!_jwt.ValidateAndExtract(req, out var claims, out var err))
            return await req.UnauthorizedAsync(err);

        var body = await JsonSerializer.DeserializeAsync<SendCommunicationRequest>(req.Body, CcmsApi.Services.HttpRequestDataExtensions.DeserializeOpts);
        if (body is null || string.IsNullOrWhiteSpace(body.Channel) || string.IsNullOrWhiteSpace(body.RecipientType))
            return await req.BadRequestAsync("channel and recipientType are required.");

        try
        {
            var result = await _dispatch.SendAndLogAsync(id, claims!.UserId, body);
            // Always 200 when comm was logged — dispatch failure is reported via success:false
            var resp = req.CreateResponse(HttpStatusCode.OK);
            await resp.WriteAsJsonAsync(new
            {
                log = result.Log,
                success = result.Success,
                messageId = result.MessageId,
                error = result.Error,
            });
            return resp;
        }
        catch (KeyNotFoundException ex)
        {
            return await req.NotFoundAsync(ex.Message);
        }
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
