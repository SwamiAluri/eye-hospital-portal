// Types for Counsellors Desk & IP Management modules

import type {
  CounsellingDiscountType,
  CounsellingEstimateMode,
} from './counselling-estimate';

/** Re-export estimate types for API/session consumers (B5). */
export type {
  CounsellingEstimate,
  CounsellingEstimateMode,
  CounsellingEstimateState,
  CounsellingPackageAddonsBlob,
  CounsellingPackageTemplate,
  CounsellingSettings,
  EstimateLine,
  EstimateMode,
  PackageTemplate,
} from './counselling-estimate';

export type WaitingListStatus =
  | 'Pending'
  | 'Processed'
  | 'Done'
  | 'AddOnSurgery'
  | 'RepeatCounselling'
  | 'SurgeryDone';

export type FinalizeStatus =
  | 'Cancelled'
  | 'NotConfirmed'
  | 'Confirmed'
  | 'Finalised'
  | 'OTPrepared'
  | 'SurgeryDone';

export type WardStatus =
  | 'Expected'
  | 'Admitted'
  | 'ReadyForSurgery'
  | 'SurgeryDone'
  | 'Discharged';

export type DecisionType = 'DateForSurgery' | 'Interested' | 'NotInterested' | 'NeedsTime';

/** Single unified payment/patient classification — replaces separate patientType + paymentMode fields. */
export type CombinedPaymentType =
  | 'Cash' | 'Card' | 'UPI'
  | 'Insurance' | 'CoPay'
  | 'CGHS' | 'ESH' | 'Arograshree' | 'SGHS' | 'Railway'
  | 'Camp' | 'Free' | 'Staff' | 'ForeignNational' | 'Package';

export interface WaitingListPatient {
  id: string;
  slNo: number;
  uhid: string;
  patientName: string;
  eye: string;
  type: 'Procedure' | 'Surgery';
  surgeryName: string;
  patientType: string;
  age: number;
  gender: string;
  doctor: string;
  time: string;
  remarks: string;
  status: WaitingListStatus;
  followUpDate?: string;
  followUpReason?: string;
  /** Previous package name before the upgrade (AddOnSurgery rows only). */
  previousPackage?: string;
  /** New package name after the upgrade (AddOnSurgery rows only). */
  newPackage?: string;
  /** Price difference = new − previous (AddOnSurgery rows only). */
  upgradeDiff?: number;
  /** Patient demographics — returned from backend for quick display. */
  contactNumber?: string;
  bloodGroup?: string;
  dob?: string;
  emergencyContactName?: string;
  emergencyContactPhone?: string;
  emergencyContactRelationship?: string;
  address?: string;
}

export interface SurgeryOption {
  id: string;
  surgeryName: string;
  eye: string;
  cost: number;
  category?: string;
  isRecommended?: boolean;
  variantId?: string;
  hasIolOptions?: boolean;
  priceType?: 'PER_EYE' | 'BOTH_EYES' | 'FIXED';
}

export interface MasterCatalogItem {
  id: string;
  name: string;
  code?: string;
  category?: string;
  testType: 'Lab' | 'Imaging' | 'Scan';
  price: number;
}

export interface InvestigationItem {
  id?: string;
  catalogId?: string;
  testName: string;
  testCode?: string;
  testType: 'Lab' | 'Imaging' | 'Scan';
  price: number;
  urgency: string;
  status?: string;
  source: 'counsellor' | 'doctor';
  eye?: 'RE' | 'LE' | 'BE';
}

export interface ScheduleData {
  selectedDate: string;
  operationTheatre: string;
  doctor: string;
  surgeryStartTime: string;
  avoidTimeFrom: string;
  avoidTimeTo: string;
}

