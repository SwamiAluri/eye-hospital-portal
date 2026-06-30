using Microsoft.EntityFrameworkCore;
using IpManagementService.Data;
using IpManagementService.Models.Domain;
using IpManagementService.Models.Dtos;
using System.Text.Json;

namespace IpManagementService.Services;

/// <summary>
/// Core service for patient_journey lifecycle operations.
/// Handles admit, state transitions, ward updation, OT details, and discharge.
/// All state transitions go through StateTransitionValidator.
/// All changes are logged to journey_audit_log.
/// </summary>
public class PatientJourneyService
{
    private readonly IpManagementDbContext      _db;
    private readonly IPreOpNotificationClient   _notifications;
    private readonly ICcmsAdmissionClient       _ccms;
    private readonly SurgicalSafetyService        _surgicalSafety;
    private readonly ChecklistGateService         _gates;
    private readonly PreOpClearanceService        _preOp;
    private readonly PreOpReadinessService        _readiness;
    private readonly WardChecklistAutoSyncService _wardSync;
    private readonly JourneyMutationGuardService  _mutationGuard;
    private readonly JourneySchedulingGuardService _schedulingGuard;

    public PatientJourneyService(
        IpManagementDbContext db,
        IPreOpNotificationClient notifications,
        ICcmsAdmissionClient ccms,
        SurgicalSafetyService surgicalSafety,
        ChecklistGateService gates,
        PreOpClearanceService preOp,
        PreOpReadinessService readiness,
        WardChecklistAutoSyncService wardSync,
        JourneyMutationGuardService mutationGuard,
        JourneySchedulingGuardService schedulingGuard)
    {
        _db              = db;
        _notifications   = notifications;
        _ccms            = ccms;
        _surgicalSafety  = surgicalSafety;
        _gates           = gates;
        _preOp           = preOp;
        _readiness       = readiness;
        _wardSync        = wardSync;
        _mutationGuard   = mutationGuard;
        _schedulingGuard = schedulingGuard;
    }

    // ── List ───────────────────────────────────────────────────────────────────

