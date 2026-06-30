using AuthService.Context;
using AuthService.Models.Domain.Dtos;
using Microsoft.EntityFrameworkCore;

namespace AuthService.Services;

public interface IPatientSummaryService
{
    Task<PatientSummaryDto?> GetSummaryAsync(Guid tenantId, Guid branchId, Guid patientId);
    Task<List<PatientRecentVisitDto>> GetRecentVisitsAsync(Guid tenantId, Guid branchId, Guid patientId, int limit);
    Task<PatientDataQualityDto> GetDataQualityAsync(Guid tenantId, Guid patientId);
    Task<PatientVitalsStalenessDto> GetVitalsStalenessAsync(Guid tenantId, Guid patientId, int staleThresholdDays = 30);
}

public class PatientSummaryService : IPatientSummaryService
{
    private readonly AppDbContext _context;
    private readonly IPatientEngagementService _engagements;

    public PatientSummaryService(AppDbContext context, IPatientEngagementService engagements)
    {
        _context = context;
        _engagements = engagements;
    }

    public async Task<PatientSummaryDto?> GetSummaryAsync(Guid tenantId, Guid branchId, Guid patientId)
    {
        var patient = await _context.Patients.AsNoTracking()
            .FirstOrDefaultAsync(p => p.Id == patientId && p.TenantId == tenantId && p.DeletedAt == null);
        if (patient == null) return null;

        var bundles = await _engagements.LoadForPatientsAsync(tenantId, branchId, new[] { patientId });
        bundles.TryGetValue(patientId, out var bundle);

        var latestVitals = await _context.PatientVitalSigns.AsNoTracking()
            .Where(v => v.PatientId == patientId && v.TenantId == tenantId && v.DeletedAt == null)
            .OrderByDescending(v => v.MeasurementDate)
            .FirstOrDefaultAsync();

        var staleness = await GetVitalsStalenessAsync(tenantId, patientId);
        var dataQuality = await GetDataQualityAsync(tenantId, patientId);
        dataQuality.HasStaleVitals = staleness.IsStale;
        dataQuality.VitalsStaleDays = staleness.DaysSinceLast;

        PatientLatestVitalsDto? vitalsDto = null;
        if (latestVitals != null)
        {
            vitalsDto = new PatientLatestVitalsDto
            {
                RecordedAt = latestVitals.MeasurementDate,
                BloodPressureSystolic = latestVitals.BloodPressureSystolic,
                BloodPressureDiastolic = latestVitals.BloodPressureDiastolic,
                HeartRate = latestVitals.HeartRate,
                Temperature = latestVitals.Temperature,
                OxygenSaturation = latestVitals.OxygenSaturation,
                WeightKg = latestVitals.WeightKg,
                HeightCm = latestVitals.HeightCm,
                IsStale = staleness.IsStale,
            };
        }

        var latestDraft = await _context.ExaminationDrafts.AsNoTracking()
            .Where(d => d.PatientId == patientId && d.TenantId == tenantId)
            .OrderByDescending(d => d.UpdatedAt)
            .FirstOrDefaultAsync();

        var eyeVitals = PatientOphthalmologyVitalsParser.ParseFromDraftJson(latestDraft?.Data);
        if (eyeVitals != null)
        {
            vitalsDto ??= new PatientLatestVitalsDto { IsStale = staleness.IsStale };
            vitalsDto.VisualAcuityOd = eyeVitals.VisualAcuityOd;
            vitalsDto.VisualAcuityOs = eyeVitals.VisualAcuityOs;
            vitalsDto.IopOd = eyeVitals.IopOd;
            vitalsDto.IopOs = eyeVitals.IopOs;
            if (vitalsDto.RecordedAt == null && latestDraft != null)
                vitalsDto.RecordedAt = latestDraft.UpdatedAt;
        }

        return new PatientSummaryDto
        {
            Id = patient.Id,
            FirstName = patient.FirstName,
            LastName = patient.LastName,
            Mrn = patient.MedicalRecordNumber,
            DateOfBirth = patient.DateOfBirth,
            Gender = patient.Gender,
            Phone = patient.ContactNumber,
            Email = patient.Email,
            PhotoThumbnailUrl = patient.PhotoThumbnailUrl,
            BloodGroup = patient.BloodGroup,
            Allergies = patient.Allergies ?? patient.KnownAllergiesDetails,
            EmergencyContactName = patient.EmergencyContactName,
            EmergencyContactPhone = patient.EmergencyContactPhone,
            EmergencyContactRelationship = patient.EmergencyContactRelationship,
            InsuranceProvider = patient.InsuranceProvider,
            InsurancePolicyNumber = patient.InsurancePolicyNumber,
            ClinicalAcuity = bundle?.ClinicalAcuity ?? "low",
            ActiveEngagements = bundle?.Engagements ?? new List<PatientActiveEngagementDto>(),
            CareProgramCodes = bundle?.CareProgramCodes ?? new List<string>(),
            ReasonForVisit = bundle?.ReasonForVisit,
            ScheduledAt = bundle?.ScheduledAt,
            AssignedVisitId = bundle?.PrimaryOpenVisitId,
            AssignedProviderName = bundle?.AssignedProviderName,
            AssignedProviderRole = bundle?.AssignedProviderRole,
            CurrentStation = bundle?.CurrentStation,
            IpAdmission = bundle?.IpAdmission,
            LatestVitals = vitalsDto,
            DataQuality = dataQuality
        };
    }

