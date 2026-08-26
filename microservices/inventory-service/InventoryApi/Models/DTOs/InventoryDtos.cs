namespace InventoryApi.Models.DTOs;

// ── Shared ────────────────────────────────────────────────────────────────────
public record PagedResult<T>(IReadOnlyList<T> Items, int Total, int Page, int PageSize);

// ── Vendor ────────────────────────────────────────────────────────────────────
public record VendorDto(
    Guid      Id,
    string    Name,
    string?   VendorCode,
    string    VendorCategory,
    bool      IsPreferred,
    string?   ContactPerson,
    string?   Phone,
    string?   Email,
    string?   Address,
    string?   RegisteredAddress,
    string?   Website,
    string?   GstNumber,
    string?   PanNumber,
    string?   CinNumber,
    string?   DrugLicenseNumber,
    DateTime? DrugLicenseExpiry,
    string?   DrugLicense20B,
    DateTime? DrugLicense20BExpiry,
    string?   DrugLicense21B,
    DateTime? DrugLicense21BExpiry,
    string?   ApmcRegistration,
    string?   FoodLicenseNumber,
    string?   ImportExportCode,
    string?   SwiftCode,
    decimal?  LatePaymentInterestRate,
    bool      IsColdChainVendor,
    string?   BankName,
    string?   BankAccountNumber,
    string?   BankIfscCode,
    string?   BankAccountHolderName,
    string    BankAccountType,
    decimal   CreditDays,
    decimal   OutstandingBalance,
    string    Status,
    bool      IsConsignmentVendor = false
);

public record CreateVendorRequest(
    string    Name,
    string?   VendorCode,
    string    VendorCategory,
    bool      IsPreferred,
    string?   ContactPerson,
    string?   Phone,
    string?   Email,
    string?   Address,
    string?   RegisteredAddress,
    string?   Website,
    string?   GstNumber,
    string?   PanNumber,
    string?   CinNumber,
    string?   DrugLicenseNumber,
    DateTime? DrugLicenseExpiry,
    string?   DrugLicense20B,
    DateTime? DrugLicense20BExpiry,
    string?   DrugLicense21B,
    DateTime? DrugLicense21BExpiry,
    string?   ApmcRegistration,
    string?   FoodLicenseNumber,
    string?   ImportExportCode,
    string?   SwiftCode,
    decimal?  LatePaymentInterestRate,
    bool      IsColdChainVendor,
    string?   BankName,
    string?   BankAccountNumber,
    string?   BankIfscCode,
    string?   BankAccountHolderName,
    string    BankAccountType,
    decimal   CreditDays = 30,
    string?   Status = null,
    bool      IsConsignmentVendor = false
);

// ── Item ──────────────────────────────────────────────────────────────────────
public record ItemDto(
    Guid     Id,
    Guid?    CategoryId,
    string   ItemName,
    string?  GenericName,
    string?  Brand,
    string?  HsnCode,
    string   Unit,
    string?  ScheduleType,
    bool     RequiresColdStorage,
    bool     IsBarcodeTracked,
    string   ItemType,
    decimal  ReorderLevel,
    decimal  ReorderQuantity,
    string?  DefaultGstRate,
    Guid?    LinkedInjectorItemId,
    bool     IsSerialized,
    bool     IsAssetItem,
    string?  MdrClassification,
    string   Status
);

public record CreateItemRequest(
    string   ItemName,
    string?  GenericName,
    string?  Brand,
    Guid?    CategoryId,
    string?  HsnCode,
    string   Unit,
    string?  ScheduleType,
    bool     RequiresColdStorage,
    bool     IsBarcodeTracked,
    string   ItemType,
    decimal  ReorderLevel,
    decimal  ReorderQuantity,
    string?  DefaultGstRate,
    Guid?    LinkedInjectorItemId,
    bool     IsSerialized = false,
    bool     IsAssetItem  = false,
    string?  MdrClassification = null
);

// ── Purchase Invoice ───────────────────────────────────────────────────────────
public record PurchaseInvoiceDto(
    Guid     Id,
    Guid     VendorId,
    string   VendorName,
    Guid     StoreId,
    string   StoreName,
    string   InvoiceNumber,
    DateTime InvoiceDate,
    string?  DeliveryChallNumber,
    DateTime? DeliveryChallDate,
    string?  VendorOrderNumber,
    string?  VendorSapNumber,
    string   BillingMode,
    string?  PatientName,
    string?  PatientIpNo,
    decimal  GrossAmount,
    decimal  DiscountAmount,
    decimal  TaxableAmount,
    decimal  TotalGst,
    decimal  TcsPercent,
    decimal  TcsAmount,
    decimal  NetAmount,
    decimal  PaidAmount,
    decimal  BalanceAmount,
    string   ApprovalStatus,
    DateTime CreatedAt,
    List<PurchaseItemDto> Items,
    string?   GrnNumber             = null,
    string?   InvoiceType           = null,
    string?   PaymentMode           = null,
    int?      CreditPeriod          = null,
    DateTime? DueDate               = null,
    string?   Reference             = null,
    string?   PurchaseCategory      = null,
    // e-Invoice & E-Way Bill
    string?   Irn                   = null,
    string?   AckNo                 = null,
    DateTime? AckDate               = null,
    string?   EWayBillNo            = null,
    DateTime? EWayBillDate          = null,
    DateTime? DateOfDelivery        = null,
    bool      IsReverseCharge       = false,
    string?   VendorGstinOnInvoice  = null
);

