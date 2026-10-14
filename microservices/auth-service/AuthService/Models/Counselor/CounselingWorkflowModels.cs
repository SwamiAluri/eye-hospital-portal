using System;
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;
using Microsoft.AspNetCore.Mvc.ModelBinding;

namespace AuthService.Models.Counselor
{
    // ============================================================================
    // COUNSELING SESSIONS - DTOs
    // ============================================================================

    public class CounselingSessionDto
    {
        public Guid Id { get; set; }
        public Guid TenantId { get; set; }
        public Guid? BranchId { get; set; }
        public Guid PatientId { get; set; }
        public Guid? VisitId { get; set; }
        public Guid ReferredByDoctorId { get; set; }
        public Guid? CounselorId { get; set; }
        public string? SessionNumber { get; set; }
        public string SessionType { get; set; } = null!;
        public DateTime SessionDate { get; set; }
        public DateTime? SessionStartTime { get; set; }
        public DateTime? SessionEndTime { get; set; }
        public int? DurationMinutes { get; set; }
        public string PatientType { get; set; } = null!;
        public string? ClinicalSummary { get; set; } // JSONB string
        public string? RecommendedSurgery { get; set; }
        public string? RecommendedIol { get; set; }
        public string? IolPower { get; set; }
        /// <summary>JSON array of per-eye procedure selections (multi-procedure).</summary>
        public string? RecommendedProcedures { get; set; }
        public string? Urgency { get; set; }
        public bool PackageDiscussed { get; set; }
        public bool? PatientAgreedToSurgery { get; set; }
        public bool PendingDecision { get; set; }
        public DateTime? DecisionDate { get; set; }
        public string? ReasonsForDelay { get; set; }
        public string Status { get; set; } = null!;

        /// <summary>Phase 3I Slice 7 (PD-S7-01) — optimistic concurrency token. Send back as expected Version on the next mutation.</summary>
        public int Version { get; set; } = 1;

        // Package Selection Data
        public Guid? SelectedPackageId { get; set; }
        public decimal? PackageAmount { get; set; }
        public string? PackageAddonsJson { get; set; }
        
        // Workflow Stage
        public string? CurrentStage { get; set; }
        
        public DateTime CreatedAt { get; set; }

        // Session Outcome — Patient Intention & Anesthesia
        public string? PatientIntention { get; set; }  // WillingWeek, WillingMonth, WillingQuarter, WillingCallToConfirm, Undecided, WaitingFinancial, WaitingFear, Declined, ReferredElsewhere
        public string? SurgeryTimeline { get; set; }
        public string? AnesthesiaTypeChoice { get; set; } // GA, Topical, Local
        public bool AnesthesiaConsent { get; set; }

        // Surgery Tentative Planning
        public DateTime? SurgeryTentativeDate { get; set; }
        public Guid? SurgeryTentativeSurgeonId { get; set; }
        public string? SurgeryTentativeSurgeonName { get; set; } // populated from JOIN
        public string? SurgeryTentativeTimeSlot { get; set; }
        public string? SurgeryTentativeEye { get; set; }

        // Consent Details
        public string? ConsentWitnessName { get; set; }
        public string? ConsentWitnessRelation { get; set; }
        public bool VideoConsentRecorded { get; set; }
        public string? ConsentFormsStatus { get; set; } // JSONB string

        // Session Notes
        public string? AdditionalNotes { get; set; }

        // Attender / Family Member Counseling
        public bool PatientPresent { get; set; } = true;
        public string? AttenderName { get; set; }
        public string? AttenderPhone { get; set; }
        public string? AttenderRelation { get; set; }
        public bool AttenderIsDecisionMaker { get; set; } = false;
        public string? AttenderNotes { get; set; }

        // Display names (populated from JOINs)
        public string? PatientName { get; set; }
        public string? PatientMrn { get; set; }
        public string? DoctorName { get; set; }
        public string? CounselorName { get; set; }
    }

