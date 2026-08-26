using System.Net;
using System.Text.Json;
using InventoryApi.Models.DTOs;
using InventoryApi.Services;
using Microsoft.Azure.Functions.Worker;
using Microsoft.Azure.Functions.Worker.Http;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;

namespace InventoryApi.Functions.Stock;

public sealed class ImplantStockFunctions
{
    private readonly IImplantStockService _stock;
    private readonly IConfiguration _config;
    private readonly ILogger<ImplantStockFunctions> _log;

    private static readonly JsonSerializerOptions Json = new()
    {
        PropertyNameCaseInsensitive = true,
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
    };

    public ImplantStockFunctions(
        IImplantStockService stock, IConfiguration config, ILogger<ImplantStockFunctions> log)
    {
        _stock = stock;
        _config = config;
        _log = log;
    }

    [Function("ApplyImplantStock")]
    public async Task<HttpResponseData> Apply(
        [HttpTrigger(AuthorizationLevel.Anonymous, "post", Route = "internal/implants/apply")]
        HttpRequestData req, CancellationToken ct)
    {
        if (!IsAuthorized(req))
        {
            var denied = req.CreateResponse(HttpStatusCode.Unauthorized);
            await denied.WriteAsJsonAsync(new { error = "Invalid or missing internal API key." });
            return denied;
        }

        try
        {
            var tenantId = ParseGuid(req, "X-Tenant-Id");
            var userId = TryParseGuid(req, "X-User-Id") ?? Guid.Empty;
            var body = await JsonSerializer.DeserializeAsync<ApplyImplantStockRequest>(req.Body, Json, ct)
                       ?? throw new ArgumentException("Invalid request body.");
            if (body.ActorUserId is Guid actor && actor != Guid.Empty)
                userId = actor;

            var result = await _stock.ApplyAsync(tenantId, userId, body, ct);
            var res = req.CreateResponse(HttpStatusCode.OK);
            await res.WriteAsJsonAsync(result);
            return res;
        }
        catch (ArgumentException ex)
        {
            var bad = req.CreateResponse(HttpStatusCode.BadRequest);
            await bad.WriteAsJsonAsync(new { error = ex.Message });
            return bad;
        }
        catch (Exception ex)
        {
            _log.LogWarning(ex, "Implant stock apply failed");
            var err = req.CreateResponse(HttpStatusCode.InternalServerError);
            await err.WriteAsJsonAsync(new { error = ex.Message });
            return err;
        }
    }

    private bool IsAuthorized(HttpRequestData req)
    {
        req.Headers.TryGetValues("X-Internal-Key", out var values);
        var provided = values?.FirstOrDefault() ?? string.Empty;
        var expected = _config["InternalApi:Key"]
            ?? _config["InternalApiKey"]
            ?? _config["AuthService:InternalApiKey"]
            ?? string.Empty;
        return !string.IsNullOrWhiteSpace(expected)
               && string.Equals(provided, expected, StringComparison.Ordinal);
    }

    private static Guid ParseGuid(HttpRequestData req, string header)
    {
        if (!req.Headers.TryGetValues(header, out var values))
            throw new ArgumentException($"Missing required header {header}.");
        return Guid.Parse(values.First());
    }

    private static Guid? TryParseGuid(HttpRequestData req, string header)
    {
        if (!req.Headers.TryGetValues(header, out var values)) return null;
        return Guid.TryParse(values.FirstOrDefault(), out var id) ? id : null;
    }
}
