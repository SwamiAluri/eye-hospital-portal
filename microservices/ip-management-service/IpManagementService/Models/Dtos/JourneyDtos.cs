namespace IpManagementService.Models.Dtos;

// ─── Patient Journey ──────────────────────────────────────────────────────────

/// <summary>Lightweight row for list views (Ward page, IP Management page).</summary>
public record PatientJourneyRowDto(
    Guid     Id,
    string?  Uhid,
    string?  PatientName,
    string?  ProcedureName,
    string?  EyeOperated,
    string   ClinicalState,
    string   OtState,
    string   FinancialState,
    string   PostOpState,
    decimal  PackageAmount,
    decimal  TotalPaid,
    decimal  BalanceDue,
    string?  WardName,
    string?  BedNumber,
    DateTime? SurgeryScheduledAt,
    DateTime? AdmittedAt,
    bool     IsLocked,
    bool     IsBillingLocked,
    string?  AdmissionType,
    string?  PatientGender,
    DateTime? PatientDob,
    string?  OtReturnReason,
    Guid?    CounselingSessionId,
    bool     OtDetailsSaved,
    bool     PendingRebook,
    DateTime? SurgeryCancelledAt,
    string?  SurgeryCancelReason,
    string?  CancelledFromState,
    bool     IsPatientMerged,
    Guid?    CanonicalPatientId,
    string?  CanonicalUhid,
    int?     P2ClearanceCompleted,
    int?     P2ClearanceTotal,
    bool?    P2ClearanceNeedsAttention,
    // Financial / payer (migration 146)
    string?  PaymentMode,
    bool     IsEmergencyFc,
    string?  EmergencyFcReason,
    // Readiness / dashboard summary (Phase 2) — derived from checklist_phase_status,
    // surgical team strings, and the P2 rollup; no extra per-row queries.
    string?  AnaesthetistName        = null,
    string?  OperationTheatreName    = null,
    int?     InvestigationsVerified  = null,
    int?     InvestigationsTotal     = null,
    int      UnverifiedCriticalCount = 0,
    bool     PacCompleted            = false,
    int      ReadinessCompleted      = 0,
    int      ReadinessTotal          = 0,
    // Primary surgeon display name, resolved from the read-only users table (Phase 2 follow-up).
    string?  SurgeonName             = null
);

// ─── Ward dashboard summary (Phase 2) ──────────────────────────────────────────

/// <summary>Server-computed KPI counts + filter facets for the ward command center.</summary>
public record WardDashboardSummaryDto(
    IReadOnlyDictionary<string, int> StageCounts,
    int OtLoadToday,
    int PacPending,
    int CriticalLabs,
    int FinancialPending,
    int Delayed,
    int CancelledToday,
    int RebookRequired,
    int EmergencyCount,
    WardDashboardFacetsDto Facets
);

/// <summary>Distinct filter values for dashboard chips (entity-resident, no cross-service joins).</summary>
public record WardDashboardFacetsDto(
    IReadOnlyList<string> OtRooms,
    IReadOnlyList<string> Anaesthetists,
    IReadOnlyList<string> Payers,
    IReadOnlyList<string> Surgeons
);