    public class CounselingSessionDetailsDto : CounselingSessionDto
    {
        public List<SessionNoteDto> Notes { get; set; } = new();
        public List<SessionDocumentDto> Documents { get; set; } = new();
        public CounselorQueueItemDto? QueueStatus { get; set; }
        // Patient demographics (populated from patient JOIN)
        public int PatientAge { get; set; }
        public string? PatientGender { get; set; }
        public string? PatientHealthId { get; set; }
        // Stored recommendation rows for this session. Not the full surgery catalog.
        public List<SurgeryPricingDto> SurgeriesWithPricing { get; set; } = new();
        // Pre-op investigation orders placed by counsellor
        public List<InvestigationOrderItemDto> InvestigationOrders { get; set; } = new();
        // Suggested pre-op tests from the doctor's recommended surgery
        public List<MasterCatalogItemDto> SuggestedPreOpTests { get; set; } = new();
        /// <summary>Status of the linked ot_finalize_schedule record (e.g. "SurgeryDone").
        /// Null when no OT record exists or surgery has not been completed.</summary>
        public string? OtStatus { get; set; }
    }

    public class SurgeryPricingDto
    {
        public string Id { get; set; } = string.Empty;
        public string SurgeryName { get; set; } = string.Empty;
        public string Eye { get; set; } = string.Empty;
        public decimal Cost { get; set; }
        public string SurgeryCategory { get; set; } = string.Empty;
        /// <summary>True when the doctor explicitly recommended this surgery for this eye.</summary>
        public bool IsRecommended { get; set; }
    }

    public class MasterCatalogItemDto
    {
        public string Id { get; set; } = string.Empty;
        public string Name { get; set; } = string.Empty;
        public string? Code { get; set; }
        public string? Category { get; set; }
        public string TestType { get; set; } = "Lab"; // Lab | Imaging | Scan
        public decimal Price { get; set; }
    }

    public class InvestigationOrderItemDto
    {
        public string? Id { get; set; }
        public string? CatalogId { get; set; }
        public string TestName { get; set; } = string.Empty;
        public string? TestCode { get; set; }
        public string TestType { get; set; } = "Lab";
        public decimal Price { get; set; }
        public string Urgency { get; set; } = "Routine";
        public string Status { get; set; } = "Pending";
        public string Source { get; set; } = "counsellor"; // "counsellor" | "doctor"
        public string? Eye { get; set; }
    }

    public class SaveInvestigationsRequest
    {
        public List<InvestigationOrderItemDto> Investigations { get; set; } = new();
    }

    public class CreateCounselingSessionRequest
    {
        [Required]
        public Guid TenantId { get; set; }

        public Guid? BranchId { get; set; }

        [Required]
        public Guid PatientId { get; set; }

        public Guid? VisitId { get; set; }

        [Required]
        public Guid ReferredByDoctorId { get; set; }

        public Guid? CounselorId { get; set; }

        [Required]
        [MaxLength(30)]
        public string SessionType { get; set; } = "Initial"; // Initial, Followup, Recheck, Urgent

        public DateTime? SessionDate { get; set; }

        [Required]
        [MaxLength(50)]
        public string PatientType { get; set; } = null!; // Cash, Insurance, CoPay, ESH, CGHS, Arograshree, SGHS, Camp

        public string? ClinicalSummary { get; set; } // JSONB string

        [MaxLength(100)]
        public string? RecommendedSurgery { get; set; }

        [MaxLength(100)]
        public string? RecommendedIol { get; set; }

        [MaxLength(50)]
        public string? IolPower { get; set; }

        /// <summary>JSON array of per-eye procedure selections.</summary>
        public string? RecommendedProcedures { get; set; }

        [MaxLength(20)]
        public string? Urgency { get; set; } // Routine, Urgent, Emergency

        /// <summary>Waiting-list TYPE badge: Surgery | Procedure | Consultation.</summary>
        [MaxLength(30)]
        public string? SessionCategory { get; set; }

