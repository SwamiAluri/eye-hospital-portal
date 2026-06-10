namespace AuthService.Services.Interfaces;

public interface IQueueDisplayNotifier
{
    Task NotifyBranchDisplayUpdatedAsync(Guid tenantId, Guid branchId);
}
