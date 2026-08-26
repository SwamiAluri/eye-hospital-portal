using System;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using System.Text.Json.Serialization;
using Microsoft.EntityFrameworkCore;
using AuthService.Models.Identity;

namespace AuthService.Models.Domain;

/// <summary>
/// Refund tracking for OPD bills
/// Supports refund requests, authorization, and processing
/// </summary>
[Table("refunds")]
public class Refund
{
    [Key]
    [Column("id")]
    public Guid Id { get; set; }

    [Required]
    [Column("bill_id")]
    public Guid BillId { get; set; }

    [Required]
    [Column("patient_id")]
    public Guid PatientId { get; set; }

    [Column("visit_id")]
    public Guid? VisitId { get; set; }

    [Required]
    [Column("refund_amount")]
    [Precision(10, 2)]
    public decimal RefundAmount { get; set; }

    [Column("refund_reason")]
    [StringLength(200)]
    public string? RefundReason { get; set; }

    // Payment mode: cash, card, upi, bank_transfer
    [Column("refund_mode")]
    [StringLength(50)]
    public string? RefundMode { get; set; }

    // Request tracking
    [Column("requested_by_user_id")]
    public Guid? RequestedByUserId { get; set; }

    [Column("requested_at")]
    public DateTime RequestedAt { get; set; } = DateTime.UtcNow;

    // Authorization
    [Column("authorized_by_user_id")]
    public Guid? AuthorizedByUserId { get; set; }

    [Column("authorized_at")]
    public DateTime? AuthorizedAt { get; set; }

    // Status: pending, approved, rejected, completed
    [Required]
    [Column("status")]
    [StringLength(20)]
    public string Status { get; set; } = "pending";

    [Column("notes")]
    public string? Notes { get; set; }

    [Required]
    [Column("tenant_id")]
    public Guid TenantId { get; set; }

    [Required]
    [Column("created_at")]
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    // Navigation properties. JsonIgnore: OpdBill/Patient/AppUser graphs are cyclic
    // and abort the HTTP response after the refund row is already committed.
    [ForeignKey("BillId")]
    [JsonIgnore]
    public virtual OpdBill? Bill { get; set; }

    [ForeignKey("PatientId")]
    [JsonIgnore]
    public virtual Patient? Patient { get; set; }

    [ForeignKey("VisitId")]
    [JsonIgnore]
    public virtual Visit? Visit { get; set; }

    [ForeignKey("TenantId")]
    [JsonIgnore]
    public virtual Tenant? Tenant { get; set; }

    [ForeignKey("RequestedByUserId")]
    [JsonIgnore]
    public virtual AppUser? RequestedByUser { get; set; }

    [ForeignKey("AuthorizedByUserId")]
    [JsonIgnore]
    public virtual AppUser? AuthorizedByUser { get; set; }
}
