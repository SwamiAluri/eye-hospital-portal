namespace IpManagementService.Models.Dtos;

// ─── Pre-Op Section Items ─────────────────────────────────────────────────────

public record PreOpSectionItemDto(
    Guid    Id,
    string  Category,
    string  ItemKey,
    string  ItemLabel,
    string? Description,
    string? DepartmentOwner,
    bool    IsMandatory,
    bool    IsBlocking,
    bool    RequiresDocument,
    string? PatientTypeFilter,
    string? SurgeryTypeFilter,
    int     DisplayOrder
);

// ─── Pre-Op Clearance ─────────────────────────────────────────────────────────

public record PreOpClearanceDto(
    Guid     Id,
    Guid     JourneyId,
    string?  PaymentModeSnapshot,
    Guid?    InsurancePreauthId,
    string   OverallStatus,
    bool     OverallClearance,
    bool     IsDeferred,
    string?  DeferredReason,
    DateTime? ClearedAt,
    Guid?    ClearedByUserId,
    string?  ClearanceNotes,
    DateTime CreatedAt,
    DateTime UpdatedAt
);

// ─── Pre-Op Completion ────────────────────────────────────────────────────────

public record PreOpCompletionDto(
    Guid     Id,
    Guid     ClearanceId,
    Guid     ItemId,
    string   ItemKey,
    string   ItemLabel,
    string   Category,
    bool     IsBlocking,
    bool     RequiresDocument,
    bool     IsCompleted,
    bool     IsBypassed,
    string?  BypassReason,
    string?  Notes,
    Guid?    DocumentId,
    Guid?    CompletedByUserId,
    DateTime? CompletedAt,
    DateTime UpdatedAt,
    string?  FormCode,
    string?  Source,
    // Fasting & Medication v2 — typed result columns + attribution (data governance).
    // Appended with defaults so existing positional constructors stay valid.
    string?  ResultValue = null,
    string?  ResultUnit = null,
    string?  EntryStatus = null,
    DateTime? EnteredAt = null,
    string?  CompletedByRole = null
);

// ─── Pre-Op Document ──────────────────────────────────────────────────────────

public record PreOpDocumentDto(
    Guid     Id,
    Guid     ClearanceId,
    string   DocumentType,
    string   FileName,
    string   FileUrl,
    string?  ContentType,
    long?    FileSizeBytes,
    bool     IsVerified,
    Guid?    VerifiedByUserId,
    DateTime? VerifiedAt,
    string?  Notes,
    Guid?    UploadedByUserId,
    DateTime CreatedAt
);

// ─── Pre-Op Consent Detail (medico-legal signatory record) ────────────────────

/// <summary>
/// Structured signatory record for a Consent-category completion (1:1). Keyed to
/// the completion via <see cref="CompletionId"/>; the frontend matches it to the
/// matching <see cref="PreOpCompletionDto"/> to surface "signed by · when".
/// </summary>
public record PreOpConsentDetailDto(
    Guid      Id,
    Guid      CompletionId,
    bool      PatientSigned,
    string?   WitnessName,
    string?   WitnessRelation,
    Guid?     SurgeonUserId,
    string?   SurgeonName,
    string?   ConsentVersion,
    string    Method,
    DateTime? SignedAt,
    Guid?     CapturedByUserId,
    string?   CapturedByName,
    DateTime? RevokedAt,
    string?   RevokedReason
);

// ─── Aggregated View ──────────────────────────────────────────────────────────

/// <summary>
/// Full pre-op snapshot returned by GET /journeys/{id}/pre-op/clearance.
/// Contains clearance header + all completion items + documents + pre-op vitals.
/// </summary>
public record PreOpClearanceDetailDto(
    PreOpClearanceDto            Clearance,
    List<PreOpCompletionDto>     Completions,
    List<PreOpDocumentDto>       Documents,
    List<VitalSignDto>           PreOpVitals,
    // Computed helpers for the frontend
    int                          TotalItems,
    int                          CompletedItems,
    int                          BlockingIncomplete,
    bool                         ReadyToAdmit,
    // Per-section dept coordination (empty array = all NotRequested)
    List<PreOpSectionClearanceDto> SectionClearances,
    // Structured consent signatory records, keyed by CompletionId (Phase consent-redesign)
    List<PreOpConsentDetailDto>  ConsentDetails
);

// ─── Requests ─────────────────────────────────────────────────────────────────

/// <summary>Initialise a pre-op clearance row when the Admit button is first clicked.</summary>
public record InitPreOpClearanceRequest(
    string?  PaymentModeSnapshot,
    Guid?    InsurancePreauthId
);

/// <summary>Save completion status for one or many checklist items.</summary>
public record SavePreOpCompletionRequest(
    Guid     ItemId,
    bool     IsCompleted,
    bool     IsBypassed,
    string?  BypassReason,
    string?  Notes,
    Guid?    DocumentId,
    // Typed result columns (optional; defaults keep existing 6-arg call sites valid).
    // For `last_food_time` this carries the ISO intake timestamp (ResultValue) and the
    // intake type (ResultUnit: clear|light|solid) used to derive fasting confirmation.
    string?  ResultValue = null,
    string?  ResultUnit = null
);

/// <summary>Batch-save completions in one request.</summary>
public record BatchSavePreOpCompletionsRequest(
    List<SavePreOpCompletionRequest> Items
);