        /// <summary>Tentative eye for counselling queue display (RE | LE | BE).</summary>
        [MaxLength(10)]
        public string? SurgeryTentativeEye { get; set; }

        /// <summary>Optional counsellor remarks shown on the waiting list.</summary>
        public string? AdditionalNotes { get; set; }

        // Session Outcome — Patient Intention & Anesthesia
        [MaxLength(50)]
        public string? PatientIntention { get; set; }
        [MaxLength(50)]
        public string? SurgeryTimeline { get; set; }
        [MaxLength(20)]
        public string? AnesthesiaTypeChoice { get; set; }
        public bool AnesthesiaConsent { get; set; } = false;

        // Attender / Family Member Counseling
        public bool PatientPresent { get; set; } = true;
        public string? AttenderName { get; set; }
        [MaxLength(30)]
        public string? AttenderPhone { get; set; }
        [MaxLength(100)]
        public string? AttenderRelation { get; set; }
        public bool AttenderIsDecisionMaker { get; set; } = false;
        public string? AttenderNotes { get; set; }

        public bool AddToQueue { get; set; } = true; // Auto-add to counselor queue
    }

    public class StartCounselingSessionRequest
    {
        /// <summary>Master code from counsellor.session_type (e.g. INITIAL, FOLLOW_UP).</summary>
        [MaxLength(30)]
        public string? SessionType { get; set; }

        /// <summary>Phase 3I Slice 7 (PD-S7-02) — required expected Version. Nullable so missing is distinguishable from 0.</summary>
        public int? Version { get; set; }
    }

    /// <summary>Phase 3I Slice 7 (PD-S7-02) — expected Version body for Complete (no other content today).</summary>
    public class CompleteCounselingSessionRequest
    {
        public int? Version { get; set; }
    }

    /// <summary>Phase 3I Slice 7 (PD-S7-02) — DELETE body, mirrors RolesController RemovePermissions convention.</summary>
    public class DeleteCounselingSessionRequest
    {
        public int? Version { get; set; }
    }

    /// <summary>Phase 3I Slice 7 (PD-S7-02) — expected Version for the refresh-from-OPD write.</summary>
    public class RefreshFromOpdRequest
    {
        public int? Version { get; set; }
    }

    public class UpdateCounselingSessionRequest
    {
        /// <summary>Master code from counsellor.session_type (e.g. INITIAL, FOLLOW_UP).</summary>
        [MaxLength(30)]
        public string? SessionType { get; set; }

        /// <summary>Phase 3I Slice 7 (PD-S7-02) — required expected Version. Nullable so missing is distinguishable from 0.</summary>
        public int? Version { get; set; }

        public Guid? CounselorId { get; set; }
        public DateTime? SessionStartTime { get; set; }
        public DateTime? SessionEndTime { get; set; }
        public string? ClinicalSummary { get; set; }
        public string? RecommendedSurgery { get; set; }
        public string? RecommendedIol { get; set; }
        public string? IolPower { get; set; }
        /// <summary>JSON array of per-eye procedure selections.</summary>
        public string? RecommendedProcedures { get; set; }
        public string? Urgency { get; set; }
        
        // Patient Type (Controlled Mutability - updateable until Financial stage)
        [MaxLength(50)]
        public string? PatientType { get; set; } // Cash, Insurance, CoPay, ESH, CGHS, Arograshree, SGHS, Camp
        
        // Package Selection Data
        public Guid? SelectedPackageId { get; set; }
        public decimal? PackageAmount { get; set; }
        public string? PackageAddonsJson { get; set; } // JSON string of Dictionary<string, bool>
        
        // Workflow Stage Tracking
        [MaxLength(50)]
        public string? CurrentStage { get; set; } // Initial, ClinicalReview, PackageSelection, Financial, etc.
        
        public bool? PackageDiscussed { get; set; }
        public bool? PatientAgreedToSurgery { get; set; }
        public bool? PendingDecision { get; set; }
        public DateTime? DecisionDate { get; set; }
        public string? ReasonsForDelay { get; set; }
        public string? Status { get; set; } // Scheduled, InProgress, Completed, Cancelled, NoShow

