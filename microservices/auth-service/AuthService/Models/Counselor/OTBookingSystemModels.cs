using System;
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;

namespace AuthService.Models.Counselor
{
    // Theater DTOs
    public class OTTheaterDto
    {
        public Guid Id { get; set; }
        public Guid TenantId { get; set; }
        public Guid BranchId { get; set; }
        public string TheaterName { get; set; } = string.Empty;
        public string? TheaterCode { get; set; }
        public int? FloorNumber { get; set; }
        public string? LocationDescription { get; set; }
        public string? Specialization { get; set; }
        public string[]? SurgeryTypesSupported { get; set; }
        public string? EquipmentList { get; set; }
        public int MaxSurgeriesPerDay { get; set; }
        public int StandardSurgeryDurationMinutes { get; set; }
        public int CleaningTimeBetweenSurgeriesMinutes { get; set; }
        public TimeSpan OperationStartTime { get; set; }
        public TimeSpan OperationEndTime { get; set; }
        public string[]? OperatingDays { get; set; }
        public bool IsActive { get; set; }
        public bool IsOperational { get; set; }
        public bool MaintenanceMode { get; set; }
        public string? MaintenanceReason { get; set; }
    }

    public class CreateTheaterRequest
    {
        [Required]
        public Guid BranchId { get; set; }
        [Required]
        [MaxLength(100)]
        public string TheaterName { get; set; } = string.Empty;
        [MaxLength(50)]
        public string? TheaterCode { get; set; }
        public int? FloorNumber { get; set; }
        public string? LocationDescription { get; set; }
        [MaxLength(100)]
        public string? Specialization { get; set; }
        public string[]? SurgeryTypesSupported { get; set; }
        public string? EquipmentList { get; set; }
        public int MaxSurgeriesPerDay { get; set; } = 8;
        public int StandardSurgeryDurationMinutes { get; set; } = 45;
        public int CleaningTimeBetweenSurgeriesMinutes { get; set; } = 30;
        public TimeSpan? OperationStartTime { get; set; }
        public TimeSpan? OperationEndTime { get; set; }
        public string[]? OperatingDays { get; set; }
    }

    public class UpdateTheaterRequest
    {
        [MaxLength(100)]
        public string? TheaterName { get; set; }
        public int? FloorNumber { get; set; }
        public string? LocationDescription { get; set; }
        [MaxLength(100)]
        public string? Specialization { get; set; }
        public string[]? SurgeryTypesSupported { get; set; }
        public string? EquipmentList { get; set; }
        public int? MaxSurgeriesPerDay { get; set; }
        public int? StandardSurgeryDurationMinutes { get; set; }
        public int? CleaningTimeBetweenSurgeriesMinutes { get; set; }
        public TimeSpan? OperationStartTime { get; set; }
        public TimeSpan? OperationEndTime { get; set; }
        public string[]? OperatingDays { get; set; }
        public bool? IsActive { get; set; }
        public bool? IsOperational { get; set; }
        public bool? MaintenanceMode { get; set; }
        public string? MaintenanceReason { get; set; }
    }

