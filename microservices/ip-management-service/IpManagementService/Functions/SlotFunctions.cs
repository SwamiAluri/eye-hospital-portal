using System.Net;
using System.Text.Json;
using System.Text.Json.Serialization;
using Microsoft.Azure.Functions.Worker;
using Microsoft.Azure.Functions.Worker.Http;
using IpManagementService.Models.Dtos;
using IpManagementService.Services;

namespace IpManagementService.Functions;

/// <summary>
/// IP-013 slot board.
/// GET    ip-management/slots
/// GET    ip-management/slots/metrics
/// GET    ip-management/slots/throughput
/// POST   ip-management/slots
/// PATCH  ip-management/slots/reorder
/// POST   ip-management/slots/{id}/release
/// GET    ip-management/journeys/{id}/slots
/// </summary>
public class SlotFunctions
{
    private readonly SlotService _slots;
    private readonly JwtService _jwt;

    private static readonly JsonSerializerOptions Json = new()
    {
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
        DefaultIgnoreCondition = JsonIgnoreCondition.WhenWritingNull,
        WriteIndented = false,
    };

    public SlotFunctions(SlotService slots, JwtService jwt)
    {
        _slots = slots;
        _jwt = jwt;
    }

    [Function("ListSlots")]
    public async Task<HttpResponseData> ListSlots(
        [HttpTrigger(AuthorizationLevel.Function, "get", Route = "ip-management/slots")]
        HttpRequestData req)
    {
        try
        {
            var (_, tenantId) = _jwt.ValidateAndExtract(req);
            var tid = _jwt.ExtractTenantId(req, tenantId);
            var qs = ParseQs(req.Url.Query);
            if (!qs.TryGetValue("branchId", out var branchStr) || !Guid.TryParse(branchStr, out var branchId))
                return await BadRequest(req, "branchId is required.");
            if (!TryDate(qs, out var date))
                return await BadRequest(req, "date is required (yyyy-MM-dd).");
            Guid? theatreId = qs.TryGetValue("theatreId", out var th) && Guid.TryParse(th, out var tidTheatre)
                ? tidTheatre : null;

            var board = await _slots.ListBoardAsync(tid, branchId, date, theatreId);
            return await Ok(req, board);
        }
        catch (UnauthorizedAccessException ex) { return await Unauthorized(req, ex.Message); }
        catch (ArgumentException ex) { return await BadRequest(req, ex.Message); }
        catch (Exception ex) { return await InternalError(req, ex.Message); }
    }

    [Function("GetSlotMetrics")]
    public async Task<HttpResponseData> GetSlotMetrics(
        [HttpTrigger(AuthorizationLevel.Function, "get", Route = "ip-management/slots/metrics")]
        HttpRequestData req)
    {
        try
        {
            var (_, tenantId) = _jwt.ValidateAndExtract(req);
            var tid = _jwt.ExtractTenantId(req, tenantId);
            var qs = ParseQs(req.Url.Query);
            if (!qs.TryGetValue("branchId", out var branchStr) || !Guid.TryParse(branchStr, out var branchId))
                return await BadRequest(req, "branchId is required.");
            if (!TryDate(qs, out var date))
                return await BadRequest(req, "date is required (yyyy-MM-dd).");
            Guid? theatreId = qs.TryGetValue("theatreId", out var th) && Guid.TryParse(th, out var tidTheatre)
                ? tidTheatre : null;

            var metrics = await _slots.GetMetricsAsync(tid, branchId, date, theatreId);
            return await Ok(req, metrics);
        }
        catch (UnauthorizedAccessException ex) { return await Unauthorized(req, ex.Message); }
        catch (ArgumentException ex) { return await BadRequest(req, ex.Message); }
        catch (Exception ex) { return await InternalError(req, ex.Message); }
    }

    [Function("GetSlotThroughput")]
    public async Task<HttpResponseData> GetSlotThroughput(
        [HttpTrigger(AuthorizationLevel.Function, "get", Route = "ip-management/slots/throughput")]
        HttpRequestData req)
    {
        try
        {
            var (_, tenantId) = _jwt.ValidateAndExtract(req);
            var tid = _jwt.ExtractTenantId(req, tenantId);
            var qs = ParseQs(req.Url.Query);
            if (!qs.TryGetValue("branchId", out var branchStr) || !Guid.TryParse(branchStr, out var branchId))
                return await BadRequest(req, "branchId is required.");

            var today = DateOnly.FromDateTime(DateTime.UtcNow);
            var from = TryDateKey(qs, "from", out var fromDate) ? fromDate : today.AddDays(-6);
            var to = TryDateKey(qs, "to", out var toDate) ? toDate : today;
            Guid? theatreId = qs.TryGetValue("theatreId", out var th) && Guid.TryParse(th, out var tidTheatre)
                ? tidTheatre : null;

            var report = await _slots.GetThroughputAsync(tid, branchId, from, to, theatreId);
            return await Ok(req, report);
        }
        catch (UnauthorizedAccessException ex) { return await Unauthorized(req, ex.Message); }
        catch (ArgumentException ex) { return await BadRequest(req, ex.Message); }
        catch (Exception ex) { return await InternalError(req, ex.Message); }
    }