export interface CounsellingSession {
  id: string;
  patientId: string;
  patientName: string;
  age: number;
  gender: string;
  uhid: string;
  visitDate: string;
  surgeries: SurgeryOption[];
  selectedSurgeryId: string | null;
  /** Restored eye axis from DB (surgeryTentativeEye or blob). Used to pre-set the eye toggle when selectedSurgeryId is null. */
  iolPower?: string;
  restoredEye?: string;
  /** Internal-only sub-type selected for the procedure (e.g. 'Supraphob', 'Premium'). Staff use only. */
  variantSubOption?: string | null;
  /** Unified payment + patient classification (replaces patientType + paymentMode). */
  paymentType?: CombinedPaymentType | '';
  /** Insurance/TPA company — only relevant when paymentType is Insurance, CoPay, or CGHS. */
  insuranceCompany?: string;
  /** @deprecated kept for backward compat, derive from paymentType */
  patientType: string;
  /** @deprecated kept for backward compat, derive from paymentType */
  paymentMode: string;
  /** @deprecated replaced by insuranceCompany */
  company: string;
  freeSurgeryReason: string;
  packageName: string;
  packageRate: number | '';
  decision: DecisionType | '';
  schedule: ScheduleData | null;
  counsellorNotes: string;
  patientRemarks: string;
  doctorNotes: string;
  wantToSeeDoctor: boolean;
  interestedToUpgrade: boolean;
  notRequiredPreAuth: boolean;
  /** Synced from CCMS via auth internal callback (PackageAddonsJson) */
  ccmsCoverageCaseId?: string;
  ccmsCaseNumber?: string;
  ccmsCurrentState?: string;
  isFollowUpRequired: boolean;
  status: WaitingListStatus;
  /** Master code from counsellor.session_type (e.g. INITIAL, FOLLOW_UP). */
  sessionTypeCode?: string;
  sessionStatus?: string;
  followUpReason?: string;
  followUpDate?: string;
  originalPackageName?: string;
  lockedBy?: string | null;
  lastUpdatedAt?: string;
  investigations?: InvestigationItem[];
  suggestedPreOpTests?: MasterCatalogItem[];
  /** Field-level diff sent on save for audit trail — not persisted to CounsellingSession itself. */
  fieldChanges?: Array<{ fieldName: string; oldValue: string; newValue: string }>;
  /** AddOnSurgery: package name before the upgrade (from packageAddonsJson blob). */
  previousPackageName?: string;
  /** AddOnSurgery: numeric package amount before the upgrade. */
  previousPackageAmount?: number;

  /** Estimate engine (Phase 1+) — restored from package_addons_json blob. */
  estimateMode?: CounsellingEstimateMode;
  packageTemplateId?: string | null;
  discountType?: CounsellingDiscountType | null;
  discountValue?: number;
  discountReason?: string;
  discountAmount?: number;
  itemizedSubtotal?: number;
  bundleSavings?: number;
  finalPayableAmount?: number;
}

export interface FinalizeSurgeryRecord {
  id: string;
  uhid: string;
  patientName: string;
  surgeryName: string;
  eyes: string;
  patientType: string;
  paymentMode: string;
  surgeon: string;
  startTime: string;
  endTime?: string;
  scheduleDate?: string;
  theaterName: string;
  status: FinalizeStatus;
  version: number;
  isLocked: boolean;
  sequenceNo?: number;
  preparedAt?: string;
  counsellingSessionId?: string;
  // Extended detail fields
  reportingTime?: string;
  anesthesiaType?: string;
  anesthetistName?: string;
  iolPower?: string;
  remarks?: string;
  cancelReason?: string;
  packageName?: string;
  packageRate?: number;
  // Computed permissions from backend
  canEdit?: boolean;
  canConfirm?: boolean;
  canFinalise?: boolean;
  canCancel?: boolean;
  canReopen?: boolean;
  // Gap-analysis & new display fields
  investigationsStatus?: ChecklistStatus;
  checklistSummary?: 'AllClear' | 'Pending' | 'Missing';
  counsellingDate?: string;
}

export type ChecklistStatus = 'Done' | 'Pending' | 'NotRequired';

export interface OtChecklist {
  investigationsStatus: ChecklistStatus;
  paymentStatus: ChecklistStatus;
  consentStatus: ChecklistStatus;
  preAuthStatus: ChecklistStatus;
}

export interface OtScheduleDetail extends FinalizeSurgeryRecord {
  age?: number;
  gender?: string;
  visitDate?: string;
  diagnosis?: string;
  checklistItems?: OtChecklist;
  doctorId?: string;
  theatreId?: string;
  biometryMissingForEye?: boolean;
  // Patient demographics
  contactNumber?: string;
  bloodGroup?: string;
  dob?: string;
  emergencyContactName?: string;
  emergencyContactPhone?: string;
  emergencyContactRelationship?: string;
  address?: string;
}

export interface UpdateOtDetailsPayload {
  doctorId?: string;
  doctorName?: string;
  theatreId?: string;
  theatreName?: string;
  startTime?: string;
  endTime?: string;
  reportingTime?: string;
  anesthesiaType?: string;
  anesthetistName?: string;
  iolPower?: string;
  remarks?: string;
  cancelReason?: string;
  packageName?: string;
  packageRate?: number;
}

export interface PrepareOtListItem {
  scheduleId: string;
  sequence: number;
  /** Optional new start time (HH:mm) — sent when the user fixes a time-slot conflict in the modal */
  newStartTime?: string;
}

export interface PrepareOtListPayload {
  date: string;
  items: PrepareOtListItem[];
  preparedBy?: string;
}

// FinalizeFormData kept for backwards compatibility — use UpdateOtDetailsPayload for new code
export interface FinalizeFormData {
  surgeryName: string;
  anesthesiaType: string;
  anesthetist: string;
  iolPower: string;
  reportingTime: string;
  remarks: string;
  status: 'Finalised' | 'Confirmed' | 'NotConfirmed' | '';
}

