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
///   GET  /api/ip-management/pre-op/section-items?paymentMode=Insurance
///   GET  /api/ip-management/journeys/{id:guid}/pre-op/readiness
///   POST /api/ip-management/journeys/{id:guid}/pre-op/clearance/init
///   GET  /api/ip-management/journeys/{id:guid}/pre-op/clearance
///   POST /api/ip-management/journeys/{id:guid}/pre-op/completions/{itemId:guid}
///   POST /api/ip-management/journeys/{id:guid}/pre-op/completions/batch
///   GET  /api/ip-management/journeys/{id:guid}/pre-op/vitals
///   POST /api/ip-management/journeys/{id:guid}/pre-op/vitals
///   POST /api/ip-management/journeys/{id:guid}/pre-op/documents
///   POST /api/ip-management/journeys/{id:guid}/pre-op/documents/{docId:guid}/verify
///   POST /api/ip-management/journeys/{id:guid}/pre-op/clearance/approve
///   POST /api/ip-management/journeys/{id:guid}/pre-op/clearance/defer
///   POST /api/ip-management/journeys/{id:guid}/pre-op/sections/{category}/request
///   POST /api/ip-management/journeys/{id:guid}/pre-op/sections/{category}/respond
///   POST /api/ip-management/journeys/{id:guid}/pre-op/sections/{category}/confirm
/// </summary>
public class PreOpFunctions
{
    private readonly PreOpClearanceService _preOp;
    private readonly PreOpReadinessService _readiness;
    private readonly JwtService           _jwt;

    private static readonly JsonSerializerOptions Json = new()
    {
        PropertyNamingPolicy   = JsonNamingPolicy.CamelCase,
        DefaultIgnoreCondition = JsonIgnoreCondition.WhenWritingNull,
        WriteIndented          = false,
    };

    public PreOpFunctions(PreOpClearanceService preOp, PreOpReadinessService readiness, JwtService jwt)
    {
        _preOp      = preOp;
        _readiness  = readiness;
        _jwt        = jwt;
    }

    private void RequireWardEdit(HttpRequestData req) =>
        IpChecklistAuth.RequirePermission(req, _jwt, IpChecklistAuth.PermWardEdit);

    // ── Section Items ──────────────────────────────────────────────────────────

    [Function("GetPreOpSectionItems")]
    public async Task<HttpResponseData> GetPreOpSectionItems(
        [HttpTrigger(AuthorizationLevel.Function, "get",
            Route = "ip-management/pre-op/section-items")]
        HttpRequestData req)
    {
        try
        {
            var (_, tenantId) = _jwt.ValidateAndExtract(req);
            var tid           = _jwt.ExtractTenantId(req, tenantId);

            var qs          = ParseQs(req.Url.Query);
            var paymentMode = qs.TryGetValue("paymentMode", out var pm) ? pm : null;

            var items = await _preOp.GetSectionItemsAsync(tid, paymentMode);
            return await Ok(req, items);
        }
        catch (UnauthorizedAccessException ex) { return await Unauthorized(req, ex.Message); }
        catch (Exception ex)                   { return await InternalError(req, ex.Message); }
    }

    [Function("GetPreOpReadiness")]
    public async Task<HttpResponseData> GetPreOpReadiness(
        [HttpTrigger(AuthorizationLevel.Function, "get",
            Route = "ip-management/journeys/{id:guid}/pre-op/readiness")]
        HttpRequestData req, Guid id)
    {
        try
        {
            var (userId, tenantId) = _jwt.ValidateAndExtract(req);
            var tid = _jwt.ExtractTenantId(req, tenantId);
            var qs = ParseQs(req.Url.Query);
            var paymentMode = qs.TryGetValue("paymentMode", out var pm) ? pm : null;

            var rollup = await _readiness.GetReadinessAsync(id, tid, userId, paymentMode);
            if (rollup is null) return await NotFound(req, $"Journey {id} not found.");
            return await Ok(req, rollup);
        }
        catch (UnauthorizedAccessException ex) { return await Unauthorized(req, ex.Message); }
        catch (Exception ex)                   { return await InternalError(req, ex.Message); }
    }