    // Schedule DTOs
    public class OTScheduleDto
    {
        public Guid Id { get; set; }
        public Guid TheaterId { get; set; }
        public string? TheaterName { get; set; }
        public Guid? SessionId { get; set; }
        public Guid? BookingId { get; set; }
        public Guid? PatientId { get; set; }
        public string? ScheduleNumber { get; set; }
        public DateTime ScheduledDate { get; set; }
        public TimeSpan StartTime { get; set; }
        public TimeSpan EndTime { get; set; }
        public int DurationMinutes { get; set; }
        public string SurgeryType { get; set; } = string.Empty;
        public string? ProcedureDescription { get; set; }
        public string? EyeOperated { get; set; }
        public Guid SurgeonId { get; set; }
        public string? SurgeonName { get; set; }  // populated from users JOIN
        public Guid? AnesthesiologistId { get; set; }
        public Guid? OTTechnicianId { get; set; }
        public Guid[]? NursingStaffIds { get; set; }
        public string? EquipmentReserved { get; set; }
        public Guid? IOLReservedId { get; set; }
        public string Status { get; set; } = "Booked";
        public DateTime? ConfirmationTimestamp { get; set; }
        public DateTime? CancelledAt { get; set; }
        public string? CancellationReason { get; set; }
        public DateTime? SurgeryStartedAt { get; set; }
        public DateTime? SurgeryCompletedAt { get; set; }
        public int? ActualDurationMinutes { get; set; }
        public string? Complications { get; set; }
        public string? Outcome { get; set; }
        // Patient info (joined from patient table)
        public string? PatientName { get; set; }
        public string? Mrn { get; set; }
        public string? PatientPhone { get; set; }
        public int? Age { get; set; }
        public string? Gender { get; set; }
        // Counseling session info
        public string? PatientType { get; set; }
        public decimal? PackageAmount { get; set; }
        public string? RecommendedProcedures { get; set; }
    }

    public class CreateScheduleRequest
    {
        [Required]
        public Guid TheaterId { get; set; }
        public Guid? SessionId { get; set; }
        public Guid? BookingId { get; set; }
        public Guid? PatientId { get; set; }
        [Required]
        public DateTime ScheduledDate { get; set; }
        [Required]
        public TimeSpan StartTime { get; set; }
        [Required]
        public TimeSpan EndTime { get; set; }
        [Required]
        [MaxLength(100)]
        public string SurgeryType { get; set; } = string.Empty;
        public string? ProcedureDescription { get; set; }
        [MaxLength(10)]
        public string? EyeOperated { get; set; }
        [Required]
        public Guid SurgeonId { get; set; }
        public Guid? AnesthesiologistId { get; set; }
        public Guid? OTTechnicianId { get; set; }
        public Guid[]? NursingStaffIds { get; set; }
        public string? EquipmentReserved { get; set; }
        public Guid? IOLReservedId { get; set; }
    }

    public class UpdateScheduleRequest
    {
        public DateTime? ScheduledDate { get; set; }
        public TimeSpan? StartTime { get; set; }
        public TimeSpan? EndTime { get; set; }
        [MaxLength(100)]
        public string? SurgeryType { get; set; }
        public string? ProcedureDescription { get; set; }
        [MaxLength(10)]
        public string? EyeOperated { get; set; }
        public Guid? SurgeonId { get; set; }
        public Guid? AnesthesiologistId { get; set; }
        public Guid? OTTechnicianId { get; set; }
        public Guid[]? NursingStaffIds { get; set; }
        public string? EquipmentReserved { get; set; }
        public Guid? IOLReservedId { get; set; }
    }

    public class ConfirmBookingRequest
    {
        public string? ConfirmationNotes { get; set; }
    }

    public class CancelScheduleRequest
    {
        [Required]
        public string CancellationReason { get; set; } = string.Empty;
    }

    public class RescheduleRequest
    {
        [Required]
        public DateTime NewScheduledDate { get; set; }
        [Required]
        public TimeSpan NewStartTime { get; set; }
        [Required]
        public TimeSpan NewEndTime { get; set; }
        public string? RescheduleReason { get; set; }
    }

    public class CompleteSurgeryRequest
    {
        [Required]
        public DateTime CompletedAt { get; set; }
        public int? ActualDurationMinutes { get; set; }
        public string? Complications { get; set; }
        [MaxLength(50)]
        public string? Outcome { get; set; }
    }

    /// <summary>
    /// Patch pre-admission checklist items for an OT schedule.
    /// Only provided fields are updated; omitted fields are left unchanged.
    /// </summary>
    public class UpdateChecklistRequest
    {
        public bool? PreOpTestsDone { get; set; }
        public bool? ConsentSigned { get; set; }
        public bool? FinancialCleared { get; set; }
        public bool? BedReserved { get; set; }
        public bool? OtSlotConfirmed { get; set; }
        public bool? PreOpMedsPrescribed { get; set; }
        public bool? PatientInstructed { get; set; }
        public bool? InventoryConfirmed { get; set; }
    }

