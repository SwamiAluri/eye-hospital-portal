using AuthService.Hubs;
using AuthService.Services.Interfaces;
using Microsoft.AspNetCore.SignalR;

namespace AuthService.Services;

public class QueueDisplayNotifier : IQueueDisplayNotifier
{
    private readonly IHubContext<QueueHub> _hubContext;
    private readonly ILogger<QueueDisplayNotifier> _logger;

    public QueueDisplayNotifier(IHubContext<QueueHub> hubContext, ILogger<QueueDisplayNotifier> logger)
    {
        _hubContext = hubContext;
        _logger = logger;
    }

    public async Task NotifyBranchDisplayUpdatedAsync(Guid tenantId, Guid branchId)
    {
        try
        {
            var branchGroup = $"Branch-{tenantId}-{branchId}";
            await _hubContext.Clients.Group(branchGroup).SendAsync("QueueDisplayUpdated", new
            {
                BranchId = branchId,
                Timestamp = DateTime.UtcNow,
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to emit QueueDisplayUpdated for branch {BranchId}", branchId);
        }
    }
}
