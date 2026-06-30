using AuthService.Authorization;
using AuthService.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace AuthService.Controllers;

[Authorize]
[ApiController]
[Route("api/user-chart-layout")]
public class UserChartLayoutController : ControllerBase
{
    private readonly IUserChartLayoutService _chartLayout;

    public UserChartLayoutController(IUserChartLayoutService chartLayout)
    {
        _chartLayout = chartLayout;
    }

    private bool TryGetTenantAndUser(out Guid tenantId, out Guid userId)
    {
        tenantId = Guid.Empty;
        userId = Guid.Empty;
        var tenantClaim = User.FindFirst("TenantId")?.Value;
        if (string.IsNullOrEmpty(tenantClaim) || !Guid.TryParse(tenantClaim, out tenantId))
            return false;
        var userClaim = User.FindFirst("sub")?.Value
            ?? User.FindFirst("user_id")?.Value
            ?? User.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)?.Value;
        if (string.IsNullOrEmpty(userClaim) || !Guid.TryParse(userClaim, out userId))
            return false;
        return true;
    }

    [HttpGet("me")]
    [RequirePermission("patient.view")]
    public async Task<ActionResult<object>> GetMyLayout()
    {
        if (!TryGetTenantAndUser(out var tenantId, out var userId))
            return Unauthorized();

        var json = await _chartLayout.GetLayoutJsonAsync(tenantId, userId);
        return Ok(new { layoutJson = json });
    }

    [HttpPut("me")]
    [RequirePermission("patient.view")]
    public async Task<ActionResult<object>> SaveMyLayout([FromBody] SaveChartLayoutRequest request)
    {
        if (!TryGetTenantAndUser(out var tenantId, out var userId))
            return Unauthorized();

        if (string.IsNullOrWhiteSpace(request.LayoutJson))
            return BadRequest(new { message = "layoutJson is required" });

        var ok = await _chartLayout.SaveLayoutJsonAsync(tenantId, userId, request.LayoutJson);
        if (!ok)
            return StatusCode(503, new { message = "Chart layout storage is unavailable" });

        return Ok(new { success = true });
    }
}

public class SaveChartLayoutRequest
{
    public string LayoutJson { get; set; } = "{}";
}
