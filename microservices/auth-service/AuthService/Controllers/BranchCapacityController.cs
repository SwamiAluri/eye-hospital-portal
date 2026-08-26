using AuthService.Models.Branch;
using AuthService.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using System;
using System.Collections.Generic;
using System.Security.Claims;
using System.Threading.Tasks;

namespace AuthService.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    [Authorize]
    public class BranchCapacityController : ControllerBase
    {
        private readonly IBranchCapacityService _capacityService;

        public BranchCapacityController(IBranchCapacityService capacityService)
        {
            _capacityService = capacityService;
        }

        private Guid GetTenantId()
        {
            var tenantIdClaim = User.FindFirst("TenantId")?.Value;
            if (string.IsNullOrEmpty(tenantIdClaim) || !Guid.TryParse(tenantIdClaim, out var tenantId))
            {
                throw new UnauthorizedAccessException("Invalid or missing tenant ID");
            }
            return tenantId;
        }

        private Guid GetCurrentUserId()
        {
            var userIdClaim = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            if (string.IsNullOrEmpty(userIdClaim) || !Guid.TryParse(userIdClaim, out var userId))
            {
                throw new UnauthorizedAccessException("Invalid or missing user ID");
            }
            return userId;
        }

        #region Capacity Summary

        /// <summary>
        /// Get real-time capacity summary for a specific branch
        /// </summary>
        [HttpGet("branch/{branchId}/summary")]
        public async Task<ActionResult<BranchCapacitySummaryDto>> GetCapacitySummary(Guid branchId)
        {
            try
            {
                var tenantId = GetTenantId();
                var summary = await _capacityService.GetCapacitySummaryAsync(branchId, tenantId);
                return Ok(summary);
            }
            catch (KeyNotFoundException ex)
            {
                return NotFound(new { message = ex.Message });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { message = "Internal server error", error = ex.Message });
            }
        }

        /// <summary>
        /// Get capacity summary for all branches in the tenant
        /// </summary>
        [HttpGet("summary/all")]
        public async Task<ActionResult<List<BranchCapacitySummaryDto>>> GetAllBranchesCapacitySummary()
        {
            try
            {
                var tenantId = GetTenantId();
                var summaries = await _capacityService.GetAllBranchesCapacitySummaryAsync(tenantId);
                return Ok(summaries);
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { message = "Internal server error", error = ex.Message });
            }
        }

        /// <summary>
        /// Calculate capacity alert level for a branch
        /// </summary>
        [HttpGet("branch/{branchId}/alert-level")]
        public async Task<ActionResult<string>> GetCapacityAlertLevel(Guid branchId)
        {
            try
            {
                var tenantId = GetTenantId();
                var alertLevel = await _capacityService.CalculateCapacityAlertLevelAsync(branchId, tenantId);
                return Ok(new { branchId, alertLevel });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { message = "Internal server error", error = ex.Message });
            }
        }

        #endregion

        #region Bed Inventory

        /// <summary>
        /// Get bed inventory for a branch with optional filtering
        /// </summary>
        [HttpGet("branch/{branchId}/beds")]
        public async Task<ActionResult<List<BedInventoryDto>>> GetBedInventory(
            Guid branchId,
            [FromQuery] string? bedType = null,
            [FromQuery] string? bedStatus = null,
            [FromQuery] Guid? wardId = null,
            [FromQuery] string? wardName = null)
        {
            try
            {
                var tenantId = GetTenantId();
                var beds = await _capacityService.GetBedInventoryAsync(
                    branchId, tenantId, bedType, bedStatus, wardId, wardName);
                return Ok(beds);
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { message = "Internal server error", error = ex.Message });
            }
        }

        /// <summary>
        /// Get available beds for a branch
        /// </summary>
        [HttpGet("branch/{branchId}/beds/available")]
        public async Task<ActionResult<List<BedInventoryDto>>> GetAvailableBeds(
            Guid branchId,
            [FromQuery] string? bedType = null,
            [FromQuery] Guid? wardId = null,
            [FromQuery] string? wardName = null)
        {
            try
            {
                var tenantId = GetTenantId();
                var beds = await _capacityService.GetAvailableBedsAsync(branchId, tenantId, bedType, wardId, wardName);
                return Ok(beds);
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { message = "Internal server error", error = ex.Message });
            }
        }

        /// <summary>
        /// Update bed status (assign patient, mark available, etc.)
        /// </summary>
        [HttpPut("bed/{bedId}/status")]
        public async Task<ActionResult<BedInventory>> UpdateBedStatus(
            Guid bedId,
            [FromBody] UpdateBedStatusDto request)
        {
            try
            {
                var tenantId = GetTenantId();
                var userId = GetCurrentUserId();
                
                var bed = await _capacityService.UpdateBedStatusAsync(
                    bedId,
                    request.BedStatus,
                    request.PatientId,
                    request.ExpectedDischargeAt,
                    tenantId,
                    userId);
                
                return Ok(bed);
            }
            catch (KeyNotFoundException ex)
            {
                return NotFound(new { message = ex.Message });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { message = "Internal server error", error = ex.Message });
            }
        }

        /// <summary>
        /// Create a new bed in the inventory
        /// </summary>
        [HttpPost("branch/{branchId}/beds")]
        public async Task<ActionResult<BedInventory>> CreateBed(Guid branchId, [FromBody] BedInventory bed)
        {
            try
            {
                var tenantId = GetTenantId();
                var userId = GetCurrentUserId();
                
                bed.BranchId = branchId;
                bed.TenantId = tenantId;
                
                var createdBed = await _capacityService.CreateBedAsync(bed, userId);
                return CreatedAtAction(nameof(GetBedInventory), new { branchId }, createdBed);
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { message = "Internal server error", error = ex.Message });
            }
        }

        #endregion

        #region Transfer Requests

        /// <summary>
        /// Create a patient transfer request between branches
        /// </summary>
        [HttpPost("transfer-requests")]
        public async Task<ActionResult<PatientTransferRequest>> CreateTransferRequest(
            [FromBody] CreateTransferRequestDto request)
        {
            try
            {
                var tenantId = GetTenantId();
                var userId = GetCurrentUserId();
                
                var transferRequest = await _capacityService.CreateTransferRequestAsync(request, tenantId, userId);
                return CreatedAtAction(nameof(GetPendingTransferRequests), transferRequest);
            }
            catch (KeyNotFoundException ex)
            {
                return NotFound(new { message = ex.Message });
            }
            catch (InvalidOperationException ex)
            {
                return BadRequest(new { message = ex.Message });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { message = "Internal server error", error = ex.Message });
            }
        }

        /// <summary>
        /// Get pending transfer requests
        /// </summary>
        [HttpGet("transfer-requests/pending")]
        public async Task<ActionResult<List<PatientTransferRequest>>> GetPendingTransferRequests(
            [FromQuery] Guid? branchId = null)
        {
            try
            {
                var tenantId = GetTenantId();
                var requests = await _capacityService.GetPendingTransferRequestsAsync(tenantId, branchId);
                return Ok(requests);
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { message = "Internal server error", error = ex.Message });
            }
        }

        /// <summary>
        /// Approve a transfer request
        /// </summary>
        [HttpPost("transfer-requests/{requestId}/approve")]
        public async Task<ActionResult<PatientTransferRequest>> ApproveTransferRequest(
            Guid requestId,
            [FromBody] ApproveTransferRequestDto request)
        {
            try
            {
                var tenantId = GetTenantId();
                var userId = GetCurrentUserId();
                
                var approvedRequest = await _capacityService.ApproveTransferRequestAsync(
                    requestId,
                    userId,
                    request.AssignedBedId,
                    tenantId);
                
                return Ok(approvedRequest);
            }
            catch (KeyNotFoundException ex)
            {
                return NotFound(new { message = ex.Message });
            }
            catch (InvalidOperationException ex)
            {
                return BadRequest(new { message = ex.Message });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { message = "Internal server error", error = ex.Message });
            }
        }

        /// <summary>
        /// Reject a transfer request
        /// </summary>
        [HttpPost("transfer-requests/{requestId}/reject")]
        public async Task<ActionResult<PatientTransferRequest>> RejectTransferRequest(
            Guid requestId,
            [FromBody] RejectTransferRequestDto request)
        {
            try
            {
                var tenantId = GetTenantId();
                var userId = GetCurrentUserId();
                
                var rejectedRequest = await _capacityService.RejectTransferRequestAsync(
                    requestId,
                    request.RejectedReason,
                    userId,
                    tenantId);
                
                return Ok(rejectedRequest);
            }
            catch (KeyNotFoundException ex)
            {
                return NotFound(new { message = ex.Message });
            }
            catch (InvalidOperationException ex)
            {
                return BadRequest(new { message = ex.Message });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { message = "Internal server error", error = ex.Message });
            }
        }

        /// <summary>
        /// Complete a transfer request (move patient and update bed statuses)
        /// </summary>
        [HttpPost("transfer-requests/{requestId}/complete")]
        public async Task<ActionResult<PatientTransferRequest>> CompleteTransferRequest(Guid requestId)
        {
            try
            {
                var tenantId = GetTenantId();
                var userId = GetCurrentUserId();
                
                var completedRequest = await _capacityService.CompleteTransferAsync(requestId, tenantId, userId);
                return Ok(completedRequest);
            }
            catch (KeyNotFoundException ex)
            {
                return NotFound(new { message = ex.Message });
            }
            catch (InvalidOperationException ex)
            {
                return BadRequest(new { message = ex.Message });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { message = "Internal server error", error = ex.Message });
            }
        }

        #endregion

        #region Capacity History

        /// <summary>
        /// Get capacity history for trend analysis
        /// </summary>
        [HttpGet("branch/{branchId}/history")]
        public async Task<ActionResult<List<BranchCapacityHistory>>> GetCapacityHistory(
            Guid branchId,
            [FromQuery] DateTime? startDate = null,
            [FromQuery] DateTime? endDate = null)
        {
            try
            {
                var tenantId = GetTenantId();
                var history = await _capacityService.GetCapacityHistoryAsync(branchId, tenantId, startDate, endDate);
                return Ok(history);
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { message = "Internal server error", error = ex.Message });
            }
        }

        /// <summary>
        /// Manually create a capacity snapshot (usually done automatically by trigger)
        /// </summary>
        [HttpPost("branch/{branchId}/snapshot")]
        public async Task<ActionResult> CreateCapacitySnapshot(Guid branchId)
        {
            try
            {
                var tenantId = GetTenantId();
                await _capacityService.CreateCapacitySnapshotAsync(branchId, tenantId);
                return Ok(new { message = "Capacity snapshot created successfully" });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { message = "Internal server error", error = ex.Message });
            }
        }

        #endregion
    }

    // Additional DTOs for controller actions
    public class ApproveTransferRequestDto
    {
        public Guid? AssignedBedId { get; set; }
    }

    public class RejectTransferRequestDto
    {
        public string RejectedReason { get; set; } = string.Empty;
    }
}