    // ── Clearance ──────────────────────────────────────────────────────────────

    [Function("InitPreOpClearance")]
    public async Task<HttpResponseData> InitPreOpClearance(
        [HttpTrigger(AuthorizationLevel.Function, "post",
            Route = "ip-management/journeys/{id:guid}/pre-op/clearance/init")]
        HttpRequestData req, Guid id)
    {
        try
        {
            RequireWardEdit(req);
            var (userId, tenantId) = _jwt.ValidateAndExtract(req);
            var tid  = _jwt.ExtractTenantId(req, tenantId);
            var body = await JsonSerializer.DeserializeAsync<InitPreOpClearanceRequest>(req.Body, Json)
                       ?? new InitPreOpClearanceRequest(null, null);
            var result = await _preOp.GetOrInitClearanceAsync(id, tid, userId, body);
            return await Ok(req, result);
        }
        catch (UnauthorizedAccessException ex) { return await Unauthorized(req, ex.Message); }
        catch (KeyNotFoundException ex)         { return await NotFound(req, ex.Message); }
        catch (InvalidOperationException ex)    { return await Conflict(req, ex.Message); }
        catch (Exception ex)
        {
            var inner = ex.InnerException?.Message;
            return await InternalError(req, inner is not null ? $"{ex.Message} | {inner}" : ex.Message);
        }
    }

    [Function("GetPreOpClearance")]
    public async Task<HttpResponseData> GetPreOpClearance(
        [HttpTrigger(AuthorizationLevel.Function, "get",
            Route = "ip-management/journeys/{id:guid}/pre-op/clearance")]
        HttpRequestData req, Guid id)
    {
        try
        {
            var (_, tenantId) = _jwt.ValidateAndExtract(req);
            var tid    = _jwt.ExtractTenantId(req, tenantId);
            var detail = await _preOp.GetClearanceDetailAsync(id, tid);
            if (detail is null) return await NotFound(req, $"No pre-op clearance for journey {id}.");
            return await Ok(req, detail);
        }
        catch (UnauthorizedAccessException ex) { return await Unauthorized(req, ex.Message); }
        catch (Exception ex)                   { return await InternalError(req, ex.Message); }
    }

    // ── Completions ────────────────────────────────────────────────────────────

    [Function("SavePreOpCompletion")]
    public async Task<HttpResponseData> SavePreOpCompletion(
        [HttpTrigger(AuthorizationLevel.Function, "post",
            Route = "ip-management/journeys/{id:guid}/pre-op/completions/{itemId:guid}")]
        HttpRequestData req, Guid id, Guid itemId)
    {
        try
        {
            RequireWardEdit(req);
            var (userId, tenantId) = _jwt.ValidateAndExtract(req);
            var tid  = _jwt.ExtractTenantId(req, tenantId);
            var role = _jwt.PrimaryRole(req);
            var body = await JsonSerializer.DeserializeAsync<SavePreOpCompletionRequest>(req.Body, Json)
                       ?? throw new ArgumentException("Body required.");
            var result = await _preOp.SaveCompletionAsync(id, tid, userId, itemId, body, role);
            return await Ok(req, result);
        }
        catch (UnauthorizedAccessException ex) { return await Unauthorized(req, ex.Message); }
        catch (KeyNotFoundException ex)         { return await NotFound(req, ex.Message); }
        catch (ArgumentException ex)            { return await BadRequest(req, ex.Message); }
        catch (Exception ex)                   { return await InternalError(req, ex.Message); }
    }