    [Function("AssignSlot")]
    public async Task<HttpResponseData> AssignSlot(
        [HttpTrigger(AuthorizationLevel.Function, "post", Route = "ip-management/slots")]
        HttpRequestData req)
    {
        try
        {
            var (userId, tenantId) = _jwt.ValidateAndExtract(req);
            IpChecklistAuth.RequireAnyPermission(req, _jwt, IpChecklistAuth.PermSendToOt, IpChecklistAuth.PermWardEdit);
            var tid = _jwt.ExtractTenantId(req, tenantId);
            var body = await JsonSerializer.DeserializeAsync<AssignSlotRequest>(req.Body, Json)
                ?? throw new ArgumentException("Request body is required.");
            var row = await _slots.AssignAsync(tid, userId, body);
            return await Created(req, row);
        }
        catch (UnauthorizedAccessException ex) { return await Unauthorized(req, ex.Message); }
        catch (ArgumentException ex) { return await BadRequest(req, ex.Message); }
        catch (KeyNotFoundException ex) { return await NotFound(req, ex.Message); }
        catch (InvalidOperationException ex) { return await Conflict(req, ex.Message); }
        catch (Exception ex) { return await InternalError(req, ex.Message); }
    }

    [Function("ReorderSlots")]
    public async Task<HttpResponseData> ReorderSlots(
        [HttpTrigger(AuthorizationLevel.Function, "patch", Route = "ip-management/slots/reorder")]
        HttpRequestData req)
    {
        try
        {
            var (userId, tenantId) = _jwt.ValidateAndExtract(req);
            IpChecklistAuth.RequireAnyPermission(req, _jwt, IpChecklistAuth.PermSendToOt, IpChecklistAuth.PermWardEdit);
            var tid = _jwt.ExtractTenantId(req, tenantId);
            var body = await JsonSerializer.DeserializeAsync<ReorderSlotsRequest>(req.Body, Json)
                ?? throw new ArgumentException("Request body is required.");
            var rows = await _slots.ReorderAsync(tid, userId, body);
            return await Ok(req, rows);
        }
        catch (UnauthorizedAccessException ex) { return await Unauthorized(req, ex.Message); }
        catch (ArgumentException ex) { return await BadRequest(req, ex.Message); }
        catch (KeyNotFoundException ex) { return await NotFound(req, ex.Message); }
        catch (InvalidOperationException ex) { return await Conflict(req, ex.Message); }
        catch (Exception ex) { return await InternalError(req, ex.Message); }
    }

    [Function("ReleaseSlot")]
    public async Task<HttpResponseData> ReleaseSlot(
        [HttpTrigger(AuthorizationLevel.Function, "post", Route = "ip-management/slots/{id:guid}/release")]
        HttpRequestData req, Guid id)
    {
        try
        {
            var (userId, tenantId) = _jwt.ValidateAndExtract(req);
            IpChecklistAuth.RequireAnyPermission(req, _jwt, IpChecklistAuth.PermSendToOt, IpChecklistAuth.PermWardEdit);
            var tid = _jwt.ExtractTenantId(req, tenantId);
            var body = await JsonSerializer.DeserializeAsync<ReleaseSlotRequest>(req.Body, Json)
                       ?? new ReleaseSlotRequest();
            await _slots.ReleaseAsync(tid, userId, id, body.Reason);
            return await Ok(req, new { ok = true });
        }
        catch (UnauthorizedAccessException ex) { return await Unauthorized(req, ex.Message); }
        catch (ArgumentException ex) { return await BadRequest(req, ex.Message); }
        catch (KeyNotFoundException ex) { return await NotFound(req, ex.Message); }
        catch (InvalidOperationException ex) { return await Conflict(req, ex.Message); }
        catch (Exception ex) { return await InternalError(req, ex.Message); }
    }

    [Function("ListJourneySlots")]
    public async Task<HttpResponseData> ListJourneySlots(
        [HttpTrigger(AuthorizationLevel.Function, "get", Route = "ip-management/journeys/{id:guid}/slots")]
        HttpRequestData req, Guid id)
    {
        try
        {
            var (_, tenantId) = _jwt.ValidateAndExtract(req);
            var tid = _jwt.ExtractTenantId(req, tenantId);
            var rows = await _slots.ListHistoryAsync(tid, id);
            return await Ok(req, rows);
        }
        catch (UnauthorizedAccessException ex) { return await Unauthorized(req, ex.Message); }
        catch (Exception ex) { return await InternalError(req, ex.Message); }
    }

    private static bool TryDate(Dictionary<string, string> qs, out DateOnly date)
        => TryDateKey(qs, "date", out date);

    private static bool TryDateKey(Dictionary<string, string> qs, string key, out DateOnly date)
    {
        date = default;
        return qs.TryGetValue(key, out var raw) && DateOnly.TryParse(raw, out date);
    }

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
}
