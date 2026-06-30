using AuthService.Services;
using Microsoft.AspNetCore.Mvc;

namespace AuthService.Controllers;

/// <summary>
/// Internal HTTP endpoint called by the IP Management microservice when a patient's
/// clinical state transitions to SurgeryCompleted.  Updates the linked OT finalize
/// schedule record from OTPrepared → SurgeryDone so the Finalize Surgery page
/// shows the correct "Surgery Done" count.
///
/// Protected by the same shared-secret header (X-Internal-Key) used by
/// InternalNotificationController.  NOT exposed to external callers.
/// </summary>
[ApiController]
[Route("api/internal/ot-sync")]
public class InternalOtSyncController : ControllerBase
{
    private readonly IOtFinalizeService _otFinalizeService;
    private readonly IConfiguration     _config;
    private readonly ILogger<InternalOtSyncController> _logger;

    public InternalOtSyncController(
        IOtFinalizeService otFinalizeService,
        IConfiguration config,
        ILogger<InternalOtSyncController> logger)
    {
        _otFinalizeService = otFinalizeService;
        _config            = config;
        _logger            = logger;
    }

    // ── DTOs ─────────────────────────────────────────────────────────────────

    /// <summary>
    /// Payload sent by IP Management service when surgery is completed.
    /// </summary>
    public record MarkSurgeryDoneRequest(
        Guid   OtScheduleId,
        Guid   TenantId,
        string ActorUserId
    );

    public record ReleaseForRebookRequest(
        Guid   OtScheduleId,
        Guid   TenantId,
        string ActorUserId
    );

    // ── Endpoints ──────────────────────────────────────────────────────────────

    /// <summary>
    /// Transitions ot_finalize_schedule.status → SurgeryDone.
    /// Called fire-and-forget from IP Management — always returns 200 to avoid
    /// blocking the clinical state transition on the calling side.
    /// </summary>
    [HttpPost("surgery-done")]
    public async Task<IActionResult> MarkSurgeryDone([FromBody] MarkSurgeryDoneRequest req)
    {
        if (!IsAuthorized())
            return Unauthorized(new { error = "Invalid or missing internal API key." });

        if (req is null || req.OtScheduleId == Guid.Empty || req.TenantId == Guid.Empty)
            return BadRequest(new { error = "OtScheduleId and TenantId are required." });

        try
        {
            var result = await _otFinalizeService.MarkSurgeryDoneAsync(
                req.OtScheduleId, req.TenantId, req.ActorUserId ?? string.Empty);

            _logger.LogInformation(
                "OT sync surgery-done: scheduleId={Id} tenant={Tenant} actor={Actor} result={Status}",
                req.OtScheduleId, req.TenantId, req.ActorUserId,
                result?.Status ?? "not-found");

            return Ok(new { success = true, status = result?.Status });
        }
        catch (Exception ex)
        {
            // Log but still return 200 — the IP Management clinical transition must not be
            // rolled back because of an OT sync failure.
            _logger.LogError(ex,
                "OT sync surgery-done failed for scheduleId={Id}.", req.OtScheduleId);
            return Ok(new { success = false, error = ex.Message });
        }
    }

    /// <summary>
    /// Releases an OTPrepared slot back to Confirmed for ward cancel-today rebook.
    /// </summary>
    [HttpPost("release-for-rebook")]
    public async Task<IActionResult> ReleaseForRebook([FromBody] ReleaseForRebookRequest req)
    {
        if (!IsAuthorized())
            return Unauthorized(new { error = "Invalid or missing internal API key." });

        if (req is null || req.OtScheduleId == Guid.Empty || req.TenantId == Guid.Empty)
            return BadRequest(new { error = "OtScheduleId and TenantId are required." });

        try
        {
            var result = await _otFinalizeService.ReopenAsync(
                req.OtScheduleId,
                req.TenantId,
                Guid.TryParse(req.ActorUserId, out var uid) ? uid : Guid.Empty);

            _logger.LogInformation(
                "OT sync release-for-rebook: scheduleId={Id} status={Status}",
                req.OtScheduleId, result?.Status ?? "not-found");

            return Ok(new { success = true, status = result?.Status });
        }
        catch (InvalidOperationException ex)
        {
            _logger.LogWarning(ex,
                "OT sync release-for-rebook skipped for scheduleId={Id}.", req.OtScheduleId);
            return Ok(new { success = false, error = ex.Message });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex,
                "OT sync release-for-rebook failed for scheduleId={Id}.", req.OtScheduleId);
            return Ok(new { success = false, error = ex.Message });
        }
    }

    // ── Helper ────────────────────────────────────────────────────────────────

    private bool IsAuthorized()
    {
        var expected = _config["InternalApi:Key"];
        if (string.IsNullOrWhiteSpace(expected))
        {
            _logger.LogWarning(
                "InternalApi:Key is not configured — rejecting internal OT sync request.");
            return false;
        }

        Request.Headers.TryGetValue("X-Internal-Key", out var provided);
        return provided == expected;
    }
}