    public class UpdateChecklistResponse
    {
        public bool Success { get; set; }
        public string Message { get; set; } = string.Empty;
        /// <summary>Merged checklist state after update.</summary>
        public Dictionary<string, bool> Checklist { get; set; } = new();
        public int ProgressPercent { get; set; }
    }

    /// <summary>
    /// Request body for recording a patient no-show on an OT schedule.
    /// </summary>
    public class NoShowRequest
    {
        /// <summary>reschedule | hold | cancel</summary>
        [Required]
        [MaxLength(20)]
        public string Action { get; set; } = string.Empty;
        public string? Notes { get; set; }
    }

    public class ScheduleFilters
    {
        public Guid? TheaterId { get; set; }
        public Guid? SurgeonId { get; set; }
        public Guid? BranchId { get; set; }
        public DateTime? StartDate { get; set; }
        public DateTime? EndDate { get; set; }
        // Frontend may send dateFrom/dateTo as aliases
        public DateTime? DateFrom { get => StartDate; set => StartDate = value; }
        public DateTime? DateTo { get => EndDate; set => EndDate = value; }
        public string? Status { get; set; }
        // Frontend may send statuses=Booked,Confirmed (comma-separated)
        public string? Statuses { get; set; }
        public string? SurgeryType { get; set; }
    }

    public class ScheduleListResponse
    {
        public List<OTScheduleDto> Schedules { get; set; } = new();
        public int TotalCount { get; set; }
        public int PageNumber { get; set; }
        public int PageSize { get; set; }
    }

    // Validation DTOs
    public class BookingValidationDto
    {
        public Guid Id { get; set; }
        public Guid ScheduleId { get; set; }
        public Guid SessionId { get; set; }
        public DateTime ValidationTimestamp { get; set; }
        public string ChecksPassed { get; set; } = "{}";
        public string[]? BlockingIssues { get; set; }
        public string[]? WarningIssues { get; set; }
        public bool CanProceed { get; set; }
        public bool RequiresAttention { get; set; }
    }

    public class ValidateBookingRequest
    {
        [Required]
        public Guid ScheduleId { get; set; }
        [Required]
        public Guid SessionId { get; set; }
    }

    public class ValidationSummaryDto
    {
        public bool OTAvailable { get; set; }
        public bool SurgeonAvailable { get; set; }
        public bool AnesthesiaAvailable { get; set; }
        public bool IOLReserved { get; set; }
        public bool PreOpTestsCleared { get; set; }
        public bool FitnessClearanceObtained { get; set; }
        public bool PaymentReceived { get; set; }
        public bool BedReserved { get; set; }
        public bool ConsentSigned { get; set; }
        public bool InsuranceApproved { get; set; }
        public bool AllChecksPassed { get; set; }
    }

    // Equipment DTOs
    public class EquipmentAvailabilityDto
    {
        public Guid Id { get; set; }
        public Guid TheaterId { get; set; }
        public string EquipmentName { get; set; } = string.Empty;
        public string? EquipmentModel { get; set; }
        public string? EquipmentSerialNumber { get; set; }
        public bool IsFunctional { get; set; }
        public string? CurrentStatus { get; set; }
        public DateTime? LastServicedAt { get; set; }
        public DateTime? NextServiceDue { get; set; }
        public string? MaintenanceSchedule { get; set; }
        public string? ServiceProvider { get; set; }
        public decimal TotalUsageHours { get; set; }
        public DateTime? LastUsedAt { get; set; }
        public string? Notes { get; set; }
    }

