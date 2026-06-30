using System.Net;
using System.Text.Json;
using System.Text.Json.Serialization;
using Microsoft.Azure.Functions.Worker;
using Microsoft.Azure.Functions.Worker.Http;
using Microsoft.Extensions.Logging;
using IpManagementService.Models.Dtos;
using IpManagementService.Services;

namespace IpManagementService.Functions;

public class WardInvestigationChecklistFunctions
{
    private readonly WardInvestigationChecklistService _svc;
    private readonly JwtService                        _jwt;
    private readonly ILogger<WardInvestigationChecklistFunctions> _log;

    private static readonly JsonSerializerOptions Json = new()
    {
        PropertyNamingPolicy   = JsonNamingPolicy.CamelCase,
        DefaultIgnoreCondition = JsonIgnoreCondition.WhenWritingNull,
    };

    public WardInvestigationChecklistFunctions(
        WardInvestigationChecklistService svc,
        JwtService jwt,
        ILogger<WardInvestigationChecklistFunctions> log)
    {
        _svc = svc;
        _jwt = jwt;
        _log = log;
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
        catch (Exception ex)                 { return await InternalError(req, ex); }
    }

    [Function("GetWardInvestigationSummary")]
    public async Task<HttpResponseData> GetSummary(
        [HttpTrigger(AuthorizationLevel.Function, "get",
            Route = "ip-management/journeys/{id:guid}/ward-investigation-checklist/summary")]
        HttpRequestData req, Guid id)
    {
        try
        {
            var (userId, tenantId) = _jwt.ValidateAndExtract(req);
            var tid = _jwt.ExtractTenantId(req, tenantId);
            return await Ok(req, await _svc.GetSummaryAsync(id, tid, userId));
        }
        catch (KeyNotFoundException ex)        { return await NotFound(req, ex.Message); }
        catch (UnauthorizedAccessException ex) { return await Unauthorized(req, ex.Message); }
        catch (Exception ex)                 { return await InternalError(req, ex); }
    }