    public async Task<List<PatientRecentVisitDto>> GetRecentVisitsAsync(
        Guid tenantId, Guid branchId, Guid patientId, int limit)
    {
        limit = Math.Clamp(limit, 1, 20);
        return await _context.Visits.AsNoTracking()
            .Where(v => v.TenantId == tenantId && v.BranchId == branchId && v.PatientId == patientId && v.DeletedAt == null)
            .OrderByDescending(v => v.CheckedInAt ?? v.CreatedAt)
            .Take(limit)
            .Select(v => new PatientRecentVisitDto
            {
                Id = v.Id,
                CheckedInAt = v.CheckedInAt ?? v.CreatedAt,
                Status = v.Status,
                VisitType = v.VisitType,
                CurrentStation = v.CurrentStation,
                TokenNumber = v.TokenNumber
            })
            .ToListAsync();
    }

    public async Task<PatientDataQualityDto> GetDataQualityAsync(Guid tenantId, Guid patientId)
    {
        var patient = await _context.Patients.AsNoTracking()
            .FirstOrDefaultAsync(p => p.Id == patientId && p.TenantId == tenantId && p.DeletedAt == null);

        var issues = new List<string>();
        if (patient == null)
            return new PatientDataQualityDto { IsIncomplete = true, Issues = new List<string> { "Patient not found" } };

        if (string.IsNullOrWhiteSpace(patient.ContactNumber))
            issues.Add("Missing phone number");
        if (string.IsNullOrWhiteSpace(patient.EmergencyContactName) || string.IsNullOrWhiteSpace(patient.EmergencyContactPhone))
            issues.Add("Incomplete emergency contact");
        if (string.IsNullOrWhiteSpace(patient.Allergies) && string.IsNullOrWhiteSpace(patient.KnownAllergiesDetails))
            issues.Add("Allergies not documented (NKDA not confirmed)");

        return new PatientDataQualityDto
        {
            IsIncomplete = issues.Count > 0,
            Issues = issues
        };
    }

    public async Task<PatientVitalsStalenessDto> GetVitalsStalenessAsync(
        Guid tenantId, Guid patientId, int staleThresholdDays = 30)
    {
        var latest = await _context.PatientVitalSigns.AsNoTracking()
            .Where(v => v.PatientId == patientId && v.TenantId == tenantId && v.DeletedAt == null)
            .OrderByDescending(v => v.MeasurementDate)
            .Select(v => v.MeasurementDate)
            .FirstOrDefaultAsync();

        if (latest == default)
        {
            return new PatientVitalsStalenessDto
            {
                HasVitals = false,
                IsStale = true,
                StaleThresholdDays = staleThresholdDays
            };
        }

        var days = (int)(DateTime.UtcNow - latest).TotalDays;
        return new PatientVitalsStalenessDto
        {
            HasVitals = true,
            IsStale = days > staleThresholdDays,
            LastRecordedAt = latest,
            DaysSinceLast = days,
            StaleThresholdDays = staleThresholdDays
        };
    }
}
