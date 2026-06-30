using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using IpManagementService.Data;
using IpManagementService.Models.Domain;
using IpManagementService.Models.Dtos;

namespace IpManagementService.Services;

/// <summary>Form 3 — PAC assessment. Completing syncs ward checklist pac_done_documented.</summary>
public class PacAssessmentService
{
    public const string PacItemKey = "pac_done_documented";

    private static readonly JsonSerializerOptions JsonOpts = new()
    {
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
    };

    private readonly IpManagementDbContext           _db;
    private readonly PreOpClearanceService           _preOp;
    private readonly ChecklistPhaseStatusService       _phaseStatus;
    private readonly WardInvestigationChecklistService _investigation;
    private readonly WardChecklistAutoSyncService      _wardSync;
    private readonly JourneyMutationGuardService       _mutationGuard;

    public PacAssessmentService(
        IpManagementDbContext db,
        PreOpClearanceService preOp,
        ChecklistPhaseStatusService phaseStatus,
        WardInvestigationChecklistService investigation,
        WardChecklistAutoSyncService wardSync,
        JourneyMutationGuardService mutationGuard)
    {
        _db            = db;
        _preOp         = preOp;
        _phaseStatus   = phaseStatus;
        _investigation = investigation;
        _wardSync      = wardSync;
        _mutationGuard = mutationGuard;
    }

    public async Task<PacAssessmentDto> GetAssessmentAsync(Guid journeyId, Guid tenantId)
    {
        var journey = await RequireJourneyAsync(journeyId, tenantId);
        var row     = await GetOrInitAsync(journey, tenantId);
        return await BuildDtoAsync(journey, row);
    }

    public async Task<PacAssessmentDto> SaveAssessmentAsync(
        Guid journeyId, Guid tenantId, Guid userId, SavePacAssessmentRequest req)
    {
        await _mutationGuard.EnsureMutableAsync(journeyId, tenantId);
        var journey = await RequireJourneyAsync(journeyId, tenantId);
        var row     = await GetOrInitAsync(journey, tenantId);

        if (row.AssessmentStatus == "Completed")
            throw new InvalidOperationException("PAC assessment is completed and cannot be edited.");

        ApplySave(row, req);
        row.UpdatedAt = DateTime.UtcNow;
        await _db.SaveChangesAsync();

        return await BuildDtoAsync(journey, row);
    }

    public async Task<CompletePacAssessmentResultDto> CompleteAssessmentAsync(
        Guid journeyId, Guid tenantId, Guid userId)
    {
        await _mutationGuard.EnsureMutableAsync(journeyId, tenantId);
        var journey = await RequireJourneyAsync(journeyId, tenantId);
        var row     = await GetOrInitAsync(journey, tenantId);

        if (!IsComplete(row))
            throw new InvalidOperationException("PAC assessment is incomplete. Fill required sections before completing.");

        var now = DateTime.UtcNow;
        row.AssessmentStatus    = "Completed";
        row.CompletedAt         = now;
        row.CompletedByUserId   = userId;
        row.AssessedAt        ??= now;
        row.UpdatedAt           = now;

        await _db.SaveChangesAsync();
        await _wardSync.SyncItemAsync(
            journeyId, tenantId, userId, WardChecklistAutoSyncService.PacDoneKey, true,
            "Auto-synced from PAC assessment");
        await _phaseStatus.UpdateAsync(journeyId, tenantId, d => d["pac_completed"] = true);

        var assessment = await BuildDtoAsync(journey, row);
        var warnings   = await _investigation.GetUnverifiedCriticalWarningsAsync(journeyId, tenantId, userId);
        return new CompletePacAssessmentResultDto(assessment, warnings);
    }

    public async Task<bool> IsCompletedAsync(Guid journeyId, Guid tenantId)
    {
        var row = await _db.PacAssessments
            .FirstOrDefaultAsync(p => p.PatientJourneyId == journeyId
                                      && p.TenantId == tenantId
                                      && p.DeletedAt == null);
        return row?.AssessmentStatus == "Completed";
    }

    /// <summary>Read-only §1 investigation summary for the PAC panel.</summary>
    public Task<WardInvestigationSummaryDto> GetInvestigationSummaryAsync(
        Guid journeyId, Guid tenantId, Guid userId)
        => _investigation.GetSummaryAsync(journeyId, tenantId, userId);

