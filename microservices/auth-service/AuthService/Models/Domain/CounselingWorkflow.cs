using System;
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using Microsoft.EntityFrameworkCore;

namespace AuthService.Models.Domain
{
    /// <summary>
    /// Counseling sessions when patients are referred for surgery counseling
    /// Maps to: counseling_sessions table
    /// </summary>
    [Table("counseling_sessions")]
    public class CounselingSession
    {
        [Column("id")]
        public Guid Id { get; set; }

        [Column("tenant_id")]
        public Guid TenantId { get; set; }

        [Column("branch_id")]
        public Guid? BranchId { get; set; }

        // Links
        [Column("patient_id")]
        public Guid PatientId { get; set; }

        [Column("visit_id")]
        public Guid? VisitId { get; set; }

        [Column("referred_by_doctor_id")]
        public Guid ReferredByDoctorId { get; set; }

        [Column("counselor_id")]
        public Guid? CounselorId { get; set; }

        // Session Details
        [Column("session_number")]
        [MaxLength(50)]
        public string? SessionNumber { get; set; }

        [Column("session_type")]
        [MaxLength(30)]
        public string SessionType { get; set; } = "Initial"; // Initial, Followup, Recheck, Urgent, AttenderCounseling

        [Column("session_date", TypeName = "date")]
        public DateTime SessionDate { get; set; }

        [Column("session_start_time")]
        public DateTime? SessionStartTime { get; set; }

        [Column("session_end_time")]
        public DateTime? SessionEndTime { get; set; }

        [Column("duration_minutes")]
        public int? DurationMinutes { get; set; }

        // Patient Type
        [Column("patient_type")]
        [MaxLength(50)]
        public string PatientType { get; set; } = null!; // Cash, Insurance, CoPay, ESH, CGHS, Arograshree, SGHS, Camp

        // Clinical Information (Snapshot from Doctor)
        [Column("clinical_summary", TypeName = "jsonb")]
        public string? ClinicalSummary { get; set; } // JSONB: {diagnosis, chiefComplaint, visualAcuity, iop, etc}

        [Column("recommended_surgery")]
        [MaxLength(100)]
        public string? RecommendedSurgery { get; set; }

        [Column("recommended_iol")]
        [MaxLength(100)]
        public string? RecommendedIol { get; set; }

        [Column("iol_power")]
        [MaxLength(50)]
        public string? IolPower { get; set; }

        /// <summary>
        /// JSON array of per-eye procedure selections (multi-procedure support).
        /// Each element: { eye, surgeryTypeId, surgeryName, surgeryCategory, requiresIol,
        /// iclProcedure, laserProcedure, kcnTreatmentType, iolCatalogId, iolModelName,
        /// iolType, packageId, packageName, unitPrice, notes }
        /// Legacy fields RecommendedSurgery / RecommendedIol kept for backward compatibility.
        /// </summary>
        [Column("recommended_procedures", TypeName = "jsonb")]
        public string? RecommendedProcedures { get; set; }

        [Column("urgency")]
        [MaxLength(20)]
        public string? Urgency { get; set; } // Routine, Urgent, Emergency

        // Package Selection Data (Flow from widget to financial stages)
        [Column("selected_package_id")]
        public Guid? SelectedPackageId { get; set; }

        [Column("package_amount")]
        [Precision(10, 2)]
        public decimal? PackageAmount { get; set; }

        [Column("package_addons_json", TypeName = "text")]
        public string? PackageAddonsJson { get; set; } // JSON serialized Dictionary<string, bool>

        // Workflow Stage for Validation
        [Column("current_stage")]
        [MaxLength(50)]
        public string? CurrentStage { get; set; } // Initial, ClinicalReview, PackageSelection, Financial, Consent, PreSurgery, etc.

        // Session Outcome
        [Column("package_discussed")]
        public bool PackageDiscussed { get; set; } = false;

        [Column("patient_agreed_to_surgery")]
        public bool? PatientAgreedToSurgery { get; set; } = false;

        [Column("pending_decision")]
        public bool PendingDecision { get; set; } = true;

        [Column("decision_date")]
        public DateTime? DecisionDate { get; set; }

        [Column("reasons_for_delay")]
        public string? ReasonsForDelay { get; set; }

