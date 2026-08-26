namespace CcmsApi.Models.Domain;

// ── Shared base ───────────────────────────────────────────────────────────────

/// Standard entity with all required HIPAA/multi-tenant columns.
public abstract class StandardEntity : CcmsApi.Data.IStandardEntity
{
    public Guid     Id                 { get; set; }
    public Guid     TenantId           { get; set; }
    public DateTime CreatedAt          { get; set; } = DateTime.UtcNow;
    public DateTime UpdatedAt          { get; set; } = DateTime.UtcNow;
    public Guid?    CreatedByUserId    { get; set; }
    public Guid?    UpdatedByUserId    { get; set; }
    public DateTime? DeletedAt         { get; set; }
    public string   Status             { get; set; } = "active";
    public int      RowVersion         { get; set; } = 1;
}

// ── Phase 0: Financial Years ──────────────────────────────────────────────────

public class CcmsFinancialYear : StandardEntity
{
    public string  YearCode   { get; set; } = string.Empty;  // "2526"
    public string  YearLabel  { get; set; } = string.Empty;  // "FY 2025-26"
    public DateOnly StartDate { get; set; }
    public DateOnly EndDate   { get; set; }
    public bool    IsCurrent  { get; set; }
}

// ── Phase 1: Workflow Engine ──────────────────────────────────────────────────

public class CcmsWorkflowDefinition : StandardEntity
{
    public string  Name        { get; set; } = string.Empty;
    public string  Code        { get; set; } = string.Empty;
    public int     Version     { get; set; } = 1;
    public bool    IsActive    { get; set; } = true;
    public string? ConfigJson  { get; set; }
}

public class CcmsWorkflowState : StandardEntity
{
    public Guid   WorkflowDefinitionId { get; set; }
    public string StateCode            { get; set; } = string.Empty;
    public string StateLabel           { get; set; } = string.Empty;
    public bool   IsInitial            { get; set; }
    public bool   IsFinal              { get; set; }
    public bool   IsTerminal           { get; set; }
    public int    SortOrder            { get; set; }
    public string? MetaJson            { get; set; }
}

public class CcmsWorkflowTransition : StandardEntity
{
    public Guid    WorkflowDefinitionId { get; set; }
    public Guid    FromStateId          { get; set; }
    public Guid    ToStateId            { get; set; }
    public string  TriggerEvent         { get; set; } = string.Empty;
    public string? RequiresRole         { get; set; }
    public bool    IsAutomatic          { get; set; }
    public string? GuardConditionJson   { get; set; }
}

public class CcmsWorkflowInstance : StandardEntity
{
    public Guid     WorkflowDefinitionId { get; set; }
    public Guid     CurrentStateId       { get; set; }
    public string   EntityType           { get; set; } = "coverage_case";
    public Guid     EntityId             { get; set; }
    public string?  ContextJson          { get; set; }
    public DateTime StartedAt            { get; set; } = DateTime.UtcNow;
    public DateTime? CompletedAt         { get; set; }
}

public class CcmsWorkflowHistory : StandardEntity
{
    public Guid     WorkflowInstanceId { get; set; }
    public Guid?    FromStateId        { get; set; }
    public Guid     ToStateId          { get; set; }
    public string?  FromStateCode      { get; set; }
    public string?  ToStateCode        { get; set; }
    public string   TriggerEvent       { get; set; } = string.Empty;
    public Guid?    ActorUserId        { get; set; }
    public string?  Notes              { get; set; }
    public DateTime TransitionedAt     { get; set; } = DateTime.UtcNow;
    public string?  MetaJson           { get; set; }
}

// ── Phase 2: Master Data ──────────────────────────────────────────────────────

public class CcmsInsuranceProvider : StandardEntity
{
    public string  ProviderName          { get; set; } = string.Empty;
    public string  ProviderCode          { get; set; } = string.Empty;
    public string? LicenseNumber         { get; set; }
    public string? ContactEmail          { get; set; }
    public string? ContactPhone          { get; set; }
    public string? PortalUrl             { get; set; }
    public string? ApiEndpoint           { get; set; }
    public string? ApiCredentialsJson    { get; set; }   // encrypted at rest
    public string  ClaimSubmissionMode   { get; set; } = "manual"; // manual|portal|api
    public bool    PreAuthRequired       { get; set; } = true;
    public string? AddressJson           { get; set; }

