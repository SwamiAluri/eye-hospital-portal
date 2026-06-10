using Microsoft.EntityFrameworkCore;
using IpManagementService.Data;
using IpManagementService.Models.Domain;
using IpManagementService.Models.Dtos;

namespace IpManagementService.Services;

/// <summary>Central pre-transition checklist gates (warn | block | override).</summary>
public class ChecklistGateService
{
    private readonly IpManagementDbContext      _db;
    private readonly SurgicalSafetyService      _surgicalSafety;
    private readonly AnaesthesiaMonitoringService _monitoring;
    private readonly PacAssessmentService       _pac;

    public ChecklistGateService(
        IpManagementDbContext db,
        SurgicalSafetyService surgicalSafety,
        AnaesthesiaMonitoringService monitoring,
        PacAssessmentService pac)
    {
        _db          = db;
        _surgicalSafety = surgicalSafety;
        _monitoring  = monitoring;
        _pac         = pac;
    }

    public async Task<ChecklistGateResultDto> EvaluateTransitionAsync(
        PatientJourney journey, string newState, Guid tenantId)
    {
        var key = $"{journey.ClinicalState}->{newState}";
        var warnings = new List<ChecklistGateWarningDto>();

        switch (key)
        {
            case $"{ClinicalState.Expected}->{ClinicalState.Admitted}":
                await AddAdmissionPhaseWarningsAsync(journey, tenantId, warnings);
                break;

            case $"{ClinicalState.Admitted}->{ClinicalState.ReadyForSurgery}":
                await AddPacWarningAsync(journey.Id, tenantId, warnings);
                break;

            case $"{ClinicalState.ReadyForSurgery}->{ClinicalState.SentToOT}":
                await AddMedLogWarningAsync(journey.Id, tenantId, warnings);
                break;

            case $"{ClinicalState.SurgeryCompleted}->{ClinicalState.PostOp}":
                await AddAfterSurgeryWarningAsync(journey.Id, tenantId, warnings);
                break;

            case $"{ClinicalState.PostOp}->{ClinicalState.ReadyForDischarge}":
                await AddPostOpWarningAsync(journey, tenantId, warnings);
                break;

            case $"{ClinicalState.ReadyForDischarge}->{ClinicalState.Discharged}":
                await AddDischargeWarningsAsync(journey.Id, tenantId, warnings);
                break;
        }

        var blocked = warnings.Any(w => w.Severity == "block");
        return new ChecklistGateResultDto(key, !blocked, warnings.Any(w => w.CanOverride), warnings);
    }

    public async Task<ChecklistGateResultDto> EvaluateAcceptInOtAsync(Guid journeyId, Guid tenantId)
    {
        var warnings = new List<ChecklistGateWarningDto>();
        var checklist = await _db.SurgicalSafetyChecklists
            .FirstOrDefaultAsync(c => c.PatientJourneyId == journeyId
                                      && c.TenantId == tenantId
                                      && c.DeletedAt == null);

        if (checklist is null || !SurgicalSafetyService.IsBeforeAnaesthesiaComplete(checklist))
        {
            warnings.Add(new ChecklistGateWarningDto(
                "before_anaesthesia_incomplete",
                "Before Anaesthesia checklist is incomplete.",
                "warn",
                false));
        }

        return new ChecklistGateResultDto("acceptInOT", true, false, warnings);
    }

    public async Task<ChecklistGateResultDto> EvaluateStartSurgeryAsync(
        Guid journeyId, Guid tenantId, bool supervisorOverrideApplied)
    {
        var journey   = await RequireJourneyAsync(journeyId, tenantId);
        var checklist = await _db.SurgicalSafetyChecklists
            .FirstOrDefaultAsync(c => c.PatientJourneyId == journeyId
                                      && c.TenantId == tenantId
                                      && c.DeletedAt == null);

        var warnings = new List<ChecklistGateWarningDto>();
        if (checklist is null || !SurgicalSafetyService.IsWhoComplete(checklist))
        {
            if (!supervisorOverrideApplied && !journey.WhoSupervisorOverrideApplied)
            {
                warnings.Add(new ChecklistGateWarningDto(
                    "who_timeout_incomplete",
                    "WHO timeout is incomplete (requires surgeon + nurse sign-off).",
                    "warn",
                    true));
            }
        }

        return new ChecklistGateResultDto("startSurgery", true, warnings.Count > 0, warnings);
    }