        // Surgery Tentative Planning (from SurgerySchedulingWidget)
        [Column("surgery_tentative_date", TypeName = "date")]
        public DateTime? SurgeryTentativeDate { get; set; }

        [Column("surgery_tentative_surgeon_id")]
        public Guid? SurgeryTentativeSurgeonId { get; set; }

        [Column("surgery_tentative_time_slot")]
        [MaxLength(50)]
        public string? SurgeryTentativeTimeSlot { get; set; }

        [Column("surgery_tentative_eye")]
        [MaxLength(20)]
        public string? SurgeryTentativeEye { get; set; }

        /// <summary>
        /// Explicit category for the waiting-list TYPE badge: Surgery | Procedure | Consultation.
        /// Preferred over deriving type purely from null-check on RecommendedSurgery.
        /// </summary>
        [Column("session_category")]
        [MaxLength(20)]
        public string? SessionCategory { get; set; }

        // Session Outcome — Patient Intention & Anesthesia
        [Column("patient_intention")]
        [MaxLength(50)]
        public string? PatientIntention { get; set; }
        // Values: WillingWeek, WillingMonth, WillingQuarter, WillingCallToConfirm,
        //         Undecided, WaitingFinancial, WaitingFear, Declined, ReferredElsewhere

        [Column("surgery_timeline")]
        [MaxLength(50)]
        public string? SurgeryTimeline { get; set; }

        [Column("anesthesia_type_choice")]
        [MaxLength(20)]
        public string? AnesthesiaTypeChoice { get; set; } // GA, Topical, Local

        [Column("anesthesia_consent")]
        public bool AnesthesiaConsent { get; set; } = false;

        // Consent Details (from ConsentSigningWidget)
        [Column("consent_witness_name")]
        [MaxLength(200)]
        public string? ConsentWitnessName { get; set; }

        [Column("consent_witness_relation")]
        [MaxLength(100)]
        public string? ConsentWitnessRelation { get; set; }

        [Column("video_consent_recorded")]
        public bool VideoConsentRecorded { get; set; } = false;

        [Column("consent_forms_status", TypeName = "jsonb")]
        public string? ConsentFormsStatus { get; set; } // JSONB: { surgicalConsent: bool, anaesthesiaConsent: bool, ... }

        // Session Notes (from SessionNotesWidget)
        [Column("additional_notes")]
        public string? AdditionalNotes { get; set; }

        // Attender / Family Member Counseling
        // Tracks who accompanied the patient or attended in their absence
        [Column("patient_present")]
        public bool PatientPresent { get; set; } = true;

        [Column("attender_name")]
        [MaxLength(200)]
        public string? AttenderName { get; set; }

        [Column("attender_phone")]
        [MaxLength(30)]
        public string? AttenderPhone { get; set; }

        [Column("attender_relation")]
        [MaxLength(100)]
        public string? AttenderRelation { get; set; }

        [Column("attender_is_decision_maker")]
        public bool AttenderIsDecisionMaker { get; set; } = false;

        [Column("attender_notes")]
        public string? AttenderNotes { get; set; }

        // Status
        [Column("status")]
        [MaxLength(30)]
        public string Status { get; set; } = "Scheduled"; // Scheduled, InProgress, Completed, Cancelled, NoShow

        // Audit Fields
        [Column("created_at")]
        public DateTime CreatedAt { get; set; }

        [Column("created_by_user_id")]
        public Guid? CreatedByUserId { get; set; }

        [Column("updated_at")]
        public DateTime? UpdatedAt { get; set; }

        [Column("updated_by_user_id")]
        public Guid? UpdatedByUserId { get; set; }

        [Column("deleted_at")]
        public DateTime? DeletedAt { get; set; }

        // ── Escalation & Contact Tracking (Migration 72) ──────────────────────
        [Column("escalation_status")]
        [MaxLength(30)]
        public string EscalationStatus { get; set; } = "Normal";
        // Values: Normal, Overdue, Escalated, SupervisorAlert, Closed

        [Column("last_contact_date", TypeName = "date")]
        public DateTime? LastContactDate { get; set; }

        [Column("contact_attempt_count")]
        public int ContactAttemptCount { get; set; } = 0;

        [Column("last_contact_outcome")]
        [MaxLength(60)]
        public string? LastContactOutcome { get; set; }

