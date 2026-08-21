using System.Net.Http.Json;

using System.Text.Json;

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

    /// Fire-and-forget: syncs the primary CCMS visit policy back to auth-service patient_insurance.

    /// Kept optional/async so CCMS workflow is never blocked by auth-service availability.

    /// </summary>

    public async Task SyncPatientInsuranceAsync(

        Guid   patientId,

        string policyNumber,

        string providerName,

        string? insuredName,

        string? relationship,

        string? contactPhone,

        DateTime? startDate,

        DateTime? endDate,

        CancellationToken ct = default)

    {

        try

        {

            var payload = new

            {

                patientId      = patientId.ToString(),

                policyNumber,

                providerName,

                insuredName,

                relationship,

                contactPhone,

                startDate      = startDate?.ToString("o"),

                endDate        = endDate?.ToString("o"),

            };



            var resp = await _http.PostAsync(

                "/api/insurance/ccms/patient-insurance-sync",

                JsonContent.Create(payload), ct);



            if (!resp.IsSuccessStatusCode)

                _log.LogWarning(

                    "patient-insurance-sync returned {Status} for patient {PatientId}",

                    resp.StatusCode, patientId);

        }

        catch (Exception ex)

        {

            // Non-blocking — CCMS is the SoR; patient_insurance is a convenience copy

            _log.LogWarning(ex, "patient-insurance-sync fire-and-forget failed for patient {PatientId}", patientId);

        }

    }



    /// <summary>

    /// Notifies auth-service that CCMS linked or updated a coverage case for a counselling session.

    /// Auth-service merges ccmsCoverageCaseId / ccmsCaseNumber into PackageAddonsJson.

    /// </summary>

    public async Task NotifyCcmsSessionAsync(

        Guid tenantId,

        Guid sessionId,

        Guid coverageCaseId,

        string caseNumber,

        string eventType,

        string? currentState = null,

        CancellationToken ct = default)

    {

        try

        {

            var payload = new

            {

                tenantId       = tenantId.ToString(),

                sessionId      = sessionId.ToString(),

                coverageCaseId = coverageCaseId.ToString(),

                caseNumber,

                eventType,

                currentState,

            };



            var resp = await _http.PostAsync(

                "/api/internal/ccms-callback",

                JsonContent.Create(payload), ct);



            if (!resp.IsSuccessStatusCode)

                _log.LogWarning(

                    "AuthService ccms-callback returned {Status} for session {SessionId} event {Event}",

                    resp.StatusCode, sessionId, eventType);

        }

        catch (Exception ex)

        {

            _log.LogWarning(ex, "AuthService ccms-callback failed (fire-and-forget) for session {SessionId}.", sessionId);
        }
    }

    /// <summary>
    /// Push a department SignalR notification via auth-service internal API (Phase 2 clarifications).
    /// Never throws — notifications must not block CCMS workflow.
    /// </summary>
    public virtual async Task NotifyDepartmentAsync(
        Guid tenantId,
        Guid? branchId,
        string departmentCode,
        string type,
        string message,
        string details,
        CancellationToken ct = default)
    {
        try
        {
            var payload = new
            {
                tenantId,
                branchId,
                departmentCode,
                type,
                message,
                details,
            };
            var resp = await _http.PostAsync(
                "/api/notifications/internal/push-dept",
                JsonContent.Create(payload), ct);
            if (!resp.IsSuccessStatusCode)
                _log.LogWarning(
                    "AuthService push-dept returned {Status} for dept {Dept} type {Type}",
                    resp.StatusCode, departmentCode, type);
        }
        catch (Exception ex)
        {
            _log.LogWarning(ex, "AuthService push-dept failed for dept {Dept}", departmentCode);
        }
    }
}

