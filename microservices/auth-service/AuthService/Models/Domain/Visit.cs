using System;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using AuthService.Models.Identity;

namespace AuthService.Models.Domain;

/// <summary>
/// Represents an OPD visit - created automatically at check-in
/// This is the clinical anchor that links patient, appointment, and billing
/// </summary>
[Table("visits")]
public class Visit
{
    [Key]
    [Column("id")]
    public Guid Id { get; set; }

    [Required]
    [Column("tenant_id")]
    public Guid TenantId { get; set; }

    [Required]
    [Column("patient_id")]
    public Guid PatientId { get; set; }

    [Required]
    [Column("appointment_id")]
    public Guid AppointmentId { get; set; }

    [Column("opd_bill_id")]
    public Guid? OpdBillId { get; set; }

    [Required]
    [Column("branch_id")]
    public Guid BranchId { get; set; }

    [Column("consultant_id")]
    public Guid? ConsultantId { get; set; }

    [Column("department_id")]
    public Guid? DepartmentId { get; set; }

    // Visit Type: new, review, follow_up, post_op
    [Required]
    [Column("visit_type")]
    [StringLength(30)]
    public string VisitType { get; set; } = "new";

    // Visit Category: paid, free, discounted, pop (package)
    [Required]
    [Column("visit_category")]
    [StringLength(30)]
    public string VisitCategory { get; set; } = "paid";

    // Status: created, checked_in, in_progress, with_optometrist, with_doctor, completed, cancelled
    [Required]
    [Column("status")]
    [StringLength(30)]
    public string Status { get; set; } = "created";

    // Token number (branch-prefixed): HYD-001, BLR-002
    [Required]
    [Column("token_number")]
    [StringLength(20)]
    public string TokenNumber { get; set; } = null!;

    // Token sequence for the day (resets daily per branch)
    [Column("token_sequence")]
    public int TokenSequence { get; set; }

    // Check-in details
    [Column("checked_in_at")]
    public DateTime? CheckedInAt { get; set; }

    [Column("checked_in_by")]
    public Guid? CheckedInBy { get; set; }

    // Routing
    [Column("current_station")]
    [StringLength(50)]
    public string? CurrentStation { get; set; } // reception, optometrist, doctor, pharmacy, etc.

    [Column("assigned_to")]
    public Guid? AssignedTo { get; set; }

    [Column("assigned_at")]
    public DateTime? AssignedAt { get; set; }

    /// <summary>Active optometry room code (OPT-1, OPT-2) while patient is with optometrist.</summary>
    [Column("active_room_code")]
    [StringLength(50)]
    public string? ActiveRoomCode { get; set; }

    /// <summary>Number of times patient has been queued at optometrist this visit.</summary>
    [Column("optometry_pass_count")]
    public int OptometryPassCount { get; set; } = 0;

    // Clinical completion
    [Column("completed_at")]
    public DateTime? CompletedAt { get; set; }

    [Column("completed_by")]
    public Guid? CompletedBy { get; set; }

    // Outcome: treated, referred, surgery_planned, follow_up_scheduled
    [Column("outcome")]
    [StringLength(50)]
    public string? Outcome { get; set; }

    [Column("outcome_notes")]
    public string? OutcomeNotes { get; set; }

    // Emergency flag (for visits created without payment)
    [Column("is_emergency")]
    public bool IsEmergency { get; set; } = false;

    [Column("emergency_authorized_by")]
    public Guid? EmergencyAuthorizedBy { get; set; }

    [Column("emergency_reason")]
    public string? EmergencyReason { get; set; }

    // Walkout tracking
    [Column("walkout_reason")]
    [StringLength(100)]
    public string? WalkoutReason { get; set; }

    [Column("walkout_at")]
    public DateTime? WalkoutAt { get; set; }

    [Column("override_reason")]
    [StringLength(100)]
    public string? OverrideReason { get; set; }

    [Column("override_authorized_by")]
    public Guid? OverrideAuthorizedBy { get; set; }

    // Notes
    [Column("notes")]
    public string? Notes { get; set; }

    // Standard audit fields
    [Required]
    [Column("created_at")]
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    [Column("updated_at")]
    public DateTime? UpdatedAt { get; set; }

    [Required]
    [Column("created_by_user_id")]
    public Guid CreatedByUserId { get; set; }

    [Column("updated_by_user_id")]
    public Guid? UpdatedByUserId { get; set; }

    [Column("deleted_at")]
    public DateTime? DeletedAt { get; set; }

    // Navigation properties
    [ForeignKey("TenantId")]
    public virtual Tenant? Tenant { get; set; }

    [ForeignKey("PatientId")]
    public virtual Patient? Patient { get; set; }

    [ForeignKey("AppointmentId")]
    public virtual Appointment? Appointment { get; set; }

    [ForeignKey("OpdBillId")]
    public virtual OpdBill? OpdBill { get; set; }

    [ForeignKey("BranchId")]
    public virtual Branch? Branch { get; set; }

    [ForeignKey("ConsultantId")]
    public virtual AppUser? Consultant { get; set; }

    [ForeignKey("DepartmentId")]
    public virtual Department? Department { get; set; }

    [ForeignKey("CheckedInBy")]
    public virtual AppUser? CheckedInByUser { get; set; }

    [ForeignKey("AssignedTo")]
    public virtual AppUser? AssignedToUser { get; set; }

    [ForeignKey("CompletedBy")]
    public virtual AppUser? CompletedByUser { get; set; }

    [ForeignKey("EmergencyAuthorizedBy")]
    public virtual AppUser? EmergencyAuthorizedByUser { get; set; }

    [ForeignKey("OverrideAuthorizedBy")]
    public virtual AppUser? OverrideAuthorizedByUser { get; set; }

    [ForeignKey("CreatedByUserId")]
    public virtual AppUser? CreatedByUser { get; set; }

    [ForeignKey("UpdatedByUserId")]
    public virtual AppUser? UpdatedByUser { get; set; }
}