        [Column("escalated_at")]
        public DateTime? EscalatedAt { get; set; }

        [Column("escalated_to_user_id")]
        public Guid? EscalatedToUserId { get; set; }

        [Column("escalation_notes")]
        public string? EscalationNotes { get; set; }

        [Column("overdue_since_date", TypeName = "date")]
        public DateTime? OverdueSinceDate { get; set; }

        [Column("sla_breach_at")]
        public DateTime? SlaBreachAt { get; set; }

        // ── Phase 3I Slice 7 — Optimistic Concurrency (PD-S7-01) ──────────────
        /// <summary>Concurrency token. Bumped on every persisted mutation (see AppDbContext.SaveChangesAsync).</summary>
        [ConcurrencyCheck]
        [Column("version")]
        public int Version { get; set; } = 1;

        // Navigation Properties
        public virtual ICollection<CounselorQueueItem> QueueItems { get; set; } = new List<CounselorQueueItem>();
        public virtual ICollection<CounselingSessionNote> Notes { get; set; } = new List<CounselingSessionNote>();
        public virtual ICollection<CounselingSessionDocument> Documents { get; set; } = new List<CounselingSessionDocument>();
        public virtual ICollection<CounselorCommunicationLog> CommunicationLogs { get; set; } = new List<CounselorCommunicationLog>();
        public virtual ICollection<CounselorCallbackRequest> CallbackRequests { get; set; } = new List<CounselorCallbackRequest>();
    }

    /// <summary>
    /// Real-time queue management for counseling sessions
    /// Maps to: counselor_queue table
    /// </summary>
    [Table("counselor_queue")]
    public class CounselorQueueItem
    {
        [Column("id")]
        public Guid Id { get; set; }

        [Column("tenant_id")]
        public Guid TenantId { get; set; }

        [Column("branch_id")]
        public Guid BranchId { get; set; }

        // Session Link
        [Column("session_id")]
        public Guid SessionId { get; set; }

        [Column("patient_id")]
        public Guid PatientId { get; set; }

        // Queue Details
        [Column("token_number")]
        [MaxLength(20)]
        public string TokenNumber { get; set; } = null!;

        [Column("queue_type")]
        [MaxLength(30)]
        public string QueueType { get; set; } = "Counseling";

        [Column("queue_position")]
        public int QueuePosition { get; set; }

        // Priority Calculation
        [Column("priority_score")]
        public decimal PriorityScore { get; set; } = 50.00m;

        [Column("urgency_level")]
        [MaxLength(20)]
        public string? UrgencyLevel { get; set; } // Low, Normal, High, Critical

        // Timing
        [Column("added_to_queue_at")]
        public DateTime AddedToQueueAt { get; set; }

        [Column("estimated_wait_minutes")]
        public int? EstimatedWaitMinutes { get; set; }

        [Column("called_at")]
        public DateTime? CalledAt { get; set; }

        [Column("started_at")]
        public DateTime? StartedAt { get; set; }

        [Column("completed_at")]
        public DateTime? CompletedAt { get; set; }

        [Column("actual_wait_minutes")]
        public int? ActualWaitMinutes { get; set; }

        // Status
        [Column("status")]
        [MaxLength(30)]
        public string Status { get; set; } = "Waiting"; // Waiting, Called, InProgress, Completed, Cancelled, NoShow

        // Audit Fields
        [Column("created_at")]
        public DateTime CreatedAt { get; set; }

        [Column("updated_at")]
        public DateTime? UpdatedAt { get; set; }

        [Column("deleted_at")]
        public DateTime? DeletedAt { get; set; }

        // Navigation Properties
        public virtual CounselingSession? Session { get; set; }
    }

    /// <summary>
    /// Free-text notes recorded during counseling
    /// Maps to: counseling_session_notes table
    /// </summary>
    [Table("counseling_session_notes")]
    public class CounselingSessionNote
    {
        [Column("id")]
        public Guid Id { get; set; }

        [Column("tenant_id")]
        public Guid TenantId { get; set; }

        // Session Link
        [Column("session_id")]
        public Guid SessionId { get; set; }

        // Note Content
        [Column("note_type")]
        [MaxLength(30)]
        public string? NoteType { get; set; } // General, PatientEducation, CostDiscussion, Concerns, FollowupPlan, Internal

