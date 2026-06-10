using System;
using System.Security.Claims;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Logging;
using AuthService.DTOs.Visit;
using AuthService.Services.Interfaces;

namespace AuthService.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class VisitsController : ControllerBase
{
    private readonly IVisitService _visitService;
    private readonly ILogger<VisitsController> _logger;

    public VisitsController(IVisitService visitService, ILogger<VisitsController> logger)
    {
        _visitService = visitService;
        _logger = logger;
    }

    private Guid GetUserId()
    {
        var userIdClaim = User.FindFirst(ClaimTypes.NameIdentifier)?.Value
            ?? User.FindFirst("sub")?.Value
            ?? User.FindFirst("id")?.Value;
        return Guid.TryParse(userIdClaim, out var userId) ? userId : Guid.Empty;
    }

    /// <summary>
    /// Get visit by ID
    /// </summary>
    [HttpGet("{id:guid}")]
    public async Task<IActionResult> GetById(Guid id)
    {
        var visit = await _visitService.GetByIdAsync(id);
        if (visit == null)
        {
            return NotFound(new { message = "Visit not found" });
        }
        return Ok(visit);
    }

    /// <summary>
    /// Get visit by appointment ID
    /// </summary>
    [HttpGet("by-appointment/{appointmentId:guid}")]
    public async Task<IActionResult> GetByAppointmentId(Guid appointmentId)
    {
        var visit = await _visitService.GetByAppointmentIdAsync(appointmentId);
        if (visit == null)
        {
            return NotFound(new { message = "No visit found for this appointment" });
        }
        return Ok(visit);
    }

    /// <summary>
    /// Get visits by patient ID
    /// </summary>
    [HttpGet("by-patient/{patientId:guid}")]
    public async Task<IActionResult> GetByPatientId(Guid patientId, [FromQuery] int page = 1, [FromQuery] int pageSize = 20)
    {
        var visits = await _visitService.GetByPatientIdAsync(patientId, page, pageSize);
        return Ok(visits);
    }

    /// <summary>
    /// Get visits by branch ID
    /// </summary>
    [HttpGet("by-branch/{branchId:guid}")]
    public async Task<IActionResult> GetByBranchId(
        Guid branchId,
        [FromQuery] DateTime? date = null,
        [FromQuery] string? status = null,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 50)
    {
        var visits = await _visitService.GetByBranchIdAsync(branchId, date, status, page, pageSize);
        return Ok(visits);
    }

    /// <summary>
    /// Get patient queue for a branch/station
    /// </summary>
    [HttpGet("queue/{branchId:guid}")]
    public async Task<IActionResult> GetQueue(
        Guid branchId,
        [FromQuery] string? station = null,
        [FromQuery] Guid? assignedTo = null)
    {
        var queue = await _visitService.GetQueueAsync(branchId, station, assignedTo);
        return Ok(queue);
    }

    /// <summary>
    /// Validate check-in requirements for an appointment
    /// </summary>
    [HttpGet("validate-checkin/{appointmentId:guid}")]
    public async Task<IActionResult> ValidateCheckIn(Guid appointmentId)
    {
        var validation = await _visitService.ValidateCheckInAsync(appointmentId);
        return Ok(validation);
    }

    /// <summary>
    /// Check-in a patient (creates Visit entity)
    /// </summary>
    [HttpPost("checkin")]
    [HttpPost("check-in")] // Alternate route for frontend compatibility
    public async Task<IActionResult> CheckIn([FromBody] CheckInRequestDto request)
    {
        try
        {
            var userId = GetUserId();
            var result = await _visitService.CheckInAsync(request, userId);

            if (!result.Success)
            {
                return BadRequest(new { message = result.Message, validation = result.Validation });
            }

            return Ok(result);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error during check-in for appointment {AppointmentId}", request.AppointmentId);
            return StatusCode(500, new { message = "Check-in failed", error = ex.Message });
        }
    }