    [Function("BatchSavePreOpCompletions")]
    public async Task<HttpResponseData> BatchSavePreOpCompletions(
        [HttpTrigger(AuthorizationLevel.Function, "post",
            Route = "ip-management/journeys/{id:guid}/pre-op/completions/batch")]
        HttpRequestData req, Guid id)
    {
        try
        {
            RequireWardEdit(req);
            var (userId, tenantId) = _jwt.ValidateAndExtract(req);
            var tid  = _jwt.ExtractTenantId(req, tenantId);
            var body = await JsonSerializer.DeserializeAsync<BatchSavePreOpCompletionsRequest>(req.Body, Json)
                       ?? throw new ArgumentException("Body required.");
            var results = await _preOp.BatchSaveCompletionsAsync(id, tid, userId, body);
            return await Ok(req, results);
        }
        catch (UnauthorizedAccessException ex) { return await Unauthorized(req, ex.Message); }
        catch (KeyNotFoundException ex)         { return await NotFound(req, ex.Message); }
        catch (ArgumentException ex)            { return await BadRequest(req, ex.Message); }
        catch (Exception ex)                   { return await InternalError(req, ex.Message); }
    }

    // ── Consent capture ──────────────────────────────────────────────────────────

    [Function("CaptureConsent")]
    public async Task<HttpResponseData> CaptureConsent(
        [HttpTrigger(AuthorizationLevel.Function, "post",
            Route = "ip-management/journeys/{id:guid}/pre-op/consent/{itemId:guid}/capture")]
        HttpRequestData req, Guid id, Guid itemId)
    {
        try
        {
            RequireWardEdit(req);
            var (userId, tenantId) = _jwt.ValidateAndExtract(req);
            var tid  = _jwt.ExtractTenantId(req, tenantId);
            var body = await JsonSerializer.DeserializeAsync<CaptureConsentRequest>(req.Body, Json)
                       ?? throw new ArgumentException("Body required.");
            var result = await _preOp.CaptureConsentAsync(id, tid, userId, itemId, body);
            if (result is null) return await NotFound(req, $"No pre-op clearance for journey {id}.");
            return await Ok(req, result);
        }
        catch (UnauthorizedAccessException ex) { return await Unauthorized(req, ex.Message); }
        catch (KeyNotFoundException ex)         { return await NotFound(req, ex.Message); }
        catch (ArgumentException ex)            { return await BadRequest(req, ex.Message); }
        catch (InvalidOperationException ex)    { return await Conflict(req, ex.Message); }
        catch (Exception ex)
        {
            var inner = ex.InnerException?.Message;
            return await InternalError(req, inner is not null ? $"{ex.Message} | {inner}" : ex.Message);
        }
    }

    [Function("RevokeConsent")]
    public async Task<HttpResponseData> RevokeConsent(
        [HttpTrigger(AuthorizationLevel.Function, "post",
            Route = "ip-management/journeys/{id:guid}/pre-op/consent/{itemId:guid}/revoke")]
        HttpRequestData req, Guid id, Guid itemId)
    {
        try
        {
            RequireWardEdit(req);
            var (userId, tenantId) = _jwt.ValidateAndExtract(req);
            var tid  = _jwt.ExtractTenantId(req, tenantId);
            var body = await JsonSerializer.DeserializeAsync<RevokeConsentRequest>(req.Body, Json)
                       ?? throw new ArgumentException("Body required.");
            var result = await _preOp.RevokeConsentAsync(id, tid, userId, itemId, body);
            if (result is null) return await NotFound(req, $"No pre-op clearance for journey {id}.");
            return await Ok(req, result);
        }
        catch (UnauthorizedAccessException ex) { return await Unauthorized(req, ex.Message); }
        catch (KeyNotFoundException ex)         { return await NotFound(req, ex.Message); }
        catch (ArgumentException ex)            { return await BadRequest(req, ex.Message); }
        catch (InvalidOperationException ex)    { return await Conflict(req, ex.Message); }
        catch (Exception ex)
        {
            var inner = ex.InnerException?.Message;
            return await InternalError(req, inner is not null ? $"{ex.Message} | {inner}" : ex.Message);
        }
    }

    // ── Pre-Op Vitals ──────────────────────────────────────────────────────────