    public async Task<(List<PatientJourneyRowDto> Rows, int Total)> ListAsync(
        Guid tenantId, Guid branchId,
        string? clinicalState = null,
        string? wardId        = null,
        string? otRoom        = null,
        string? anaesthetist  = null,
        string? paymentMode   = null,
        DateTime? surgeryDate = null,
        int?    limit         = null,
        int?    offset        = null)
    {
        var query = _db.PatientJourneys
            .Where(j => j.TenantId == tenantId && j.BranchId == branchId && j.DeletedAt == null);

        if (!string.IsNullOrEmpty(clinicalState))
            query = query.Where(j => j.ClinicalState == clinicalState);

        if (!string.IsNullOrEmpty(wardId) && Guid.TryParse(wardId, out var wId))
            query = query.Where(j => j.WardId == wId);

        // Additive server-side facet filters (Phase 2). Each is optional; null = no filter.
        if (!string.IsNullOrWhiteSpace(otRoom))
            query = query.Where(j => j.OperationTheatreName == otRoom);

        if (!string.IsNullOrWhiteSpace(anaesthetist))
            query = query.Where(j => j.AnaesthetistName == anaesthetist);

        if (!string.IsNullOrWhiteSpace(paymentMode))
            query = query.Where(j => j.PaymentMode == paymentMode);

        if (surgeryDate.HasValue)
        {
            var day = surgeryDate.Value.Date;
            query = query.Where(j => j.SurgeryScheduledAt.HasValue
                                  && j.SurgeryScheduledAt.Value.Date == day);
        }

        // Total before paging — lets callers render "showing N of total".
        var total = await query.CountAsync();

        // Optional server-side paging (opt-in). When both are null the full filtered set is
        // returned, preserving the FE's instant client-side filtering model.
        if (offset is > 0 || limit is > 0)
        {
            query = query.OrderBy(j => j.SurgeryScheduledAt);
            if (offset is > 0) query = query.Skip(offset.Value);
            if (limit is > 0)  query = query.Take(limit.Value);
        }

        // Step 1: UUID join only — guarantees 1 row per journey, no Cartesian product
        var rows = await (
            from j in query
            join w in _db.Wards on j.WardId equals w.Id into wardJoin
            from ward in wardJoin.DefaultIfEmpty()
            join p in _db.Patients on j.PatientId equals p.Id into patJoin
            from patient in patJoin.DefaultIfEmpty()
            orderby j.SurgeryScheduledAt
            select new { Journey = j, Ward = ward, Patient = patient }
        ).ToListAsync();

        // Step 2: UHID fallback — collect unmatched UHIDs, fetch patients in 2 queries
        var unmatchedUhids = rows
            .Where(r => r.Patient == null && r.Journey.Uhid != null)
            .Select(r => r.Journey.Uhid!)
            .Distinct()
            .ToList();

        var uhidMap = new Dictionary<string, IpPatient>(StringComparer.OrdinalIgnoreCase);
        if (unmatchedUhids.Count > 0)
        {
            var byHealthId = await _db.Patients
                .Where(p => p.HealthId != null && unmatchedUhids.Contains(p.HealthId) && p.DeletedAt == null)
                .ToListAsync();
            var byMrn = await _db.Patients
                .Where(p => p.MedicalRecordNumber != null && unmatchedUhids.Contains(p.MedicalRecordNumber) && p.DeletedAt == null)
                .ToListAsync();

            foreach (var p in byHealthId)
                uhidMap.TryAdd(p.HealthId!, p);
            foreach (var p in byMrn)
                uhidMap.TryAdd(p.MedicalRecordNumber!, p);
        }

        // Step 3: Map to DTOs — exactly one row per journey
        var patientIds = rows.Select(r =>
        {
            var pt = r.Patient ?? (r.Journey.Uhid != null && uhidMap.TryGetValue(r.Journey.Uhid, out var up) ? up : null);
            return pt?.Id ?? r.Journey.PatientId;
        }).Distinct();

        var mergeMap = await _mutationGuard.ResolveMergeInfoBatchAsync(patientIds);

        var preOpJourneyIds = rows
            .Where(r => r.Journey.ClinicalState is ClinicalState.Expected
                                     or ClinicalState.Admitted
                                     or ClinicalState.ReadyForSurgery)
            .Select(r => r.Journey.Id)
            .ToList();
        var p2Rollups = await _preOp.GetP2RollupBatchAsync(preOpJourneyIds, tenantId);
        var readinessSummaries = await _readiness.GetSummaryBatchAsync(
            rows.Where(r => preOpJourneyIds.Contains(r.Journey.Id)).Select(r => r.Journey).ToList(),
            tenantId);

        // Batch-resolve primary surgeon display names from the read-only users table.
        var surgeonIds = rows
            .Where(r => r.Journey.PrimarySurgeonId.HasValue)
            .Select(r => r.Journey.PrimarySurgeonId!.Value)
            .Distinct()
            .ToList();
        var surgeonNames = surgeonIds.Count == 0
            ? new Dictionary<Guid, string>()
            : await _db.StaffUsers
                .Where(u => surgeonIds.Contains(u.Id))
                .Select(u => new { u.Id, u.FirstName, u.LastName })
                .ToDictionaryAsync(u => u.Id, u => $"{u.FirstName} {u.LastName}".Trim());

        var mapped = rows.Select(r =>
        {
            var pt   = r.Patient ?? (r.Journey.Uhid != null && uhidMap.TryGetValue(r.Journey.Uhid, out var up) ? up : null);
            var name = pt != null ? (pt.FirstName + " " + pt.LastName).Trim() : null;
            if (string.IsNullOrWhiteSpace(name))
                name = r.Journey.Uhid != null ? $"Patient {r.Journey.Uhid}" : null;

            var patientId = pt?.Id ?? r.Journey.PatientId;
            mergeMap.TryGetValue(patientId, out var merge);
            merge ??= PatientMergeInfo.NotMerged;

            int? p2Completed = null;
            int? p2Total = null;
            bool? p2NeedsAttention = null;
            if (p2Rollups.TryGetValue(r.Journey.Id, out var p2))
            {
                p2Completed = p2.Completed;
                p2Total = p2.Total;
                p2NeedsAttention = p2.NeedsAttention;
            }

            // Readiness / dashboard fields — parsed from the already-loaded JSONB (no extra query).
            var phase       = ChecklistPhaseStatusService.Parse(r.Journey.ChecklistPhaseStatus);
            var invSummary  = ChecklistPhaseStatusService.ParseInvestigationSummary(r.Journey.ChecklistPhaseStatus);
            var pacCompleted = phase.TryGetValue("pac_completed", out var pacVal) && pacVal;
            var (readyDone, readyTotal) = WardReadiness.PreOpStates.Contains(r.Journey.ClinicalState)
                                          && readinessSummaries.TryGetValue(r.Journey.Id, out var rs)
                ? rs
                : (0, 0);

            var surgeonName = r.Journey.PrimarySurgeonId is { } sid
                && surgeonNames.TryGetValue(sid, out var sn) && !string.IsNullOrWhiteSpace(sn)
                ? sn : null;

            return new PatientJourneyRowDto(
                r.Journey.Id,
                r.Journey.Uhid ?? pt?.HealthId ?? pt?.MedicalRecordNumber,
                name,
                r.Journey.ProcedureName, r.Journey.EyeOperated,
                r.Journey.ClinicalState, r.Journey.OtState, r.Journey.FinancialState, r.Journey.PostOpState,
                r.Journey.PackageAmount ?? 0m, r.Journey.TotalPaid ?? 0m, r.Journey.BalanceDue ?? 0m,
                r.Ward?.WardName,
                r.Journey.BedNumber, r.Journey.SurgeryScheduledAt, r.Journey.AdmittedAt,
                r.Journey.IsLocked, r.Journey.IsBillingLocked,
                r.Journey.AdmissionType,
                pt?.Gender,
                pt?.DateOfBirth,
                r.Journey.OtReturnReason,
                r.Journey.CounselingSessionId,
                r.Journey.PrimarySurgeonId != null
                    && !string.IsNullOrWhiteSpace(r.Journey.AnaesthetistName)
                    && !string.IsNullOrWhiteSpace(r.Journey.OperationTheatreName)
                    && !string.IsNullOrWhiteSpace(r.Journey.AnaesthesiaType),
                r.Journey.PendingRebook,
                r.Journey.SurgeryCancelledAt,
                r.Journey.SurgeryCancelReason,
                r.Journey.CancelledFromState,
                merge.IsMerged,
                merge.CanonicalPatientId,
                merge.CanonicalUhid,
                p2Completed,
                p2Total,
                p2NeedsAttention,
                r.Journey.PaymentMode,
                r.Journey.EmergencyFcApplied,
                r.Journey.EmergencyFcReason,
                r.Journey.AnaesthetistName,
                r.Journey.OperationTheatreName,
                invSummary?.VerifiedCount,
                invSummary?.TotalApplicable,
                invSummary?.UnverifiedCritical.Count ?? 0,
                pacCompleted,
                readyDone,
                readyTotal,
                surgeonName
            );
        }).ToList();

        return (mapped, total);
    }

    // ── Dashboard summary (Phase 2) ──────────────────────────────────────────────

