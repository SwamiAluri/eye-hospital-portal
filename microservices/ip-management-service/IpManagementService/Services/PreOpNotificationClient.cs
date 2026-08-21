using System.Net.Http.Json;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;

namespace IpManagementService.Services;

/// <summary>
/// Sends cross-service notifications to the auth service's internal HTTP notification endpoint.
/// The auth service then pushes to connected clients via SignalR (/notificationHub).
///
/// Pattern: Fire-and-forget on errors (notifications must never block the main workflow).
/// </summary>
public interface IPreOpNotificationClient
{
    /// <summary>Push a notification to all users in a department (for section requests).</summary>
    Task NotifyDepartmentAsync(Guid tenantId, Guid? branchId, string departmentCode,
        string type, string message, string details);

    /// <summary>Push a notification to a specific user (for section responses).</summary>
    Task NotifyUserAsync(Guid tenantId, Guid userId,
        string type, string message, string details);

    /// <summary>
    /// Fire-and-forget: notifies the auth service to transition the linked OT finalize
    /// schedule record from OTPrepared → SurgeryDone.  Never throws — failures are
    /// logged as warnings so the clinical state transition is never blocked.
    /// </summary>
    Task MarkOtSurgeryDoneAsync(Guid otScheduleId, Guid tenantId, string actorUserId);

    /// <summary>
    /// Release OT list slot on cancel-today (OTPrepared → Confirmed). Non-fatal.
    /// </summary>
    Task ReleaseOtScheduleForRebookAsync(Guid otScheduleId, Guid tenantId, string actorUserId);

    /// <summary>Notify counselling that surgery was cancelled and needs rebook.</summary>
    Task NotifyCounsellingRebookAsync(
        Guid tenantId, Guid? branchId, Guid? counselingSessionId, string patientName, string reason);

    /// <summary>Notify IPD nursing when OT moves patient to post-op ward (G10).</summary>
    Task NotifyWardPostOpHandoffAsync(
        Guid tenantId, Guid? branchId, Guid journeyId, string patientName, string? procedureName);

    /// <summary>
    /// Lightweight real-time ping for the Ward Command Center: tells connected ward
    /// clients a journey changed lane so the board can refresh. Fire-and-forget.
    /// </summary>
    Task NotifyWardChangedAsync(Guid tenantId, Guid? branchId, Guid journeyId, string newState);

    /// <summary>Notify OT that a patient is marked ready for surgery (Admitted → ReadyForSurgery).</summary>
    Task NotifyPreOpMarkReadyAsync(
        Guid tenantId, Guid? branchId, Guid journeyId, string patientName, string? procedureName);

    /// <summary>Fan-out when ward clinical evaluation IOL/diagnosis materially changes.</summary>
    Task NotifyClinicalEvaluationMaterialChangeAsync(
        Guid tenantId,
        Guid? branchId,
        Guid journeyId,
        string patientName,
        string changeType,
        string details,
        bool inOt);
}

public class PreOpNotificationClient : IPreOpNotificationClient
{
    private readonly HttpClient _http;
    private readonly ILogger<PreOpNotificationClient> _logger;

    // Request records — match InternalNotificationController DTOs in auth service
    private record PushDeptRequest(
        Guid   TenantId,
        Guid?  BranchId,
        string DepartmentCode,
        string Type,
        string Message,
        string Details);

    private record PushUserRequest(
        Guid   TenantId,
        Guid   UserId,
        string Type,
        string Message,
        string Details);

    public PreOpNotificationClient(HttpClient http, ILogger<PreOpNotificationClient> logger)
    {
        _http   = http;
        _logger = logger;
    }

    public async Task NotifyDepartmentAsync(Guid tenantId, Guid? branchId, string departmentCode,
        string type, string message, string details)
    {
        try
        {
            var payload = new PushDeptRequest(tenantId, branchId, departmentCode, type, message, details);
            var resp    = await _http.PostAsJsonAsync("api/notifications/internal/push-dept", payload);
            if (!resp.IsSuccessStatusCode)
                _logger.LogWarning("Dept notification returned {Status} for dept={Dept}", resp.StatusCode, departmentCode);
        }
        catch (Exception ex)
        {
            // Notifications must never block the pre-op workflow
            _logger.LogError(ex, "Failed to send dept notification to {DeptCode}", departmentCode);
        }
    }

    public async Task NotifyUserAsync(Guid tenantId, Guid userId,
        string type, string message, string details)
    {
        try
        {
            var payload = new PushUserRequest(tenantId, userId, type, message, details);
            var resp    = await _http.PostAsJsonAsync("api/notifications/internal/push-user", payload);
            if (!resp.IsSuccessStatusCode)
                _logger.LogWarning("User notification returned {Status} for userId={UserId}", resp.StatusCode, userId);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to send user notification to {UserId}", userId);
        }
    }