    // ── Migration 123: payer finance fields ───────────────────────────────
    public string  PayerCategory                { get; set; } = "insurance"; // insurance | other_debtor
    public string? DebtorSubtype                { get; set; }  // corporate | government | individual | other
    public decimal? CreditLimit                 { get; set; }
    public string? ExportCode                   { get; set; }
    public string? HospitalIdentifier           { get; set; }
    public bool    ServiceTaxApplicable         { get; set; }
    public decimal DefaultServiceTaxPercent     { get; set; }
    public bool    TdsMandatory                 { get; set; }
    public DateOnly? ValidFrom                  { get; set; }
    public DateOnly? ValidTo                    { get; set; }
    public string? FormatCode                   { get; set; }
}

public class CcmsTpaProvider : StandardEntity
{
    public string  TpaName             { get; set; } = string.Empty;
    public string  TpaCode             { get; set; } = string.Empty;
    public Guid?   InsuranceProviderId { get; set; }
    public string? ContactEmail        { get; set; }
    public string? ContactPhone        { get; set; }
    public string? PortalUrl           { get; set; }
    public string? ClaimsEmail         { get; set; }
    public int     TatDaysPreauth      { get; set; } = 3;
    public int     TatDaysClaim        { get; set; } = 30;
}

public class CcmsGovernmentScheme : StandardEntity
{
    public string   SchemeName                { get; set; } = string.Empty;
    public string   SchemeCode                { get; set; } = string.Empty;
    public string   SchemeType                { get; set; } = "state"; // central|state|local
    public string?  AdministeredBy            { get; set; }
    public decimal? BenefitLimitPerYear       { get; set; }
    public decimal? BenefitLimitPerCase       { get; set; }
    public string?  EligibilityCriteriaJson   { get; set; }
    public string?  CoveredProceduresJson     { get; set; }
    public string?  DocumentsRequiredJson     { get; set; }
    public string?  PortalUrl                 { get; set; }
}

public class CcmsCoveragePackage : StandardEntity
{
    public string  PackageName         { get; set; } = string.Empty;
    public string  PackageCode         { get; set; } = string.Empty;
    public Guid?   InsuranceProviderId { get; set; }
    public Guid?   TpaProviderId       { get; set; }
    public Guid?   GovernmentSchemeId  { get; set; }
    public string  PackageType         { get; set; } = "insurance"; // insurance|tpa|govt|cashless
    public decimal SumInsuredAmount    { get; set; }
    public decimal? RoomRentLimit      { get; set; }
    public decimal? IcuRentLimit       { get; set; }
    public string?  SubLimitsJson      { get; set; }
    public int      WaitingPeriodDays  { get; set; }
    public decimal  CopayPercent       { get; set; }
    public decimal  DeductibleAmount   { get; set; }
    public DateOnly? ValidFrom         { get; set; }
    public DateOnly? ValidTo           { get; set; }
}

public class CcmsPackageProcedure : StandardEntity
{
    public Guid    CoveragePackageId { get; set; }
    public string  ProcedureCode     { get; set; } = string.Empty;
    public string  ProcedureName     { get; set; } = string.Empty;
    public decimal ApprovedAmount    { get; set; }
    public bool    RequiresPreauth   { get; set; } = true;
}

public class CcmsExclusionRule : StandardEntity
{
    public Guid    CoveragePackageId { get; set; }
    public string  ExclusionType     { get; set; } = string.Empty; // diagnosis|procedure|condition
    public string  ExclusionCode     { get; set; } = string.Empty;
    public string? Description       { get; set; }
    public bool    IsAbsolute        { get; set; } = true;
}

