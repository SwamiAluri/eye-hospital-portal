namespace IpManagementService.Models.Dtos;

// ─── Billing ──────────────────────────────────────────────────────────────────

public record BillingTransactionDto(
    Guid     Id,
    string   TransactionType,
    string   PaymentMode,
    decimal  Amount,
    string?  ReferenceNumber,
    string?  ReceiptNumber,
    string?  Notes,
    DateTime CreatedAt
);

public record AddBillingTransactionRequest(
    string   TransactionType,  // Advance|Payment|Discount|Refund
    string   PaymentMode,      // Cash|Card|UPI|Insurance|CGHS
    decimal  Amount,
    string?  ReferenceNumber,
    string?  Notes
);

/// <summary>
/// Live coverage &amp; payment status for the Ward Pre-Op step, projected from the
/// CCMS coverage case (read-only; not an editable source of truth).
/// Mirrors CcmsAdmissionValidation / AdmissionCoverageDecision.
/// </summary>
public record PreauthStatusDto(
    bool     Allowed,
    string   WarningLevel,     // "none" | "info" | "warning" | "block"
    string?  WarningMessage,
    string?  BlockReason,
    string?  PreAuthNumber,
    decimal? ApprovedAmount,
    Guid?    CaseId = null,
    string?  CoverageState = null,
    string   Decision = "ALLOW",
    string?  PaymentMode = null,
    bool     IsEmergencyFinancialClearance = false,
    bool     RequiresOverride = false,
    DateTime? LastUpdatedAt = null,
    bool     CcmsUnavailable = false
);

// ─── Intra-Op Notes ───────────────────────────────────────────────────────────

public record IntraOpNoteDto(
    Guid     Id,
    Guid?    PrimarySurgeonId,
    Guid?    AssistantSurgeonId,
    Guid?    AnesthesiologistId,
    Guid?    ScrubNurseId,
    DateTime? SurgeryStartTime,
    DateTime? SurgeryEndTime,
    string?  AnesthesiaType,
    string?  AnesthesiaNotes,
    string?  ProcedurePerformed,
    string?  EyeOperated,
    string?  Findings,
    string?  Complications,
    string?  ImplantUsed,
    string?  ImplantPower,
    int?     BloodLossMl,
    int?     IvFluidMl,
    bool     SpecimenSent,
    string?  SpecimenDetails,
    string   NotesStatus,
    DateTime? SignedAt
);

public record SaveIntraOpNoteRequest(
    Guid?    PrimarySurgeonId,
    Guid?    AssistantSurgeonId,
    Guid?    AnesthesiologistId,
    Guid?    ScrubNurseId,
    DateTime? SurgeryStartTime,
    DateTime? SurgeryEndTime,
    string?  AnesthesiaType,
    string?  AnesthesiaNotes,
    string?  ProcedurePerformed,
    string?  EyeOperated,
    string?  Findings,
    string?  Complications,
    string?  ImplantUsed,
    string?  ImplantPower,
    int?     BloodLossMl,
    int?     IvFluidMl,
    bool     SpecimenSent,
    string?  SpecimenDetails
);
public record IntraOpPresetDto(
    Guid   Id,
    string FieldName,
    string OptionLabel,
    int    DisplayOrder
);
// ─── Post-Op Checklists ───────────────────────────────────────────────────────

public record ChecklistItemDto(Guid Id, string ItemLabel, int ItemOrder, bool IsActive);

public record ChecklistResponseDto(
    Guid     ChecklistItemId,
    string   ItemLabel,
    bool     IsCompleted,
    string?  Notes,
    DateTime? CompletedAt
);

public record SaveChecklistRequest(List<ChecklistResponseItem> Responses);
public record ChecklistResponseItem(Guid ChecklistItemId, bool IsCompleted, string? Notes);

// ─── Post-Op Instructions ─────────────────────────────────────────────────────

public record PostOpInstructionDto(
    Guid     Id,
    string?  Medications,
    string?  ActivityRestrictions,
    string?  DietaryInstructions,
    DateTime? FollowupDate,
    Guid?    FollowupDoctorId,
    string?  EyeCareInstructions,
    string?  WarningSigns,
    bool     IsSaved,
    DateTime? SavedAt
);

public record SavePostOpInstructionRequest(
    string?  Medications,
    string?  ActivityRestrictions,
    string?  DietaryInstructions,
    DateTime? FollowupDate,
    Guid?    FollowupDoctorId,
    string?  EyeCareInstructions,
    string?  WarningSigns
);

// ─── Discharge Summary ────────────────────────────────────────────────────────

public record DischargeSummaryDto(
    Guid     Id,
    string?  ConditionAtDischarge,
    string?  DiagnosisCodes,
    string?  ProceduresPerformed,
    string?  HospitalCourse,
    string?  DischargeInstructions,
    string?  MedicationsOnDischarge,
    string?  FollowUpPlan,
    string   FormatType,
    string   SummaryStatus,
    decimal? FinalBillAmount,
    DateTime? FinalizedAt
);