        // Surgery Tentative Planning (from SurgerySchedulingWidget)
        public DateTime? SurgeryTentativeDate { get; set; }
        public Guid? SurgeryTentativeSurgeonId { get; set; }
        public string? SurgeryTentativeTimeSlot { get; set; }
        public string? SurgeryTentativeEye { get; set; }

        // Consent Details (from ConsentSigningWidget)
        public string? ConsentWitnessName { get; set; }
        public string? ConsentWitnessRelation { get; set; }
        public bool? VideoConsentRecorded { get; set; }
        public string? ConsentFormsStatus { get; set; } // JSONB string: { surgicalConsent: bool, anaesthesiaConsent: bool, ... }
        public bool? ConsentFormsSigned { get; set; } // shorthand trigger for all consents

        // Session Outcome — Patient Intention & Anesthesia
        [MaxLength(50)]
        public string? PatientIntention { get; set; }
        [MaxLength(50)]
        public string? SurgeryTimeline { get; set; }
        [MaxLength(20)]
        public string? AnesthesiaTypeChoice { get; set; }
        public bool? AnesthesiaConsent { get; set; }

        // Session Notes (from SessionNotesWidget)
        public string? AdditionalNotes { get; set; }

        // Attender / Family Member Counseling
        public bool? PatientPresent { get; set; }
        public string? AttenderName { get; set; }
        public string? AttenderPhone { get; set; }
        public string? AttenderRelation { get; set; }
        public bool? AttenderIsDecisionMaker { get; set; }
        public string? AttenderNotes { get; set; }

        /// <summary>
        /// Field-level changes computed by the frontend for audit trail.
        /// Each entry records one field that changed: its name, old and new value.
        /// Stored in counseling_session_audit_log with ChangeType = "FieldChanged"
        /// and Reason = fieldName (no schema change needed).
        /// </summary>
        public List<FieldChangeItem>? FieldChanges { get; set; }
    }

    /// <summary>Records a single field-level change for session audit history.</summary>
    public class FieldChangeItem
    {
        public string FieldName { get; set; } = null!;
        public string OldValue { get; set; } = string.Empty;
        public string NewValue { get; set; } = string.Empty;
    }

    public class SessionFilters
    {
        public Guid? TenantId { get; set; }
        public Guid? BranchId { get; set; }

        /// <summary>
        /// Server-resolved authorized branch scope (PD16 / Phase2Z F-04).
        /// Never bind from client query — set only by the controller after FollowupBranchAccessService.
        /// </summary>
        [BindNever]
        public IReadOnlyList<Guid>? AccessibleBranchIds { get; set; }

        public Guid? PatientId { get; set; }
        public Guid? CounselorId { get; set; }
        public Guid? ReferredByDoctorId { get; set; }
        public string? SessionType { get; set; }
        public string? PatientType { get; set; }
        
        // Single status (backward compatibility)
        public string? Status { get; set; }
        
        // Multiple statuses (Phase 4.2 - Advanced Filters)
        public List<string>? Statuses { get; set; }
        
        // Urgency filters (Phase 4.2)
        public List<string>? Urgencies { get; set; } // Routine, Urgent, Emergency
        
        // Quick filter presets (Phase 4.2)
        public string? QuickFilter { get; set; } // urgent, today, overdue, pending

        /// <summary>
        /// Phase 3I Slice 12 — Reassignment Required operational filter (PD-S12-14).
        /// When true: operationally open sessions whose CounselorId belongs to an unavailable counsellor.
        /// Not a counselling lifecycle Status.
        /// </summary>
        public bool? ReassignmentRequired { get; set; }
        
