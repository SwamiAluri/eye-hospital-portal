using System;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using Microsoft.EntityFrameworkCore;
using AuthService.Models.Identity;

namespace AuthService.Models.Domain;

/// <summary>
/// OPD Billing - must be generated and paid before check-in
/// Mapped to match actual database schema
/// </summary>
[Table("opd_bills")]
public class OpdBill
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

    [Column("appointment_id")]
    public Guid? AppointmentId { get; set; }

    /// <summary>Inpatient encounter. One bill per journey. PatientId is not the IP account key.</summary>
    [Column("patient_journey_id")]
    public Guid? PatientJourneyId { get; set; }

    [Required]
    [Column("branch_id")]
    public Guid BranchId { get; set; }

    [Column("billing_rule_id")]
    public Guid? BillingRuleId { get; set; }

    // Bill number (auto-generated): OPD-HYD-2026-000001
    [Required]
    [Column("bill_number")]
    [StringLength(50)]
    public string BillNumber { get; set; } = null!;

    [Required]
    [Column("bill_date")]
    public DateTime BillDate { get; set; } = DateTime.UtcNow;

    // Amounts
    [Required]
    [Column("consultation_fee")]
    [Precision(10, 2)]
    public decimal ConsultationFee { get; set; } = 0;

    [Column("registration_fee")]
    [Precision(10, 2)]
    public decimal RegistrationFee { get; set; } = 0;

    [Column("additional_charges")]
    [Precision(10, 2)]
    public decimal AdditionalCharges { get; set; } = 0;

    [Required]
    [Column("gross_amount")]
    [Precision(10, 2)]
    public decimal GrossAmount { get; set; } = 0;

    // Discounts
    [Column("discount_percentage")]
    [Precision(5, 2)]
    public decimal DiscountPercentage { get; set; } = 0;

    [Column("discount_amount")]
    [Precision(10, 2)]
    public decimal DiscountAmount { get; set; } = 0;

    // Tax
    [Column("tax_amount")]
    [Precision(10, 2)]
    public decimal TaxAmount { get; set; } = 0;

    // Final amount
    [Required]
    [Column("net_amount")]
    [Precision(10, 2)]
    public decimal NetAmount { get; set; } = 0;

    // Payment tracking
    [Column("amount_paid")]
    [Precision(10, 2)]
    public decimal AmountPaid { get; set; } = 0;

    [Column("balance_due")]
    [Precision(10, 2)]
    public decimal BalanceDue { get; set; } = 0;

    // Status: pending, generated, partially_paid, paid, credit_approved, cancelled, refunded
    [Required]
    [Column("status")]
    [StringLength(30)]
    public string Status { get; set; } = "pending";

    // Free visit tracking (based on billing rules)
    [Column("is_free_visit")]
    public bool IsFreeVisit { get; set; } = false;

    [Column("free_visit_reason")]
    public string? FreeVisitReason { get; set; }

    // Credit
    [Column("is_credit")]
    public bool IsCredit { get; set; } = false;

    [Column("credit_approved_by")]
    public Guid? CreditApprovedBy { get; set; }

    [Column("credit_approved_at")]
    public DateTime? CreditApprovedAt { get; set; }

    [Column("credit_notes")]
    public string? CreditNotes { get; set; }

    // Insurance
    [Column("is_insurance")]
    public bool IsInsurance { get; set; } = false;

    [Column("insurance_provider")]
    [StringLength(200)]
    public string? InsuranceProvider { get; set; }

    [Column("insurance_policy_number")]
    [StringLength(100)]
    public string? InsurancePolicyNumber { get; set; }

    [Column("insurance_claim_amount")]
    [Precision(10, 2)]
    public decimal InsuranceClaimAmount { get; set; } = 0;

    // Bill items stored as JSON
    [Column("bill_items", TypeName = "jsonb")]
    public string? BillItems { get; set; }

    // Bill finalization (lock mechanism)
    [Column("is_finalized")]
    public bool IsFinalized { get; set; } = false;

    [Column("finalized_at")]
    public DateTime? FinalizedAt { get; set; }

    [Column("finalized_by_user_id")]
    public Guid? FinalizedByUserId { get; set; }

    // Day 5: Bill Locking (Jan 31, 2026)
    [Column("is_locked")]
    public bool IsLocked { get; set; } = false;

    [Column("locked_at")]
    public DateTime? LockedAt { get; set; }

    [Column("locked_by_user_id")]
    public Guid? LockedByUserId { get; set; }

    [Column("unlock_reason")]
    public string? UnlockReason { get; set; }

    [Column("unlocked_at")]
    public DateTime? UnlockedAt { get; set; }

    [Column("unlocked_by_user_id")]
    public Guid? UnlockedByUserId { get; set; }

    // Refund tracking
    [Column("refund_status")]
    [StringLength(20)]
    public string RefundStatus { get; set; } = "none"; // none, requested, approved, completed

    [Column("refund_amount")]
    [Precision(10, 2)]
    public decimal? RefundAmount { get; set; }

    [Column("refund_reason")]
    [StringLength(200)]
    public string? RefundReason { get; set; }

    // Notes
    [Column("notes")]
    public string? Notes { get; set; }

    // Generated by user
    [Required]
    [Column("generated_by")]
    public Guid GeneratedBy { get; set; }

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

    /// <summary>BILL-030 optimistic concurrency token. Incremented on every persisted mutation.</summary>
    [ConcurrencyCheck]
    [Column("row_version")]
    public int RowVersion { get; set; } = 1;

    // Navigation properties
    [ForeignKey("TenantId")]
    public virtual Tenant? Tenant { get; set; }

    [ForeignKey("PatientId")]
    public virtual Patient? Patient { get; set; }

    [ForeignKey("AppointmentId")]
    public virtual Appointment? Appointment { get; set; }

    [ForeignKey("BranchId")]
    public virtual Branch? Branch { get; set; }

    [ForeignKey("CreditApprovedBy")]
    public virtual AppUser? CreditApprovedByUser { get; set; }

    [ForeignKey("GeneratedBy")]
    public virtual AppUser? GeneratedByUser { get; set; }

    [ForeignKey("FinalizedByUserId")]
    public virtual AppUser? FinalizedByUser { get; set; }

    [ForeignKey("LockedByUserId")]
    public virtual AppUser? LockedByUser { get; set; }

    [ForeignKey("UnlockedByUserId")]
    public virtual AppUser? UnlockedByUser { get; set; }

    [ForeignKey("CreatedByUserId")]
    public virtual AppUser? CreatedByUser { get; set; }

    [ForeignKey("UpdatedByUserId")]
    public virtual AppUser? UpdatedByUser { get; set; }

    // Navigation to visits
    public virtual ICollection<Visit>? Visits { get; set; }
    
    // Navigation to payments
    public virtual ICollection<OpdBillPayment>? Payments { get; set; }

    // Navigation to refunds
    public virtual ICollection<Refund>? Refunds { get; set; }
}