    public class UpdateEquipmentStatusRequest
    {
        [Required]
        [MaxLength(30)]
        public string CurrentStatus { get; set; } = string.Empty;
        public bool? IsFunctional { get; set; }
        public string? Notes { get; set; }
    }

    // Collision DTOs
    public class CollisionLogDto
    {
        public Guid Id { get; set; }
        public Guid TheaterId { get; set; }
        public string? TheaterName { get; set; }
        public DateTime CollisionDate { get; set; }
        public TimeSpan CollisionTime { get; set; }
        public Guid? ExistingScheduleId { get; set; }
        public string? AttemptedScheduleData { get; set; }
        public string? CollisionType { get; set; }
        public DateTime DetectedAt { get; set; }
        public bool Resolved { get; set; }
        public DateTime? ResolvedAt { get; set; }
        public string? ResolutionAction { get; set; }
        public string? ResolutionNotes { get; set; }
    }

    public class ResolveCollisionRequest
    {
        [Required]
        [MaxLength(100)]
        public string ResolutionAction { get; set; } = string.Empty;
        public string? ResolutionNotes { get; set; }
    }

    // Response DTOs
    public class BookingResultDto
    {
        public bool Success { get; set; }
        public Guid? ScheduleId { get; set; }
        public string? ScheduleNumber { get; set; }
        public string? Message { get; set; }
        public List<string> Warnings { get; set; } = new();
        public List<string> Errors { get; set; } = new();
    }

    public class AvailabilityCheckDto
    {
        public bool IsAvailable { get; set; }
        public List<string> ConflictReasons { get; set; } = new();
        public List<TimeSlotDto> AvailableSlots { get; set; } = new();
    }

    public class TimeSlotDto
    {
        public DateTime Date { get; set; }
        public TimeSpan StartTime { get; set; }
        public TimeSpan EndTime { get; set; }
        public int DurationMinutes { get; set; }
    }

    // ── Stock / IOL Availability DTOs ────────────────────────────────────────

    public class StockAvailabilityDto
    {
        public Guid ScheduleId { get; set; }
        public string StockCheckStatus { get; set; } = "Pending";  // Pending|Requested|Confirmed|Unavailable|NotRequired
        public string? IolModel { get; set; }
        public decimal? IolPower { get; set; }
        public string? IolSide { get; set; }                       // RE|LE|Both
        public Guid? IolCatalogId { get; set; }
        public string? StockNotes { get; set; }
        public Guid? ConfirmedByUserId { get; set; }
        public DateTime? ConfirmedAt { get; set; }
        public bool IsConfirmed => StockCheckStatus == "Confirmed";
    }

    public class ConfirmStockRequest
    {
        [Required]
        [MaxLength(30)]
        public string Status { get; set; } = "Confirmed"; // Confirmed|Unavailable|NotRequired

        [MaxLength(100)]
        public string? IolModel { get; set; }

        public decimal? IolPower { get; set; }

        [MaxLength(5)]
        public string? IolSide { get; set; }

        public Guid? IolCatalogId { get; set; }

        public string? Notes { get; set; }
    }

    // ── Quick-Book Surgery DTO (for followup → surgery booking) ────────────

    public class QuickBookSurgeryRequest
    {
        [Required]
        public Guid SurgeonId { get; set; }
        [Required]
        public Guid TheaterId { get; set; }
        [Required]
        public DateTime ScheduledDate { get; set; }
        [Required]
        public TimeSpan StartTime { get; set; }
        public int EstimatedDurationMinutes { get; set; } = 60;
        [MaxLength(10)]
        public string? Eye { get; set; }
        public string? Notes { get; set; }
    }

    public class QuickBookSurgeryResponse
    {
        public bool Success { get; set; }
        public Guid? ScheduleId { get; set; }
        public string? ScheduleNumber { get; set; }
        public string? Message { get; set; }

        /// <summary>Phase 3I Slice 7 (PD-S7-02) — CounselingSession.Version after the decision-flag update.</summary>
        public int SessionVersion { get; set; }
    }
}