public class CcmsDocumentRequirement : StandardEntity
{
    public Guid?  InsuranceProviderId { get; set; }
    public Guid?  TpaProviderId       { get; set; }
    public Guid?  GovernmentSchemeId  { get; set; }
    public string DocumentType        { get; set; } = string.Empty;
    public string DocumentName        { get; set; } = string.Empty;
    public bool   IsRequired          { get; set; } = true;
    public string AppliesAt           { get; set; } = "preauth"; // preauth|admission|claim
}

// ── Phase 3: Coverage Cases ───────────────────────────────────────────────────

public class CcmsCoverageCase : StandardEntity
{
    public string  CaseNumber          { get; set; } = string.Empty;  // CCMS-2526-000001
    public Guid    PatientId           { get; set; }
    public string? PatientName         { get; set; }
    public Guid?   SessionId           { get; set; }
    public Guid?   JourneyId           { get; set; }
    public Guid?   FinancialYearId     { get; set; }
    public Guid?   BranchId            { get; set; }
    public Guid?   DoctorId            { get; set; }
    public string  PayerType           { get; set; } = "insurance"; // insurance|tpa|govt|cashless
    public string? PaymentType         { get; set; }  // e.g. Insurance|CoPay|CGHS|SGHS|TPA — free-text from counsellor
    public Guid?   InsuranceProviderId { get; set; }
    public Guid?   TpaProviderId       { get; set; }
    public Guid?   GovernmentSchemeId  { get; set; }
    public Guid?   CoveragePackageId   { get; set; }
    public Guid?   WorkflowInstanceId  { get; set; }
    public string  CurrentState        { get; set; } = "DRAFT";
    public decimal ApprovedAmount      { get; set; }
    public string? RoomClassApproved   { get; set; }
    public string? PreAuthNumber       { get; set; }
    public DateTime? PreAuthExpiry     { get; set; }
    public Guid?   LegacyPreauthId    { get; set; }   // FK bridge to insurance_pre_authorizations
    public Guid?   SessionPreauthId   { get; set; }   // FK bridge to insurance_preauth_requests
    public bool    EmergencyFcApplied  { get; set; }
    public string? NotesJson           { get; set; }

    // ── Counsellor draft fields (populated via PATCH from the counselling desk) ──
    public string?   CounsellorDraftJson { get; set; }  // full draft payload serialised as JSON
    public bool      IsDraft             { get; set; }
    public DateTime? DraftSavedAt        { get; set; }

    // ── Denormalized display fields (kept in sync via search trigger / migration 129) ──
    public string?   InsurerName               { get; set; }  // denormalized payer display name

    // ── Migration 124: process_status + service tax ───────────────────────
    public string?   ProcessStatus             { get; set; }  // fine-grained sub-status
    public DateTime? ProcessStatusUpdatedAt    { get; set; }
    public bool      ServiceTaxApplicable      { get; set; }
    public decimal   ServiceTaxPercent         { get; set; }
    public decimal   ServiceTaxAmount          { get; set; }
}

public class CcmsEligibilityCheck : StandardEntity
{
    public Guid     CoverageCase_Id             { get; set; }
    public string?  PolicyNumber                { get; set; }
    public string?  MembershipId               { get; set; }
    public string   CheckMethod                { get; set; } = "manual"; // manual|portal|api
    public string?  ResponseCode               { get; set; }
    public bool     IsEligible                 { get; set; }
    public string?  EligibilityResponseJson    { get; set; }
    public DateTime CheckedAt                  { get; set; } = DateTime.UtcNow;
}

public class CcmsPolicyCapture : StandardEntity
{
    public Guid      CoverageCase_Id        { get; set; }
    public string    PolicyNumber           { get; set; } = string.Empty;
    public string?   MemberName            { get; set; }
    public DateOnly? MemberDob             { get; set; }
    public DateOnly  PolicyStartDate        { get; set; }
    public DateOnly  PolicyEndDate          { get; set; }
    public decimal   SumInsured             { get; set; }
    public decimal   BalanceSumInsured      { get; set; }
    public decimal   CumulativeBonusAmount  { get; set; }
    public string?   RoomEntitlement        { get; set; }
    public string?   PolicyDocsJson         { get; set; }
    public DateTime  CapturedAt             { get; set; } = DateTime.UtcNow;
}

