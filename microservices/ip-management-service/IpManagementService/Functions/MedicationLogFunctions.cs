using System.Net;
using System.Text.Json;
using System.Text.Json.Serialization;
using Microsoft.Azure.Functions.Worker;
using Microsoft.Azure.Functions.Worker.Http;
using IpManagementService.Models.Dtos;
using IpManagementService.Services;

namespace IpManagementService.Functions;

/// <summary>
/// Form 4 — Pre-op medication log.
///   GET    /api/ip-management/journeys/{id}/medication-log
///   PUT    /api/ip-management/journeys/{id}/medication-log/meta
///   POST   /api/ip-management/journeys/{id}/medication-log/drugs
///   POST   /api/ip-management/journeys/{id}/medication-log/doses/{doseId}
///   DELETE /api/ip-management/journeys/{id}/medication-log/drugs/{medicineName}
/// </summary>
public class MedicationLogFunctions
{
    private readonly MedicationLogService _svc;
    private readonly JwtService           _jwt;

    private static readonly JsonSerializerOptions Json = new()
    {
        PropertyNamingPolicy   = JsonNamingPolicy.CamelCase,
        DefaultIgnoreCondition = JsonIgnoreCondition.WhenWritingNull,
    };

    public MedicationLogFunctions(MedicationLogService svc, JwtService jwt)
    {
        _svc = svc;
        _jwt = jwt;
    }

    [Function("GetMedicationLog")]
    public async Task<HttpResponseData> Get(
        [HttpTrigger(AuthorizationLevel.Function, "get",
            Route = "ip-management/journeys/{id:guid}/medication-log")]
        HttpRequestData req, Guid id)
    {
        try
        {
            var (_, tenantId) = _jwt.ValidateAndExtract(req);
            var tid           = _jwt.ExtractTenantId(req, tenantId);
            return await Ok(req, await _svc.GetMedicationLogAsync(id, tid));
        }
        catch (KeyNotFoundException ex)        { return await NotFound(req, ex.Message); }
        catch (UnauthorizedAccessException ex) { return await Unauthorized(req, ex.Message); }
        catch (Exception ex)                 { return await InternalError(req, ex.Message); }
    }

    [Function("UpdateMedicationLogMeta")]
    public async Task<HttpResponseData> UpdateMeta(
        [HttpTrigger(AuthorizationLevel.Function, "put",
            Route = "ip-management/journeys/{id:guid}/medication-log/meta")]
        HttpRequestData req, Guid id)
    {
        try
        {
            IpChecklistAuth.RequirePermission(req, _jwt, "ward.checklist.edit");
            var (userId, tenantId) = _jwt.ValidateAndExtract(req);
            var tid                = _jwt.ExtractTenantId(req, tenantId);
            var body = await JsonSerializer.DeserializeAsync<UpdateMedicationLogMetaRequest>(req.Body, Json)
                       ?? throw new ArgumentException("Request body is required.");
            return await Ok(req, await _svc.UpdateMetaAsync(id, tid, userId, body));
        }
        catch (KeyNotFoundException ex)        { return await NotFound(req, ex.Message); }
        catch (UnauthorizedAccessException ex) { return await Unauthorized(req, ex.Message); }
        catch (ArgumentException ex)           { return await BadRequest(req, ex.Message); }
        catch (Exception ex)                 { return await InternalError(req, ex.Message); }
    }

    [Function("AddMedicationDrug")]
    public async Task<HttpResponseData> AddDrug(
        [HttpTrigger(AuthorizationLevel.Function, "post",
            Route = "ip-management/journeys/{id:guid}/medication-log/drugs")]
        HttpRequestData req, Guid id)
    {
        try
        {
            IpChecklistAuth.RequirePermission(req, _jwt, "ward.checklist.edit");
            var (userId, tenantId) = _jwt.ValidateAndExtract(req);
            var tid                = _jwt.ExtractTenantId(req, tenantId);
            var body = await JsonSerializer.DeserializeAsync<AddMedicationDrugRequest>(req.Body, Json)
                       ?? throw new ArgumentException("Request body is required.");
            return await Ok(req, await _svc.AddDrugAsync(id, tid, userId, body));
        }
        catch (KeyNotFoundException ex)        { return await NotFound(req, ex.Message); }
        catch (UnauthorizedAccessException ex) { return await Unauthorized(req, ex.Message); }
        catch (ArgumentException ex)           { return await BadRequest(req, ex.Message); }
        catch (InvalidOperationException ex) { return await BadRequest(req, ex.Message); }
        catch (Exception ex)                 { return await InternalError(req, ex.Message); }
    }

    [Function("SaveMedicationDose")]
    public async Task<HttpResponseData> SaveDose(
        [HttpTrigger(AuthorizationLevel.Function, "post",
            Route = "ip-management/journeys/{id:guid}/medication-log/doses/{doseId:guid}")]
        HttpRequestData req, Guid id, Guid doseId)
    {
        try
        {
            IpChecklistAuth.RequirePermission(req, _jwt, "ward.checklist.edit");
            var (userId, tenantId) = _jwt.ValidateAndExtract(req);
            var tid                = _jwt.ExtractTenantId(req, tenantId);
            var body = await JsonSerializer.DeserializeAsync<SaveMedicationDoseRequest>(req.Body, Json)
                       ?? throw new ArgumentException("Request body is required.");
            return await Ok(req, await _svc.SaveDoseAsync(id, doseId, tid, userId, body));
        }
        catch (KeyNotFoundException ex)        { return await NotFound(req, ex.Message); }
        catch (UnauthorizedAccessException ex) { return await Unauthorized(req, ex.Message); }
        catch (ArgumentException ex)           { return await BadRequest(req, ex.Message); }
        catch (Exception ex)                 { return await InternalError(req, ex.Message); }
    }

    [Function("RemoveMedicationDrug")]
    public async Task<HttpResponseData> RemoveDrug(
        [HttpTrigger(AuthorizationLevel.Function, "delete",
            Route = "ip-management/journeys/{id:guid}/medication-log/drugs/{medicineName}")]
        HttpRequestData req, Guid id, string medicineName)
    {
        try
        {
            IpChecklistAuth.RequirePermission(req, _jwt, "ward.checklist.edit");
            var (_, tenantId) = _jwt.ValidateAndExtract(req);
            var tid           = _jwt.ExtractTenantId(req, tenantId);
            var name          = Uri.UnescapeDataString(medicineName);
            return await Ok(req, await _svc.RemoveDrugAsync(id, tid, name));
        }
        catch (KeyNotFoundException ex)        { return await NotFound(req, ex.Message); }
        catch (UnauthorizedAccessException ex) { return await Unauthorized(req, ex.Message); }
        catch (Exception ex)                 { return await InternalError(req, ex.Message); }
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
