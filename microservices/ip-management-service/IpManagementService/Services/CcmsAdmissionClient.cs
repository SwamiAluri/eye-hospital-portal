using System.Net.Http.Json;
using System.Text;
using System.Text.Json;
using IpManagementService.Models.Domain;
using IpManagementService.Services.Uat;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;

namespace IpManagementService.Services;

/// <summary>
/// HTTP client to call CCMS service for admission validation and event callbacks.
/// Coverage-based payment modes fail closed when CCMS is unavailable.
/// Non-coverage modes never block admission on CCMS outage.
/// </summary>
public interface ICcmsAdmissionClient
{
    /// <summary>
    /// Validate admission against CCMS pre-auth state.
    /// When <paramref name="coverageBased"/> is true, CCMS unavailability blocks admission.
    /// When false, CCMS unavailability returns an informational allow (cash path).
    /// </summary>
    Task<CcmsAdmissionValidation> ValidateAdmissionAsync(
        Guid journeyId,
        Guid? sessionId,
        Guid tenantId,
        bool coverageBased,
        bool emergencyFcApplied = false);

    /// <summary>Best-effort: mirror Emergency FC onto the linked CCMS coverage case.</summary>
    Task NotifyEmergencyFcAppliedAsync(
        Guid journeyId, Guid? sessionId, Guid tenantId, Guid actorUserId, string reason);

    /// <summary>
    /// Deliver a transactional outbox lifecycle event to CCMS with idempotency key.
    /// Throws on failure so the outbox processor can retry.
    /// </summary>
    Task DeliverOutboxEventAsync(string eventType, string payloadJson, string idempotencyKey);

    /// <summary>Fire-and-forget: notify CCMS that surgery was completed.</summary>
    [Obsolete("Use IntegrationOutboxService for reliable delivery (Phase 2).")]
    Task NotifySurgeryCompletedAsync(Guid journeyId, Guid? sessionId, Guid tenantId, Guid actorUserId);

    /// <summary>Fire-and-forget: notify CCMS that patient was discharged.</summary>
    [Obsolete("Use IntegrationOutboxService for reliable delivery (Phase 2).")]
    Task NotifyPatientDischargedAsync(Guid journeyId, Guid? sessionId, Guid tenantId, Guid actorUserId);
}

/// <summary>
/// Canonical coverage admission projection consumed by IP admit gate and ward UI.
/// </summary>
    public record CcmsAdmissionValidation(
    bool   Allowed,
    string WarningLevel,    // "none" | "info" | "warning" | "block" | "blocked"
    string? WarningMessage,
    string? BlockReason,
    Guid?  CaseId,
    decimal? ApprovedAmount,
    string? PreAuthNumber,
    string Decision = "ALLOW",          // ALLOW | WARN | BLOCK
    string? CoverageState = null,
    bool   IsEmergencyFinancialClearance = false,
    bool   RequiresOverride = false,
    string? PaymentType = null,
    DateTime? LastUpdatedAt = null,
    bool   CcmsUnavailable = false,
    decimal? PayerShareAmount = null,
    decimal? PatientShareAmount = null,
    string? CoverageStatus = null,
    decimal? CollectedAmount = null,
    decimal? PatientObligationAmount = null)
{
    /// <summary>
    /// Canonical fail-closed / fail-open factory used when CCMS cannot be reached.
    /// Coverage-based modes BLOCK; cash/non-coverage ALLOW with info.
    /// </summary>
    public static CcmsAdmissionValidation ForCcmsUnavailable(bool coverageBased) =>
        coverageBased
            ? new CcmsAdmissionValidation(
                false, "blocked", null,
                "Coverage & Claims system unavailable. Cannot validate coverage authorization for this payment mode.",
                null, null, null, "BLOCK", null, false, true, null, null, CcmsUnavailable: true)
            : new CcmsAdmissionValidation(
                true, "info",
                "Coverage & Claims system unavailable. Non-coverage admission may proceed.",
                null, null, null, null, "ALLOW", null, false, false, null, null, CcmsUnavailable: true);
}

public class CcmsAdmissionClient : ICcmsAdmissionClient
{
    private readonly HttpClient _http;
    private readonly ILogger<CcmsAdmissionClient> _logger;
    private readonly string _internalKey;

    public CcmsAdmissionClient(
        HttpClient http,
        ILogger<CcmsAdmissionClient> logger,
        IConfiguration config)
    {
        _http   = http;
        _logger = logger;
        _internalKey = config["CcmsService:InternalApiKey"]
            ?? config["AuthService:InternalApiKey"]
            ?? config["AuthService__InternalApiKey"]
            ?? string.Empty;
        // Legacy global flag retained for observability only; fail-closed is now
        // contextual (coverage-based payment modes). Config still logged once.
        var legacyFailClosed = config.GetValue<bool>("CcmsService:FailClosedOnValidationError", false);
        if (legacyFailClosed)
            _logger.LogInformation(
                "CcmsService:FailClosedOnValidationError is set; Phase 1 uses payment-mode-aware fail-closed instead.");
    }

