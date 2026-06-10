using System.Net;
using System.Text.Json;
using System.Text.Json.Serialization;
using Microsoft.Azure.Functions.Worker;
using Microsoft.Azure.Functions.Worker.Http;
using IpManagementService.Models.Dtos;
using IpManagementService.Services;

namespace IpManagementService.Functions;

public class WardInvestigationChecklistFunctions
{
    private readonly WardInvestigationChecklistService _svc;
    private readonly JwtService                        _jwt;

    private static readonly JsonSerializerOptions Json = new()
    {
        PropertyNamingPolicy   = JsonNamingPolicy.CamelCase,
        DefaultIgnoreCondition = JsonIgnoreCondition.WhenWritingNull,
    };

    public WardInvestigationChecklistFunctions(WardInvestigationChecklistService svc, JwtService jwt)
    {
        _svc = svc;
        _jwt = jwt;
    }

    [Function("GetWardInvestigationChecklist")]
    public async Task<HttpResponseData> GetChecklist(
        [HttpTrigger(AuthorizationLevel.Function, "get",
            Route = "ip-management/journeys/{id:guid}/ward-investigation-checklist")]
        HttpRequestData req, Guid id)
    {
        try
        {
            var (userId, tenantId) = _jwt.ValidateAndExtract(req);
            var tid = _jwt.ExtractTenantId(req, tenantId);
            var result = await _svc.GetChecklistAsync(id, tid, userId);
            return await Ok(req, result);
        }
        catch (KeyNotFoundException ex)        { return await NotFound(req, ex.Message); }
        catch (UnauthorizedAccessException ex) { return await Unauthorized(req, ex.Message); }
        catch (Exception ex)                 { return await InternalError(req, ex.Message); }
    }

    [Function("SaveWardInvestigationCompletion")]
    public async Task<HttpResponseData> SaveCompletion(
        [HttpTrigger(AuthorizationLevel.Function, "post",
            Route = "ip-management/journeys/{id:guid}/ward-investigation-checklist/completions/{itemId:guid}")]
        HttpRequestData req, Guid id, Guid itemId)
    {
        try
        {
            IpChecklistAuth.RequirePermission(req, _jwt, "ward.checklist.edit");
            var (userId, tenantId) = _jwt.ValidateAndExtract(req);
            var tid  = _jwt.ExtractTenantId(req, tenantId);
            var role = _jwt.PrimaryRole(req);
            var body = await JsonSerializer.DeserializeAsync<SaveWardInvestigationCompletionRequest>(req.Body, Json)
                       ?? throw new ArgumentException("Body required.");
            var result = await _svc.SaveCompletionAsync(id, itemId, tid, userId, body, role);
            return await Ok(req, result);
        }
        catch (UnauthorizedAccessException ex) { return await Unauthorized(req, ex.Message); }
        catch (KeyNotFoundException ex)        { return await NotFound(req, ex.Message); }
        catch (Exception ex)                 { return await InternalError(req, ex.Message); }
    }

    private static async Task<HttpResponseData> Ok(HttpRequestData req, object body)
    {
        var res = req.CreateResponse(HttpStatusCode.OK);
        res.Headers.Add("Content-Type", "application/json; charset=utf-8");
        await res.WriteStringAsync(JsonSerializer.Serialize(body, Json));
        return res;
    }

    private static async Task<HttpResponseData> NotFound(HttpRequestData req, string msg)
    {
        var res = req.CreateResponse(HttpStatusCode.NotFound);
        await res.WriteAsJsonAsync(new { error = msg });
        return res;
    }

    private static async Task<HttpResponseData> Unauthorized(HttpRequestData req, string msg)
    {
        var res = req.CreateResponse(HttpStatusCode.Unauthorized);
        await res.WriteAsJsonAsync(new { error = msg });
        return res;
    }

    private static async Task<HttpResponseData> InternalError(HttpRequestData req, string msg)
    {
        var res = req.CreateResponse(HttpStatusCode.InternalServerError);
        await res.WriteAsJsonAsync(new { error = msg });
        return res;
    }
}