public record PurchaseItemDto(
    Guid     Id,
    Guid     ItemId,
    string   ItemName,
    decimal  OrderedQuantity,
    decimal  ReceivedQuantity,
    decimal  RejectedQuantity,
    decimal  FreeQuantity,
    string?  BatchNumber,
    DateTime? ExpiryDate,
    string?  Barcode,
    decimal  OriginalMrp,
    decimal  Mrp,
    decimal  PurchaseRate,
    decimal  DiscountPercent,
    bool     IsFullDiscount,
    string?  HsnCode,
    decimal  GstPercent,
    decimal  CgstPercent,
    decimal  SgstPercent,
    decimal  IgstPercent,
    decimal  NetAmount,
    string?  PatientName,
    string?  PatientIpNo,
    string?  ItemRemarks,
    // Extended display fields
    decimal  Packing,
    decimal  UnitsPerPack,
    decimal  SellingPrice,
    decimal  MrpOnPack,
    decimal  TransferMrp,
    bool     IsAssetItem,
    bool     TaxOnFree,
    bool     IsReplacement,
    // Traceability (new)
    string?  SerialNumber,
    string?  ManufacturerName,
    string?  CountryOfOrigin,
    DateTime? MfgDate,
    string?  ScheduleType,
    bool     IsColdChain,
    string?  BrandName,
    string?  VendorSku,
    bool     IsInterState,
    string?  ExtraFieldsJson
);

public record CreateInvoiceRequest(
    Guid     VendorId,
    Guid     StoreId,
    string   InvoiceNumber,
    DateTime InvoiceDate,
    string?  DeliveryChallNumber,
    DateTime? DeliveryChallDate,
    string?  VendorOrderNumber,
    string?  VendorDeliveryNoteNumber,
    string?  VendorSapNumber,
    string?  VendorBatchRef,
    string   BillingMode,
    string?  PatientName,
    string?  PatientIpNo,
    decimal  TcsPercent,
    string?  Remarks,
    List<CreatePurchaseItemRequest> Items,
    // Extended fields — all optional for backwards compatibility
    string?  InvoiceType         = null,
    string?  PaymentMode         = null,
    int?     CreditPeriod        = null,
    DateTime? DueDate            = null,
    string?  Reference           = null,
    string?  PurchaseCategory    = null,
    // e-Invoice & E-Way Bill (new)
    string?  Irn                 = null,
    string?  AckNo               = null,
    DateTime? AckDate            = null,
    string?  EWayBillNo          = null,
    DateTime? EWayBillDate       = null,
    DateTime? DateOfDelivery     = null,
    bool     IsReverseCharge     = false,
    string?  VendorGstinOnInvoice = null
);

public record CreatePurchaseItemRequest(
    Guid     ItemId,
    decimal  OrderedQuantity,
    decimal  FreeQuantity,
    string?  BatchNumber,
    DateTime? ExpiryDate,
    string?  Barcode,
    decimal  OriginalMrp,
    decimal  Mrp,
    decimal  PurchaseRate,
    decimal  DiscountPercent,
    bool     IsFullDiscount,
    string?  HsnCode,
    decimal  GstPercent,
    decimal  CgstPercent,
    decimal  SgstPercent,
    decimal  IgstPercent,
    string?  PatientName,
    string?  PatientIpNo,
    Guid?    SurgeryId,
    string?  ItemRemarks,
    // Extended GST form fields — all optional
    decimal  SellingPrice      = 0,
    decimal  Packing           = 0,
    decimal  UnitsPerPack      = 0,
    decimal  MrpOnPack         = 0,
    decimal  TransferMrp       = 0,
    bool     IsAssetItem       = false,
    bool     TaxOnFree         = false,
    bool     IsReplacement     = false,
    // Traceability (new)
    string?  SerialNumber      = null,
    string?  ManufacturerName  = null,
    string?  CountryOfOrigin   = null,
    DateTime? MfgDate          = null,
    string?  ScheduleType      = null,
    bool     IsColdChain       = false,
    string?  BrandName         = null,
    string?  VendorSku         = null,
    bool     IsInterState      = false,
    string?  ExtraFields       = null
);

public record UpdateInvoiceRequest(
    string?   InvoiceNumber    = null,
    DateTime? InvoiceDate      = null,
    string?   InvoiceType      = null,
    string?   PaymentMode      = null,
    int?      CreditPeriod     = null,
    DateTime? DueDate          = null,
    string?   Reference        = null,
    string?   PurchaseCategory = null
);

public record UpdateInvoiceItemDto(
    Guid?     Id               = null,
    Guid      ItemId           = default,
    decimal   OrderedQuantity  = 1,
    decimal   ReceivedQuantity = 0,
    decimal   FreeQuantity     = 0,
    string?   BatchNumber      = null,
    DateTime? ExpiryDate       = null,
    string?   Barcode          = null,
    decimal   OriginalMrp      = 0,
    decimal   Mrp              = 0,
    decimal   PurchaseRate     = 0,
    decimal   DiscountPercent  = 0,
    bool      IsFullDiscount   = false,
    string?   HsnCode          = null,
    decimal   GstPercent       = 0,
    decimal   CgstPercent      = 0,
    decimal   SgstPercent      = 0,
    decimal   IgstPercent      = 0,
    string?   ItemRemarks      = null
);

public record UpdateInvoiceItemsRequest(List<UpdateInvoiceItemDto> Items);

