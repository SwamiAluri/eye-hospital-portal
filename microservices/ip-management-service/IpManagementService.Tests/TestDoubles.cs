using IpManagementService.Services;

namespace IpManagementService.Tests;

internal sealed class NoOpAzureBlobStorageService : IAzureBlobStorageService
{
    public Task<(string FileUrl, long FileSizeBytes)> UploadAsync(
        Stream content, string fileName, string contentType)
        => Task.FromResult(($"inmemory://{fileName}", content.Length));

    public Task DeleteAsync(string fileUrl) => Task.CompletedTask;
}

internal sealed class NoOpPreOpNotificationClient : IPreOpNotificationClient
{
    public Task NotifyDepartmentAsync(
        Guid tenantId,
        Guid? branchId,
        string departmentCode,
        string type,
        string message,
        string details)
        => Task.CompletedTask;

    public Task NotifyUserAsync(
        Guid tenantId,
        Guid userId,
        string type,
        string message,
        string details)
        => Task.CompletedTask;

    public Task MarkOtSurgeryDoneAsync(Guid otScheduleId, Guid tenantId, string actorUserId)
        => Task.CompletedTask;

    public Task ReleaseOtScheduleForRebookAsync(Guid otScheduleId, Guid tenantId, string actorUserId)
        => Task.CompletedTask;

    public Task NotifyCounsellingRebookAsync(
        Guid tenantId, Guid? branchId, Guid? counselingSessionId, string patientName, string reason)
        => Task.CompletedTask;

    public Task NotifyWardPostOpHandoffAsync(
        Guid tenantId, Guid? branchId, Guid journeyId, string patientName, string? procedureName)
        => Task.CompletedTask;

    public Task NotifyWardChangedAsync(Guid tenantId, Guid? branchId, Guid journeyId, string newState)
        => Task.CompletedTask;

    public Task NotifyPreOpMarkReadyAsync(
        Guid tenantId, Guid? branchId, Guid journeyId, string patientName, string? procedureName)
        => Task.CompletedTask;

    public Task NotifyClinicalEvaluationMaterialChangeAsync(
        Guid tenantId,
        Guid? branchId,
        Guid journeyId,
        string patientName,
        string changeType,
        string details,
        bool inOt)
        => Task.CompletedTask;
}

/// <summary>Phase 1 test double — always allows (non-coverage / happy-path fixtures).</summary>
internal sealed class NoOpCcmsAdmissionClient : ICcmsAdmissionClient
{
    public Task<CcmsAdmissionValidation> ValidateAdmissionAsync(
        Guid journeyId, Guid? sessionId, Guid tenantId, bool coverageBased, bool emergencyFcApplied = false)
        => Task.FromResult(new CcmsAdmissionValidation(
            true, "none", null, null, null, null, null));

    public Task NotifyEmergencyFcAppliedAsync(
        Guid journeyId, Guid? sessionId, Guid tenantId, Guid actorUserId, string reason)
        => Task.CompletedTask;

    public Task DeliverOutboxEventAsync(string eventType, string payloadJson, string idempotencyKey)
        => Task.CompletedTask;

    public Task NotifySurgeryCompletedAsync(Guid journeyId, Guid? sessionId, Guid tenantId, Guid actorUserId)
        => Task.CompletedTask;

    public Task NotifyPatientDischargedAsync(Guid journeyId, Guid? sessionId, Guid tenantId, Guid actorUserId)
        => Task.CompletedTask;
}