/// <summary>
/// Capture a structured consent signatory record and mark the consent completion done.
/// Surgical consent requires a linked signed document (DocumentId).
/// </summary>
public record CaptureConsentRequest(
    bool      PatientSigned,
    string?   WitnessName,
    string?   WitnessRelation,
    Guid?     SurgeonUserId,
    string?   ConsentVersion,
    string?   Method,
    DateTime? SignedAt,
    Guid?     DocumentId,
    string?   Notes
);

/// <summary>
/// Withdraw a previously captured consent (patient / guardian right to revoke).
/// Clears the completion and stamps the medico-legal revoke columns. A reason is
/// mandatory for the audit trail.
/// </summary>
public record RevokeConsentRequest(
    string    Reason
);

/// <summary>Request body for recording pre-op vitals (subset of full vitals).</summary>
public record AddPreOpVitalRequest(
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

/// <summary>Mark a document as verified by a doctor / admin.</summary>
public record VerifyPreOpDocumentRequest(
    bool     IsVerified,
    string?  Notes
);

/// <summary>Approve pre-op clearance and transition journey to Admitted.</summary>
public record ApprovePreOpClearanceRequest(
    Guid?    WardId,
    string?  AdmissionType,
    Guid?    AdmittingDoctorId,
    string?  BedNumber,
    string?  RoomNumber,
    string?  AttendantName,
    string?  AttendantPhone,
    string?  AttendantRelationship,
    Guid?    PrimaryNurseId,
    Guid?    PrimarySurgeonId,
    string?  ClearanceNotes,
    bool     IsEmergency    = false,
    string?  EmergencyReason = null
);

/// <summary>Defer pre-op clearance without cancelling the journey.</summary>
public record DeferPreOpClearanceRequest(
    string   DeferredReason
);

/// <summary>
/// Upload a document as base64-encoded content.
/// fileData must be a valid Base64 string.
/// </summary>
public record UploadPreOpDocumentRequest(
    string   DocumentType,   // ConsentForm|LabReport|ImagingReport|InsuranceCard|GovernmentCard|FitnessCertificate|IdentityProof|Other
    string   FileName,
    string   ContentType,    // MIME type, e.g. application/pdf
    string   FileData        // Base64-encoded file content
);

// ─── Pre-Op Section Clearance ─────────────────────────────────────────────────

/// <summary>
/// Per-section coordination status returned inside PreOpClearanceDetailDto.SectionClearances.
/// A missing entry (not yet requested) is treated as status = "NotRequested" by the UI.
/// </summary>
public record PreOpSectionClearanceDto(
    Guid      Id,
    Guid      ClearanceId,
    /// <summary>The patient journey ID — required by the frontend to call respond/confirm endpoints.</summary>
    Guid      JourneyId,
    string    SectionCategory,
    string    ResponsibleDepartmentCode,
    /// <summary>NotRequested | Requested | RespondedClear | RespondedConcerns | WardConfirmed | OnHold | Rejected | NeedsInfo | Escalated</summary>
    string    Status,
    Guid?     RequestedByUserId,
    DateTime? RequestedAt,
    Guid?     RespondedByUserId,
    DateTime? RespondedAt,
    string?   ResponseNotes,
    bool      IsExternalResponder,
    string?   ExternalResponderName,
    string?   ExternalResponderContact,
    Guid?     ConfirmedByUserId,
    DateTime? ConfirmedAt,
    string?   ConfirmationNotes,
    DateTime  CreatedAt,
    DateTime  UpdatedAt,
    string    Urgency         = "Normal",
    string?   RejectionReason = null,
    /// <summary>Computed UI rollup (G3 / R4.2) — mirrors FE SectionDisplayStatus.</summary>
    string?   SectionDisplayStatus = null
);

/// <summary>Ward nurse requests a section from the responsible department.</summary>
public record RequestPreOpSectionRequest(
    // No additional body fields required — category is in the URL path
    string? Notes    = null,
    string  Urgency  = "Normal"
);

/// <summary>Dept user puts a section on hold (e.g. awaiting equipment, pending availability).</summary>
public record PutSectionOnHoldRequest(
    string Reason
);

/// <summary>Dept user rejects a section (patient not cleared / contraindicated).</summary>
public record RejectSectionRequest(
    string RejectionReason,
    string? Notes = null
);

/// <summary>Dept user flags that more info is needed from the ward before they can respond.</summary>
public record RequestMoreInfoRequest(
    string InfoNeeded
);

/// <summary>Ward nurse or dept user escalates a section to a senior / supervisor.</summary>
public record EscalateSectionRequest(
    string Reason,
    string Urgency = "High"
);

/// <summary>Department user (or ward nurse logging external response) responds to a section request.</summary>
public record RespondPreOpSectionRequest(
    /// <summary>RespondedClear | RespondedConcerns</summary>
    string   ResponseStatus,
    string?  ResponseNotes,
    /// <summary>True when logging a response on behalf of an external anaesthesiologist.</summary>
    bool     IsExternalResponder    = false,
    string?  ExternalResponderName  = null,
    string?  ExternalResponderContact = null
);

/// <summary>Ward nurse confirms the department's response for a section.</summary>
public record ConfirmPreOpSectionRequest(
    string? ConfirmationNotes = null
);

/// <summary>Ward clinical evaluation material change (IOL / diagnosis) — triggers downstream notifications.</summary>
public record ClinicalEvaluationNotifyRequest(
    string ChangeType,
    string? PreviousIolId = null,
    string? NewIolId = null,
    string? Reason = null,
    bool InOt = false
);

/// <summary>Doctor unlocks a signed clinical evaluation for amendment.</summary>
public record AmendClinicalEvaluationRequest(
    string Reason,
    string Category,
    bool InOt = false
);