    [Function("AddPreOpVital")]
    public async Task<HttpResponseData> AddPreOpVital(
        [HttpTrigger(AuthorizationLevel.Function, "post",
            Route = "ip-management/journeys/{id:guid}/pre-op/vitals")]
        HttpRequestData req, Guid id)
    {
        try
        {
            RequireWardEdit(req);
            var (userId, tenantId) = _jwt.ValidateAndExtract(req);
            var tid  = _jwt.ExtractTenantId(req, tenantId);
            var body = await JsonSerializer.DeserializeAsync<AddPreOpVitalRequest>(req.Body, Json)
                       ?? throw new ArgumentException("Body required.");
            var result = await _preOp.AddPreOpVitalAsync(id, tid, userId, body);
            return await Created(req, result);
        }
        catch (UnauthorizedAccessException ex) { return await Unauthorized(req, ex.Message); }
        catch (ArgumentException ex)            { return await BadRequest(req, ex.Message); }
        catch (Exception ex)                   { return await InternalError(req, ex.Message); }
    }

    // ── Documents ──────────────────────────────────────────────────────────────

    /// <summary>
    /// Accepts JSON body with base64-encoded file content:
    ///   { "documentType": "ConsentForm", "fileName": "consent.pdf",
    ///     "contentType": "application/pdf", "fileData": "&lt;base64&gt;" }
    /// </summary>
    [Function("UploadPreOpDocument")]
    public async Task<HttpResponseData> UploadPreOpDocument(
        [HttpTrigger(AuthorizationLevel.Function, "post",
            Route = "ip-management/journeys/{id:guid}/pre-op/documents")]
        HttpRequestData req, Guid id)
    {
        try
        {
            RequireWardEdit(req);
            var (userId, tenantId) = _jwt.ValidateAndExtract(req);
            var tid  = _jwt.ExtractTenantId(req, tenantId);
            var body = await JsonSerializer.DeserializeAsync<UploadPreOpDocumentRequest>(req.Body, Json)
                       ?? throw new ArgumentException("Body required.");

            if (string.IsNullOrWhiteSpace(body.FileData))
                throw new ArgumentException("fileData (base64) is required.");

            var bytes  = Convert.FromBase64String(body.FileData);
            using var stream = new MemoryStream(bytes);

            var result = await _preOp.UploadDocumentAsync(
                id, tid, userId,
                body.DocumentType, body.FileName, body.ContentType, stream);

            return await Created(req, result);
        }
        catch (UnauthorizedAccessException ex) { return await Unauthorized(req, ex.Message); }
        catch (KeyNotFoundException ex)         { return await NotFound(req, ex.Message); }
        catch (ArgumentException ex)            { return await BadRequest(req, ex.Message); }
        catch (FormatException ex)              { return await BadRequest(req, $"fileData is not valid Base64: {ex.Message}"); }
        catch (Exception ex)                   { return await InternalError(req, ex.Message); }
    }

    [Function("VerifyPreOpDocument")]
    public async Task<HttpResponseData> VerifyPreOpDocument(
        [HttpTrigger(AuthorizationLevel.Function, "post",
            Route = "ip-management/journeys/{id:guid}/pre-op/documents/{docId:guid}/verify")]
        HttpRequestData req, Guid id, Guid docId)
    {
        try
        {
            RequireWardEdit(req);
            var (userId, tenantId) = _jwt.ValidateAndExtract(req);
            var tid  = _jwt.ExtractTenantId(req, tenantId);
            var body = await JsonSerializer.DeserializeAsync<VerifyPreOpDocumentRequest>(req.Body, Json)
                       ?? throw new ArgumentException("Body required.");
            var result = await _preOp.VerifyDocumentAsync(id, tid, userId, docId, body);
            return await Ok(req, result);
        }
        catch (UnauthorizedAccessException ex) { return await Unauthorized(req, ex.Message); }
        catch (KeyNotFoundException ex)         { return await NotFound(req, ex.Message); }
        catch (ArgumentException ex)            { return await BadRequest(req, ex.Message); }
        catch (Exception ex)                   { return await InternalError(req, ex.Message); }
    }

    // ── Approve / Defer ────────────────────────────────────────────────────────