    /// <summary>
    /// Server-computed KPI counts + filter facets for the ward command center.
    /// Reference date defaults to UTC today; pass a board date to scope OT load /
    /// delayed / cancelled-today counts.
    /// </summary>
    public async Task<WardDashboardSummaryDto> GetDashboardSummaryAsync(
        Guid tenantId, Guid branchId, DateTime? referenceDate = null)
    {
        var journeys = await _db.PatientJourneys.AsNoTracking()
            .Where(j => j.TenantId == tenantId && j.BranchId == branchId && j.DeletedAt == null)
            .Select(j => new
            {
                j.ClinicalState,
                j.SurgeryScheduledAt,
                j.SurgeryCancelledAt,
                j.OtReturnReason,
                j.PendingRebook,
                j.BalanceDue,
                j.AdmissionType,
                j.EmergencyFcApplied,
                j.ChecklistPhaseStatus,
                j.OperationTheatreName,
                j.AnaesthetistName,
                j.PaymentMode,
                j.PrimarySurgeonId,
            })
            .ToListAsync();

        var summarySurgeonIds = journeys
            .Where(j => j.PrimarySurgeonId.HasValue)
            .Select(j => j.PrimarySurgeonId!.Value)
            .Distinct()
            .ToList();
        var summarySurgeonNames = summarySurgeonIds.Count == 0
            ? new Dictionary<Guid, string>()
            : await _db.StaffUsers
                .Where(u => summarySurgeonIds.Contains(u.Id))
                .Select(u => new { u.Id, u.FirstName, u.LastName })
                .ToDictionaryAsync(u => u.Id, u => $"{u.FirstName} {u.LastName}".Trim());

        var rows = journeys.Select(j =>
        {
            var phase      = ChecklistPhaseStatusService.Parse(j.ChecklistPhaseStatus);
            var invSummary = ChecklistPhaseStatusService.ParseInvestigationSummary(j.ChecklistPhaseStatus);
            var pacDone    = phase.TryGetValue("pac_completed", out var pacVal) && pacVal;
            return new WardDashboardMetrics.Row(
                j.ClinicalState,
                j.SurgeryScheduledAt,
                j.SurgeryCancelledAt,
                j.OtReturnReason,
                j.PendingRebook,
                j.BalanceDue ?? 0m,
                j.AdmissionType,
                j.EmergencyFcApplied,
                pacDone,
                invSummary?.UnverifiedCritical.Count ?? 0);
        }).ToList();

        var facets = new WardDashboardFacetsDto(
            journeys.Where(j => !string.IsNullOrWhiteSpace(j.OperationTheatreName))
                    .Select(j => j.OperationTheatreName!).Distinct().OrderBy(x => x).ToList(),
            journeys.Where(j => !string.IsNullOrWhiteSpace(j.AnaesthetistName))
                    .Select(j => j.AnaesthetistName!).Distinct().OrderBy(x => x).ToList(),
            journeys.Where(j => !string.IsNullOrWhiteSpace(j.PaymentMode))
                    .Select(j => j.PaymentMode!).Distinct().OrderBy(x => x).ToList(),
            summarySurgeonNames.Values
                    .Where(n => !string.IsNullOrWhiteSpace(n)).Distinct().OrderBy(x => x).ToList());

        return WardDashboardMetrics.Compute(rows, referenceDate ?? DateTime.UtcNow, facets);
    }

    /// <summary>Onboard Expected journeys: seed clearance + copy counsellor P0 completions.</summary>
    public async Task OnboardExpectedJourneysAsync(Guid tenantId, Guid branchId, Guid userId)
    {
        var expectedIds = await _db.PatientJourneys
            .Where(j => j.TenantId == tenantId
                        && j.BranchId == branchId
                        && j.ClinicalState == ClinicalState.Expected
                        && j.CounselingSessionId != null
                        && j.DeletedAt == null)
            .Select(j => j.Id)
            .ToListAsync();

        foreach (var journeyId in expectedIds)
            await _preOp.EnsureJourneyOnboardedAsync(journeyId, tenantId, userId);
    }

    public async Task EnsureJourneyOnboardedAsync(Guid id, Guid tenantId, Guid userId)
    {
        var j = await _db.PatientJourneys.FirstOrDefaultAsync(
            x => x.Id == id && x.TenantId == tenantId && x.DeletedAt == null);
        if (j is null || j.CounselingSessionId is null) return;
        await _preOp.EnsureJourneyOnboardedAsync(id, tenantId, userId);
    }

    // ── Get detail ─────────────────────────────────────────────────────────────

    public async Task<PatientJourneyDetailDto?> GetDetailAsync(Guid id, Guid tenantId, Guid? userId = null)
    {
        var j = await _db.PatientJourneys.FirstOrDefaultAsync(
            j => j.Id == id && j.TenantId == tenantId && j.DeletedAt == null);
        if (j is null) return null;

        if (userId.HasValue && j.CounselingSessionId.HasValue)
            await _preOp.EnsureJourneyOnboardedAsync(id, tenantId, userId.Value);

        var patient = await _db.Patients.FirstOrDefaultAsync(p => p.Id == j.PatientId);
        var merge   = await _mutationGuard.ResolveMergeInfoAsync(patient);
        return MapDetail(j, patient, merge);
    }

    // ── Financial: live pre-auth status ──────────────────────────────────────────

    /// <summary>
    /// Read-only insurance pre-auth status for the Ward Pre-Op Financial step,
    /// projected from the CCMS coverage case (same source the admit gate uses).
    /// Returns null when the journey does not exist.
    /// </summary>
    public async Task<PreauthStatusDto?> GetPreauthStatusAsync(Guid id, Guid tenantId)
    {
        var j = await _db.PatientJourneys
            .FirstOrDefaultAsync(x => x.Id == id && x.TenantId == tenantId && x.DeletedAt == null);
        if (j is null) return null;

        var v = await _ccms.ValidateAdmissionAsync(id, j.CounselingSessionId, tenantId);
        return new PreauthStatusDto(
            v.Allowed, v.WarningLevel, v.WarningMessage, v.BlockReason, v.PreAuthNumber, v.ApprovedAmount);
    }

    // ── Admit ──────────────────────────────────────────────────────────────────

