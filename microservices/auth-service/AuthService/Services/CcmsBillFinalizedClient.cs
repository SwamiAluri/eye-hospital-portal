using System.Net.Http.Json;
using System.Text;
using System.Text.Json;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;

namespace AuthService.Services;

/// <summary>
/// Phase 2 residual: Billing owns finalized bills and notifies CCMS.
/// IP FinancialState.Settled remains a secondary bridge only.
/// </summary>
public interface ICcmsBillFinalizedClient
{
    Task NotifyBillFinalizedAsync(
        Guid tenantId,
        Guid? journeyId,
        Guid? sessionId,
        Guid billId,
        decimal? totalAmount,
        Guid actorUserId,
        CancellationToken ct = default);
}

public sealed class CcmsBillFinalizedClient : ICcmsBillFinalizedClient
{
    private readonly HttpClient _http;
    private readonly ILogger<CcmsBillFinalizedClient> _log;
    private readonly string _internalKey;
    private readonly string _baseUrl;

    public CcmsBillFinalizedClient(
        HttpClient http,
        IConfiguration config,
        ILogger<CcmsBillFinalizedClient> log)
    {
        _http = http;
        _log = log;
        _baseUrl = (config["CcmsService:BaseUrl"] ?? "http://localhost:7075/api").TrimEnd('/');
        _internalKey = config["InternalApi:Key"]
            ?? config["InternalApiKey"]
            ?? config["AuthService:InternalApiKey"]
            ?? config["AuthService__InternalApiKey"]
            ?? "hp-internal-svc-key-change-in-production-2026";
    }

    public async Task NotifyBillFinalizedAsync(
        Guid tenantId,
        Guid? journeyId,
        Guid? sessionId,
        Guid billId,
        decimal? totalAmount,
        Guid actorUserId,
        CancellationToken ct = default)
    {
        try
        {
            var payload = new
            {
                payloadVersion = 1,
                tenantId,
                journeyId,
                sessionId,
                counsellingSessionId = sessionId,
                billId,
                totalAmount,
                actorUserId,
                correlationId = billId,
                occurredAt = DateTime.UtcNow,
                source = "billing.opd.finalize",
            };

            using var req = new HttpRequestMessage(
                HttpMethod.Post,
                $"{_baseUrl}/ccms/integration/bill-finalized")
            {
                Content = new StringContent(
                    JsonSerializer.Serialize(payload),
                    Encoding.UTF8,
                    "application/json"),
            };
            req.Headers.TryAddWithoutValidation("X-Internal-Key", _internalKey);
            req.Headers.TryAddWithoutValidation("X-Tenant-ID", tenantId.ToString());
            req.Headers.TryAddWithoutValidation(
                "X-Idempotency-Key",
                $"BillFinalized:billing:{billId:N}");

            var resp = await _http.SendAsync(req, ct);
            if (!resp.IsSuccessStatusCode)
            {
                var body = await resp.Content.ReadAsStringAsync(ct);
                _log.LogWarning(
                    "CCMS bill-finalized returned {Status} for bill {BillId}: {Body}",
                    (int)resp.StatusCode, billId, body);
            }
        }
        catch (Exception ex)
        {
            // Non-blocking — billing finalize must succeed even if CCMS is down.
            _log.LogWarning(ex, "CCMS bill-finalized notify failed for bill {BillId}", billId);
        }
    }
}
