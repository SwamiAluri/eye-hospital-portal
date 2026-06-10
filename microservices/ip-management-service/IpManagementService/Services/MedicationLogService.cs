using Microsoft.EntityFrameworkCore;
using IpManagementService.Data;
using IpManagementService.Models.Domain;
using IpManagementService.Models.Dtos;

namespace IpManagementService.Services;

/// <summary>Form 4 — Pre-op medication log (multi-drug, multi-dose).</summary>
public class MedicationLogService
{
    public const int DefaultDoseCount = 6;

    private readonly IpManagementDbContext           _db;
    private readonly ChecklistPhaseStatusService     _phaseStatus;

    public MedicationLogService(IpManagementDbContext db, ChecklistPhaseStatusService phaseStatus)
    {
        _db          = db;
        _phaseStatus = phaseStatus;
    }

    public async Task<MedicationLogDto> GetMedicationLogAsync(Guid journeyId, Guid tenantId)
    {
        var journey = await RequireJourneyAsync(journeyId, tenantId);

        var rows = await _db.PreOpMedicationLogs
            .Where(m => m.PatientJourneyId == journeyId
                        && m.TenantId == tenantId
                        && m.DeletedAt == null)
            .OrderBy(m => m.DisplayOrder)
            .ThenBy(m => m.MedicineName)
            .ThenBy(m => m.DoseNumber)
            .ToListAsync();

        return BuildDto(journey, rows);
    }

    public async Task<MedicationLogDto> AddDrugAsync(
        Guid journeyId, Guid tenantId, Guid userId, AddMedicationDrugRequest req)
    {
        await RequireJourneyAsync(journeyId, tenantId);

        var name = req.MedicineName?.Trim();
        if (string.IsNullOrWhiteSpace(name))
            throw new ArgumentException("Medicine name is required.");

        var doseCount = req.DoseCount > 0 ? req.DoseCount : DefaultDoseCount;

        var exists = await _db.PreOpMedicationLogs.AnyAsync(m =>
            m.PatientJourneyId == journeyId
            && m.TenantId == tenantId
            && m.MedicineName == name
            && m.DeletedAt == null);
        if (exists)
            throw new InvalidOperationException($"Medication '{name}' is already on the log.");

        var maxOrder = await _db.PreOpMedicationLogs
            .Where(m => m.PatientJourneyId == journeyId && m.TenantId == tenantId && m.DeletedAt == null)
            .Select(m => (int?)m.DisplayOrder)
            .MaxAsync() ?? 0;

        var now = DateTime.UtcNow;
        for (var dose = 1; dose <= doseCount; dose++)
        {
            _db.PreOpMedicationLogs.Add(new PreOpMedicationLog
            {
                Id                = Guid.NewGuid(),
                TenantId          = tenantId,
                PatientJourneyId  = journeyId,
                MedicationId      = req.MedicationId,
                MedicineName      = name,
                DoseNumber        = dose,
                DisplayOrder      = maxOrder + 1,
                CreatedAt         = now,
                UpdatedAt         = now,
                Status            = "active",
            });
        }

        await _db.SaveChangesAsync();
        var added = await GetMedicationLogAsync(journeyId, tenantId);
        await SyncPhaseStatusAsync(journeyId, tenantId, added);
        return added;
    }

    public async Task<MedicationLogDto> SaveDoseAsync(
        Guid journeyId, Guid doseId, Guid tenantId, Guid userId, SaveMedicationDoseRequest req)
    {
        await RequireJourneyAsync(journeyId, tenantId);

        var row = await _db.PreOpMedicationLogs.FirstOrDefaultAsync(m =>
                      m.Id == doseId
                      && m.PatientJourneyId == journeyId
                      && m.TenantId == tenantId
                      && m.DeletedAt == null)
                  ?? throw new KeyNotFoundException($"Medication dose {doseId} not found.");

        if (req.ClearAdministration)
        {
            row.AdministeredAt       = null;
            row.AdministeredByUserId = null;
        }
        else if (req.AdministeredAt.HasValue)
        {
            row.AdministeredAt       = req.AdministeredAt.Value;
            row.AdministeredByUserId = userId;
        }

        if (req.Notes != null)
            row.Notes = req.Notes;

        row.UpdatedAt = DateTime.UtcNow;
        await _db.SaveChangesAsync();
        var dto = await GetMedicationLogAsync(journeyId, tenantId);
        await SyncPhaseStatusAsync(journeyId, tenantId, dto);
        return dto;
    }

