using System;
using System.Collections.Generic;
using System.Security.Claims;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Logging;
using AuthService.Authorization;
using AuthService.DTOs.Billing;
using AuthService.Services;
using AuthService.Services.Interfaces;

namespace AuthService.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class OpdBillsController : ControllerBase
{
    private readonly IOpdBillService _opdBillService;
    private readonly ILogger<OpdBillsController> _logger;

    public OpdBillsController(IOpdBillService opdBillService, ILogger<OpdBillsController> logger)
    {
        _opdBillService = opdBillService;
        _logger = logger;
    }

    private Guid GetUserId()
    {
        var userIdClaim = User.FindFirst(ClaimTypes.NameIdentifier)?.Value
            ?? User.FindFirst("sub")?.Value
            ?? User.FindFirst("id")?.Value;
        return Guid.TryParse(userIdClaim, out var userId) ? userId : Guid.Empty;
    }

    private bool TryGetAuthenticatedTenantId(out Guid tenantId)
    {
        tenantId = Guid.Empty;
        var raw = User?.FindFirst("tenant_id")?.Value ?? User?.FindFirst("TenantId")?.Value;
        return Guid.TryParse(raw, out tenantId) && tenantId != Guid.Empty;
    }

    /// <summary>
    /// Get all OPD bills with filters
    /// </summary>
    [HttpGet]
    public async Task<IActionResult> GetAll(
        [FromQuery] Guid? patientId = null,
        [FromQuery] Guid? branchId = null,
        [FromQuery] string? status = null,
        [FromQuery] bool? isFreeVisit = null,
        [FromQuery] bool? isCredit = null,
        [FromQuery] DateTime? dateFrom = null,
        [FromQuery] DateTime? dateTo = null,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 50)
    {
        try
        {
            // Use branch filter if provided, otherwise get all accessible bills
            if (branchId.HasValue)
            {
                var bills = await _opdBillService.GetByBranchIdAsync(branchId.Value, dateFrom, dateTo, status, page, pageSize);
                return Ok(new { bills = bills, total = bills.Count });
            }
            else if (patientId.HasValue)
            {
                await _opdBillService.AuthorizePatientBillReadAsync();
                if (!TryGetAuthenticatedTenantId(out var tenantId))
                    return Unauthorized(new { message = "Authentication required." });
                var bills = await _opdBillService.GetByPatientIdAsync(tenantId, patientId.Value, page, pageSize);
                return Ok(new { bills = bills, total = bills.Count });
            }
            else
            {
                // Return empty list if no filter provided (for security)
                return Ok(new { bills = new List<object>(), total = 0 });
            }
        }
        catch (UnauthorizedAccessException ex)
        {
            return Unauthorized(new { message = ex.Message });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error getting OPD bills");
            return StatusCode(500, new { message = "Failed to retrieve bills", error = ex.Message });
        }
    }

    /// <summary>
    /// Get OPD bill by ID
    /// </summary>
    [HttpGet("{id:guid}")]
    public async Task<IActionResult> GetById(Guid id)
    {
        var bill = await _opdBillService.GetByIdAsync(id);
        if (bill == null)
        {
            return NotFound(new { message = "Bill not found" });
        }
        return Ok(bill);
    }

    /// <summary>
    /// Get OPD bill by appointment ID
    /// </summary>
    [HttpGet("by-appointment/{appointmentId:guid}")]
    public async Task<IActionResult> GetByAppointmentId(Guid appointmentId)
    {
        var bill = await _opdBillService.GetByAppointmentIdAsync(appointmentId);
        if (bill == null)
        {
            return NotFound(new { message = "No bill found for this appointment" });
        }
        return Ok(bill);
    }

    /// <summary>
    /// Get bills by patient ID
    /// </summary>
    [HttpGet("by-patient/{patientId:guid}")]
    public async Task<IActionResult> GetByPatientId(Guid patientId, [FromQuery] int page = 1, [FromQuery] int pageSize = 20)
    {
        try
        {
            await _opdBillService.AuthorizePatientBillReadAsync();
            if (!TryGetAuthenticatedTenantId(out var tenantId))
                return Unauthorized(new { message = "Authentication required." });
            var bills = await _opdBillService.GetByPatientIdAsync(tenantId, patientId, page, pageSize);
            return Ok(bills);
        }
        catch (UnauthorizedAccessException ex)
        {
            return Unauthorized(new { message = ex.Message });
        }
    }

