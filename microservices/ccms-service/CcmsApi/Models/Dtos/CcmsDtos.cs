namespace CcmsApi.Models.Dtos;

// ─────────────────────────────────────────────────────────────────────────────
// Coverage Case DTOs
// ─────────────────────────────────────────────────────────────────────────────

public record CoverageCaseSummaryDto(
    Guid    Id,
    string  CaseNumber,
    Guid?   PatientId,
    string? PatientName,
    Guid?   SessionId,
    string  CurrentState,
    string  PayerType,
    string? PaymentType,
    Guid?   InsuranceProviderId,
    Guid?   TpaProviderId,
    string? PreAuthNumber,
    decimal ApprovedAmount,
    bool    IsDraft,
    DateTime CreatedAt,
    DateTime UpdatedAt,
    // Denormalized for list display without parsing the draft JSON blob
    string? InsurerName,
    // Financial fields extracted from counsellor draft JSON
    decimal? EstimatedAmount,
    decimal? PatientPayableAmount
);

public record CoverageCaseDetailDto(
    Guid    Id,
    string  CaseNumber,
    Guid?   PatientId,
    string? PatientName,
    Guid?   SessionId,
    Guid?   JourneyId,
    Guid?   FinancialYearId,
    Guid?   BranchId,
    Guid?   DoctorId,
    string  CurrentState,
    string  PayerType,
    string? PaymentType,
    Guid?   InsuranceProviderId,
    Guid?   TpaProviderId,
    Guid?   GovernmentSchemeId,
    Guid?   CoveragePackageId,
    Guid?   WorkflowInstanceId,
    decimal ApprovedAmount,
    string? RoomClassApproved,
    string? PreAuthNumber,
    DateTime? PreAuthExpiry,
    bool    IsDraft,
    DateTime? DraftSavedAt,
    DateTime CreatedAt,
    DateTime UpdatedAt,
    // ── Counsellor-captured data ─────────────────────────────────────────────
    string? CounsellorDraftJson,
    string? InsurerName,
    string? ProcessStatus,
    // ── Service tax (migration 124) ──────────────────────────────────────────
    bool    ServiceTaxApplicable,
    decimal ServiceTaxPercent,
    decimal ServiceTaxAmount,
    // ── Entity status ────────────────────────────────────────────────────────
    string  EntityStatus
);

// ─────────────────────────────────────────────────────────────────────────────
// Policy DTOs
// ─────────────────────────────────────────────────────────────────────────────

public record VisitPolicyDto(
    Guid   Id,
    Guid?  SessionId,
    Guid?  CoverageCase_Id,
    string PolicyNumber,
    string? CardNumber,
    string? MembershipNumber,
    Guid?  InsuranceProviderId,
    Guid?  TpaProviderId,
    string? InsuredName,
    string? RelationshipToInsured,
    string? CompanyName,
    string? Occupation,
    string? Designation,
    string? EmployeeId,
    string? VideNumber,
    string? ContactNumber,
    string? DoctorName,
    string? DoctorRegNumber,
    string? DoctorQualification,
    string? DoctorContact,
    string? AccommodationClass,
    string? TpaCoordinatorName,
    bool   IsPrimary,
    int    SortOrder,
    string? UnderwritingSnapshotJson,
    bool?  ServiceTaxApplicable,
    DateTime CreatedAt,
    DateTime UpdatedAt
);

// ─────────────────────────────────────────────────────────────────────────────
// Authorization DTOs
// ─────────────────────────────────────────────────────────────────────────────

public record AuthorizationSummaryDto(
    Guid    Id,
    Guid    CoverageCase_Id,
    string  AuthorizationType,
    string? PreAuthNumber,
    decimal RequestedAmount,
    decimal ApprovedAmount,
    string? RoomClassRequested,
    string? RoomClassApproved,
    DateTime? ValidFrom,
    DateTime? ValidTo,
    DateTime? SubmittedAt,
    DateTime? ReceivedAt,
    string? TpaReferenceNumber,
    string? RejectionReason,
    DateTime CreatedAt,
    string  Status,          // entity status (active/deleted)
    string  ProcessStatus,   // workflow process status (pending/approved/…)
    // Migration 124 — clinical + financial (returned on generate/get)
    string? ClinicalSummary,
    string? TreatingDoctorName,
    string? TreatingDoctorReg,
    DateOnly? AdmissionDate,
    DateOnly? ExpectedDischargeDate,
    int?    LengthOfStayDays,
    string? RoomTypeRequested,
    decimal EstimatedTotalCost,
    decimal CopayAmount,
    decimal DeductibleAmount,
    decimal ServiceTaxAmount,
    decimal NetPayableByInsurer,
    decimal NetPayableByPatient
);

