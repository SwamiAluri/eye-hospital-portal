using System.Security.Claims;
using AuthService.Authorization;
using AuthService.DTOs.Visit;
using AuthService.Services.Interfaces;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace AuthService.Controllers;

/// <summary>
/// Optometry queue — live visit-based queue for shared optometrist workstation.
/// </summary>
[ApiController]
[Route("api/visits/queue/optometrist")]
[Authorize]
public class OptometryQueueController : ControllerBase
{
    private readonly IOptometryQueueService _optometryQueueService;
    private readonly IVisitService _visitService;
    private readonly ILogger<OptometryQueueController> _logger;

    public OptometryQueueController(
        IOptometryQueueService optometryQueueService,
        IVisitService visitService,
        ILogger<OptometryQueueController> logger)
    {
        _optometryQueueService = optometryQueueService;
        _visitService = visitService;
        _logger = logger;
    }

    private Guid? GetTenantId()
    {
        var claim = User.FindFirst("TenantId")?.Value;
        return Guid.TryParse(claim, out var id) ? id : null;
    }

    private Guid? GetUserId()
    {
        var claim = User.FindFirst(ClaimTypes.NameIdentifier)?.Value
            ?? User.FindFirst("sub")?.Value;
        return Guid.TryParse(claim, out var id) ? id : null;
    }

    [HttpGet]
    [RequirePermission("CLINICAL:EXAMINATION:VIEW")]
    public async Task<ActionResult<List<OptometryQueuePatientDto>>> GetQueue(
        [FromQuery] Guid branchId,
        [FromQuery] bool includeCompletedToday = true)
    {
        var tenantId = GetTenantId();
        if (tenantId == null) return Unauthorized();

        try
        {
            var queue = await _optometryQueueService.GetQueueAsync(tenantId.Value, branchId, includeCompletedToday);
            return Ok(queue);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error loading optometry queue for branch {BranchId}", branchId);
            return StatusCode(500, new { message = "Failed to load optometry queue" });
        }
    }

    [HttpGet("stats")]
    [RequirePermission("CLINICAL:EXAMINATION:VIEW")]
    public async Task<ActionResult<OptometryQueueStatsDto>> GetStats([FromQuery] Guid branchId)
    {
        var tenantId = GetTenantId();
        if (tenantId == null) return Unauthorized();

        try
        {
            var stats = await _optometryQueueService.GetStatsAsync(tenantId.Value, branchId);
            return Ok(stats);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error loading optometry stats for branch {BranchId}", branchId);
            return StatusCode(500, new { message = "Failed to load optometry statistics" });
        }
    }

    [HttpGet("patients/search")]
    [RequirePermission("CLINICAL:EXAMINATION:VIEW")]
    public async Task<ActionResult<List<OptometryPatientSearchRowDto>>> SearchPatients(
        [FromQuery] Guid branchId,
        [FromQuery] string q,
        [FromQuery] int limit = 20)
    {
        var tenantId = GetTenantId();
        if (tenantId == null) return Unauthorized();

        try
        {
            var results = await _optometryQueueService.SearchPatientsAsync(tenantId.Value, branchId, q, limit);
            return Ok(results);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error searching patients for optometry branch {BranchId}", branchId);
            return StatusCode(500, new { message = "Failed to search patients" });
        }
    }

    [HttpPost("open-exam")]
    [RequirePermission("CLINICAL:EXAMINATION:EDIT")]
    public async Task<ActionResult<OptometryQueuePatientDto>> OpenExam([FromBody] OptometryOpenExamRequestDto request)
    {
        var tenantId = GetTenantId();
        var userId = GetUserId();
        if (tenantId == null || userId == null) return Unauthorized();

        try
        {
            var result = await _visitService.OpenOptometryExamAsync(request, tenantId.Value, userId.Value);
            if (result == null)
            {
                return NotFound(new { message = "Patient not found" });
            }

            return Ok(result);
        }
        catch (InvalidOperationException ex)
        {
            return Conflict(new { message = ex.Message });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error opening optometry exam for patient {PatientId}", request.PatientId);
            return StatusCode(500, new { message = "Failed to open examination" });
        }
    }

