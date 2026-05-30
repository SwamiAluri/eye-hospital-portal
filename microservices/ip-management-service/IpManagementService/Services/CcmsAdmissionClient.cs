using System.Net.Http.Json;
using System.Text;
using System.Text.Json;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;

namespace IpManagementService.Services;

/// <summary>
/// HTTP client to call CCMS service for admission validation and event callbacks.
/// Pattern: Never throw — warnings are logged so the clinical workflow is never blocked.
/// </summary>
public interface ICcmsAdmissionClient
{
    /// <summary>
    /// Validate admission against CCMS pre-auth state.
    /// Returns true (allowed) with no message if CCMS is unreachable (fail-open for availability).
    /// </summary>
    Task<CcmsAdmissionValidation> ValidateAdmissionAsync(Guid journeyId, Guid? sessionId, Guid tenantId);

    /// <summary>Fire-and-forget: notify CCMS that surgery was completed.</summary>
    Task NotifySurgeryCompletedAsync(Guid journeyId, Guid? sessionId, Guid tenantId, Guid actorUserId);

    /// <summary>Fire-and-forget: notify CCMS that patient was discharged.</summary>
    Task NotifyPatientDischargedAsync(Guid journeyId, Guid? sessionId, Guid tenantId, Guid actorUserId);
}

public record CcmsAdmissionValidation(
    bool   Allowed,
    string WarningLevel,    // "none" | "info" | "warning" | "block"
    string? WarningMessage,
    string? BlockReason,
    Guid?  CaseId,
    decimal? ApprovedAmount,
    string? PreAuthNumber);

public class CcmsAdmissionClient : ICcmsAdmissionClient
{
    private readonly HttpClient _http;
    private readonly ILogger<CcmsAdmissionClient> _logger;
    private readonly bool _failClosed;

    public CcmsAdmissionClient(
        HttpClient http,
        ILogger<CcmsAdmissionClient> logger,
        IConfiguration config)
    {
        _http      = http;
        _logger    = logger;
        // Set CcmsService:FailClosedOnValidationError=true in production for insurance cases.
        // Defaults to false (fail-open) to preserve backward compatibility.
        _failClosed = config.GetValue<bool>("CcmsService:FailClosedOnValidationError", false);
    }

    public async Task<CcmsAdmissionValidation> ValidateAdmissionAsync(Guid journeyId, Guid? sessionId, Guid tenantId)
    {
        try
        {
            var url = $"ccms/integration/validate-admission?journeyId={journeyId}&tenantId={tenantId}"
                + (sessionId.HasValue ? $"&sessionId={sessionId}" : "");
            var resp = await _http.GetAsync(url);
            if (!resp.IsSuccessStatusCode)
            {
                _logger.LogWarning("CCMS validate-admission returned {Status} for journey {JourneyId}", resp.StatusCode, journeyId);
                return _failClosed
                    ? new CcmsAdmissionValidation(false, "blocked", null, "Coverage & Claims system unavailable. Cannot validate pre-auth.", null, null, null)
                    : new CcmsAdmissionValidation(true, "warning", "Coverage & Claims system unavailable. Proceeding with caution.", null, null, null, null);
            }

            var body = await resp.Content.ReadFromJsonAsync<CcmsValidationResponse>();
            return new CcmsAdmissionValidation(
                body?.Allowed ?? true,
                body?.WarningLevel ?? "none",
                body?.WarningMessage,
                body?.BlockReason,
                body?.CaseId,
                body?.ApprovedAmount,
                body?.PreAuthNumber);
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "CCMS validate-admission call failed for journey {JourneyId} — {Mode}",
                journeyId, _failClosed ? "blocking admission (fail-closed)" : "allowing admission (fail-open)");
            return _failClosed
                ? new CcmsAdmissionValidation(false, "blocked", null, "Coverage & Claims system unreachable. Cannot validate pre-auth.", null, null, null)
                : new CcmsAdmissionValidation(true, "warning", "Coverage & Claims system unreachable. Proceeding with caution.", null, null, null, null);
        }
    }

    public async Task NotifySurgeryCompletedAsync(Guid journeyId, Guid? sessionId, Guid tenantId, Guid actorUserId)
    {
        _ = Task.Run(async () =>
        {
            try
            {
                var payload = new { tenantId, journeyId, sessionId, actorUserId };
                var json = JsonSerializer.Serialize(payload);
                await _http.PostAsync("ccms/integration/surgery-completed",
                    new StringContent(json, Encoding.UTF8, "application/json"));
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "CCMS surgery-completed callback failed for journey {JourneyId}", journeyId);
            }
        });
        await Task.CompletedTask;
    }

    public async Task NotifyPatientDischargedAsync(Guid journeyId, Guid? sessionId, Guid tenantId, Guid actorUserId)
    {
        _ = Task.Run(async () =>
        {
            try
            {
                var payload = new { tenantId, journeyId, sessionId, actorUserId };
                var json = JsonSerializer.Serialize(payload);
                await _http.PostAsync("ccms/integration/patient-discharged",
                    new StringContent(json, Encoding.UTF8, "application/json"));
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "CCMS patient-discharged callback failed for journey {JourneyId}", journeyId);
            }
        });
        await Task.CompletedTask;
    }

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
    }
}