// ─────────────────────────────────────────────────────────────────────────────
// Settlement DTOs
// ─────────────────────────────────────────────────────────────────────────────

public record SettlementDto(
    Guid    Id,
    Guid    CoverageCase_Id,
    Guid?   ClaimPacketId,
    string  SettlementNumber,
    string  SettlementType,       // full | partial
    decimal SettledAmount,
    decimal ClaimAmount,
    decimal OutstandingAmount,
    string? PaymentMode,
    string? PaymentReference,
    DateOnly? PaymentDate,
    string? BankReference,
    DateTime? SettledAt,
    string  ReconciliationStatus, // pending | reconciled | disputed
    string? ReconciliationNotes,
    DateTime? ReconciliationAt,
    DateTime CreatedAt,
    DateTime UpdatedAt,
    List<SettlementLineItemDto>? LineItems
);

/// <summary>
/// Patient 360 settlement context. Stored settlement fields plus the case and claim numbers
/// already on the coverage case and claim packet. Bank, notes, and line items stay off this DTO.
/// </summary>
public record Patient360SettlementDto(
    Guid Id,
    string SettlementNumber,
    string SettlementType,
    decimal SettledAmount,
    decimal ClaimAmount,
    string? PaymentMode,
    string? PaymentReference,
    DateOnly? PaymentDate,
    DateTime? SettledAt,
    string ReconciliationStatus,
    DateTime CreatedAt,
    string CaseNumber,
    string? ClaimNumber
);

public record SettlementLineItemDto(
    Guid    Id,
    string  LineItemType,
    string  Description,
    decimal ClaimedAmount,
    decimal SettledAmount,
    decimal DisallowedAmount,
    string? DisallowedReason
);

// ─────────────────────────────────────────────────────────────────────────────
// Communication / Queue row DTOs
// ─────────────────────────────────────────────────────────────────────────────

public record CommunicationLogDto(
    Guid    Id,
    Guid    CoverageCase_Id,
    string  CommunicationType,  // email | sms | fax | letter | call
    string  Direction,          // outbound | inbound
    string  RecipientType,      // tpa | insurer | patient | hospital
    string? RecipientAddress,
    string? Subject,
    string? BodySummary,
    DateTime? SentAt,
    string  DeliveryStatus,
    string? ExternalMessageId,
    DateTime CreatedAt
);

// ─────────────────────────────────────────────────────────────────────────────
// Enhancement Request DTOs
// ─────────────────────────────────────────────────────────────────────────────

public record EnhancementRequestDto(
    Guid    Id,
    Guid    CoverageCase_Id,
    string  EnhancementType,
    decimal RequestedAmount,
    decimal ApprovedAmount,
    string? Reason,
    string  Status,
    DateTime? SubmittedAt,
    DateTime? DecidedAt,
    Guid?   DecisionBy,
    DateTime CreatedAt,
    DateTime UpdatedAt
);

// ─────────────────────────────────────────────────────────────────────────────
// Claim Packet DTOs
// ─────────────────────────────────────────────────────────────────────────────

public record ClaimPacketDto(
    Guid    Id,
    Guid    CoverageCase_Id,
    string  ClaimNumber,
    decimal ClaimedAmount,
    string  ClaimType,
    string  SubmissionMode,
    string  Status,
    DateTime? SubmittedAt,
    DateTime? AcknowledgedAt,
    string? TpaClaimNumber,
    DateTime? ExpectedSettlementDate,
    DateTime CreatedAt,
    DateTime UpdatedAt,
    string QueryStatus = "none"
);

// ─────────────────────────────────────────────────────────────────────────────
// Payer / Insurance Provider DTOs
// ─────────────────────────────────────────────────────────────────────────────

public record InsuranceProviderDto(
    Guid    Id,
    string  ProviderName,
    string  ProviderCode,
    string? LicenseNumber,
    string? ContactEmail,
    string? ContactPhone,
    string? PortalUrl,
    string  ClaimSubmissionMode,
    bool    PreAuthRequired,
    // Migration 123
    string  PayerCategory,
    string? DebtorSubtype,
    decimal? CreditLimit,
    string? ExportCode,
    string? HospitalIdentifier,
    bool    ServiceTaxApplicable,
    decimal DefaultServiceTaxPercent,
    bool    TdsMandatory,
    DateOnly? ValidFrom,
    DateOnly? ValidTo,
    string? FormatCode,
    string  Status,
    DateTime UpdatedAt
);
