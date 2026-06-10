using System.Security.Claims;
using AuthService.Authorization;
using AuthService.DTOs.Optometry;
using AuthService.Services.Interfaces;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace AuthService.Controllers;

[ApiController]
[Route("api/visits/{visitId:guid}/optometry-segments")]
[Authorize]
public class OptometrySegmentExamsController : ControllerBase
{
    private readonly IOptometrySegmentExamService _segmentService;
    private readonly ILogger<OptometrySegmentExamsController> _logger;

    public OptometrySegmentExamsController(
        IOptometrySegmentExamService segmentService,
        ILogger<OptometrySegmentExamsController> logger)
    {
        _segmentService = segmentService;
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
    public async Task<ActionResult<IReadOnlyList<OptometrySegmentExamDto>>> GetAll(Guid visitId)
    {
        var tenantId = GetTenantId();
        if (tenantId == null) return Unauthorized();
        var list = await _segmentService.GetByVisitAsync(visitId, tenantId.Value);
        return Ok(list);
    }

    [HttpGet("{segmentKey}")]
    [RequirePermission("CLINICAL:EXAMINATION:VIEW")]
    public async Task<ActionResult<OptometrySegmentExamDto>> GetSegment(Guid visitId, string segmentKey)
    {
        var tenantId = GetTenantId();
        if (tenantId == null) return Unauthorized();
        var row = await _segmentService.GetSegmentAsync(visitId, segmentKey, tenantId.Value);
        if (row == null) return NotFound();
        return Ok(row);
    }

    [HttpPut("{segmentKey}")]
    [RequirePermission("CLINICAL:EXAMINATION:EDIT")]
    public async Task<ActionResult<OptometrySegmentExamDto>> UpsertSegment(
        Guid visitId,
        string segmentKey,
        [FromBody] SaveOptometrySegmentExamRequest request)
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
            var saved = await _segmentService.UpsertSegmentAsync(
                visitId,
                segmentKey,
                tenantId.Value,
                request.PatientId,
                userId.Value,
                request.Data);

            return Ok(saved);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to save optometry segment {Segment} for visit {VisitId}", segmentKey, visitId);
            return StatusCode(500, "Failed to save segment examination data");
        }
    }
}
