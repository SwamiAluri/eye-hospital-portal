using System;
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;

namespace AuthService.Models.Counselor
{
    // ============================================================================
    // COMMUNICATION LOG DTOs (Migration 69)
    // ============================================================================

    public class CommLogDto
    {
        public Guid Id { get; set; }
        public Guid SessionId { get; set; }
        public Guid PatientId { get; set; }
        public Guid CounselorId { get; set; }
        public string Channel { get; set; } = null!;
        public string Direction { get; set; } = null!;
        public DateTime CommunicationAt { get; set; }
        public string Outcome { get; set; } = null!;
        public int? CallDurationMinutes { get; set; }
        public string? MessageBody { get; set; }
        public string? ResponseSummary { get; set; }
        public string? NextAction { get; set; }
        public DateTime? NextActionDate { get; set; }
        public Guid? TemplateId { get; set; }
        public DateTime CreatedAt { get; set; }
        public Guid CreatedByUserId { get; set; }

        /// <summary>Phase 3I Slice 7 (PD-S7-02 / M18) — CounselingSession.Version after this comm log's session-field update.</summary>
        public int SessionVersion { get; set; }
    }

    public class CreateCommLogRequest
    {
        /// <summary>Phase 3I Slice 7 (PD-S7-02 / M18) — required expected CounselingSession Version.</summary>
        public int? Version { get; set; }

        [Required]
        public string Channel { get; set; } = null!; // Phone | SMS | WhatsApp | Email | InPerson | VideoCall

        [Required]
        public string Direction { get; set; } = "Outbound"; // Outbound | Inbound

        public DateTime? CommunicationAt { get; set; } // defaults to now

        [Required]
        public string Outcome { get; set; } = null!;

        public int? CallDurationMinutes { get; set; }
        public string? MessageBody { get; set; }
        public string? ResponseSummary { get; set; }
        public string? NextAction { get; set; }
        public DateTime? NextActionDate { get; set; }
        public Guid? TemplateId { get; set; }
    }

    // ============================================================================
    // CALLBACK REQUEST DTOs (Migration 70)
    // ============================================================================

    public class CallbackRequestDto
    {
        public Guid Id { get; set; }
        public Guid SessionId { get; set; }
        public Guid PatientId { get; set; }
        public Guid BranchId { get; set; }
        public Guid AssignedToUserId { get; set; }
        public string CallbackType { get; set; } = null!;
        public string Channel { get; set; } = null!;
        public DateTime CallbackDate { get; set; }
        public TimeSpan? CallbackTime { get; set; }
        public string? CallbackNotes { get; set; }
        public string? PatientPreferredTime { get; set; }
        public string CallbackStatus { get; set; } = null!;
        public DateTime? CompletedAt { get; set; }
        public string? OutcomeNotes { get; set; }
        public string? Outcome { get; set; }
        public short Priority { get; set; }
        public DateTime CreatedAt { get; set; }
    }

    public class ScheduleCallbackRequest
    {
        [Required]
        public string CallbackType { get; set; } = "General"; // PreSurgery | PostSurgery | General | Financial | FearAnxiety | DelayReason | InsuranceFollowup | DecisionPending

        [Required]
        public DateTime CallbackDate { get; set; }

        public string Channel { get; set; } = "Phone";
        public TimeSpan? CallbackTime { get; set; }
        public string? CallbackNotes { get; set; }
        public string? PatientPreferredTime { get; set; }
        public Guid? AssignedToUserId { get; set; } // defaults to current user if null
        public short Priority { get; set; } = 2;
    }

    public class CompleteCallbackRequest
    {
        [Required]
        public string Outcome { get; set; } = null!;
        public string? OutcomeNotes { get; set; }
    }

    public class RescheduleCallbackRequest
    {
        [Required]
        public DateTime NewCallbackDate { get; set; }
        public TimeSpan? NewCallbackTime { get; set; }
        public string? RescheduleReason { get; set; }
        public Guid? AssignedToUserId { get; set; }
    }

    // ============================================================================
    // OVERDUE SESSIONS DTO
    // ============================================================================

    public class OverdueSessionDto
    {
        public Guid SessionId { get; set; }
        public string? SessionNumber { get; set; }
        public Guid PatientId { get; set; }
        public string? PatientName { get; set; }
        public string? PatientPhone { get; set; }
        public string PatientType { get; set; } = null!;
        public string? SessionStage { get; set; }
        public DateTime? LastContactDate { get; set; }
        public int DaysSinceLastContact { get; set; }
        public int ContactAttemptCount { get; set; }
        public string? LastContactOutcome { get; set; }
        public string EscalationStatus { get; set; } = "Overdue";
        public Guid? BranchId { get; set; }
        public Guid? CounselorId { get; set; }
    }

    // ============================================================================
    // QUICK BOOK SURGERY DTO (from counseling session)
    // ============================================================================

    public class QuickBookFromSessionRequest
    {
        /// <summary>Phase 3I Slice 7 (PD-S7-02) — required expected CounselingSession Version.</summary>
        public int? Version { get; set; }

        [Required]
        public Guid SurgeonId { get; set; }

        [Required]
        public Guid TheaterId { get; set; }

        [Required]
        public DateTime ScheduledDate { get; set; }

        [Required]
        public string StartTime { get; set; } = null!; // "HH:mm"

        public int EstimatedDurationMinutes { get; set; } = 60;

        [Required]
        public string Eye { get; set; } = null!; // Left | Right | Both

        public string? Notes { get; set; }
    }

    // ============================================================================
    // RE-QUEUE TO COUNSELOR WAITING LIST (Follow-up Center)
    // ============================================================================

    public class ReQueueSessionRequest
    {
        /// <summary>Phase 3I Slice 8 (PD-S8-06) — required expected CounselingSession.Version.</summary>
        public int? Version { get; set; }

        /// <summary>
        /// Phase 3I Slice 8 (PD-S8-14) — expected current owner.
        /// Null when the session is already unassigned.
        /// </summary>
        public Guid? ExpectedCounselorId { get; set; }

        /// <summary>Phase 3I Slice 8 (PD-S8-08) — required concise requeue reason (ownership trail).</summary>
        [Required]
        public string Reason { get; set; } = null!;

        /// <summary>Updated patient intention, e.g. WillingCallToConfirm, WillingWeek etc.</summary>
        public string? NewIntention { get; set; }

        /// <summary>Optional notes appended to the session's AdditionalNotes.</summary>
        public string? Notes { get; set; }

        /// <summary>Master code from counsellor.session_type for the re-queued round.</summary>
        [MaxLength(30)]
        public string? SessionType { get; set; }
    }

    // ============================================================================
    // SEND REMINDER / NOTIFICATION (Follow-up Center)
    // ============================================================================

    public class SendReminderRequest
    {
        /// <summary>Channel: SMS | WhatsApp | Email</summary>
        [Required]
        public string Channel { get; set; } = "SMS";

        /// <summary>CallbackReminder | AppointmentReminder | WellnessCheck | PostSurgeryFollowup | General</summary>
        [Required]
        public string MessageType { get; set; } = "General";

        /// <summary>Actual message body to send / log</summary>
        [Required]
        public string Message { get; set; } = null!;

        /// <summary>Optional — link reminder to a patient_journey when sending from Post-Surgery tab</summary>
        public Guid? JourneyId { get; set; }
    }
}