public class CcmsPolicyCoverageItem : StandardEntity
{
    public Guid    PolicyCaptureId    { get; set; }
    public string  ItemType           { get; set; } = string.Empty;
    public string? ItemCode           { get; set; }
    public string  ItemDescription    { get; set; } = string.Empty;
    public decimal LimitAmount        { get; set; }
    public decimal UsedAmount         { get; set; }
    public decimal AvailableAmount    { get; set; }
    public bool    IsExcluded         { get; set; }
}

// ── Phase 4: Pre-Authorization ────────────────────────────────────────────────

public class CcmsCoverageAuthorization : StandardEntity
{
    public Guid     CoverageCase_Id        { get; set; }
    public string   AuthorizationType      { get; set; } = "preauth"; // preauth|enhancement|resubmission
    public string?  PreAuthNumber          { get; set; }
    public decimal  RequestedAmount        { get; set; }
    public decimal  ApprovedAmount         { get; set; }
    public string?  RoomClassRequested     { get; set; }
    public string?  RoomClassApproved      { get; set; }
    public string?  DiagnosisJson          { get; set; }
    public string?  ProceduresJson         { get; set; }
    public DateTime? ValidFrom             { get; set; }
    public DateTime? ValidTo               { get; set; }
    public DateTime? SubmittedAt           { get; set; }
    public DateTime? ReceivedAt            { get; set; }
    public string?  TpaReferenceNumber     { get; set; }
    public Guid?    LegacyPreauthId        { get; set; }
    public Guid?    SessionPreauthId       { get; set; }
    public string?  RejectionReason        { get; set; }

    // ── Migration 124: clinical details ───────────────────────────────────
    public string?  ClinicalSummary           { get; set; }
    public string?  TreatingDoctorName        { get; set; }
    public string?  TreatingDoctorReg         { get; set; }
    public DateOnly? AdmissionDate            { get; set; }
    public DateOnly? ExpectedDischargeDate    { get; set; }
    public DateOnly? ActualDischargeDate      { get; set; }
    public int?     LengthOfStayDays          { get; set; }
    public string?  RoomTypeRequested         { get; set; }  // general|semi-private|private|icu
    public string?  TpaQueryJson              { get; set; }  // denormalized Q&A thread
    public string   ProcessStatus             { get; set; } = "pending";
    public DateTime? ProcessStatusUpdatedAt   { get; set; }

    // ── Migration 124: financial breakdown ────────────────────────────────
    public decimal  EstimatedTotalCost        { get; set; }
    public decimal  CopayAmount               { get; set; }
    public decimal  DeductibleAmount          { get; set; }
    public decimal  ServiceTaxAmount          { get; set; }
    public decimal  NetPayableByInsurer        { get; set; }
    public decimal  NetPayableByPatient        { get; set; }
}

public class CcmsAuthorizationDocument : StandardEntity
{
    public Guid     AuthorizationId { get; set; }
    public string   DocumentType    { get; set; } = string.Empty;
    public string   DocumentName    { get; set; } = string.Empty;
    public string?  BlobUrl         { get; set; }
    public DateTime UploadedAt      { get; set; } = DateTime.UtcNow;
}

// ── Phase 5: Approval Events (append-only) ────────────────────────────────────