    public async Task<CcmsAdmissionValidation> ValidateAdmissionAsync(
        Guid journeyId,
        Guid? sessionId,
        Guid tenantId,
        bool coverageBased,
        bool emergencyFcApplied = false)
    {
        if (UatFailureFlags.IsOn("ccms_unavailable"))
            return UnavailableResult(coverageBased);

        try
        {
            var url = $"ccms/integration/validate-admission?journeyId={journeyId}&tenantId={tenantId}"
                + (sessionId.HasValue ? $"&sessionId={sessionId}" : "")
                + $"&emergencyFcApplied={emergencyFcApplied}";
            using var req = new HttpRequestMessage(HttpMethod.Get, url);
            ApplyInternalAuth(req, tenantId);
            var resp = await _http.SendAsync(req);
            if (!resp.IsSuccessStatusCode)
            {
                _logger.LogWarning("CCMS validate-admission returned {Status} for journey {JourneyId}", resp.StatusCode, journeyId);
                return UnavailableResult(coverageBased);
            }

            var jsonOpts = new JsonSerializerOptions { PropertyNameCaseInsensitive = true };
            var body = await resp.Content.ReadFromJsonAsync<CcmsValidationResponse>(jsonOpts);
            var warningLevel = NormalizeWarningLevel(body?.WarningLevel);
            return new CcmsAdmissionValidation(
                body?.Allowed ?? !coverageBased,
                warningLevel,
                body?.WarningMessage,
                body?.BlockReason,
                body?.CaseId,
                body?.ApprovedAmount,
                body?.PreAuthNumber,
                body?.Decision ?? (body?.Allowed == false ? "BLOCK" : "ALLOW"),
                body?.CoverageState,
                body?.IsEmergencyFinancialClearance ?? false,
                body?.RequiresEmergencyFcOverride ?? false,
                body?.PaymentType,
                body?.LastUpdatedAt,
                CcmsUnavailable: false,
                body?.PayerShareAmount,
                body?.PatientShareAmount,
                body?.CoverageStatus,
                body?.CollectedAmount,
                body?.PatientObligationAmount);
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "CCMS validate-admission call failed for journey {JourneyId} — {Mode}",
                journeyId, coverageBased ? "blocking admission (coverage fail-closed)" : "allowing admission (non-coverage)");
            return UnavailableResult(coverageBased);
        }
    }

    public async Task NotifyEmergencyFcAppliedAsync(
        Guid journeyId, Guid? sessionId, Guid tenantId, Guid actorUserId, string reason)
    {
        try
        {
            var payload = new { tenantId, journeyId, sessionId, actorUserId, reason };
            var json = JsonSerializer.Serialize(payload);
            using var req = new HttpRequestMessage(HttpMethod.Post, "ccms/integration/emergency-fc")
            {
                Content = new StringContent(json, Encoding.UTF8, "application/json"),
            };
            ApplyInternalAuth(req, tenantId);
            var resp = await _http.SendAsync(req);
            if (!resp.IsSuccessStatusCode)
                _logger.LogWarning("CCMS emergency-fc callback returned {Status} for journey {JourneyId}",
                    resp.StatusCode, journeyId);
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "CCMS emergency-fc callback failed for journey {JourneyId}", journeyId);
        }
    }

    public async Task DeliverOutboxEventAsync(string eventType, string payloadJson, string idempotencyKey)
    {
        // IP-012 / IP-011: OT board + analytics consume the outbox row. CCMS has no
        // route yet — ack so ProcessPending marks Processed instead of retrying to Dead.
        if (eventType is IntegrationEventTypes.JourneyReadyForOt
                       or IntegrationEventTypes.JourneyReadyReverted
                       or IntegrationEventTypes.ImplantUsed
                       or IntegrationEventTypes.ImplantUsageReversed
                       or IntegrationEventTypes.ConsumablesConsumed
                       or IntegrationEventTypes.ConsumablesReturned
                       or IntegrationEventTypes.JourneyScheduled
                       or IntegrationEventTypes.BedTransferred)
            return;

        // Wave 0 ops smoke: only probe keys fail when the UAT flag is on — never
        // poison real Pending / Failed deliveries that Hangfire may drain mid-run.
        if (UatFailureFlags.IsOn("ccms_outbox_fail")
            && idempotencyKey.StartsWith("w7-outbox-probe:", StringComparison.OrdinalIgnoreCase))
        {
            throw new InvalidOperationException(
                "CCMS ccms/integration/journey-admitted returned 500: forced UAT outbox failure");
        }

        var route = eventType switch
        {
            IntegrationEventTypes.JourneyAdmitted
                => "ccms/integration/journey-admitted",
            IntegrationEventTypes.SurgeryCompleted
                => "ccms/integration/surgery-completed",
            IntegrationEventTypes.PatientClinicallyDischarged
                => "ccms/integration/patient-discharged",
            IntegrationEventTypes.BillFinalized
                => "ccms/integration/bill-finalized",
            IntegrationEventTypes.EmergencyFcApplied
                => "ccms/integration/emergency-fc",
            IntegrationEventTypes.PatientObligationChanged
                => "ccms/integration/patient-obligation-changed",
            IntegrationEventTypes.PaymentReceived
                => "ccms/integration/payment-received",
            IntegrationEventTypes.PaymentReversed
                => "ccms/integration/payment-reversed",
            IntegrationEventTypes.ClaimStatusChanged
                => "ccms/integration/claim-status-changed",
            _ => throw new InvalidOperationException($"Unknown outbox event type: {eventType}"),
        };

        using var req = new HttpRequestMessage(HttpMethod.Post, route)
        {
            Content = new StringContent(payloadJson, Encoding.UTF8, "application/json"),
        };
        req.Headers.TryAddWithoutValidation("Idempotency-Key", idempotencyKey);
        req.Headers.TryAddWithoutValidation("X-Idempotency-Key", idempotencyKey);
        if (!string.IsNullOrWhiteSpace(_internalKey))
            req.Headers.TryAddWithoutValidation("X-Internal-Key", _internalKey);

        // CCMS ValidateInternalKey requires X-Tenant-ID alongside the internal key.
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
            // Payload may be pre-serialized without tenantId; delivery may still succeed via JWT path.
        }

        var resp = await _http.SendAsync(req);
        if (!resp.IsSuccessStatusCode)
        {
            var body = await resp.Content.ReadAsStringAsync();
            throw new InvalidOperationException(
                $"CCMS {route} returned {(int)resp.StatusCode}: {body}");
        }
    }

    public async Task NotifySurgeryCompletedAsync(Guid journeyId, Guid? sessionId, Guid tenantId, Guid actorUserId)
    {
        // Legacy fire-and-forget path retained for compatibility; prefer outbox.
        try
        {
            var payload = JsonSerializer.Serialize(new { tenantId, journeyId, sessionId, actorUserId });
            await DeliverOutboxEventAsync(
                IntegrationEventTypes.SurgeryCompleted,
                payload,
                $"legacy-surgery:{journeyId:N}");
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "CCMS surgery-completed callback failed for journey {JourneyId}", journeyId);
        }
    }

    public async Task NotifyPatientDischargedAsync(Guid journeyId, Guid? sessionId, Guid tenantId, Guid actorUserId)
    {
        try
        {
            var payload = JsonSerializer.Serialize(new { tenantId, journeyId, sessionId, actorUserId });
            await DeliverOutboxEventAsync(
                IntegrationEventTypes.PatientClinicallyDischarged,
                payload,
                $"legacy-discharge:{journeyId:N}");
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "CCMS patient-discharged callback failed for journey {JourneyId}", journeyId);
        }
    }

    private void ApplyInternalAuth(HttpRequestMessage req, Guid tenantId)
    {
        if (!string.IsNullOrWhiteSpace(_internalKey))
            req.Headers.TryAddWithoutValidation("X-Internal-Key", _internalKey);
        if (tenantId != Guid.Empty)
            req.Headers.TryAddWithoutValidation("X-Tenant-ID", tenantId.ToString());
    }

    private static CcmsAdmissionValidation UnavailableResult(bool coverageBased) =>
        CcmsAdmissionValidation.ForCcmsUnavailable(coverageBased);

    private static string NormalizeWarningLevel(string? level) =>
        level?.ToLowerInvariant() switch
        {
            "block" or "blocked" => "block",
            "warning" => "warning",
            "info" => "info",
            _ => "none",
        };

    // Response shape from CCMS validate-admission endpoint
    private class CcmsValidationResponse
    {
        public bool Allowed { get; set; }
        public string WarningLevel { get; set; } = "none";
        public string? WarningMessage { get; set; }
        public string? BlockReason { get; set; }
        public Guid? CaseId { get; set; }
        public decimal? ApprovedAmount { get; set; }
        public string? PreAuthNumber { get; set; }
        public string? Decision { get; set; }
        public string? CoverageState { get; set; }
        public bool IsEmergencyFinancialClearance { get; set; }
        public bool RequiresEmergencyFcOverride { get; set; }
        public string? PaymentType { get; set; }
        public DateTime? LastUpdatedAt { get; set; }
        public decimal? PayerShareAmount { get; set; }
        public decimal? PatientShareAmount { get; set; }
        public string? CoverageStatus { get; set; }
        public decimal? CollectedAmount { get; set; }
        public decimal? PatientObligationAmount { get; set; }
    }
}