// ── GRN ───────────────────────────────────────────────────────────────────────
public record GrnHeaderDto(
    Guid     Id,
    Guid     InvoiceId,
    string   InvoiceNumber,
    Guid     StoreId,
    string?  GrnNumber,
    DateTime GrnDate,
    string   GrnStatus,
    string?  Remarks,
    List<GrnItemDto> Items,
    // Extended display fields (A4)
    Guid     VendorId,
    string   VendorName,
    DateTime InvoiceDate,
    DateTime? DueDate,
    decimal  NetAmount,
    decimal  TotalAmount,
    string?  PurchaseCategory  = null,
    string?  PaymentMode       = null,
    string?  StoreName         = null,
    string?  ApprovalStatus    = null
);

public record GrnItemDto(
    Guid     Id,
    Guid     PurchaseItemId,
    Guid     ItemId,
    string   ItemName,
    decimal  AcceptedQuantity,
    decimal  RejectedQuantity,
    string?  RejectionReason,
    bool     IsVerified,
    string?  Barcode,
    // Extended purchase item display fields (A5)
    decimal  OrderedQuantity,
    string?  BatchNumber,
    DateTime? ExpiryDate,
    decimal  PurchaseRate,
    decimal  Mrp,
    decimal  CgstPercent,
    decimal  SgstPercent,
    decimal  IgstPercent,
    decimal  CgstAmount,
    decimal  SgstAmount,
    decimal  IgstAmount,
    decimal  Packing,
    decimal  FreeQuantity,
    decimal  PurchaseCost
);

public record CreateGrnRequest(
    Guid     InvoiceId,
    Guid     StoreId,
    DateTime GrnDate,
    string?  Remarks,
    List<CreateGrnItemRequest> Items
);

public record CreateGrnItemRequest(
    Guid     PurchaseItemId,
    Guid     ItemId,
    decimal  AcceptedQuantity,
    decimal  RejectedQuantity,
    string?  RejectionReason,
    string?  Barcode
);

// ── Stock ─────────────────────────────────────────────────────────────────────
public record StockSummaryDto(
    Guid     StoreId,
    string   StoreName,
    Guid     ItemId,
    string   ItemName,
    string?  GenericName,
    string   Unit,
    decimal  TotalAvailable,
    DateTime? NearestExpiry,
    int      BatchCount,
    decimal  ReorderLevel,
    bool     IsBelowReorder
);

public record StockBatchDto(
    Guid     Id,
    Guid     ItemId,
    string   ItemName,
    string   BatchNumber,
    DateTime? ExpiryDate,
    string?  Barcode,
    decimal  Mrp,
    decimal  PurchaseRate,
    decimal  QuantityAvailable
);

/// <summary>
/// Returned by GET inventory/stock/cold-chain-alerts.
/// Identifies stock batches that require refrigeration but are stored in a
/// non-refrigerated store, which is a compliance violation.
/// </summary>
public record ColdChainAlertDto(
    Guid      BatchId,
    Guid      ItemId,
    string    ItemName,
    Guid      StoreId,
    string    StoreName,
    string    StoreType,
    string    BatchNumber,
    DateTime? ExpiryDate,
    decimal   QuantityAvailable
);

public record StockTransferRequest(
    Guid     FromStoreId,
    Guid     ToStoreId,
    DateTime TransferDate,
    string?  Remarks,
    List<TransferItemRequest> Items
);

public record TransferItemRequest(
    Guid     ItemId,
    Guid     StockBatchId,
    decimal  TransferQuantity
);

public record CancelTransferRequest(string? Reason);

// ── Pharmacy Bill ─────────────────────────────────────────────────────────────
public record CreatePharmacyBillRequest(
    Guid     StoreId,
    Guid?    PatientId,
    string?  PatientName,
    string?  PatientIpOpNo,
    Guid?    PrescribedByDoctorId,
    string   PaymentMode,
    decimal  PaidAmount,
    string?  Remarks,
    List<CreateBillItemRequest> Items
);

public record CreateBillItemRequest(
    Guid     ItemId,
    Guid?    StockBatchId,
    decimal  Quantity,
    decimal  DiscountPercent,
    string?  Barcode
);

// ── Surgery Consumable ────────────────────────────────────────────────────────
public record IssueSurgeryConsumableRequest(
    Guid     StoreId,
    Guid?    SurgeryId,
    string   IolBillingMode,
    string?  PatientName,
    string?  PatientIpNo,
    List<IssueConsumableItemRequest> Items,
    Guid?    JourneyId = null
);

public record IssueConsumableItemRequest(
    Guid     ItemId,
    Guid?    StockBatchId,
    decimal  Quantity,
    string?  Barcode,
    string?  Remarks
);

public record PlanConsumableRequest(
    Guid     StoreId,
    Guid?    SurgeryId,
    string   IolBillingMode,
    string?  PatientName,
    string?  PatientIpNo,
    List<PlanConsumableItemRequest> Items,
    Guid?    JourneyId = null
);

public record PlanConsumableItemRequest(
    Guid     ItemId,
    decimal  PlannedQuantity,
    Guid?    StockBatchId = null,
    string?  Barcode = null,
    string?  Remarks = null
);

public record RaiseEscalationRequest(
    string Reason
);

public record PostConsumableReturnRequest(
    decimal ReturnedQuantity
);

// ── Approval ──────────────────────────────────────────────────────────────────
public record ApproveInvoiceRequest(
    string   Action,       // PrimaryApproval | FinalApproval | Rejection
    string?  Remarks
);

// ── Requisition ───────────────────────────────────────────────────────────────
public record CreateRequisitionRequest(
    Guid     StoreId,
    string   RequisitionType,
    string?  Remarks,
    List<CreateRequisitionItemRequest> Items
);

public record CreateRequisitionItemRequest(
    Guid     ItemId,
    decimal  RequiredQuantity,
    string?  PreferredVendor,
    string?  Remarks
);