public class CcmsApprovalEvent
{
    public Guid     Id                      { get; set; }
    public Guid     TenantId                { get; set; }
    public Guid     CoverageCase_Id         { get; set; }
    public Guid?    AuthorizationId         { get; set; }
    public string   EventType               { get; set; } = string.Empty;
    public string   EventSource             { get; set; } = "manual"; // manual|tpa_portal|api
    public string   ApprovalStatus          { get; set; } = string.Empty; // APPROVED|PARTIAL|REJECTED|CLARIFICATION
    public decimal  ApprovedAmount          { get; set; }
    public string?  PartialApprovalReason   { get; set; }
    public string?  RejectionReason         { get; set; }
    public string?  ResponsePayloadJson     { get; set; }
    public string?  TpaReferenceNumber      { get; set; }
    public Guid?    RecordedByUserId        { get; set; }
    public DateTime RecordedAt              { get; set; } = DateTime.UtcNow;
    public string?  PreviousState           { get; set; }
    public Guid?    CorrelationId           { get; set; }
    // Standard (but no updated_at — append only)
    public DateTime CreatedAt               { get; set; } = DateTime.UtcNow;
    public Guid?    CreatedByUserId         { get; set; }
    public string   Status                  { get; set; } = "active";
}

public class CcmsClarificationItem : StandardEntity
{
    public Guid     AuthorizationId          { get; set; }
    public string   ClarificationQuery       { get; set; } = string.Empty;
    public string?  ClarificationResponse    { get; set; }
    public DateTime RequestedAt              { get; set; } = DateTime.UtcNow;
    public DateTime? RespondedAt             { get; set; }
}

// ── Phase 6: Enhancements ─────────────────────────────────────────────────────

public class CcmsEnhancementRequest : StandardEntity
{
    public Guid     CoverageCase_Id   { get; set; }
    public string   EnhancementType   { get; set; } = "amount"; // amount|procedure|room_class
    public decimal  RequestedAmount   { get; set; }
    public decimal  ApprovedAmount    { get; set; }
    public string?  Reason            { get; set; }
    public string?  ReasonJson        { get; set; }
    public DateTime? SubmittedAt      { get; set; }
    public DateTime? DecidedAt        { get; set; }
    public Guid?    DecisionBy        { get; set; }
}

public class CcmsEnhancementEvent : StandardEntity
{
    public Guid     EnhancementRequestId { get; set; }
    public string   EventType            { get; set; } = string.Empty;
    public string?  EventPayloadJson     { get; set; }
    public Guid?    ActorUserId          { get; set; }
    public DateTime EventAt              { get; set; } = DateTime.UtcNow;
}

// ── Phase 7: Billing Integration ──────────────────────────────────────────────

public class CcmsBillingSummary : StandardEntity
{
    public Guid     CoverageCase_Id        { get; set; }
    public Guid?    BillId                 { get; set; }    // FK to opd_bill or ip_bill
    public DateTime BillDate               { get; set; }
    public decimal  TotalBillAmount        { get; set; }
    public decimal  InsuranceShareAmount   { get; set; }
    public decimal  PatientShareAmount     { get; set; }
    public decimal  CopayAmount            { get; set; }
    public decimal  DeductibleAmount       { get; set; }
    public decimal  DisallowedAmount       { get; set; }
    public string?  BillItemsJson          { get; set; }
}

public class CcmsCoverageAllocation : StandardEntity
{
    public Guid     BillingSummaryId    { get; set; }
    public string   LineItemType        { get; set; } = string.Empty;
    public string?  LineItemCode        { get; set; }
    public string   LineItemDescription { get; set; } = string.Empty;
    public decimal  BilledAmount        { get; set; }
    public decimal  CoveredAmount       { get; set; }
    public decimal  DisallowedAmount    { get; set; }
    public string?  DisallowedReason    { get; set; }
    public decimal  PatientPayable      { get; set; }
}

// ── Phase 8: Claims ───────────────────────────────────────────────────────────

public class CcmsClaimPacket : StandardEntity
{
    public Guid     CoverageCase_Id        { get; set; }
    public string   ClaimNumber            { get; set; } = string.Empty;
    public decimal  ClaimedAmount          { get; set; }
    public string   ClaimType              { get; set; } = "cashless"; // cashless|reimbursement
    public string   SubmissionMode         { get; set; } = "manual"; // manual|portal|api
    public DateTime? SubmittedAt           { get; set; }
    public DateTime? AcknowledgedAt        { get; set; }
    public string?  TpaClaimNumber         { get; set; }
    public DateTime? ExpectedSettlementDate{ get; set; }
    public string?  ClaimPacketJson        { get; set; }
    /// <summary>Claim-desk query overlay (not a duplicate of pre-auth clarification FSM).</summary>
    public string   QueryStatus            { get; set; } = "none";
}