        public DateTime? SessionDateFrom { get; set; }
        public DateTime? SessionDateTo { get; set; }
        public bool? PendingDecision { get; set; }
        public bool? PatientAgreedToSurgery { get; set; }
        public string? RecommendedSurgery { get; set; }
        public string? Search { get; set; } // Search session number or patient name
        public int Page { get; set; } = 1;
        public int PageSize { get; set; } = 20;
    }

    public class SessionListResponse
    {
        public List<CounselingSessionDto> Sessions { get; set; } = new();
        public int TotalCount { get; set; }
        public int Page { get; set; }
        public int PageSize { get; set; }
        public int TotalPages { get; set; }
    }

    // ============================================================================
    // COUNSELOR QUEUE - DTOs
    // ============================================================================

    public class CounselorQueueItemDto
    {
        public Guid Id { get; set; }
        public Guid TenantId { get; set; }
        public Guid BranchId { get; set; }
        public Guid SessionId { get; set; }
        public Guid PatientId { get; set; }
        public string TokenNumber { get; set; } = null!;
        public string QueueType { get; set; } = null!;
        public int QueuePosition { get; set; }
        public decimal PriorityScore { get; set; }
        public string? UrgencyLevel { get; set; }
        public DateTime AddedToQueueAt { get; set; }
        public int? EstimatedWaitMinutes { get; set; }
        public DateTime? CalledAt { get; set; }
        public DateTime? StartedAt { get; set; }
        public DateTime? CompletedAt { get; set; }
        public int? ActualWaitMinutes { get; set; }
        public string Status { get; set; } = null!;
        public DateTime CreatedAt { get; set; }

        // Display names
        public string? PatientName { get; set; }
        public string? SessionNumber { get; set; }

        // Counselor assignment (joined from counseling_sessions)
        public Guid? CounselorId { get; set; }
        public string? CounselorName { get; set; }
        public string? SessionType { get; set; }
        public string? PatientType { get; set; }
    }

    public class QueueListResponse
    {
        public List<CounselorQueueItemDto> QueueItems { get; set; } = new();
        public int TotalCount { get; set; }
        public int WaitingCount { get; set; }
        public int InProgressCount { get; set; }
        public int CompletedTodayCount { get; set; }
    }

    public class AddToQueueRequest
    {
        [Required]
        public Guid TenantId { get; set; }

        [Required]
        public Guid BranchId { get; set; }

        [Required]
        public Guid SessionId { get; set; }

        [Required]
        public Guid PatientId { get; set; }

        [MaxLength(30)]
        public string QueueType { get; set; } = "Counseling";

        [MaxLength(20)]
        public string? UrgencyLevel { get; set; } // Low, Normal, High, Critical

        public int? EstimatedWaitMinutes { get; set; }
    }

    public class UpdateQueueItemRequest
    {
        [Required]
        [MaxLength(30)]
        public string Status { get; set; } = null!; // Waiting, Called, InProgress, Completed, Cancelled, NoShow
    }

    public class CallNextPatientRequest
    {
        [Required]
        public Guid BranchId { get; set; }

        public Guid? CounselorId { get; set; } // Optional: specific counselor
    }

    public class CallNextPatientResponse
    {
        public bool Success { get; set; }
        public string Message { get; set; } = null!;
        public CounselorQueueItemDto? QueueItem { get; set; }
        public CounselingSessionDto? Session { get; set; }
    }

    // ============================================================================
    // SESSION NOTES - DTOs
    // ============================================================================

    public class SessionNoteDto
    {
        public Guid Id { get; set; }
        public Guid TenantId { get; set; }
        public Guid SessionId { get; set; }
        public string? NoteType { get; set; }
        public string NoteText { get; set; } = null!;
        public bool IsConfidential { get; set; }
        public string[]? Tags { get; set; }
        public DateTime CreatedAt { get; set; }
        public Guid CreatedByUserId { get; set; }
        public string? CreatedByUserName { get; set; }
    }

    public class CreateSessionNoteRequest
    {
        [Required]
        public Guid TenantId { get; set; }

        [Required]
        public Guid SessionId { get; set; }

