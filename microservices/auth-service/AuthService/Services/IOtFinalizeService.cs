using System;
using System.Collections.Generic;
using System.Threading.Tasks;

namespace AuthService.Services
{
    // ─── Request / Response DTOs ─────────────────────────────────────────────

    public class UpsertOtScheduleRequest
    {
        public Guid PatientId { get; set; }
        public string? Uhid { get; set; }
        public string PatientName { get; set; } = string.Empty;
        public string SurgeryName { get; set; } = string.Empty;
        public string? Eye { get; set; }
        public string? PatientType { get; set; }
        public string? PaymentMode { get; set; }
        public Guid? DoctorId { get; set; }
        public string? DoctorName { get; set; }
        public Guid? TheatreId { get; set; }
        public string? TheatreName { get; set; }
        public DateTime? StartTime { get; set; }
        public DateTime? EndTime { get; set; }
        public Guid? CounsellingSessionId { get; set; }
        // Detail fields — populated when counsellor fills the modal
        public TimeSpan? ReportingTime { get; set; }
        public string? AnesthesiaType { get; set; }
        public string? AnesthetistName { get; set; }
        public string? IolPower { get; set; }
        public string? Remarks { get; set; }
        public string? PackageName { get; set; }
        public decimal? PackageRate { get; set; }
    }

    public class UpdateSlotRequest
    {
        public Guid? DoctorId { get; set; }
        public string? DoctorName { get; set; }
        public Guid? TheatreId { get; set; }
        public string? TheatreName { get; set; }
        public DateTime? StartTime { get; set; }
        public DateTime? EndTime { get; set; }
    }

    /// <summary>
    /// Full save payload from the modal — covers slot, anesthesia, schedule and package fields.
    /// Any edit on a Confirmed or Finalised record will reset it to NotConfirmed.
    /// </summary>
    public class UpdateOtDetailsRequest
    {
        // Slot
        public Guid? DoctorId { get; set; }
        public string? DoctorName { get; set; }
        public Guid? TheatreId { get; set; }
        public string? TheatreName { get; set; }
        public DateTime? StartTime { get; set; }
        public DateTime? EndTime { get; set; }
        // Schedule
        public TimeSpan? ReportingTime { get; set; }
        // Anesthesia
        public string? AnesthesiaType { get; set; }
        public string? AnesthetistName { get; set; }
        public string? IolPower { get; set; }
        // Notes
        public string? Remarks { get; set; }
        public string? CancelReason { get; set; }
        // Package
        public string? PackageName { get; set; }
        public decimal? PackageRate { get; set; }
    }

    /// <summary>Item in the OT checklist derived from the linked counselling session.</summary>
    public class OtChecklistDto
    {
        /// <summary>Done | Pending | NotRequired</summary>
        public string InvestigationsStatus { get; set; } = "Pending";
        /// <summary>Done | Pending | NotRequired</summary>
        public string PaymentStatus { get; set; } = "Pending";
        /// <summary>Done | Pending | NotRequired</summary>
        public string ConsentStatus { get; set; } = "Pending";
        /// <summary>Done | Pending | NotRequired</summary>
        public string PreAuthStatus { get; set; } = "NotRequired";
    }

    /// <summary>
    /// Full detail response — extends OtScheduleResponse with patient context
    /// and checklist data derived from the linked counselling session.
    /// </summary>
    public class OtScheduleDetailResponse : OtScheduleResponse
    {
        // Enriched patient header (from Patient + CounselingSession)
        public int? Age { get; set; }
        public string? Gender { get; set; }
        public DateTime? VisitDate { get; set; }
        public string? Diagnosis { get; set; }
        // Detail fields (now persisted on ot_finalize_schedule)
        // 'new' suppresses CS0108 — base OtScheduleResponse now also exposes ReportingTime
        public new TimeSpan? ReportingTime { get; set; }
        public string? AnesthesiaType { get; set; }
        public string? AnesthetistName { get; set; }
        public string? IolPower { get; set; }
        public string? Remarks { get; set; }
        public string? CancelReason { get; set; }
        // PackageName and PackageRate inherited from OtScheduleResponse
        // Patient demographics (populated from Patient table)
        public string? ContactNumber { get; set; }
        public string? BloodGroup { get; set; }
        public DateTime? DateOfBirth { get; set; }
        public string? EmergencyContactName { get; set; }
        public string? EmergencyContactPhone { get; set; }
        public string? EmergencyContactRelationship { get; set; }
        public string? Address { get; set; }
        // Checklist
        public OtChecklistDto Checklist { get; set; } = new();
    }

    public class PrepareOtListItem
    {
        public Guid ScheduleId { get; set; }
        public int Sequence { get; set; }
        /// <summary>Optional new start time override (time-only; date is taken from the request).</summary>
        public DateTime? NewStartTime { get; set; }
    }

    public class PrepareOtListRequest
    {
        public DateTime Date { get; set; }
        public List<PrepareOtListItem> Items { get; set; } = new();
        public string? PreparedBy { get; set; }
    }

    /// <summary>Thrown when one or more submitted records share a start-time slot with an already-OTPrepared record.</summary>
    public class OtPrepareConflictException : Exception
    {
        public List<Guid> ConflictingScheduleIds { get; }
        public OtPrepareConflictException(List<Guid> ids)
            : base("One or more records conflict with an already-prepared time slot.")
            => ConflictingScheduleIds = ids;
    }

    public class OtScheduleFilters
    {
        public DateTime? Date { get; set; }
        public string? Uhid { get; set; }
        public string? Name { get; set; }
        public string? Status { get; set; }
        public Guid? CounsellingSessionId { get; set; }
    }

