using AuthService.Services;
using Microsoft.AspNetCore.Mvc;

namespace AuthService.Controllers;

/// <summary>
/// Internal OPD clinical snapshot for IP journey refresh (W-01 / FR-1.1).
/// Protected by X-Internal-Key.
/// </summary>
[ApiController]
[Route("api/internal/opd-clinical")]
public class InternalOpdClinicalController : ControllerBase
{
    private readonly IOtFinalizeService _ot;
    private readonly IConfiguration _config;

    public InternalOpdClinicalController(IOtFinalizeService ot, IConfiguration config)
    {
        _ot = ot;
        _config = config;
    }

    [HttpGet("snapshot")]
    public async Task<IActionResult> GetSnapshot(
        [FromQuery] Guid tenantId,
        [FromQuery] Guid patientId,
        [FromQuery] Guid? sessionId,
        [FromQuery] string? eye,
        [FromQuery] bool preferBiometry = true)
    {
        if (!IsAuthorized())
            return Unauthorized(new { error = "Invalid or missing internal API key." });
        if (tenantId == Guid.Empty || patientId == Guid.Empty)
            return BadRequest(new { error = "tenantId and patientId are required." });

        var snap = await _ot.GetOpdClinicalSnapshotAsync(tenantId, patientId, sessionId, eye, preferBiometry);
        return Ok(snap);
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
