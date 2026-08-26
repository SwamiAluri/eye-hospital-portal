using System;
using System.ComponentModel.DataAnnotations;
using System.Collections.Generic;

namespace AuthService.DTOs.Billing;

// ============ OPD Bill DTOs ============

public class OpdBillDto
{
    public Guid Id { get; set; }
    public Guid TenantId { get; set; }
    public string BillNumber { get; set; } = null!;
    public Guid PatientId { get; set; }
    public string? PatientName { get; set; }
    public string? PatientMrn { get; set; }
    public Guid AppointmentId { get; set; }
    public Guid? PatientJourneyId { get; set; }
    public Guid BranchId { get; set; }
    public string? BranchName { get; set; }
    public Guid? BillingRuleId { get; set; }
    public DateTime BillDate { get; set; }
    
    // Amounts - matches actual database schema
    public decimal ConsultationFee { get; set; }
    public decimal RegistrationFee { get; set; }
    public decimal AdditionalCharges { get; set; }
    public decimal GrossAmount { get; set; }
    public decimal DiscountAmount { get; set; }
    public decimal DiscountPercentage { get; set; }
    public decimal TaxAmount { get; set; }
    public decimal NetAmount { get; set; }
    public decimal AmountPaid { get; set; }
    public decimal BalanceDue { get; set; }
    
    // Status
    public string Status { get; set; } = null!;
    public bool IsLocked { get; set; }
    public bool IsFinalized { get; set; }
    public bool IsFreeVisit { get; set; }
    public string? FreeVisitReason { get; set; }
    public bool IsCredit { get; set; }
    public Guid? CreditApprovedBy { get; set; }
    public DateTime? CreditApprovedAt { get; set; }
    public string? CreditNotes { get; set; }
    public bool IsInsurance { get; set; }
    public string? InsuranceProvider { get; set; }
    public string? InsurancePolicyNumber { get; set; }
    public decimal InsuranceClaimAmount { get; set; }
    
    // Items
    public List<OpdBillItemDto>? BillItems { get; set; }
    public List<OpdBillPaymentDto>? Payments { get; set; }
    
    // Timestamps
    public Guid GeneratedBy { get; set; }
    public string? Notes { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime? UpdatedAt { get; set; }
}

public class OpdBillListDto
{
    public Guid Id { get; set; }
    public string BillNumber { get; set; } = null!;
    public string PatientName { get; set; } = null!;
    public string PatientMrn { get; set; } = null!;
    public DateTime BillDate { get; set; }
    public decimal NetAmount { get; set; }
    public decimal AmountPaid { get; set; }
    public decimal BalanceDue { get; set; }
    public string Status { get; set; } = null!;
    public bool IsFreeVisit { get; set; }
    public DateTime CreatedAt { get; set; }
}

// ============ Bill Item DTOs ============

public class OpdBillItemDto
{
    public int Sequence { get; set; }
    public string ItemType { get; set; } = null!; // consultation, service, investigation, other
    public string ItemCode { get; set; } = null!;
    public string ItemName { get; set; } = null!;
    public int Quantity { get; set; }
    public decimal UnitPrice { get; set; }
    public decimal DiscountPercent { get; set; }
    public decimal Amount { get; set; }
    public string? Notes { get; set; }
}

// ============ Payment DTOs ============

public class OpdBillPaymentDto
{
    public Guid Id { get; set; }
    public string PaymentReference { get; set; } = null!;
    public string PaymentMode { get; set; } = null!;
    public decimal Amount { get; set; }
    public DateTime PaymentDate { get; set; }
    public string? ReceivedByName { get; set; }
    public string? ReceiptNumber { get; set; }
    public string? PaymentKind { get; set; }
    public string? CardType { get; set; }
    public string? CardLastFour { get; set; }
    public string? UpiId { get; set; }
}

// ============ Create/Update DTOs ============

public class CreateOpdBillDto
{
    [Required]
    public Guid AppointmentId { get; set; }
    
    [Required]
    public Guid PatientId { get; set; }
    
    [Required]
    public Guid BranchId { get; set; }
    
    public Guid? ConsultantId { get; set; }
    
