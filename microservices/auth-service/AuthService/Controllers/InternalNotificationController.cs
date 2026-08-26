using AuthService.Services;
using Microsoft.AspNetCore.Mvc;

namespace AuthService.Controllers;

/// <summary>
/// Internal HTTP endpoint called by sibling microservices (e.g. IP Management)
/// to push SignalR notifications without needing direct hub access.
///
/// Protected by a shared secret header (X-Internal-Key) configured in appsettings.
/// NOT exposed to external callers — add firewall/network rules in production.
/// </summary>
[ApiController]
[Route("api/notifications/internal")]
public class InternalNotificationController : ControllerBase
{
    private readonly INotificationService _notifications;
    private readonly IConfiguration       _config;
    private readonly ILogger<InternalNotificationController> _logger;

    public InternalNotificationController(
        INotificationService notifications,
        IConfiguration config,
        ILogger<InternalNotificationController> logger)
    {
        _notifications = notifications;
        _config        = config;
        _logger        = logger;
    }

    // ── Request / Response DTOs ───────────────────────────────────────────────

    public record PushDeptNotificationRequest(
        Guid   TenantId,
        Guid?  BranchId,
        string DepartmentCode,
        string Type,
        string Message,
        string Details
    );

    public record PushUserNotificationRequest(
        Guid   TenantId,
        Guid   UserId,
        string Type,
        string Message,
        string Details
    );

    public record PushTenantNotificationRequest(
        Guid   TenantId,
        string Type,
        string Message,
        string Details
    );

    // ── Endpoints ─────────────────────────────────────────────────────────────

    /// <summary>
    /// Pushes a SignalR notification to all users in a department.
    /// Called by IP Management service after a pre-op section is requested/responded.
    /// </summary>
    [HttpPost("push-dept")]
    public async Task<IActionResult> PushDeptNotification([FromBody] PushDeptNotificationRequest req)
    {
        if (!IsAuthorized())
            return Unauthorized(new { error = "Invalid or missing internal API key." });

        if (req is null || string.IsNullOrWhiteSpace(req.DepartmentCode))
            return BadRequest(new { error = "DepartmentCode is required." });

        await _notifications.NotifyDepartmentAsync(
            req.TenantId,
            req.BranchId,
            req.DepartmentCode,
            req.Type,
            req.Message,
            req.Details);

        _logger.LogInformation(
            "Internal dept notification pushed: dept={Dept} tenant={Tenant} type={Type}",
            req.DepartmentCode, req.TenantId, req.Type);

        return Ok(new { success = true });
    }

    /// <summary>
    /// Pushes a SignalR notification to a specific user.
    /// Called by IP Management service after a section response to notify the requesting ward user.
    /// </summary>
    [HttpPost("push-user")]
    public async Task<IActionResult> PushUserNotification([FromBody] PushUserNotificationRequest req)
    {
        if (!IsAuthorized())
            return Unauthorized(new { error = "Invalid or missing internal API key." });

        if (req is null || req.UserId == Guid.Empty)
            return BadRequest(new { error = "UserId is required." });

        await _notifications.SendUserNotificationAsync(
            req.UserId,
            req.Type,
            req.Message,
            req.Details);

        _logger.LogInformation(
            "Internal user notification pushed: userId={UserId} type={Type}",
            req.UserId, req.Type);

        return Ok(new { success = true });
    }

    /// <summary>
    /// Pushes a SignalR notification to the tenant group (IP dashboard, billing, OT).
    /// Details must be identity-only — never ledger amounts.
    /// </summary>
    [HttpPost("push-tenant")]
    public async Task<IActionResult> PushTenantNotification([FromBody] PushTenantNotificationRequest req)
    {
        if (!IsAuthorized())
            return Unauthorized(new { error = "Invalid or missing internal API key." });

        if (req is null || req.TenantId == Guid.Empty)
            return BadRequest(new { error = "TenantId is required." });

        await _notifications.SendTenantNotificationAsync(
            req.TenantId,
            req.Type,
            req.Message,
            req.Details);

        _logger.LogInformation(
            "Internal tenant notification pushed: tenant={Tenant} type={Type}",
            req.TenantId, req.Type);

        return Ok(new { success = true });
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    private bool IsAuthorized()
    {
        var expected = _config["InternalApi:Key"];
        if (string.IsNullOrWhiteSpace(expected))
        {
            // If not configured, reject all internal calls
            _logger.LogWarning("InternalApi:Key is not configured — rejecting internal notification request.");
            return false;
        }

        Request.Headers.TryGetValue("X-Internal-Key", out var provided);
        return provided == expected;
    }
}
