using Microsoft.EntityFrameworkCore;
using IpManagementService.Data;
using IpManagementService.Models.Domain;
using IpManagementService.Models.Dtos;

namespace IpManagementService.Services;

public class VitalSignService
{
    private readonly IpManagementDbContext _db;
    private readonly WardChecklistAutoSyncService _wardSync;
    private readonly JourneyMutationGuardService _mutationGuard;

    public VitalSignService(
        IpManagementDbContext db,
        WardChecklistAutoSyncService wardSync,
        JourneyMutationGuardService mutationGuard)
    {
        _db            = db;
        _wardSync      = wardSync;
        _mutationGuard = mutationGuard;
    }

    // ── Vital Signs ────────────────────────────────────────────────────────────

    public async Task<List<VitalSignDto>> GetVitalsAsync(Guid journeyId, Guid tenantId)
    {
        return await _db.VitalSigns
            .Where(v => v.JourneyId == journeyId && v.TenantId == tenantId
                        && v.DeletedAt == null && v.Context == null)
            .OrderByDescending(v => v.RecordedAt)
            .Select(v => new VitalSignDto(
                v.Id, v.JourneyId, v.RecordedAt,
                v.Temperature, v.BloodPressureSystolic, v.BloodPressureDiastolic,
                v.PulseRate, v.RespiratoryRate, v.OxygenSaturation,
                v.Weight, v.Height, v.Notes, null,
                v.RecordedByUserId, v.CreatedAt))
            .ToListAsync();
    }

    public async Task<VitalSignDto> AddVitalAsync(
        Guid journeyId, Guid tenantId, Guid userId, AddVitalSignRequest req)
    {
        await _mutationGuard.EnsureMutableAsync(journeyId, tenantId);
        var vital = new VitalSign
        {
            Id                      = Guid.NewGuid(),
            TenantId                = tenantId,
            JourneyId               = journeyId,
            RecordedAt              = req.RecordedAt ?? DateTime.UtcNow,
            Temperature             = req.Temperature,
            BloodPressureSystolic   = req.BloodPressureSystolic,
            BloodPressureDiastolic  = req.BloodPressureDiastolic,
            PulseRate               = req.PulseRate,
            RespiratoryRate         = req.RespiratoryRate,
            OxygenSaturation        = req.OxygenSaturation,
            Weight                  = req.Weight,
            Height                  = req.Height,
            Notes                   = req.Notes,
            RecordedByUserId        = userId,
            CreatedAt               = DateTime.UtcNow,
            UpdatedAt               = DateTime.UtcNow,
            Status                  = "active",
        };
        _db.VitalSigns.Add(vital);
        await _db.SaveChangesAsync();

        await _wardSync.SyncVitalsCheckedAsync(journeyId, tenantId, userId);

        return new VitalSignDto(
            vital.Id, vital.JourneyId, vital.RecordedAt,
            vital.Temperature, vital.BloodPressureSystolic, vital.BloodPressureDiastolic,
            vital.PulseRate, vital.RespiratoryRate, vital.OxygenSaturation,
            vital.Weight, vital.Height, vital.Notes, null,
            vital.RecordedByUserId, vital.CreatedAt);
    }

    // ── Nurse Records ──────────────────────────────────────────────────────────

    public async Task<List<NurseRecordDto>> GetNurseRecordsAsync(Guid journeyId, Guid tenantId)
    {
        return await _db.NurseRecords
            .Where(r => r.JourneyId == journeyId && r.TenantId == tenantId && r.DeletedAt == null)
            .OrderByDescending(r => r.RecordedAt)
            .Select(r => new NurseRecordDto(
                r.Id, r.JourneyId, r.RecordedAt,
                r.ShiftType, r.NursingNotes, r.MedicationsGiven,
                r.IntakeOutputNotes, r.PainScore, r.AlertnessLevel,
                r.RecordedByUserId, r.CreatedAt))
            .ToListAsync();
    }

    public async Task<NurseRecordDto> AddNurseRecordAsync(
        Guid journeyId, Guid tenantId, Guid userId, AddNurseRecordRequest req)
    {
        await _mutationGuard.EnsureMutableAsync(journeyId, tenantId);
        var record = new NurseRecord
        {
            Id                 = Guid.NewGuid(),
            TenantId           = tenantId,
            JourneyId          = journeyId,
            RecordedAt         = req.RecordedAt ?? DateTime.UtcNow,
            ShiftType          = req.ShiftType,
            NursingNotes       = req.NursingNotes,
            MedicationsGiven   = req.MedicationsGiven,
            IntakeOutputNotes  = req.IntakeOutputNotes,
            PainScore          = req.PainScore,
            AlertnessLevel     = req.AlertnessLevel,
            RecordedByUserId   = userId,
            CreatedAt          = DateTime.UtcNow,
            UpdatedAt          = DateTime.UtcNow,
            Status             = "active",
        };
        _db.NurseRecords.Add(record);
        await _db.SaveChangesAsync();

        return new NurseRecordDto(
            record.Id, record.JourneyId, record.RecordedAt,
            record.ShiftType, record.NursingNotes, record.MedicationsGiven,
            record.IntakeOutputNotes, record.PainScore, record.AlertnessLevel,
            record.RecordedByUserId, record.CreatedAt);
    }