    /// <summary>
    /// Send patient to another station/staff
    /// </summary>
    [HttpPost("send-to")]
    public async Task<IActionResult> SendTo([FromBody] SendToRequestDto request)
    {
        try
        {
            var userId = GetUserId();
            var visit = await _visitService.SendToAsync(request, userId);

            if (visit == null)
            {
                return NotFound(new { message = "Visit not found" });
            }

            return Ok(visit);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error sending visit {VisitId} to {Station}", request.VisitId, request.Station);
            return StatusCode(500, new { message = "Failed to route patient", error = ex.Message });
        }
    }

    /// <summary>
    /// Send appointment to station even if check-in hasn't happened yet.
    /// This ensures a Visit exists and then routes it.
    /// </summary>
    [HttpPost("send-to-appointment/{appointmentId:guid}")]
    public async Task<IActionResult> SendToAppointment(Guid appointmentId, [FromBody] SendToRequestDto request)
    {
        try
        {
            var userId = GetUserId();
            var visit = await _visitService.SendToByAppointmentAsync(appointmentId, request, userId);
            if (visit == null)
            {
                return NotFound(new { message = "Appointment/visit not found or branch not configured" });
            }
            return Ok(visit);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error sending appointment {AppointmentId} to {Station}", appointmentId, request.Station);
            return StatusCode(500, new { message = "Failed to route appointment", error = ex.Message });
        }
    }

    /// <summary>
    /// Assign visit to a specific staff member
    /// </summary>
    [HttpPost("{visitId:guid}/assign/{staffId:guid}")]
    public async Task<IActionResult> AssignToStaff(Guid visitId, Guid staffId)
    {
        try
        {
            var userId = GetUserId();
            var visit = await _visitService.AssignToStaffAsync(visitId, staffId, userId);

            if (visit == null)
            {
                return NotFound(new { message = "Visit not found" });
            }

            return Ok(visit);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error assigning visit {VisitId} to staff {StaffId}", visitId, staffId);
            return StatusCode(500, new { message = "Failed to assign patient", error = ex.Message });
        }
    }

    /// <summary>
    /// Complete a visit
    /// </summary>
    [HttpPost("complete")]
    public async Task<IActionResult> CompleteVisit([FromBody] CompleteVisitRequestDto request)
    {
        try
        {
            var userId = GetUserId();
            var visit = await _visitService.CompleteVisitAsync(request, userId);

            if (visit == null)
            {
                return NotFound(new { message = "Visit not found" });
            }

            return Ok(visit);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error completing visit {VisitId}", request.VisitId);
            return StatusCode(500, new { message = "Failed to complete visit", error = ex.Message });
        }
    }

    /// <summary>
    /// Get today's visit count for a branch
    /// </summary>
    [HttpGet("count/today/{branchId:guid}")]
    public async Task<IActionResult> GetTodayVisitCount(Guid branchId)
    {
        var count = await _visitService.GetTodayVisitCountAsync(branchId);
        return Ok(new { count });
    }

    /// <summary>
    /// Get waiting count for a branch/station
    /// </summary>
    [HttpGet("count/waiting/{branchId:guid}")]
    public async Task<IActionResult> GetWaitingCount(Guid branchId, [FromQuery] string? station = null)
    {
        var count = await _visitService.GetWaitingCountAsync(branchId, station);
        return Ok(new { count });
    }

    // Day 6: Token Display & Print (Jan 31, 2026)
    
    /// <summary>
    /// Get token information for a visit
    /// </summary>
    [HttpGet("{id:guid}/token")]
    public async Task<IActionResult> GetTokenInfo(Guid id)
    {
        try
        {
            var visit = await _visitService.GetByIdAsync(id);
            if (visit == null)
            {
                return NotFound(new { message = "Visit not found" });
            }

            return Ok(new
            {
                visitId = visit.Id,
                tokenNumber = visit.TokenNumber,
                tokenSequence = visit.TokenSequence,
                patientName = visit.PatientName,
                appointmentType = visit.VisitType,
                checkedInAt = visit.CheckedInAt,
                branchName = visit.BranchName,
                status = visit.Status,
                currentStation = visit.CurrentStation
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error retrieving token info for visit {VisitId}", id);
            return StatusCode(500, new { message = "Failed to retrieve token info", error = ex.Message });
        }
    }
}