    private static void ApplySave(PacAssessment row, SavePacAssessmentRequest req)
    {
        if (req.AssessedAt.HasValue) row.AssessedAt = req.AssessedAt;
        if (req.PreOpDiagnosis != null) row.PreOpDiagnosis = req.PreOpDiagnosis;
        if (req.Bp != null) row.Bp = req.Bp;
        if (req.Hr.HasValue) row.Hr = req.Hr;
        if (req.PhysicalStatusAsa.HasValue) row.PhysicalStatusAsa = req.PhysicalStatusAsa;
        // Investigations grid removed in Phase 7 — §1 ward investigation checklist is source of truth.
        if (req.Allergies != null) row.Allergies = req.Allergies;
        if (req.SystemicReview != null)
            row.SystemicReview = JsonSerializer.Serialize(req.SystemicReview, JsonOpts);
        if (req.PastAnaestheticHistory != null) row.PastAnaestheticHistory = req.PastAnaestheticHistory;
        if (req.AirwayExam != null)
            row.AirwayExam = JsonSerializer.Serialize(req.AirwayExam, JsonOpts);
        if (req.AnaesthesiaPlan != null) row.AnaesthesiaPlan = req.AnaesthesiaPlan;
        if (req.PeriOpExplained.HasValue) row.PeriOpExplained = req.PeriOpExplained.Value;
        if (req.ConsentType != null) row.ConsentType = req.ConsentType;
        if (req.CurrentMedications != null)
            row.CurrentMedications = JsonSerializer.Serialize(req.CurrentMedications, JsonOpts);
        if (req.PreOpConsultations != null) row.PreOpConsultations = req.PreOpConsultations;
        if (req.MedicationsAdvised != null) row.MedicationsAdvised = req.MedicationsAdvised;
        if (req.InvestigationsAdvised != null) row.InvestigationsAdvised = req.InvestigationsAdvised;
        if (req.CompletedByDesignation != null) row.CompletedByDesignation = req.CompletedByDesignation;
    }

    private static bool IsComplete(PacAssessment row)
        => !string.IsNullOrWhiteSpace(row.Bp)
           && row.Hr.HasValue
           && row.PhysicalStatusAsa is >= 1 and <= 5
           && !string.IsNullOrWhiteSpace(row.AnaesthesiaPlan)
           && !string.IsNullOrWhiteSpace(row.ConsentType);

    private async Task<PacAssessmentDto> BuildDtoAsync(PatientJourney journey, PacAssessment row)
    {
        IpPatient? patient = null;
        if (journey.PatientId != Guid.Empty)
        {
            patient = await _db.Patients
                .FirstOrDefaultAsync(p => p.Id == journey.PatientId && p.DeletedAt == null);
        }

        var patientName = patient is null ? null : $"{patient.FirstName} {patient.LastName}".Trim();

        return new PacAssessmentDto(
            journey.Id,
            patientName,
            journey.Uhid,
            journey.ProcedureName,
            journey.EyeOperated,
            row.AssessedAt,
            row.PreOpDiagnosis,
            row.Bp,
            row.Hr,
            row.PhysicalStatusAsa,
            DeserializeInvestigations(row.Investigations),
            row.Allergies,
            DeserializeSystemicReview(row.SystemicReview),
            row.PastAnaestheticHistory,
            DeserializeAirway(row.AirwayExam),
            row.AnaesthesiaPlan,
            row.PeriOpExplained,
            row.ConsentType,
            DeserializeMedications(row.CurrentMedications),
            row.PreOpConsultations,
            row.MedicationsAdvised,
            row.InvestigationsAdvised,
            row.CompletedByDesignation,
            row.AssessmentStatus,
            row.CompletedAt,
            IsComplete(row));
    }

    private async Task<PacAssessment> GetOrInitAsync(PatientJourney journey, Guid tenantId)
    {
        var existing = await _db.PacAssessments
            .FirstOrDefaultAsync(p => p.PatientJourneyId == journey.Id
                                      && p.TenantId == tenantId
                                      && p.DeletedAt == null);
        if (existing is not null) return existing;

        var now = DateTime.UtcNow;
        var row = new PacAssessment
        {
            Id               = Guid.NewGuid(),
            TenantId         = journey.TenantId,
            PatientJourneyId = journey.Id,
            PreOpDiagnosis   = journey.ProcedureName,
            CreatedAt        = now,
            UpdatedAt        = now,
        };

        _db.PacAssessments.Add(row);
        try
        {
            await _db.SaveChangesAsync();
        }
        catch (DbUpdateException)
        {
            _db.ChangeTracker.Clear();
            return await _db.PacAssessments
                       .FirstAsync(p => p.PatientJourneyId == journey.Id
                                         && p.TenantId == tenantId
                                         && p.DeletedAt == null);
        }

        return row;
    }

    private static PacInvestigationsDto DeserializeInvestigations(string json)
    {
        try
        {
            return JsonSerializer.Deserialize<PacInvestigationsDto>(json, JsonOpts)
                   ?? new PacInvestigationsDto(null, null, null, null, null, null, null, null, null, null, null);
        }
        catch
        {
            return new PacInvestigationsDto(null, null, null, null, null, null, null, null, null, null, null);
        }
    }

    private static PacSystemicReviewDto DeserializeSystemicReview(string json)
    {
        try
        {
            return JsonSerializer.Deserialize<PacSystemicReviewDto>(json, JsonOpts)
                   ?? new PacSystemicReviewDto(null, null, null, null, null, null, null);
        }
        catch
        {
            return new PacSystemicReviewDto(null, null, null, null, null, null, null);
        }
    }

    private static PacAirwayExamDto DeserializeAirway(string json)
    {
        try
        {
            return JsonSerializer.Deserialize<PacAirwayExamDto>(json, JsonOpts)
                   ?? new PacAirwayExamDto(null, null, null, null, null, null, null, null);
        }
        catch
        {
            return new PacAirwayExamDto(null, null, null, null, null, null, null, null);
        }
    }

    private static List<PacMedicationLineDto> DeserializeMedications(string json)
    {
        try
        {
            return JsonSerializer.Deserialize<List<PacMedicationLineDto>>(json, JsonOpts) ?? [];
        }
        catch
        {
            return [];
        }
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
