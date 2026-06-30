using AuthService.Authorization;
using AuthService.Context;
using AuthService.Models.Domain;
using AuthService.Models.Domain.Dtos;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace AuthService.Controllers;

[ApiController]
[Route("api/vitals")]
[Authorize]
public class VitalsController : ControllerBase
{
    private readonly AppDbContext _context;

    public VitalsController(AppDbContext context)
    {
        _context = context;
    }

    private bool TryGetTenantId(out Guid tenantId)
    {
        tenantId = Guid.Empty;
        var claim = User.FindFirst("TenantId")?.Value;
        return !string.IsNullOrEmpty(claim) && Guid.TryParse(claim, out tenantId);
    }

    [HttpGet("patient/{patientId}")]
    [RequirePermission("patient.view")]
    public async Task<ActionResult<List<VitalsHistoryRowDto>>> GetHistory(Guid patientId, [FromQuery] int limit = 10)
    {
        if (!TryGetTenantId(out var tenantId)) return Unauthorized();
        limit = Math.Clamp(limit, 1, 50);

        var rows = await _context.PatientVitalSigns
            .AsNoTracking()
            .Where(v => v.PatientId == patientId && v.TenantId == tenantId && v.DeletedAt == null)
            .OrderByDescending(v => v.MeasurementDate)
            .Take(limit)
            .Select(v => new VitalsHistoryRowDto
            {
                Id = v.Id,
                MeasuredAt = v.MeasurementDate,
                BloodPressureSystolic = v.BloodPressureSystolic,
                BloodPressureDiastolic = v.BloodPressureDiastolic,
                HeartRate = v.HeartRate,
                Temperature = v.Temperature,
                OxygenSaturation = v.OxygenSaturation,
                WeightKg = v.WeightKg,
                HeightCm = v.HeightCm,
                Bmi = v.Bmi,
                Notes = v.Notes
            })
            .ToListAsync();

        return Ok(rows);
    }

    [HttpPost("patient/{patientId}")]
    [RequirePermission("patient.edit")]
    public async Task<ActionResult<VitalsHistoryRowDto>> RecordVitals(
        Guid patientId, [FromBody] RecordVitalsRequest request)
    {
        if (!TryGetTenantId(out var tenantId)) return Unauthorized();

        var patientExists = await _context.Patients
            .AnyAsync(p => p.Id == patientId && p.TenantId == tenantId && p.DeletedAt == null);
        if (!patientExists) return NotFound();

        decimal? bmi = null;
        if (request.WeightKg.HasValue && request.HeightCm is > 0)
        {
            var heightM = request.HeightCm.Value / 100m;
            bmi = Math.Round(request.WeightKg.Value / (heightM * heightM), 1);
        }

        var now = DateTime.UtcNow;
        var entity = new PatientVitalSigns
        {
            Id = Guid.NewGuid(),
            TenantId = tenantId,
            PatientId = patientId,
            EncounterId = request.EncounterId,
            MeasurementDate = now,
            BloodPressureSystolic = request.BloodPressureSystolic,
            BloodPressureDiastolic = request.BloodPressureDiastolic,
            HeartRate = request.HeartRate,
            Temperature = request.Temperature,
            TemperatureUnit = request.TemperatureUnit ?? "C",
            RespiratoryRate = request.RespiratoryRate,
            OxygenSaturation = request.OxygenSaturation,
            WeightKg = request.WeightKg,
            HeightCm = request.HeightCm,
            Bmi = bmi,
            Notes = request.Notes,
            CreatedAt = now,
            UpdatedAt = now
        };

        _context.PatientVitalSigns.Add(entity);
        await _context.SaveChangesAsync();

        return Ok(new VitalsHistoryRowDto
        {
            Id = entity.Id,
            MeasuredAt = entity.MeasurementDate,
            BloodPressureSystolic = entity.BloodPressureSystolic,
            BloodPressureDiastolic = entity.BloodPressureDiastolic,
            HeartRate = entity.HeartRate,
            Temperature = entity.Temperature,
            OxygenSaturation = entity.OxygenSaturation,
            WeightKg = entity.WeightKg,
            HeightCm = entity.HeightCm,
            Bmi = entity.Bmi,
            Notes = entity.Notes
        });
    }
}