    [Function("ApprovePreOpClearance")]
    public async Task<HttpResponseData> ApprovePreOpClearance(
        [HttpTrigger(AuthorizationLevel.Function, "post",
            Route = "ip-management/journeys/{id:guid}/pre-op/clearance/approve")]
        HttpRequestData req, Guid id)
    {
        try
        {
            RequireWardEdit(req);
            var (userId, tenantId) = _jwt.ValidateAndExtract(req);
            var tid  = _jwt.ExtractTenantId(req, tenantId);
            var body = await JsonSerializer.DeserializeAsync<ApprovePreOpClearanceRequest>(req.Body, Json)
                       ?? throw new ArgumentException("Body required.");
            var result = await _preOp.ApprovePreOpAsync(id, tid, userId, body);
            return await Ok(req, result);
        }
        catch (UnauthorizedAccessException ex) { return await Unauthorized(req, ex.Message); }
        catch (KeyNotFoundException ex)         { return await NotFound(req, ex.Message); }
        catch (InvalidOperationException ex)    { return await Conflict(req, ex.Message); }
        catch (ArgumentException ex)            { return await BadRequest(req, ex.Message); }
        catch (Exception ex)                   { return await InternalError(req, ex.Message); }
    }

    [Function("DeferPreOpClearance")]
    public async Task<HttpResponseData> DeferPreOpClearance(
        [HttpTrigger(AuthorizationLevel.Function, "post",
            Route = "ip-management/journeys/{id:guid}/pre-op/clearance/defer")]
        HttpRequestData req, Guid id)
    {
        try
        {
            RequireWardEdit(req);
            var (userId, tenantId) = _jwt.ValidateAndExtract(req);
            var tid  = _jwt.ExtractTenantId(req, tenantId);
            var body = await JsonSerializer.DeserializeAsync<DeferPreOpClearanceRequest>(req.Body, Json)
                       ?? throw new ArgumentException("Body required.");
            var result = await _preOp.DeferPreOpAsync(id, tid, userId, body);
            return await Ok(req, result);
        }
        catch (UnauthorizedAccessException ex) { return await Unauthorized(req, ex.Message); }
        catch (KeyNotFoundException ex)         { return await NotFound(req, ex.Message); }
        catch (ArgumentException ex)            { return await BadRequest(req, ex.Message); }
        catch (Exception ex)                   { return await InternalError(req, ex.Message); }
    }

    // ── Section Clearance Coordination ────────────────────────────────────────

    [Function("RequestPreOpSection")]
    public async Task<HttpResponseData> RequestPreOpSection(
        [HttpTrigger(AuthorizationLevel.Function, "post",
            Route = "ip-management/journeys/{journeyId:guid}/pre-op/sections/{category}/request")]
        HttpRequestData req, Guid journeyId, string category)
    {
        try
        {
            RequireWardEdit(req);
            var (userId, tenantId) = _jwt.ValidateAndExtract(req);
            var tid    = _jwt.ExtractTenantId(req, tenantId);
            var body   = await TryDeserializeAsync<RequestPreOpSectionRequest>(req.Body)
                         ?? new RequestPreOpSectionRequest();
            var result = await _preOp.RequestSectionAsync(journeyId, tid, userId, category, body.Urgency);
            return await Ok(req, result);
        }
        catch (UnauthorizedAccessException ex) { return await Unauthorized(req, ex.Message); }
        catch (KeyNotFoundException ex)         { return await NotFound(req, ex.Message); }
        catch (Exception ex)                   { return await InternalError(req, ex.Message); }
    }