// ── Vendor Payment ────────────────────────────────────────────────────────────
public record CreateVendorPaymentRequest(
    Guid     VendorId,
    Guid?    InvoiceId,
    string   PaymentReference,
    DateTime PaymentDate,
    decimal  Amount,
    string   PaymentMode,
    string?  Remarks,
    // NEFT / RTGS
    string?   UtrNumber             = null,
    string?   BankName              = null,
    string?   AccountNumber         = null,
    string?   IfscCode              = null,
    // Cheque
    string?   ChequeNumber          = null,
    DateTime? ChequeDate            = null,
    DateTime? ExpectedClearanceDate = null,
    // UPI
    string?   UpiId                 = null,
    string?   UpiApp                = null,
    // Cash
    string?   CashReceiptNumber     = null,
    string?   CashReceivedBy        = null,
    // Legacy
    string?   BankTransactionId     = null
);

// ── GST Summary ───────────────────────────────────────────────────────────────
public record GstSummaryByRateDto(
    DateTime Month,
    decimal  GstRate,
    decimal  TaxableAmount,
    decimal  CgstAmount,
    decimal  SgstAmount,
    decimal  IgstAmount,
    decimal  TotalGstAmount
);

// ── Stock Ledger ──────────────────────────────────────────────────────────────
public record StockLedgerDto(
    Guid     Id,
    Guid     StoreId,
    Guid     ItemId,
    string   ItemName,
    Guid?    StockBatchId,
    string   TransactionType,
    string?  ReferenceId,
    string?  ReferenceNumber,
    decimal  QuantityIn,
    decimal  QuantityOut,
    decimal  BalanceQuantity,
    decimal  UnitRate,
    decimal  TotalValue,
    string?  Remarks,
    string?  PatientName,
    string?  PatientIpNo,
    DateTime TransactionDate,
    DateTime CreatedAt
);

public record CreateStockAdjustmentRequest(
    Guid     StoreId,
    Guid     ItemId,
    Guid?    StockBatchId,
    /// <summary>Positive = quantity added; negative = quantity removed.</summary>
    decimal  AdjustmentQuantity,
    decimal  UnitRate,
    string?  Remarks
);

// ── Purchase Return ───────────────────────────────────────────────────────────

/// <summary>
/// Create a purchase return. SourceType governs which linking IDs are required:
///   Invoice – InvoiceId must be set
///   GRN     – GrnId must be set
///   Manual  – neither is required, but Remarks explaining the reason is recommended
/// </summary>
public record CreatePurchaseReturnRequest(
    /// <summary>Invoice | GRN | Manual</summary>
    string   SourceType,
    Guid     VendorId,
    Guid?    InvoiceId,
    Guid?    GrnId,
    string?  PurchaseCategory,
    DateTime ReturnDate,
    string   ReturnReason,
    string?  PaymentMode,
    string?  Reference,
    string?  Remarks,
    List<CreateReturnItemRequest> Items
);

public record CreateReturnItemRequest(
    Guid     ItemId,
    Guid?    StockBatchId,
    decimal  ReturnQuantity,
    decimal  FreeQuantity,
    decimal  PurchaseRate,
    string?  ReturnCause,
    string?  BatchNumber,
    DateOnly? ExpiryDate,
    // GST — optional; if not supplied, inherited from source invoice item
    string?  HsnCode        = null,
    decimal  GstPercent     = 0,
    decimal  CgstPercent    = 0,
    decimal  SgstPercent    = 0,
    decimal  IgstPercent    = 0
);

public record RecordCreditNoteRequest(
    string   CreditNoteNumber,
    decimal  CreditNoteAmount,
    DateOnly CreditNoteDate
);

/// <summary>Optional body for DELETE /purchase-returns/{id} — reason is REQUIRED when status is CreditNoteReceived.</summary>
public record CancelReturnRequest(string? CancellationReason);

// ── Vendor Payment List ───────────────────────────────────────────────────────
public record VendorPaymentDto(
    Guid      Id,
    Guid      VendorId,
    Guid?     InvoiceId,
    string    PaymentReference,
    DateTime  PaymentDate,
    decimal   Amount,
    string    PaymentMode,
    string?   Remarks,
    DateTime  CreatedAt,
    // NEFT / RTGS
    string?   UtrNumber             = null,
    string?   BankName              = null,
    string?   AccountNumber         = null,
    string?   IfscCode              = null,
    // Cheque
    string?   ChequeNumber          = null,
    DateTime? ChequeDate            = null,
    DateTime? ExpectedClearanceDate = null,
    // UPI
    string?   UpiId                 = null,
    string?   UpiApp                = null,
    // Cash
    string?   CashReceiptNumber     = null,
    string?   CashReceivedBy        = null,
    // Legacy
    string?   BankTransactionId     = null,
    // Attachment
    string?   AttachmentUrl         = null,
    string?   AttachmentFilename    = null,
    int?      AttachmentSizeKb      = null,
    // Reversal metadata
    DateTime? DeletedAt             = null,
    Guid?     ReversedByUserId      = null,
    // Settlement link
    Guid?     SettlementId          = null
);

// ── Vendor Bank Accounts ─────────────────────────────────────────────────────────────
public record VendorBankAccountDto(
    Guid      Id,
    Guid      VendorId,
    string    AccountHolderName,
    string    BankName,
    string    AccountNumber,
    string    MaskedAccountNumber,
    string    IfscCode,
    string    AccountType,
    bool      IsPrimary,
    string?   Nickname,
    DateTime  CreatedAt
);