    [Required]
    public decimal ConsultationFee { get; set; }
    
    public decimal RegistrationFee { get; set; } = 0;
    
    public decimal AdditionalCharges { get; set; } = 0;
    
    public decimal? DiscountPercentage { get; set; }
    public string? DiscountReason { get; set; }
    
    public decimal TaxAmount { get; set; } = 0;
    
    public List<CreateBillItemDto>? Items { get; set; }
    
    public string? Notes { get; set; }
    
    // Free visit support
    public bool IsFreeVisit { get; set; } = false;
    public string? FreeVisitReason { get; set; }
    
    // Insurance support
    public bool IsInsurance { get; set; } = false;
    public string? InsuranceProvider { get; set; }
    public string? InsurancePolicyNumber { get; set; }
    public decimal? InsuranceClaimAmount { get; set; }
}

public class CreateBillItemDto
{
    [Required]
    public string ItemType { get; set; } = null!;
    
    [Required]
    public string ItemCode { get; set; } = null!;
    
    [Required]
    public string ItemName { get; set; } = null!;
    
    public int Quantity { get; set; } = 1;
    
    [Required]
    public decimal UnitPrice { get; set; }
    
    public decimal DiscountPercent { get; set; } = 0;
    
    public string? Notes { get; set; }
}

public class AddPaymentDto
{
    [Required]
    public Guid OpdBillId { get; set; }
    
    [Required]
    public string PaymentMode { get; set; } = null!; // cash, card, upi, insurance, credit, online
    
    [Required]
    public decimal Amount { get; set; }
    
    // Card payment details
    public string? CardLastFour { get; set; }
    public string? CardType { get; set; }
    public string? CardTransactionId { get; set; }
    
    // UPI payment details
    public string? UpiTransactionId { get; set; }
    public string? UpiVpa { get; set; }
    
    // Online payment details
    public string? GatewayTransactionId { get; set; }
    public string? GatewayName { get; set; }
    
    public string? Notes { get; set; }

