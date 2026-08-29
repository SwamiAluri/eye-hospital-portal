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
    private readonly WardInvestigationChecklistService _investigation;
    private readonly ICcmsAdmissionClient?      _ccms;
    private readonly IAuthBillingClient?        _billing;
    private readonly IAuthAppointmentStatusClient? _appointments;

    public ChecklistGateService(
        IpManagementDbContext db,
        SurgicalSafetyService surgicalSafety,
        AnaesthesiaMonitoringService monitoring,
        PacAssessmentService pac,
        WardInvestigationChecklistService investigation,
        ICcmsAdmissionClient? ccms = null,
        IAuthBillingClient? billing = null,
        IAuthAppointmentStatusClient? appointments = null)
    {
        _db          = db;
        _surgicalSafety = surgicalSafety;
        _monitoring  = monitoring;
        _pac         = pac;
        _investigation = investigation;
        _ccms        = ccms;
        _billing     = billing;
        _appointments = appointments;
    }

    public virtual async Task<ChecklistGateResultDto> EvaluateTransitionAsync(
        PatientJourney journey, string newState, Guid tenantId)
    {
        var key = $"{journey.ClinicalState}->{newState}";
        var warnings = new List<ChecklistGateWarningDto>();

        // Typed LAMA/Death/Transfer and clinical close from PostOp/Admitted skip ReadyForDischarge.
        // Money + follow-up still belong on any → Discharged, not only the routine edge.
        if (newState == ClinicalState.Discharged)
        {
            await AddDischargeWarningsAsync(journey, tenantId, warnings);
        }
        else switch (key)
        {
            case $"{ClinicalState.Expected}->{ClinicalState.Admitted}":
                await AddAdmissionPhaseWarningsAsync(journey, tenantId, warnings);
                break;

            case $"{ClinicalState.Admitted}->{ClinicalState.ReadyForSurgery}":
                await AddMarkReadyHardBlocksAsync(journey, tenantId, warnings);
                await AddMarkReadySoftWarningsAsync(journey, tenantId, warnings);
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
        // Financial: warn (never block) when an outstanding balance has not been
        // collected and Emergency FC has not been applied. Insurance pre-auth is a
        // separate hard gate (CcmsAdmissionClient); this covers self-pay & copay.
        decimal outstanding = journey.BalanceDue ?? 0;
        try
        {
            if (_billing is not null)
            {
                var billing = await _billing.GetSummaryAsync(journey.Id);
                outstanding = billing.PatientBalance > 0 ? billing.PatientBalance : billing.BalanceDue;
            }
        }
        catch { /* billing overlay optional on admit warn */ }

        if (outstanding > 0 && !journey.EmergencyFcApplied)
        {
            warnings.Add(new ChecklistGateWarningDto(
                "financial_balance_outstanding",
                $"Outstanding patient balance of \u20B9{outstanding:N0} not yet collected.",
                "warn",
                false));
        }

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
                        $"P1 Investigations: {p1.done}/{p1.total} complete.",
                        "warn",
                        false));
        }

        var p2 = await CountDeptClearanceAsync(clearance.Id, tenantId);
        if (p2.total > 0 && p2.done < p2.total)
        {
            warnings.Add(new ChecklistGateWarningDto(
                "p2_dept_clearance_incomplete",
                $"P2 Dept Clearance: {p2.done}/{p2.total} complete.",
                "warn",
                false));
        }

        // P3 Ward Safety (bedside) is intentionally NOT warned here: post-Option-B it holds
        // only true bedside nursing acts (check-in, dilatation, slit-lamp, marking, etc.)
        // which physically happen AFTER admission, and its former mirror rows duplicated the
        // P1/P2/PAC facts already warned above. Nurse prep is verified at the point of care
        // (Send-to-OT med-log gate + OT Surgical Safety Checklist).
    }

    private static readonly HashSet<string> DeptClearanceExcludedCategories = new(StringComparer.Ordinal)
    {
        "Lab Tests",
        "Diagnostic Imaging",
        "Investigations",
        "Vitals",
    };

    /// <summary>Matches frontend <c>computeDeptClearanceProgress</c> (P2 phase strip).</summary>
    private async Task<(int done, int total)> CountDeptClearanceAsync(
        Guid clearanceId, Guid tenantId)
    {
        var sectionClearances = await _db.PreOpSectionClearances
            .Where(s => s.ClearanceId == clearanceId && s.DeletedAt == null)
            .ToListAsync();

        var activeSections = sectionClearances
            .Where(s => s.Status != "NotRequested")
            .ToList();

        if (activeSections.Count > 0)
        {
            var confirmed = activeSections.Count(s => s.Status == "WardConfirmed");
            return (confirmed, activeSections.Count);
        }

        var deptItems = await (
            from cp in _db.PreOpCompletions
            join item in _db.PreOpSectionItems on cp.ItemId equals item.Id
            where cp.ClearanceId == clearanceId
                  && cp.TenantId == tenantId
                  && cp.DeletedAt == null
                  && item.IsActive
                  && item.FormCode != WardChecklistService.WardFormCode
                  && item.FormCode != WardInvestigationChecklistService.InvestigationFormCode
                  && !DeptClearanceExcludedCategories.Contains(item.Category)
            select new { item.IsBlocking, Done = cp.IsCompleted || cp.IsBypassed }
        ).ToListAsync();

        var pool = deptItems.Where(x => x.IsBlocking).ToList();
        var items = pool.Count > 0 ? pool : deptItems;
        return (items.Count(x => x.Done), items.Count);
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

    private async Task AddMarkReadyHardBlocksAsync(
        PatientJourney journey, Guid tenantId, List<ChecklistGateWarningDto> warnings)
    {
        var userId = journey.UpdatedByUserId ?? journey.CreatedByUserId ?? Guid.Empty;
        var checklist = await _investigation.GetChecklistAsync(journey.Id, tenantId, userId);
        if (checklist.UnverifiedCriticalKeys.Count > 0)
        {
            warnings.Add(new ChecklistGateWarningDto(
                "critical_labs_unverified",
                checklist.UnverifiedCriticalKeys.Count == 1
                    ? $"Critical lab not ward-verified: {checklist.UnverifiedCriticalKeys[0]}."
                    : $"{checklist.UnverifiedCriticalKeys.Count} critical labs are not ward-verified.",
                "block",
                false));
        }

        var clearance = await _db.PreOpClearances
            .FirstOrDefaultAsync(c => c.JourneyId == journey.Id
                                      && c.TenantId == tenantId
                                      && c.DeletedAt == null);
        if (clearance is not null)
        {
            if (await HasCompletionRowAsync(clearance.Id, tenantId, "surgery_consent_signed")
                && !await IsCompletionDoneAsync(clearance.Id, tenantId, "surgery_consent_signed"))
            {
                warnings.Add(new ChecklistGateWarningDto(
                    "surgical_consent_unsigned",
                    "Surgical consent must be signed with the consent PDF on file.",
                    "block",
                    false));
            }

            if (await HasCompletionRowAsync(clearance.Id, tenantId, "surgery_site_marked")
                && !await IsLateralityAttestedAsync(journey.EyeOperated, clearance.Id, tenantId))
            {
                warnings.Add(new ChecklistGateWarningDto(
                    "laterality_not_attested",
                    string.IsNullOrWhiteSpace(journey.EyeOperated)
                        ? "Operative eye is not scheduled on this journey."
                        : $"Surgery site for {NormalizeEye(journey.EyeOperated)} must be marked and attested in Consent.",
                    "block",
                    false));
            }
        }

        if (!await _pac.IsCompletedAsync(journey.Id, tenantId))
        {
            warnings.Add(new ChecklistGateWarningDto(
                "pac_incomplete",
                "PAC assessment must be completed before marking ready for surgery.",
                "block",
                false));
        }
    }

    /// <summary>
    /// Dilation countdown and vitals thresholds. Severity is always warn (D-A).
    /// Do not add these codes to <see cref="AddMarkReadyHardBlocksAsync"/>.
    /// </summary>
    private async Task AddMarkReadySoftWarningsAsync(
        PatientJourney journey, Guid tenantId, List<ChecklistGateWarningDto> warnings)
    {
        var meds = await _db.PreOpMedicationLogs
            .AsNoTracking()
            .Where(m => m.PatientJourneyId == journey.Id
                        && m.TenantId == tenantId
                        && m.DeletedAt == null)
            .ToListAsync();
        DilationReadiness.AddMarkReadyWarning(warnings, DilationReadiness.From(meds, DateTime.UtcNow));

        var latest = await _db.VitalSigns
            .AsNoTracking()
            .Where(v => v.JourneyId == journey.Id
                        && v.TenantId == tenantId
                        && v.DeletedAt == null
                        && v.Context == null)
            .OrderByDescending(v => v.RecordedAt)
            .FirstOrDefaultAsync();
        var threshold = await _db.IpVitalThresholds
            .AsNoTracking()
            .FirstOrDefaultAsync(t => t.TenantId == tenantId)
            ?? IpVitalThreshold.Defaults(tenantId);
        VitalThresholdPolicy.AddMarkReadyWarning(warnings, VitalThresholdPolicy.Evaluate(latest, threshold));
    }

    private async Task<bool> HasCompletionRowAsync(Guid clearanceId, Guid tenantId, string itemKey)
    {
        return await (
            from cp in _db.PreOpCompletions
            join item in _db.PreOpSectionItems on cp.ItemId equals item.Id
            where cp.ClearanceId == clearanceId
                  && cp.TenantId == tenantId
                  && cp.DeletedAt == null
                  && item.ItemKey == itemKey
            select cp.Id
        ).AnyAsync();
    }

    private async Task<bool> IsCompletionDoneAsync(Guid clearanceId, Guid tenantId, string itemKey)
    {
        return await (
            from cp in _db.PreOpCompletions
            join item in _db.PreOpSectionItems on cp.ItemId equals item.Id
            where cp.ClearanceId == clearanceId
                  && cp.TenantId == tenantId
                  && cp.DeletedAt == null
                  && item.ItemKey == itemKey
            select cp.IsCompleted || cp.IsBypassed
        ).FirstOrDefaultAsync();
    }

    private async Task<bool> IsLateralityAttestedAsync(
        string? scheduledEye, Guid clearanceId, Guid tenantId)
    {
        var scheduled = NormalizeEye(scheduledEye);
        if (scheduled is null) return false;

        var row = await (
            from cp in _db.PreOpCompletions
            join item in _db.PreOpSectionItems on cp.ItemId equals item.Id
            where cp.ClearanceId == clearanceId
                  && cp.TenantId == tenantId
                  && cp.DeletedAt == null
                  && item.ItemKey == "surgery_site_marked"
            select new { cp.IsCompleted, cp.IsBypassed, cp.Notes, cp.ResultValue }
        ).FirstOrDefaultAsync();

        if (row is null || !(row.IsCompleted || row.IsBypassed)) return false;
        if (string.IsNullOrWhiteSpace(row.Notes)) return false;
        return NormalizeEye(row.ResultValue) == scheduled;
    }

    private static string? NormalizeEye(string? value)
    {
        var raw = (value ?? "").Trim().ToUpperInvariant();
        if (string.IsNullOrEmpty(raw)) return null;
        if (raw is "OD" or "OS" or "OU") return raw;
        if (raw is "RE" || raw.Contains("RIGHT", StringComparison.Ordinal)) return "OD";
        if (raw is "LE" || raw.Contains("LEFT", StringComparison.Ordinal)) return "OS";
        if (raw is "BOTH" || raw.Contains("BILAT", StringComparison.Ordinal)) return "OU";
        return raw;
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
        PatientJourney journey, Guid tenantId, List<ChecklistGateWarningDto> warnings)
    {
        var journeyId = journey.Id;
        var coverageBased = PaymentModeCoveragePolicy.IsCoverageBased(journey.PaymentMode);
        decimal? patientShare = null;
        var ccmsUnavailable = false;
        decimal collected = 0;
        var billingLedgerAvailable = false;
        decimal patientBalance = 0;
        var billingSummaryUnavailable = _billing is null;
        if (_ccms is not null && coverageBased)
        {
            var v = await _ccms.ValidateAdmissionAsync(
                journey.Id, journey.CounselingSessionId, tenantId, coverageBased: true, journey.EmergencyFcApplied);
            patientShare = v.PatientShareAmount;
            ccmsUnavailable = v.CcmsUnavailable;
        }
        try
        {
            if (_billing is not null)
            {
                var billing = await _billing.GetSummaryAsync(journey.Id);
                collected = billing.PatientPaid > 0 ? billing.PatientPaid : billing.TotalCollected;
                if (billing.OpdBillId is Guid billId && billId != Guid.Empty)
                {
                    billingLedgerAvailable = true;
                    patientBalance = billing.PatientBalance;
                }
            }
        }
        catch
        {
            // Auth summary is the discharge money SoT. Do not fall back to journey.BalanceDue.
            billingSummaryUnavailable = true;
        }

        if (billingSummaryUnavailable)
        {
            warnings.Add(new ChecklistGateWarningDto(
                "patient_obligation_outstanding",
                "Clinical discharge blocked: billing information could not be verified. Journey balance is not used as patient due. Apply discharge override with a reason to proceed.",
                "block",
                true,
                DischargeBlockerCategory.Financial));
        }
        else
        {
            var cashDue = DischargeFinancialClearancePolicy.CashLedgerDue(
                billingLedgerAvailable, patientBalance, journey.BalanceDue);
            if (DischargeFinancialClearancePolicy.IsOutstanding(
                    coverageBased, cashDue, patientShare, ccmsUnavailable, collected))
            {
                var due = DischargeFinancialClearancePolicy.PatientObligationDue(
                    coverageBased, cashDue, patientShare, ccmsUnavailable, collected);
                var dueLabel = due == decimal.MaxValue ? "unknown (CCMS unavailable)" : $"₹{due:N0}";
                warnings.Add(new ChecklistGateWarningDto(
                    "patient_obligation_outstanding",
                    $"Clinical discharge blocked until patient share / cash due is collected ({dueLabel}). CCMS payer settlement does not hold the bed. Apply discharge override with a reason to proceed.",
                    "block",
                    true,
                    DischargeBlockerCategory.Financial));
            }
        }

        var followupId = await _db.PostOpInstructions
            .Where(i => i.PatientJourneyId == journeyId && i.TenantId == tenantId && i.DeletedAt == null)
            .Select(i => i.FollowupAppointmentId)
            .FirstOrDefaultAsync();
        await FollowupAppointmentLock.AddDischargeBlockAsync(
            warnings, followupId, journey, tenantId, _appointments);

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