/// <summary>Full detail for Journey detail page / OT inline form.</summary>
public record PatientJourneyDetailDto(
    Guid     Id,
    Guid     TenantId,
    Guid     BranchId,
    Guid     PatientId,
    string?  Uhid,
    Guid?    OtFinalizeScheduleId,
    Guid?    CounselingSessionId,
    Guid?    WardId,
    // State
    string   ClinicalState,
    string   OtState,
    string   FinancialState,
    string   PostOpState,
    // Surgery context
    string?  ProcedureName,
    string?  EyeOperated,
    Guid?    PrimarySurgeonId,
    string?  AnaesthesiaType,
    DateTime? SurgeryScheduledAt,
    // IOL
    string?  IolPower,
    bool     IolIssuedFromIp,
    bool     IolBarcodeVerified,
    string?  IolBarcode,
    // Surgical team
    string?  AnaesthetistName,
    string?  OperationTheatreName,
    string?  AssistantName,
    string?  ScrubNurseNames,
    // Ward / admission
    string?  AdmissionType,
    Guid?    AdmittingDoctorId,
    string?  BedNumber,
    string?  RoomNumber,
    string?  AttendantName,
    string?  AttendantPhone,
    string?  AttendantRelationship,
    DateTime? AdmittedAt,
    // Timestamps
    DateTime? SurgeryStartedAt,
    DateTime? SurgeryEndedAt,
    DateTime? DischargedAt,
    // Flags
    bool     IsLocked,
    bool     IsBillingLocked,
    bool     IsClinicalLocked,
    bool     IsDischarged,
    bool     EmergencyFcApplied,
    bool     GovernmentApprovalSubmitted,
    bool     InsurancePreauthSubmitted,
    bool     IsCampPatient,
    string?  OtReturnReason,
    // Financial
    decimal  PackageAmount,
    decimal  TotalAdvances,
    decimal  TotalPaid,
    decimal  BalanceDue,
    // Patient info (resolved from patients table join)
    string?  PatientName,
    string?  PatientGender,
    DateTime? PatientDob,
    bool     OtDetailsSaved,
    bool     DischargeOverrideApplied,
    bool     WhoSupervisorOverrideApplied,
    IReadOnlyDictionary<string, bool>? ChecklistPhaseStatus,
    InvestigationPhaseSummaryDto? InvestigationPhaseSummary,
    IReadOnlyList<ChecklistGateWarningDto>? TransitionWarnings,
    bool     PendingRebook,
    DateTime? SurgeryCancelledAt,
    string?  SurgeryCancelReason,
    string?  CancelledFromState,
    bool     IsPatientMerged,
    Guid?    CanonicalPatientId,
    string?  CanonicalUhid,
    // Financial / payer (migration 146)
    string?  PaymentMode
);

// ─── Admit ────────────────────────────────────────────────────────────────────

public record AdmitPatientRequest(
    Guid    WardId,
    string  AdmissionType,       // DayCare|IPD|Emergency
    Guid?   AdmittingDoctorId,
    string? BedNumber,
    string? RoomNumber,
    string? AttendantName,
    string? AttendantPhone,
    string? AttendantRelationship,
    Guid?   PrimaryNurseId,
    Guid?   PrimarySurgeonId,
    bool    OverrideStateCheck,
    bool    BypassFinancialClearance,
    string? OverrideReason,
    bool    AcknowledgeWarnings = false
);

// ─── Ward Updation Modal (update ward, bed, doctor, nurse) ────────────────────

public record UpdateWardAssignmentRequest(
    Guid?   WardId,
    string? BedNumber,
    string? RoomNumber,
    Guid?   AdmittingDoctorId,
    Guid?   PrimaryNurseId,
    string? AdmissionType,
    string? AttendantName,
    string? AttendantPhone,
    string? AttendantRelationship
);

// ─── OT inline form (surgical team + IOL) ────────────────────────────────────

public record UpdateOtDetailsRequest(
    string? AnaesthetistName,
    string? OperationTheatreName,
    string? AssistantName,
    string? ScrubNurseNames,
    string? AnaesthesiaType,
    string? IolPower,
    bool?   IolIssuedFromIp,
    bool?   IolBarcodeVerified,
    string? IolBarcode,
    Guid?   PrimarySurgeonId
);

// ─── State transitions ────────────────────────────────────────────────────────

public record TransitionRequest(
    string  NewState,
    string? Reason = null,
    bool    AcknowledgeWarnings = false);

// ─── Emergency FC Modal ───────────────────────────────────────────────────────

/// <summary>
/// Emergency FC request. GovernmentApprovalSubmitted / InsurancePreauthSubmitted
/// are retained for API compatibility but ignored by ApplyEmergencyFcAsync (Phase 3) —
/// coverage authorization truth is CCMS.
/// </summary>
public record EmergencyFcRequest(
    string Reason,
    bool   GovernmentApprovalSubmitted,
    bool   InsurancePreauthSubmitted,
    bool   IsCampPatient
);

// ─── Discharge override ────────────────────────────────────────────────────────

public record DischargeOverrideRequest(string Reason);

public record CancelTodaySurgeryRequest(string Reason);

public record ApplyCounsellingRebookRequest(
    Guid     OtScheduleId,
    Guid     TenantId,
    DateTime? SurgeryScheduledAt,
    string?  ActorUserId);