    public async Task<PatientJourneyDetailDto> AdmitAsync(Guid id, Guid tenantId, Guid userId, AdmitPatientRequest req)
    {
        var j = await RequireJourneyAsync(id, tenantId);
        await _mutationGuard.EnsureMutableAsync(j);

        // CCMS admission gate: check pre-auth status before admitting
        if (!req.OverrideStateCheck && !req.BypassFinancialClearance)
        {
            var ccmsResult = await _ccms.ValidateAdmissionAsync(id, j.CounselingSessionId, tenantId);
            if (!ccmsResult.Allowed)
            {
                throw new InvalidOperationException(
                    ccmsResult.BlockReason ?? "Admission blocked: insurance pre-authorization is required before admission.");
            }
        }

        if (!req.OverrideStateCheck)
            StateTransitionValidator.ValidateClinical(j.ClinicalState, ClinicalState.Admitted);

        var admitGate = await _gates.EvaluateTransitionAsync(j, ClinicalState.Admitted, tenantId);
        if (admitGate.Warnings.Count > 0 && !req.AcknowledgeWarnings && !req.OverrideStateCheck)
            return MapDetail(j, transitionWarnings: admitGate.Warnings);

        var previousSnapshot = SnapshotStates(j);

        j.ClinicalState            = ClinicalState.Admitted;
        j.WardId                   = req.WardId;
        j.AdmissionType            = req.AdmissionType;
        // Admitting doctor is optional on the form; fall back to the primary surgeon
        // so the record is populated, and never write Guid.Empty (FK to users(id)).
        j.AdmittingDoctorId        = req.AdmittingDoctorId is { } adm && adm != Guid.Empty
            ? adm
            : req.PrimarySurgeonId;
        j.BedNumber                = req.BedNumber;
        j.RoomNumber               = req.RoomNumber;
        j.AttendantName            = req.AttendantName;
        j.AttendantPhone           = req.AttendantPhone;
        j.AttendantRelationship    = req.AttendantRelationship;
        j.PrimaryNurseId           = req.PrimaryNurseId;
        if (req.PrimarySurgeonId.HasValue) j.PrimarySurgeonId = req.PrimarySurgeonId;
        j.AdmittedAt               = DateTime.UtcNow;
        j.UpdatedAt                = DateTime.UtcNow;
        j.UpdatedByUserId          = userId;

        var auditAction = req.OverrideStateCheck || req.BypassFinancialClearance
            ? $"AdmittedWithOverride: {req.OverrideReason ?? "No reason"}"
            : "Admitted";

        // Admission and its audit record must commit atomically: an admitted patient
        // without an audit trail is a medico-legal compliance gap.
        await using var tx = await _db.Database.BeginTransactionAsync();
        await _db.SaveChangesAsync();
        await LogAsync(j, userId, auditAction, "ClinicalState",
                       ClinicalState.Expected, ClinicalState.Admitted,
                       previousSnapshot, SnapshotStates(j));
        await tx.CommitAsync();

        _ = _notifications.NotifyWardChangedAsync(tenantId, j.BranchId, id, ClinicalState.Admitted);

        return MapDetail(j, transitionWarnings: admitGate.Warnings.Count > 0 ? admitGate.Warnings : null);
    }

    // ── Update ward assignment ────────────────────────────────────────────────

    public async Task<PatientJourneyDetailDto> UpdateWardAssignmentAsync(
        Guid id, Guid tenantId, Guid userId, UpdateWardAssignmentRequest req)
    {
        var j = await RequireJourneyAsync(id, tenantId);
        await _mutationGuard.EnsureMutableAsync(j);

        if (j.IsLocked)
            throw new InvalidOperationException("Patient journey is locked.");

        if (req.WardId.HasValue)          j.WardId                  = req.WardId;
        if (req.BedNumber      != null)   j.BedNumber                = req.BedNumber;
        if (req.RoomNumber     != null)   j.RoomNumber               = req.RoomNumber;
        if (req.AdmittingDoctorId.HasValue) j.AdmittingDoctorId     = req.AdmittingDoctorId;
        if (req.PrimaryNurseId.HasValue)  j.PrimaryNurseId           = req.PrimaryNurseId;
        if (req.AdmissionType  != null)   j.AdmissionType            = req.AdmissionType;
        if (req.AttendantName  != null)   j.AttendantName            = req.AttendantName;
        if (req.AttendantPhone != null)   j.AttendantPhone           = req.AttendantPhone;
        if (req.AttendantRelationship != null) j.AttendantRelationship = req.AttendantRelationship;

        j.UpdatedAt        = DateTime.UtcNow;
        j.UpdatedByUserId  = userId;

        await _db.SaveChangesAsync();
        await LogAsync(j, userId, "WardAssignmentUpdated", null, null, null, null, null);
        return MapDetail(j);
    }

    // ── Update OT details (inline form on OT page) ────────────────────────────

    public async Task<PatientJourneyDetailDto> UpdateOtDetailsAsync(
        Guid id, Guid tenantId, Guid userId, UpdateOtDetailsRequest req)
    {
        var j = await RequireJourneyAsync(id, tenantId);

        if (req.AnaesthetistName      != null) j.AnaesthetistName       = req.AnaesthetistName;
        if (req.OperationTheatreName  != null) j.OperationTheatreName   = req.OperationTheatreName;
        if (req.AssistantName         != null) j.AssistantName          = req.AssistantName;
        if (req.ScrubNurseNames       != null) j.ScrubNurseNames        = req.ScrubNurseNames;
        if (req.AnaesthesiaType       != null) j.AnaesthesiaType        = req.AnaesthesiaType;
        if (req.IolPower              != null) j.IolPower               = req.IolPower;
        if (req.IolIssuedFromIp.HasValue)      j.IolIssuedFromIp        = req.IolIssuedFromIp.Value;
        if (req.IolBarcodeVerified.HasValue)   j.IolBarcodeVerified     = req.IolBarcodeVerified.Value;
        if (req.IolBarcode            != null) j.IolBarcode             = req.IolBarcode;
        if (req.PrimarySurgeonId.HasValue)     j.PrimarySurgeonId       = req.PrimarySurgeonId.Value;

        j.UpdatedAt       = DateTime.UtcNow;
        j.UpdatedByUserId = userId;

        await _db.SaveChangesAsync();
        await LogAsync(j, userId, "OtDetailsUpdated", null, null, null, null, null);
        var patient = await _db.Patients.FirstOrDefaultAsync(p => p.Id == j.PatientId && p.DeletedAt == null);
        return MapDetail(j, patient);
    }

    // ── Clinical state transition ──────────────────────────────────────────────