    /// <summary>Payment | Advance | Discount | Refund. Default Payment.</summary>
    public string? PaymentKind { get; set; }
    public string? IdempotencyKey { get; set; }
}

public class EnsureInpatientBillRequest
{
    public Guid TenantId { get; set; }
    public Guid BranchId { get; set; }
    public Guid PatientId { get; set; }
    public Guid PatientJourneyId { get; set; }
    public decimal PackageAmount { get; set; }
    public Guid ActorUserId { get; set; }
    public string? Notes { get; set; }
}

/// <summary>BILL-032 — internal batch charge capture. Price comes from catalog, not the caller.</summary>
public class ChargeItemsRequest
{
    public Guid TenantId { get; set; }
    public Guid PatientJourneyId { get; set; }
    public Guid ActorUserId { get; set; }
    public string IdempotencyKey { get; set; } = string.Empty;
    public List<ChargeItemLineRequest> Lines { get; set; } = [];
}

public class ChargeItemLineRequest
{
    public string SourceType { get; set; } = string.Empty;
    public Guid? SourceRefId { get; set; }
    public Guid? ServiceVariantId { get; set; }
    public string? ServiceCode { get; set; }
    public Guid? ItemId { get; set; }
    public decimal Quantity { get; set; } = 1;
    /// <summary>Ignored unless an authenticated cashier override path is added. Internal posters must not apply pricing.</summary>
    public decimal? UnitPriceOverride { get; set; }
    /// <summary>OT-020 reversal. Posts a catalog-priced negative line; never deletes opd_bill_items.</summary>
    public bool IsCredit { get; set; }
    public string? Notes { get; set; }
}

public class ChargeItemsResultDto
{
    public Guid BillId { get; set; }
    public string BillNumber { get; set; } = string.Empty;
    public bool Replayed { get; set; }
    public List<BillItemDto> Items { get; set; } = [];
    public decimal GrossAmount { get; set; }
    public decimal BalanceDue { get; set; }
    public int SuppressedCount { get; set; }
    public int ExceptionCount { get; set; }
}

/// <summary>INV-050. Park an OT issue that cannot be posted (missing journey or unmapped item).</summary>
public class InternalChargeExceptionRequest
{
    public Guid TenantId { get; set; }
    public Guid? PatientJourneyId { get; set; }
    public Guid? ItemId { get; set; }
    public Guid? SourceRefId { get; set; }
    public Guid? OpdBillId { get; set; }
    public string SourceType { get; set; } = "Consumable";
    public decimal Quantity { get; set; } = 1;
    public string? Reason { get; set; }
    public string? IdempotencyKey { get; set; }
    public string? Status { get; set; }
}

public class EnsureIpBillDto
{
    [Required]
    public Guid PatientJourneyId { get; set; }
}

public class ReversePaymentRequest
{
    public Guid OpdBillId { get; set; }
    public Guid OriginalPaymentId { get; set; }
    public string Reason { get; set; } = null!;
}

public class ApplyCoverageAllocationRequest
{
    public Guid? PatientJourneyId { get; set; }
    public Guid? OpdBillId { get; set; }
    public decimal PayerResponsibility { get; set; }
    public decimal PatientResponsibility { get; set; }
    public Guid ActorUserId { get; set; }
}

public class InpatientFinancialSummaryDto
{
    public Guid? OpdBillId { get; set; }
    public string? BillNumber { get; set; }
    public decimal PackageEstimate { get; set; }
    public decimal BilledAmount { get; set; }
    public decimal DiscountTotal { get; set; }
    public decimal PatientResponsibility { get; set; }
    public decimal InsuranceResponsibility { get; set; }
    public decimal PatientPaid { get; set; }
    public decimal PatientBalance { get; set; }
    /// <summary>Live CCMS patient share when a coverage case exists; null on cash / CCMS miss.</summary>
    public decimal? CcmsPatientShare { get; set; }
    public bool CcmsPatientShareAvailable { get; set; }
    public decimal TotalCollected { get; set; }
    public decimal Advances { get; set; }
    public decimal RefundsAndReversals { get; set; }
    public decimal BalanceDue { get; set; }
    public string FinancialStatus { get; set; } = "generated";
    public bool IsFinalized { get; set; }
    public bool HasPendingClaim { get; set; }
    public IReadOnlyList<string> FinancialBlockers { get; set; } = [];
    public IReadOnlyList<OpdBillPaymentDto> Payments { get; set; } = [];
}

public class ApplyCreditDto
{
    [Required]
    public Guid OpdBillId { get; set; }
    
    public string? CreditNotes { get; set; }
}

public class ApplyDiscountDto
{
    [Required]
    public Guid OpdBillId { get; set; }
    
    [Required]
    public decimal DiscountPercentage { get; set; }
    
    [Required]
    public string DiscountReason { get; set; } = null!;
    
    // Authorization (required if discount > threshold)
    public string? AuthorizationPin { get; set; }

    /// <summary>
    /// Retry key. When omitted the server derives a stable key from bill + percent + reason
    /// so a double-submit of the same payload cannot post two Discount lines.
    /// </summary>
    public string? IdempotencyKey { get; set; }
}

// ============ Billing Rules DTOs ============

public class BillingRuleDto
{
    public Guid Id { get; set; }
    public Guid? BranchId { get; set; }
    public string? BranchName { get; set; }
    public string Name { get; set; } = null!;
    public string VisitType { get; set; } = null!;
    public int FreeDays { get; set; }
    public int FreeVisits { get; set; }
    public string Condition { get; set; } = null!;
    public decimal DefaultFee { get; set; }
    public bool IsActive { get; set; }
    public int Priority { get; set; }
    public string? Description { get; set; }
}

public class CreateBillingRuleDto
{
    public Guid? BranchId { get; set; }
    
    [Required]
    public string Name { get; set; } = null!;
    
    [Required]
    public string VisitType { get; set; } = null!;
    
