using System.Net;
using System.Text.Json;
using System.Text.Json.Serialization;
using Microsoft.Azure.Functions.Worker;
using Microsoft.Azure.Functions.Worker.Http;
using IpManagementService.Models.Dtos;
using IpManagementService.Services;

namespace IpManagementService.Functions;

/// <summary>
/// W-08 B1. GET anyone with a valid JWT. PUT requires ip.postop.manage (fail-closed).
/// </summary>
public class PostOpTaperFunctions
{
    private readonly PostOpTaperService _taper;
    private readonly JwtService _jwt;
    private readonly JourneyCommandAuthContext _commandAuth;

    private static readonly JsonSerializerOptions Json = new()
    {
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
        DefaultIgnoreCondition = JsonIgnoreCondition.WhenWritingNull,
        WriteIndented = false,
    };

    public PostOpTaperFunctions(
        PostOpTaperService taper,
        JwtService jwt,
        JourneyCommandAuthContext commandAuth)
    {
        _taper = taper;
        _jwt = jwt;
        _commandAuth = commandAuth;
    }

    [Function("GetPostOpTaper")]
    public async Task<HttpResponseData> GetPostOpTaper(
        [HttpTrigger(AuthorizationLevel.Function, "get",
            Route = "ip-management/journeys/{id:guid}/post-op/taper")]
        HttpRequestData req, Guid id)
    {
        try
        {
            var (_, tenantId) = _jwt.ValidateAndExtract(req);
            var tid = _jwt.ExtractTenantId(req, tenantId);
            var result = await _taper.GetAsync(id, tid);
            return await Ok(req, result);
        }
        catch (UnauthorizedAccessException ex) { return await Unauthorized(req, ex.Message); }
        catch (KeyNotFoundException ex) { return await NotFound(req, ex.Message); }
        catch (Exception ex) { return await InternalError(req, ex.Message); }
    }

    [Function("SavePostOpTaper")]
    public async Task<HttpResponseData> SavePostOpTaper(
        [HttpTrigger(AuthorizationLevel.Function, "put",
            Route = "ip-management/journeys/{id:guid}/post-op/taper")]
        HttpRequestData req, Guid id)
    {
        try
        {
            var (userId, tenantId) = _jwt.ValidateAndExtract(req);
            IpChecklistAuth.RequirePostOpManage(req, _jwt);
            _commandAuth.Bind(req, _jwt);
            var tid = _jwt.ExtractTenantId(req, tenantId);
            var body = await JsonSerializer.DeserializeAsync<SavePostOpTaperRequest>(req.Body, Json)
                       ?? throw new ArgumentException("Body required.");
            var result = await _taper.ReplaceAsync(id, tid, userId, body);
            return await Ok(req, result);
        }
        catch (UnauthorizedAccessException ex) { return await Forbidden(req, ex.Message); }
        catch (KeyNotFoundException ex) { return await NotFound(req, ex.Message); }
        catch (ArgumentException ex) { return await BadRequest(req, ex.Message); }
        catch (Exception ex) { return await InternalError(req, ex.Message); }
    }

    private static async Task<HttpResponseData> Ok(HttpRequestData req, object payload)
    {
        var r = req.CreateResponse(HttpStatusCode.OK);
        r.Headers.Add("Content-Type", "application/json; charset=utf-8");
        await r.WriteStringAsync(JsonSerializer.Serialize(payload, Json));
        return r;
    }

    private static Task<HttpResponseData> Forbidden(HttpRequestData req, string message)
        => WriteError(req, HttpStatusCode.Forbidden, message);

    private static Task<HttpResponseData> Unauthorized(HttpRequestData req, string message)
        => WriteError(req, HttpStatusCode.Unauthorized, message);

    private static Task<HttpResponseData> NotFound(HttpRequestData req, string message)
        => WriteError(req, HttpStatusCode.NotFound, message);

    private static Task<HttpResponseData> BadRequest(HttpRequestData req, string message)
        => WriteError(req, HttpStatusCode.BadRequest, message);

    private static Task<HttpResponseData> InternalError(HttpRequestData req, string message)
        => WriteError(req, HttpStatusCode.InternalServerError, message);

    private static async Task<HttpResponseData> WriteError(HttpRequestData req, HttpStatusCode status, string message)
    {
        var r = req.CreateResponse(status);
        r.Headers.Add("Content-Type", "application/json; charset=utf-8");
        await r.WriteStringAsync(JsonSerializer.Serialize(new { error = message }, Json));
        return r;
    }
}