    // ── Update ─────────────────────────────────────────────────────────────────

    public async Task<VitalSignDto> UpdateVitalAsync(
        Guid journeyId, Guid vitalId, Guid tenantId, UpdateVitalSignRequest req)
    {
        await _mutationGuard.EnsureMutableAsync(journeyId, tenantId);
        var vital = await _db.VitalSigns
            .FirstOrDefaultAsync(v => v.Id == vitalId && v.JourneyId == journeyId
                                      && v.TenantId == tenantId && v.DeletedAt == null)
            ?? throw new KeyNotFoundException($"VitalSign {vitalId} not found.");

        if (req.Temperature            != null) vital.Temperature            = req.Temperature;
        if (req.BloodPressureSystolic  != null) vital.BloodPressureSystolic  = req.BloodPressureSystolic;
        if (req.BloodPressureDiastolic != null) vital.BloodPressureDiastolic = req.BloodPressureDiastolic;
        if (req.PulseRate              != null) vital.PulseRate              = req.PulseRate;
        if (req.RespiratoryRate        != null) vital.RespiratoryRate        = req.RespiratoryRate;
        if (req.OxygenSaturation       != null) vital.OxygenSaturation       = req.OxygenSaturation;
        if (req.Weight                 != null) vital.Weight                 = req.Weight;
        if (req.Height                 != null) vital.Height                 = req.Height;
        if (req.Notes                  != null) vital.Notes                  = req.Notes;
        vital.UpdatedAt = DateTime.UtcNow;

        await _db.SaveChangesAsync();

        return new VitalSignDto(
            vital.Id, vital.JourneyId, vital.RecordedAt,
            vital.Temperature, vital.BloodPressureSystolic, vital.BloodPressureDiastolic,
            vital.PulseRate, vital.RespiratoryRate, vital.OxygenSaturation,
            vital.Weight, vital.Height, vital.Notes, null,
            vital.RecordedByUserId, vital.CreatedAt);
    }

    public async Task<NurseRecordDto> UpdateNurseRecordAsync(
        Guid journeyId, Guid recordId, Guid tenantId, UpdateNurseRecordRequest req)
    {
        await _mutationGuard.EnsureMutableAsync(journeyId, tenantId);
        var record = await _db.NurseRecords
            .FirstOrDefaultAsync(r => r.Id == recordId && r.JourneyId == journeyId
                                      && r.TenantId == tenantId && r.DeletedAt == null)
            ?? throw new KeyNotFoundException($"NurseRecord {recordId} not found.");

        if (req.ShiftType         != null) record.ShiftType         = req.ShiftType;
        if (req.NursingNotes      != null) record.NursingNotes      = req.NursingNotes;
        if (req.MedicationsGiven  != null) record.MedicationsGiven  = req.MedicationsGiven;
        if (req.IntakeOutputNotes != null) record.IntakeOutputNotes = req.IntakeOutputNotes;
        if (req.PainScore         != null) record.PainScore         = req.PainScore;
        if (req.AlertnessLevel    != null) record.AlertnessLevel    = req.AlertnessLevel;
        record.UpdatedAt = DateTime.UtcNow;

        await _db.SaveChangesAsync();

        return new NurseRecordDto(
            record.Id, record.JourneyId, record.RecordedAt,
            record.ShiftType, record.NursingNotes, record.MedicationsGiven,
            record.IntakeOutputNotes, record.PainScore, record.AlertnessLevel,
            record.RecordedByUserId, record.CreatedAt);
    }

    // ── Master Data ────────────────────────────────────────────────────────────

    public async Task<List<OphthMedicationDto>> GetOphthMedicationsAsync(Guid tenantId)
    {
        return await _db.OphthMedications
            .Where(m => m.TenantId == tenantId && m.Status == "active" && m.DeletedAt == null)
            .OrderBy(m => m.GenericName)
            .Select(m => new OphthMedicationDto(m.Id, m.GenericName, m.DrugClass, m.Route))
            .ToListAsync();
    }

    public async Task<List<IpIoTypeDto>> GetIoTypesAsync()
    {
        return await _db.IoTypes
            .Where(t => t.Status == "active")
            .OrderBy(t => t.DisplayOrder)
            .Select(t => new IpIoTypeDto(t.Id, t.Category, t.Label, t.Unit, t.DisplayOrder))
            .ToListAsync();
    }
}