    private async Task AddAdmissionPhaseWarningsAsync(
        PatientJourney journey, Guid tenantId, List<ChecklistGateWarningDto> warnings)
    {
        if (journey.CounselingSessionId is Guid sessionId)
        {
            var p0 = await (
                from item in _db.PreOpSectionItems
                join cc in _db.CounsellorChecklistCompletions
                    on item.Id equals cc.ItemId into ccj
                from cc in ccj.DefaultIfEmpty()
                where item.FormCode == CounsellorChecklistService.OutpatientFormCode
                      && item.IsActive && item.DeletedAt == null
                      && (cc == null || (cc.CounselingSessionId == sessionId
                                         && cc.TenantId == tenantId
                                         && cc.DeletedAt == null))
                select new { item.Id, Done = cc != null && (cc.IsCompleted || cc.IsBypassed) }
            ).ToListAsync();

            if (p0.Count > 0)
            {
                var done = p0.Count(x => x.Done);
                if (done < p0.Count)
                {
                    warnings.Add(new ChecklistGateWarningDto(
                        "p0_outpatient_incomplete",
                        $"P0 Outpatient Safety: {done}/{p0.Count} complete.",
                        "warn",
                        false));
                }
            }
        }

        var clearance = await _db.PreOpClearances
            .FirstOrDefaultAsync(c => c.JourneyId == journey.Id
                                      && c.TenantId == tenantId
                                      && c.DeletedAt == null);
        if (clearance is null) return;

        var p1 = await CountPhaseAsync(
            clearance.Id,
            WardInvestigationChecklistService.InvestigationFormCode,
            tenantId);
        if (p1.total > 0 && p1.done < p1.total)
        {
            warnings.Add(new ChecklistGateWarningDto(
                "p1_investigation_incomplete",
                $"P1 Ward Investigation: {p1.done}/{p1.total} complete.",
                "warn",
                false));
        }

        var p2 = await CountPhaseAsync(clearance.Id, WardChecklistService.WardFormCode, tenantId);
        if (p2.total > 0 && p2.done < p2.total)
        {
            warnings.Add(new ChecklistGateWarningDto(
                "p2_ward_incomplete",
                $"P2 Ward Checklist: {p2.done}/{p2.total} complete.",
                "warn",
                false));
        }
    }

    private async Task<(int done, int total)> CountPhaseAsync(
        Guid clearanceId, string formCode, Guid tenantId)
    {
        var rows = await (
            from cp in _db.PreOpCompletions
            join item in _db.PreOpSectionItems on cp.ItemId equals item.Id
            where cp.ClearanceId == clearanceId
                  && cp.TenantId == tenantId
                  && cp.DeletedAt == null
                  && item.FormCode == formCode
                  && item.IsActive
            select cp.IsCompleted || cp.IsBypassed
        ).ToListAsync();

        return (rows.Count(x => x), rows.Count);
    }

    private async Task AddPacWarningAsync(
        Guid journeyId, Guid tenantId, List<ChecklistGateWarningDto> warnings)
    {
        if (!await _pac.IsCompletedAsync(journeyId, tenantId))
        {
            warnings.Add(new ChecklistGateWarningDto(
                "pac_incomplete",
                "PAC assessment is not completed. Ward item \"PAC done & documented\" may be incomplete.",
                "warn",
                false));
        }
    }

    private async Task AddAfterSurgeryWarningAsync(
        Guid journeyId, Guid tenantId, List<ChecklistGateWarningDto> warnings)
    {
        var checklist = await _db.SurgicalSafetyChecklists
            .FirstOrDefaultAsync(c => c.PatientJourneyId == journeyId
                                      && c.TenantId == tenantId
                                      && c.DeletedAt == null);

        if (checklist is null || !SurgicalSafetyService.IsAfterSurgeryComplete(checklist))
        {
            warnings.Add(new ChecklistGateWarningDto(
                "after_surgery_incomplete",
                "OT After Surgery checklist is incomplete.",
                "warn",
                false));
        }
    }

