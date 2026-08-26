namespace IpManagementService.Models.Domain;

public class IpBillingTransaction
{
    public Guid     Id                  { get; set; }
    public Guid     TenantId            { get; set; }
    public Guid     BranchId            { get; set; }
    public Guid     PatientJourneyId    { get; set; }

    public string   TransactionType     { get; set; } = string.Empty; // Advance|Payment|Discount|Refund
    public string   PaymentMode         { get; set; } = string.Empty; // Cash|Card|UPI|Insurance|CGHS
    public decimal  Amount              { get; set; }
    public string?  ReferenceNumber     { get; set; }
    public string?  ReceiptNumber       { get; set; }
    public string?  Notes               { get; set; }

    // Audit
    public DateTime  CreatedAt         { get; set; }
    public DateTime  UpdatedAt         { get; set; }
    public Guid?     CreatedByUserId   { get; set; }
    public Guid?     UpdatedByUserId   { get; set; }
    public DateTime? DeletedAt        { get; set; }
    public string    Status           { get; set; } = "active";
    public Guid?     OpdBillId              { get; set; }
    public Guid?     OpdBillPaymentId       { get; set; }
    public string    MappingStatus          { get; set; } = "unmapped";
}
