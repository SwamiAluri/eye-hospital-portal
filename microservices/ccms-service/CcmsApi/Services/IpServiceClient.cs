using System.Net.Http.Json;
using System.Text.Json;
using Microsoft.Extensions.Logging;

namespace CcmsApi.Services;

/// <summary>
/// HTTP client for calling the IP management service (Azure Functions, port 5074).
/// Used for: notifying surgery completion, discharge events (fire-and-forget).
/// </summary>
public class IpServiceClient
{
    private readonly HttpClient _http;
    private readonly ILogger<IpServiceClient> _log;

    public IpServiceClient(HttpClient http, ILogger<IpServiceClient> log)
    {
        _http = http;
        _log  = log;
    }

    /// <summary>
    /// Notifies IP service that a CCMS coverage case was approved.
    /// IP service can update the admission record accordingly.
    /// </summary>
    public async Task<bool> NotifyCoverageApprovedAsync(
        Guid journeyId, Guid coverageCaseId, decimal approvedAmount,
        string? preAuthNumber, CancellationToken ct = default)
    {
        try
        {
            var payload = new
            {
                journeyId       = journeyId.ToString(),
                coverageCaseId  = coverageCaseId.ToString(),
                approvedAmount,
                preAuthNumber,
                eventType       = "COVERAGE_APPROVED"
            };

            var resp = await _http.PostAsync(
                "/api/ip/ccms-callback",
                JsonContent.Create(payload), ct);

            if (!resp.IsSuccessStatusCode)
                _log.LogWarning("IpService callback returned {Status} for journey {JourneyId}",
                    resp.StatusCode, journeyId);

            return resp.IsSuccessStatusCode;
        }
        catch (Exception ex)
        {
            _log.LogWarning(ex, "IpService callback failed (fire-and-forget). Continuing.");
            return false;
        }
    }

    /// <summary>
    /// Notifies IP service that settlement has been received.
    /// </summary>
    public async Task<bool> NotifySettlementReceivedAsync(
        Guid journeyId, Guid settlementId, decimal settledAmount,
        CancellationToken ct = default)
    {
        try
        {
            var payload = new
            {
                journeyId    = journeyId.ToString(),
                settlementId = settlementId.ToString(),
                settledAmount,
                eventType    = "SETTLEMENT_RECEIVED"
            };

            var resp = await _http.PostAsync(
                "/api/ip/ccms-callback",
                JsonContent.Create(payload), ct);

            return resp.IsSuccessStatusCode;
        }
        catch (Exception ex)
        {
            _log.LogWarning(ex, "IpService settlement callback failed (fire-and-forget). Continuing.");
            return false;
        }
    }
}
