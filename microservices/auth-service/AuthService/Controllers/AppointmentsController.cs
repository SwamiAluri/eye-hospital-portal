using AuthService.Authorization;
using AuthService.Models.Domain;
using AuthService.Models.Domain.Dtos;
using AuthService.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace AuthService.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class AppointmentsController : ControllerBase
{
    private readonly IAppointmentService _appointmentService;
    private readonly ILogger<AppointmentsController> _logger;

    public AppointmentsController(
        IAppointmentService appointmentService,
        ILogger<AppointmentsController> logger)
    {
        _appointmentService = appointmentService;
        _logger = logger;
    }

    [HttpGet]
    [RequirePermission("appointment.view")]
    public async Task<ActionResult<PagedResult<AppointmentResponse>>> GetAllAppointments(
        [FromQuery] DateTime? fromDate,
        [FromQuery] DateTime? toDate,
        [FromQuery] string? status,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 10)
    {
        var tenantId = User.FindFirst("TenantId")?.Value;
        if (string.IsNullOrEmpty(tenantId)) return Unauthorized();

        var result = await _appointmentService.GetAllAppointmentsAsync(
            Guid.Parse(tenantId), fromDate, toDate, status, page, pageSize);
        
        return Ok(new PagedResult<AppointmentResponse>
        {
            Items = result.Items.Select(a => MapToResponse(a)),
            TotalCount = result.TotalCount,
            CurrentPage = result.CurrentPage,
            PageSize = result.PageSize
        });
    }

    [HttpGet("doctor/{doctorId}")]
    [RequirePermission("appointment.view")]
    public async Task<ActionResult<PagedResult<AppointmentResponse>>> GetDoctorAppointments(
        Guid doctorId,
        [FromQuery] DateTime? fromDate,
        [FromQuery] DateTime? toDate,
        [FromQuery] string? status,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 10)
    {
        var tenantId = User.FindFirst("TenantId")?.Value;
        if (string.IsNullOrEmpty(tenantId)) return Unauthorized();

        var result = await _appointmentService.GetDoctorAppointmentsAsync(
            doctorId, Guid.Parse(tenantId), fromDate, toDate, status, page, pageSize);
        
        return Ok(new PagedResult<AppointmentResponse>
        {
            Items = result.Items.Select(a => MapToResponse(a)),
            TotalCount = result.TotalCount,
            CurrentPage = result.CurrentPage,
            PageSize = result.PageSize
        });
    }

    [HttpGet("patient/{patientId}")]
    [RequirePermission("appointment.view")]
    public async Task<ActionResult<PagedResult<AppointmentResponse>>> GetPatientAppointments(
        Guid patientId,
        [FromQuery] DateTime? fromDate,
        [FromQuery] DateTime? toDate,
        [FromQuery] string? status,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 10)
    {
        var tenantId = User.FindFirst("TenantId")?.Value;
        if (string.IsNullOrEmpty(tenantId)) return Unauthorized();

        var result = await _appointmentService.GetPatientAppointmentsAsync(
            patientId, Guid.Parse(tenantId), fromDate, toDate, status, page, pageSize);
        
        return Ok(new PagedResult<AppointmentResponse>
        {
            Items = result.Items.Select(a => MapToResponse(a)),
            TotalCount = result.TotalCount,
            CurrentPage = result.CurrentPage,
            PageSize = result.PageSize
        });
    }

    /// <summary>
    /// Get patient's appointment for today (MODULE 4 - Check-in validation)
    /// </summary>
    [HttpGet("patient/{patientId}/today")]
    [RequirePermission("appointment.view")]
    public async Task<IActionResult> GetTodayAppointment(Guid patientId)
    {
        try
        {
            var tenantId = User.FindFirst("TenantId")?.Value;
            if (string.IsNullOrEmpty(tenantId)) return Unauthorized();

            var today = DateTime.UtcNow.Date;

            var appointments = await _appointmentService.GetPatientAppointmentsAsync(
                patientId, Guid.Parse(tenantId), today, today.AddDays(1), null, 1, 10);

            var todayAppointment = appointments.Items
                .Where(a => a.AppointmentDate.Date == today && a.Status != "Cancelled")
                .FirstOrDefault();

            if (todayAppointment == null)
            {
                return Ok(new
                {
                    hasAppointment = false,
                    message = "No appointment booked for today"
                });
            }

            return Ok(new
            {
                hasAppointment = true,
                appointment = new
                {
                    todayAppointment.Id,
                    AppointmentDate = todayAppointment.AppointmentDate,
                    StartTime = todayAppointment.StartTime,
                    EndTime = todayAppointment.EndTime,
                    todayAppointment.DoctorId,
                    todayAppointment.DepartmentId,
                    todayAppointment.AppointmentType,
                    todayAppointment.Status,
                    todayAppointment.PatientId
                }
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error getting today's appointment for patient {PatientId}", patientId);
            return StatusCode(500, new { message = "Error retrieving appointment", error = ex.Message });
        }
    }

    [HttpGet("{id}")]
    [RequirePermission("appointment.view")]
    public async Task<ActionResult<AppointmentResponse>> GetAppointment(Guid id)
    {
        var tenantId = User.FindFirst("TenantId")?.Value;
        if (string.IsNullOrEmpty(tenantId)) return Unauthorized();

        var appointment = await _appointmentService.GetAppointmentByIdAsync(id, Guid.Parse(tenantId));
        if (appointment == null) return NotFound();

        return Ok(MapToResponse(appointment));
    }

    [HttpPost]
    [RequirePermission("appointment.create")]
    public async Task<ActionResult<AppointmentResponse>> CreateAppointment([FromBody] CreateAppointmentRequest request)
    {
        var tenantId = User.FindFirst("TenantId")?.Value;
        if (string.IsNullOrEmpty(tenantId)) return Unauthorized();

        var appointment = new Appointment
        {
            TenantId = Guid.Parse(tenantId),
            PatientId = request.PatientId,
            DoctorId = request.DoctorId,
            AppointmentDate = request.AppointmentDate,
            AppointmentType = request.AppointmentType,
            ConsultationType = request.ConsultationType,
            DurationMinutes = request.DurationMinutes,
            Notes = request.Notes,
            Status = "Scheduled"
        };

        try
        {
            var createdAppointment = await _appointmentService.CreateAppointmentAsync(appointment);
            return CreatedAtAction(
                nameof(GetAppointment), 
                new { id = createdAppointment.Id }, 
                MapToResponse(createdAppointment));
        }
        catch (InvalidOperationException ex)
        {
            if (ex.Message.Contains("not available", StringComparison.OrdinalIgnoreCase))
                return Conflict(new { message = ex.Message });
            return BadRequest(new { message = ex.Message });
        }
    }

    [HttpPut("{id}")]
    [RequirePermission("appointment.update")]
    public async Task<ActionResult<AppointmentResponse>> UpdateAppointment(
        Guid id,
        [FromBody] UpdateAppointmentRequest request)
    {
        if (id != request.Id) return BadRequest();

        var tenantId = User.FindFirst("TenantId")?.Value;
        if (string.IsNullOrEmpty(tenantId)) return Unauthorized();

        var existingAppointment = await _appointmentService.GetAppointmentByIdAsync(id, Guid.Parse(tenantId));
        if (existingAppointment == null) return NotFound();

        existingAppointment.AppointmentDate = request.AppointmentDate;
        existingAppointment.AppointmentType = request.AppointmentType;
        existingAppointment.DurationMinutes = request.DurationMinutes;
        existingAppointment.Notes = request.Notes;

        try
        {
            var updatedAppointment = await _appointmentService.UpdateAppointmentAsync(existingAppointment);
            return Ok(MapToResponse(updatedAppointment!));
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
    }

    [HttpPost("{id}/cancel")]
    [RequirePermission("appointment.cancel")]
    public async Task<ActionResult<AppointmentResponse>> CancelAppointment(
        Guid id,
        [FromBody] CancelAppointmentRequest request)
    {
        var tenantId = User.FindFirst("TenantId")?.Value;
        if (string.IsNullOrEmpty(tenantId)) return Unauthorized();

        var cancelledAppointment = await _appointmentService.CancelAppointmentAsync(
            id, Guid.Parse(tenantId), request.CancellationReason);

        if (cancelledAppointment == null) return NotFound();

        return Ok(MapToResponse(cancelledAppointment));
    }

    [HttpDelete("{id}")]
    [RequirePermission("appointment.delete")]
    public async Task<ActionResult> DeleteAppointment(Guid id)
    {
        var tenantId = User.FindFirst("TenantId")?.Value;
        if (string.IsNullOrEmpty(tenantId)) return Unauthorized();

        var result = await _appointmentService.DeleteAppointmentAsync(id, Guid.Parse(tenantId));
        if (!result) return NotFound();

        return NoContent();
    }

    /// <summary>
    /// Get next available time slot for quick booking (MODULE 4 - Walk-in Quick Book)
    /// </summary>
    [HttpGet("next-available-slot")]
    [RequirePermission("appointment.view")]
    public async Task<ActionResult> GetNextAvailableSlot(
        [FromQuery] Guid? doctorId,
        [FromQuery] Guid? departmentId,
        [FromQuery] DateTime? date)
    {
        var tenantId = User.FindFirst("TenantId")?.Value;
        if (string.IsNullOrEmpty(tenantId)) return Unauthorized();

        try
        {
            var targetDate = date?.Date ?? DateTime.UtcNow.Date;
            
            // Get existing appointments for the date and doctor (if specified)
            var existingAppointments = doctorId.HasValue
                ? await _appointmentService.GetDoctorAppointmentsAsync(
                    doctorId.Value,
                    Guid.Parse(tenantId),
                    targetDate,
                    targetDate.AddDays(1),
                    null,
                    1,
                    1000)
                : await _appointmentService.GetAllAppointmentsAsync(
                    Guid.Parse(tenantId),
                    targetDate,
                    targetDate.AddDays(1),
                    null,
                    1,
                    1000);

            // Get booked time slots
            var bookedSlots = existingAppointments.Items
                .Where(a => a.AppointmentDate.Date == targetDate.Date && a.Status != "Cancelled")
                .Select(a => a.AppointmentDate.TimeOfDay)
                .OrderBy(t => t)
                .ToList();

            // Generate 15-minute slots from 9 AM to 5 PM (working hours)
            var workingHours = new List<TimeSpan>();
            for (int hour = 9; hour < 17; hour++) // 9 AM to 5 PM
            {
                for (int minute = 0; minute < 60; minute += 15)
                {
                    workingHours.Add(new TimeSpan(hour, minute, 0));
                }
            }

            // Find first available slot
            var availableSlot = workingHours
                .FirstOrDefault(slot => !bookedSlots.Any(booked => 
                    Math.Abs((booked - slot).TotalMinutes) < 15));

            if (availableSlot == default)
            {
                return NotFound(new 
                { 
                    success = false, 
                    message = "No available slots today. Try tomorrow or select time manually." 
                });
            }

            var slotDateTime = targetDate.Add(availableSlot);

            return Ok(new
            {
                success = true,
                date = targetDate,
                time = availableSlot.ToString(@"hh\:mm"),
                appointmentDateTime = slotDateTime,
                doctorId,
                departmentId,
                message = $"Next available slot: {availableSlot.ToString(@"hh\:mm tt")}"
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error finding next available slot");
            return StatusCode(500, new { success = false, message = "Failed to find available slot", error = ex.Message });
        }
    }

    /// <summary>
    /// Get appointment availability for inquiry panel (Inquiry Panel Module)
    /// </summary>
    [HttpGet("availability")]
    [RequirePermission("appointment.view")]
    public async Task<ActionResult> GetAppointmentAvailability(
        [FromQuery] DateTime? date,
        [FromQuery] string? department)
    {
        var tenantId = User.FindFirst("TenantId")?.Value;
        if (string.IsNullOrEmpty(tenantId)) return Unauthorized();

        try
        {
            var targetDate = date?.Date ?? DateTime.UtcNow.Date;
            
            // Get all appointments for the date
            var appointments = await _appointmentService.GetAllAppointmentsAsync(
                Guid.Parse(tenantId),
                targetDate,
                targetDate.AddDays(1),
                null, // all statuses
                1,
                1000);

            // Filter by department if specified
            var filteredAppointments = appointments.Items;
            if (!string.IsNullOrEmpty(department))
            {
                filteredAppointments = filteredAppointments
                    .Where(a => a.DepartmentId != null) // Assuming department filtering
                    .ToList();
            }

            // Generate appointment slots with availability
            var workingHours = new List<TimeSpan>();
            for (int hour = 9; hour < 17; hour++) // 9 AM to 5 PM
            {
                for (int minute = 0; minute < 60; minute += 30) // 30-minute slots
                {
                    workingHours.Add(new TimeSpan(hour, minute, 0));
                }
            }

            var slots = workingHours.Select(time =>
            {
                var slotDateTime = targetDate.Add(time);
                var bookedAppointment = filteredAppointments
                    .FirstOrDefault(a => Math.Abs((a.AppointmentDate - slotDateTime).TotalMinutes) < 15);

                return new
                {
                    date = targetDate.ToString("yyyy-MM-dd"),
                    time = time.ToString(@"hh\:mm"),
                    available = bookedAppointment == null,
                    doctorName = bookedAppointment != null && bookedAppointment.Doctor != null
                        ? $"Dr. {bookedAppointment.Doctor.FirstName} {bookedAppointment.Doctor.LastName}"
                        : "Available",
                    roomNumber = bookedAppointment?.DepartmentId?.ToString() ?? "TBD"
                };
            }).ToList();

            return Ok(slots);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error fetching appointment availability");
            return StatusCode(500, new { success = false, message = "Failed to fetch availability", error = ex.Message });
        }
    }

    private static AppointmentResponse MapToResponse(Appointment appointment)
    {
        return new AppointmentResponse
        {
            Id = appointment.Id,
            PatientId = appointment.PatientId,
            PatientName = appointment.Patient != null 
                ? $"{appointment.Patient.FirstName} {appointment.Patient.LastName}"
                : "Unknown Patient",
            DoctorId = appointment.DoctorId,
            DoctorName = appointment.Doctor != null
                ? $"Dr. {appointment.Doctor.FirstName} {appointment.Doctor.LastName}"
                : "Unknown Doctor",
            AppointmentDate = appointment.AppointmentDate,
            AppointmentType = appointment.AppointmentType,
            ConsultationType = appointment.ConsultationType,
            DurationMinutes = appointment.DurationMinutes,
            Status = appointment.Status,
            Notes = appointment.Notes,
            CancellationReason = appointment.CancellationReason,
            ReminderSent = appointment.ReminderSent,
            CreatedAt = appointment.CreatedAt,
            UpdatedAt = appointment.UpdatedAt
        };
    }
}