        [MaxLength(30)]
        public string? NoteType { get; set; } // General, PatientEducation, CostDiscussion, Concerns, FollowupPlan, Internal

        [Required]
        public string NoteText { get; set; } = null!;

        public bool IsConfidential { get; set; } = false;

        public string[]? Tags { get; set; }
    }

    public class UpdateSessionNoteRequest
    {
        public string? NoteType { get; set; }
        public string? NoteText { get; set; }
        public bool? IsConfidential { get; set; }
        public string[]? Tags { get; set; }
    }

    // ============================================================================
    // SESSION DOCUMENTS - DTOs
    // ============================================================================

    /// <summary>
    /// Patient 360 counselling session context. Approved R-C1 fields only.
    /// </summary>
    public class Patient360CounsellingSessionMetadataDto
    {
        public Guid Id { get; set; }
        public string? SessionNumber { get; set; }
        public string SessionType { get; set; } = null!;
        public DateTime SessionDate { get; set; }
        public DateTime? SessionStartTime { get; set; }
        public DateTime? SessionEndTime { get; set; }
        public string Status { get; set; } = null!;
        public string CounsellorName { get; set; } = "";
    }

    /// <summary>Patient 360 metadata. No file path or storage URL.</summary>
    public class CounselingDocumentPatientMetadataDto
    {
        public Guid Id { get; set; }
        /// <summary>Session id for session-owned docs; null for patient-level Counselling docs.</summary>
        public Guid? SessionId { get; set; }
        public string DocumentName { get; set; } = null!;
        public string? DocumentType { get; set; }
        public string Status { get; set; } = null!;
        public DateTime CreatedAt { get; set; }
        public DateTime? UpdatedAt { get; set; }
        public string? FileType { get; set; }
        public long? FileSizeBytes { get; set; }
        /// <summary>Canonical document id when counselling association exists; otherwise null.</summary>
        public Guid? CanonicalDocumentId { get; set; }

        /// <summary>Uploader identity for creator-owned remove.</summary>
        public Guid CreatedByUserId { get; set; }
    }

    /// <summary>Paged counselling document metadata. No file path.</summary>
    public class CounselingDocumentPatientMetadataPage
    {
        public List<CounselingDocumentPatientMetadataDto> Documents { get; set; } = new();
        public int TotalCount { get; set; }
        public int PageNumber { get; set; }
        public int PageSize { get; set; }
    }

    public class SessionDocumentDto
    {
        public Guid Id { get; set; }
        public Guid TenantId { get; set; }
        public Guid SessionId { get; set; }
        public string? DocumentType { get; set; }
        public string DocumentName { get; set; } = null!;
        public string? DocumentDescription { get; set; }
        public string FilePath { get; set; } = null!;
        public string? FileType { get; set; }
        public long? FileSizeBytes { get; set; }
        public bool IsVerified { get; set; }
        public Guid? VerifiedByUserId { get; set; }
        public DateTime? VerifiedAt { get; set; }
        public string? VerificationNotes { get; set; }
        public string Status { get; set; } = null!;
        public DateTime CreatedAt { get; set; }
        public Guid CreatedByUserId { get; set; }

        // Display names
        public string? CreatedByUserName { get; set; }
        public string? VerifiedByUserName { get; set; }
    }

    public class CreateSessionDocumentRequest
    {
        [Required]
        public Guid TenantId { get; set; }

        [Required]
        public Guid SessionId { get; set; }

        [MaxLength(50)]
        public string? DocumentType { get; set; } // ReferralLetter, PreviousReport, InsuranceCard, PolicyDocument, IDProof, AddressProof, LabReport, Imaging, Other

        [Required]
        [MaxLength(200)]
        public string DocumentName { get; set; } = null!;

        public string? DocumentDescription { get; set; }

        [Required]
        [MaxLength(500)]
        public string FilePath { get; set; } = null!;

        [MaxLength(50)]
        public string? FileType { get; set; }

        public long? FileSizeBytes { get; set; }
    }

