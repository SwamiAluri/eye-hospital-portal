using AuthService.DTOs.Queue;

namespace AuthService.Services.Interfaces;

public interface IQueueDisplayService
{
    Task<QueueDisplayBranchPayloadDto> GetBranchDisplayAsync(
        Guid tenantId,
        Guid branchId,
        string mode = "branch",
        string? station = null,
        string? roomCode = null,
        int rotationSeconds = 10);
}