        [Column("note_text")]
        public string NoteText { get; set; } = null!;

        // Metadata
        [Column("is_confidential")]
        public bool IsConfidential { get; set; } = false;

        [Column("tags")]
        public string[]? Tags { get; set; } // TEXT[] - ['IOL Selection', 'Insurance Query', 'Cost Concern']

        // Audit Fields
        [Column("created_at")]
        public DateTime CreatedAt { get; set; }

        [Column("created_by_user_id")]
        public Guid CreatedByUserId { get; set; }

        [Column("updated_at")]
        public DateTime? UpdatedAt { get; set; }

        [Column("updated_by_user_id")]
        public Guid? UpdatedByUserId { get; set; }

        [Column("deleted_at")]
        public DateTime? DeletedAt { get; set; }

        // Navigation Properties
        public virtual CounselingSession? Session { get; set; }
    }

    /// <summary>
    /// Documents uploaded during counseling (referrals, reports, insurance cards)
    /// Maps to: counseling_session_documents table
    /// </summary>
    [Table("counseling_session_documents")]
    public class CounselingSessionDocument
    {
        [Column("id")]
        public Guid Id { get; set; }

        [Column("tenant_id")]
        public Guid TenantId { get; set; }

        // Session Link
        [Column("session_id")]
        public Guid SessionId { get; set; }

        // Document Details
        [Column("document_type")]
        [MaxLength(50)]
        public string? DocumentType { get; set; } // ReferralLetter, PreviousReport, InsuranceCard, PolicyDocument, IDProof, AddressProof, LabReport, Imaging, Other

        [Column("document_name")]
        [MaxLength(200)]
        public string DocumentName { get; set; } = null!;

        [Column("document_description")]
        public string? DocumentDescription { get; set; }

        // File Storage
        [Column("file_path")]
        [MaxLength(500)]
        public string FilePath { get; set; } = null!;

        [Column("file_type")]
        [MaxLength(50)]
        public string? FileType { get; set; } // PDF, JPEG, PNG, DOCX

        [Column("file_size_bytes")]
        public long? FileSizeBytes { get; set; }

        // Verification
        [Column("is_verified")]
        public bool IsVerified { get; set; } = false;

        [Column("verified_by_user_id")]
        public Guid? VerifiedByUserId { get; set; }

        [Column("verified_at")]
        public DateTime? VerifiedAt { get; set; }

        [Column("verification_notes")]
        public string? VerificationNotes { get; set; }

        // Status
        [Column("status")]
        [MaxLength(20)]
        public string Status { get; set; } = "active";

        // Audit Fields
        [Column("created_at")]
        public DateTime CreatedAt { get; set; }

        [Column("created_by_user_id")]
        public Guid CreatedByUserId { get; set; }

        [Column("updated_at")]
        public DateTime? UpdatedAt { get; set; }

        [Column("updated_by_user_id")]
        public Guid? UpdatedByUserId { get; set; }

        [Column("deleted_at")]
        public DateTime? DeletedAt { get; set; }

        // Navigation Properties
        public virtual CounselingSession? Session { get; set; }
    }

    /// <summary>
    /// Audit log for counseling session changes (patient type changes, stage transitions, etc.)
    /// Maps to: counseling_session_audit_log table
    /// </summary>
    [Table("counseling_session_audit_log")]
    public class CounselingSessionAuditLog
    {
        [Column("id")]
        public Guid Id { get; set; }

        [Column("tenant_id")]
        public Guid TenantId { get; set; }

        [Column("session_id")]
        public Guid SessionId { get; set; }

        [Column("change_type")]
        [MaxLength(50)]
        public string ChangeType { get; set; } = null!; // PatientTypeChanged, StatusChanged, StageTransition

        [Column("old_value")]
        public string? OldValue { get; set; }

        [Column("new_value")]
        public string? NewValue { get; set; }

        [Column("reason")]
        public string? Reason { get; set; }

        [Column("changed_by_user_id")]
        public Guid ChangedByUserId { get; set; }

        [Column("changed_at")]
        public DateTime ChangedAt { get; set; }

        // Navigation Properties
        public virtual CounselingSession? Session { get; set; }
    }
}
