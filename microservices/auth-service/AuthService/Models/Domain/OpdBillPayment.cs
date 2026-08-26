using System;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using Microsoft.EntityFrameworkCore;
using AuthService.Models.Identity;

namespace AuthService.Models.Domain;

/// <summary>
/// Payment records for OPD bills - supports multiple payment modes
/// Matches database schema: opd_bill_payments
/// </summary>
[Table("opd_bill_payments")]
public class OpdBillPayment
{
    [Key]
    [Column("id")]
    public Guid Id { get; set; }

    [Required]
    [Column("tenant_id")]
    public Guid TenantId { get; set; }

    [Required]
    [Column("opd_bill_id")]
    public Guid OpdBillId { get; set; }

    // Payment reference number
    [Required]
    [Column("payment_reference")]
    [StringLength(50)]
    public string PaymentReference { get; set; } = null!; // PAY-HYD-2026-000001

    // Payment mode: cash, card, upi, insurance, credit, online
    [Required]
    [Column("payment_mode")]
    [StringLength(30)]
    public string PaymentMode { get; set; } = "cash";

    [Required]
    [Column("amount")]
    [Precision(10, 2)]
    public decimal Amount { get; set; }

    [Column("payment_date")]
    public DateTime PaymentDate { get; set; } = DateTime.UtcNow;

    // For card payments
    [Column("card_type")]
    [StringLength(30)]
    public string? CardType { get; set; } // visa, mastercard, rupay, amex

    [Column("card_last_four")]
    [StringLength(4)]
    public string? CardLastFour { get; set; }

    [Column("card_network")]
    [StringLength(30)]
    public string? CardNetwork { get; set; }

    // For UPI payments
    [Column("upi_id")]
    [StringLength(100)]
    public string? UpiId { get; set; } // UPI Virtual Payment Address

    [Column("upi_transaction_id")]
    [StringLength(100)]
    public string? UpiTransactionId { get; set; }

    // For bank transfers/cheque
    [Column("bank_name")]
    [StringLength(100)]
    public string? BankName { get; set; }

    [Column("cheque_number")]
    [StringLength(50)]
    public string? ChequeNumber { get; set; }

    // For insurance payments
    [Column("insurance_claim_id")]
    [StringLength(100)]
    public string? InsuranceClaimId { get; set; }

    [Column("insurance_response")]
    public string? InsuranceResponse { get; set; }

    [Column("received_by")]
    public Guid? ReceivedBy { get; set; }

    // Receipt number
    [Column("receipt_number")]
    [StringLength(50)]
    public string? ReceiptNumber { get; set; }

    /// <summary>Payment | Advance | Discount | Refund | Reversal. Append-only; never mutate historical rows.</summary>
    [Column("payment_kind")]
    [StringLength(20)]
    public string PaymentKind { get; set; } = "Payment";

    [Column("reversed_payment_id")]
    public Guid? ReversedPaymentId { get; set; }

    [Column("idempotency_key")]
    [StringLength(80)]
    public string? IdempotencyKey { get; set; }

    // Standard audit columns
    [Column("status")]
    [StringLength(20)]
    public string Status { get; set; } = "completed";

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

    // Navigation properties
    [ForeignKey("TenantId")]
    public virtual Tenant? Tenant { get; set; }

    [ForeignKey("OpdBillId")]
    public virtual OpdBill? OpdBill { get; set; }

    [ForeignKey("ReceivedBy")]
    public virtual AppUser? ReceivedByUser { get; set; }
}