    public async Task<PatientJourneyDetailDto> TransitionClinicalAsync(
        Guid id, Guid tenantId, Guid userId, TransitionRequest req,
        IReadOnlyList<string>? callerRoles = null)
    {
        var j = await RequireJourneyAsync(id, tenantId);
        await _mutationGuard.EnsureMutableAsync(j);
        StateTransitionValidator.ValidateClinical(j.ClinicalState, req.NewState);

        // OT return requires authorized role
        if (req.NewState == ClinicalState.ReadyForSurgery
            && (j.ClinicalState == ClinicalState.SentToOT || j.ClinicalState == ClinicalState.InOT)
            && callerRoles is { Count: > 0 }
            && !IpChecklistAuth.HasAnyRole(callerRoles, IpChecklistAuth.OtReturnRoles.ToArray()))
        {
            throw new UnauthorizedAccessException(
                "Only OT Nurse, Anaesthetist, or Surgeon may return a patient from OT.");
        }

        var gateResult = await _gates.EvaluateTransitionAsync(j, req.NewState, tenantId);
        if (!gateResult.CanProceed)
            throw new InvalidOperationException(
                string.Join(" ", gateResult.Warnings.Select(w => w.Message)));

        if (gateResult.Warnings.Count > 0 && !req.AcknowledgeWarnings && !j.DischargeOverrideApplied)
        {
            return MapDetail(j, transitionWarnings: gateResult.Warnings);
        }

        var prev = j.ClinicalState;
        j.ClinicalState   = req.NewState;
        j.UpdatedAt       = DateTime.UtcNow;
        j.UpdatedByUserId = userId;

        // Side effects
        if (req.NewState == ClinicalState.InOT)
        {
            // SurgeryStartedAt is set by StartSurgeryAsync; only lock billing here
            j.IsBillingLocked   = true;
        }
        else if (req.NewState == ClinicalState.SentToOT)
        {
            // Advance OT state in lockstep so AcceptInOtAsync guard passes
            j.OtState     = OtState.SentToOT;
            j.SentToOtAt ??= DateTime.UtcNow;
        }
        else if (req.NewState == ClinicalState.PostOp)
        {
            j.ReceivedFromOtAt ??= DateTime.UtcNow;
        }
        else if (req.NewState == ClinicalState.ReadyForSurgery)
        {
            // OT returning patient — reset OT state and release billing lock so details can be re-saved
            j.OtState         = OtState.NotSent;
            j.IsBillingLocked = false;
            if (!string.IsNullOrWhiteSpace(req.Reason))
                j.OtReturnReason = req.Reason;
        }
        else if (req.NewState == ClinicalState.SurgeryCompleted)
        {
            j.SurgeryEndedAt = DateTime.UtcNow;
            j.OtState        = OtState.Completed;

            // Fire-and-forget: sync the OT finalize schedule status → SurgeryDone.
            // Non-fatal — the clinical transition must not be blocked by OT sync failures.
            if (j.OtFinalizeScheduleId.HasValue)
                _ = _notifications.MarkOtSurgeryDoneAsync(
                        j.OtFinalizeScheduleId.Value, tenantId, userId.ToString());

            // CCMS: fire-and-forget surgery-completed event
            await _ccms.NotifySurgeryCompletedAsync(id, j.CounselingSessionId, tenantId, userId);
        }
        else if (req.NewState == ClinicalState.Discharged)
        {
            j.DischargedAt    = DateTime.UtcNow;
            j.WardCheckoutAt ??= DateTime.UtcNow;
            j.IsDischarged    = true;
            j.IsLocked        = true;

            // CCMS: fire-and-forget patient-discharged event
            await _ccms.NotifyPatientDischargedAsync(id, j.CounselingSessionId, tenantId, userId);
        }

        await _db.SaveChangesAsync();
        await _wardSync.SyncMarkReadyOptionalAsync(id, tenantId, userId, prev, req.NewState);
        await LogAsync(j, userId, "ClinicalStateChanged", "ClinicalState",
                       prev, req.NewState, null, null);

        if (req.NewState == ClinicalState.PostOp && prev != ClinicalState.PostOp)
        {
            var patient = await _db.Patients.FirstOrDefaultAsync(
                p => p.Id == j.PatientId && p.DeletedAt == null);
            var patientName = patient != null
                ? (patient.FirstName + " " + patient.LastName).Trim()
                : j.Uhid ?? "Patient";
            await _notifications.NotifyWardPostOpHandoffAsync(
                tenantId, j.BranchId, id, patientName, j.ProcedureName);
        }

        if (prev == ClinicalState.Admitted && req.NewState == ClinicalState.ReadyForSurgery)
        {
            var patient = await _db.Patients.FirstOrDefaultAsync(
                p => p.Id == j.PatientId && p.DeletedAt == null);
            var patientName = patient != null
                ? (patient.FirstName + " " + patient.LastName).Trim()
                : j.Uhid ?? "Patient";
            _ = _notifications.NotifyPreOpMarkReadyAsync(
                tenantId, j.BranchId, id, patientName, j.ProcedureName);
        }

        _ = _notifications.NotifyWardChangedAsync(tenantId, j.BranchId, id, req.NewState);

        return MapDetail(j, transitionWarnings: gateResult.Warnings.Count > 0 ? gateResult.Warnings : null);
    }

