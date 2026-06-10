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
    bool     OtDetailsSaved
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
    IReadOnlyList<ChecklistGateWarningDto>? TransitionWarnings
);

// ─── Admit ────────────────────────────────────────────────────────────────────

public record AdmitPatientRequest(
    Guid    WardId,
    string  AdmissionType,       // DayCare|IPD|Emergency
    Guid    AdmittingDoctorId,
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

public record EmergencyFcRequest(
    string Reason,
    bool   GovernmentApprovalSubmitted,
    bool   InsurancePreauthSubmitted,
    bool   IsCampPatient
);

// ─── Discharge override ────────────────────────────────────────────────────────

public record DischargeOverrideRequest(string Reason);
