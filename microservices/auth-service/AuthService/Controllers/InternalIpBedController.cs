using AuthService.Models.Branch;
using AuthService.Services;
using Microsoft.AspNetCore.Mvc;

namespace AuthService.Controllers;

/// <summary>
/// Internal bed occupancy API for IP Management. Master data stays bed_inventory.
/// </summary>
[ApiController]
[Route("api/internal/ip-beds")]
public class InternalIpBedController : ControllerBase
{
    private readonly IBranchCapacityService _capacity;
    private readonly IConfiguration _config;
    private readonly ILogger<InternalIpBedController> _log;

    public InternalIpBedController(
        IBranchCapacityService capacity,
        IConfiguration config,
        ILogger<InternalIpBedController> log)
    {
        _capacity = capacity;
        _config = config;
        _log = log;
    }

    public record JourneyBedRequest(
        Guid TenantId,
        Guid BedId,
        Guid ActorUserId,
        Guid? PatientId,
        string Action);

    [HttpGet]
    public async Task<IActionResult> List(
        [FromQuery] Guid tenantId,
        [FromQuery] Guid branchId,
        [FromQuery] string? wardName,
        [FromQuery] Guid? wardId)
    {
        if (!IsAuthorized())
            return Unauthorized(new { error = "Invalid or missing internal API key." });
        if (tenantId == Guid.Empty || branchId == Guid.Empty)
            return BadRequest(new { error = "tenantId and branchId are required." });

        var beds = await _capacity.GetBedInventoryAsync(
            branchId, tenantId, wardId: wardId, wardName: wardName);

        return Ok(beds.Select(b => new
        {
            bedId = b.Id,
            bedNumber = b.BedNumber,
            roomNumber = b.RoomNumber,
            wardName = b.WardName,
            wardId = b.WardId,
            bedType = b.BedType,
            bedStatus = b.BedStatus,
        }));
    }

    [HttpPost("lifecycle")]
    public async Task<IActionResult> ApplyLifecycle([FromBody] JourneyBedRequest req)
    {
        if (!IsAuthorized())
            return Unauthorized(new { error = "Invalid or missing internal API key." });

        if (req.TenantId == Guid.Empty || req.BedId == Guid.Empty || string.IsNullOrWhiteSpace(req.Action))
            return BadRequest(new { error = "TenantId, BedId, and Action are required." });

        try
        {
            var bed = await _capacity.ApplyJourneyBedActionAsync(
                req.BedId, req.Action, req.PatientId, req.TenantId, req.ActorUserId);
            return Ok(new
            {
                bedId = bed.Id,
                bedNumber = bed.BedNumber,
                roomNumber = bed.RoomNumber,
                wardName = bed.WardName,
                wardId = bed.WardId,
                bedType = bed.BedType,
                bedStatus = bed.BedStatus,
            });
        }
        catch (KeyNotFoundException ex)
        {
            return NotFound(new { error = ex.Message });
        }
        catch (InvalidOperationException ex)
        {
            return Conflict(new { error = ex.Message });
        }
        catch (Exception ex)
        {
            _log.LogError(ex, "IP bed lifecycle failed for {BedId}", req.BedId);
            return StatusCode(500, new { error = "Bed lifecycle failed." });
        }
    }

    private bool IsAuthorized()
    {
        Request.Headers.TryGetValue("X-Internal-Key", out var provided);
        var expected = _config["InternalApi:Key"]
            ?? _config["InternalApiKey"]
            ?? _config["AuthService:InternalApiKey"]
            ?? string.Empty;
        return !string.IsNullOrWhiteSpace(expected)
               && string.Equals(provided.ToString(), expected, StringComparison.Ordinal);
    }
}