    [Function("RespondToPreOpSection")]
    public async Task<HttpResponseData> RespondToPreOpSection(
        [HttpTrigger(AuthorizationLevel.Function, "post",
            Route = "ip-management/journeys/{journeyId:guid}/pre-op/sections/{category}/respond")]
        HttpRequestData req, Guid journeyId, string category)
    {
        try
        {
            RequireWardEdit(req);
            var (userId, tenantId) = _jwt.ValidateAndExtract(req);
            var tid  = _jwt.ExtractTenantId(req, tenantId);
            var body = await JsonSerializer.DeserializeAsync<RespondPreOpSectionRequest>(req.Body, Json)
                       ?? throw new ArgumentException("Body required.");
            var result = await _preOp.RespondToSectionAsync(journeyId, tid, userId, category, body);
            return await Ok(req, result);
        }
        catch (UnauthorizedAccessException ex) { return await Unauthorized(req, ex.Message); }
        catch (KeyNotFoundException ex)         { return await NotFound(req, ex.Message); }
        catch (ArgumentException ex)            { return await BadRequest(req, ex.Message); }
        catch (Exception ex)                   { return await InternalError(req, ex.Message); }
    }

    [Function("ConfirmPreOpSection")]
    public async Task<HttpResponseData> ConfirmPreOpSection(
        [HttpTrigger(AuthorizationLevel.Function, "post",
            Route = "ip-management/journeys/{journeyId:guid}/pre-op/sections/{category}/confirm")]
        HttpRequestData req, Guid journeyId, string category)
    {
        try
        {
            RequireWardEdit(req);
            var (userId, tenantId) = _jwt.ValidateAndExtract(req);
            var tid  = _jwt.ExtractTenantId(req, tenantId);
            var body = await JsonSerializer.DeserializeAsync<ConfirmPreOpSectionRequest>(req.Body, Json)
                       ?? new ConfirmPreOpSectionRequest(null);
            var result = await _preOp.ConfirmSectionAsync(journeyId, tid, userId, category, body);
            return await Ok(req, result);
        }
        catch (UnauthorizedAccessException ex) { return await Unauthorized(req, ex.Message); }
        catch (KeyNotFoundException ex)         { return await NotFound(req, ex.Message); }
        catch (ArgumentException ex)            { return await BadRequest(req, ex.Message); }
        catch (Exception ex)                   { return await InternalError(req, ex.Message); }
    }

    [Function("PutPreOpSectionOnHold")]
    public async Task<HttpResponseData> PutPreOpSectionOnHold(
        [HttpTrigger(AuthorizationLevel.Function, "post",
            Route = "ip-management/journeys/{journeyId:guid}/pre-op/sections/{category}/hold")]
        HttpRequestData req, Guid journeyId, string category)
    {
        try
        {
            RequireWardEdit(req);
            var (userId, tenantId) = _jwt.ValidateAndExtract(req);
            var tid  = _jwt.ExtractTenantId(req, tenantId);
            var body = await JsonSerializer.DeserializeAsync<PutSectionOnHoldRequest>(req.Body, Json)
                       ?? throw new ArgumentException("Body required.");
            var result = await _preOp.PutSectionOnHoldAsync(journeyId, tid, userId, category, body);
            return await Ok(req, result);
        }
        catch (UnauthorizedAccessException ex)  { return await Unauthorized(req, ex.Message); }
        catch (KeyNotFoundException ex)          { return await NotFound(req, ex.Message); }
        catch (InvalidOperationException ex)     { return await Conflict(req, ex.Message); }
        catch (ArgumentException ex)             { return await BadRequest(req, ex.Message); }
        catch (Exception ex)                    { return await InternalError(req, ex.Message); }
    }

    [Function("RejectPreOpSection")]
    public async Task<HttpResponseData> RejectPreOpSection(
        [HttpTrigger(AuthorizationLevel.Function, "post",
            Route = "ip-management/journeys/{journeyId:guid}/pre-op/sections/{category}/reject")]
        HttpRequestData req, Guid journeyId, string category)
    {
        try
        {
            RequireWardEdit(req);
            var (userId, tenantId) = _jwt.ValidateAndExtract(req);
            var tid  = _jwt.ExtractTenantId(req, tenantId);
            var body = await JsonSerializer.DeserializeAsync<RejectSectionRequest>(req.Body, Json)
                       ?? throw new ArgumentException("Body required.");
            var result = await _preOp.RejectSectionAsync(journeyId, tid, userId, category, body);
            return await Ok(req, result);
        }
        catch (UnauthorizedAccessException ex)  { return await Unauthorized(req, ex.Message); }
        catch (KeyNotFoundException ex)          { return await NotFound(req, ex.Message); }
        catch (ArgumentException ex)             { return await BadRequest(req, ex.Message); }
        catch (Exception ex)                    { return await InternalError(req, ex.Message); }
    }