    /// <summary>
    /// Get bills by branch ID
    /// </summary>
    [HttpGet("by-branch/{branchId:guid}")]
    public async Task<IActionResult> GetByBranchId(
        Guid branchId,
        [FromQuery] DateTime? fromDate = null,
        [FromQuery] DateTime? toDate = null,
        [FromQuery] string? status = null,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 50)
    {
        var bills = await _opdBillService.GetByBranchIdAsync(branchId, fromDate, toDate, status, page, pageSize);
        return Ok(bills);
    }

    /// <summary>
    /// Inpatient financial dashboard from OpdBill (not PatientJourney snapshots).
    /// Billed metrics use bill_date; collected/refunds use payment_date.
    /// </summary>
    [HttpGet("ip-dashboard")]
    public async Task<IActionResult> GetIpDashboard(
        [FromQuery] Guid branchId,
        [FromQuery] string? preset = "this_month",
        [FromQuery] DateTime? from = null,
        [FromQuery] DateTime? to = null)
    {
        if (branchId == Guid.Empty)
            return BadRequest(new { message = "branchId is required." });
        var data = await _opdBillService.GetIpBillingDashboardAsync(branchId, preset, from, to);
        return Ok(data);
    }

    /// <summary>
    /// Check billing rules for an appointment (determines if free visit)
    /// </summary>
    [HttpGet("check-rules/{appointmentId:guid}")]
    public async Task<IActionResult> CheckBillingRules(Guid appointmentId)
    {
        try
        {
            var result = await _opdBillService.CheckBillingRulesAsync(appointmentId);
            return Ok(result);
        }
        catch (ArgumentException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
    }

    /// <summary>
    /// Get payment status for an appointment (MODULE 4 - Check-in Gate 1 validation)
    /// </summary>
    [HttpGet("payment-status/{appointmentId:guid}")]
    public async Task<IActionResult> GetPaymentStatus(Guid appointmentId)
    {
        try
        {
            var bill = await _opdBillService.GetByAppointmentIdAsync(appointmentId);
            
            if (bill == null)
            {
                return Ok(new 
                { 
                    paid = false, 
                    amount = 0, 
                    paidAt = (DateTime?)null,
                    message = "No bill found for this appointment"
                });
            }

            var isPaid = bill.Status == "Paid" || bill.Status == "Fully Paid" || bill.BalanceDue == 0;
            
            return Ok(new 
            { 
                paid = isPaid,
                amount = bill.NetAmount,
                paidAmount = bill.AmountPaid,
                balanceDue = bill.BalanceDue,
                billId = bill.Id,
                status = bill.Status,
                billDate = bill.BillDate
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error getting payment status for appointment {AppointmentId}", appointmentId);
            return StatusCode(500, new { message = "Failed to get payment status", error = ex.Message });
        }
    }

    /// <summary>
    /// Get outstanding bills for a patient (MODULE 4 - Check-in Gate 2 validation)
    /// </summary>
    [HttpGet("outstanding/{patientId:guid}")]
    public async Task<IActionResult> GetOutstandingBills(Guid patientId)
    {
        try
        {
            if (!TryGetAuthenticatedTenantId(out var tenantId))
                return Unauthorized(new { message = "Authentication required." });

            var bills = await _opdBillService.GetByPatientIdAsync(tenantId, patientId, page: 1, pageSize: 1000);
            
            // Filter to unpaid/partially paid bills
            var outstandingBills = bills
                .Where(b => b.Status != "Paid" && b.Status != "Fully Paid" && b.BalanceDue > 0)
                .ToList();

            var totalOutstanding = outstandingBills.Sum(b => b.BalanceDue);
            
            return Ok(new 
            { 
                patientId = patientId,
                totalOutstanding = totalOutstanding,
                outstandingBillsCount = outstandingBills.Count,
                bills = outstandingBills.Select(b => new 
                {
                    billId = b.Id,
                    billNumber = b.BillNumber,
                    billDate = b.BillDate,
                    netAmount = b.NetAmount,
                    amountPaid = b.AmountPaid,
                    balanceDue = b.BalanceDue,
                    status = b.Status
                })
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error getting outstanding bills for patient {PatientId}", patientId);
            return StatusCode(500, new { message = "Failed to get outstanding bills", error = ex.Message });
        }
    }

    /// <summary>
    /// Create a new OPD bill
    /// </summary>
    [HttpPost]
    [RequirePermission("bill.create")]
    public async Task<IActionResult> CreateBill([FromBody] CreateOpdBillDto request)
    {
        try
        {
            var userId = GetUserId();
            var bill = await _opdBillService.CreateBillAsync(request, userId);
            return CreatedAtAction(nameof(GetById), new { id = bill.Id }, bill);
        }
        catch (ArgumentException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
        catch (InvalidOperationException ex)
        {
            return Conflict(new { message = ex.Message });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error creating OPD bill for appointment {AppointmentId}", request.AppointmentId);
            return StatusCode(500, new { message = "Failed to create bill", error = ex.Message });
        }
    }

    /// <summary>
    /// JWT cashier path: create or reuse the inpatient OpdBill for a journey.
    /// Package explosion (BILL-031 / D1) runs inside EnsureInpatientBillAsync.
    /// </summary>
    [HttpPost("ip-ensure")]
    [RequirePermission("bill.create")]
    public async Task<IActionResult> EnsureIpBill([FromBody] EnsureIpBillDto request)
    {
        try
        {
            var userId = GetUserId();
            var bill = await _opdBillService.EnsureIpBillForJourneyAsync(request.PatientJourneyId, userId);
            return Ok(bill);
        }
        catch (KeyNotFoundException ex)
        {
            return NotFound(new { message = ex.Message });
        }
        catch (ArgumentException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
        catch (ChargePostingException ex)
        {
            return Conflict(new { code = ex.Code, error = ex.Message, billId = ex.BillId, failedLines = ex.FailedLines });
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
        catch (UnauthorizedAccessException ex)
        {
            return StatusCode(403, new { message = ex.Message });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error ensuring IP bill for journey {JourneyId}", request.PatientJourneyId);
            return StatusCode(500, new { message = "Failed to ensure inpatient bill", error = ex.Message });
        }
    }

    /// <summary>
    /// Add payment to a bill
    /// </summary>
    [HttpPost("payment")]
    [RequirePermission("bill.update")]
    public async Task<IActionResult> AddPayment([FromBody] AddPaymentDto request)
    {
        try
        {
            var userId = GetUserId();
            var bill = await _opdBillService.AddPaymentAsync(request, userId);

            if (bill == null)
            {
                return NotFound(new { message = "Bill not found" });
            }

            return Ok(bill);
        }
        catch (ArgumentException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
        catch (InvalidOperationException ex)
        {
            return Conflict(new { message = ex.Message });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error adding payment to bill {BillId}", request.OpdBillId);
            return StatusCode(500, new { message = "Failed to add payment", error = ex.Message });
        }
    }

    /// <summary>
    /// Approve credit for a bill
    /// </summary>
    [HttpPost("credit")]
    [RequirePermission("bill.update")]
    public async Task<IActionResult> ApproveCredit([FromBody] ApplyCreditDto request)
    {
        try
        {
            var userId = GetUserId();
            var bill = await _opdBillService.ApproveCreditAsync(request, userId);

            if (bill == null)
            {
                return NotFound(new { message = "Bill not found" });
            }

            return Ok(bill);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error approving credit for bill {BillId}", request.OpdBillId);
            return StatusCode(500, new { message = "Failed to approve credit", error = ex.Message });
        }
    }

    /// <summary>
    /// Apply discount to a bill
    /// </summary>
    [HttpPost("discount")]
    [RequirePermission("bill.update")]
    public async Task<IActionResult> ApplyDiscount([FromBody] ApplyDiscountDto request)
    {
        try
        {
            var userId = GetUserId();
            var bill = await _opdBillService.ApplyDiscountAsync(request, userId);

            if (bill == null)
            {
                return NotFound(new { message = "Bill not found" });
            }

            return Ok(bill);
        }
        catch (InvalidOperationException ex)
        {
            return Conflict(new { message = ex.Message });
        }
        catch (UnauthorizedAccessException ex)
        {
            return Unauthorized(new { message = ex.Message });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error applying discount to bill {BillId}", request.OpdBillId);
            return StatusCode(500, new { message = "Failed to apply discount", error = ex.Message });
        }
    }

    /// <summary>
    /// Finalize a bill (make it immutable)
    /// </summary>
    [HttpPost("{id:guid}/finalize")]
    [RequirePermission("bill.update")]
    public async Task<IActionResult> FinalizeBill(Guid id)
    {
        try
        {
            var userId = GetUserId();
            var bill = await _opdBillService.FinalizeBillAsync(id, userId);

            if (bill == null)
            {
                return NotFound(new { message = "Bill not found" });
            }

            return Ok(bill);
        }
        catch (InvalidOperationException ex)
        {
            return Conflict(new { message = ex.Message });
        }
        catch (UnauthorizedAccessException ex)
        {
            return Unauthorized(new { message = ex.Message });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error finalizing bill {BillId}", id);
            return StatusCode(500, new { message = "Failed to finalize bill", error = ex.Message });
        }
    }

    /// <summary>
    /// Cancel a bill
    /// </summary>
    [HttpPost("{id:guid}/cancel")]
    [RequirePermission("bill.update")]
    public async Task<IActionResult> CancelBill(Guid id, [FromBody] CancelBillRequest request)
    {
        try
        {
            var userId = GetUserId();
            var bill = await _opdBillService.CancelBillAsync(id, request.Reason, userId);

            if (bill == null)
            {
                return NotFound(new { message = "Bill not found" });
            }

            return Ok(bill);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error cancelling bill {BillId}", id);
            return StatusCode(500, new { message = "Failed to cancel bill", error = ex.Message });
        }
    }

    // ============ Bill Locking Endpoints (Day 5 - Feb 7, 2026) ============

    /// <summary>
    /// Lock a bill after the same finalization gates as POST {id}/finalize.
    /// Does not bypass completeness or patient obligation.
    /// </summary>
    [HttpPost("{id:guid}/lock")]
    [RequirePermission("bill.update")]
    public async Task<IActionResult> LockBill(Guid id)
    {
        try
        {
            var userId = GetUserId();
            var bill = await _opdBillService.LockBillAsync(id, userId);

            if (bill == null)
            {
                return NotFound(new { message = "Bill not found" });
            }

            return Ok(new { message = "Bill locked successfully", bill });
        }
        catch (InvalidOperationException ex)
        {
            return Conflict(new { message = ex.Message });
        }
        catch (UnauthorizedAccessException ex)
        {
            return Unauthorized(new { message = ex.Message });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error locking bill {BillId}", id);
            return StatusCode(500, new { message = "Failed to lock bill", error = ex.Message });
        }
    }

    /// <summary>
    /// Unlock a bill (admin only) - requires reason for audit trail
    /// </summary>
    [HttpPost("{id:guid}/unlock")]
    [RequirePermission("bill.update")]
    public async Task<IActionResult> UnlockBill(Guid id, [FromBody] UnlockBillRequest request)
    {
        try
        {
            var userId = GetUserId();
            var bill = await _opdBillService.UnlockBillAsync(id, request.Reason, userId);

            if (bill == null)
            {
                return NotFound(new { message = "Bill not found" });
            }

            return Ok(new { message = "Bill unlocked successfully", bill });
        }
        catch (ArgumentException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error unlocking bill {BillId}", id);
            return StatusCode(500, new { message = "Failed to unlock bill", error = ex.Message });
        }
    }

    /// <summary>
    /// Check if a bill is locked
    /// </summary>
    [HttpGet("{id:guid}/is-locked")]
    public async Task<IActionResult> IsBillLocked(Guid id)
    {
        try
        {
            var isLocked = await _opdBillService.IsBillLockedAsync(id);
            return Ok(new { billId = id, isLocked });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error checking bill lock status {BillId}", id);
            return StatusCode(500, new { message = "Failed to check bill lock status", error = ex.Message });
        }
    }

    // ============ Billing Rules Endpoints ============

    /// <summary>
    /// Get all billing rules
    /// </summary>
    [HttpGet("rules")]
    [RequirePermission("bill.admin")]
    public async Task<IActionResult> GetBillingRules([FromQuery] Guid? branchId = null)
    {
        var rules = await _opdBillService.GetBillingRulesAsync(branchId);
        return Ok(rules);
    }

    /// <summary>
    /// Create a billing rule
    /// </summary>
    [HttpPost("rules")]
    [RequirePermission("bill.admin")]
    public async Task<IActionResult> CreateBillingRule([FromBody] CreateBillingRuleDto request)
    {
        try
        {
            var userId = GetUserId();
            var rule = await _opdBillService.CreateBillingRuleAsync(request, userId);
            return CreatedAtAction(nameof(GetBillingRules), null, rule);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error creating billing rule");
            return StatusCode(500, new { message = "Failed to create billing rule", error = ex.Message });
        }
    }

    /// <summary>
    /// Update a billing rule
    /// </summary>
    [HttpPut("rules/{id:guid}")]
    [RequirePermission("bill.admin")]
    public async Task<IActionResult> UpdateBillingRule(Guid id, [FromBody] UpdateBillingRuleDto request)
    {
        try
        {
            var userId = GetUserId();
            var rule = await _opdBillService.UpdateBillingRuleAsync(id, request, userId);

            if (rule == null)
            {
                return NotFound(new { message = "Billing rule not found" });
            }

            return Ok(rule);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error updating billing rule {RuleId}", id);
            return StatusCode(500, new { message = "Failed to update billing rule", error = ex.Message });
        }
    }

    /// <summary>
    /// Delete a billing rule
    /// </summary>
    [HttpDelete("rules/{id:guid}")]
    [RequirePermission("bill.admin")]
    public async Task<IActionResult> DeleteBillingRule(Guid id)
    {
        try
        {
            var userId = GetUserId();
            var success = await _opdBillService.DeleteBillingRuleAsync(id, userId);

            if (!success)
            {
                return NotFound(new { message = "Billing rule not found" });
            }

            return NoContent();
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error deleting billing rule {RuleId}", id);
            return StatusCode(500, new { message = "Failed to delete billing rule", error = ex.Message });
        }
    }

    // Day 8: Auto-Billing Prompt (Jan 31, 2026)

    /// <summary>
    /// Check if visit has a bill and payment status (for visit completion validation)
    /// </summary>
    [HttpGet("visit-billing-status/{visitId:guid}")]
    public async Task<IActionResult> GetVisitBillingStatus(Guid visitId)
    {
        try
        {
            var bill = await _opdBillService.GetByVisitIdAsync(visitId);
            
            if (bill == null)
            {
                return Ok(new
                {
                    hasBill = false,
                    isPaid = false,
                    isLocked = false,
                    isFreeVisit = false,
                    isCredit = false,
                    balanceDue = 0m,
                    billNumber = (string?)null,
                    message = "No bill generated for this visit"
                });
            }

            var isPaid = bill.Status == "paid" || bill.BalanceDue == 0;
            var canComplete = isPaid || bill.IsFreeVisit || bill.IsCredit;

            return Ok(new
            {
                hasBill = true,
                isPaid = isPaid,
                isLocked = bill.IsLocked,
                isFreeVisit = bill.IsFreeVisit,
                isCredit = bill.IsCredit,
                balanceDue = bill.BalanceDue,
                netAmount = bill.NetAmount,
                amountPaid = bill.AmountPaid,
                billNumber = bill.BillNumber,
                billId = bill.Id,
                status = bill.Status,
                canComplete = canComplete,
                message = canComplete
                    ? "Visit can be completed"
                    : $"Payment pending: ₹{bill.BalanceDue:F2} balance due"
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error checking billing status for visit {VisitId}", visitId);
            return StatusCode(500, new { message = "Failed to check billing status", error = ex.Message });
        }
    }

    /// <summary>
    /// Check if appointment has a bill (for visit completion validation)
    /// </summary>
    [HttpGet("appointment-billing-status/{appointmentId:guid}")]
    public async Task<IActionResult> GetAppointmentBillingStatus(Guid appointmentId)
    {
        try
        {
            var bill = await _opdBillService.GetByAppointmentIdAsync(appointmentId);
            
            if (bill == null)
            {
                return Ok(new
                {
                    hasBill = false,
                    isPaid = false,
                    message = "No bill generated for this appointment"
                });
            }

            var isPaid = bill.Status == "paid" || bill.BalanceDue == 0;

            return Ok(new
            {
                hasBill = true,
                isPaid = isPaid,
                isFreeVisit = bill.IsFreeVisit,
                isCredit = bill.IsCredit,
                balanceDue = bill.BalanceDue,
                billNumber = bill.BillNumber,
                billId = bill.Id,
                status = bill.Status
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error checking billing status for appointment {AppointmentId}", appointmentId);
            return StatusCode(500, new { message = "Failed to check billing status", error = ex.Message });
        }
    }
}

public class CancelBillRequest
{
    public string Reason { get; set; } = null!;
}

public class UnlockBillRequest
{
    public string Reason { get; set; } = null!;
}
