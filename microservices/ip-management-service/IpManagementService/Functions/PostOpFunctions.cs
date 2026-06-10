using System.Net;
using System.Text.Json;
using System.Text.Json.Serialization;
using Microsoft.Azure.Functions.Worker;
using Microsoft.Azure.Functions.Worker.Http;
using IpManagementService.Models.Dtos;
using IpManagementService.Services;

namespace IpManagementService.Functions;

/// <summary>
/// Routes:
///   GET/POST  /api/ip-management/journeys/{id}/nurse-checklist
///   GET/POST  /api/ip-management/journeys/{id}/surgeon-checklist
///   GET/POST  /api/ip-management/journeys/{id}/post-op-instructions
///   GET/POST  /api/ip-management/journeys/{id}/discharge-summary
///   POST      /api/ip-management/journeys/{id}/discharge-summary/finalize
///   GET/POST  /api/ip-management/journeys/{id}/iol-returns
///   GET/POST/DELETE /api/ip-management/surgery-note-templates
/// </summary>
public class PostOpFunctions
{
    private readonly PostOpWorkflowService  _postOpSvc;
    private readonly PatientJourneyService  _journeySvc;
    private readonly JwtService             _jwt;

    private static readonly JsonSerializerOptions Json = new()
    {
        PropertyNamingPolicy   = JsonNamingPolicy.CamelCase,
        DefaultIgnoreCondition = JsonIgnoreCondition.WhenWritingNull,
        WriteIndented          = false,
    };

    public PostOpFunctions(PostOpWorkflowService postOpSvc, PatientJourneyService journeySvc, JwtService jwt)
    {
        _postOpSvc  = postOpSvc;
        _journeySvc = journeySvc;
        _jwt        = jwt;
    }

    private void RequireWardEdit(HttpRequestData req) =>
        IpChecklistAuth.RequirePermission(req, _jwt, IpChecklistAuth.PermWardEdit);

    // ── Nurse Checklist ────────────────────────────────────────────────────────

    [Function("GetNurseChecklist")]
    public async Task<HttpResponseData> GetNurseChecklist(
        [HttpTrigger(AuthorizationLevel.Function, "get",
            Route = "ip-management/journeys/{id:guid}/nurse-checklist")]
        HttpRequestData req, Guid id)
    {
        try
        {
            var (_, tenantId) = _jwt.ValidateAndExtract(req);
            var tid       = _jwt.ExtractTenantId(req, tenantId);
            var items     = await _postOpSvc.GetNurseItemsAsync(tid);
            var responses = await _postOpSvc.GetNurseResponsesAsync(id, tid);
            return await Ok(req, new { items, responses });
        }
        catch (UnauthorizedAccessException ex) { return await Unauthorized(req, ex.Message); }
        catch (Exception ex) { return await InternalError(req, ex.Message); }
    }

    [Function("SaveNurseChecklist")]
    public async Task<HttpResponseData> SaveNurseChecklist(
        [HttpTrigger(AuthorizationLevel.Function, "post",
            Route = "ip-management/journeys/{id:guid}/nurse-checklist")]
        HttpRequestData req, Guid id)
    {
        try
        {
            var (userId, tenantId) = _jwt.ValidateAndExtract(req);
            var tid  = _jwt.ExtractTenantId(req, tenantId);
            var body = await JsonSerializer.DeserializeAsync<SaveChecklistRequest>(req.Body, Json)
                       ?? throw new ArgumentException("Body required.");
            await _postOpSvc.SaveNurseResponsesAsync(id, tid, userId, body);
            return await Ok(req, new { message = "Nurse checklist saved." });
        }
        catch (UnauthorizedAccessException ex) { return await Unauthorized(req, ex.Message); }
        catch (ArgumentException ex) { return await BadRequest(req, ex.Message); }
        catch (Exception ex) { return await InternalError(req, ex.Message); }
    }

    // ── Surgeon Checklist ──────────────────────────────────────────────────────

    [Function("GetSurgeonChecklist")]
    public async Task<HttpResponseData> GetSurgeonChecklist(
        [HttpTrigger(AuthorizationLevel.Function, "get",
            Route = "ip-management/journeys/{id:guid}/surgeon-checklist")]
        HttpRequestData req, Guid id)
    {
        try
        {
            var (_, tenantId) = _jwt.ValidateAndExtract(req);
            var tid       = _jwt.ExtractTenantId(req, tenantId);
            var items     = await _postOpSvc.GetSurgeonItemsAsync(tid);
            var responses = await _postOpSvc.GetSurgeonResponsesAsync(id, tid);
            return await Ok(req, new { items, responses });
        }
        catch (UnauthorizedAccessException ex) { return await Unauthorized(req, ex.Message); }
        catch (Exception ex) { return await InternalError(req, ex.Message); }
    }

