using System.Net.Http.Json;
using Microsoft.Extensions.Logging;

namespace CcmsApi.Services;

/// <summary>
/// HTTP client for calling the auth-service (ASP.NET Core, port 5073).
/// Used for: notifying counselling completion, verifying tenant/user context.
/// </summary>
public class AuthServiceClient
{
    private readonly HttpClient _http;
    private readonly ILogger<AuthServiceClient> _log;

    public AuthServiceClient(HttpClient http, ILogger<AuthServiceClient> log)
    {
        _http = http;
        _log  = log;
    }

    /// <summary>
    /// Notifies the auth-service that CCMS has created a coverage case for a session.
    /// This is informational — auth-service may update its internal counselling workflow state.
    /// </summary>
    public async Task<bool> NotifyCcmsCaseCreatedAsync(
        string tenantId, Guid sessionId, Guid coverageCaseId, string caseNumber,
        CancellationToken ct = default)
    {
        try
        {
            var payload = new
            {
                sessionId     = sessionId.ToString(),
                coverageCaseId = coverageCaseId.ToString(),
                caseNumber,
                eventType     = "CCMS_CASE_CREATED"
            };

            var resp = await _http.PostAsJsonAsync(
                "/api/counselling/ccms-callback", payload, ct);

            if (!resp.IsSuccessStatusCode)
                _log.LogWarning("AuthService callback returned {Status} for session {SessionId}",
                    resp.StatusCode, sessionId);

            return resp.IsSuccessStatusCode;
        }
        catch (Exception ex)
        {
            _log.LogWarning(ex, "AuthService callback failed (fire-and-forget). Continuing.");
            return false;
        }
    }
}