public record CreateVendorBankAccountRequest(
    string  AccountHolderName,
    string  BankName,
    string  AccountNumber,
    string  IfscCode,
    string  AccountType = "current",
    bool    IsPrimary   = false,
    string? Nickname    = null
);

// ── Procurement Policy DTOs ────────────────────────────────────────────────

public record SavePolicyDraftRequest
{
    public Guid     BranchId                    { get; init; }
    public string   PolicyName                  { get; init; } = string.Empty;
    public decimal  DirectPoLimit               { get; init; }
    public decimal  RfqMandatoryFrom            { get; init; }
    public decimal  DualApprovalFrom            { get; init; }
    public int      MinVendorQuotes             { get; init; }
    public bool     EmergencyBypassAllowed      { get; init; }
    public int      EmergencyBypassExpiryHours  { get; init; }
    public string?  Notes                       { get; init; }
    public Guid?    PolicyId                    { get; init; }
};

public record PublishPolicyRequest(
    string?   ChangeNotes = null,
    DateTime? EffectiveFrom = null,
    DateTime? EffectiveTo = null
);

public record SimulatePolicyRequest(
    Guid    BranchId,
    decimal Amount
);

public record SimulatePolicyResult(
    decimal  Amount,
    string   RecommendedPath,
    bool     NeedsRfq,
    bool     CanDirectPo,
    bool     NeedsDualApproval,
    int      MinVendorQuotes,
    int?     EmergencyBypassExpiryHours
);

// ── RFQ DTOs ───────────────────────────────────────────────────────────────

public record CreateRfqRequest(
    Guid              BranchId,
    string            Title,
    List<RfqItemRequest> Items,
    List<Guid>        VendorIds,
    Guid?             RequisitionId = null,
    DateTime?         ResponseDeadline = null,
    string?           Notes = null
);

public record RfqItemRequest(
    Guid    ItemId,
    decimal RequestedQty,
    string  Unit,
    string? Specifications = null
);

public record SubmitQuoteRequest(
    Guid                    VendorId,
    List<QuoteItemRequest>  Items,
    DateTime?               ValidUntil = null,
    string?                 VendorNotes = null
);

public record QuoteItemRequest(
    Guid    ItemId,
    decimal QuotedQty,
    decimal UnitPrice,
    decimal GstPercent,
    decimal TotalAmount,
    string? Remarks = null
);

public record AwardRfqRequest(
    Guid VendorId
);

public record CancelRfqRequest(
    string Reason
);

public record RequestClarificationRequest(
    string Notes
);

public record RankQuoteEntry(
    Guid    QuoteId,
    int     RankPosition,
    decimal? Score = null,
    string?  Notes = null
);

public record RankQuotesRequest(
    List<RankQuoteEntry> Rankings
);

public record DisqualifyQuoteRequest(
    string Reason
);

public record ReasonRequest(
    string Reason
);

public record SubmitForApprovalRequest(
    Guid ProposedVendorId
);

public record RecordPaymentRequest(
    decimal Amount,
    string  PaymentMode
);

// ── Purchase Order DTOs ────────────────────────────────────────────────────

public record CreatePurchaseOrderRequest(
    Guid                        BranchId,
    Guid                        VendorId,
    string                      SourceType,
    List<PurchaseOrderItemRequest> Items,
    Guid?                       RequisitionId = null,
    Guid?                       RfqId = null,
    DateTime?                   ExpectedDeliveryDate = null,
    bool                        IsEmergency = false,
    string?                     Terms = null,
    string?                     Notes = null
);

public record PurchaseOrderItemRequest(
    Guid      ItemId,
    decimal   OrderedQty,
    decimal   UnitPrice,
    decimal   GstPercent,
    decimal   TotalAmount,
    string    Unit,
    DateTime? RequiredBy = null,
    string?   Remarks = null
);

public record ApprovePurchaseOrderRequest(
    string? Remarks = null
);

public record RejectPurchaseOrderRequest(
    string Reason
);

public record CancelPurchaseOrderRequest(
    string Reason
);

/// <summary>Request body for PUT /purchase-orders/{id} (Draft only).</summary>
public record UpdatePurchaseOrderRequest(
    Guid                           BranchId,
    Guid                           VendorId,
    List<PurchaseOrderItemRequest>  Items,
    DateTime?                      ExpectedDeliveryDate = null,
    bool                           IsEmergency          = false,
    string?                        Terms                = null,
    string?                        Notes                = null
);

/// <summary>Optional body for POST /purchase-orders/{id}/send-to-vendor.</summary>
public record SendToVendorRequest(
    string? Channel       = null,   // "Email" | "WhatsApp" | "SMS" | "Call" | "Other"
    string? ContactTarget = null,   // email address or phone number
    string? Notes         = null
);

// ── Week 2: Requisition Policy-Path & Conversion DTOs ────────────────────────

public record EvaluatePolicyPathResult(
    Guid     RequisitionId,
    string   RecommendedPath,       // "DirectPO" | "RFQ"
    decimal  EstimatedValue,
    decimal? DirectPoLimit,
    decimal? RfqMandatoryFrom,
    decimal? DualApprovalFrom,
    int?     MinVendorQuotes,
    bool     RequiresDualApproval,
    string   Reason,
    Guid?    PolicyId,
    string?  PolicyName
);

public record ConvertToRfqRequest
{
    public string?       Title            { get; init; }
    public Guid          BranchId         { get; init; }
    public List<Guid>?   VendorIds        { get; init; }
    public DateTime?     ResponseDeadline { get; init; }
}