    [Function("SaveSurgeonChecklist")]
    public async Task<HttpResponseData> SaveSurgeonChecklist(
        [HttpTrigger(AuthorizationLevel.Function, "post",
            Route = "ip-management/journeys/{id:guid}/surgeon-checklist")]
        HttpRequestData req, Guid id)
    {
        try
        {
            var (userId, tenantId) = _jwt.ValidateAndExtract(req);
            var tid  = _jwt.ExtractTenantId(req, tenantId);
            var body = await JsonSerializer.DeserializeAsync<SaveChecklistRequest>(req.Body, Json)
                       ?? throw new ArgumentException("Body required.");
            await _postOpSvc.SaveSurgeonResponsesAsync(id, tid, userId, body);
            return await Ok(req, new { message = "Surgeon checklist saved." });
        }
        catch (UnauthorizedAccessException ex) { return await Unauthorized(req, ex.Message); }
        catch (ArgumentException ex) { return await BadRequest(req, ex.Message); }
        catch (Exception ex) { return await InternalError(req, ex.Message); }
    }

    // ── Post-Op Instructions ───────────────────────────────────────────────────

    [Function("GetPostOpInstructions")]
    public async Task<HttpResponseData> GetPostOpInstructions(
        [HttpTrigger(AuthorizationLevel.Function, "get",
            Route = "ip-management/journeys/{id:guid}/post-op-instructions")]
        HttpRequestData req, Guid id)
    {
        try
        {
            var (_, tenantId) = _jwt.ValidateAndExtract(req);
            var tid  = _jwt.ExtractTenantId(req, tenantId);
            var data = await _postOpSvc.GetInstructionsAsync(id, tid);
            if (data is null) return await NotFound(req, "Post-op instructions not yet created.");
            return await Ok(req, data);
        }
        catch (UnauthorizedAccessException ex) { return await Unauthorized(req, ex.Message); }
        catch (Exception ex) { return await InternalError(req, ex.Message); }
    }

    [Function("SavePostOpInstructions")]
    public async Task<HttpResponseData> SavePostOpInstructions(
        [HttpTrigger(AuthorizationLevel.Function, "post",
            Route = "ip-management/journeys/{id:guid}/post-op-instructions")]
        HttpRequestData req, Guid id)
    {
        try
        {
            RequireWardEdit(req);
            var (userId, tenantId) = _jwt.ValidateAndExtract(req);
            var tid = _jwt.ExtractTenantId(req, tenantId);
            var qs  = ParseQs(req.Url.Query);
            qs.TryGetValue("branchId", out var branchStr);
            Guid.TryParse(branchStr, out var branchId);
            var body = await JsonSerializer.DeserializeAsync<SavePostOpInstructionRequest>(req.Body, Json)
                       ?? throw new ArgumentException("Body required.");
            var result = await _postOpSvc.SaveInstructionsAsync(id, tid, branchId, userId, body);
            return await Ok(req, result);
        }
        catch (UnauthorizedAccessException ex) { return await Unauthorized(req, ex.Message); }
        catch (ArgumentException ex) { return await BadRequest(req, ex.Message); }
        catch (Exception ex) { return await InternalError(req, ex.Message); }
    }

    // ── Discharge Summary Preview ──────────────────────────────────────────────

    [Function("GetDischargeSummaryPreview")]
    public async Task<HttpResponseData> GetDischargeSummaryPreview(
        [HttpTrigger(AuthorizationLevel.Function, "get",
            Route = "ip-management/journeys/{id:guid}/discharge-summary/preview")]
        HttpRequestData req, Guid id)
    {
        try
        {
            var (_, tenantId) = _jwt.ValidateAndExtract(req);
            var tid     = _jwt.ExtractTenantId(req, tenantId);
            var journey = await _journeySvc.GetDetailAsync(id, tid);
            if (journey is null) return await NotFound(req, "Journey not found.");
            var summary = await _postOpSvc.GetSummaryAsync(id, tid);
            var preview = new DischargeSummaryPreviewDto(
                journey.Uhid,
                journey.ProcedureName,
                journey.EyeOperated,
                journey.ClinicalState,
                journey.SurgeryScheduledAt,
                journey.PackageAmount,
                journey.TotalPaid,
                journey.BalanceDue,
                summary);
            return await Ok(req, preview);
        }
        catch (UnauthorizedAccessException ex) { return await Unauthorized(req, ex.Message); }
        catch (Exception ex) { return await InternalError(req, ex.Message); }
    }

