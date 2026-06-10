namespace IpManagementService.Models.Domain;

public class PatientJourney
{
    public Guid     Id                       { get; set; }
    public Guid     TenantId                 { get; set; }
    public Guid     BranchId                 { get; set; }

    // Handoff source
    public Guid     PatientId                { get; set; }
    public string?  Uhid                     { get; set; }
    public Guid?    OtFinalizeScheduleId     { get; set; }
    public Guid?    CounselingSessionId      { get; set; }
    public Guid?    AdmissionId              { get; set; }
    public Guid?    WardId                   { get; set; }

    // State machine
    public string   ClinicalState            { get; set; } = Domain.ClinicalState.Expected;
    public string   OtState                  { get; set; } = Domain.OtState.NotSent;
    public string   FinancialState           { get; set; } = Domain.FinancialState.NotCreated;
    public string   PostOpState              { get; set; } = Domain.PostOpState.NotStarted;

    // Surgery context (denormalized at trigger time)
    public string?  ProcedureName            { get; set; }
    public string?  EyeOperated              { get; set; }
    public Guid?    PrimarySurgeonId         { get; set; }
    public string?  AnaesthesiaType          { get; set; }
    public DateTime? SurgeryScheduledAt      { get; set; }

    // IOL fields
    public string?  IolPower                 { get; set; }
    public bool     IolIssuedFromIp          { get; set; }
    public bool     IolBarcodeVerified       { get; set; }
    public string?  IolBarcode               { get; set; }

    // Surgical team
    public string?  AnaesthetistName         { get; set; }
    public string?  OperationTheatreName     { get; set; }
    public string?  AssistantName            { get; set; }
    public string?  ScrubNurseNames          { get; set; }

    // Ward / admission
    public string?  AdmissionType            { get; set; }
    public Guid?    AdmittingDoctorId        { get; set; }
    public Guid?    PrimaryNurseId           { get; set; }
    public string?  BedNumber                { get; set; }
    public string?  RoomNumber               { get; set; }
    public string?  AttendantName            { get; set; }
    public string?  AttendantPhone           { get; set; }
    public string?  AttendantRelationship    { get; set; }
    public DateTime? AdmittedAt             { get; set; }
    public DateTime? WardCheckInAt          { get; set; }
    public DateTime? InformedOtTeamAt       { get; set; }

    // Form 4 — medication log / post-op timestamps
    public string?   XylocaineSensitivityResult { get; set; }
    public string?   MedicationLogSurgeryNotes    { get; set; }
    public string?   WardPostopIolChecks          { get; set; }
    public DateTime? SentToOtAt                   { get; set; }
    public DateTime? ReceivedFromOtAt             { get; set; }
    public DateTime? WardCheckoutAt               { get; set; }

    // Timestamps
    public DateTime? SurgeryStartedAt       { get; set; }
    public DateTime? SurgeryEndedAt         { get; set; }
    public DateTime? DischargedAt           { get; set; }

    // Control flags
    public bool     IsLocked                 { get; set; }
    public bool     IsBillingLocked          { get; set; }
    public bool     IsClinicalLocked         { get; set; }
    public bool     IsDischarged             { get; set; }

    // Override / clearance flags
    public bool     EmergencyFcApplied       { get; set; }
    public string?  EmergencyFcReason        { get; set; }
    public Guid?    EmergencyFcApprovedBy    { get; set; }
    public DateTime? EmergencyFcApprovedAt  { get; set; }
    public bool     GovernmentApprovalSubmitted { get; set; }
    public bool     InsurancePreauthSubmitted   { get; set; }
    public bool     IsCampPatient            { get; set; }
    public bool     DischargeOverrideApplied { get; set; }
    public string?  DischargeOverrideReason  { get; set; }
    public Guid?    DischargeOverrideBy      { get; set; }

    // OT return tracking
    public string?  OtReturnReason           { get; set; }

    // Parallel checklist phase rollup (JSONB)
    public string?  ChecklistPhaseStatus     { get; set; }

    // WHO supervisor override before start surgery
    public bool     WhoSupervisorOverrideApplied { get; set; }
    public Guid?    WhoSupervisorOverrideBy        { get; set; }
    public DateTime? WhoSupervisorOverrideAt       { get; set; }

    // Financial snapshot (nullable — may not be set at time of journey creation)
    public decimal?  PackageAmount            { get; set; }
    public decimal?  TotalAdvances            { get; set; }
    public decimal?  TotalPaid                { get; set; }
    // balance_due is GENERATED ALWAYS in DB — read-only here
    public decimal?  BalanceDue               { get; set; }

    // Audit
    public DateTime  CreatedAt              { get; set; }
    public DateTime  UpdatedAt              { get; set; }
    public Guid?     CreatedByUserId        { get; set; }
    public Guid?     UpdatedByUserId        { get; set; }
    public DateTime? DeletedAt             { get; set; }
    public string    Status                { get; set; } = "active";
}

/// <summary>
/// Read-only projection of the shared <c>patients</c> table (owned by auth-service).
/// ExcludeFromMigrations() ensures EF never generates CREATE/DROP TABLE for it.
/// </summary>
public class IpPatient
{
    public Guid      Id                   { get; set; }
    public Guid      TenantId             { get; set; }
    public string?   HealthId             { get; set; }  // UHID / HID-format
    public string?   MedicalRecordNumber  { get; set; }  // MRN-format
    public string    FirstName            { get; set; } = string.Empty;
    public string    LastName             { get; set; } = string.Empty;
    public string?   Gender               { get; set; }
    public DateTime? DateOfBirth          { get; set; }
    public DateTime? DeletedAt            { get; set; }
}
