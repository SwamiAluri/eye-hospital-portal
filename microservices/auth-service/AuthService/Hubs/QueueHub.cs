using Microsoft.AspNetCore.SignalR;
using System.Security.Claims;

namespace AuthService.Hubs
{
    /// <summary>
    /// SignalR Hub for real-time queue updates
    /// Supports tenant isolation and department/queue-type specific subscriptions
    /// </summary>
    public class QueueHub : Hub
    {
        private readonly ILogger<QueueHub> _logger;

        public QueueHub(ILogger<QueueHub> logger)
        {
            _logger = logger;
        }

        /// <summary>
        /// Join tenant-wide queue updates (for counselor workspace)
        /// </summary>
        public async Task JoinTenantQueue(string tenantId)
        {
            try
            {
                var groupName = $"queue_{tenantId}";
                await Groups.AddToGroupAsync(Context.ConnectionId, groupName);

                _logger.LogInformation(
                    "User {UserId} joined tenant queue {TenantId}",
                    Context.User?.FindFirstValue(ClaimTypes.NameIdentifier),
                    tenantId
                );

                await Clients.Caller.SendAsync("QueueJoined", new
                {
                    TenantId = tenantId,
                    Message = "Successfully joined queue updates"
                });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error joining tenant queue");
                await Clients.Caller.SendAsync("Error", new { Message = "Failed to join queue updates" });
            }
        }

        /// <summary>
        /// Leave tenant-wide queue updates
        /// </summary>
        public async Task LeaveTenantQueue(string tenantId)
        {
            try
            {
                var groupName = $"queue_{tenantId}";
                await Groups.RemoveFromGroupAsync(Context.ConnectionId, groupName);

                _logger.LogInformation(
                    "User {UserId} left tenant queue {TenantId}",
                    Context.User?.FindFirstValue(ClaimTypes.NameIdentifier),
                    tenantId
                );
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error leaving tenant queue");
            }
        }

        /// <summary>
        /// Subscribe to queue updates for a specific branch, department, and queue type
        /// </summary>
        public async Task SubscribeToQueue(Guid branchId, Guid? departmentId, string queueType)
        {
            try
            {
                // Try both claim name formats (JWT sometimes uses lowercase with underscore)
                var tenantId = Context.User?.FindFirstValue("TenantId") 
                            ?? Context.User?.FindFirstValue("tenant_id");
                
                if (string.IsNullOrEmpty(tenantId))
                {
                    _logger.LogWarning("User attempted to subscribe without TenantId. Claims: {Claims}", 
                        string.Join(", ", Context.User?.Claims.Select(c => $"{c.Type}={c.Value}") ?? Array.Empty<string>()));
                    return;
                }

                // Create group name with tenant isolation
                var groupName = $"Queue-{tenantId}-{branchId}-{departmentId}-{queueType}";
                await Groups.AddToGroupAsync(Context.ConnectionId, groupName);

                _logger.LogInformation(
                    "User {UserId} subscribed to queue {GroupName}",
                    Context.User?.FindFirstValue(ClaimTypes.NameIdentifier),
                    groupName
                );

                // Send confirmation
                await Clients.Caller.SendAsync("SubscriptionConfirmed", new
                {
                    BranchId = branchId,
                    DepartmentId = departmentId,
                    QueueType = queueType,
                    Message = "Successfully subscribed to queue updates"
                });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error subscribing to queue");
                await Clients.Caller.SendAsync("Error", new { Message = "Failed to subscribe to queue" });
            }
        }

        /// <summary>
        /// Unsubscribe from queue updates
        /// </summary>
        public async Task UnsubscribeFromQueue(Guid branchId, Guid? departmentId, string queueType)
        {
            try
            {
                var tenantId = Context.User?.FindFirstValue("TenantId") 
                            ?? Context.User?.FindFirstValue("tenant_id");
                if (string.IsNullOrEmpty(tenantId))
                    return;

                var groupName = $"Queue-{tenantId}-{branchId}-{departmentId}-{queueType}";
                await Groups.RemoveFromGroupAsync(Context.ConnectionId, groupName);

                _logger.LogInformation(
                    "User {UserId} unsubscribed from queue {GroupName}",
                    Context.User?.FindFirstValue(ClaimTypes.NameIdentifier),
                    groupName
                );

                await Clients.Caller.SendAsync("UnsubscriptionConfirmed", new
                {
                    BranchId = branchId,
                    DepartmentId = departmentId,
                    QueueType = queueType
                });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error unsubscribing from queue");
            }
        }

        /// <summary>
        /// Subscribe to all queues for a branch (admin/reception use)
        /// </summary>
        public async Task SubscribeToBranch(Guid branchId)
        {
            try
            {
                var tenantId = Context.User?.FindFirstValue("TenantId")
                            ?? Context.User?.FindFirstValue("tenant_id");
                if (string.IsNullOrEmpty(tenantId))
                    return;

                var groupName = $"Branch-{tenantId}-{branchId}";
                await Groups.AddToGroupAsync(Context.ConnectionId, groupName);

                _logger.LogInformation(
                    "User {UserId} subscribed to branch {BranchId}",
                    Context.User?.FindFirstValue(ClaimTypes.NameIdentifier),
                    branchId
                );

                await Clients.Caller.SendAsync("BranchSubscriptionConfirmed", new { BranchId = branchId });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error subscribing to branch");
            }
        }

        public override async Task OnConnectedAsync()
        {
            var userId = Context.User?.FindFirstValue(ClaimTypes.NameIdentifier);
            var tenantId = Context.User?.FindFirstValue("TenantId") 
                        ?? Context.User?.FindFirstValue("tenant_id");

            _logger.LogInformation(
                "Client connected: ConnectionId={ConnectionId}, UserId={UserId}, TenantId={TenantId}",
                Context.ConnectionId,
                userId,
                tenantId
            );

            await base.OnConnectedAsync();
        }

        public override async Task OnDisconnectedAsync(Exception? exception)
        {
            var userId = Context.User?.FindFirstValue(ClaimTypes.NameIdentifier);

            _logger.LogInformation(
                "Client disconnected: ConnectionId={ConnectionId}, UserId={UserId}, Exception={Exception}",
                Context.ConnectionId,
                userId,
                exception?.Message
            );

            await base.OnDisconnectedAsync(exception);
        }
    }
}