    public int FreeDays { get; set; } = 7;
    public int FreeVisits { get; set; } = 2;
    public string Condition { get; set; } = "first_reached";
    public decimal DefaultFee { get; set; }
    public int Priority { get; set; } = 100;
    public string? Description { get; set; }
}

public class UpdateBillingRuleDto
{
    public string? Name { get; set; }
    public int? FreeDays { get; set; }
    public int? FreeVisits { get; set; }
    public string? Condition { get; set; }
    public decimal? DefaultFee { get; set; }
    public bool? IsActive { get; set; }
    public int? Priority { get; set; }
    public string? Description { get; set; }
}

// ============ Billing Check DTOs ============

public class BillingCheckDto
{
    public Guid PatientId { get; set; }
    public Guid AppointmentId { get; set; }
    public string VisitType { get; set; } = null!;
    public bool IsFreeVisit { get; set; }
    public string? FreeVisitReason { get; set; }
    public decimal RecommendedFee { get; set; }
    public BillingRuleDto? AppliedRule { get; set; }
    public int PreviousVisitsInPeriod { get; set; }
    public DateTime? LastVisitDate { get; set; }
}

public class IpBillingDashboardDto
{
    public DateTime FromUtc { get; set; }
    public DateTime ToUtcExclusive { get; set; }
    public string RangeLabel { get; set; } = "";
    public string BilledDateBasis { get; set; } = "";
    public string CollectionDateBasis { get; set; } = "";
    public string AdmissionDateBasis { get; set; } = "";
    public int PatientCount { get; set; }
    public int PendingRefundCount { get; set; }
    public decimal PendingRefundAmount { get; set; }
    public int PendingCreditApprovalCount { get; set; }
    public decimal PackageEstimate { get; set; }
    public decimal TotalBilled { get; set; }
    public decimal TotalCollected { get; set; }
    public decimal PatientOutstanding { get; set; }
    public decimal PayerOutstanding { get; set; }
    public decimal Refunds { get; set; }
    public decimal Adjustments { get; set; }
    public IReadOnlyList<IpBillingNamedCountDto> Pipeline { get; set; } = [];
    public IReadOnlyList<IpBillingNamedAmountDto> PaymentInstruments { get; set; } = [];
    public IReadOnlyList<IpBillingNamedAmountDto> PayerMix { get; set; } = [];
    public IReadOnlyList<IpBillingAgingDto> Aging { get; set; } = [];
    public IReadOnlyList<IpBillingPatientRowDto> Patients { get; set; } = [];
    /// <summary>RPT-080. Implants + consumables recorded in the window but not posted. Catalog amount.</summary>
    public int UnbilledActivityCount { get; set; }
    public decimal UnbilledActivityAmount { get; set; }
    public int UnbilledImplantCount { get; set; }
    public int UnbilledConsumableCount { get; set; }
    public int UnmappedExceptionCount { get; set; }
}

public class IpBillingNamedCountDto
{
    public string Key { get; set; } = "";
    public string Label { get; set; } = "";
    public int Count { get; set; }
    public decimal BilledAmount { get; set; }
}

public class IpBillingNamedAmountDto
{
    public string Key { get; set; } = "";
    public string Label { get; set; } = "";
    public decimal Amount { get; set; }
}

public class IpBillingAgingDto
{
    public string Key { get; set; } = "";
    public string Label { get; set; } = "";
    public int Count { get; set; }
    public decimal PatientOutstanding { get; set; }
    public decimal PayerOutstanding { get; set; }
}

public class IpBillingPatientRowDto
{
    public Guid BillId { get; set; }
    public Guid PatientId { get; set; }
    public Guid? JourneyId { get; set; }
    public string PatientName { get; set; } = "";
    public string? Mrn { get; set; }
    public DateTime? AdmissionDate { get; set; }
    public DateTime BillDate { get; set; }
    public string BillNumber { get; set; } = "";
    public decimal BilledAmount { get; set; }
    public decimal PatientResponsibility { get; set; }
    public decimal PayerResponsibility { get; set; }
    public decimal Collected { get; set; }
    public decimal PatientOutstanding { get; set; }
    public decimal PayerOutstanding { get; set; }
    public string Lifecycle { get; set; } = "";
    public DateTime? LastTransactionAt { get; set; }
    /// <summary>complete | missing_charges | unmapped. Finance-facing; omit amounts on ward/doctor.</summary>
    public string ChargeStatus { get; set; } = "complete";
    public string ChargeStatusLabel { get; set; } = "Complete";
}