    /// <summary>
    /// Cancel today's surgery — park the journey in the <see cref="ClinicalState.CancelledSurgery"/>
    /// off-ramp, release OT/bed, set rebook annotations (G1 / Phase 1). The case holds in
    /// CancelledSurgery until an explicit Rebook returns it to Expected.
    /// </summary>
    public async Task<PatientJourneyDetailDto> CancelTodaySurgeryAsync(
        Guid id, Guid tenantId, Guid userId, CancelTodaySurgeryRequest req)
    {
        if (string.IsNullOrWhiteSpace(req.Reason))
            throw new ArgumentException("Cancel reason is required.");

        var j = await RequireJourneyAsync(id, tenantId);
        await _mutationGuard.EnsureMutableAsync(j);

        if (j.IsLocked || j.IsDischarged)
            throw new InvalidOperationException("Cannot cancel a locked or discharged journey.");

        StateTransitionValidator.ValidateCancelToday(j.ClinicalState, j.OtState);

        var prevClinical = j.ClinicalState;
        var previousSnapshot = SnapshotStates(j);

        j.SurgeryCancelledAt   = DateTime.UtcNow;
        j.SurgeryCancelReason  = req.Reason.Trim();
        j.PendingRebook        = true;
        j.CancelledFromState   = prevClinical;

        j.ClinicalState   = ClinicalState.CancelledSurgery;
        j.OtState         = OtState.NotSent;
        j.SentToOtAt      = null;
        j.IsBillingLocked = false;
        j.OtReturnReason  = null;

        if (prevClinical != ClinicalState.Expected || j.AdmittedAt.HasValue)
        {
            j.WardId            = null;
            j.BedNumber         = null;
            j.RoomNumber        = null;
            j.AdmittedAt        = null;
            j.AdmissionType     = null;
            j.AdmittingDoctorId = null;
            j.PrimaryNurseId    = null;
        }

        j.UpdatedAt       = DateTime.UtcNow;
        j.UpdatedByUserId = userId;

        await _db.SaveChangesAsync();

        if (j.OtFinalizeScheduleId.HasValue)
        {
            _ = _notifications.ReleaseOtScheduleForRebookAsync(
                j.OtFinalizeScheduleId.Value, tenantId, userId.ToString());
        }

        var patient = await _db.Patients.FirstOrDefaultAsync(
            p => p.Id == j.PatientId && p.DeletedAt == null);
        var patientName = patient != null
            ? (patient.FirstName + " " + patient.LastName).Trim()
            : j.Uhid ?? "Patient";

        await _notifications.NotifyCounsellingRebookAsync(
            tenantId, j.BranchId, j.CounselingSessionId, patientName, req.Reason.Trim());

        await LogAsync(j, userId, "CancelTodaySurgery", "ClinicalState",
                       prevClinical, ClinicalState.CancelledSurgery,
                       previousSnapshot, SnapshotStates(j));

        _ = _notifications.NotifyWardChangedAsync(tenantId, j.BranchId, id, ClinicalState.CancelledSurgery);

        return MapDetail(j, patient);
    }

    /// <summary>
    /// Rebook a cancelled surgery — explicit ward action that returns the journey from
    /// <see cref="ClinicalState.CancelledSurgery"/> to <see cref="ClinicalState.Expected"/>
    /// and clears the pending-rebook flag (Phase 1).
    /// </summary>
    public async Task<PatientJourneyDetailDto> RebookCancelledSurgeryAsync(
        Guid id, Guid tenantId, Guid userId)
    {
        var j = await RequireJourneyAsync(id, tenantId);
        await _mutationGuard.EnsureMutableAsync(j);

        if (j.ClinicalState != ClinicalState.CancelledSurgery)
            throw new InvalidOperationException(
                $"[Rebook] Only a cancelled surgery can be rebooked (current state '{j.ClinicalState}').");

        var previousSnapshot = SnapshotStates(j);

        StateTransitionValidator.ValidateClinical(j.ClinicalState, ClinicalState.Expected);
        j.ClinicalState   = ClinicalState.Expected;
        j.PendingRebook   = false;
        j.UpdatedAt       = DateTime.UtcNow;
        j.UpdatedByUserId = userId;

        await _db.SaveChangesAsync();

        var patient = await _db.Patients.FirstOrDefaultAsync(
            p => p.Id == j.PatientId && p.DeletedAt == null);

        await LogAsync(j, userId, "RebookCancelledSurgery", "ClinicalState",
                       ClinicalState.CancelledSurgery, ClinicalState.Expected,
                       previousSnapshot, SnapshotStates(j));

        _ = _notifications.NotifyWardChangedAsync(tenantId, j.BranchId, id, ClinicalState.Expected);

        return MapDetail(j, patient);
    }

    /// <summary>Clear pending-rebook when counselling sets a new surgery date (G1 / Phase 3.4).</summary>
    public async Task<PatientJourneyDetailDto?> ApplyCounsellingRebookAsync(ApplyCounsellingRebookRequest req)
    {
        var j = await _db.PatientJourneys.FirstOrDefaultAsync(x =>
            x.OtFinalizeScheduleId == req.OtScheduleId
            && x.TenantId == req.TenantId
            && x.DeletedAt == null);

        if (j is null) return null;

        var changed = false;

        if (req.SurgeryScheduledAt.HasValue && j.SurgeryScheduledAt != req.SurgeryScheduledAt)
        {
            await _schedulingGuard.ValidateSameDaySingleEyeAsync(
                j.TenantId, j.PatientId, j.EyeOperated, req.SurgeryScheduledAt, j.Id);
            j.SurgeryScheduledAt = req.SurgeryScheduledAt;
            changed = true;
        }

        if (j.PendingRebook)
        {
            j.PendingRebook = false;
            changed = true;
        }

        // A cancelled case is rebooked back into the Expected pool when counselling
        // sets a new date (Phase 1 — mirrors the explicit ward Rebook exit).
        if (j.ClinicalState == ClinicalState.CancelledSurgery)
        {
            StateTransitionValidator.ValidateClinical(j.ClinicalState, ClinicalState.Expected);
            j.ClinicalState = ClinicalState.Expected;
            changed = true;
        }

        if (!changed) return MapDetail(j);

        j.UpdatedAt = DateTime.UtcNow;
        if (Guid.TryParse(req.ActorUserId, out var actorId))
            j.UpdatedByUserId = actorId;

        await _db.SaveChangesAsync();

        var patient = await _db.Patients.FirstOrDefaultAsync(
            p => p.Id == j.PatientId && p.DeletedAt == null);
        await LogAsync(j,
            Guid.TryParse(req.ActorUserId, out var logUserId) ? logUserId : Guid.Empty,
            "CounsellingRebookApplied",
            "PendingRebook",
            "true",
            "false",
            null,
            req.SurgeryScheduledAt?.ToString("O"));

        return MapDetail(j, patient);
    }

    public async Task<ChecklistGateResultDto> GetTransitionGatesAsync(
        Guid id, Guid tenantId, string newState)
    {
        var j = await RequireJourneyAsync(id, tenantId);
        return await _gates.EvaluateTransitionAsync(j, newState, tenantId);
    }

