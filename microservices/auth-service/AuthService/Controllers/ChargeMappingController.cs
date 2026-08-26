using System.Security.Claims;
using AuthService.Authorization;
using AuthService.DTOs.Billing;
using AuthService.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace AuthService.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class ChargeMappingController : ControllerBase
{
    private readonly IChargeMappingAdminService _admin;
    private readonly ILogger<ChargeMappingController> _logger;

    public ChargeMappingController(IChargeMappingAdminService admin, ILogger<ChargeMappingController> logger)
    {
        _admin = admin;
        _logger = logger;
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

    [HttpGet("exceptions")]
    [RequirePermission("bill.admin")]
    public async Task<ActionResult<ChargeExceptionListDto>> GetExceptions([FromQuery] int lookbackDays = 90)
    {
        var list = await _admin.ListUnmappedAsync(GetTenantId(), lookbackDays);
        return Ok(list);
    }

    [HttpGet("variants")]
    [RequirePermission("bill.admin")]
    public async Task<ActionResult<List<ChargeVariantSearchDto>>> SearchVariants([FromQuery] string? q)
        => Ok(await _admin.SearchVariantsAsync(q));

    [HttpPost]
    [RequirePermission("bill.admin")]
    public async Task<ActionResult<ChargeMappingDto>> Create([FromBody] CreateChargeMappingRequest request)
    {
        try
        {
            var dto = await _admin.CreateMappingAsync(GetTenantId(), GetUserId(), request);
            return Ok(dto);
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new { error = ex.Message });
        }
    }

    [HttpGet("{itemId:guid}/history")]
    [RequirePermission("bill.admin")]
    public async Task<ActionResult<List<ChargeMappingDto>>> History(Guid itemId)
        => Ok(await _admin.GetHistoryAsync(GetTenantId(), itemId));

    [HttpGet("package/{packageId:guid}")]
    [RequirePermission("bill.admin")]
    public async Task<ActionResult<List<PackageComponentStatusDto>>> GetPackage(Guid packageId)
    {
        try
        {
            return Ok(await _admin.GetPackageComponentsAsync(GetTenantId(), packageId));
        }
        catch (InvalidOperationException ex)
        {
            return NotFound(new { error = ex.Message });
        }
    }

    [HttpPut("package/{packageId:guid}")]
    [RequirePermission("bill.admin")]
    public async Task<ActionResult<List<PackageComponentStatusDto>>> SavePackage(
        Guid packageId, [FromBody] SavePackageComponentsRequest request)
    {
        try
        {
            return Ok(await _admin.SavePackageComponentsAsync(GetTenantId(), GetUserId(), packageId, request));
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new { error = ex.Message });
        }
    }

    [HttpPost("replay")]
    [RequirePermission("bill.admin")]
    public async Task<ActionResult<ReplayExceptionsResultDto>> Replay([FromQuery] Guid? itemId)
    {
        try
        {
            return Ok(await _admin.ReplayAsync(GetTenantId(), GetUserId(), itemId));
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Charge mapping replay failed");
            return StatusCode(500, new { error = "Failed to replay parked charges" });
        }
    }
}