public record ConvertToPOItemOverride
{
    public Guid    ItemId     { get; init; }
    public decimal OrderedQty { get; init; }
    public decimal UnitPrice  { get; init; }
    public decimal GstPercent { get; init; }
    public string  Unit       { get; init; } = "Nos";
}

public record ConvertToPORequest
{
    public Guid                          BranchId             { get; init; }
    public Guid                          VendorId             { get; init; }
    public string?                       VendorName           { get; init; }
    public List<ConvertToPOItemOverride>? Items               { get; init; }
    public DateTime?                     ExpectedDeliveryDate { get; init; }
    public bool                          IsEmergency          { get; init; }
    public string?                       Notes                { get; init; }
    public string?                       Terms                { get; init; }
}
// ── Bill Transfer DTOs ────────────────────────────────────────────────────────
public record BillTransferDto(
    Guid      Id,
    Guid      TenantId,
    Guid      GrnId,
    Guid      InvoiceId,
    Guid      VendorId,
    string?   VendorName,
    string?   GrnNumber,
    string?   InvoiceNumber,
    DateTime? InvoiceDate,
    DateTime? GrnDate,
    decimal   GrnTotalAmount,
    decimal   InvoiceTotalAmount,
    decimal   CgstAmount,
    decimal   SgstAmount,
    decimal   IgstAmount,
    decimal   TcsAmount,
    string    Status,
    Guid?     L1ApprovedBy,
    DateTime? L1ApprovedAt,
    string?   L1Remarks,
    Guid?     L2ApprovedBy,
    DateTime? L2ApprovedAt,
    string?   L2Remarks,
    string?   Remarks,
    string[]  Attachments,
    DateTime  CreatedAt,
    DateTime  UpdatedAt,
    long      VersionNo,
    DateTime? L1DueAt,
    DateTime? L2DueAt,
    string    SlaState,
    string?   CreatedByUserId
);

public record ApproveBillTransferRequest(
    string? Remarks,
    long?   ExpectedVersion     = null,
    string? OverrideReasonCode  = null,
    string? OverrideReasonText  = null
);

public record SodDecisionDto(
    bool                     StrictApplied,
    bool                     OverrideApplied,
    decimal                  ThresholdUsed,
    IReadOnlyList<string>    RuleEvaluations
);

public record BillTransferActionResultDto(
    BillTransferDto   BillTransfer,
    SodDecisionDto?   SodDecision
);

public record BillTransferReasonCatalogDto(
    Guid    Id,
    string  ReasonCode,
    string  ReasonLabel,
    string  Category,
    int     SortOrder
);

public record BillTransferChangesDto(
    IReadOnlyList<BillTransferDto> Items,
    DateTime                       ServerTimestamp
);

public record BtComplianceReportDto(
    int      TotalBillTransfers,
    int      StrictApprovals,
    int      OverrideApprovals,
    double   OverridePct,
    int      SlaBreached,
    double   MeanApprovalCycleHours,
    DateTime GeneratedAt
);

public record BtSlaStatusDto(
    Guid      BillTransferId,
    string?   GrnNumber,
    string?   VendorName,
    decimal   InvoiceTotalAmount,
    string    Status,
    string    SlaState,
    DateTime? L1DueAt,
    DateTime? L2DueAt,
    bool      IsL1Overdue,
    bool      IsL2Overdue
);

public record BillTransferEventLogDto(
    Guid      EventId,
    Guid      BillTransferId,
    string?   FromStatus,
    string    ToStatus,
    string    Action,
    Guid      ActorUserId,
    string?   ActorRole,
    string?   ReasonCode,
    string?   ReasonText,
    bool      OverrideApplied,
    DateTime  CreatedAt
);

// ── Invoice Settlement DTOs ────────────────────────────────────────────────────
public record InvoiceSettlementDto(
    Guid      Id,
    Guid      TenantId,
    Guid      BillTransferId,
    Guid      VendorId,
    string?   VendorName,
    string?   GrnNumber,
    string?   InvoiceNumber,
    decimal   GrossAmount,
    decimal   DebitNoteAdjustment,
    decimal   TcsAmount,
    decimal   NetPayableAmount,
    decimal   AmountPaid,
    decimal   BalanceRemaining,
    string    Status,
    DateTime? DueDate,
    DateTime? SettledAt,
    string?   OnHoldReason,
    string?   CancellationReason,
    string?   WriteOffReason,
    DateTime  CreatedAt,
    DateTime  UpdatedAt,
    IReadOnlyList<SettlementPaymentDto> Payments
);

public record SettlementPaymentDto(
    Guid      Id,
    Guid?     PaymentId,
    decimal   AmountAllocated,
    string    AllocationType,
    string?   Reference,
    DateTime  AppliedAt,
    // Payment-method detail (null for credit-note allocations)
    string?   PaymentMethod            = null,
    string?   UtrNumber                = null,
    string?   BankName                 = null,
    string?   AccountNumber            = null,
    string?   IfscCode                 = null,
    string?   ChequeNumber             = null,
    DateTime? ChequeDate               = null,
    DateTime? ExpectedClearanceDate    = null,
    string?   UpiId                    = null,
    string?   UpiApp                   = null,
    string?   CashReceiptNumber        = null,
    string?   CashReceivedBy           = null,
    string?   Remarks                  = null,
    // Proof attachment
    string?   AttachmentUrl            = null,
    string?   AttachmentFilename       = null,
    int?      AttachmentSizeKb         = null
);

