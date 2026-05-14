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

    public PatientJourneyService(
        IpManagementDbContext db,
        IPreOpNotificationClient notifications,
        ICcmsAdmissionClient ccms)
    {
        _db            = db;
        _notifications = notifications;
        _ccms          = ccms;
    }

    // ── List ───────────────────────────────────────────────────────────────────

    public async Task<List<PatientJourneyRowDto>> ListAsync(
        Guid tenantId, Guid branchId,
        string? clinicalState = null,
        string? wardId        = null)
    {
        var query = _db.PatientJourneys
            .Where(j => j.TenantId == tenantId && j.BranchId == branchId && j.DeletedAt == null);

        if (!string.IsNullOrEmpty(clinicalState))
            query = query.Where(j => j.ClinicalState == clinicalState);

        if (!string.IsNullOrEmpty(wardId) && Guid.TryParse(wardId, out var wId))
            query = query.Where(j => j.WardId == wId);

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
        return rows.Select(r =>
        {
            var pt   = r.Patient ?? (r.Journey.Uhid != null && uhidMap.TryGetValue(r.Journey.Uhid, out var up) ? up : null);
            var name = pt != null ? (pt.FirstName + " " + pt.LastName).Trim() : null;
            if (string.IsNullOrWhiteSpace(name))
                name = r.Journey.Uhid != null ? $"Patient {r.Journey.Uhid}" : null;

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
                    && !string.IsNullOrWhiteSpace(r.Journey.AnaesthesiaType)
            );
        }).ToList();
    }

    // ── Get detail ─────────────────────────────────────────────────────────────

    public async Task<PatientJourneyDetailDto?> GetDetailAsync(Guid id, Guid tenantId)
    {
        var j = await _db.PatientJourneys.FirstOrDefaultAsync(
            j => j.Id == id && j.TenantId == tenantId && j.DeletedAt == null);
        if (j is null) return null;
        var patient = await _db.Patients.FirstOrDefaultAsync(
            p => p.Id == j.PatientId && p.DeletedAt == null);
        return MapDetail(j, patient);
    }

    // ── Admit ──────────────────────────────────────────────────────────────────

    public async Task<PatientJourneyDetailDto> AdmitAsync(Guid id, Guid tenantId, Guid userId, AdmitPatientRequest req)
    {
        var j = await RequireJourneyAsync(id, tenantId);

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

        var previousSnapshot = SnapshotStates(j);

        j.ClinicalState            = ClinicalState.Admitted;
        j.WardId                   = req.WardId;
        j.AdmissionType            = req.AdmissionType;
        j.AdmittingDoctorId        = req.AdmittingDoctorId;
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

        await _db.SaveChangesAsync();
        var auditAction = req.OverrideStateCheck || req.BypassFinancialClearance
            ? $"AdmittedWithOverride: {req.OverrideReason ?? "No reason"}"
            : "Admitted";
        await LogAsync(j, userId, auditAction, "ClinicalState",
                       ClinicalState.Expected, ClinicalState.Admitted,
                       previousSnapshot, SnapshotStates(j));

        return MapDetail(j);
    }

    // ── Update ward assignment ────────────────────────────────────────────────

    public async Task<PatientJourneyDetailDto> UpdateWardAssignmentAsync(
        Guid id, Guid tenantId, Guid userId, UpdateWardAssignmentRequest req)
    {
        var j = await RequireJourneyAsync(id, tenantId);

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
        Guid id, Guid tenantId, Guid userId, TransitionRequest req)
    {
        var j = await RequireJourneyAsync(id, tenantId);
        StateTransitionValidator.ValidateClinical(j.ClinicalState, req.NewState);

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
            j.OtState = OtState.SentToOT;
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
            j.DischargedAt = DateTime.UtcNow;
            j.IsDischarged = true;
            j.IsLocked     = true;

            // CCMS: fire-and-forget patient-discharged event
            await _ccms.NotifyPatientDischargedAsync(id, j.CounselingSessionId, tenantId, userId);
        }

        await _db.SaveChangesAsync();
        await LogAsync(j, userId, "ClinicalStateChanged", "ClinicalState",
                       prev, req.NewState, null, null);
        return MapDetail(j);
    }

    // ── Accept patient in OT (SentToOT → OtState.Accepted) ───────────────────

    public async Task<PatientJourneyDetailDto> AcceptInOtAsync(Guid id, Guid tenantId, Guid userId)
    {
        var j = await RequireJourneyAsync(id, tenantId);

        if (j.ClinicalState != ClinicalState.SentToOT)
            throw new InvalidOperationException(
                $"Cannot accept: patient must be in SentToOT state (currently {j.ClinicalState}).");

        if (j.OtState != OtState.SentToOT)
            throw new InvalidOperationException(
                $"Cannot accept: OT state must be SentToOT (currently {j.OtState}).");

        var prevOt = j.OtState;
        j.OtState         = OtState.Accepted;
        j.UpdatedAt       = DateTime.UtcNow;
        j.UpdatedByUserId = userId;

        await _db.SaveChangesAsync();
        await LogAsync(j, userId, "OtPatientAccepted", "OtState", prevOt, j.OtState, null, null);
        return MapDetail(j);
    }

    // ── Start surgery (OtState.Accepted → InProgress, clinicalState → InOT) ──

    public async Task<PatientJourneyDetailDto> StartSurgeryAsync(Guid id, Guid tenantId, Guid userId)
    {
        var j = await RequireJourneyAsync(id, tenantId);

        if (j.OtState != OtState.Accepted)
            throw new InvalidOperationException(
                $"Cannot start surgery: OT state must be Accepted (currently {j.OtState}).");

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

    private static PatientJourneyDetailDto MapDetail(PatientJourney j, IpPatient? patient = null) => new(
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
        // Patient info from join
        patient != null && !string.IsNullOrWhiteSpace(patient.FirstName + patient.LastName)
            ? (patient.FirstName + " " + patient.LastName).Trim()
            : null,
        patient?.Gender,
        patient?.DateOfBirth,
        j.PrimarySurgeonId != null
            && !string.IsNullOrWhiteSpace(j.AnaesthetistName)
            && !string.IsNullOrWhiteSpace(j.OperationTheatreName)
            && !string.IsNullOrWhiteSpace(j.AnaesthesiaType)
    );
}