    // ── Discharge Summary ──────────────────────────────────────────────────────

    [Function("GetDischargeSummary")]
    public async Task<HttpResponseData> GetDischargeSummary(
        [HttpTrigger(AuthorizationLevel.Function, "get",
            Route = "ip-management/journeys/{id:guid}/discharge-summary")]
        HttpRequestData req, Guid id)
    {
        try
        {
            var (_, tenantId) = _jwt.ValidateAndExtract(req);
            var tid  = _jwt.ExtractTenantId(req, tenantId);
            var data = await _postOpSvc.GetSummaryAsync(id, tid);
            if (data is null) return await NotFound(req, "Discharge summary not yet created.");
            return await Ok(req, data);
        }
        catch (UnauthorizedAccessException ex) { return await Unauthorized(req, ex.Message); }
        catch (Exception ex) { return await InternalError(req, ex.Message); }
    }

    [Function("SaveDischargeSummary")]
    public async Task<HttpResponseData> SaveDischargeSummary(
        [HttpTrigger(AuthorizationLevel.Function, "post",
            Route = "ip-management/journeys/{id:guid}/discharge-summary")]
        HttpRequestData req, Guid id)
    {
        try
        {
            var (userId, tenantId) = _jwt.ValidateAndExtract(req);
            var tid = _jwt.ExtractTenantId(req, tenantId);
            var qs  = ParseQs(req.Url.Query);
            qs.TryGetValue("branchId", out var branchStr);
            Guid.TryParse(branchStr, out var branchId);
            var body = await JsonSerializer.DeserializeAsync<SaveDischargeSummaryRequest>(req.Body, Json)
                       ?? throw new ArgumentException("Body required.");
            var result = await _postOpSvc.SaveSummaryAsync(id, tid, branchId, userId, body);
            return await Ok(req, result);
        }
        catch (UnauthorizedAccessException ex) { return await Unauthorized(req, ex.Message); }
        catch (ArgumentException ex) { return await BadRequest(req, ex.Message); }
        catch (Exception ex) { return await InternalError(req, ex.Message); }
    }

    [Function("FinalizeDischargeSummary")]
    public async Task<HttpResponseData> FinalizeDischargeSummary(
        [HttpTrigger(AuthorizationLevel.Function, "post",
            Route = "ip-management/journeys/{id:guid}/discharge-summary/finalize")]
        HttpRequestData req, Guid id)
    {
        try
        {
            RequireWardEdit(req);
            var (userId, tenantId) = _jwt.ValidateAndExtract(req);
            var tid    = _jwt.ExtractTenantId(req, tenantId);
            var result = await _postOpSvc.FinalizeSummaryAsync(id, tid, userId);
            return await Ok(req, result);
        }
        catch (UnauthorizedAccessException ex) { return await Unauthorized(req, ex.Message); }
        catch (KeyNotFoundException ex) { return await NotFound(req, ex.Message); }
        catch (Exception ex) { return await InternalError(req, ex.Message); }
    }

    // ── IOL Returns ────────────────────────────────────────────────────────────

    [Function("GetIolReturns")]
    public async Task<HttpResponseData> GetIolReturns(
        [HttpTrigger(AuthorizationLevel.Function, "get",
            Route = "ip-management/journeys/{id:guid}/iol-returns")]
        HttpRequestData req, Guid id)
    {
        try
        {
            var (_, tenantId) = _jwt.ValidateAndExtract(req);
            var tid  = _jwt.ExtractTenantId(req, tenantId);
            var data = await _postOpSvc.GetIolReturnsAsync(id, tid);
            return await Ok(req, data);
        }
        catch (UnauthorizedAccessException ex) { return await Unauthorized(req, ex.Message); }
        catch (Exception ex) { return await InternalError(req, ex.Message); }
    }

