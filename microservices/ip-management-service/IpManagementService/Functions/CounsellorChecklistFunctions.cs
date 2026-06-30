using System.Net;
using System.Text.Json;
using System.Text.Json.Serialization;
using Microsoft.Azure.Functions.Worker;
using Microsoft.Azure.Functions.Worker.Http;
using IpManagementService.Models.Dtos;
using IpManagementService.Services;

namespace IpManagementService.Functions;

/// <summary>
/// Counsellor Desk — Outpatient Safety Checklist (S0).
///   GET  /api/ip-management/counsellor/sessions/{sessionId}/outpatient-checklist
///   POST /api/ip-management/counsellor/sessions/{sessionId}/outpatient-checklist/completions/{itemId}
/// </summary>
public class CounsellorChecklistFunctions
{
    private readonly CounsellorChecklistService _svc;
    private readonly JwtService                 _jwt;

    private static readonly JsonSerializerOptions Json = new()
    {
        PropertyNamingPolicy   = JsonNamingPolicy.CamelCase,
        DefaultIgnoreCondition = JsonIgnoreCondition.WhenWritingNull,
    };

    public CounsellorChecklistFunctions(CounsellorChecklistService svc, JwtService jwt)
    {
        _svc = svc;
        _jwt = jwt;
    }

    [Function("GetCounsellorOutpatientChecklist")]
    public async Task<HttpResponseData> GetOutpatientChecklist(
        [HttpTrigger(AuthorizationLevel.Function, "get",
            Route = "ip-management/counsellor/sessions/{sessionId:guid}/outpatient-checklist")]
        HttpRequestData req,
        Guid sessionId)
    {
        try
        {
            var (_, tenantId) = _jwt.ValidateAndExtract(req);
            var tid           = _jwt.ExtractTenantId(req, tenantId);

            var result = await _svc.GetOutpatientChecklistAsync(sessionId, tid);
            return await Ok(req, result);
        }
        catch (UnauthorizedAccessException ex) { return await Unauthorized(req, ex.Message); }
        catch (Exception ex)                   { return await InternalError(req, ex.Message); }
    }

    [Function("SaveCounsellorOutpatientCompletion")]
    public async Task<HttpResponseData> SaveCompletion(
        [HttpTrigger(AuthorizationLevel.Function, "post",
            Route = "ip-management/counsellor/sessions/{sessionId:guid}/outpatient-checklist/completions/{itemId:guid}")]
        HttpRequestData req,
        Guid sessionId,
        Guid itemId)
    {
        try
        {
            IpChecklistAuth.RequirePermission(req, _jwt, "counsellor.outpatient_checklist.edit");
            var (userId, tenantId) = _jwt.ValidateAndExtract(req);
            var tid                = _jwt.ExtractTenantId(req, tenantId);
            var role               = _jwt.PrimaryRole(req);

            var body = await JsonSerializer.DeserializeAsync<SaveCounsellorCompletionRequest>(
                           req.Body, Json)
                       ?? throw new ArgumentException("Request body is required.");

            var result = await _svc.SaveCompletionAsync(sessionId, itemId, tid, userId, body, role);
            return await Ok(req, result);
        }
        catch (KeyNotFoundException ex)        { return await NotFound(req, ex.Message); }
        catch (UnauthorizedAccessException ex) { return await Unauthorized(req, ex.Message); }
        catch (ArgumentException ex)           { return await BadRequest(req, ex.Message); }
        catch (Exception ex)                   { return await InternalError(req, ex.Message); }
    }

    [Function("GetCounsellorPreOpInvestigations")]
    public async Task<HttpResponseData> GetPreOpInvestigations(
        [HttpTrigger(AuthorizationLevel.Function, "get",
            Route = "ip-management/counsellor/sessions/{sessionId:guid}/pre-op-investigations")]
        HttpRequestData req,
        Guid sessionId)
    {
        try
        {
            var (_, tenantId) = _jwt.ValidateAndExtract(req);
            var tid           = _jwt.ExtractTenantId(req, tenantId);

            var result = await _svc.GetPreOpInvestigationChecklistAsync(sessionId, tid);
            return await Ok(req, result);
        }
        catch (UnauthorizedAccessException ex) { return await Unauthorized(req, ex.Message); }
        catch (Exception ex)                   { return await InternalError(req, ex.Message); }
    }

    [Function("SaveCounsellorPreOpInvestigationResult")]
    public async Task<HttpResponseData> SavePreOpInvestigationResult(
        [HttpTrigger(AuthorizationLevel.Function, "post",
            Route = "ip-management/counsellor/sessions/{sessionId:guid}/pre-op-investigations/{itemId:guid}")]
        HttpRequestData req,
        Guid sessionId,
        Guid itemId)
    {
        try
        {
            IpChecklistAuth.RequirePermission(req, _jwt, "counsellor.outpatient_checklist.edit");
            var (userId, tenantId) = _jwt.ValidateAndExtract(req);
            var tid                = _jwt.ExtractTenantId(req, tenantId);

            var body = await JsonSerializer.DeserializeAsync<SaveCounsellorInvestigationResultRequest>(
                           req.Body, Json)
                       ?? throw new ArgumentException("Request body is required.");

            var result = await _svc.SaveInvestigationResultAsync(sessionId, itemId, tid, userId, body);
            return await Ok(req, result);
        }
        catch (KeyNotFoundException ex)        { return await NotFound(req, ex.Message); }
        catch (UnauthorizedAccessException ex) { return await Unauthorized(req, ex.Message); }
        catch (ArgumentException ex)           { return await BadRequest(req, ex.Message); }
        catch (Exception ex)                   { return await InternalError(req, ex.Message); }
    }

    private static async Task<HttpResponseData> Ok(HttpRequestData req, object body)
    {
        var res = req.CreateResponse(HttpStatusCode.OK);
        res.Headers.Add("Content-Type", "application/json; charset=utf-8");
        await res.WriteStringAsync(JsonSerializer.Serialize(body, Json));
        return res;
    }

    private static async Task<HttpResponseData> BadRequest(HttpRequestData req, string msg)
    {
        var res = req.CreateResponse(HttpStatusCode.BadRequest);
        await res.WriteAsJsonAsync(new { error = msg });
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