public record SaveDischargeSummaryRequest(
    string?  ConditionAtDischarge,
    string?  DiagnosisCodes,
    string?  ProceduresPerformed,
    string?  HospitalCourse,
    string?  DischargeInstructions,
    string?  MedicationsOnDischarge,
    string?  FollowUpPlan,
    string   FormatType,
    decimal? FinalBillAmount
);

public record DischargeSummaryPreviewDto(
    string?              Uhid,
    string?              ProcedureName,
    string?              EyeOperated,
    string               ClinicalState,
    DateTime?            SurgeryScheduledAt,
    decimal              PackageAmount,
    decimal              TotalPaid,
    decimal              BalanceDue,
    DischargeSummaryDto? Summary
);

// ─── IOL Return ───────────────────────────────────────────────────────────────

public record IolReturnDto(
    Guid     Id,
    string?  IolPower,
    string?  IolBatch,
    string?  IolBarcode,
    string   Reason,
    DateTime? ReturnedAt
);

public record RecordIolReturnRequest(
    string?  IolPower,
    string?  IolBatch,
    string?  IolBarcode,
    string   Reason
);

// ─── Surgery Note Templates (Format Heads) ────────────────────────────────────

public record SurgeryNoteTemplateDto(
    Guid    Id,
    string  FieldLabel,
    string  FieldType,
    int     FieldOrder,
    bool    IsRequired,
    string? Options,
    bool    IsActive
);

public record SaveSurgeryNoteTemplateRequest(
    string  FieldLabel,
    string  FieldType,
    int     FieldOrder,
    bool    IsRequired,
    string? Options
);

// ─── Audit Log ────────────────────────────────────────────────────────────────

public record JourneyAuditLogDto(
    Guid     Id,
    string   Action,
    string?  StateType,
    string?  OldValue,
    string?  NewValue,
    Guid?    PerformedByUserId,
    DateTime PerformedAt
);

// ─── IOL Barcode Verification ─────────────────────────────────────────────────

public record VerifyIolBarcodeRequest(string Barcode);

public record VerifyIolBarcodeResponse(
    bool    IsValid,
    string? CatalogEntry,
    string? Message
);

// ─── Vital Signs ──────────────────────────────────────────────────────────────

public record VitalSignDto(
    Guid      Id,
    Guid      JourneyId,
    DateTime  RecordedAt,
    decimal?  Temperature,
    int?      BloodPressureSystolic,
    int?      BloodPressureDiastolic,
    int?      PulseRate,
    int?      RespiratoryRate,
    decimal?  OxygenSaturation,
    decimal?  Weight,
    decimal?  Height,
    string?   Notes,
    string?   Context,
    Guid      RecordedByUserId,
    DateTime  CreatedAt
);

public record AddVitalSignRequest(
    DateTime? RecordedAt,
    decimal?  Temperature,
    int?      BloodPressureSystolic,
    int?      BloodPressureDiastolic,
    int?      PulseRate,
    int?      RespiratoryRate,
    decimal?  OxygenSaturation,
    decimal?  Weight,
    decimal?  Height,
    string?   Notes
);

// ─── Nurse Records ────────────────────────────────────────────────────────────

public record NurseRecordDto(
    Guid      Id,
    Guid      JourneyId,
    DateTime  RecordedAt,
    string?   ShiftType,
    string?   NursingNotes,
    string?   MedicationsGiven,
    string?   IntakeOutputNotes,
    int?      PainScore,
    string?   AlertnessLevel,
    Guid      RecordedByUserId,
    DateTime  CreatedAt
);

public record AddNurseRecordRequest(
    DateTime? RecordedAt,
    string?   ShiftType,
    string?   NursingNotes,
    string?   MedicationsGiven,
    string?   IntakeOutputNotes,
    int?      PainScore,
    string?   AlertnessLevel
);

// ─── Update Requests ──────────────────────────────────────────────────────────
public record UpdateVitalSignRequest(
    decimal?  Temperature,
    int?      BloodPressureSystolic,
    int?      BloodPressureDiastolic,
    int?      PulseRate,
    int?      RespiratoryRate,
    decimal?  OxygenSaturation,
    decimal?  Weight,
    decimal?  Height,
    string?   Notes
);

public record UpdateNurseRecordRequest(
    string?   ShiftType,
    string?   NursingNotes,
    string?   MedicationsGiven,
    string?   IntakeOutputNotes,
    int?      PainScore,
    string?   AlertnessLevel
);

// ─── Master Data DTOs ─────────────────────────────────────────────────────────
public record OphthMedicationDto(
    Guid      Id,
    string    GenericName,
    string?   DrugClass,
    string?   Route
);

public record IpIoTypeDto(
    Guid      Id,
    string    Category,
    string    Label,
    string?   Unit,
    int       DisplayOrder
);