    public class OtScheduleResponse
    {
        public Guid Id { get; set; }
        public Guid PatientId { get; set; }
        public string? Uhid { get; set; }
        public string PatientName { get; set; } = string.Empty;
        public string SurgeryName { get; set; } = string.Empty;
        public string? Eye { get; set; }
        public string? PatientType { get; set; }
        public string? PaymentMode { get; set; }
        public Guid? DoctorId { get; set; }
        public string? DoctorName { get; set; }
        public Guid? TheatreId { get; set; }
        public string? TheatreName { get; set; }
        public DateTime? StartTime { get; set; }
        public DateTime? EndTime { get; set; }
        public string Status { get; set; } = string.Empty;
        public int? SequenceNo { get; set; }
        public bool IsLocked { get; set; }
        public DateTime? PreparedAt { get; set; }
        public string? PreparedBy { get; set; }
        public int Version { get; set; }
        public Guid? CounsellingSessionId { get; set; }
        public DateTime CreatedAt { get; set; }
        public DateTime UpdatedAt { get; set; }

        // Computed permissions — avoids repeated status checks on the frontend
        public bool CanEdit { get; set; }
        public bool CanConfirm { get; set; }
        public bool CanFinalise { get; set; }
        public bool CanCancel { get; set; }
        public bool CanReopen { get; set; }
        // Package info (populated in list and detail views)
        public string? PackageName { get; set; }
        public decimal? PackageRate { get; set; }
        // Reporting time — surfaced in both list and detail views
        public TimeSpan? ReportingTime { get; set; }
        // Derived checklist summary (for list view columns)
        public string? InvestigationsStatus { get; set; }  // Pending | Done | NotRequired
        public string? ChecklistSummary { get; set; }       // AllClear | Pending | Missing
        // Convenience date string derived from StartTime ("yyyy-MM-dd") — used by frontend date filters
        public string? ScheduleDate { get; set; }
    }

    // ─── Service Interface ───────────────────────────────────────────────────

    /// <summary>
    /// Manages the OT finalize scheduling state machine:
    /// NotConfirmed → Confirmed → Finalised → OTPrepared (locked)
    /// </summary>
    public interface IOtFinalizeService
    {
        /// <summary>
        /// Creates a new OT record when a counselling session reaches Done + Schedule.
        /// If an active record already exists for this patient (unique partial index),
        /// updates the existing record (UPSERT) and resets to NotConfirmed + version++.
        /// </summary>
        Task<OtScheduleResponse> UpsertFromCounsellorAsync(
            UpsertOtScheduleRequest request, Guid tenantId, Guid userId);

        /// <summary>Returns the finalize list filtered by date / UHID / name / status.</summary>
        Task<List<OtScheduleResponse>> GetFinalizeListAsync(
            OtScheduleFilters filters, Guid tenantId);

        /// <summary>
        /// Edits slot fields (doctor, theatre, start/end time).
        /// Increments version. If current status is Confirmed, resets to NotConfirmed
        /// so the record must be validated again.
        /// </summary>
        Task<OtScheduleResponse> UpdateSlotAsync(
            Guid id, UpdateSlotRequest request, Guid tenantId, Guid userId);

        /// <summary>
        /// Validates slot conflicts and transitions NotConfirmed → Confirmed.
        /// Throws ConflictException when the same doctor or theatre has an exact
        /// start_time clash with another active record.
        /// </summary>
        Task<OtScheduleResponse> ConfirmAsync(Guid id, Guid tenantId, Guid userId);

        /// <summary>Transitions Confirmed → Finalised.</summary>
        Task<OtScheduleResponse> FinaliseAsync(Guid id, Guid tenantId, Guid userId);

        /// <summary>
        /// Transitions any state → Cancelled.
        /// Triggers auto back-sync: calls CounsellingApi to set the linked session → RepeatCounselling.
        /// </summary>
        Task<OtScheduleResponse> CancelAsync(Guid id, Guid tenantId, Guid userId);

        /// <summary>
        /// Transitions OTPrepared → Confirmed and removes the lock.
        /// Used when a ward/OT coordinator needs to make a change after the list was prepared.
        /// </summary>
        Task<OtScheduleResponse> ReopenAsync(Guid id, Guid tenantId, Guid userId);

        /// <summary>
        /// Batch operation: marks all specified Finalised records as OTPrepared + locked.
        /// Assigns sequence numbers. Guards against double-preparation on the same date.
        /// </summary>
        Task PrepareOtListAsync(PrepareOtListRequest request, Guid tenantId, Guid userId);

        /// <summary>Returns all OTPrepared records for a specific date (the locked OT list).</summary>
        Task<List<OtScheduleResponse>> GetOtListAsync(DateTime date, Guid tenantId);

        /// <summary>
        /// Returns full detail for a single OT record, enriched with patient demographics
        /// and checklist data from the linked counselling session.
        /// </summary>
        Task<OtScheduleDetailResponse> GetByIdAsync(Guid id, Guid tenantId);

        /// <summary>
        /// Saves all modal fields (slot, anesthesia, schedule, package, remarks).
        /// Resets status to NotConfirmed if currently Confirmed or Finalised.
        /// </summary>
        Task<OtScheduleResponse> UpdateDetailsAsync(
            Guid id, UpdateOtDetailsRequest request, Guid tenantId, Guid userId);

        /// <summary>
        /// Called by IP Management service (via internal HTTP) when a patient's
        /// clinical state transitions to SurgeryCompleted.
        /// Transitions OTPrepared → SurgeryDone (idempotent: no-op if already SurgeryDone).
        /// Must never throw — returns null if the record is not found or not in a
        /// transitionable state (Cancelled records are skipped silently).
        /// </summary>
        Task<OtScheduleResponse?> MarkSurgeryDoneAsync(Guid id, Guid tenantId, string actorUserId);
    }
}