    public async Task MarkOtSurgeryDoneAsync(Guid otScheduleId, Guid tenantId, string actorUserId)
    {
        try
        {
            var payload = new { OtScheduleId = otScheduleId, TenantId = tenantId, ActorUserId = actorUserId };
            var resp    = await _http.PostAsJsonAsync("api/internal/ot-sync/surgery-done", payload);
            if (!resp.IsSuccessStatusCode)
                _logger.LogWarning(
                    "MarkOtSurgeryDone returned {Status} for scheduleId={Id}",
                    resp.StatusCode, otScheduleId);
        }
        catch (Exception ex)
        {
            // Non-fatal — OT sync must never block the clinical state transition
            _logger.LogWarning(ex,
                "Failed to mark OT schedule {Id} as SurgeryDone.", otScheduleId);
        }
    }

    public async Task ReleaseOtScheduleForRebookAsync(
        Guid otScheduleId, Guid tenantId, string actorUserId)
    {
        try
        {
            var payload = new { OtScheduleId = otScheduleId, TenantId = tenantId, ActorUserId = actorUserId };
            var resp    = await _http.PostAsJsonAsync("api/internal/ot-sync/release-for-rebook", payload);
            if (!resp.IsSuccessStatusCode)
                _logger.LogWarning(
                    "ReleaseOtScheduleForRebook returned {Status} for scheduleId={Id}",
                    resp.StatusCode, otScheduleId);
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex,
                "Failed to release OT schedule {Id} for rebook.", otScheduleId);
        }
    }

    public async Task NotifyCounsellingRebookAsync(
        Guid tenantId, Guid? branchId, Guid? counselingSessionId, string patientName, string reason)
    {
        if (!counselingSessionId.HasValue) return;
        await NotifyDepartmentAsync(
            tenantId,
            branchId,
            "STD_COUNSELLING",
            "SurgeryCancelledRebook",
            $"Surgery cancelled — rebook required: {patientName}",
            $"Session {counselingSessionId}: {reason}");
    }

    public async Task NotifyWardPostOpHandoffAsync(
        Guid tenantId, Guid? branchId, Guid journeyId, string patientName, string? procedureName)
    {
        var details = $"JourneyId: {journeyId}";
        if (!string.IsNullOrWhiteSpace(procedureName))
            details += $"; Procedure: {procedureName}";

        await NotifyDepartmentAsync(
            tenantId,
            branchId,
            "IPD_NURSING",
            "PatientReceivedFromOt",
            $"Patient received from OT — post-op care: {patientName}",
            details);
    }

    public async Task NotifyWardChangedAsync(Guid tenantId, Guid? branchId, Guid journeyId, string newState)
    {
        // Reuses the proven push-dept broadcast → SignalR ReceiveNotification('WardJourneyChanged', …).
        // The ward board listens for this type and triggers a quiet refresh.
        await NotifyDepartmentAsync(
            tenantId,
            branchId,
            "IPD_NURSING",
            "WardJourneyChanged",
            "Ward board updated",
            $"{{\"journeyId\":\"{journeyId}\",\"state\":\"{newState}\"}}");
    }

    public async Task NotifyPreOpMarkReadyAsync(
        Guid tenantId, Guid? branchId, Guid journeyId, string patientName, string? procedureName)
    {
        var details = $"{{\"journeyId\":\"{journeyId}\"}}";
        var proc = string.IsNullOrWhiteSpace(procedureName) ? "" : $" — {procedureName}";

        await NotifyDepartmentAsync(
            tenantId,
            branchId,
            "OPERATION_THEATRE",
            "PreOpMarkReady",
            $"Ready for surgery: {patientName}{proc}",
            details);

        // Ward board also refreshes on this event (same journey filter as workspace realtime).
        await NotifyDepartmentAsync(
            tenantId,
            branchId,
            "IPD_NURSING",
            "PreOpMarkReady",
            $"Marked ready for surgery: {patientName}",
            details);
    }

    public async Task NotifyClinicalEvaluationMaterialChangeAsync(
        Guid tenantId,
        Guid? branchId,
        Guid journeyId,
        string patientName,
        string changeType,
        string details,
        bool inOt)
    {
        var prefix = inOt ? "In-OT clinical evaluation change" : "Clinical evaluation change";
        var message = $"{prefix}: {patientName} — {changeType.Replace('_', ' ')}";

        var depts = new[]
        {
            "COUNSELLING",
            "BILLING",
            "OPERATION_THEATRE",
            "INVENTORY",
        };

        foreach (var dept in depts)
        {
            await NotifyDepartmentAsync(
                tenantId,
                branchId,
                dept,
                "ClinicalEvaluationChanged",
                message,
                details);
        }
    }
}