public class CcmsClaimDocument : StandardEntity
{
    public Guid     ClaimPacketId  { get; set; }
    public string   DocumentType   { get; set; } = string.Empty;
    public string   DocumentName   { get; set; } = string.Empty;
    public string?  BlobUrl        { get; set; }
    public DateTime UploadedAt     { get; set; } = DateTime.UtcNow;
}

// ── Phase 9: Settlements ──────────────────────────────────────────────────────

public class CcmsSettlement : StandardEntity
{
    public Guid     CoverageCase_Id        { get; set; }
    public Guid?    ClaimPacketId          { get; set; }
    public string   SettlementNumber       { get; set; } = string.Empty;
    public string   SettlementType         { get; set; } = "full"; // full|partial
    public decimal  SettledAmount          { get; set; }
    public decimal  ClaimAmount            { get; set; }
    public decimal  OutstandingAmount      { get; set; }
    public string?  PaymentMode            { get; set; }
    public string?  PaymentReference       { get; set; }
    public DateOnly? PaymentDate           { get; set; }
    public string?  BankReference          { get; set; }
    public DateTime? SettledAt             { get; set; }
    public string   ReconciliationStatus   { get; set; } = "pending";
    public string?  ReconciliationNotes    { get; set; }
    public DateTime? ReconciliationAt      { get; set; }
}

public class CcmsSettlementLineItem : StandardEntity
{
    public Guid    SettlementId     { get; set; }
    public string  LineItemType     { get; set; } = string.Empty;
    public string? Description      { get; set; }
    public decimal ClaimedAmount    { get; set; }
    public decimal SettledAmount    { get; set; }
    public decimal DisallowedAmount { get; set; }
    public string? DisallowedReason { get; set; }
}

/// <summary>CCMS-060. Net patient collections vs obligation. Not a TPA settlement row.</summary>
public class CcmsCollectionProjection : StandardEntity
{
    public Guid     CoverageCaseId           { get; set; }
    public Guid?    BillId                   { get; set; }
    public decimal  NetCollected             { get; set; }
    public decimal  PatientObligationAmount  { get; set; }
    public DateTime? LastOccurredAt          { get; set; }
}

/// <summary>CCMS-060. Append-only billing ledger events applied to the projection.</summary>
public class CcmsCollectionEvent : StandardEntity
{
    public Guid     CoverageCaseId  { get; set; }
    public string   EventType       { get; set; } = string.Empty;
    public Guid?    SourceRefId     { get; set; }
    public Guid?    BillId          { get; set; }
    public decimal  Amount          { get; set; }
    public string?  IdempotencyKey  { get; set; }
    public DateTime OccurredAt      { get; set; } = DateTime.UtcNow;
}

// ── Phase 10: Documents ───────────────────────────────────────────────────────

public class CcmsDocument : StandardEntity
{
    public Guid     CoverageCase_Id      { get; set; }
    public string   DocumentCategory     { get; set; } = string.Empty; // preauth|claim|settlement
    public string   DocumentType         { get; set; } = string.Empty;
    public string   DocumentName         { get; set; } = string.Empty;
    public string?  BlobUrl              { get; set; }
    public long     FileSizeBytes        { get; set; }
    public string?  MimeType             { get; set; }
    public DateTime UploadedAt           { get; set; } = DateTime.UtcNow;
    public Guid?    UploadedByUserId     { get; set; }
    public DateTime? VerifiedAt          { get; set; }
    public Guid?    VerifiedByUserId     { get; set; }
}

// ── Phase 11: Communications ──────────────────────────────────────────────────