    public class VerifyDocumentRequest
    {
        [Required]
        public bool IsVerified { get; set; }

        public string? VerificationNotes { get; set; }
    }

    /// <summary>Phase 3I Slice 4 — distinguish ownership ACL failures from validation errors.
    /// Slice 7 (PD-S7-06) adds Conflict for stale/missing Version — distinct from Forbidden (403).</summary>
    public enum SessionOperationFailureKind
    {
        NotFound,
        Forbidden,
        BadRequest,
        Conflict,
    }

    public class SessionOperationResult
    {
        public bool Success { get; set; }
        public string Message { get; set; } = null!;
        public Guid? SessionId { get; set; }
        public CounselingSessionDetailsDto? Session { get; set; }
        /// <summary>Set when Success is false so controllers can map 403 / 404 / 400.</summary>
        public SessionOperationFailureKind? FailureKind { get; set; }
    }

    /// <summary>Phase 3I Slice 3 — initial ownership assignment (NULL → target counsellor).</summary>
    public class AssignCounselingSessionRequest
    {
        [Required]
        public Guid CounselorId { get; set; }

        /// <summary>Phase 3I Slice 7 (PD-S7-03) — required expected Version.</summary>
        public int? Version { get; set; }
    }

    /// <summary>Phase 3I — lifecycle ownership claim intents (not general Reassign).</summary>
    public static class CounselingLifecycleClaimIntent
    {
        public const string ReEvaluate = "ReEvaluate";
        public const string StartRepeat = "StartRepeat";
    }

    /// <summary>
    /// Phase 3I — peer counsellor claims a Done/Repeat session for a specific lifecycle intent.
    /// Supports NULL → actor and other-owner → actor. Not general Reassign (PD-REASSIGN-01 / Slice 6).
    /// </summary>
    public class ClaimCounselingSessionForLifecycleRequest
    {
        /// <summary>
        /// Current owner expected by the client.
        /// Null when claiming an unassigned Done/Repeat session; required Guid when already owned.
        /// </summary>
        public Guid? ExpectedCounselorId { get; set; }

        /// <summary>ReEvaluate | StartRepeat</summary>
        [Required]
        [MaxLength(30)]
        public string Intent { get; set; } = null!;

        /// <summary>Phase 3I Slice 7 (PD-S7-03) — required expected Version.</summary>
        public int? Version { get; set; }
    }

    /// <summary>Phase 3I Slice 6 — supervisory General Reassign (owned A → B).</summary>
    public class ReassignCounselingSessionRequest
    {
        /// <summary>Target counsellor B.</summary>
        [Required]
        public Guid CounselorId { get; set; }

        /// <summary>Expected current owner A (optimistic concurrency without Version).</summary>
        [Required]
        public Guid ExpectedCounselorId { get; set; }

        /// <summary>Required concise free-text reason (no reason-code taxonomy).</summary>
        [Required]
        [MaxLength(500)]
        public string Reason { get; set; } = null!;

        /// <summary>Phase 3I Slice 7 (PD-S7-03) — required expected Version.</summary>
        public int? Version { get; set; }
    }

    public enum AssignSessionFailureKind
    {
        NotFound,
        Forbidden,
        Conflict,
        BadRequest,
    }

    public class AssignSessionResult
    {
        public bool Success { get; set; }
        public string Message { get; set; } = null!;
        public Guid? SessionId { get; set; }
        public Guid? CounselorId { get; set; }
        public string? CounselorName { get; set; }
        public AssignSessionFailureKind? FailureKind { get; set; }

        /// <summary>Phase 3I Slice 7 (PD-S7-04) — new Version after a successful ownership mutation.</summary>
        public int? Version { get; set; }
    }

