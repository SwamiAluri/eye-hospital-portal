using AuthService.Authorization;
using AuthService.DTOs.Queue;
using AuthService.Services;
using AuthService.Services.Interfaces;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace AuthService.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    [Authorize]
    public class QueueController : ControllerBase
    {
        private readonly IQueueService _queueService;
        private readonly IQueueDisplayService _queueDisplayService;
        private readonly IQueueNotificationService _notificationService;
        private readonly ILogger<QueueController> _logger;

        public QueueController(
            IQueueService queueService,
            IQueueDisplayService queueDisplayService,
            IQueueNotificationService notificationService,
            ILogger<QueueController> logger)
        {
            _queueService = queueService;
            _queueDisplayService = queueDisplayService;
            _notificationService = notificationService;
            _logger = logger;
        }

        /// <summary>
        /// Get all queues with stats for a branch
        /// </summary>
        [HttpGet("all")]
        public async Task<ActionResult<Dictionary<string, object>>> GetAllQueues([FromQuery] Guid branchId)
        {
            try
            {
                var result = await _queueService.GetAllQueuesAsync(branchId);
                return Ok(result);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error fetching all queues for branch {BranchId}", branchId);
                return StatusCode(500, "Error fetching queue data");
            }
        }

        /// <summary>
        /// Get queue display data for TV screens (single queue type — legacy)
        /// </summary>
        [HttpGet("display")]
        public async Task<ActionResult<QueueDisplayData>> GetQueueDisplay(
            [FromQuery] Guid? branchId,
            [FromQuery] Guid? departmentId,
            [FromQuery] string queueType)
        {
            try
            {
                var result = await _queueService.GetQueueDisplayDataAsync(branchId, departmentId, queueType);
                if (result == null)
                    return NotFound("No queue data available");

                return Ok(result);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error fetching queue display data");
                return StatusCode(500, "Error fetching queue display data");
            }
        }

        /// <summary>
        /// Branch / station / room queue display for kiosk TVs (carousel)
        /// </summary>
        [HttpGet("display/branch")]
        public async Task<ActionResult<QueueDisplayBranchPayloadDto>> GetBranchQueueDisplay(
            [FromQuery] Guid branchId,
            [FromQuery] string mode = "branch",
            [FromQuery] string? station = null,
            [FromQuery] string? roomCode = null,
            [FromQuery] int interval = 10)
        {
            try
            {
                var tenantIdClaim = User.FindFirst("TenantId")?.Value ?? User.FindFirst("tenant_id")?.Value;
                if (string.IsNullOrEmpty(tenantIdClaim) || !Guid.TryParse(tenantIdClaim, out var tenantId))
                {
                    return Unauthorized("Tenant not found");
                }

                var result = await _queueDisplayService.GetBranchDisplayAsync(
                    tenantId, branchId, mode, station, roomCode, interval);

                return Ok(result);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error fetching branch queue display for {BranchId}", branchId);
                return StatusCode(500, "Error fetching branch queue display");
            }
        }

        /// <summary>
        /// Call a patient from the queue
        /// </summary>
        [HttpPost("{id}/call")]
        public async Task<ActionResult> CallPatient(Guid id, [FromBody] CallPatientRequest request)
        {
            try
            {
                var result = await _queueService.CallPatientAsync(id, request.RoomNumber, request.DoctorName);
                if (result == null)
                    return NotFound("Queue item not found");

                // Get tenant and branch info from user claims
                var tenantIdClaim = User.FindFirst("TenantId")?.Value;
                if (!string.IsNullOrEmpty(tenantIdClaim) && Guid.TryParse(tenantIdClaim, out var tenantId))
                {
                    // Broadcast SignalR notification
                    await _notificationService.NotifyPatientCalled(
                        tenantId,
                        result.BranchId,
                        result.TokenNumber, // Use token number instead of patient name
                        result.QueueType
                    );

                    // Broadcast general queue update
                    await _notificationService.NotifyQueueUpdate(
                        tenantId,
                        result.BranchId,
                        result.DepartmentId,
                        result.QueueType,
                        new { Action = "PatientCalled", QueueItem = result }
                    );
                }

                return Ok(new { message = "Patient called successfully", queueItem = result });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error calling patient {QueueItemId}", id);
                return StatusCode(500, "Error calling patient");
            }
        }

        /// <summary>
        /// Mark patient as absent
        /// </summary>
        [HttpPost("{id}/mark-absent")]
        public async Task<ActionResult> MarkAbsent(Guid id)
        {
            try
            {
                var result = await _queueService.MarkAbsentAsync(id);
                if (!result)
                    return NotFound("Queue item not found");

                return Ok(new { message = "Patient marked as absent" });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error marking patient absent {QueueItemId}", id);
                return StatusCode(500, "Error marking patient absent");
            }
        }

        /// <summary>
        /// Transfer patient to another queue
        /// </summary>
        [HttpPost("{id}/transfer")]
        public async Task<ActionResult> TransferQueue(Guid id, [FromBody] TransferQueueRequest request)
        {
            try
            {
                var result = await _queueService.TransferQueueAsync(id, request.NewQueueType);
                if (result == null)
                    return NotFound("Queue item not found");

                return Ok(new { message = "Patient transferred successfully", queueItem = result });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error transferring patient {QueueItemId}", id);
                return StatusCode(500, "Error transferring patient");
            }
        }
    }

    public class CallPatientRequest
    {
        public string? RoomNumber { get; set; }
        public string? DoctorName { get; set; }
    }

    public class TransferQueueRequest
    {
        public string NewQueueType { get; set; } = string.Empty;
    }
}
