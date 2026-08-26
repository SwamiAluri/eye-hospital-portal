using AuthService.Authorization;
using AuthService.DTOs.Billing;
using AuthService.Services;
using AuthService.Services.Interfaces;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace AuthService.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class BillItemsController : ControllerBase
{
    private readonly IBillItemService _billItemService;
    private readonly ILogger<BillItemsController> _logger;

    public BillItemsController(
        IBillItemService billItemService,
        ILogger<BillItemsController> logger)
    {
        _billItemService = billItemService;
        _logger = logger;
    }

    private Guid GetTenantId() => Guid.Parse(User.FindFirst("TenantId")?.Value ?? throw new UnauthorizedAccessException());
    private Guid GetUserId() => Guid.Parse(User.FindFirst("sub")?.Value ?? User.FindFirst("userId")?.Value ?? throw new UnauthorizedAccessException());

    /// <summary>
    /// Get all items for a specific bill
    /// </summary>
    [HttpGet("bill/{billId}")]
    [RequirePermission("bill.view")]
    public async Task<ActionResult<List<BillItemDto>>> GetBillItems(Guid billId)
    {
        try
        {
            var items = await _billItemService.GetBillItemsAsync(billId, GetTenantId());
            return Ok(items);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error retrieving bill items for bill {BillId}", billId);
            return StatusCode(500, new { error = "Failed to retrieve bill items" });
        }
    }

    /// <summary>
    /// Get bill item by ID
    /// </summary>
    [HttpGet("{id}")]
    [RequirePermission("bill.view")]
    public async Task<ActionResult<BillItemDto>> GetById(Guid id)
    {
        try
        {
            var item = await _billItemService.GetBillItemByIdAsync(id, GetTenantId());
            if (item == null) return NotFound(new { error = "Bill item not found" });
            return Ok(item);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error retrieving bill item {ItemId}", id);
            return StatusCode(500, new { error = "Failed to retrieve bill item" });
        }
    }

    /// <summary>
    /// Add an item to a bill
    /// </summary>
    [HttpPost]
    [RequirePermission("bill.update")]
    public async Task<ActionResult<BillItemDto>> AddItem([FromBody] AddBillItemRequest request)
    {
        try
        {
            var item = await _billItemService.AddBillItemAsync(request, GetTenantId(), GetUserId());
            return CreatedAtAction(nameof(GetById), new { id = item.Id }, item);
        }
        catch (InvalidOperationException ex) when (BillConcurrency.IsStale(ex))
        {
            return Conflict(new { error = ex.Message });
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new { error = ex.Message });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error adding bill item");
            return StatusCode(500, new { error = "Failed to add bill item" });
        }
    }

    /// <summary>
    /// Update a bill item
    /// </summary>
    [HttpPut("{id}")]
    [RequirePermission("bill.update")]
    public async Task<ActionResult<BillItemDto>> UpdateItem(Guid id, [FromBody] UpdateBillItemRequest request)
    {
        try
        {
            var item = await _billItemService.UpdateBillItemAsync(id, request, GetTenantId(), GetUserId());
            return Ok(item);
        }
        catch (InvalidOperationException ex) when (BillConcurrency.IsStale(ex))
        {
            return Conflict(new { error = ex.Message });
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new { error = ex.Message });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error updating bill item {ItemId}", id);
            return StatusCode(500, new { error = "Failed to update bill item" });
        }
    }

    /// <summary>
    /// Delete a bill item
    /// </summary>
    [HttpDelete("{id}")]
    [RequirePermission("bill.update")]
    public async Task<IActionResult> DeleteItem(Guid id)
    {
        try
        {
            var result = await _billItemService.DeleteBillItemAsync(id, GetTenantId(), GetUserId());
            if (!result) return NotFound(new { error = "Bill item not found" });
            return Ok(new { message = "Bill item deleted successfully" });
        }
        catch (InvalidOperationException ex) when (BillConcurrency.IsStale(ex))
        {
            return Conflict(new { error = ex.Message });
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new { error = ex.Message });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error deleting bill item {ItemId}", id);
            return StatusCode(500, new { error = "Failed to delete bill item" });
        }
    }

    /// <summary>
    /// Get bill summary with all items
    /// </summary>
    [HttpGet("bill/{billId}/summary")]
    [RequirePermission("bill.view")]
    public async Task<ActionResult<BillSummaryDto>> GetBillSummary(Guid billId)
    {
        try
        {
            var summary = await _billItemService.GetBillSummaryAsync(billId, GetTenantId());
            return Ok(summary);
        }
        catch (InvalidOperationException ex)
        {
            return NotFound(new { error = ex.Message });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error retrieving bill summary for {BillId}", billId);
            return StatusCode(500, new { error = "Failed to retrieve bill summary" });
        }
    }

    /// <summary>
    /// Recalculate bill totals based on items
    /// </summary>
    [HttpPost("bill/{billId}/recalculate")]
    [RequirePermission("bill.update")]
    public async Task<ActionResult<BillSummaryDto>> RecalculateBill(Guid billId)
    {
        try
        {
            var summary = await _billItemService.RecalculateBillAsync(billId, GetTenantId());
            return Ok(summary);
        }
        catch (InvalidOperationException ex)
        {
            return NotFound(new { error = ex.Message });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error recalculating bill {BillId}", billId);
            return StatusCode(500, new { error = "Failed to recalculate bill" });
        }
    }
}