    [HttpPost("call-next")]
    [RequirePermission("CLINICAL:EXAMINATION:EDIT")]
    public async Task<ActionResult<OptometryQueuePatientDto>> CallNext([FromBody] OptometryCallNextRequestDto request)
    {
        var tenantId = GetTenantId();
        var userId = GetUserId();
        if (tenantId == null || userId == null) return Unauthorized();

        try
        {
            var next = await _optometryQueueService.CallNextAsync(
                tenantId.Value,
                request.BranchId,
                userId.Value,
                request.RoomCode,
                request.OptometristName);

            if (next == null)
            {
                return NotFound(new { message = "No patients waiting in optometry queue" });
            }

            return Ok(next);
        }
        catch (InvalidOperationException ex)
        {
            return Conflict(new { message = ex.Message });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error calling next optometry patient");
            return StatusCode(500, new { message = "Failed to call next patient" });
        }
    }

    [HttpPost("{visitId:guid}/start")]
    [RequirePermission("CLINICAL:EXAMINATION:EDIT")]
    public async Task<ActionResult<OptometryQueuePatientDto>> Start(
        Guid visitId,
        [FromQuery] string? roomCode = null)
    {
        var tenantId = GetTenantId();
        var userId = GetUserId();
        if (tenantId == null || userId == null) return Unauthorized();

        try
        {
            var result = await _optometryQueueService.StartAsync(visitId, tenantId.Value, userId.Value, roomCode);
            if (result == null) return NotFound(new { message = "Visit not found or not at optometrist station" });
            return Ok(result);
        }
        catch (InvalidOperationException ex)
        {
            return Conflict(new { message = ex.Message });
        }
    }

    [HttpPost("{visitId:guid}/complete")]
    [RequirePermission("CLINICAL:EXAMINATION:EDIT")]
    public async Task<ActionResult<OptometryQueuePatientDto>> Complete(
        Guid visitId,
        [FromBody] OptometryCompleteRequestDto? request = null)
    {
        var tenantId = GetTenantId();
        var userId = GetUserId();
        if (tenantId == null || userId == null) return Unauthorized();

        var result = await _optometryQueueService.CompleteAsync(visitId, tenantId.Value, userId.Value, request);
        if (result == null) return NotFound(new { message = "Visit not found" });
        return Ok(result);
    }

    [HttpPost("{visitId:guid}/skip")]
    [RequirePermission("CLINICAL:EXAMINATION:EDIT")]
    public async Task<ActionResult<OptometryQueuePatientDto>> Skip(
        Guid visitId,
        [FromBody] OptometrySkipRequestDto request)
    {
        var tenantId = GetTenantId();
        var userId = GetUserId();
        if (tenantId == null || userId == null) return Unauthorized();

        var result = await _optometryQueueService.SkipAsync(visitId, tenantId.Value, userId.Value, request.Reason);
        if (result == null) return NotFound(new { message = "Visit not found" });
        return Ok(result);
    }

    [HttpPost("{visitId:guid}/refer")]
    [RequirePermission("CLINICAL:EXAMINATION:EDIT")]
    public async Task<ActionResult<OptometryQueuePatientDto>> Refer(
        Guid visitId,
        [FromBody] OptometrySkipRequestDto request)
    {
        var tenantId = GetTenantId();
        var userId = GetUserId();
        if (tenantId == null || userId == null) return Unauthorized();

        var result = await _optometryQueueService.ReferAsync(visitId, tenantId.Value, userId.Value, request.Reason);
        if (result == null) return NotFound(new { message = "Visit not found" });
        return Ok(result);
    }

    [HttpGet("journey/{visitId:guid}")]
    [RequirePermission("CLINICAL:EXAMINATION:VIEW")]
    public async Task<ActionResult<List<VisitJourneyEventDto>>> GetJourney(Guid visitId)
    {
        var tenantId = GetTenantId();
        if (tenantId == null) return Unauthorized();

        var journey = await _optometryQueueService.GetJourneyAsync(visitId, tenantId.Value);
        return Ok(journey);
    }
}