public record RecordSettlementPaymentRequest(
    decimal   Amount,
    string    PaymentMethod,        // NEFT | RTGS | Cheque | Cash | UPI
    string    TransactionReference, // UTR for NEFT/RTGS, Cheque# for Cheque, RRN for UPI, Receipt# for Cash
    DateTime  PaymentDate,
    string?   Remarks,
    // NEFT / RTGS
    string?   UtrNumber             = null,
    string?   BankName              = null,
    string?   AccountNumber         = null,
    string?   IfscCode              = null,
    // Cheque
    DateTime? ChequeDate            = null,
    DateTime? ExpectedClearanceDate = null,
    // UPI
    string?   UpiId                 = null,
    string?   UpiApp                = null,
    // Cash
    string?   CashReceiptNumber     = null,
    string?   CashReceivedBy        = null
);

public record ApplyCreditNoteRequest(
    Guid      PurchaseReturnId,
    string?   Remarks
);

public record HoldSettlementRequest(string Reason);
public record WriteOffSettlementRequest(string Reason);
public record CancelSettlementRequest(string Reason);

/// <summary>Immutable audit-trail entry for a settlement state change.</summary>
public record SettlementEventLogDto(
    Guid      Id,
    string    FromStatus,
    string    ToStatus,
    string    EventType,
    string?   Reason,
    decimal?  Amount,
    Guid?     ActorUserId,
    string    ActorType,
    DateTime  OccurredAt
);

// ── Week 3: PO Receipt, Vendor Performance & Dashboard ─────────────────────

public record RecordPoReceiptItemLine
{
    public Guid      ItemId      { get; init; }
    public decimal   ReceivedQty { get; init; }
    public string?   BatchNumber { get; init; }
    public DateTime? ExpiryDate  { get; init; }
    public decimal?  Mrp         { get; init; }
    public string?   Barcode     { get; init; }
}

public record RecordPoReceiptRequest
{
    public Guid                          StoreId            { get; init; }
    public List<RecordPoReceiptItemLine> Items              { get; init; } = [];
    public DateTime?                     ActualDeliveryDate { get; init; }
    public string?                       Notes              { get; init; }
}

public record VendorPerformanceSummaryDto(
    Guid    VendorId,
    string  VendorName,
    int     TotalOrders,
    decimal OnTimeDeliveryRate,   // 0–100 %
    decimal AvgFulfillmentRate,   // 0–100 %
    decimal? AvgRating            // 1–5 or null
);

public record InventoryDashboardSummary(
    int     PendingRequisitions,
    int     OpenRfqs,
    int     PendingPoCount,
    int     LowStockCount,
    decimal ThisMonthPoSpend,
    decimal OnTimeDeliveryRate    // 0–100 %
);

// ── Invoice OCR Extraction ────────────────────────────────────────────────────
// Confidence bands:
//   High   >= 0.90  → auto-accept in UI
//   Review  0.70-0.89 → user must confirm
//   Low    < 0.70  → user must manually enter
// ─────────────────────────────────────────────────────────────────────────────

/// <summary>Confidence band for a single extracted field.</summary>
public enum ExtractionConfidence { High, Review, Low }

/// <summary>A single extracted + matched field with confidence metadata.</summary>
public record ExtractedField<T>(
    T?       Value,          // Normalised value ready to populate the form field
    string?  SourceText,     // Raw text from the document before normalisation
    ExtractionConfidence Confidence,
    string?  MismatchReason  // Populated when confidence < High
);

/// <summary>Candidate match returned for vendor/store/item lookups.</summary>
public record ExtractionCandidate(Guid Id, string Name, decimal Score);

/// <summary>Extracted header section of an invoice document.</summary>
public record ExtractedInvoiceHeader(
    ExtractedField<string>   InvoiceNumber,
    ExtractedField<DateTime?> InvoiceDate,
    ExtractedField<DateTime?> GrnDate,
    ExtractedField<string>   InvoiceType,       // "Invoice" | "Packing Slip"
    ExtractedField<string>   PaymentMode,
    ExtractedField<int?>     CreditPeriod,
    ExtractedField<string>   Reference,
    ExtractedField<string>   Remarks,
    // Vendor resolution
    ExtractedField<string>   VendorName,
    ExtractedField<string>   VendorGstin,
    ExtractedField<string>   VendorContact,
    ExtractedField<string>   VendorPhone,
    ExtractedField<string>   VendorEmail,
    IReadOnlyList<ExtractionCandidate> VendorCandidates,
    Guid?                    ResolvedVendorId,
    // Store resolution
    ExtractedField<string>   StoreName,
    IReadOnlyList<ExtractionCandidate> StoreCandidates,
    Guid?                    ResolvedStoreId,
    // e-Invoice & E-Way Bill (new)
    ExtractedField<string>   Irn,
    ExtractedField<string>   AckNo,
    ExtractedField<DateTime?> AckDate,
    ExtractedField<string>   EWayBillNo,
    ExtractedField<DateTime?> EWayBillDate,
    ExtractedField<DateTime?> DateOfDelivery,
    ExtractedField<bool>     IsReverseCharge,
    ExtractedField<string>   VendorGstinOnInvoice
);

