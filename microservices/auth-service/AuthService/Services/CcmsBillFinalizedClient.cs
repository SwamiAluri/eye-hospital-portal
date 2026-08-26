using System.Net.Http.Json;
using System.Text;
using System.Text.Json;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using AuthService.Models.Domain;

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

    Task NotifyLedgerEventAsync(
        string eventType,
        Guid tenantId,
        Guid? journeyId,
        Guid billId,
        decimal amount,
        Guid actorUserId,
        CancellationToken ct = default);

    /// <summary>Outbox delivery. Throws on HTTP/transport failure so the row can retry.</summary>
    Task DeliverOutboxEventAsync(
        string eventType,
        string payloadJson,
        string idempotencyKey,
        CancellationToken ct = default);
}

/// <summary>
/// Live CCMS patient share for a journey — same <c>validate-admission</c>
/// payload the IP discharge gate already uses. Not a second coverage engine.
/// </summary>
public interface ICcmsPatientShareLookup
{
    Task<CcmsPatientShareLookupResult> GetAsync(
        Guid tenantId, Guid journeyId, CancellationToken ct = default);
}

public readonly record struct CcmsPatientShareLookupResult(
    bool ServiceAvailable,
    bool HasCoverageCase,
    decimal PatientShare);

public sealed class CcmsBillFinalizedClient : ICcmsBillFinalizedClient, ICcmsPatientShareLookup
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

    public async Task NotifyLedgerEventAsync(
        string eventType,
        Guid tenantId,
        Guid? journeyId,
        Guid billId,
        decimal amount,
        Guid actorUserId,
        CancellationToken ct = default)
    {
        try
        {
            var route = eventType switch
            {
                "PaymentReceived" => "payment-received",
                "PaymentReversed" => "payment-reversed",
                _ => "patient-obligation-changed",
            };
            using var req = new HttpRequestMessage(
                HttpMethod.Post,
                $"{_baseUrl}/ccms/integration/{route}")
            {
                Content = new StringContent(
                    JsonSerializer.Serialize(new
                    {
                        tenantId,
                        journeyId,
                        billId,
                        amount,
                        actorUserId,
                        eventType,
                        occurredAt = DateTime.UtcNow,
                    }),
                    Encoding.UTF8,
                    "application/json"),
            };
            req.Headers.TryAddWithoutValidation("X-Internal-Key", _internalKey);
            req.Headers.TryAddWithoutValidation("X-Tenant-ID", tenantId.ToString());
            var idem = $"{eventType}:billing:{billId:N}:{amount:0.00}";
            req.Headers.TryAddWithoutValidation("Idempotency-Key", idem);
            req.Headers.TryAddWithoutValidation("X-Idempotency-Key", idem);
            var resp = await _http.SendAsync(req, ct);
            if (!resp.IsSuccessStatusCode)
            {
                var body = await resp.Content.ReadAsStringAsync(ct);
                _log.LogWarning("CCMS {Event} returned {Status} for bill {BillId}: {Body}",
                    eventType, (int)resp.StatusCode, billId, body);
            }
        }
        catch (Exception ex)
        {
            _log.LogWarning(ex, "CCMS {Event} notify failed for bill {BillId}", eventType, billId);
        }
    }

    public async Task DeliverOutboxEventAsync(
        string eventType,
        string payloadJson,
        string idempotencyKey,
        CancellationToken ct = default)
    {
        var route = eventType switch
        {
            BillingCcmsEventTypes.BillFinalized or "BillFinalized"
                => "bill-finalized",
            BillingCcmsEventTypes.PaymentReceived or "PaymentReceived"
                => "payment-received",
            BillingCcmsEventTypes.PaymentReversed or "PaymentReversed"
                => "payment-reversed",
            BillingCcmsEventTypes.PatientObligationChanged or "PatientObligationChanged"
                => "patient-obligation-changed",
            _ => throw new InvalidOperationException($"Unknown billing CCMS outbox event: {eventType}"),
        };

        using var req = new HttpRequestMessage(
            HttpMethod.Post,
            $"{_baseUrl}/ccms/integration/{route}")
        {
            Content = new StringContent(payloadJson, Encoding.UTF8, "application/json"),
        };
        req.Headers.TryAddWithoutValidation("X-Internal-Key", _internalKey);
        req.Headers.TryAddWithoutValidation("Idempotency-Key", idempotencyKey);
        req.Headers.TryAddWithoutValidation("X-Idempotency-Key", idempotencyKey);

        try
        {
            using var doc = JsonDocument.Parse(payloadJson);
            if (doc.RootElement.TryGetProperty("tenantId", out var tenantEl))
            {
                var tenant = tenantEl.ValueKind == JsonValueKind.String
                    ? tenantEl.GetString()
                    : tenantEl.GetGuid().ToString();
                if (!string.IsNullOrWhiteSpace(tenant))
                    req.Headers.TryAddWithoutValidation("X-Tenant-ID", tenant);
            }
        }
        catch (JsonException)
        {
            // payload still posted; CCMS may reject
        }

        var resp = await _http.SendAsync(req, ct);
        if (!resp.IsSuccessStatusCode)
        {
            var body = await resp.Content.ReadAsStringAsync(ct);
            throw new InvalidOperationException(
                $"CCMS {eventType} returned {(int)resp.StatusCode}: {body}");
        }
    }

    public async Task<CcmsPatientShareLookupResult> GetAsync(
        Guid tenantId, Guid journeyId, CancellationToken ct = default)
    {
        if (journeyId == Guid.Empty || tenantId == Guid.Empty)
            return new(false, false, 0);

        try
        {
            using var req = new HttpRequestMessage(
                HttpMethod.Get,
                $"{_baseUrl}/ccms/integration/validate-admission?journeyId={journeyId}&tenantId={tenantId}");
            req.Headers.TryAddWithoutValidation("X-Internal-Key", _internalKey);
            req.Headers.TryAddWithoutValidation("X-Tenant-ID", tenantId.ToString());

            var resp = await _http.SendAsync(req, ct);
            if (!resp.IsSuccessStatusCode)
            {
                _log.LogWarning(
                    "CCMS patient-share lookup returned {Status} for journey {JourneyId}",
                    (int)resp.StatusCode, journeyId);
                return new(false, false, 0);
            }

            var body = await resp.Content.ReadFromJsonAsync<CcmsShareWire>(JsonRead, ct);
            var hasCase = body?.CaseId is { } caseId && caseId != Guid.Empty;
            return new(true, hasCase, Math.Max(0, body?.PatientShareAmount ?? 0));
        }
        catch (Exception ex)
        {
            _log.LogWarning(ex, "CCMS patient-share lookup failed for journey {JourneyId}", journeyId);
            return new(false, false, 0);
        }
    }

    private static readonly JsonSerializerOptions JsonRead = new()
    {
        PropertyNameCaseInsensitive = true,
    };

    private sealed class CcmsShareWire
    {
        public Guid? CaseId { get; set; }
        public decimal PatientShareAmount { get; set; }
    }
}