    [Function("SaveWardInvestigationCompletion")]
    public async Task<HttpResponseData> SaveCompletion(
        [HttpTrigger(AuthorizationLevel.Function, "post",
            Route = "ip-management/journeys/{id:guid}/ward-investigation-checklist/completions/{itemId:guid}")]
        HttpRequestData req, Guid id, Guid itemId)
    {
        try
        {
            IpChecklistAuth.RequireInvestigationEnter(req, _jwt);
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
        catch (ArgumentException ex)           { return await BadRequest(req, ex.Message); }
        catch (Exception ex)                 { return await InternalError(req, ex); }
    }

    [Function("SaveWardInvestigationResult")]
    public async Task<HttpResponseData> SaveResult(
        [HttpTrigger(AuthorizationLevel.Function, "put",
            Route = "ip-management/journeys/{id:guid}/ward-investigation-checklist/completions/{itemId:guid}/result")]
        HttpRequestData req, Guid id, Guid itemId)
    {
        try
        {
            IpChecklistAuth.RequireInvestigationEnter(req, _jwt);
            var (userId, tenantId) = _jwt.ValidateAndExtract(req);
            var tid  = _jwt.ExtractTenantId(req, tenantId);
            var role = _jwt.PrimaryRole(req);
            var body = await JsonSerializer.DeserializeAsync<SaveWardInvestigationResultRequest>(req.Body, Json)
                       ?? throw new ArgumentException("Body required.");
            var result = await _svc.SaveResultAsync(id, itemId, tid, userId, body, role);
            return await Ok(req, result);
        }
        catch (UnauthorizedAccessException ex) { return await Unauthorized(req, ex.Message); }
        catch (KeyNotFoundException ex)        { return await NotFound(req, ex.Message); }
        catch (ArgumentException ex)           { return await BadRequest(req, ex.Message); }
        catch (InvalidOperationException ex)   { return await BadRequest(req, ex.Message); }
        catch (Exception ex)                 { return await InternalError(req, ex); }
    }

    [Function("VerifyWardInvestigation")]
    public async Task<HttpResponseData> Verify(
        [HttpTrigger(AuthorizationLevel.Function, "post",
            Route = "ip-management/journeys/{id:guid}/ward-investigation-checklist/completions/{itemId:guid}/verify")]
        HttpRequestData req, Guid id, Guid itemId)
    {
        try
        {
            IpChecklistAuth.RequireInvestigationVerify(req, _jwt);
            var (userId, tenantId) = _jwt.ValidateAndExtract(req);
            var tid  = _jwt.ExtractTenantId(req, tenantId);
            var role = _jwt.PrimaryRole(req);
            var body = await JsonSerializer.DeserializeAsync<VerifyWardInvestigationRequest>(req.Body, Json)
                       ?? new VerifyWardInvestigationRequest(null);
            var result = await _svc.VerifyAsync(id, itemId, tid, userId, body, role);
            return await Ok(req, result);
        }
        catch (UnauthorizedAccessException ex) { return await Unauthorized(req, ex.Message); }
        catch (KeyNotFoundException ex)        { return await NotFound(req, ex.Message); }
        catch (InvalidOperationException ex)   { return await BadRequest(req, ex.Message); }
        catch (Exception ex)                 { return await InternalError(req, ex); }
    }

    [Function("UploadWardInvestigationDocument")]
    public async Task<HttpResponseData> UploadDocument(
        [HttpTrigger(AuthorizationLevel.Function, "post",
            Route = "ip-management/journeys/{id:guid}/ward-investigation-checklist/completions/{itemId:guid}/document")]
        HttpRequestData req, Guid id, Guid itemId)
    {
        try
        {
            IpChecklistAuth.RequireInvestigationEnter(req, _jwt);
            var (userId, tenantId) = _jwt.ValidateAndExtract(req);
            var tid = _jwt.ExtractTenantId(req, tenantId);
            var body = await JsonSerializer.DeserializeAsync<UploadInvestigationDocumentRequest>(req.Body, Json)
                       ?? throw new ArgumentException("Body required.");
            var result = await _svc.UploadDocumentAsync(id, itemId, tid, userId, body);
            return await Ok(req, result);
        }
        catch (UnauthorizedAccessException ex) { return await Unauthorized(req, ex.Message); }
        catch (KeyNotFoundException ex)        { return await NotFound(req, ex.Message); }
        catch (ArgumentException ex)           { return await BadRequest(req, ex.Message); }
        catch (FormatException ex)             { return await BadRequest(req, ex.Message); }
        catch (Exception ex)                 { return await InternalError(req, ex); }
    }

    [Function("GetWardInvestigationDocument")]
    public async Task<HttpResponseData> GetDocument(
        [HttpTrigger(AuthorizationLevel.Function, "get",
            Route = "ip-management/journeys/{id:guid}/ward-investigation-checklist/completions/{itemId:guid}/document")]
        HttpRequestData req, Guid id, Guid itemId)
    {
        try
        {
            var (_, tenantId) = _jwt.ValidateAndExtract(req);
            var tid = _jwt.ExtractTenantId(req, tenantId);
            var doc = await _svc.GetDocumentAsync(id, itemId, tid);
            if (doc is null) return await NotFound(req, "Document not found.");
            return await Ok(req, doc);
        }
        catch (KeyNotFoundException ex)        { return await NotFound(req, ex.Message); }
        catch (UnauthorizedAccessException ex) { return await Unauthorized(req, ex.Message); }
        catch (Exception ex)                 { return await InternalError(req, ex); }
    }

    private static async Task<HttpResponseData> Ok(HttpRequestData req, object body)
        => await WriteJson(req, HttpStatusCode.OK, body);

    private static async Task<HttpResponseData> NotFound(HttpRequestData req, string msg)
        => await WriteJson(req, HttpStatusCode.NotFound, new { error = msg });

    private static async Task<HttpResponseData> Unauthorized(HttpRequestData req, string msg)
        => await WriteJson(req, HttpStatusCode.Unauthorized, new { error = msg });

    private static async Task<HttpResponseData> BadRequest(HttpRequestData req, string msg)
        => await WriteJson(req, HttpStatusCode.BadRequest, new { error = msg });

    private async Task<HttpResponseData> InternalError(HttpRequestData req, Exception ex)
    {
        // Surface the inner-most cause (e.g. the Postgres constraint message) that EF hides
        // behind the generic "An error occurred while saving the entity changes." text.
        var root = ex;
        while (root.InnerException is not null) root = root.InnerException;

        _log.LogError(ex, "Unhandled error in WardInvestigationChecklist function: {Detail}", root.Message);

        return await WriteJson(req, HttpStatusCode.InternalServerError,
            new { error = ex.Message, detail = root.Message });
    }

    // WriteStringAsync (unlike WriteAsJsonAsync) does not reset the status code to 200,
    // so the intended status from CreateResponse is preserved.
    private static async Task<HttpResponseData> WriteJson(HttpRequestData req, HttpStatusCode status, object body)
    {
        var res = req.CreateResponse(status);
        res.Headers.Add("Content-Type", "application/json; charset=utf-8");
        await res.WriteStringAsync(JsonSerializer.Serialize(body, Json));
        return res;
    }
}