/// <summary>Extracted line item from an invoice document.</summary>
public record ExtractedLineItem(
    // Item resolution
    ExtractedField<string>   RawDescription,
    ExtractedField<string>   HsnCode,
    IReadOnlyList<ExtractionCandidate> ItemCandidates,
    Guid?                    ResolvedItemId,
    string?                  ResolvedItemName,
    // Quantities / batch
    ExtractedField<decimal>  OrderedQuantity,
    ExtractedField<decimal>  FreeQuantity,
    ExtractedField<string>   BatchNumber,
    ExtractedField<DateTime?> ExpiryDate,
    // Pricing
    ExtractedField<decimal>  PurchaseRate,
    ExtractedField<decimal>  Mrp,
    ExtractedField<decimal>  DiscountPercent,
    ExtractedField<decimal>  SellingPrice,
    // GST
    ExtractedField<decimal>  GstPercent,
    ExtractedField<decimal>  CgstPercent,
    ExtractedField<decimal>  SgstPercent,
    ExtractedField<decimal>  IgstPercent,
    ExtractedField<bool>     IsInterState,
    // Traceability (new)
    ExtractedField<string[]?> SerialNumbers,
    ExtractedField<string>   ManufacturerName,
    ExtractedField<string>   CountryOfOrigin,
    ExtractedField<DateTime?> MfgDate,
    ExtractedField<string>   ScheduleType,
    ExtractedField<bool>     IsColdChain,
    ExtractedField<string>   BrandName,
    ExtractedField<string>   VendorSku,
    ExtractedField<string?>  ExtraFieldsJson
);

/// <summary>Extracted totals / tax summary section.</summary>
public record ExtractedTotals(
    ExtractedField<decimal> Subtotal,
    ExtractedField<decimal> TotalCgst,
    ExtractedField<decimal> TotalSgst,
    ExtractedField<decimal> TotalIgst,
    ExtractedField<decimal> TotalDiscount,
    ExtractedField<decimal> RoundingAmount,
    ExtractedField<decimal> NetAmount,
    ExtractedField<decimal> TcsAmount    // Tax Collected at Source — 0 when not applicable
);

/// <summary>Full extraction result returned from the preview endpoint.</summary>
public record InvoiceExtractionPreview(
    string                        SessionId,       // Opaque ID linking to stored blob + extraction metadata
    string?                       DocumentUrl,     // Blob storage URL for display in UI (read-only link)
    string                        OriginalFilename,
    string                        ProviderModel,   // e.g. "gpt-4o-mini"
    int                           ProcessingMs,
    bool                          HasDuplicateWarning,  // Vendor + invoice no + date already exists
    string?                       DuplicateWarningDetail,
    ExtractedInvoiceHeader        Header,
    IReadOnlyList<ExtractedLineItem> LineItems,
    ExtractedTotals               Totals
);

/// <summary>User-confirmed payload for a single line item after review.</summary>
public record ConfirmedLineItem(
    Guid     ItemId,
    decimal  OrderedQuantity,
    decimal  FreeQuantity,
    string?  BatchNumber,
    DateTime? ExpiryDate,
    string?  Barcode,
    decimal  Mrp,
    decimal  PurchaseRate,
    decimal  DiscountPercent,
    string?  HsnCode,
    decimal  GstPercent,
    decimal  CgstPercent,
    decimal  SgstPercent,
    decimal  IgstPercent,
    decimal  SellingPrice    = 0,
    decimal  Packing         = 0,
    decimal  UnitsPerPack    = 0,
    decimal  MrpOnPack       = 0,
    decimal  TransferMrp     = 0,
    bool     IsAssetItem     = false,
    bool     TaxOnFree       = false,
    bool     IsReplacement   = false,
    string?  ItemRemarks     = null,
    // Traceability (new)
    string?  SerialNumber      = null,
    string?  ManufacturerName  = null,
    string?  CountryOfOrigin   = null,
    DateTime? MfgDate          = null,
    string?  ScheduleType      = null,
    bool     IsColdChain       = false,
    string?  BrandName         = null,
    string?  VendorSku         = null,
    bool     IsInterState      = false,
    string?  ExtraFieldsJson   = null,
    // Patient linkage
    string?  PatientName       = null,
    string?  PatientIpNo       = null,
    Guid?    SurgeryId         = null,
    decimal  OriginalMrp       = 0,
    bool     IsFullDiscount    = false
);

/// <summary>
/// User-confirmed full payload submitted after reviewing extraction.
/// Backend creates invoice and optionally generates GRN unchanged.
/// </summary>
public record ConfirmExtractionRequest(
    string   SessionId,
    Guid     VendorId,
    Guid     StoreId,
    string   InvoiceNumber,
    DateTime InvoiceDate,
    string   InvoiceType,
    string?  PaymentMode,
    int?     CreditPeriod,
    DateTime? DueDate,
    string?  Reference,
    string?  PurchaseCategory,
    string?  Remarks,
    DateTime GrnDate,
    bool     GenerateGrn,
    IReadOnlyList<ConfirmedLineItem> Items,
    // e-Invoice & E-Way Bill (new)
    string?  Irn                  = null,
    string?  AckNo                = null,
    DateTime? AckDate             = null,
    string?  EWayBillNo           = null,
    DateTime? EWayBillDate        = null,
    DateTime? DateOfDelivery      = null,
    bool     IsReverseCharge      = false,
    string?  VendorGstinOnInvoice = null,
    // ── Audit metadata (passed from frontend for compliance logging) ──────────
    string?  OriginalFilename     = null,
    string?  DocumentUrl          = null,
    string?  ProviderModel        = null,
    int      ProcessingMs         = 0,
    int      HighFieldCount       = 0,
    int      ReviewFieldCount     = 0,
    int      LowFieldCount        = 0,
    int      FieldOverrideCount   = 0,
    string?  OverriddenFieldsJson = null,
    decimal  TcsTotalAmount       = 0    // Invoice-level TCS amount extracted from document
);

/// <summary>Response from the confirm endpoint with created invoice and optional GRN.</summary>
public record ConfirmExtractionResponse(
    PurchaseInvoiceDto Invoice,
    GrnHeaderDto?      Grn         // null when GenerateGrn = false
);