    [Function("RequestMoreInfoPreOpSection")]
    public async Task<HttpResponseData> RequestMoreInfoPreOpSection(
        [HttpTrigger(AuthorizationLevel.Function, "post",
            Route = "ip-management/journeys/{journeyId:guid}/pre-op/sections/{category}/needs-info")]
        HttpRequestData req, Guid journeyId, string category)
    {
        try
        {
            var (userId, tenantId) = _jwt.ValidateAndExtract(req);
            var tid  = _jwt.ExtractTenantId(req, tenantId);
            var body = await JsonSerializer.DeserializeAsync<RequestMoreInfoRequest>(req.Body, Json)
                       ?? throw new ArgumentException("Body required.");
            var result = await _preOp.RequestMoreInfoAsync(journeyId, tid, userId, category, body);
            return await Ok(req, result);
        }
        catch (UnauthorizedAccessException ex)  { return await Unauthorized(req, ex.Message); }
        catch (KeyNotFoundException ex)          { return await NotFound(req, ex.Message); }
        catch (InvalidOperationException ex)     { return await Conflict(req, ex.Message); }
        catch (ArgumentException ex)             { return await BadRequest(req, ex.Message); }
        catch (Exception ex)                    { return await InternalError(req, ex.Message); }
    }

    [Function("EscalatePreOpSection")]
    public async Task<HttpResponseData> EscalatePreOpSection(
        [HttpTrigger(AuthorizationLevel.Function, "post",
            Route = "ip-management/journeys/{journeyId:guid}/pre-op/sections/{category}/escalate")]
        HttpRequestData req, Guid journeyId, string category)
    {
        try
        {
            RequireWardEdit(req);
            var (userId, tenantId) = _jwt.ValidateAndExtract(req);
            var tid  = _jwt.ExtractTenantId(req, tenantId);
            var body = await JsonSerializer.DeserializeAsync<EscalateSectionRequest>(req.Body, Json)
                       ?? throw new ArgumentException("Body required.");
            var result = await _preOp.EscalateSectionAsync(journeyId, tid, userId, category, body);
            return await Ok(req, result);
        }
        catch (UnauthorizedAccessException ex)  { return await Unauthorized(req, ex.Message); }
        catch (KeyNotFoundException ex)          { return await NotFound(req, ex.Message); }
        catch (ArgumentException ex)             { return await BadRequest(req, ex.Message); }
        catch (Exception ex)                    { return await InternalError(req, ex.Message); }
    }

    // ── Helpers ────────────────────────────────────────────────────────────────

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

    private static async Task<HttpResponseData> Conflict(HttpRequestData req, string message)
    {
        var r = req.CreateResponse(HttpStatusCode.Conflict);
        await r.WriteAsJsonAsync(new { error = message });
        return r;
    }

    private static async Task<HttpResponseData> InternalError(HttpRequestData req, string message)
    {
        var r = req.CreateResponse(HttpStatusCode.InternalServerError);
        await r.WriteAsJsonAsync(new { error = message });
        return r;
    }

    private async Task<T?> TryDeserializeAsync<T>(Stream body) where T : class
    {
        try { return await JsonSerializer.DeserializeAsync<T>(body, Json); }
        catch { return null; }
    }

    private static Dictionary<string, string> ParseQs(string query)
    {
        var result = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);
        if (string.IsNullOrWhiteSpace(query)) return result;
        var q = query.TrimStart('?');
        foreach (var part in q.Split('&', StringSplitOptions.RemoveEmptyEntries))
        {
            var idx = part.IndexOf('=');
            if (idx < 0) continue;
            var key = Uri.UnescapeDataString(part[..idx]);
            var val = Uri.UnescapeDataString(part[(idx + 1)..]);
            result.TryAdd(key, val);
        }
        return result;
    }
}