    private async Task AddMedLogWarningAsync(Guid journeyId, Guid tenantId, List<ChecklistGateWarningDto> warnings)
    {
        var rows = await _db.PreOpMedicationLogs
            .Where(m => m.PatientJourneyId == journeyId
                        && m.TenantId == tenantId
                        && m.DeletedAt == null)
            .ToListAsync();

        if (rows.Count == 0)
        {
            warnings.Add(new ChecklistGateWarningDto(
                "med_log_incomplete",
                "Pre-op medication log has no drugs recorded.",
                "warn",
                false));
            return;
        }

        var drugsWithoutDoses = rows
            .GroupBy(m => m.MedicineName, StringComparer.OrdinalIgnoreCase)
            .Where(g => g.All(d => d.AdministeredAt == null))
            .Select(g => g.Key)
            .ToList();

        if (drugsWithoutDoses.Count > 0)
        {
            warnings.Add(new ChecklistGateWarningDto(
                "med_log_doses_incomplete",
                $"Medication log: no doses administered for {string.Join(", ", drugsWithoutDoses)}.",
                "warn",
                false));
        }
    }

    private async Task AddPostOpWarningAsync(
        PatientJourney journey, Guid tenantId, List<ChecklistGateWarningDto> warnings)
    {
        var isDayCare = string.Equals(journey.AdmissionType, "DayCare", StringComparison.OrdinalIgnoreCase);

        var clearance = await _db.PreOpClearances
            .FirstOrDefaultAsync(c => c.JourneyId == journey.Id
                                      && c.TenantId == tenantId
                                      && c.DeletedAt == null);
        if (clearance is null) return;

        var formCodes = new[]
        {
            WardPostOpChecklistService.WardPostOpFormCode,
            WardPostOpChecklistService.WardPostOpSafetyFormCode,
        };

        var items = await (
            from cp in _db.PreOpCompletions
            join item in _db.PreOpSectionItems on cp.ItemId equals item.Id
            where cp.ClearanceId == clearance.Id
                  && cp.DeletedAt == null
                  && formCodes.Contains(item.FormCode)
            select new { cp, item }
        ).ToListAsync();

        if (isDayCare)
        {
            var anyIncomplete = items.Any(x => !x.cp.IsCompleted && !x.cp.IsBypassed);
            if (anyIncomplete)
            {
                warnings.Add(new ChecklistGateWarningDto(
                    "ward_postop_incomplete_daycare",
                    "Day-care: post-op items are optional but some remain unchecked.",
                    "warn",
                    false));
            }
            return;
        }

        var incompleteMandatory = items.Where(x =>
            x.item.IsMandatory
            && !x.cp.IsCompleted
            && !x.cp.IsBypassed).ToList();

        if (incompleteMandatory.Count > 0)
        {
            warnings.Add(new ChecklistGateWarningDto(
                "ward_postop_incomplete",
                $"Ward post-op checklist incomplete ({incompleteMandatory.Count} mandatory item(s)).",
                "warn",
                false));
        }
    }

    private async Task AddDischargeWarningsAsync(
        Guid journeyId, Guid tenantId, List<ChecklistGateWarningDto> warnings)
    {
        var clearanceOk = await _monitoring.IsDischargeClearanceCompleteAsync(journeyId, tenantId);
        if (!clearanceOk)
        {
            warnings.Add(new ChecklistGateWarningDto(
                "anaesthesia_clearance_missing",
                "Anaesthesia discharge clearance (Form 5) is not recorded.",
                "warn",
                true));
        }

        var clearance = await _db.PreOpClearances
            .FirstOrDefaultAsync(c => c.JourneyId == journeyId
                                      && c.TenantId == tenantId
                                      && c.DeletedAt == null);
        if (clearance is not null)
        {
            var issued = await (
                from cp in _db.PreOpCompletions
                join item in _db.PreOpSectionItems on cp.ItemId equals item.Id
                where cp.ClearanceId == clearance.Id
                      && cp.DeletedAt == null
                      && item.ItemKey == "discharge_summary_issued"
                select cp.IsCompleted || cp.IsBypassed
            ).FirstOrDefaultAsync();

            if (!issued)
            {
                warnings.Add(new ChecklistGateWarningDto(
                    "discharge_summary_not_confirmed",
                    "Nurse has not confirmed discharge summary issued (separate from finalize).",
                    "warn",
                    true));
            }
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