    /// <summary>Phase 3I Slice 8 — ReQueue → NULL / Unassigned result.</summary>
    public class ReQueueSessionResult
    {
        public bool Success { get; set; }
        public string Message { get; set; } = null!;
        public Guid? SessionId { get; set; }
        /// <summary>Always null after successful owned ReQueue; remains null when already unassigned.</summary>
        public Guid? CounselorId { get; set; }
        public AssignSessionFailureKind? FailureKind { get; set; }
        /// <summary>Phase 3I Slice 8 (PD-S8-06) — new Version after a successful ReQueue.</summary>
        public int? Version { get; set; }
        public string? TokenNumber { get; set; }
        public Guid? QueueItemId { get; set; }
    }

    // ============================================================================
    // WAITING LIST - DTOs (Counsellor Desk)
    // ============================================================================

    /// <summary>
    /// Matches the frontend WaitingListPatient interface in counsellors-desk.ts.
    /// Assembled from counselor_queue + counseling_sessions + patient join.
    /// </summary>
    public class WaitingListPatientDto
    {
        public string Id { get; set; } = null!;
        public int SlNo { get; set; }
        public string Uhid { get; set; } = null!;
        public string PatientName { get; set; } = null!;
        public string Eye { get; set; } = string.Empty;
        public string Type { get; set; } = "Surgery"; // "Surgery" | "Procedure"
        public string SurgeryName { get; set; } = string.Empty;
        public string PatientType { get; set; } = null!;
        public int Age { get; set; }
        public string Gender { get; set; } = string.Empty;
        public string Doctor { get; set; } = string.Empty;
        public string Time { get; set; } = null!;
        public string Remarks { get; set; } = string.Empty;
        /// <summary>Mapped from queue status: Waiting→Pending, Called/InProgress→Processed,
        /// Completed+agreed→Done, Completed+not agreed→RepeatCounselling</summary>
        public string Status { get; set; } = null!;
        /// <summary>ISO 8601 follow-up date for RepeatCounselling rows.</summary>
        public string? FollowUpDate { get; set; }
        /// <summary>Reason the patient was not ready: used to display context on RepeatCounselling rows.</summary>
        public string? FollowUpReason { get; set; }
        /// <summary>Previous package name/details before the upgrade (AddOnSurgery rows only).</summary>
        public string? PreviousPackage { get; set; }
        /// <summary>New package name/details after the upgrade (AddOnSurgery rows only).</summary>
        public string? NewPackage { get; set; }
        /// <summary>Price difference = new − previous (AddOnSurgery rows only, negative = downgrade).</summary>
        public decimal? UpgradeDiff { get; set; }
        /// <summary>Active counselling owner (CounselorId). Null = unassigned. Display only — not a visibility filter.</summary>
        public string? CounselorId { get; set; }
        /// <summary>Display name for CounselorId when assigned.</summary>
        public string? CounselorName { get; set; }
        /// <summary>Session/queue branch — UX for Assign picker filtering; not a security boundary.</summary>
        public string? BranchId { get; set; }
        /// <summary>Phase 3I Slice 7 (PD-S7-01) — CounselingSession.Version for ownership mutations from Waiting List.</summary>
        public int Version { get; set; } = 1;
    }

    public class WaitingListFiltersRequest
    {
        public string? FromDate { get; set; }
        public string? ToDate { get; set; }
        public string? PatientName { get; set; }
        public string? Mrd { get; set; }
        public string? Type { get; set; }   // "All" | "Surgery" | "Procedure"
        public string? Status { get; set; } // WaitingListStatus value
        public Guid? BranchId { get; set; }
    }

    // ============================================================================
    // SESSION AUDIT HISTORY - DTOs
    // ============================================================================

    public class SessionAuditEntryDto
    {
        public Guid Id { get; set; }
        public string ChangeType { get; set; } = null!;
        /// <summary>Populated for FieldChanged entries — identifies which field changed (stored in Reason column).</summary>
        public string? FieldName { get; set; }
        public string? OldValue { get; set; }
        public string? NewValue { get; set; }
        public string? Reason { get; set; }
        public Guid ChangedByUserId { get; set; }
        public string? ChangedByName { get; set; }
        public DateTime ChangedAt { get; set; }
    }
}
