using System.Net;
using System.Text.Json;
using System.Text.Json.Serialization;
using Microsoft.Azure.Functions.Worker;
using Microsoft.Azure.Functions.Worker.Http;
using IpManagementService.Models.Dtos;
using IpManagementService.Services;

namespace IpManagementService.Functions;

public class BedAndStayFunctions
{
    private readonly PatientJourneyService _journeySvc;
    private readonly DailyProgressNoteService _notes;
    private readonly JwtService _jwt;

    private static readonly JsonSerializerOptions Json = new()
    {
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
        DefaultIgnoreCondition = JsonIgnoreCondition.WhenWritingNull,
    };

    public BedAndStayFunctions(
        PatientJourneyService journeySvc,
        DailyProgressNoteService notes,
        JwtService jwt)
    {
        _journeySvc = journeySvc;
        _notes = notes;
        _jwt = jwt;
    }

    [Function("ListDailyProgressNotes")]
    public async Task<HttpResponseData> ListNotes(
        [HttpTrigger(AuthorizationLevel.Function, "get",
            Route = "ip-management/journeys/{id:guid}/progress-notes")]
        HttpRequestData req, Guid id)
    {
        var (userId, tenantId) = _jwt.ValidateAndExtract(req);
        var tid = _jwt.ExtractTenantId(req, tenantId);
        _ = userId;
        var list = await _notes.ListAsync(id, tid);
        var resp = req.CreateResponse(HttpStatusCode.OK);
        await resp.WriteAsJsonAsync(list);
        return resp;
    }

    [Function("AddDailyProgressNote")]
    public async Task<HttpResponseData> AddNote(
        [HttpTrigger(AuthorizationLevel.Function, "post",
            Route = "ip-management/journeys/{id:guid}/progress-notes")]
        HttpRequestData req, Guid id)
    {
        IpChecklistAuth.RequireClinicalTransition(req, _jwt);
        var (userId, tenantId) = _jwt.ValidateAndExtract(req);
        var tid = _jwt.ExtractTenantId(req, tenantId);
        var body = await JsonSerializer.DeserializeAsync<ProgressNoteRequest>(req.Body, Json)
                   ?? throw new ArgumentException("Body required.");
        var dto = await _notes.AddAsync(id, tid, userId, body.Note);
        var resp = req.CreateResponse(HttpStatusCode.Created);
        await resp.WriteAsJsonAsync(dto);
        return resp;
    }

    [Function("SetDischargePlanning")]
    public async Task<HttpResponseData> SetDischargePlanning(
        [HttpTrigger(AuthorizationLevel.Function, "post",
            Route = "ip-management/journeys/{id:guid}/discharge-planning")]
        HttpRequestData req, Guid id)
    {
        IpChecklistAuth.RequireClinicalTransition(req, _jwt);
        var (userId, tenantId) = _jwt.ValidateAndExtract(req);
        var tid = _jwt.ExtractTenantId(req, tenantId);
        var body = await JsonSerializer.DeserializeAsync<DischargePlanningRequest>(req.Body, Json)
                   ?? throw new ArgumentException("Body required.");
        var result = await _journeySvc.SetDischargePlanningAsync(id, tid, userId, body.Ready);
        var resp = req.CreateResponse(HttpStatusCode.OK);
        await resp.WriteAsJsonAsync(result);
        return resp;
    }
}

public record ProgressNoteRequest(string Note);
public record DischargePlanningRequest(bool Ready);
