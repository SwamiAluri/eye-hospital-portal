using AuthService.Context;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace AuthService.Controllers;

/// <summary>
/// Internal appointment status for IP discharge follow-up lock.
/// Booking stays on <c>POST /api/Appointments</c> — this is a read of Auth SoT only.
/// </summary>
[ApiController]
[Route("api/internal/ip-appointments")]
public class InternalIpAppointmentController : ControllerBase
{
    private static readonly HashSet<string> CancelledStatuses = new(StringComparer.OrdinalIgnoreCase)
    {
        "Cancelled",
        "Deleted",
    };

    private readonly AppDbContext _db;
    private readonly IConfiguration _config;

    public InternalIpAppointmentController(
        AppDbContext db,
        IConfiguration config)
    {
        _db = db;
        _config = config;
    }

    [HttpGet("{id:guid}/status")]
    public async Task<IActionResult> GetStatus(Guid id, [FromQuery] Guid tenantId)
    {
        if (!IsAuthorized())
            return Unauthorized(new { error = "Invalid or missing internal API key." });
        if (tenantId == Guid.Empty)
            return BadRequest(new { error = "tenantId is required." });

        var row = await _db.Appointments.AsNoTracking()
            .FirstOrDefaultAsync(a => a.Id == id && a.TenantId == tenantId);

        if (row is null)
        {
            return Ok(new
            {
                exists = false,
                status = (string?)null,
                appointmentDate = (DateTime?)null,
                doctorId = (Guid?)null,
                patientId = (Guid?)null,
                cancelled = true,
            });
        }

        var cancelled = row.DeletedAt != null
                        || CancelledStatuses.Contains(row.Status ?? "");

        return Ok(new
        {
            exists = true,
            status = row.Status,
            appointmentDate = row.AppointmentDate,
            doctorId = row.DoctorId,
            patientId = row.PatientId,
            cancelled,
        });
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