    public async Task<PatientJourneyDetailDto> ApplyWhoSupervisorOverrideAsync(
        Guid id, Guid tenantId, Guid userId, WhoSupervisorOverrideRequest req)
    {
        var j = await RequireJourneyAsync(id, tenantId);
        j.WhoSupervisorOverrideApplied = true;
        j.WhoSupervisorOverrideBy      = userId;
        j.WhoSupervisorOverrideAt      = DateTime.UtcNow;
        j.UpdatedAt                    = DateTime.UtcNow;
        j.UpdatedByUserId              = userId;
        await _db.SaveChangesAsync();
        await LogAsync(j, userId, "WhoSupervisorOverrideApplied", null, null, null, req.Reason, null);
        return MapDetail(j);
    }

    // ── Accept patient in OT (SentToOT → OtState.Accepted) ───────────────────

    public async Task<PatientJourneyDetailDto> AcceptInOtAsync(
        Guid id, Guid tenantId, Guid userId, bool acknowledgeWarnings = false)
    {
        var j = await RequireJourneyAsync(id, tenantId);

        if (j.ClinicalState != ClinicalState.SentToOT)
            throw new InvalidOperationException(
                $"Cannot accept: patient must be in SentToOT state (currently {j.ClinicalState}).");

        if (j.OtState != OtState.SentToOT)
            throw new InvalidOperationException(
                $"Cannot accept: OT state must be SentToOT (currently {j.OtState}).");

        await _surgicalSafety.ValidateBillingGateForAcceptAsync(id, tenantId);

        var acceptGate = await _gates.EvaluateAcceptInOtAsync(id, tenantId);
        if (acceptGate.Warnings.Count > 0 && !acknowledgeWarnings)
            return MapDetail(j, transitionWarnings: acceptGate.Warnings);

        var prevOt = j.OtState;
        j.OtState         = OtState.Accepted;
        j.UpdatedAt       = DateTime.UtcNow;
        j.UpdatedByUserId = userId;

        await _db.SaveChangesAsync();
        await LogAsync(j, userId, "OtPatientAccepted", "OtState", prevOt, j.OtState, null, null);
        return MapDetail(j, transitionWarnings: acceptGate.Warnings.Count > 0 ? acceptGate.Warnings : null);
    }

    // ── Start surgery (OtState.Accepted → InProgress, clinicalState → InOT) ──

    public async Task<PatientJourneyDetailDto> StartSurgeryAsync(
        Guid id, Guid tenantId, Guid userId, bool acknowledgeWhoWarning = false)
    {
        var j = await RequireJourneyAsync(id, tenantId);

        if (j.OtState != OtState.Accepted)
            throw new InvalidOperationException(
                $"Cannot start surgery: OT state must be Accepted (currently {j.OtState}).");

        var whoGate = await _gates.EvaluateStartSurgeryAsync(
            id, tenantId, j.WhoSupervisorOverrideApplied);
        if (whoGate.Warnings.Count > 0 && !acknowledgeWhoWarning && !j.WhoSupervisorOverrideApplied)
            return MapDetail(j, transitionWarnings: whoGate.Warnings);

        var prevClinical = j.ClinicalState;
        var prevOt       = j.OtState;

        j.ClinicalState    = ClinicalState.InOT;
        j.OtState          = OtState.InProgress;
        j.SurgeryStartedAt = DateTime.UtcNow;
        j.IsBillingLocked  = true;
        j.UpdatedAt        = DateTime.UtcNow;
        j.UpdatedByUserId  = userId;

        await _db.SaveChangesAsync();
        await LogAsync(j, userId, "SurgeryStarted", "ClinicalState", prevClinical, j.ClinicalState, null, null);
        await LogAsync(j, userId, "SurgeryStarted", "OtState", prevOt, j.OtState, null, null);
        return MapDetail(j);
    }

    // ── Financial state transition ─────────────────────────────────────────────

    public async Task<PatientJourneyDetailDto> TransitionFinancialAsync(
        Guid id, Guid tenantId, Guid userId, TransitionRequest req)
    {
        var j = await RequireJourneyAsync(id, tenantId);
        StateTransitionValidator.ValidateFinancial(j.FinancialState, req.NewState);

        var prev = j.FinancialState;
        j.FinancialState  = req.NewState;
        j.UpdatedAt       = DateTime.UtcNow;
        j.UpdatedByUserId = userId;

        await _db.SaveChangesAsync();
        await LogAsync(j, userId, "FinancialStateChanged", "FinancialState",
                       prev, req.NewState, null, null);
        return MapDetail(j);
    }

    // ── Emergency FC ───────────────────────────────────────────────────────────

    public async Task<PatientJourneyDetailDto> ApplyEmergencyFcAsync(
        Guid id, Guid tenantId, Guid userId, EmergencyFcRequest req)
    {
        var j = await RequireJourneyAsync(id, tenantId);
        await _mutationGuard.EnsureMutableAsync(j);

        j.EmergencyFcApplied          = true;
        j.EmergencyFcReason           = req.Reason;
        j.EmergencyFcApprovedBy       = userId;
        j.EmergencyFcApprovedAt       = DateTime.UtcNow;
        j.GovernmentApprovalSubmitted = req.GovernmentApprovalSubmitted;
        j.InsurancePreauthSubmitted   = req.InsurancePreauthSubmitted;
        j.IsCampPatient               = req.IsCampPatient;
        j.UpdatedAt                   = DateTime.UtcNow;
        j.UpdatedByUserId             = userId;

        await _db.SaveChangesAsync();
        await LogAsync(j, userId, "EmergencyFcApplied", null, null, null, null, null);
        return MapDetail(j);
    }

    // ── Discharge override ─────────────────────────────────────────────────────

    public async Task<PatientJourneyDetailDto> ApplyDischargeOverrideAsync(
        Guid id, Guid tenantId, Guid userId, DischargeOverrideRequest req)
    {
        var j = await RequireJourneyAsync(id, tenantId);

        j.DischargeOverrideApplied = true;
        j.DischargeOverrideReason  = req.Reason;
        j.DischargeOverrideBy      = userId;
        j.UpdatedAt                = DateTime.UtcNow;
        j.UpdatedByUserId          = userId;

        await _db.SaveChangesAsync();
        await LogAsync(j, userId, "DischargeOverrideApplied", null, null, null, null, null);
        return MapDetail(j);
    }