export interface UpdateSlotPayload {
  doctorId?: string;
  doctorName?: string;
  theatreId?: string;
  theatreName?: string;
  startTime?: string;
  endTime?: string;
}

export interface OTListRecord {
  id: string;
  slNo: number;
  uhid: string;
  patientName: string;
  scheduledStartTime: string;
  scheduledEndTime: string;
  status: string;
  surgeryName: string;
  eyes: string;
  surgeon: string;
  theaterName: string;
  packageName: string;
  anesthetistName: string;
  cancelled: boolean;
  surgeryDone: boolean;
  sequenceNo?: number;
}

export interface WardPatient {
  id: string;
  slNo: number;
  mrNo: string;
  patientName: string;
  diagnosis: string;
  procedureName: string;
  surgeon: string;
  package: string;
  status: WardStatus;
  room: string;
  admissionTime: string;
  remarks: string;
}

export interface AddPatientFormData {
  /** MPI patient id — required after search select or registration. */
  patientId: string;
  /** Display MRN/UHID from MPI (not free-typed identity). */
  uhid: string;
  /** Display name from MPI (not free-typed identity). */
  patientName: string;
  eye: string;
  surgeryType: 'Procedure' | 'Surgery';
  surgeryName: string;
  /** Referring surgeon user id (required for CreateSession). */
  doctorId: string;
  remarks: string;
  /** Master code from counsellor.session_type */
  sessionTypeCode: string;
}

export interface WaitingListFilters {
  fromDate: string;
  toDate: string;
  patientName: string;
  mrd: string;
  type: 'All' | 'Procedure' | 'Surgery';
  status: string;
}

export interface SessionAuditEntry {
  id: string;
  changeType: string;
  /** Populated for FieldChanged entries — identifies which field changed. */
  fieldName?: string;
  oldValue: string | null;
  newValue: string | null;
  reason: string | null;
  changedAt: string;
  changedBy: string;
  /** FieldChanged child entries grouped under SaveCounselling */
  children?: SessionAuditEntry[];
  /** Enriched from /price-overrides endpoint — base price before override */
  priceBaseAmount?: number;
  /** Enriched from /price-overrides endpoint — new overridden price */
  priceOverriddenAmount?: number;
  /** Variant name for which price was overridden */
  priceVariantName?: string;
  /** Reason given for the price override */
  priceReason?: string;
  /** Name of person who requested the override */
  priceRequesterName?: string | null;
}

// ============================================================================
// FOLLOW-UP CENTER TYPES
// ============================================================================

export type FollowupAlertLevel = 'Normal' | 'Medium' | 'High' | 'Critical';

export type PatientIntention =
  | 'WillingWeek'
  | 'WillingMonth'
  | 'WillingQuarter'
  | 'WillingCallToConfirm'
  | 'Undecided'
  | 'WaitingFinancial'
  | 'WaitingFear'
  | 'Declined'
  | 'ReferredElsewhere';

export interface ActiveFollowupRecord {
  sessionId: string;
  patientId: string;
  patientName: string;
  uhid: string | null;
  phone: string | null;
  branchId: string | null;
  recommendedSurgery: string | null;
  patientIntention: PatientIntention | null;
  sessionDate: string;
  lastContactDate: string | null;
  contactAttemptCount: number;
  lastContactOutcome: string | null;
  escalationStatus: string;
  overdueSinceDate: string | null;
  alertLevel: FollowupAlertLevel;
}

export interface ColdLeadRecord {
  sessionId: string;
  patientId: string;
  patientName: string;
  uhid: string | null;
  phone: string | null;
  branchId: string | null;
  recommendedSurgery: string | null;
  patientIntention: 'Declined' | 'ReferredElsewhere' | null;
  sessionDate: string;
  lastContactDate: string | null;
  contactAttemptCount: number;
  lastContactOutcome: string | null;
  additionalNotes: string | null;
}

export interface PostSurgeryFollowupRecord {
  journeyId: string;
  patientId: string;
  patientName: string;
  uhid: string | null;
  phone: string | null;
  branchId: string | null;
  sessionId: string | null;
  surgeryType: string | null;
  dischargedAt: string | null;
  daysSinceDischarge: number | null;
  conditionAtDischarge: string | null;
  dischargeDate: string | null;
  pendingPostOpVisits: number | undefined;
}

export interface FollowupPagedResponse<T> {
  total: number;
  page: number;
  pageSize: number;
  items: T[];
}

export interface ReQueuePayload {
  newIntention?: PatientIntention;
  notes?: string;
  /** Master code from counsellor.session_type */
  sessionType?: string;
}

/** Master code from counsellor.reminder_type (or legacy API keys) */
export type ReminderMessageType = string;

export interface SendReminderPayload {
  channel: 'SMS' | 'WhatsApp' | 'Email';
  messageType: ReminderMessageType;
  message: string;
  journeyId?: string;
}

