using System.Security.Claims;
using AuthService.Authorization;
using AuthService.DTOs.Optometry;
using AuthService.Services.Interfaces;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace AuthService.Controllers;

[ApiController]
[Route("api/patients/{patientId:guid}/optometry-exams")]
[Authorize]
public class OptometryPatientHistoryController : ControllerBase
{
    private readonly IOptometryPatientHistoryService _historyService;
    private readonly ILogger<OptometryPatientHistoryController> _logger;

    public OptometryPatientHistoryController(
        IOptometryPatientHistoryService historyService,
        ILogger<OptometryPatientHistoryController> logger)
    {
        _historyService = historyService;
        _logger = logger;
    }

    private Guid? GetTenantId()
    {
        var claim = User.FindFirst("TenantId")?.Value;
        return Guid.TryParse(claim, out var id) ? id : null;
    }

    [HttpGet("history")]
    [RequirePermission("CLINICAL:EXAMINATION:VIEW")]
    public async Task<ActionResult<OptometryPatientHistoryResponse>> GetHistory(
        Guid patientId,
        [FromQuery] Guid? excludeVisitId = null,
        [FromQuery] Guid? excludeSameDayAsVisitId = null,
        [FromQuery] int limit = 10)
    {
        var tenantId = GetTenantId();
        if (tenantId == null) return Unauthorized();

        try
        {
            var result = await _historyService.GetHistoryAsync(
                patientId, tenantId.Value, excludeVisitId, excludeSameDayAsVisitId, limit);
            return Ok(result);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to load optometry history for patient {PatientId}", patientId);
            return StatusCode(500, "Failed to load optometry examination history");
        }
    }

    [HttpGet("latest-prior")]
    [RequirePermission("CLINICAL:EXAMINATION:VIEW")]
    public async Task<ActionResult<OptometryLatestPriorResponse>> GetLatestPrior(
        Guid patientId,
        [FromQuery] Guid? excludeVisitId = null,
        [FromQuery] Guid? excludeSameDayAsVisitId = null)
    {
        var tenantId = GetTenantId();
        if (tenantId == null) return Unauthorized();

        try
        {
            var result = await _historyService.GetLatestPriorAsync(
                patientId, tenantId.Value, excludeVisitId, excludeSameDayAsVisitId);
            return Ok(result);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to load latest prior optometry exam for patient {PatientId}", patientId);
            return StatusCode(500, "Failed to load latest prior examination");
        }
    }
}

[ApiController]
[Route("api/visits/{visitId:guid}/optometry-exams")]
[Authorize]
public class OptometryVisitExamController : ControllerBase
{
    private readonly IOptometryPatientHistoryService _historyService;
    private readonly ILogger<OptometryVisitExamController> _logger;

    public OptometryVisitExamController(
        IOptometryPatientHistoryService historyService,
        ILogger<OptometryVisitExamController> logger)
    {
        _historyService = historyService;
        _logger = logger;
    }

    private Guid? GetTenantId()
    {
        var claim = User.FindFirst("TenantId")?.Value;
        return Guid.TryParse(claim, out var id) ? id : null;
    }

    private Guid? GetUserId()
    {
        var claim = User.FindFirst("sub")?.Value ?? User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
        return Guid.TryParse(claim, out var id) ? id : null;
    }

    [HttpGet]
    [RequirePermission("CLINICAL:EXAMINATION:VIEW")]
    public async Task<ActionResult<OptometryVisitExamRecordDto>> GetVisitExam(Guid visitId)
    {
        var tenantId = GetTenantId();
        if (tenantId == null) return Unauthorized();

        var record = await _historyService.GetVisitExamAsync(visitId, tenantId.Value);
        if (record == null) return NotFound();
        return Ok(record);
    }

    [HttpPost("archive")]
    [RequirePermission("CLINICAL:EXAMINATION:EDIT")]
    public async Task<IActionResult> ArchiveVisitExam(
        Guid visitId,
        [FromBody] ArchiveOptometryVisitExamRequest request)
    {
        var tenantId = GetTenantId();
        var userId = GetUserId();
        if (tenantId == null || userId == null) return Unauthorized();

        if (request.PatientId == Guid.Empty)
        {
            return BadRequest("patientId is required");
        }

        try
        {
            await _historyService.ArchiveVisitExamAsync(
                visitId,
                tenantId.Value,
                request.PatientId,
                userId.Value,
                request.Snapshot);

            return Ok(new { archived = true, visitId });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to archive optometry exam for visit {VisitId}", visitId);
            return StatusCode(500, "Failed to archive examination");
        }
    }
}
