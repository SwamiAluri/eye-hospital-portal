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

    /// <summary>
    /// Push CCMS payer/patient split onto the Billing OpdBill (InsuranceClaimAmount projection).
    /// Does not write IP FinancialState. Best-effort — CCMS remains coverage SoT.
    /// </summary>
    public virtual async Task ApplyCoverageAllocationAsync(
        Guid? journeyId,
        decimal payerResponsibility,
        decimal patientResponsibility,
        Guid actorUserId,
        CancellationToken ct = default)
    {
        if (journeyId is null || journeyId == Guid.Empty) return;
        try
        {
            var payload = new
            {
                patientJourneyId = journeyId,
                payerResponsibility,
                patientResponsibility,
                actorUserId,
            };
            var resp = await _http.PostAsync(
                "/api/internal/ip-billing/apply-coverage-allocation",
                JsonContent.Create(payload), ct);
            if (!resp.IsSuccessStatusCode)
                _log.LogWarning(
                    "apply-coverage-allocation returned {Status} for journey {JourneyId}",
                    resp.StatusCode, journeyId);
        }
        catch (Exception ex)
        {
            _log.LogWarning(ex, "apply-coverage-allocation failed for journey {JourneyId}", journeyId);
        }
    }

    /// <summary>
    /// Notify Auth/IP that CCMS claim status changed. Does not mutate billing books.
    /// </summary>
    public virtual async Task NotifyClaimStatusChangedAsync(
        Guid tenantId,
        Guid? journeyId,
        Guid coverageCaseId,
        string claimStatus,
        Guid actorUserId,
        CancellationToken ct = default)
    {
        try
        {
            var payload = new
            {
                tenantId,
                patientJourneyId = journeyId,
                coverageCaseId,
                claimStatus,
                actorUserId,
            };
            var resp = await _http.PostAsync(
                "/api/internal/ip-billing/claim-status-changed",
                JsonContent.Create(payload), ct);
            if (!resp.IsSuccessStatusCode)
                _log.LogWarning(
                    "claim-status-changed returned {Status} for case {CaseId}",
                    resp.StatusCode, coverageCaseId);
        }
        catch (Exception ex)
        {
            _log.LogWarning(ex, "claim-status-changed notify failed for case {CaseId}", coverageCaseId);
        }
    }

    /// <summary>
    /// Slice 3B: register CCMS file-backed document into Auth canonical identity (no blob copy).
    /// Best-effort — CCMS remains authoritative if Auth is unavailable.
    /// </summary>
    public virtual async Task<Guid?> RegisterCcmsDocumentCanonicalAsync(
        Guid tenantId,
        Guid patientId,
        Guid userId,
        Guid ccmsDocumentId,
        string contentHash,
        long sizeBytes,
        string fileName,
        string mimeType,
        string classification,
        string storageContainer,
        string storageObjectKey,
        CancellationToken ct = default)
    {
        try
        {
            var payload = new
            {
                tenantId,
                patientId,
                userId,
                ccmsDocumentId,
                contentHash,
                sizeBytes,
                fileName,
                mimeType,
                classification,
                storageContainer,
                storageObjectKey,
                storageBackend = CcmsCanonicalDocumentRules.StorageBackend,
            };
            var resp = await _http.PostAsync(
                "/api/internal/canonical-documents/register-external",
                JsonContent.Create(payload),
                ct);
            if (!resp.IsSuccessStatusCode)
            {
                _log.LogWarning(
                    "canonical register-external returned {Status} for ccmsDocumentId={DocumentId}",
                    resp.StatusCode,
                    ccmsDocumentId);
                return null;
            }

            await using var stream = await resp.Content.ReadAsStreamAsync(ct);
            using var doc = await JsonDocument.ParseAsync(stream, cancellationToken: ct);
            if (doc.RootElement.TryGetProperty("canonicalDocumentId", out var idEl)
                && Guid.TryParse(idEl.GetString(), out var canonicalId))
            {
                return canonicalId;
            }

            _log.LogWarning(
                "canonical register-external response missing canonicalDocumentId for ccmsDocumentId={DocumentId}",
                ccmsDocumentId);
            return null;
        }
        catch (Exception ex)
        {
            _log.LogWarning(
                ex,
                "canonical register-external failed for ccmsDocumentId={DocumentId}",
                ccmsDocumentId);
            return null;
        }
    }

    /// <summary>
    /// Slice 3B: remove CCMS association only (association-aware; does not force-delete shared canonical).
    /// Best-effort.
    /// </summary>
    public virtual async Task RemoveCcmsDocumentAssociationAsync(
        Guid tenantId,
        Guid ccmsDocumentId,
        CancellationToken ct = default)
    {
        try
        {
            var payload = new { tenantId, ccmsDocumentId };
            var resp = await _http.PostAsync(
                "/api/internal/canonical-documents/remove-association",
                JsonContent.Create(payload),
                ct);
            if (!resp.IsSuccessStatusCode)
            {
                _log.LogWarning(
                    "canonical remove-association returned {Status} for ccmsDocumentId={DocumentId}",
                    resp.StatusCode,
                    ccmsDocumentId);
            }
        }
        catch (Exception ex)
        {
            _log.LogWarning(
                ex,
                "canonical remove-association failed for ccmsDocumentId={DocumentId}",
                ccmsDocumentId);
        }
    }

    /// <summary>
    /// Slice 3B: batch lookup of existing canonical associations (no hashing).
    /// </summary>
    public virtual async Task<IReadOnlyDictionary<Guid, Guid>> LookupCcmsCanonicalIdsAsync(
        IEnumerable<Guid> ccmsDocumentIds,
        CancellationToken ct = default)
    {
        var ids = ccmsDocumentIds.Where(id => id != Guid.Empty).Distinct().Take(200).ToArray();
        if (ids.Length == 0)
            return new Dictionary<Guid, Guid>();

        try
        {
            var payload = new
            {
                domain = "ccms",
                entityType = "CcmsDocument",
                entityIds = ids,
            };
            var resp = await _http.PostAsync(
                "/api/internal/canonical-documents/lookup-by-entities",
                JsonContent.Create(payload),
                ct);
            if (!resp.IsSuccessStatusCode)
            {
                _log.LogWarning("canonical lookup-by-entities returned {Status}", resp.StatusCode);
                return new Dictionary<Guid, Guid>();
            }

            await using var stream = await resp.Content.ReadAsStreamAsync(ct);
            using var doc = await JsonDocument.ParseAsync(stream, cancellationToken: ct);
            var map = new Dictionary<Guid, Guid>();
            if (!doc.RootElement.TryGetProperty("items", out var items) || items.ValueKind != JsonValueKind.Array)
                return map;

            foreach (var item in items.EnumerateArray())
            {
                if (item.TryGetProperty("entityId", out var entityEl)
                    && item.TryGetProperty("canonicalDocumentId", out var canonEl)
                    && Guid.TryParse(entityEl.GetString(), out var entityId)
                    && Guid.TryParse(canonEl.GetString(), out var canonicalId))
                {
                    map[entityId] = canonicalId;
                }
            }

            return map;
        }
        catch (Exception ex)
        {
            _log.LogWarning(ex, "canonical lookup-by-entities failed");
            return new Dictionary<Guid, Guid>();
        }
    }
}

