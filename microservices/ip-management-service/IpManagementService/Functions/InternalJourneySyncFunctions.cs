using System.Net;
using System.Text.Json;
using System.Text.Json.Serialization;
using Microsoft.Azure.Functions.Worker;
using Microsoft.Azure.Functions.Worker.Http;
using Microsoft.Extensions.Configuration;
using IpManagementService.Models.Dtos;
using IpManagementService.Services;

namespace IpManagementService.Functions;

/// <summary>
/// Internal endpoints called by auth-service when OT schedule dates change.
/// Protected by X-Internal-Key (same secret as outbound auth calls).
/// </summary>
public class InternalJourneySyncFunctions
{
    private readonly PatientJourneyService _journeySvc;
    private readonly IConfiguration _config;

    private static readonly JsonSerializerOptions Json = new()
    {
        PropertyNamingPolicy   = JsonNamingPolicy.CamelCase,
        DefaultIgnoreCondition = JsonIgnoreCondition.WhenWritingNull,
        WriteIndented          = false,
    };

    public InternalJourneySyncFunctions(PatientJourneyService journeySvc, IConfiguration config)
    {
        _journeySvc = journeySvc;
        _config     = config;
    }

    [Function("ApplyCounsellingRebook")]
    public async Task<HttpResponseData> ApplyCounsellingRebook(
        [HttpTrigger(AuthorizationLevel.Function, "post",
             Route = "ip-management/internal/journey-sync/apply-rebook")]
        HttpRequestData req)
    {
        if (!ValidateInternalKey(req))
        {
            var unauthorized = req.CreateResponse(HttpStatusCode.Unauthorized);
            await unauthorized.WriteAsJsonAsync(new { error = "Invalid internal API key." });
            return unauthorized;
        }

        try
        {
            var body = await JsonSerializer.DeserializeAsync<ApplyCounsellingRebookRequest>(req.Body, Json)
                       ?? throw new ArgumentException("Body required.");
            if (body.OtScheduleId == Guid.Empty || body.TenantId == Guid.Empty)
                throw new ArgumentException("otScheduleId and tenantId are required.");

            var result = await _journeySvc.ApplyCounsellingRebookAsync(body);
            var response = req.CreateResponse(result is null ? HttpStatusCode.NotFound : HttpStatusCode.OK);
            response.Headers.Add("Content-Type", "application/json; charset=utf-8");
            await response.WriteStringAsync(JsonSerializer.Serialize(
                result ?? (object)new { message = "No journey linked to schedule." }, Json));
            return response;
        }
        catch (ArgumentException ex)
        {
            var bad = req.CreateResponse(HttpStatusCode.BadRequest);
            await bad.WriteStringAsync(JsonSerializer.Serialize(new { error = ex.Message }, Json));
            return bad;
        }
        catch (Exception ex)
        {
            var err = req.CreateResponse(HttpStatusCode.InternalServerError);
            await err.WriteStringAsync(JsonSerializer.Serialize(new { error = ex.Message }, Json));
            return err;
        }
    }

    [Function("ApplyOpdClinicalCopy")]
    public async Task<HttpResponseData> ApplyOpdClinicalCopy(
        [HttpTrigger(AuthorizationLevel.Function, "post",
             Route = "ip-management/internal/journey-sync/copy-opd")]
        HttpRequestData req)
    {
        if (!ValidateInternalKey(req))
        {
            var unauthorized = req.CreateResponse(HttpStatusCode.Unauthorized);
            await unauthorized.WriteStringAsync("""{"error":"Invalid internal API key."}""");
            return unauthorized;
        }

        try
        {
            var body = await JsonSerializer.DeserializeAsync<ApplyOpdClinicalCopyRequest>(req.Body, Json)
                       ?? throw new ArgumentException("Body required.");
            if (body.OtScheduleId == Guid.Empty || body.TenantId == Guid.Empty)
                throw new ArgumentException("otScheduleId and tenantId are required.");

            var result = await _journeySvc.ApplyOpdClinicalCopyAsync(body);
            var response = req.CreateResponse(result is null ? HttpStatusCode.NotFound : HttpStatusCode.OK);
            response.Headers.Add("Content-Type", "application/json; charset=utf-8");
            await response.WriteStringAsync(JsonSerializer.Serialize(
                result ?? (object)new { message = "No journey linked to schedule." }, Json));
            return response;
        }
        catch (ArgumentException ex)
        {
            var bad = req.CreateResponse(HttpStatusCode.BadRequest);
            await bad.WriteStringAsync(JsonSerializer.Serialize(new { error = ex.Message }, Json));
            return bad;
        }
        catch (Exception ex)
        {
            var err = req.CreateResponse(HttpStatusCode.InternalServerError);
            await err.WriteStringAsync(JsonSerializer.Serialize(new { error = ex.Message }, Json));
            return err;
        }
    }

    private bool ValidateInternalKey(HttpRequestData req)
    {
        var expected = _config["AuthService:InternalApiKey"]
            ?? _config["AuthService__InternalApiKey"]
            ?? string.Empty;
        if (string.IsNullOrWhiteSpace(expected)) return false;

        if (!req.Headers.TryGetValues("X-Internal-Key", out var values)) return false;
        var provided = values.FirstOrDefault();
        return string.Equals(provided, expected, StringComparison.Ordinal);
    }
}