public class CcmsCommunicationLog : StandardEntity
{
    public Guid     CoverageCase_Id   { get; set; }
    public string   CommunicationType { get; set; } = string.Empty; // email|sms|letter|portal
    public string   Direction         { get; set; } = "outbound"; // inbound|outbound
    public string   RecipientType     { get; set; } = "tpa"; // tpa|patient|insurance|internal
    public string?  RecipientAddress  { get; set; }
    public string?  Subject           { get; set; }
    public string?  BodySummary       { get; set; }
    public DateTime SentAt            { get; set; } = DateTime.UtcNow;
    public string   DeliveryStatus    { get; set; } = "sent";
    public string?  ExternalMessageId { get; set; }
    /// <summary>Inbound parse draft, reply threading, etc. (jsonb)</summary>
    public string?  MetadataJson      { get; set; }
}

public class CcmsCommunicationTemplate : StandardEntity
{
    public string  TemplateName       { get; set; } = string.Empty;
    public string  TemplateCode       { get; set; } = string.Empty;
    public string  CommunicationType  { get; set; } = "email";
    public string? TriggerEvent       { get; set; }
    public string? SubjectTemplate    { get; set; }
    public string  BodyTemplate       { get; set; } = string.Empty;
    public bool    IsActive           { get; set; } = true;
}

// ── Phase 13: Government Scheme Applications ──────────────────────────────────

public class CcmsGovtSchemeApplication : StandardEntity
{
    public Guid     CoverageCase_Id         { get; set; }
    public Guid     GovernmentSchemeId      { get; set; }
    public string?  SchemeCardNumber        { get; set; }
    public string?  BeneficiaryId           { get; set; }
    public decimal  ClaimedAmount           { get; set; }
    public decimal  ApprovedAmount          { get; set; }
    public string   ApplicationState        { get; set; } = "DRAFT";
    public string?  SchemeReferenceNumber   { get; set; }
    public DateTime? SubmittedAt            { get; set; }
    public DateTime? DecidedAt              { get; set; }
}

public class CcmsGovtSchemeDocument : StandardEntity
{
    public Guid     GovtSchemeApplicationId { get; set; }
    public string   DocumentType            { get; set; } = string.Empty;
    public string   DocumentName            { get; set; } = string.Empty;
    public string?  BlobUrl                 { get; set; }
    public DateTime UploadedAt              { get; set; } = DateTime.UtcNow;
}

// ── Migration 122: Visit Insurance Policies (multi-policy per session / case) ─

public class CcmsVisitInsurancePolicy : StandardEntity
{
    // Owning entity (session or case — at least one must be set)
    public Guid?   SessionId            { get; set; }
    public Guid?   CoverageCase_Id      { get; set; }

    // Policy identifiers
    public string  PolicyNumber         { get; set; } = string.Empty;
    public string? CardNumber           { get; set; }
    public string? MembershipNumber     { get; set; }

    // Payer references
    public Guid?   InsuranceProviderId  { get; set; }
    public Guid?   TpaProviderId        { get; set; }

    // Insured person
    public string? InsuredName          { get; set; }
    public string? RelationshipToInsured { get; set; }  // self|spouse|child|parent|other

    // Employment block
    public string? Occupation           { get; set; }
    public string? Designation          { get; set; }
    public string? CompanyName          { get; set; }
    public string? EmployeeId           { get; set; }
    public string? VideNumber           { get; set; }
    public string? ContactNumber        { get; set; }

    // Doctor block
    public string? DoctorName           { get; set; }
    public string? DoctorRegNumber      { get; set; }
    public string? DoctorQualification  { get; set; }
    public string? DoctorContact        { get; set; }

    // Accommodation
    public string? AccommodationClass   { get; set; }   // general|semi-private|private|icu
    public string? DetailsText          { get; set; }

    // TPA coordination
    public string? TpaCoordinatorName   { get; set; }

    // Multi-policy ordering
    public bool    IsPrimary            { get; set; }
    public int     SortOrder            { get; set; }

    // Underwriting snapshot (JSON: { conditions, alcoholUse, hivRisk, otherAilments })
    public string? UnderwritingSnapshotJson { get; set; }

    // Service tax override (null = inherit from payer default)
    public bool?   ServiceTaxApplicable { get; set; }
}
