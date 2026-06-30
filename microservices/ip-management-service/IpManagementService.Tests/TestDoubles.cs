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
}