    // ── Verify IOL Barcode ─────────────────────────────────────────────────────

    public async Task<VerifyIolBarcodeResponse> VerifyIolBarcodeAsync(
        Guid id, Guid tenantId, Guid userId, string barcode)
    {
        var j = await RequireJourneyAsync(id, tenantId);

        // Basic validation — accept non-empty alphanumeric barcodes (≥5 chars)
        var isValid = barcode.Length >= 5
                      && barcode.All(c => char.IsLetterOrDigit(c) || c == '-' || c == '_');

        if (isValid)
        {
            j.IolBarcode         = barcode;
            j.IolBarcodeVerified = true;
            j.UpdatedAt          = DateTime.UtcNow;
            j.UpdatedByUserId    = userId;
            await _db.SaveChangesAsync();
            await LogAsync(j, userId, "IolBarcodeVerified", null, null, barcode, null, null);
        }

        return new VerifyIolBarcodeResponse(
            IsValid:      isValid,
            CatalogEntry: isValid ? barcode : null,
            Message:      isValid ? "Barcode verified and saved." : "Barcode format invalid — must be at least 5 alphanumeric characters."
        );
    }

    // ── Helpers ────────────────────────────────────────────────────────────────

    private async Task<PatientJourney> RequireJourneyAsync(Guid id, Guid tenantId)
    {
        var j = await _db.PatientJourneys.FirstOrDefaultAsync(
            j => j.Id == id && j.TenantId == tenantId && j.DeletedAt == null)
            ?? throw new KeyNotFoundException($"PatientJourney {id} not found.");
        return j;
    }

    private async Task<PatientJourneyDetailDto> MapDetailForJourneyAsync(
        PatientJourney j,
        IReadOnlyList<ChecklistGateWarningDto>? transitionWarnings = null)
    {
        var patient = await _db.Patients.FirstOrDefaultAsync(p => p.Id == j.PatientId);
        var merge   = await _mutationGuard.ResolveMergeInfoAsync(patient);
        return MapDetail(j, patient, merge, transitionWarnings);
    }

    private static PatientJourneyDetailDto MapDetail(
        PatientJourney j,
        IpPatient? patient = null,
        PatientMergeInfo? merge = null,
        IReadOnlyList<ChecklistGateWarningDto>? transitionWarnings = null)
    {
        var m = merge ?? PatientMergeInfo.NotMerged;
        if (merge is null && patient is not null)
        {
            m = JourneyMutationGuardService.IsPatientMerged(patient)
                ? new PatientMergeInfo(true, null, null)
                : PatientMergeInfo.NotMerged;
        }

        return new PatientJourneyDetailDto(
        j.Id, j.TenantId, j.BranchId, j.PatientId, j.Uhid,
        j.OtFinalizeScheduleId, j.CounselingSessionId, j.WardId,
        j.ClinicalState, j.OtState, j.FinancialState, j.PostOpState,
        j.ProcedureName, j.EyeOperated, j.PrimarySurgeonId,
        j.AnaesthesiaType, j.SurgeryScheduledAt,
        j.IolPower, j.IolIssuedFromIp, j.IolBarcodeVerified, j.IolBarcode,
        j.AnaesthetistName, j.OperationTheatreName, j.AssistantName, j.ScrubNurseNames,
        j.AdmissionType, j.AdmittingDoctorId, j.BedNumber, j.RoomNumber,
        j.AttendantName, j.AttendantPhone, j.AttendantRelationship, j.AdmittedAt,
        j.SurgeryStartedAt, j.SurgeryEndedAt, j.DischargedAt,
        j.IsLocked, j.IsBillingLocked, j.IsClinicalLocked, j.IsDischarged,
        j.EmergencyFcApplied, j.GovernmentApprovalSubmitted, j.InsurancePreauthSubmitted, j.IsCampPatient,
        j.OtReturnReason,
        j.PackageAmount ?? 0m, j.TotalAdvances ?? 0m, j.TotalPaid ?? 0m, j.BalanceDue ?? 0m,
        patient != null && !string.IsNullOrWhiteSpace(patient.FirstName + patient.LastName)
            ? (patient.FirstName + " " + patient.LastName).Trim()
            : null,
        patient?.Gender,
        patient?.DateOfBirth,
        j.PrimarySurgeonId != null
            && !string.IsNullOrWhiteSpace(j.AnaesthetistName)
            && !string.IsNullOrWhiteSpace(j.OperationTheatreName)
            && !string.IsNullOrWhiteSpace(j.AnaesthesiaType),
        j.DischargeOverrideApplied,
        j.WhoSupervisorOverrideApplied,
        ChecklistPhaseStatusService.Parse(j.ChecklistPhaseStatus),
        ChecklistPhaseStatusService.ParseInvestigationSummary(j.ChecklistPhaseStatus),
        transitionWarnings,
        j.PendingRebook,
        j.SurgeryCancelledAt,
        j.SurgeryCancelReason,
        j.CancelledFromState,
        m.IsMerged,
        m.CanonicalPatientId,
        m.CanonicalUhid,
        j.PaymentMode);
    }

    private async Task LogAsync(
        PatientJourney j, Guid userId,
        string action, string? stateType,
        string? oldValue, string? newValue,
        string? previousState, string? newState)
    {
        _db.JourneyAuditLogs.Add(new JourneyAuditLog
        {
            TenantId          = j.TenantId,
            PatientJourneyId  = j.Id,
            Action            = action,
            StateType         = stateType,
            OldValue          = oldValue,
            NewValue          = newValue,
            PreviousState     = previousState,
            NewState          = newState,
            PerformedByUserId = userId,
            PerformedAt       = DateTime.UtcNow,
            CreatedAt         = DateTime.UtcNow,
            UpdatedAt         = DateTime.UtcNow,
        });
        await _db.SaveChangesAsync();
    }

    private static string SnapshotStates(PatientJourney j)
        => JsonSerializer.Serialize(new
        {
            j.ClinicalState,
            j.OtState,
            j.FinancialState,
            j.PostOpState,
        });
}
