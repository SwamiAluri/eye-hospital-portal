namespace InventoryApi.Models.Entities;

public class Vendor
{
    public Guid Id { get; set; }
    public Guid TenantId { get; set; }
    public string Name { get; set; } = string.Empty;
    /// <summary>Auto-generated code in format VEN-YYYYMM-NNNN.</summary>
    public string? VendorCode { get; set; }
    /// <summary>pharmaceutical | iol_optical | surgical | cold_chain | general_supplies | general_stores | general</summary>
    public string VendorCategory { get; set; } = "general";
    /// <summary>Marks this vendor as preferred supplier for its category.</summary>
    public bool IsPreferred { get; set; } = false;
    /// <summary>True when stock received from this vendor is consignment (issue/return against vendor-owned lots).</summary>
    public bool IsConsignmentVendor { get; set; } = false;
    public string? ContactPerson { get; set; }
    public string? Phone { get; set; }
    public string? Email { get; set; }
    public string? Address { get; set; }
    /// <summary>Registered / GST address (may differ from operational address).</summary>
    public string? RegisteredAddress { get; set; }
    public string? Website { get; set; }
    public string? GstNumber { get; set; }
    public string? PanNumber { get; set; }
    public string? DrugLicenseNumber { get; set; }
    /// <summary>Form 20-B drug licence (retail).</summary>
    public string? DrugLicense20B { get; set; }
    /// <summary>Form 21-B drug licence (wholesale).</summary>
    public string? DrugLicense21B { get; set; }
    /// <summary>Expiry date of Form 20-B licence.</summary>
    public DateTime? DrugLicense20BExpiry { get; set; }
    /// <summary>Expiry date of Form 21-B licence.</summary>
    public DateTime? DrugLicense21BExpiry { get; set; }
    /// <summary>Company Identification Number (MCA).</summary>
    public string? CinNumber { get; set; }
    /// <summary>SWIFT/BIC code for international payments.</summary>
    public string? SwiftCode { get; set; }
    /// <summary>Interest rate % per annum on overdue invoices.</summary>
    public decimal? LatePaymentInterestRate { get; set; }
    /// <summary>True if vendor supplies cold-chain / refrigerated items.</summary>
    public bool IsColdChainVendor { get; set; } = false;
    public DateTime? DrugLicenseExpiry { get; set; }
    public string? ApmcRegistration { get; set; }
    public string? FoodLicenseNumber { get; set; }
    public string? ImportExportCode { get; set; }
    public string? BankName { get; set; }
    public string? BankAccountNumber { get; set; }
    public string? BankIfscCode { get; set; }
    /// <summary>Name of the account holder as printed on cheque / bank record.</summary>
    public string? BankAccountHolderName { get; set; }
    /// <summary>current | savings | cc | od</summary>
    public string BankAccountType { get; set; } = "current";
    public decimal CreditDays { get; set; } = 0;
    public decimal OutstandingBalance { get; set; } = 0;
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }
    public Guid? CreatedByUserId { get; set; }
    public Guid? UpdatedByUserId { get; set; }
    public DateTime? DeletedAt { get; set; }
    public string Status { get; set; } = "active";

    // Navigation
    public ICollection<PurchaseInvoice> PurchaseInvoices { get; set; } = [];
    public ICollection<VendorPayment> VendorPayments { get; set; } = [];
    public ICollection<VendorOutstandingLedger> OutstandingLedgers { get; set; } = [];
    public ICollection<VendorPerformanceRecord> PerformanceRecords { get; set; } = [];
}
