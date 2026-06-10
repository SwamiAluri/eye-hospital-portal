using AuthService.Authorization;
using AuthService.Context;
using AuthService.Models.Domain;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace AuthService.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class FrontdeskController : ControllerBase
{
    private readonly AppDbContext _context;
    private readonly ILogger<FrontdeskController> _logger;

    public FrontdeskController(AppDbContext context, ILogger<FrontdeskController> logger)
    {
        _context = context;
        _logger = logger;
    }

    public class FrontdeskBoardPayload
    {
        public Guid BranchId { get; set; }
        public string Date { get; set; } = null!;
        public FrontdeskBoardStats Stats { get; set; } = new();
        public List<FrontdeskBoardRow> Rows { get; set; } = new();
    }

    public class FrontdeskBoardStats
    {
        public int TodayAppointments { get; set; }
        public int CheckedIn { get; set; }
        public int ScheduledNotArrived { get; set; }
        public int Routed { get; set; }
    }

    public class FrontdeskBoardAppointment
    {
        public Guid Id { get; set; }
        public Guid PatientId { get; set; }
        public string? PatientName { get; set; }
        public Guid DoctorId { get; set; }
        public string? DoctorName { get; set; }
        public DateTime AppointmentDate { get; set; }
        public TimeSpan? StartTime { get; set; }
        public string AppointmentType { get; set; } = null!;
        public string Status { get; set; } = null!;
    }

    public class FrontdeskBoardVisit
    {
        public Guid Id { get; set; }
        public Guid AppointmentId { get; set; }
        public Guid PatientId { get; set; }
        public string PatientName { get; set; } = null!;
        public string PatientMrn { get; set; } = null!;
        public string TokenNumber { get; set; } = null!;
        public string Status { get; set; } = null!;
        public string? CurrentStation { get; set; }
        public DateTime? CheckedInAt { get; set; }
    }

    public class FrontdeskBoardRow
    {
        public FrontdeskBoardAppointment Appointment { get; set; } = null!;
        public FrontdeskBoardVisit? Visit { get; set; }
        public string State { get; set; } = null!; // ScheduledNotArrived | CheckedIn | Routed
    }

    public sealed class FrontdeskPatientSearchRow
    {
        public Guid Id { get; set; }
        public string PatientName { get; set; } = string.Empty;
        public string Mrn { get; set; } = string.Empty;
        public string? Phone { get; set; }
        public string? Gender { get; set; }
        public DateTime? DateOfBirth { get; set; }
    }

    [HttpGet("board")]
    // Reuse appointment.view for frontdesk board visibility.
    [RequirePermission("appointment.view")]
    public async Task<ActionResult<FrontdeskBoardPayload>> GetBoard([FromQuery] Guid branchId, [FromQuery] DateTime date)
    {
        try
        {
            var tenantIdClaim = User.FindFirst("TenantId")?.Value ?? User.FindFirst("tenant_id")?.Value;
            if (string.IsNullOrEmpty(tenantIdClaim) || !Guid.TryParse(tenantIdClaim, out var tenantId))
            {
                return Unauthorized("Tenant not found");
            }

            var start = date.Date;
            var end = start.AddDays(1);

            // Appointments are tenant-scoped; branch scoping is inferred from the visit/bill at check-in.
            // For frontdesk, we still filter by branch by joining through visits when present; otherwise
            // include scheduled appointments and let UI show them as not-arrived (frontdesk view is branch-local).
            var appts = await _context.Appointments
                .Include(a => a.Patient)
                .Include(a => a.Doctor)
                .Where(a => a.TenantId == tenantId && a.DeletedAt == null)
                .Where(a => a.AppointmentDate >= start && a.AppointmentDate < end)
                .OrderBy(a => a.StartTime)
                .ToListAsync();

            var visits = await _context.Visits
                .Include(v => v.Patient)
                .Where(v => v.TenantId == tenantId && v.BranchId == branchId && v.DeletedAt == null)
                .Where(v => v.Appointment != null && v.Appointment.AppointmentDate >= start && v.Appointment.AppointmentDate < end)
                .ToListAsync();

            var visitByAppointment = visits
                .GroupBy(v => v.AppointmentId)
                .ToDictionary(g => g.Key, g => g.OrderByDescending(x => x.CreatedAt).First());

            var rows = new List<FrontdeskBoardRow>();
            foreach (var a in appts)
            {
                visitByAppointment.TryGetValue(a.Id, out var v);
                var state = v == null
                    ? "ScheduledNotArrived"
                    : string.IsNullOrEmpty(v.CurrentStation) || v.CurrentStation == "reception"
                        ? "CheckedIn"
                        : "Routed";

                rows.Add(new FrontdeskBoardRow
                {
                    Appointment = new FrontdeskBoardAppointment
                    {
                        Id = a.Id,
                        PatientId = a.PatientId,
                        PatientName = a.Patient != null ? $"{a.Patient.FirstName} {a.Patient.LastName}".Trim() : null,
                        DoctorId = a.DoctorId,
                        DoctorName = a.Doctor != null ? $"{a.Doctor.FirstName} {a.Doctor.LastName}".Trim() : null,
                        AppointmentDate = a.AppointmentDate,
                        StartTime = a.StartTime,
                        AppointmentType = a.AppointmentType,
                        Status = a.Status,
                    },
                    Visit = v == null ? null : new FrontdeskBoardVisit
                    {
                        Id = v.Id,
                        AppointmentId = v.AppointmentId,
                        PatientId = v.PatientId,
                        PatientName = v.Patient != null ? $"{v.Patient.FirstName} {v.Patient.LastName}".Trim() : "",
                        PatientMrn = v.Patient?.MedicalRecordNumber ?? "",
                        TokenNumber = v.TokenNumber,
                        Status = v.Status,
                        CurrentStation = v.CurrentStation,
                        CheckedInAt = v.CheckedInAt,
                    },
                    State = state,
                });
            }

            // Filter out appointments that belong to other branches when already checked-in elsewhere.
            rows = rows.Where(r => r.Visit == null || visits.Any(v => v.AppointmentId == r.Appointment.Id)).ToList();

            var payload = new FrontdeskBoardPayload
            {
                BranchId = branchId,
                Date = start.ToString("yyyy-MM-dd"),
                Rows = rows,
            };

            payload.Stats.TodayAppointments = rows.Count;
            payload.Stats.ScheduledNotArrived = rows.Count(r => r.State == "ScheduledNotArrived");
            payload.Stats.CheckedIn = rows.Count(r => r.State == "CheckedIn");
            payload.Stats.Routed = rows.Count(r => r.State == "Routed");

            return Ok(payload);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error building frontdesk board for branch {BranchId}", branchId);
            return StatusCode(500, "Error building frontdesk board");
        }
    }

    [HttpGet("patients/search")]
    [RequirePermission("patient.view")]
    public async Task<ActionResult<List<FrontdeskPatientSearchRow>>> SearchPatients(
        [FromQuery] Guid branchId,
        [FromQuery] string q,
        [FromQuery] int limit = 20)
    {
        try
        {
            var tenantIdClaim = User.FindFirst("TenantId")?.Value ?? User.FindFirst("tenant_id")?.Value;
            if (string.IsNullOrEmpty(tenantIdClaim) || !Guid.TryParse(tenantIdClaim, out var tenantId))
            {
                return Unauthorized("Tenant not found");
            }

            var query = (q ?? string.Empty).Trim();
            if (query.Length < 2)
            {
                return Ok(new List<FrontdeskPatientSearchRow>());
            }

            limit = Math.Clamp(limit, 1, 50);
            var needle = query.ToLowerInvariant();

            var results = await _context.Patients
                .AsNoTracking()
                .Where(p => p.TenantId == tenantId && p.DeletedAt == null)
                // branch-local search, but allow patients without a branch assignment
                .Where(p => p.BranchId == null || p.BranchId == branchId)
                .Where(p =>
                    (p.FirstName + " " + p.LastName).ToLower().Contains(needle) ||
                    (p.MedicalRecordNumber ?? "").ToLower().Contains(needle) ||
                    (p.HealthId ?? "").ToLower().Contains(needle) ||
                    (p.ContactNumber ?? "").ToLower().Contains(needle))
                .OrderBy(p => p.FirstName)
                .ThenBy(p => p.LastName)
                .Take(limit)
                .Select(p => new FrontdeskPatientSearchRow
                {
                    Id = p.Id,
                    PatientName = (p.FirstName + " " + p.LastName).Trim(),
                    Mrn = p.MedicalRecordNumber ?? "",
                    Phone = p.ContactNumber,
                    Gender = p.Gender,
                    DateOfBirth = p.DateOfBirth
                })
                .ToListAsync();

            return Ok(results);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error searching patients for frontdesk branch {BranchId}", branchId);
            return StatusCode(500, "Error searching patients");
        }
    }
}