    public async Task<MedicationLogDto> RemoveDrugAsync(
        Guid journeyId, Guid tenantId, string medicineName)
    {
        await RequireJourneyAsync(journeyId, tenantId);

        var name = medicineName.Trim();
        var rows = await _db.PreOpMedicationLogs
            .Where(m => m.PatientJourneyId == journeyId
                        && m.TenantId == tenantId
                        && m.MedicineName == name
                        && m.DeletedAt == null)
            .ToListAsync();

        if (rows.Count == 0)
            throw new KeyNotFoundException($"Medication '{name}' not found on log.");

        var now = DateTime.UtcNow;
        foreach (var row in rows)
        {
            row.DeletedAt = now;
            row.UpdatedAt = now;
        }

        await _db.SaveChangesAsync();
        var removed = await GetMedicationLogAsync(journeyId, tenantId);
        await SyncPhaseStatusAsync(journeyId, tenantId, removed);
        return removed;
    }

    public async Task<MedicationLogDto> UpdateMetaAsync(
        Guid journeyId, Guid tenantId, Guid userId, UpdateMedicationLogMetaRequest req)
    {
        var journey = await RequireJourneyAsync(journeyId, tenantId);

        if (req.AnaesthesiaType != null)
            journey.AnaesthesiaType = req.AnaesthesiaType;
        if (req.XylocaineSensitivityResult != null)
            journey.XylocaineSensitivityResult = req.XylocaineSensitivityResult;
        if (req.SurgeryNotes != null)
            journey.MedicationLogSurgeryNotes = req.SurgeryNotes;

        journey.UpdatedAt       = DateTime.UtcNow;
        journey.UpdatedByUserId = userId;
        await _db.SaveChangesAsync();

        return await GetMedicationLogAsync(journeyId, tenantId);
    }

    private static MedicationLogDto BuildDto(PatientJourney journey, List<PreOpMedicationLog> rows)
    {
        var drugs = rows
            .GroupBy(r => r.MedicineName)
            .OrderBy(g => g.Min(r => r.DisplayOrder))
            .ThenBy(g => g.Key)
            .Select(g =>
            {
                var first = g.First();
                return new MedicationDrugDto(
                    g.Key,
                    first.MedicationId,
                    first.DisplayOrder,
                    g.OrderBy(r => r.DoseNumber)
                     .Select(r => new MedicationDoseDto(
                         r.Id, r.DoseNumber, r.AdministeredAt,
                         r.AdministeredByUserId, r.Notes))
                     .ToList());
            })
            .ToList();

        return new MedicationLogDto(
            journey.Id,
            journey.AnaesthesiaType,
            journey.XylocaineSensitivityResult,
            journey.MedicationLogSurgeryNotes,
            journey.SentToOtAt,
            journey.ReceivedFromOtAt,
            journey.WardCheckoutAt,
            drugs);
    }

    private async Task SyncPhaseStatusAsync(Guid journeyId, Guid tenantId, MedicationLogDto dto)
    {
        if (dto.Drugs.Count == 0)
        {
            await _phaseStatus.UpdateAsync(journeyId, tenantId, d => d["med_log_complete"] = false);
            return;
        }

        var complete = dto.Drugs.All(drug =>
            drug.Doses.Any(d => d.AdministeredAt != null));
        await _phaseStatus.UpdateAsync(journeyId, tenantId, d => d["med_log_complete"] = complete);
    }

    private async Task<PatientJourney> RequireJourneyAsync(Guid journeyId, Guid tenantId)
    {
        return await _db.PatientJourneys
                   .FirstOrDefaultAsync(j => j.Id == journeyId
                                             && j.TenantId == tenantId
                                             && j.DeletedAt == null)
               ?? throw new KeyNotFoundException($"Journey {journeyId} not found.");
    }
}