    [Function("RecordIolReturn")]
    public async Task<HttpResponseData> RecordIolReturn(
        [HttpTrigger(AuthorizationLevel.Function, "post",
            Route = "ip-management/journeys/{id:guid}/iol-returns")]
        HttpRequestData req, Guid id)
    {
        try
        {
            var (userId, tenantId) = _jwt.ValidateAndExtract(req);
            var tid = _jwt.ExtractTenantId(req, tenantId);
            var qs  = ParseQs(req.Url.Query);
            qs.TryGetValue("branchId", out var branchStr);
            Guid.TryParse(branchStr, out var branchId);
            var body = await JsonSerializer.DeserializeAsync<RecordIolReturnRequest>(req.Body, Json)
                       ?? throw new ArgumentException("Body required.");
            var result = await _postOpSvc.RecordIolReturnAsync(id, tid, branchId, userId, body);
            return await Created(req, result);
        }
        catch (UnauthorizedAccessException ex) { return await Unauthorized(req, ex.Message); }
        catch (ArgumentException ex) { return await BadRequest(req, ex.Message); }
        catch (Exception ex) { return await InternalError(req, ex.Message); }
    }

    // ── Surgery Note Templates ─────────────────────────────────────────────────

    [Function("GetSurgeryNoteTemplates")]
    public async Task<HttpResponseData> GetSurgeryNoteTemplates(
        [HttpTrigger(AuthorizationLevel.Function, "get",
            Route = "ip-management/surgery-note-templates")]
        HttpRequestData req)
    {
        try
        {
            var (_, tenantId) = _jwt.ValidateAndExtract(req);
            var tid  = _jwt.ExtractTenantId(req, tenantId);
            var data = await _postOpSvc.GetTemplatesAsync(tid);
            return await Ok(req, data);
        }
        catch (UnauthorizedAccessException ex) { return await Unauthorized(req, ex.Message); }
        catch (Exception ex) { return await InternalError(req, ex.Message); }
    }

    [Function("AddSurgeryNoteTemplate")]
    public async Task<HttpResponseData> AddSurgeryNoteTemplate(
        [HttpTrigger(AuthorizationLevel.Function, "post",
            Route = "ip-management/surgery-note-templates")]
        HttpRequestData req)
    {
        try
        {
            var (userId, tenantId) = _jwt.ValidateAndExtract(req);
            var tid  = _jwt.ExtractTenantId(req, tenantId);
            var body = await JsonSerializer.DeserializeAsync<SaveSurgeryNoteTemplateRequest>(req.Body, Json)
                       ?? throw new ArgumentException("Body required.");
            var result = await _postOpSvc.AddTemplateAsync(tid, userId, body);
            return await Created(req, result);
        }
        catch (UnauthorizedAccessException ex) { return await Unauthorized(req, ex.Message); }
        catch (ArgumentException ex) { return await BadRequest(req, ex.Message); }
        catch (Exception ex) { return await InternalError(req, ex.Message); }
    }

    [Function("DeleteSurgeryNoteTemplate")]
    public async Task<HttpResponseData> DeleteSurgeryNoteTemplate(
        [HttpTrigger(AuthorizationLevel.Function, "delete",
            Route = "ip-management/surgery-note-templates/{id:guid}")]
        HttpRequestData req, Guid id)
    {
        try
        {
            var (_, tenantId) = _jwt.ValidateAndExtract(req);
            var tid     = _jwt.ExtractTenantId(req, tenantId);
            var deleted = await _postOpSvc.DeleteTemplateAsync(id, tid);
            if (!deleted) return await NotFound(req, "Template not found.");
            return await Ok(req, new { message = "Template deleted." });
        }
        catch (UnauthorizedAccessException ex) { return await Unauthorized(req, ex.Message); }
        catch (Exception ex) { return await InternalError(req, ex.Message); }
    }

    // ── Helpers ────────────────────────────────────────────────────────────────

    private static Dictionary<string, string> ParseQs(string query)
    {
        var d = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);
        if (string.IsNullOrEmpty(query)) return d;
        foreach (var part in query.TrimStart('?').Split('&'))
        {
            var idx = part.IndexOf('=');
            if (idx > 0)
                d[Uri.UnescapeDataString(part[..idx])] = Uri.UnescapeDataString(part[(idx + 1)..]);
        }
        return d;
    }

    private async Task<HttpResponseData> Ok(HttpRequestData req, object payload)
    {
        var r = req.CreateResponse(HttpStatusCode.OK);
        r.Headers.Add("Content-Type", "application/json; charset=utf-8");
        await r.WriteStringAsync(JsonSerializer.Serialize(payload, Json));
        return r;
    }

    private async Task<HttpResponseData> Created(HttpRequestData req, object payload)
    {
        var r = req.CreateResponse(HttpStatusCode.Created);
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

    private static async Task<HttpResponseData> InternalError(HttpRequestData req, string message)
    {
        var r = req.CreateResponse(HttpStatusCode.InternalServerError);
        await r.WriteAsJsonAsync(new { error = message });
        return r;
    }
}
