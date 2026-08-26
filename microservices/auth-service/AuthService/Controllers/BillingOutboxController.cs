using System.Security.Claims;
using AuthService.Authorization;
using AuthService.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace AuthService.Controllers;

[ApiController]
[Authorize]
[Route("api/BillingOutbox")]
[Route("api/internal/billing-outbox")]
public class BillingOutboxController : ControllerBase
{
    private readonly IBillingCcmsOutboxService _outbox;
    private readonly IAuditService _audit;

    public BillingOutboxController(IBillingCcmsOutboxService outbox, IAuditService audit)
    {
        _outbox = outbox;
        _audit = audit;
    }

    private Guid GetTenantId()
    {
        var raw = User.FindFirst("tenant_id")?.Value
            ?? User.FindFirst("TenantId")?.Value
            ?? Request.Headers["X-Tenant-ID"].FirstOrDefault();
        return Guid.TryParse(raw, out var id) ? id : throw new UnauthorizedAccessException();
    }

    private Guid GetUserId()
    {
        var raw = User.FindFirst(ClaimTypes.NameIdentifier)?.Value
            ?? User.FindFirst("sub")?.Value
            ?? User.FindFirst("userId")?.Value;
        return Guid.TryParse(raw, out var id) ? id : Guid.Empty;
    }

    [HttpGet("stats")]
    [RequirePermission("integration.admin")]
    public async Task<ActionResult<BillingOutboxStats>> Stats()
        => Ok(await _outbox.GetStatsAsync(GetTenantId()));

    [HttpGet("dead")]
    [RequirePermission("integration.admin")]
    public async Task<ActionResult<IReadOnlyList<BillingOutboxDeadLetterDto>>> Dead()
        => Ok(await _outbox.ListDeadAsync(GetTenantId()));

    [HttpGet("events/{eventId:guid}")]
    [RequirePermission("integration.admin")]
    public async Task<ActionResult<BillingOutboxEventDetailDto>> Event(Guid eventId)
    {
        try
        {
            var tenantId = GetTenantId();
            var userId = GetUserId();
            var detail = await _outbox.GetEventAsync(tenantId, eventId);
            await _audit.LogDataAccessAsync(userId, "BillingCcmsOutbox", eventId, "Inspect", "restricted");
            return Ok(detail);
        }
        catch (KeyNotFoundException ex)
        {
            return NotFound(new { error = ex.Message });
        }
    }

    [HttpPost("requeue")]
    [RequirePermission("integration.admin")]
    public async Task<IActionResult> Requeue([FromBody] BillingOutboxRequeueRequest request)
    {
        try
        {
            var n = await _outbox.RequeueAsync(GetTenantId(), request);
            return Ok(new { requeued = n });
        }
        catch (ArgumentException ex)
        {
            return BadRequest(new { error = ex.Message });
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new { error = ex.Message });
        }
        catch (KeyNotFoundException ex)
        {
            return NotFound(new { error = ex.Message });
        }
    }

    [HttpPost("abandon")]
    [RequirePermission("integration.admin")]
    public async Task<IActionResult> Abandon([FromBody] BillingOutboxAbandonRequest request)
    {
        try
        {
            await _outbox.AbandonAsync(GetTenantId(), GetUserId(), request);
            await _audit.LogAsync(GetUserId(), "OutboxAbandoned", "BillingCcmsOutbox", request.EventId, request.Reason);
            return Ok(new { abandoned = true });
        }
        catch (ArgumentException ex)
        {
            return BadRequest(new { error = ex.Message });
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new { error = ex.Message });
        }
        catch (KeyNotFoundException ex)
        {
            return NotFound(new { error = ex.Message });
        }
    }
}
