using AuthService.Services;
using Microsoft.AspNetCore.Mvc;

namespace AuthService.Controllers;

/// <summary>
/// Internal callback from CCMS when a coverage case is created or its workflow state changes.
/// Updates PackageAddonsJson on the linked counselling session so the counsellor desk
/// can show case number / state without polling CCMS on every page load.
/// </summary>
[ApiController]
[Route("api/internal/ccms-callback")]
public class InternalCcmsCallbackController : ControllerBase
{
    private readonly ICounselingWorkflowService _counselingService;
    private readonly IConfiguration _config;
    private readonly ILogger<InternalCcmsCallbackController> _logger;

    public InternalCcmsCallbackController(
        ICounselingWorkflowService counselingService,
        IConfiguration config,
        ILogger<InternalCcmsCallbackController> logger)
    {
        _counselingService = counselingService;
        _config            = config;
        _logger            = logger;
    }

    public record CcmsCallbackRequest(
        string  SessionId,
        string? TenantId,
        string  CoverageCaseId,
        string  CaseNumber,
        string  EventType,
        string? CurrentState = null
    );

    [HttpPost]
    public async Task<IActionResult> HandleCallback([FromBody] CcmsCallbackRequest req)
    {
        if (!IsAuthorized())
            return Unauthorized(new { error = "Invalid or missing internal API key." });

        if (req is null
            || string.IsNullOrWhiteSpace(req.SessionId)
            || string.IsNullOrWhiteSpace(req.CoverageCaseId)
            || string.IsNullOrWhiteSpace(req.CaseNumber)
            || string.IsNullOrWhiteSpace(req.EventType))
        {
            return BadRequest(new { error = "sessionId, coverageCaseId, caseNumber, and eventType are required." });
        }

        if (!Guid.TryParse(req.SessionId, out var sessionId)
            || !Guid.TryParse(req.CoverageCaseId, out var coverageCaseId))
        {
            return BadRequest(new { error = "sessionId and coverageCaseId must be valid GUIDs." });
        }

        Guid? tenantId = Guid.TryParse(req.TenantId, out var tid) ? tid : null;

        try
        {
            var ok = await _counselingService.ApplyCcmsCallbackAsync(
                sessionId, tenantId, coverageCaseId, req.CaseNumber, req.EventType, req.CurrentState);

            if (!ok)
                return NotFound(new { error = "Counselling session not found." });

            _logger.LogInformation(
                "CCMS callback applied: session={Session} case={Case} event={Event} state={State}",
                sessionId, req.CaseNumber, req.EventType, req.CurrentState);

            return Ok(new { success = true });
        }
        // Phase 3I Slice 7 (PD-S7-01/06 — M19, approved): a genuine concurrent-write race is surfaced
        // as 409 so the distinction from NotFound is visible in logs/metrics, even though the CCMS
        // AuthServiceClient caller is fire-and-forget and only logs !IsSuccessStatusCode today.
        catch (InvalidOperationException ex) when (SessionConcurrency.IsStale(ex))
        {
            _logger.LogWarning(ex, "CCMS callback hit a stale Version conflict for session {SessionId}.", sessionId);
            return Conflict(new { success = false, error = ex.Message });
        }
        catch (Exception ex)
        {
            // Fire-and-forget from CCMS — return 200 so CCMS workflow is never blocked.
            _logger.LogError(ex, "CCMS callback failed for session {SessionId}.", sessionId);
            return Ok(new { success = false, error = ex.Message });
        }
    }

    private bool IsAuthorized()
    {
        var expected = _config["InternalApi:Key"];
        if (string.IsNullOrWhiteSpace(expected))
        {
            _logger.LogWarning("InternalApi:Key is not configured — rejecting CCMS callback.");
            return false;
        }

        Request.Headers.TryGetValue("X-Internal-Key", out var provided);
        return provided == expected;
    }
}
