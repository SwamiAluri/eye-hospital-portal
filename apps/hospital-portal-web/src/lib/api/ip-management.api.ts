/**
 * ip-management.api.ts
 *
 * HTTP client for the IpManagementService Azure Functions microservice.
 * Base URL defaults to http://localhost:5074/api (local.settings.json LocalHttpPort).
 * Override via NEXT_PUBLIC_IP_MANAGEMENT_API_URL.
 *
 * All methods are fire-and-forget safe — each catches its own errors and logs
 * a console.warn rather than throwing, so an offline IpManagementService never
 * breaks the existing workflow.
 */

import axios, { AxiosInstance } from 'axios';
import { attachAuthRequestInterceptor, attachAuthResponseInterceptor } from '../auth-interceptors';
import { requireOtJourneyMutationResult } from '@/lib/ip-management/ot-mutation-result';

const IP_MANAGEMENT_API_URL =
  (typeof process !== 'undefined' && process.env.NEXT_PUBLIC_IP_MANAGEMENT_API_URL) ||
  'http://localhost:5074/api';

let _client: AxiosInstance | null = null;

function getClient(): AxiosInstance {
  if (_client) return _client;
  _client = axios.create({ baseURL: IP_MANAGEMENT_API_URL });
  attachAuthRequestInterceptor(_client);
  attachAuthResponseInterceptor(_client);

  return _client;
}

export type ApiMutationResult<T> = { data: T | null; error?: string };

export function isConcurrencyConflict(e: unknown): boolean {
  if (axios.isAxiosError(e) && e.response?.status === 409) return true;
  return e instanceof Error && /updated by another user/i.test(e.message);
}

export function formatApiError(e: unknown, fallback: string): string {
  if (axios.isAxiosError(e)) {
    const status = e.response?.status;
    const body = e.response?.data;
    if (status === 401 || status === 403) {
      return 'You do not have permission for this action.';
    }
    if (status === 409) {
      if (typeof body === 'string' && body.trim()) return body;
      if (body && typeof body === 'object') {
        const record = body as Record<string, unknown>;
        const msg = record.message ?? record.error;
        if (typeof msg === 'string' && msg.trim()) return msg;
      }
      return 'This journey was updated by another user. Reload and try again.';
    }
    if (typeof body === 'string' && body.trim()) return body;
    if (body && typeof body === 'object') {
      const record = body as Record<string, unknown>;
      const msg = record.message ?? record.error;
      if (typeof msg === 'string' && msg.trim()) return msg;
    }
    // Empty 404/5xx bodies otherwise become axios's "Request failed with status code 404".
    return fallback;
  }
  return e instanceof Error ? e.message : fallback;
}

// ─── Ward Types ───────────────────────────────────────────────────────────────

export interface WardDto {
  id: string;
  wardName: string;
  wardType: string;
  floor: string | null;
  totalBeds: number;
  isActive: boolean;
}

export interface CreateWardRequest {
  name: string;
  capacity: number;
  wardType: string;
}

export interface UpdateWardRequest {
  name: string;
  capacity: number;
  wardType: string;
  isActive: boolean;
}

// ─── Journey Types ────────────────────────────────────────────────────────────

export interface PatientJourneyRowDto {
  id: string;
  patientId?: string;
  dischargeOverrideApplied?: boolean;
  uhid: string | null;
  patientName: string | null;
  eyeOperated: string | null;
  procedureName: string | null;
  packageAmount: number;
  totalPaid: number;
  balanceDue: number;
  wardName: string | null;
  bedNumber: string | null;
  clinicalState: string;
  otState: string;
  financialState: string;
  postOpState: string;
  admittedAt: string | null;
  surgeryScheduledAt: string | null;
  isLocked: boolean;
  isBillingLocked: boolean;
  admissionType: string | null;
  patientGender: string | null;
  patientDob: string | null;
  patientAge: number | null;
  paymentMode: string | null;
  isEmergencyFc: boolean;
  emergencyFcReason: string | null;
  otReturnReason: string | null;
  counselingSessionId: string | null;
  otDetailsSaved: boolean;
  updatedAt?: string;
  pendingRebook?: boolean;
  surgeryCancelledAt?: string | null;
  surgeryCancelReason?: string | null;
  cancelledFromState?: string | null;
  isPatientMerged?: boolean;
  canonicalPatientId?: string | null;
  canonicalUhid?: string | null;
  p2ClearanceCompleted?: number | null;
  p2ClearanceTotal?: number | null;
  p2ClearanceNeedsAttention?: boolean | null;
  // Readiness / dashboard summary (Phase 2)
  anaesthetistName?: string | null;
  operationTheatreName?: string | null;
  investigationsVerified?: number | null;
  investigationsTotal?: number | null;
  unverifiedCriticalCount?: number;
  pacCompleted?: boolean;
  readinessCompleted?: number;
  readinessTotal?: number;
  surgeonName?: string | null;
  // IP-013 current slot
  slotId?: string | null;
  slotLabel?: string | null;
  slotSession?: string | null;
  slotSequenceNo?: number | null;
  plannedArrivalAt?: string | null;
  slotTheatreId?: string | null;
}

export interface JourneySlotRowDto {
  id: string;
  journeyId: string;
  theatreId: string;
  theatreName: string | null;
  slotDate: string;
  session: string;
  sequenceNo: number;
  plannedArrivalAt: string;
  slotLabel: string;
  releasedAt: string | null;
  releasedReason?: string | null;
  patientName: string | null;
  uhid: string | null;
  procedureName: string | null;
  eyeOperated: string | null;
  clinicalState: string | null;
  pacCompleted: boolean;
  otState?: string | null;
  isEmergencyFc?: boolean;
}

export interface UnassignedSlotCandidateDto {
  journeyId: string;
  patientName: string | null;
  uhid: string | null;
  procedureName: string | null;
  eyeOperated: string | null;
  clinicalState: string;
}

export interface SlotBoardDto {
  date: string;
  theatreId: string | null;
  morning: JourneySlotRowDto[];
  afternoon: JourneySlotRowDto[];
  evening: JourneySlotRowDto[];
  unassigned: UnassignedSlotCandidateDto[];
}

export interface SlotMetricsDto {
  assignedCount: number;
  readyCount: number;
  avgArrivalToDischargeMinutes: number | null;
  avgTurnoverMinutes: number | null;
}

export interface SlotThroughputBreakdownDto {
  key: string;
  label: string;
  assignedCount: number;
  completedCount: number;
  dischargedCount: number;
  avgArrivalToDischargeMinutes: number | null;
}

export interface SlotThroughputDto {
  from: string;
  to: string;
  assignedCount: number;
  activeCount: number;
  cancelledCount: number;
  readyCount: number;
  completedCount: number;
  dischargedCount: number;
  avgArrivalToDischargeMinutes: number | null;
  medianArrivalToDischargeMinutes: number | null;
  avgTurnoverMinutes: number | null;
  bySession: SlotThroughputBreakdownDto[];
  byTheatre: SlotThroughputBreakdownDto[];
  byDay: SlotThroughputBreakdownDto[];
  /** Mark Ready despite vitals_out_of_range (not missing vitals). */
  vitalsOverrideCount?: number;
  /** Record-implant power/model mismatch overrides on slotted journeys. */
  iolMismatchOverrideCount?: number;
}

export interface AssignSlotRequest {
  journeyId: string;
  branchId: string;
  theatreId: string;
  slotDate: string;
  session: string;
  sequenceNo?: number | null;
  plannedArrivalAt?: string | null;
  theatreName?: string | null;
}

export interface ReorderSlotsRequest {
  branchId: string;
  theatreId: string;
  slotDate: string;
  session: string;
  journeyIds: string[];
  theatreName?: string | null;
}

export interface WardDashboardFacetsDto {
  otRooms: string[];
  anaesthetists: string[];
  payers: string[];
  surgeons: string[];
}

export interface WardDashboardSummaryDto {
  stageCounts: Record<string, number>;
  otLoadToday: number;
  pacPending: number;
  criticalLabs: number;
  financialPending: number;
  delayed: number;
  cancelledToday: number;
  rebookRequired: number;
  emergencyCount: number;
  facets: WardDashboardFacetsDto;
}

export interface CensusTabCountsDto {
  all: number;
  inHouse: number;
  readyForOt: number;
  sentToOt: number;
  inOt: number;
  postOp: number;
  readyForDischarge: number;
  discharged: number;
  cancelled: number;
}

export interface PatientJourneyDetailDto extends PatientJourneyRowDto {
  branchId: string;
  patientId: string;
  otFinalizeScheduleId: string | null;
  // OT / Staff
  anesthesiologistName: string | null;  // legacy alias
  anaesthetistName: string | null;
  operationTheatreName: string | null;
  assistantName: string | null;
  scrubNurseName: string | null;
  scrubNurseNames: string | null;
  otRoomNumber: string | null;          // legacy alias
  // IOL
  iolPower: string | null;
  iolIssuedFromIp: boolean | null;
  iolBarcodeVerified: boolean | null;
  iolBarcode: string | null;
  primarySurgeonId: string | null;
  // Clinical
  anaesthesiaType: string | null;
  admissionType: string | null;
  attendantName: string | null;
  attendantPhone: string | null;
  attendantRelationship: string | null;
  // Demographics (resolved from patients table)
  mrNo: string | null;
  patientAge: number | null;
  patientGender: string | null;
  diagnosis: string | null;
  surgeonName: string | null;
  // Ward / discharge
  dischargedAt: string | null;
  // Billing / Discharge
  surgeryStartedAt: string | null;
  surgeryEndedAt: string | null;
  isEmergencyFc: boolean;
  emergencyFcReason: string | null;
  totalBilled: number;
  dischargeOverrideReason: string | null;
  dischargeOverrideApplied?: boolean;
  whoSupervisorOverrideApplied?: boolean;
  checklistPhaseStatus?: Record<string, boolean> | null;
  investigationPhaseSummary?: {
    verifiedCount: number;
    totalApplicable: number;
    unverifiedCritical: string[];
  } | null;
  transitionWarnings?: ChecklistGateWarningDto[] | null;
  createdAt: string;
  updatedAt: string;
  dischargeType?: string | null;
  dischargeTypeReason?: string | null;
  priorJourneyId?: string | null;
}

export interface AdmitPatientRequest {
  wardId?: string;
  admissionType?: string;        // DayCare | IPD | Emergency
  bedNumber?: string;
  assignedBedId?: string;
  admittedAt?: string;
  attendantName?: string;
  attendantPhone?: string;
  attendantRelationship?: string;
  primarySurgeonId?: string;
  primaryNurseId?: string;
  overrideStateCheck?: boolean;
  bypassFinancialClearance?: boolean;
  overrideReason?: string;
  acknowledgeWarnings?: boolean;
  expectedUpdatedAt?: string;
}

export interface UpdateWardAssignmentRequest {
  wardId?: string;
  bedNumber?: string;
  assignedBedId?: string;
  admissionType?: string;
  attendantName?: string;
  attendantPhone?: string;
  attendantRelationship?: string;
}

export interface UpdateOtDetailsRequest {
  anaesthetistName?: string;
  operationTheatreName?: string;
  assistantName?: string;
  scrubNurseNames?: string;
  anaesthesiaType?: string;
  iolPower?: string;
  iolIssuedFromIp?: boolean;
  /** E4 compatibility. Server ignores writes. */
  iolBarcodeVerified?: boolean;
  /** E4 compatibility. Server ignores writes. */
  iolBarcode?: string;
  primarySurgeonId?: string;
}

export interface IolCatalogItemDto {
  id: string;
  modelName: string;
  brand: string;
  iolType: string;
  origin: string | null;
  lensCategory: string | null;
  powerRangeMin: number | null;
  powerRangeMax: number | null;
  powerIncrement: number | null;
  aConstant: number | null;
  defaultPrice: number;
  productCode: string | null;
}

export interface ChecklistGateWarningDto {
  code: string;
  message: string;
  severity: 'warn' | 'block';
  canOverride: boolean;
  category?: 'Clinical' | 'Financial' | 'Coverage' | 'Operational';
}

export interface ChecklistGateResultDto {
  transition: string;
  canProceed: boolean;
  requiresOverride: boolean;
  warnings: ChecklistGateWarningDto[];
}

export interface TransitionRequest {
  newState: string;
  reason?: string;
  acknowledgeWarnings?: boolean;
  expectedUpdatedAt?: string;
}

export interface EmergencyFcRequest {
  reason: string;
}

export interface DischargeOverrideRequest {
  reason: string;
}

// ─── Billing Types ────────────────────────────────────────────────────────────

export interface BillingTransactionDto {
  id: string;
  journeyId: string;
  transactionType: string;
  amount: number;
  referenceNumber: string | null;
  paymentMode: string | null;
  notes: string | null;
  createdAt: string;
  createdByUserId: string;
}

export interface AddBillingTransactionRequest {
  transactionType: string;
  amount: number;
  referenceNumber?: string;
  paymentMode?: string;
  notes?: string;
}

// ─── IntraOp Types ────────────────────────────────────────────────────────────

export interface IntraOpNoteDto {
  id: string;
  primarySurgeonId: string | null;
  anesthesiaType: string | null;
  anesthesiaNotes: string | null;
  procedurePerformed: string | null;
  eyeOperated: string | null;
  findings: string | null;
  complications: string | null;
  /** Registry overlay on GET; save ignores client writes (E4). */
  implantUsed: string | null;
  implantPower: string | null;
  bloodLossMl: number | null;
  ivFluidMl: number | null;
  specimenSent: boolean;
  specimenDetails: string | null;
  notesStatus: string;
  signedAt: string | null;
  signedByUserId: string | null;
  updatedAt: string;
}

export interface IntraOpPresetDto {
  id: string;
  fieldName: string;
  optionLabel: string;
  displayOrder: number;
}

export interface SaveIntraOpNoteRequest {
  procedurePerformed?: string;
  findings?: string;
  complications?: string;
  anesthesiaNotes?: string;
  implantUsed?: string;
  implantPower?: string;
  bloodLossMl?: number;
  ivFluidMl?: number;
  specimenSent?: boolean;
  specimenDetails?: string;
  eyeOperated?: string;
  anesthesiaType?: string;
}

// ─── Post-Op Types ────────────────────────────────────────────────────────────

export interface ChecklistItemDto {
  id: string;
  itemLabel: string;
  itemOrder: number;
  isRequired: boolean;
}

export interface ChecklistResponseDto {
  checklistItemId: string;
  itemLabel: string;
  isCompleted: boolean;
  completedAt: string | null;
  notes: string | null;
}

export interface ChecklistSaveRequest {
  responses: Array<{
    checklistItemId: string;
    isCompleted: boolean;
    notes?: string;
  }>;
}

export interface PostOpInstructionDto {
  id: string;
  medications: string | null;
  activityRestrictions: string | null;
  dietaryInstructions: string | null;
  followupDate: string | null;
  followupDoctorId: string | null;
  followupAppointmentId?: string | null;
  eyeCareInstructions: string | null;
  warningSigns: string | null;
  isSaved: boolean;
  savedAt: string | null;
}

export interface SavePostOpInstructionRequest {
  medications?: string;
  activityRestrictions?: string;
  dietaryInstructions?: string;
  followupDate?: string;
  followupDoctorId?: string;
  followupAppointmentId?: string;
  eyeCareInstructions?: string;
  warningSigns?: string;
}

export interface PostOpTaperStepDto {
  id: string;
  drugName: string;
  eye: string;
  stepNo: number;
  frequencyLabel: string;
  days: number;
  instructions: string | null;
  createdAt: string;
  createdBy: string;
  createdByName: string | null;
  deletedAt: string | null;
}

export interface PostOpTaperDto {
  steps: PostOpTaperStepDto[];
  history: PostOpTaperStepDto[];
}

export interface SavePostOpTaperStepRequest {
  drugName: string;
  eye: string;
  frequencyLabel: string;
  days: number;
  stepNo?: number;
  instructions?: string;
}

export interface SavePostOpTaperRequest {
  steps: SavePostOpTaperStepRequest[];
}

export interface DischargeSummaryDto {
  id: string;
  conditionAtDischarge: string | null;
  diagnosisCodes: string | null;
  proceduresPerformed: string | null;
  hospitalCourse: string | null;
  dischargeInstructions: string | null;
  medicationsOnDischarge: string | null;
  followUpPlan: string | null;
  formatType: string;
  summaryStatus: string;
  finalBillAmount: number | null;
  finalizedAt: string | null;
}

export interface SaveDischargeSummaryRequest {
  conditionAtDischarge?: string;
  diagnosisCodes?: string;
  proceduresPerformed?: string;
  hospitalCourse?: string;
  dischargeInstructions?: string;
  medicationsOnDischarge?: string;
  followUpPlan?: string;
  formatType: string;
  finalBillAmount?: number;
}

export interface DischargeSummaryPreviewDto {
  uhid: string | null;
  procedureName: string | null;
  eyeOperated: string | null;
  clinicalState: string;
  surgeryScheduledAt: string | null;
  packageAmount: number;
  totalPaid: number;
  balanceDue: number;
  summary: DischargeSummaryDto | null;
}

export interface IolReturnDto {
  id: string;
  iolPower: string | null;
  iolBatch: string | null;
  iolBarcode: string | null;
  reason: string;
  returnedAt: string | null;
}

export interface RecordIolReturnRequest {
  iolPower?: string;
  iolBatch?: string;
  iolBarcode?: string;
  reason: string;
}

// ─── Surgery Note Template Types ──────────────────────────────────────────────

export interface SurgeryNoteTemplateDto {
  id: string;
  fieldLabel: string;
  fieldType: 'text' | 'textarea' | 'select' | 'checkbox' | 'number';
  fieldOrder: number;
  isRequired: boolean;
  options: string[] | null;
  isActive: boolean;
}

export interface AddSurgeryNoteTemplateRequest {
  fieldLabel: string;
  fieldType: 'text' | 'textarea' | 'select' | 'checkbox' | 'number';
  fieldOrder?: number;
  isRequired?: boolean;
  options?: string[];
}

// ─── IOL Barcode Verification Types ──────────────────────────────────────────

export interface VerifyIolBarcodeRequest {
  barcode: string;
}

export interface VerifyIolBarcodeResponse {
  isValid: boolean;
  catalogEntry?: string | null;
  message?: string | null;
  catalogId?: string | null;
  brand?: string | null;
  model?: string | null;
  productCode?: string | null;
  existingUsageId?: string | null;
  gtin?: string | null;
  serial?: string | null;
  lot?: string | null;
  expiry?: string | null;
  symbology?: string | null;
}

/** W-05 A5 inpatient wristband. One active token per journey. */
export interface JourneySafetyTokenDto {
  id: string;
  journeyId: string;
  tokenCode: string;
  barcodeValue: string;
  laterality?: string | null;
  printedAt?: string | null;
  printedBy?: string | null;
  createdAt: string;
  alreadyIssued?: boolean;
}

export type ImplantUsageStatus = 'Implanted' | 'Opened_Unused' | 'Wasted' | 'Returned' | 'Reversed';

export interface ImplantUsageDto {
  id: string;
  journeyId: string;
  patientId: string;
  eye: string;
  itemId?: string | null;
  catalogRef?: string | null;
  brand?: string | null;
  model?: string | null;
  power?: number | null;
  serialNumber?: string | null;
  batchNumber?: string | null;
  udiBarcode?: string | null;
  usageStatus: ImplantUsageStatus;
  surgeonUserId?: string | null;
  scannedAt: string;
  scannedByUserId?: string | null;
  chargeItemId?: string | null;
  chargeStatus: string;
  wastageReason?: string | null;
  warning?: string | null;
}

export interface RecordImplantRequest {
  itemId?: string;
  catalogRef?: string;
  serialNumber?: string;
  batchNumber?: string;
  udiBarcode?: string;
  power?: number;
  eye: string;
  usageStatus: Exclude<ImplantUsageStatus, 'Reversed'>;
  surgeonUserId?: string;
  wastageReason?: string;
  acknowledgeMismatch?: boolean;
  mismatchReason?: string;
}

export interface UpdateImplantRequest {
  usageStatus: 'Wasted' | 'Returned' | 'Reversed';
  reason: string;
}

// ─── Ward Stats / Bed Types ───────────────────────────────────────────────────

export interface WardStatsDto {
  wardId: string;
  wardName: string;
  wardType: string;
  totalBeds: number;
  occupiedBeds: number;
  availableBeds: number;
  byState: Record<string, number>;
}

export interface WardBedDto {
  bedId: string;
  description: string;
  roomNo: string;
  capacity: number;
  currentOccupancy: number;
  isAvailable: boolean;
  bedType?: string | null;
  bedStatus?: string | null;
  bedNumber?: string | null;
  occupantJourneyId?: string | null;
  occupantUhid?: string | null;
  occupantName?: string | null;
}

// ─── Vital Sign Types ─────────────────────────────────────────────────────────

export interface VitalSignDto {
  id: string;
  journeyId: string;
  recordedAt: string;
  temperature: number | null;
  bloodPressureSystolic: number | null;
  bloodPressureDiastolic: number | null;
  pulseRate: number | null;
  respiratoryRate: number | null;
  oxygenSaturation: number | null;
  weight: number | null;
  height: number | null;
  notes: string | null;
  recordedByUserId: string;
  createdAt: string;
}

export interface AddVitalSignRequest {
  recordedAt?: string;
  temperature?: number;
  bloodPressureSystolic?: number;
  bloodPressureDiastolic?: number;
  pulseRate?: number;
  respiratoryRate?: number;
  oxygenSaturation?: number;
  weight?: number;
  height?: number;
  notes?: string;
}

// ─── Nurse Record Types ───────────────────────────────────────────────────────

export interface NurseRecordDto {
  id: string;
  journeyId: string;
  recordedAt: string;
  shiftType: string | null;
  nursingNotes: string | null;
  medicationsGiven: string | null;
  intakeOutputNotes: string | null;
  painScore: number | null;
  alertnessLevel: string | null;
  recordedByUserId: string;
  createdAt: string;
}

export interface AddNurseRecordRequest {
  recordedAt?: string;
  shiftType?: string;
  nursingNotes?: string;
  medicationsGiven?: string;
  intakeOutputNotes?: string;
  painScore?: number;
  alertnessLevel?: string;
}

// ─── Update Request Types ─────────────────────────────────────────────────────

export interface UpdateVitalSignRequest {
  temperature?: number;
  bloodPressureSystolic?: number;
  bloodPressureDiastolic?: number;
  pulseRate?: number;
  respiratoryRate?: number;
  oxygenSaturation?: number;
  weight?: number;
  height?: number;
  notes?: string;
}

export interface UpdateNurseRecordRequest {
  shiftType?: string;
  nursingNotes?: string;
  medicationsGiven?: string;
  intakeOutputNotes?: string;
  painScore?: number;
  alertnessLevel?: string;
}

// ─── Master Data Types ────────────────────────────────────────────────────────

export interface OphthMedicationDto {
  id: string;
  genericName: string;
  drugClass: string | null;
  route: string | null;
}

export interface IpIoTypeDto {
  id: string;
  category: 'Intake' | 'Output';
  label: string;
  unit: string | null;
  displayOrder: number;
}

// ─── Counsellor Outpatient Safety Checklist (S0) ─────────────────────────────

export interface CounsellorOutpatientItemDto {
  itemId: string;
  itemKey: string;
  itemLabel: string;
  description: string | null;
  displayOrder: number;
  isCompleted: boolean;
  isBypassed: boolean;
  notes: string | null;
  completedAt: string | null;
  completedByRole?: string | null;
}

export interface CounsellorOutpatientChecklistDto {
  counselingSessionId: string;
  totalItems: number;
  completedItems: number;
  items: CounsellorOutpatientItemDto[];
}

export interface SaveCounsellorCompletionRequest {
  isCompleted: boolean;
  isBypassed?: boolean;
  bypassReason?: string;
  notes?: string;
}

export interface CounsellorPreOpInvestigationItemDto {
  itemId: string;
  itemKey: string;
  wardTargetKey: string;
  itemLabel: string;
  description: string | null;
  displayOrder: number;
  resultValue: string | null;
  resultUnit: string | null;
  entryStatus: string;
  notes: string | null;
  enteredAt: string | null;
  defaultUnit: string | null;
  valueType: string | null;
}

export interface CounsellorPreOpInvestigationChecklistDto {
  counselingSessionId: string;
  totalItems: number;
  draftItems: number;
  items: CounsellorPreOpInvestigationItemDto[];
}

export interface SaveCounsellorInvestigationResultRequest {
  resultValue: string;
  resultUnit?: string;
  notes?: string;
}

// ─── Ward Checklist (S1 — Form 2) ────────────────────────────────────────────

export interface WardChecklistItemDto {
  itemId: string;
  itemKey: string;
  itemLabel: string;
  description: string | null;
  displayOrder: number;
  isCompleted: boolean;
  isBypassed: boolean;
  notes: string | null;
  completedAt: string | null;
  source: string | null;
  completedByRole?: string | null;
  /** False when the catalog scopes this item out for the journey's surgery/patient type. */
  appliesToJourney?: boolean;
}

export interface WardChecklistDto {
  journeyId: string;
  totalItems: number;
  completedItems: number;
  financialState: string;
  balanceDue: number | null;
  emergencyFcApplied: boolean;
  wardCheckInAt: string | null;
  informedOtTeamAt: string | null;
  items: WardChecklistItemDto[];
}

export interface SaveWardChecklistCompletionRequest {
  isCompleted: boolean;
  isBypassed?: boolean;
  bypassReason?: string;
  notes?: string;
}

// ─── Medication Log (S2 — Form 4 pre-op) ─────────────────────────────────────

export interface MedicationDoseDto {
  id: string;
  doseNumber: number;
  administeredAt: string | null;
  administeredByUserId: string | null;
  notes: string | null;
}

export interface MedicationDrugDto {
  medicineName: string;
  medicationId: string | null;
  displayOrder: number;
  doses: MedicationDoseDto[];
}

export interface MedicationLogDto {
  journeyId: string;
  anaesthesiaType: string | null;
  xylocaineSensitivityResult: string | null;
  surgeryNotes: string | null;
  sentToOtAt: string | null;
  receivedFromOtAt: string | null;
  wardCheckoutAt: string | null;
  drugs: MedicationDrugDto[];
}

export interface AddMedicationDrugRequest {
  medicineName: string;
  medicationId?: string;
  doseCount?: number;
}

export interface SaveMedicationDoseRequest {
  administeredAt?: string;
  notes?: string;
  clearAdministration?: boolean;
}

export interface UpdateMedicationLogMetaRequest {
  anaesthesiaType?: string;
  xylocaineSensitivityResult?: string;
  surgeryNotes?: string;
}

// ─── Ward Post-Op Checklist (S2 — Form 4 post-op) ────────────────────────────

export interface IolStickerChecksDto {
  barcodeScan: boolean;
  stickerInFile: boolean;
  inventoryMatch: boolean;
}

export interface WardInvestigationItemDto {
  itemId: string;
  itemKey: string;
  itemLabel: string;
  description: string | null;
  displayOrder: number;
  isCompleted: boolean;
  isBypassed: boolean;
  notes: string | null;
  completedAt: string | null;
  source: string | null;
  appliesToJourney: boolean;
  resultValue: string | null;
  resultUnit: string | null;
  referenceRange: string | null;
  resultFlag: string | null;
  resultSource: string | null;
  entryStatus: string;
  enteredByUserId: string | null;
  enteredAt: string | null;
  verifiedByUserId: string | null;
  verifiedAt: string | null;
  documentId: string | null;
  documentFileName: string | null;
  documentPreviewUrl: string | null;
  externalReportNote: string | null;
  isCritical: boolean;
  counsellorDraft: boolean;
  defaultUnit: string | null;
  valueType: string | null;
  enteredByName: string | null;
  verifiedByName: string | null;
}

export interface WardInvestigationChecklistDto {
  journeyId: string;
  totalItems: number;
  completedItems: number;
  anaesthesiaType: string | null;
  items: WardInvestigationItemDto[];
  unverifiedCriticalKeys: string[];
}

/** Normalizes ward investigation checklist payloads (camelCase or PascalCase). */
function normalizeWardInvestigationChecklist(
  raw: WardInvestigationChecklistDto | null | undefined,
): WardInvestigationChecklistDto | null {
  if (!raw) return null;
  const legacy = raw as WardInvestigationChecklistDto & {
    JourneyId?: string;
    TotalItems?: number;
    CompletedItems?: number;
    AnaesthesiaType?: string | null;
    Items?: WardInvestigationItemDto[];
    UnverifiedCriticalKeys?: string[];
  };
  const keys =
    legacy.unverifiedCriticalKeys
    ?? legacy.UnverifiedCriticalKeys
    ?? [];
  return {
    journeyId: String(legacy.journeyId ?? legacy.JourneyId ?? ''),
    totalItems: legacy.totalItems ?? legacy.TotalItems ?? 0,
    completedItems: legacy.completedItems ?? legacy.CompletedItems ?? 0,
    anaesthesiaType: legacy.anaesthesiaType ?? legacy.AnaesthesiaType ?? null,
    items: legacy.items ?? legacy.Items ?? [],
    unverifiedCriticalKeys: Array.isArray(keys) ? keys : [],
  };
}

export interface SaveWardInvestigationResultRequest {
  resultValue: string;
  resultUnit?: string | null;
  referenceRange?: string | null;
  resultFlag?: string | null;
  resultSource?: string | null;
  externalReportNote?: string | null;
  notes?: string | null;
}

export interface VerifyWardInvestigationRequest {
  notes?: string | null;
}

export interface UploadInvestigationDocumentRequest {
  documentType: string;
  fileName: string;
  contentType: string;
  fileData: string;
}

export interface InvestigationDocumentDto {
  documentId: string;
  fileName: string;
  fileUrl: string;
  contentType: string | null;
  fileSizeBytes: number | null;
  isVerified: boolean;
}

export interface WardInvestigationSummaryDto {
  journeyId: string;
  items: Array<{
    itemKey: string;
    itemLabel: string;
    resultValue: string | null;
    resultUnit: string | null;
    entryStatus: string;
    isCritical: boolean;
    appliesToJourney: boolean;
  }>;
  unverifiedCriticalKeys: string[];
}

export interface CompletePacAssessmentResultDto {
  assessment: PacAssessmentDto;
  unverifiedCriticalWarnings: string[];
}

export interface WardPostOpItemDto {
  itemId: string;
  itemKey: string;
  itemLabel: string;
  description: string | null;
  formCode: string | null;
  displayOrder: number;
  isCompleted: boolean;
  isBypassed: boolean;
  notes: string | null;
  completedAt: string | null;
  isBlockingEffective?: boolean;
}

export interface WardPostOpChecklistDto {
  journeyId: string;
  totalItems: number;
  completedItems: number;
  sentToOtAt: string | null;
  receivedFromOtAt: string | null;
  wardCheckoutAt: string | null;
  iolStickerChecks: IolStickerChecksDto;
  items: WardPostOpItemDto[];
}

export interface SaveWardPostOpCompletionRequest {
  isCompleted: boolean;
  isBypassed?: boolean;
  bypassReason?: string;
  notes?: string;
}

// ─── OT Surgical Safety (S3 — Form 1 OT) ─────────────────────────────────────

export interface SurgicalSafetyGateDto {
  billingGateSatisfied: boolean;
  billingVerifiedAuto: boolean;
  emergencyFcApplied: boolean;
  balanceDue: number | null;
  financialState: string;
  beforeAnaesthesiaComplete: boolean;
  whoTimeoutComplete: boolean;
  afterSurgeryComplete: boolean;
  warnings: string[];
}

export interface BeforeAnaesthesiaSectionDto {
  identityConfirmed: boolean;
  eyeRe: boolean;
  eyeLe: boolean;
  topicalAntibioticsUsed: boolean;
  surgeryType: string | null;
  billingVerifiedOverride: boolean;
  ascanVerified: boolean;
  allergyKnown: boolean;
  allergyDetails: string | null;
  consentFormChecked: boolean;
  fitnessConfirmed: boolean;
  completedAt: string | null;
  completedByRole?: string | null;
}

export interface WhoTimeoutSectionDto {
  patientIdentity: boolean;
  correctEye: boolean;
  correctProcedure: boolean;
  consentConfirmed: boolean;
  surgeonUserId: string | null;
  nurseUserId: string | null;
  completedAt: string | null;
  completedByRole?: string | null;
}

export interface AfterSurgerySectionDto {
  procedureNameRecorded: boolean;
  postopMedicationInstructed: boolean;
  postopPositionInstructed: boolean;
  completedAt: string | null;
  completedByRole?: string | null;
}

export interface SurgicalSafetyChecklistDto {
  journeyId: string;
  eyeOperated: string | null;
  procedureName: string | null;
  beforeAnaesthesia: BeforeAnaesthesiaSectionDto;
  whoTimeout: WhoTimeoutSectionDto;
  afterSurgery: AfterSurgerySectionDto;
  gates: SurgicalSafetyGateDto;
}

export interface SaveBeforeAnaesthesiaRequest {
  identityConfirmed: boolean;
  eyeRe: boolean;
  eyeLe: boolean;
  topicalAntibioticsUsed: boolean;
  surgeryType?: string;
  billingVerifiedOverride: boolean;
  ascanVerified: boolean;
  allergyKnown: boolean;
  allergyDetails?: string;
  consentFormChecked: boolean;
  fitnessConfirmed: boolean;
}

export interface SaveWhoTimeoutRequest {
  patientIdentity: boolean;
  correctEye: boolean;
  correctProcedure: boolean;
  consentConfirmed: boolean;
  surgeonUserId?: string;
  nurseUserId?: string;
}

export interface SaveAfterSurgeryRequest {
  procedureNameRecorded: boolean;
  postopMedicationInstructed: boolean;
  postopPositionInstructed: boolean;
}

const DEFAULT_SURGICAL_SAFETY_GATES: SurgicalSafetyGateDto = {
  billingGateSatisfied: false,
  billingVerifiedAuto: false,
  emergencyFcApplied: false,
  balanceDue: null,
  financialState: 'Unknown',
  beforeAnaesthesiaComplete: false,
  whoTimeoutComplete: false,
  afterSurgeryComplete: false,
  warnings: [],
};

const DEFAULT_BEFORE_ANAESTHESIA: BeforeAnaesthesiaSectionDto = {
  identityConfirmed: false,
  eyeRe: false,
  eyeLe: false,
  topicalAntibioticsUsed: false,
  surgeryType: null,
  billingVerifiedOverride: false,
  ascanVerified: false,
  allergyKnown: false,
  allergyDetails: null,
  consentFormChecked: false,
  fitnessConfirmed: false,
  completedAt: null,
};

const DEFAULT_WHO_TIMEOUT: WhoTimeoutSectionDto = {
  patientIdentity: false,
  correctEye: false,
  correctProcedure: false,
  consentConfirmed: false,
  surgeonUserId: null,
  nurseUserId: null,
  completedAt: null,
};

const DEFAULT_AFTER_SURGERY: AfterSurgerySectionDto = {
  procedureNameRecorded: false,
  postopMedicationInstructed: false,
  postopPositionInstructed: false,
  completedAt: null,
};

function normalizeSurgicalSafetyGates(
  raw: SurgicalSafetyGateDto | Record<string, unknown> | null | undefined,
): SurgicalSafetyGateDto {
  if (!raw || typeof raw !== 'object') return DEFAULT_SURGICAL_SAFETY_GATES;
  const g = raw as Record<string, unknown>;
  const warnings = Array.isArray(g.warnings)
    ? (g.warnings as string[])
    : Array.isArray(g.Warnings)
      ? (g.Warnings as string[])
      : [];
  const balance = g.balanceDue ?? g.BalanceDue;
  return {
    billingGateSatisfied: Boolean(g.billingGateSatisfied ?? g.BillingGateSatisfied ?? false),
    billingVerifiedAuto: Boolean(g.billingVerifiedAuto ?? g.BillingVerifiedAuto ?? false),
    emergencyFcApplied: Boolean(g.emergencyFcApplied ?? g.EmergencyFcApplied ?? false),
    balanceDue: balance == null ? null : Number(balance),
    financialState: String(g.financialState ?? g.FinancialState ?? 'Unknown'),
    beforeAnaesthesiaComplete: Boolean(
      g.beforeAnaesthesiaComplete ?? g.BeforeAnaesthesiaComplete ?? false,
    ),
    whoTimeoutComplete: Boolean(g.whoTimeoutComplete ?? g.WhoTimeoutComplete ?? false),
    afterSurgeryComplete: Boolean(g.afterSurgeryComplete ?? g.AfterSurgeryComplete ?? false),
    warnings,
  };
}

/** Normalizes surgical safety checklist payloads (camelCase or PascalCase). */
function normalizeSurgicalSafetyChecklist(
  raw: SurgicalSafetyChecklistDto | null | undefined,
): SurgicalSafetyChecklistDto | null {
  if (!raw) return null;
  const legacy = raw as SurgicalSafetyChecklistDto & {
    Gates?: SurgicalSafetyGateDto;
    BeforeAnaesthesia?: BeforeAnaesthesiaSectionDto;
    WhoTimeout?: WhoTimeoutSectionDto;
    AfterSurgery?: AfterSurgerySectionDto;
    JourneyId?: string;
    EyeOperated?: string | null;
    ProcedureName?: string | null;
  };

  return {
    journeyId: String(legacy.journeyId ?? legacy.JourneyId ?? ''),
    eyeOperated: legacy.eyeOperated ?? legacy.EyeOperated ?? null,
    procedureName: legacy.procedureName ?? legacy.ProcedureName ?? null,
    beforeAnaesthesia: legacy.beforeAnaesthesia ?? legacy.BeforeAnaesthesia ?? DEFAULT_BEFORE_ANAESTHESIA,
    whoTimeout: legacy.whoTimeout ?? legacy.WhoTimeout ?? DEFAULT_WHO_TIMEOUT,
    afterSurgery: legacy.afterSurgery ?? legacy.AfterSurgery ?? DEFAULT_AFTER_SURGERY,
    gates: normalizeSurgicalSafetyGates(legacy.gates ?? legacy.Gates),
  };
}

// ─── PAC Assessment (S4 — Form 3) ─────────────────────────────────────────────

export interface PacInvestigationsDto {
  hgb?: string | null;
  fbs?: string | null;
  serumCreatinine?: string | null;
  hiv?: string | null;
  hBsAg?: string | null;
  hcv?: string | null;
  xray?: string | null;
  ecg?: string | null;
  echo2d?: string | null;
  bloodGroup?: string | null;
  others?: string | null;
}

export interface PacSystemicReviewDto {
  cvs?: string | null;
  respiratory?: string | null;
  renal?: string | null;
  hepaticGi?: string | null;
  diabetes?: string | null;
  cns?: string | null;
  others?: string | null;
}

export interface PacAirwayExamDto {
  mallampati?: number | null;
  mouthOpening?: string | null;
  mentohyoid?: string | null;
  neck?: string | null;
  teeth?: string | null;
  lungs?: string | null;
  heart?: string | null;
  venousAccess?: string | null;
}

export interface PacMedicationLineDto {
  name: string;
  dose?: string | null;
  frequency?: string | null;
}

export interface PacAssessmentDto {
  journeyId: string;
  patientName: string | null;
  uhid: string | null;
  procedureName: string | null;
  eyeOperated: string | null;
  assessedAt: string | null;
  preOpDiagnosis: string | null;
  bp: string | null;
  hr: number | null;
  physicalStatusAsa: number | null;
  investigations: PacInvestigationsDto;
  allergies: string | null;
  systemicReview: PacSystemicReviewDto;
  pastAnaestheticHistory: string | null;
  airwayExam: PacAirwayExamDto;
  anaesthesiaPlan: string | null;
  periOpExplained: boolean;
  consentType: string | null;
  currentMedications: PacMedicationLineDto[];
  preOpConsultations: string | null;
  medicationsAdvised: string | null;
  investigationsAdvised: string | null;
  completedByDesignation: string | null;
  assessmentStatus: string;
  completedAt: string | null;
  isComplete: boolean;
}

export interface SavePacAssessmentRequest {
  assessedAt?: string | null;
  preOpDiagnosis?: string | null;
  bp?: string | null;
  hr?: number | null;
  physicalStatusAsa?: number | null;
  investigations?: PacInvestigationsDto | null;
  allergies?: string | null;
  systemicReview?: PacSystemicReviewDto | null;
  pastAnaestheticHistory?: string | null;
  airwayExam?: PacAirwayExamDto | null;
  anaesthesiaPlan?: string | null;
  periOpExplained?: boolean | null;
  consentType?: string | null;
  currentMedications?: PacMedicationLineDto[] | null;
  preOpConsultations?: string | null;
  medicationsAdvised?: string | null;
  investigationsAdvised?: string | null;
  completedByDesignation?: string | null;
}

function pacStr(raw: Record<string, unknown>, ...keys: string[]): string | null {
  for (const k of keys) {
    const v = raw[k];
    if (typeof v === 'string') return v;
  }
  return null;
}

function pacNum(raw: Record<string, unknown>, ...keys: string[]): number | null {
  for (const k of keys) {
    const v = raw[k];
    if (typeof v === 'number' && !Number.isNaN(v)) return v;
  }
  return null;
}

function normalizePacInvestigations(raw: unknown): PacInvestigationsDto {
  const o = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  return {
    hgb: pacStr(o, 'hgb', 'Hgb'),
    fbs: pacStr(o, 'fbs', 'Fbs'),
    serumCreatinine: pacStr(o, 'serumCreatinine', 'SerumCreatinine'),
    hiv: pacStr(o, 'hiv', 'Hiv'),
    hBsAg: pacStr(o, 'hBsAg', 'HBsAg'),
    hcv: pacStr(o, 'hcv', 'Hcv'),
    xray: pacStr(o, 'xray', 'Xray'),
    ecg: pacStr(o, 'ecg', 'Ecg'),
    echo2d: pacStr(o, 'echo2d', 'Echo2d'),
    bloodGroup: pacStr(o, 'bloodGroup', 'BloodGroup'),
    others: pacStr(o, 'others', 'Others'),
  };
}

function normalizePacSystemicReview(raw: unknown): PacSystemicReviewDto {
  const o = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  return {
    cvs: pacStr(o, 'cvs', 'Cvs'),
    respiratory: pacStr(o, 'respiratory', 'Respiratory'),
    renal: pacStr(o, 'renal', 'Renal'),
    hepaticGi: pacStr(o, 'hepaticGi', 'HepaticGi'),
    diabetes: pacStr(o, 'diabetes', 'Diabetes'),
    cns: pacStr(o, 'cns', 'Cns'),
    others: pacStr(o, 'others', 'Others'),
  };
}

function normalizePacAirwayExam(raw: unknown): PacAirwayExamDto {
  const o = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  return {
    mallampati: pacNum(o, 'mallampati', 'Mallampati'),
    mouthOpening: pacStr(o, 'mouthOpening', 'MouthOpening'),
    mentohyoid: pacStr(o, 'mentohyoid', 'Mentohyoid'),
    neck: pacStr(o, 'neck', 'Neck'),
    teeth: pacStr(o, 'teeth', 'Teeth'),
    lungs: pacStr(o, 'lungs', 'Lungs'),
    heart: pacStr(o, 'heart', 'Heart'),
    venousAccess: pacStr(o, 'venousAccess', 'VenousAccess'),
  };
}

function normalizePacMedications(raw: unknown): PacMedicationLineDto[] {
  const arr = Array.isArray(raw) ? raw : [];
  return arr.map(item => {
    const o = (item && typeof item === 'object' ? item : {}) as Record<string, unknown>;
    return {
      name: pacStr(o, 'name', 'Name') ?? '',
      dose: pacStr(o, 'dose', 'Dose'),
      frequency: pacStr(o, 'frequency', 'Frequency'),
    };
  });
}

/** Normalize PAC API payloads (handles PascalCase + missing nested defaults). */
export function normalizePacAssessment(raw: unknown): PacAssessmentDto | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  return {
    journeyId: String(r.journeyId ?? r.JourneyId ?? ''),
    patientName: pacStr(r, 'patientName', 'PatientName'),
    uhid: pacStr(r, 'uhid', 'Uhid'),
    procedureName: pacStr(r, 'procedureName', 'ProcedureName'),
    eyeOperated: pacStr(r, 'eyeOperated', 'EyeOperated'),
    assessedAt: pacStr(r, 'assessedAt', 'AssessedAt'),
    preOpDiagnosis: pacStr(r, 'preOpDiagnosis', 'PreOpDiagnosis'),
    bp: pacStr(r, 'bp', 'Bp'),
    hr: pacNum(r, 'hr', 'Hr'),
    physicalStatusAsa: pacNum(r, 'physicalStatusAsa', 'PhysicalStatusAsa'),
    investigations: normalizePacInvestigations(r.investigations ?? r.Investigations),
    allergies: pacStr(r, 'allergies', 'Allergies'),
    systemicReview: normalizePacSystemicReview(r.systemicReview ?? r.SystemicReview),
    pastAnaestheticHistory: pacStr(r, 'pastAnaestheticHistory', 'PastAnaestheticHistory'),
    airwayExam: normalizePacAirwayExam(r.airwayExam ?? r.AirwayExam),
    anaesthesiaPlan: pacStr(r, 'anaesthesiaPlan', 'AnaesthesiaPlan'),
    periOpExplained: Boolean(r.periOpExplained ?? r.PeriOpExplained ?? false),
    consentType: pacStr(r, 'consentType', 'ConsentType'),
    currentMedications: normalizePacMedications(r.currentMedications ?? r.CurrentMedications),
    preOpConsultations: pacStr(r, 'preOpConsultations', 'PreOpConsultations'),
    medicationsAdvised: pacStr(r, 'medicationsAdvised', 'MedicationsAdvised'),
    investigationsAdvised: pacStr(r, 'investigationsAdvised', 'InvestigationsAdvised'),
    completedByDesignation: pacStr(r, 'completedByDesignation', 'CompletedByDesignation'),
    assessmentStatus: pacStr(r, 'assessmentStatus', 'AssessmentStatus') ?? 'Draft',
    completedAt: pacStr(r, 'completedAt', 'CompletedAt'),
    isComplete: Boolean(r.isComplete ?? r.IsComplete ?? false),
  };
}

// ─── Anaesthesia Monitoring (S4 — Form 5) ─────────────────────────────────────

export interface MonitoringReadingDto {
  id: string;
  elapsedMin: number;
  pulse: number | null;
  spo2: number | null;
  recordedAt: string | null;
}

export interface AnaesthesiaMonitoringDto {
  journeyId: string;
  preOpPulse: number | null;
  preOpBp: string | null;
  preOpSpo2: number | null;
  preOpConsentConfirmed: boolean;
  preOpReviewAt: string | null;
  readings: MonitoringReadingDto[];
  dischargePr: number | null;
  dischargeBp: string | null;
  generalConditionNormal: boolean | null;
  dischargeRemarks: string | null;
  dischargeClearedAt: string | null;
  dischargeClearanceComplete: boolean;
}

export interface SavePreOpReviewRequest {
  pulse?: number | null;
  bp?: string | null;
  spo2?: number | null;
  consentConfirmed: boolean;
}

export interface SaveMonitoringReadingRequest {
  elapsedMin: number;
  pulse?: number | null;
  spo2?: number | null;
}

export interface UpdateMonitoringReadingRequest {
  elapsedMin?: number | null;
  pulse?: number | null;
  spo2?: number | null;
}

export interface SaveDischargeClearanceRequest {
  pulse?: number | null;
  bp?: string | null;
  generalConditionNormal?: boolean | null;
  remarks?: string | null;
}

/** Ensures `readings` is always an array (camelCase or PascalCase API payloads). */
function normalizeAnaesthesiaMonitoring(
  raw: AnaesthesiaMonitoringDto | null | undefined,
): AnaesthesiaMonitoringDto | null {
  if (!raw) return null;
  const legacy = raw as AnaesthesiaMonitoringDto & { Readings?: MonitoringReadingDto[] };
  const readings = Array.isArray(legacy.readings)
    ? legacy.readings
    : Array.isArray(legacy.Readings)
      ? legacy.Readings
      : [];
  return { ...raw, readings };
}

// ─── Audit Log Types ──────────────────────────────────────────────────────────

export interface JourneyAuditLogDto {
  id: string;
  action: string;
  stateType?: string | null;
  oldValue: string | null;
  newValue: string | null;
  performedByUserId?: string | null;
  performedAt: string;
  reason?: string | null;
  correlationId?: string | null;
  previousState?: string | null;
  newState?: string | null;
  /** Alias of action for older UI. */
  fieldChanged: string;
  /** Alias of performedAt for older UI. */
  changedAt: string;
  changedByUserId?: string;
  journeyId?: string;
}

export function normalizeJourneyAuditLog(
  raw: Partial<JourneyAuditLogDto> & Record<string, unknown>,
  journeyId?: string,
): JourneyAuditLogDto {
  const action = String(raw.action ?? raw.fieldChanged ?? '');
  const performedAt = String(raw.performedAt ?? raw.changedAt ?? '');
  return {
    id: String(raw.id ?? ''),
    action,
    stateType: (raw.stateType as string | null | undefined) ?? null,
    oldValue: (raw.oldValue as string | null | undefined) ?? null,
    newValue: (raw.newValue as string | null | undefined) ?? null,
    performedByUserId:
      (raw.performedByUserId as string | null | undefined)
      ?? (raw.changedByUserId as string | null | undefined)
      ?? null,
    performedAt,
    reason: (raw.reason as string | null | undefined) ?? null,
    correlationId: (raw.correlationId as string | null | undefined) ?? null,
    previousState: (raw.previousState as string | null | undefined) ?? null,
    newState: (raw.newState as string | null | undefined) ?? null,
    fieldChanged: action,
    changedAt: performedAt,
    changedByUserId: (raw.changedByUserId as string | undefined)
      ?? (raw.performedByUserId as string | undefined),
    journeyId: journeyId ?? (raw.journeyId as string | undefined),
  };
}

// ─── Pre-Op Clearance Types ───────────────────────────────────────────────────

export interface PreOpSectionItemDto {
  id: string;
  category: string;
  itemKey: string;
  itemLabel: string;
  description: string | null;
  departmentOwner: string | null;
  isMandatory: boolean;
  isBlocking: boolean;
  requiresDocument: boolean;
  patientTypeFilter: string | null;
  surgeryTypeFilter: string | null;
  displayOrder: number;
}

export interface PreOpClearanceDto {
  id: string;
  journeyId: string;
  paymentModeSnapshot: string | null;
  insurancePreauthId: string | null;
  overallStatus: string; // NotStarted|InProgress|ClearedForAdmission|OnHold|Deferred|Rejected
  overallClearance: boolean;
  isDeferred: boolean;
  deferredReason: string | null;
  clearedAt: string | null;
  clearedByUserId: string | null;
  clearanceNotes: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface PreOpCompletionDto {
  id: string;
  clearanceId: string;
  itemId: string;
  itemKey: string;
  itemLabel: string;
  category: string;
  isBlocking: boolean;
  requiresDocument: boolean;
  isCompleted: boolean;
  isBypassed: boolean;
  bypassReason: string | null;
  notes: string | null;
  documentId: string | null;
  completedByUserId: string | null;
  completedAt: string | null;
  updatedAt: string;
  formCode?: string | null;
  source?: string | null;
  /** Fasting & Medication v2 — typed result + attribution. */
  resultValue?: string | null;
  resultUnit?: string | null;
  entryStatus?: string | null;
  enteredAt?: string | null;
  completedByRole?: string | null;
}

export interface PreOpDocumentDto {
  id: string;
  clearanceId: string;
  documentType: string;
  fileName: string;
  fileUrl: string;
  contentType: string | null;
  fileSizeBytes: number | null;
  isVerified: boolean;
  verifiedByUserId: string | null;
  verifiedAt: string | null;
  notes: string | null;
  uploadedByUserId: string | null;
  createdAt: string;
}

// ─── Pre-Op Section Clearance Types ──────────────────────────────────────────

export interface PreOpSectionClearanceDto {
  id: string;
  clearanceId: string;
  /** The patient journey ID — used by dept page to call respondToSection/confirmSection */
  journeyId: string;
  sectionCategory: string;
  responsibleDepartmentCode: string;
  /** NotRequested | Requested | RespondedClear | RespondedConcerns | WardConfirmed | OnHold | Rejected | NeedsInfo | Escalated */
  status: string;
  requestedByUserId: string | null;
  requestedAt: string | null;
  respondedByUserId: string | null;
  respondedAt: string | null;
  responseNotes: string | null;
  isExternalResponder: boolean;
  externalResponderName: string | null;
  externalResponderContact: string | null;
  confirmedByUserId: string | null;
  confirmedAt: string | null;
  confirmationNotes: string | null;
  createdAt: string;
  updatedAt: string;
  urgency: string;            // Low | Normal | High | Urgent
  rejectionReason: string | null;
  /** Computed UI rollup from backend (G3 / R4.2). */
  sectionDisplayStatus?: string | null;
}

export interface RespondToSectionRequest {
  /** RespondedClear | RespondedConcerns */
  responseStatus: 'RespondedClear' | 'RespondedConcerns';
  responseNotes?: string;
  isExternalResponder?: boolean;
  externalResponderName?: string;
  externalResponderContact?: string;
}

export interface PutSectionOnHoldRequest {
  reason: string;
}

export interface RejectSectionRequest {
  rejectionReason: string;
  notes?: string;
}

export interface RequestMoreInfoRequest {
  infoNeeded: string;
}

export interface EscalateSectionRequest {
  reason: string;
  urgency?: string;
}

export interface ConfirmSectionRequest {
  confirmationNotes?: string;
}

/** Structured medico-legal signatory record, keyed to a consent completion by completionId. */
export interface PreOpConsentDetailDto {
  id: string;
  completionId: string;
  patientSigned: boolean;
  witnessName: string | null;
  witnessRelation: string | null;
  surgeonUserId: string | null;
  surgeonName: string | null;
  consentVersion: string | null;
  method: string;
  signedAt: string | null;
  capturedByUserId: string | null;
  capturedByName: string | null;
  revokedAt: string | null;
  revokedReason: string | null;
}

export interface PreOpClearanceDetailDto {
  clearance: PreOpClearanceDto;
  completions: PreOpCompletionDto[];
  documents: PreOpDocumentDto[];
  preOpVitals: VitalSignDto[];
  totalItems: number;
  completedItems: number;
  blockingIncomplete: number;
  readyToAdmit: boolean;
  /** Empty array means all sections are NotRequested — treat gracefully, no error */
  sectionClearances: PreOpSectionClearanceDto[];
  /** Structured consent signatory records, matched to completions by completionId. */
  consentDetails: PreOpConsentDetailDto[];
}

/** Per-step readiness from GET …/pre-op/readiness (Phase 8). */
export interface StepReadinessApiDto {
  key: string;
  completed: number;
  total: number;
  blocking: number;
  status: string;
  locked: boolean;
  hasCount: boolean;
}

export interface PreOpReadinessApiDto {
  steps: StepReadinessApiDto[];
  readySteps: number;
  countableSteps: number;
  blockers: number;
  dilation?: {
    startedAt?: string | null;
    readyAt?: string | null;
    remainingSeconds?: number | null;
    status: string;
    medicineName?: string | null;
  } | null;
}

// Pre-Op request types
export interface InitPreOpClearanceRequest {
  paymentModeSnapshot?: string;
  insurancePreauthId?: string;
}

export interface SavePreOpCompletionRequest {
  itemId: string;
  isCompleted: boolean;
  isBypassed: boolean;
  bypassReason?: string;
  notes?: string;
  documentId?: string;
  /**
   * Typed result. For `last_food_time` send the ISO intake timestamp in `resultValue`
   * and the intake type (`clear` | `light` | `solid`) in `resultUnit`; the server
   * derives `fasting_hours` + `fasting_confirmed` from it.
   */
  resultValue?: string;
  resultUnit?: string;
}

export interface BatchSavePreOpCompletionsRequest {
  items: SavePreOpCompletionRequest[];
}

export interface CaptureConsentRequest {
  patientSigned: boolean;
  witnessName?: string | null;
  witnessRelation?: string | null;
  surgeonUserId?: string | null;
  consentVersion?: string | null;
  method?: string | null;
  signedAt?: string | null;
  documentId?: string | null;
  notes?: string | null;
}

export interface RevokeConsentRequest {
  reason: string;
}

/** Live coverage & payment status (read-only) projected from the CCMS coverage case. */
export interface PreauthStatusDto {
  allowed: boolean;
  warningLevel: string; // none | info | warning | block
  warningMessage: string | null;
  blockReason: string | null;
  preAuthNumber: string | null;
  approvedAmount: number | null;
  caseId?: string | null;
  coverageState?: string | null;
  decision?: string; // ALLOW | WARN | BLOCK
  paymentMode?: string | null;
  isEmergencyFinancialClearance?: boolean;
  requiresOverride?: boolean;
  lastUpdatedAt?: string | null;
  ccmsUnavailable?: boolean;
  payerShareAmount?: number | null;
  patientShareAmount?: number | null;
  coverageStatus?: string | null;
  collectedAmount?: number | null;
  patientObligationAmount?: number | null;
}

export interface AddPreOpVitalRequest {
  recordedAt?: string;
  temperature?: number;
  bloodPressureSystolic?: number;
  bloodPressureDiastolic?: number;
  pulseRate?: number;
  respiratoryRate?: number;
  oxygenSaturation?: number;
  weight?: number;
  height?: number;
  notes?: string;
}

export interface UploadPreOpDocumentRequest {
  documentType: string;
  fileName: string;
  contentType: string;
  fileData: string; // Base64-encoded
}

export interface VerifyPreOpDocumentRequest {
  isVerified: boolean;
  notes?: string;
}

export interface ApprovePreOpClearanceRequest {
  wardId?: string;
  admissionType?: string;
  admittingDoctorId?: string;
  bedNumber?: string;
  roomNumber?: string;
  attendantName?: string;
  attendantPhone?: string;
  attendantRelationship?: string;
  primaryNurseId?: string;
  primarySurgeonId?: string;
  clearanceNotes?: string;
  isEmergency?: boolean;
  emergencyReason?: string;
}

export interface DeferPreOpClearanceRequest {
  deferredReason: string;
}

// ─── API Client ───────────────────────────────────────────────────────────────

export const ipManagementApi = {
  // ── Wards ──────────────────────────────────────────────────────────────────
  async listWards(params?: { branchId?: string }): Promise<WardDto[]> {
    try {
      const r = await getClient().get<WardDto[]>('/ip-management/wards', { params });
      return Array.isArray(r.data) ? r.data : [];
    } catch (e) {
      console.warn('[ip-management] listWards failed', e);
      return [];
    }
  },

  async createWard(req: CreateWardRequest): Promise<WardDto | null> {
    try {
      const r = await getClient().post<WardDto>('/ip-management/wards', req);
      return r.data;
    } catch (e) {
      console.warn('[ip-management] createWard failed', e);
      return null;
    }
  },

  async updateWard(id: string, req: UpdateWardRequest): Promise<WardDto | null> {
    try {
      const r = await getClient().put<WardDto>(`/ip-management/wards/${id}`, req);
      return r.data;
    } catch (e) {
      console.warn('[ip-management] updateWard failed', e);
      return null;
    }
  },

  async deleteWard(id: string): Promise<boolean> {
    try {
      await getClient().delete(`/ip-management/wards/${id}`);
      return true;
    } catch (e) {
      console.warn('[ip-management] deleteWard failed', e);
      return false;
    }
  },

  // ── Journeys ───────────────────────────────────────────────────────────────
  async listJourneys(params?: {
    branchId?: string;
    clinicalState?: string;
    wardId?: string;
    fromDate?: string;
    toDate?: string;
    uhid?: string;
    patientName?: string;
  }): Promise<PatientJourneyRowDto[]> {
    try {
      const r = await getClient().get<PatientJourneyRowDto[]>('/ip-management/journeys', { params });
      return Array.isArray(r.data) ? r.data : [];
    } catch (e) {
      console.warn('[ip-management] listJourneys failed', e);
      return [];
    }
  },

  async getCensusTabCounts(branchId: string): Promise<CensusTabCountsDto | null> {
    try {
      const r = await getClient().get<CensusTabCountsDto>('/ip-management/journeys/tab-counts', {
        params: { branchId },
      });
      return r.data ?? null;
    } catch (e) {
      console.warn('[ip-management] getCensusTabCounts failed', e);
      return null;
    }
  },

  async listSlots(params: {
    branchId: string;
    date: string;
    theatreId?: string;
  }): Promise<SlotBoardDto | null> {
    try {
      const r = await getClient().get<SlotBoardDto>('/ip-management/slots', { params });
      return r.data ?? null;
    } catch (e) {
      console.warn('[ip-management] listSlots failed', e);
      return null;
    }
  },

  async getSlotMetrics(params: {
    branchId: string;
    date: string;
    theatreId?: string;
  }): Promise<SlotMetricsDto | null> {
    try {
      const r = await getClient().get<SlotMetricsDto>('/ip-management/slots/metrics', { params });
      return r.data ?? null;
    } catch (e) {
      console.warn('[ip-management] getSlotMetrics failed', e);
      return null;
    }
  },

  async getSlotThroughput(params: {
    branchId: string;
    from: string;
    to: string;
    theatreId?: string;
  }): Promise<SlotThroughputDto | null> {
    try {
      const r = await getClient().get<SlotThroughputDto>('/ip-management/slots/throughput', { params });
      return r.data ?? null;
    } catch (e) {
      console.warn('[ip-management] getSlotThroughput failed', e);
      return null;
    }
  },

  async assignSlot(req: AssignSlotRequest): Promise<JourneySlotRowDto> {
    try {
      const r = await getClient().post<JourneySlotRowDto>('/ip-management/slots', req);
      return r.data;
    } catch (e: unknown) {
      console.warn('[ip-management] assignSlot failed', e);
      const err = new Error(formatApiError(e, 'Could not assign slot.')) as Error & { concurrencyConflict?: boolean };
      err.concurrencyConflict = isConcurrencyConflict(e);
      throw err;
    }
  },

  async reorderSlots(req: ReorderSlotsRequest): Promise<JourneySlotRowDto[]> {
    try {
      const r = await getClient().patch<JourneySlotRowDto[]>('/ip-management/slots/reorder', req);
      return Array.isArray(r.data) ? r.data : [];
    } catch (e: unknown) {
      console.warn('[ip-management] reorderSlots failed', e);
      const err = new Error(formatApiError(e, 'Could not reorder slots.')) as Error & { concurrencyConflict?: boolean };
      err.concurrencyConflict = isConcurrencyConflict(e);
      throw err;
    }
  },

  async releaseSlot(slotId: string, reason?: string): Promise<void> {
    try {
      await getClient().post(`/ip-management/slots/${slotId}/release`, { reason });
    } catch (e: unknown) {
      console.warn('[ip-management] releaseSlot failed', e);
      const err = new Error(formatApiError(e, 'Could not release slot.')) as Error & { concurrencyConflict?: boolean };
      err.concurrencyConflict = isConcurrencyConflict(e);
      throw err;
    }
  },

  async listJourneySlots(journeyId: string): Promise<JourneySlotRowDto[]> {
    try {
      const r = await getClient().get<JourneySlotRowDto[]>(`/ip-management/journeys/${journeyId}/slots`);
      return Array.isArray(r.data) ? r.data : [];
    } catch (e) {
      console.warn('[ip-management] listJourneySlots failed', e);
      return [];
    }
  },

  async getJourneyDetail(id: string): Promise<PatientJourneyDetailDto | null> {
    try {
      const r = await getClient().get<PatientJourneyDetailDto>(`/ip-management/journeys/${id}`);
      return r.data;
    } catch (e) {
      console.warn('[ip-management] getJourneyDetail failed', e);
      return null;
    }
  },

  async admitPatient(id: string, req: AdmitPatientRequest): Promise<PatientJourneyDetailDto | null> {
    try {
      const r = await getClient().post<PatientJourneyDetailDto>(`/ip-management/journeys/${id}/admit`, req);
      return r.data;
    } catch (e: unknown) {
      console.warn('[ip-management] admitPatient failed', e);
      throw new Error(formatApiError(e, 'Admission failed. Coverage authorization may be required.'));
    }
  },

  async cancelTodaySurgery(id: string, reason: string, expectedUpdatedAt?: string): Promise<PatientJourneyDetailDto | null> {
    try {
      const r = await getClient().post<PatientJourneyDetailDto>(
        `/ip-management/journeys/${id}/cancel-today-surgery`,
        { reason, expectedUpdatedAt },
      );
      return r.data;
    } catch (e: unknown) {
      console.warn('[ip-management] cancelTodaySurgery failed', e);
      const err = new Error(formatApiError(e, 'Could not cancel today\'s surgery.')) as Error & { concurrencyConflict?: boolean };
      err.concurrencyConflict = isConcurrencyConflict(e);
      throw err;
    }
  },

  async cancelAdmission(id: string, reason: string, expectedUpdatedAt?: string): Promise<PatientJourneyDetailDto | null> {
    try {
      const r = await getClient().post<PatientJourneyDetailDto>(
        `/ip-management/journeys/${id}/cancel-admission`,
        { reason, expectedUpdatedAt },
      );
      return r.data;
    } catch (e: unknown) {
      console.warn('[ip-management] cancelAdmission failed', e);
      const err = new Error(formatApiError(e, 'Could not cancel this admission.')) as Error & { concurrencyConflict?: boolean };
      err.concurrencyConflict = isConcurrencyConflict(e);
      throw err;
    }
  },

  /** Ward off-ramp recovery: CancelledSurgery → Expected (explicit rebook). */
  async rebookCancelledSurgery(id: string): Promise<PatientJourneyDetailDto | null> {
    try {
      const r = await getClient().post<PatientJourneyDetailDto>(
        `/ip-management/journeys/${id}/rebook`,
      );
      return r.data;
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: string } })?.response?.data;
      console.warn('[ip-management] rebookCancelledSurgery failed', e);
      throw new Error(typeof msg === 'string' ? msg : 'Could not rebook this patient.');
    }
  },

  async transferBed(id: string, req: { assignedBedId: string; wardId?: string; reason?: string; expectedUpdatedAt?: string }): Promise<PatientJourneyDetailDto> {
    try {
      const r = await getClient().post<PatientJourneyDetailDto>(`/ip-management/journeys/${id}/transfer-bed`, req);
      return r.data;
    } catch (e: unknown) {
      throw new Error(formatApiError(e, 'Bed transfer failed.'));
    }
  },

  async listBedAssignments(id: string): Promise<Array<{ assignmentType: string; bedNumber?: string | null; startedAt: string; endedAt?: string | null; reason?: string | null }>> {
    try {
      const r = await getClient().get(`/ip-management/journeys/${id}/bed-assignments`);
      return Array.isArray(r.data) ? r.data : [];
    } catch (e) {
      console.warn('[ip-management] listBedAssignments failed', e);
      return [];
    }
  },

  async dischargeWithType(id: string, req: {
    dischargeType: 'Routine' | 'Lama' | 'Transfer' | 'Death' | 'Other';
    reason: string;
    confirmed: boolean;
    acknowledgeWarnings?: boolean;
    expectedUpdatedAt?: string;
  }): Promise<PatientJourneyDetailDto> {
    try {
      const r = await getClient().post<PatientJourneyDetailDto>(`/ip-management/journeys/${id}/discharge`, req);
      return r.data;
    } catch (e: unknown) {
      throw new Error(formatApiError(e, 'Discharge failed.'));
    }
  },

  async cancelDischarge(id: string, req: { reason: string; assignedBedId?: string; expectedUpdatedAt?: string }): Promise<PatientJourneyDetailDto> {
    try {
      const r = await getClient().post<PatientJourneyDetailDto>(`/ip-management/journeys/${id}/cancel-discharge`, req);
      return r.data;
    } catch (e: unknown) {
      throw new Error(formatApiError(e, 'Could not cancel discharge.'));
    }
  },

  async updateWardAssignment(id: string, req: UpdateWardAssignmentRequest): Promise<PatientJourneyDetailDto | null> {
    try {
      const r = await getClient().put<PatientJourneyDetailDto>(`/ip-management/journeys/${id}/ward`, req);
      return r.data;
    } catch (e) {
      console.warn('[ip-management] updateWardAssignment failed', e);
      return null;
    }
  },

  async updateOtDetails(id: string, req: UpdateOtDetailsRequest): Promise<PatientJourneyDetailDto | null> {
    try {
      const r = await getClient().put<PatientJourneyDetailDto>(`/ip-management/journeys/${id}/ot`, req);
      return r.data;
    } catch (e) {
      console.warn('[ip-management] updateOtDetails failed', e);
      return null;
    }
  },

  async refreshFromOpd(id: string): Promise<{
    journey: PatientJourneyDetailDto;
    biometryMissing: boolean;
    eyePhrase: string | null;
    iolPower: string | null;
  }> {
    const r = await getClient().post<{
      journey: PatientJourneyDetailDto;
      biometryMissing: boolean;
      eyePhrase: string | null;
      iolPower: string | null;
    }>(`/ip-management/journeys/${id}/refresh-from-opd`);
    return r.data;
  },

  async transitionClinical(id: string, req: TransitionRequest): Promise<PatientJourneyDetailDto> {
    try {
      const r = await getClient().post<PatientJourneyDetailDto>(`/ip-management/journeys/${id}/clinical-transition`, req);
      return requireOtJourneyMutationResult<PatientJourneyDetailDto>(r.data, 'Clinical transition failed.');
    } catch (e: unknown) {
      if (e instanceof Error && e.message && !axios.isAxiosError(e)) throw e;
      const err = new Error(formatApiError(e, 'Clinical transition failed.')) as Error & { concurrencyConflict?: boolean };
      err.concurrencyConflict = isConcurrencyConflict(e);
      throw err;
    }
  },

  async acceptInOT(id: string, acknowledgeWarnings = false): Promise<PatientJourneyDetailDto> {
    try {
      const r = await getClient().post<PatientJourneyDetailDto>(
        `/ip-management/journeys/${id}/accept`,
        {},
        { params: acknowledgeWarnings ? { acknowledgeWarnings: true } : undefined },
      );
      return requireOtJourneyMutationResult<PatientJourneyDetailDto>(r.data, 'Could not accept the patient in OT.');
    } catch (e: unknown) {
      if (e instanceof Error && e.message && !axios.isAxiosError(e)) throw e;
      throw new Error(formatApiError(e, 'Could not accept the patient in OT.'));
    }
  },

  async startSurgery(id: string, acknowledgeWhoWarning = false): Promise<PatientJourneyDetailDto> {
    try {
      const r = await getClient().post<PatientJourneyDetailDto>(
        `/ip-management/journeys/${id}/start-surgery`,
        {},
        { params: acknowledgeWhoWarning ? { acknowledgeWhoWarning: true } : undefined },
      );
      return requireOtJourneyMutationResult<PatientJourneyDetailDto>(r.data, 'Could not start surgery.');
    } catch (e: unknown) {
      if (e instanceof Error && e.message && !axios.isAxiosError(e)) throw e;
      throw new Error(formatApiError(e, 'Could not start surgery.'));
    }
  },

  async getTransitionGates(id: string, newState: string): Promise<ChecklistGateResultDto | null> {
    try {
      const r = await getClient().get<ChecklistGateResultDto>(
        `/ip-management/journeys/${id}/transition-gates`,
        { params: { newState } },
      );
      return r.data;
    } catch (e) {
      console.warn('[ip-management] getTransitionGates failed', e);
      return null;
    }
  },

  async applyWhoSupervisorOverride(id: string, reason?: string): Promise<PatientJourneyDetailDto | null> {
    try {
      const r = await getClient().post<PatientJourneyDetailDto>(
        `/ip-management/journeys/${id}/who-supervisor-override`,
        { reason: reason ?? null },
      );
      return r.data;
    } catch (e) {
      console.warn('[ip-management] applyWhoSupervisorOverride failed', e);
      return null;
    }
  },

  /** @deprecated Billing OpdBill owns Paid/Settled. Do not call this. */
  async transitionFinancial(_id: string, _req: TransitionRequest): Promise<PatientJourneyDetailDto | null> {
    throw new Error('Financial lifecycle is owned by Billing. Use getFinancialSummary / OpdBill APIs.');
  },

  async applyEmergencyFc(id: string, req: EmergencyFcRequest): Promise<PatientJourneyDetailDto | null> {
    try {
      const r = await getClient().post<PatientJourneyDetailDto>(`/ip-management/journeys/${id}/emergency-fc`, req);
      return r.data;
    } catch (e) {
      console.warn('[ip-management] applyEmergencyFc failed', e);
      return null;
    }
  },

  async applyDischargeOverride(id: string, req: DischargeOverrideRequest): Promise<PatientJourneyDetailDto | null> {
    try {
      const r = await getClient().put<PatientJourneyDetailDto>(`/ip-management/journeys/${id}/discharge-override`, req);
      return r.data;
    } catch (e) {
      console.warn('[ip-management] applyDischargeOverride failed', e);
      return null;
    }
  },

  // ── Billing ────────────────────────────────────────────────────────────────
  async listBilling(journeyId: string): Promise<BillingTransactionDto[]> {
    try {
      const r = await getClient().get<BillingTransactionDto[]>(`/ip-management/journeys/${journeyId}/billing`);
      return Array.isArray(r.data) ? r.data : [];
    } catch (e) {
      console.warn('[ip-management] listBilling failed', e);
      return [];
    }
  },

  /**
   * @deprecated Money is owned by Billing. Do not call this from UI.
   * Use `POST /api/OpdBills/payment` (via the OPD billing page / collect drawer)
   * so receipt numbering, idempotency, refunds and the CCMS outbox all fire.
   * Kept for UAT seeders and backward-compatible clients.
   */
  async addBilling(journeyId: string, req: AddBillingTransactionRequest): Promise<BillingTransactionDto | null> {
    if (process.env.NODE_ENV !== 'production') {
      console.warn(
        '[ip-management] addBilling is deprecated. Collect through Billing (POST /api/OpdBills/payment), not the journey projection.',
      );
    }
    try {
      const r = await getClient().post<BillingTransactionDto>(`/ip-management/journeys/${journeyId}/billing`, req);
      return r.data;
    } catch (e) {
      console.warn('[ip-management] addBilling failed', e);
      return null;
    }
  },

  async getFinancialSummary(journeyId: string): Promise<{
    opdBillId?: string | null;
    billNumber?: string | null;
    packageEstimate?: number;
    billedAmount: number;
    discountTotal?: number;
    patientResponsibility?: number;
    insuranceResponsibility?: number;
    patientPaid?: number;
    patientBalance?: number;
    ccmsPatientShare?: number | null;
    ccmsPatientShareAvailable?: boolean;
    totalCollected: number;
    advances?: number;
    refundsAndReversals?: number;
    balanceDue: number;
    financialStatus: string;
    isFinalized?: boolean;
    hasPendingClaim?: boolean;
    financialBlockers?: string[];
  } | null> {
    try {
      const r = await getClient().get(`/ip-management/journeys/${journeyId}/financial-summary`);
      return r.data;
    } catch (e) {
      console.warn('[ip-management] getFinancialSummary failed', e);
      return null;
    }
  },

  async getReceipt(journeyId: string, txnId: string): Promise<BillingTransactionDto | null> {
    try {
      const r = await getClient().get<BillingTransactionDto>(`/ip-management/journeys/${journeyId}/billing/${txnId}/receipt`);
      return r.data;
    } catch (e) {
      console.warn('[ip-management] getReceipt failed', e);
      return null;
    }
  },

  async getDischargeSummaryPreview(journeyId: string): Promise<DischargeSummaryPreviewDto | null> {
    try {
      const r = await getClient().get<DischargeSummaryPreviewDto>(`/ip-management/journeys/${journeyId}/discharge-summary/preview`);
      return r.data;
    } catch (e) {
      console.warn('[ip-management] getDischargeSummaryPreview failed', e);
      return null;
    }
  },

  // ── Intra-Op Note ──────────────────────────────────────────────────────────
  async getIntraOpNote(journeyId: string): Promise<IntraOpNoteDto | null> {
    try {
      const r = await getClient().get<IntraOpNoteDto>(`/ip-management/journeys/${journeyId}/intra-op`);
      return r.data;
    } catch (e) {
      console.warn('[ip-management] getIntraOpNote failed', e);
      return null;
    }
  },

  async saveIntraOpNote(journeyId: string, req: SaveIntraOpNoteRequest): Promise<IntraOpNoteDto | null> {
    try {
      const r = await getClient().post<IntraOpNoteDto>(`/ip-management/journeys/${journeyId}/intra-op`, req);
      return r.data;
    } catch (e) {
      console.warn('[ip-management] saveIntraOpNote failed', e);
      return null;
    }
  },

  async signIntraOpNote(journeyId: string): Promise<IntraOpNoteDto | null> {
    try {
      const r = await getClient().post<IntraOpNoteDto>(`/ip-management/journeys/${journeyId}/intra-op/sign`, {});
      return r.data;
    } catch (e) {
      console.warn('[ip-management] signIntraOpNote failed', e);
      return null;
    }
  },

  async getIntraOpPresets(fieldName?: string): Promise<IntraOpPresetDto[]> {
    try {
      const params = fieldName ? `?fieldName=${fieldName}` : '';
      const r = await getClient().get<IntraOpPresetDto[]>(`/ip-management/intra-op-presets${params}`);
      return Array.isArray(r.data) ? r.data : [];
    } catch (e) {
      console.warn('[ip-management] getIntraOpPresets failed', e);
      return [];
    }
  },

  // ── Nurse Checklist ────────────────────────────────────────────────────────
  async getNurseChecklist(journeyId: string): Promise<{ items: ChecklistItemDto[]; responses: ChecklistResponseDto[] }> {
    try {
      const r = await getClient().get<{ items: ChecklistItemDto[]; responses: ChecklistResponseDto[] }>(`/ip-management/journeys/${journeyId}/nurse-checklist`);
      return { items: Array.isArray(r.data?.items) ? r.data.items : [], responses: Array.isArray(r.data?.responses) ? r.data.responses : [] };
    } catch (e) {
      console.warn('[ip-management] getNurseChecklist failed', e);
      return { items: [], responses: [] };
    }
  },

  async saveNurseChecklist(journeyId: string, req: ChecklistSaveRequest): Promise<boolean> {
    try {
      await getClient().post(`/ip-management/journeys/${journeyId}/nurse-checklist`, req);
      return true;
    } catch (e) {
      console.warn('[ip-management] saveNurseChecklist failed', e);
      return false;
    }
  },

  // ── Surgeon Checklist ──────────────────────────────────────────────────────
  async getSurgeonChecklist(journeyId: string): Promise<{ items: ChecklistItemDto[]; responses: ChecklistResponseDto[] }> {
    try {
      const r = await getClient().get<{ items: ChecklistItemDto[]; responses: ChecklistResponseDto[] }>(`/ip-management/journeys/${journeyId}/surgeon-checklist`);
      return { items: Array.isArray(r.data?.items) ? r.data.items : [], responses: Array.isArray(r.data?.responses) ? r.data.responses : [] };
    } catch (e) {
      console.warn('[ip-management] getSurgeonChecklist failed', e);
      return { items: [], responses: [] };
    }
  },

  async saveSurgeonChecklist(journeyId: string, req: ChecklistSaveRequest): Promise<boolean> {
    try {
      await getClient().post(`/ip-management/journeys/${journeyId}/surgeon-checklist`, req);
      return true;
    } catch (e) {
      console.warn('[ip-management] saveSurgeonChecklist failed', e);
      return false;
    }
  },

  // ── Post-Op Instructions ───────────────────────────────────────────────────
  async getPostOpInstructions(journeyId: string): Promise<PostOpInstructionDto | null> {
    try {
      const r = await getClient().get<PostOpInstructionDto>(`/ip-management/journeys/${journeyId}/post-op-instructions`);
      return r.data ?? null;
    } catch (e: unknown) {
      const status = (e as { response?: { status?: number } })?.response?.status;
      if (status === 404) return null;
      console.warn('[ip-management] getPostOpInstructions failed', e);
      return null;
    }
  },

  async savePostOpInstructions(journeyId: string, req: SavePostOpInstructionRequest): Promise<PostOpInstructionDto | null> {
    try {
      const r = await getClient().post<PostOpInstructionDto>(`/ip-management/journeys/${journeyId}/post-op-instructions`, req);
      return r.data;
    } catch (e: unknown) {
      throw new Error(formatApiError(e, 'Failed to save post-op instructions.'));
    }
  },

  async getPostOpTaper(journeyId: string): Promise<PostOpTaperDto | null> {
    try {
      const r = await getClient().get<PostOpTaperDto>(`/ip-management/journeys/${journeyId}/post-op/taper`);
      return r.data ?? { steps: [], history: [] };
    } catch (e: unknown) {
      const status = (e as { response?: { status?: number } })?.response?.status;
      if (status === 404) return { steps: [], history: [] };
      console.warn('[ip-management] getPostOpTaper failed', e);
      return null;
    }
  },

  async savePostOpTaper(journeyId: string, req: SavePostOpTaperRequest): Promise<PostOpTaperDto> {
    try {
      const r = await getClient().put<PostOpTaperDto>(`/ip-management/journeys/${journeyId}/post-op/taper`, req);
      return r.data;
    } catch (e: unknown) {
      throw new Error(formatApiError(e, 'Could not save the taper plan.'));
    }
  },

  // ── Discharge Summary ──────────────────────────────────────────────────────
  async getDischargeSummary(journeyId: string): Promise<DischargeSummaryDto | null> {
    try {
      const r = await getClient().get<DischargeSummaryDto>(`/ip-management/journeys/${journeyId}/discharge-summary`);
      return r.data;
    } catch (e) {
      console.warn('[ip-management] getDischargeSummary failed', e);
      return null;
    }
  },

  async saveDischargeSummary(journeyId: string, req: SaveDischargeSummaryRequest): Promise<DischargeSummaryDto | null> {
    try {
      const r = await getClient().post<DischargeSummaryDto>(`/ip-management/journeys/${journeyId}/discharge-summary`, req);
      return r.data;
    } catch (e) {
      console.warn('[ip-management] saveDischargeSummary failed', e);
      return null;
    }
  },

  async finalizeDischargeSummary(journeyId: string): Promise<DischargeSummaryDto | null> {
    try {
      const r = await getClient().post<DischargeSummaryDto>(`/ip-management/journeys/${journeyId}/discharge-summary/finalize`, {});
      return r.data;
    } catch (e) {
      console.warn('[ip-management] finalizeDischargeSummary failed', e);
      return null;
    }
  },

  // ── IOL Returns ────────────────────────────────────────────────────────────
  async getIolReturns(journeyId: string): Promise<IolReturnDto[]> {
    try {
      const r = await getClient().get<IolReturnDto[]>(`/ip-management/journeys/${journeyId}/iol-returns`);
      return Array.isArray(r.data) ? r.data : [];
    } catch (e) {
      console.warn('[ip-management] getIolReturns failed', e);
      return [];
    }
  },

  async recordIolReturn(journeyId: string, req: RecordIolReturnRequest): Promise<IolReturnDto | null> {
    try {
      const r = await getClient().post<IolReturnDto>(`/ip-management/journeys/${journeyId}/iol-returns`, req);
      return r.data;
    } catch (e) {
      console.warn('[ip-management] recordIolReturn failed', e);
      return null;
    }
  },

  // ── IOL Barcode Verification ─────────────────────────────────────────────────
  async verifyIolBarcode(journeyId: string, req: VerifyIolBarcodeRequest): Promise<VerifyIolBarcodeResponse | null> {
    try {
      const r = await getClient().post<VerifyIolBarcodeResponse>(`/ip-management/journeys/${journeyId}/verify-iol-barcode`, req);
      return r.data;
    } catch (e) {
      console.warn('[ip-management] verifyIolBarcode failed', e);
      return null;
    }
  },

  // ── Safety token / wristband (W-05 A5) ──────────────────────────────────────
  async getSafetyToken(journeyId: string): Promise<JourneySafetyTokenDto | null> {
    try {
      const r = await getClient().get<JourneySafetyTokenDto | null>(
        `/ip-management/journeys/${journeyId}/safety-token`,
        { validateStatus: s => s === 200 || s === 204 || s === 404 },
      );
      if (r.status === 204 || r.status === 404 || !r.data) return null;
      if (typeof r.data === 'object' && 'error' in r.data && !('tokenCode' in r.data)) return null;
      return r.data;
    } catch (e: unknown) {
      console.warn('[ip-management] getSafetyToken failed', e);
      throw new Error(formatApiError(e, 'Could not load wristband token.'));
    }
  },

  async issueSafetyToken(journeyId: string): Promise<JourneySafetyTokenDto> {
    try {
      const r = await getClient().post<JourneySafetyTokenDto>(`/ip-management/journeys/${journeyId}/safety-token`);
      if (!r.data?.tokenCode) {
        const body = r.data as unknown as { error?: string; message?: string } | null;
        throw new Error(body?.error || body?.message || 'Could not issue wristband token.');
      }
      return r.data;
    } catch (e) {
      throw new Error(formatApiError(e, 'Could not issue wristband token.'));
    }
  },

  async reprintSafetyToken(journeyId: string): Promise<JourneySafetyTokenDto> {
    try {
      const r = await getClient().post<JourneySafetyTokenDto>(`/ip-management/journeys/${journeyId}/safety-token/reprint`);
      return r.data;
    } catch (e) {
      throw new Error(formatApiError(e, 'Could not reprint wristband token.'));
    }
  },

  async listImplants(journeyId: string): Promise<ImplantUsageDto[]> {
    try {
      const r = await getClient().get<ImplantUsageDto[]>(`/ip-management/journeys/${journeyId}/implants`);
      return Array.isArray(r.data) ? r.data : [];
    } catch (e) {
      console.warn('[ip-management] listImplants failed', e);
      return [];
    }
  },

  async recordImplant(journeyId: string, req: RecordImplantRequest): Promise<ImplantUsageDto> {
    try {
      const r = await getClient().post<ImplantUsageDto>(`/ip-management/journeys/${journeyId}/implants`, req);
      return r.data;
    } catch (e) {
      const err = new Error(formatApiError(e, 'Could not record implant.')) as Error & { status?: number };
      if (axios.isAxiosError(e)) err.status = e.response?.status;
      throw err;
    }
  },

  async updateImplant(journeyId: string, usageId: string, req: UpdateImplantRequest): Promise<ImplantUsageDto> {
    try {
      const r = await getClient().patch<ImplantUsageDto>(`/ip-management/journeys/${journeyId}/implants/${usageId}`, req);
      return r.data;
    } catch (e) {
      throw new Error(formatApiError(e, 'Could not update implant.'));
    }
  },

  // ── Ward Stats / Beds ─────────────────────────────────────────────────────
  async getWardStats(branchId: string): Promise<WardStatsDto[]> {
    try {
      const r = await getClient().get<WardStatsDto[]>('/ip-management/wards/stats', { params: { branchId } });
      return Array.isArray(r.data) ? r.data : [];
    } catch (e) {
      console.warn('[ip-management] getWardStats failed', e);
      return [];
    }
  },

  async getBedAvailability(wardId: string): Promise<WardBedDto[]> {
    try {
      const r = await getClient().get<WardBedDto[]>(`/ip-management/wards/${wardId}/beds`);
      return Array.isArray(r.data) ? r.data : [];
    } catch (e) {
      console.warn('[ip-management] getBedAvailability failed', e);
      return [];
    }
  },

  // ── Vital Signs ────────────────────────────────────────────────────────────
  async getVitals(journeyId: string): Promise<VitalSignDto[]> {
    try {
      const r = await getClient().get<VitalSignDto[]>(`/ip-management/journeys/${journeyId}/vitals`);
      return Array.isArray(r.data) ? r.data : [];
    } catch (e) {
      console.warn('[ip-management] getVitals failed', e);
      return [];
    }
  },

  async addVital(journeyId: string, req: AddVitalSignRequest): Promise<VitalSignDto | null> {
    try {
      const r = await getClient().post<VitalSignDto>(`/ip-management/journeys/${journeyId}/vitals`, req);
      return r.data;
    } catch (e) {
      console.warn('[ip-management] addVital failed', e);
      return null;
    }
  },

  // ── Nurse Records ──────────────────────────────────────────────────────────
  async getNurseRecords(journeyId: string): Promise<NurseRecordDto[]> {
    try {
      const r = await getClient().get<NurseRecordDto[]>(`/ip-management/journeys/${journeyId}/nurse-records`);
      return Array.isArray(r.data) ? r.data : [];
    } catch (e) {
      console.warn('[ip-management] getNurseRecords failed', e);
      return [];
    }
  },

  async addNurseRecord(journeyId: string, req: AddNurseRecordRequest): Promise<NurseRecordDto | null> {
    try {
      const r = await getClient().post<NurseRecordDto>(`/ip-management/journeys/${journeyId}/nurse-records`, req);
      return r.data;
    } catch (e) {
      console.warn('[ip-management] addNurseRecord failed', e);
      return null;
    }
  },

  async updateVital(journeyId: string, vitalId: string, req: UpdateVitalSignRequest): Promise<VitalSignDto | null> {
    try {
      const r = await getClient().patch<VitalSignDto>(`/ip-management/journeys/${journeyId}/vitals/${vitalId}`, req);
      return r.data;
    } catch (e) {
      console.warn('[ip-management] updateVital failed', e);
      return null;
    }
  },

  async updateNurseRecord(journeyId: string, recordId: string, req: UpdateNurseRecordRequest): Promise<NurseRecordDto | null> {
    try {
      const r = await getClient().patch<NurseRecordDto>(`/ip-management/journeys/${journeyId}/nurse-records/${recordId}`, req);
      return r.data;
    } catch (e) {
      console.warn('[ip-management] updateNurseRecord failed', e);
      return null;
    }
  },

  async getMasterMedications(): Promise<OphthMedicationDto[]> {
    try {
      const r = await getClient().get<OphthMedicationDto[]>('/ip-management/master/medications');
      return Array.isArray(r.data) ? r.data : [];
    } catch (e) {
      console.warn('[ip-management] getMasterMedications failed', e);
      return [];
    }
  },

  async getIoTypes(): Promise<IpIoTypeDto[]> {
    try {
      const r = await getClient().get<IpIoTypeDto[]>('/ip-management/master/io-types');
      return Array.isArray(r.data) ? r.data : [];
    } catch (e) {
      console.warn('[ip-management] getIoTypes failed', e);
      return [];
    }
  },

  // ── Surgery Note Templates ─────────────────────────────────────────────────
  async getSurgeryNoteTemplates(): Promise<SurgeryNoteTemplateDto[]> {
    try {
      const r = await getClient().get<SurgeryNoteTemplateDto[]>('/ip-management/surgery-note-templates');
      return Array.isArray(r.data) ? r.data : [];
    } catch (e) {
      console.warn('[ip-management] getSurgeryNoteTemplates failed', e);
      return [];
    }
  },

  async addSurgeryNoteTemplate(req: AddSurgeryNoteTemplateRequest): Promise<SurgeryNoteTemplateDto | null> {
    try {
      const r = await getClient().post<SurgeryNoteTemplateDto>('/ip-management/surgery-note-templates', req);
      return r.data;
    } catch (e) {
      console.warn('[ip-management] addSurgeryNoteTemplate failed', e);
      return null;
    }
  },

  async deleteSurgeryNoteTemplate(id: string): Promise<boolean> {
    try {
      await getClient().delete(`/ip-management/surgery-note-templates/${id}`);
      return true;
    } catch (e) {
      console.warn('[ip-management] deleteSurgeryNoteTemplate failed', e);
      return false;
    }
  },

  // ── Pre-Op Clearance ───────────────────────────────────────────────────────
  async getPreOpSectionItems(paymentMode?: string): Promise<PreOpSectionItemDto[]> {
    try {
      const r = await getClient().get<PreOpSectionItemDto[]>('/ip-management/pre-op/section-items', {
        params: paymentMode ? { paymentMode } : undefined,
      });
      return Array.isArray(r.data) ? r.data : [];
    } catch (e) {
      console.warn('[ip-management] getPreOpSectionItems failed', e);
      return [];
    }
  },

  async initPreOpClearance(
    journeyId: string, req: InitPreOpClearanceRequest
  ): Promise<PreOpClearanceDto | null> {
    try {
      const r = await getClient().post<PreOpClearanceDto>(
        `/ip-management/journeys/${journeyId}/pre-op/clearance/init`, req);
      return r.data;
    } catch (e) {
      console.warn('[ip-management] initPreOpClearance failed', e);
      return null;
    }
  },

  async getPreOpClearance(journeyId: string): Promise<PreOpClearanceDetailDto | null> {
    try {
      const r = await getClient().get<PreOpClearanceDetailDto>(
        `/ip-management/journeys/${journeyId}/pre-op/clearance`);
      return r.data;
    } catch (e) {
      console.warn('[ip-management] getPreOpClearance failed', e);
      return null;
    }
  },

  /** Server-authoritative readiness rollup (Phase 8) — powers modal + ward list. */
  async getPreOpReadiness(
    journeyId: string,
    paymentMode?: string,
  ): Promise<unknown> {
    try {
      const r = await getClient().get(
        `/ip-management/journeys/${journeyId}/pre-op/readiness`,
        { params: paymentMode ? { paymentMode } : undefined },
      );
      return r.data;
    } catch (e) {
      console.warn('[ip-management] getPreOpReadiness failed', e);
      return null;
    }
  },

  async savePreOpCompletion(
    journeyId: string, itemId: string, req: SavePreOpCompletionRequest
  ): Promise<PreOpCompletionDto | null> {
    try {
      const r = await getClient().post<PreOpCompletionDto>(
        `/ip-management/journeys/${journeyId}/pre-op/completions/${itemId}`, req);
      return r.data;
    } catch (e) {
      console.warn('[ip-management] savePreOpCompletion failed', e);
      return null;
    }
  },

  async notifyClinicalEvaluationMaterialChange(
    journeyId: string,
    payload: {
      changeType: 'iol_changed' | 'diagnosis_overridden';
      previousIolId?: string | null;
      newIolId?: string | null;
      reason?: string;
      inOt?: boolean;
    },
  ): Promise<void> {
    try {
      await getClient().post(
        `/ip-management/journeys/${journeyId}/pre-op/clinical-evaluation/notify`,
        payload,
      );
    } catch (e) {
      console.warn('[ip-management] notifyClinicalEvaluationMaterialChange failed', e);
    }
  },

  async amendClinicalEvaluation(
    journeyId: string,
    payload: { reason: string; category: string; inOt?: boolean },
  ): Promise<PreOpClearanceDetailDto | null> {
    try {
      const r = await getClient().post<PreOpClearanceDetailDto>(
        `/ip-management/journeys/${journeyId}/pre-op/clinical-evaluation/amend`,
        payload,
      );
      return r.data;
    } catch (e) {
      console.warn('[ip-management] amendClinicalEvaluation failed', e);
      return null;
    }
  },

  async captureConsent(
    journeyId: string, itemId: string, req: CaptureConsentRequest
  ): Promise<PreOpClearanceDetailDto> {
    const r = await getClient().post<PreOpClearanceDetailDto>(
      `/ip-management/journeys/${journeyId}/pre-op/consent/${itemId}/capture`, req);
    return r.data;
  },

  async revokeConsent(
    journeyId: string, itemId: string, req: RevokeConsentRequest
  ): Promise<PreOpClearanceDetailDto> {
    const r = await getClient().post<PreOpClearanceDetailDto>(
      `/ip-management/journeys/${journeyId}/pre-op/consent/${itemId}/revoke`, req);
    return r.data;
  },

  async getPreauthStatus(journeyId: string): Promise<PreauthStatusDto | null> {
    try {
      const r = await getClient().get<PreauthStatusDto>(
        `/ip-management/journeys/${journeyId}/financial/preauth-status`);
      return r.data;
    } catch (e) {
      console.warn('[ip-management] getPreauthStatus failed', e);
      return null;
    }
  },

  async listProgressNotes(journeyId: string) {
    const r = await getClient().get(`/ip-management/journeys/${journeyId}/progress-notes`);
    return Array.isArray(r.data) ? r.data : [];
  },

  async addProgressNote(journeyId: string, note: string) {
    const r = await getClient().post(`/ip-management/journeys/${journeyId}/progress-notes`, { note });
    return r.data;
  },

  async setDischargePlanning(journeyId: string, ready: boolean) {
    const r = await getClient().post(`/ip-management/journeys/${journeyId}/discharge-planning`, { ready });
    return r.data;
  },

  async batchSavePreOpCompletions(
    journeyId: string, req: BatchSavePreOpCompletionsRequest
  ): Promise<PreOpCompletionDto[]> {
    try {
      const r = await getClient().post<PreOpCompletionDto[]>(
        `/ip-management/journeys/${journeyId}/pre-op/completions/batch`, req);
      return Array.isArray(r.data) ? r.data : [];
    } catch (e) {
      console.warn('[ip-management] batchSavePreOpCompletions failed', e);
      return [];
    }
  },

  async addPreOpVital(journeyId: string, req: AddPreOpVitalRequest): Promise<VitalSignDto | null> {
    try {
      const r = await getClient().post<VitalSignDto>(
        `/ip-management/journeys/${journeyId}/pre-op/vitals`, req);
      return r.data;
    } catch (e) {
      console.warn('[ip-management] addPreOpVital failed', e);
      return null;
    }
  },

  async uploadPreOpDocument(
    journeyId: string, req: UploadPreOpDocumentRequest
  ): Promise<PreOpDocumentDto | null> {
    try {
      const r = await getClient().post<PreOpDocumentDto>(
        `/ip-management/journeys/${journeyId}/pre-op/documents`, req);
      return r.data;
    } catch (e) {
      console.warn('[ip-management] uploadPreOpDocument failed', e);
      return null;
    }
  },

  async verifyPreOpDocument(
    journeyId: string, docId: string, req: VerifyPreOpDocumentRequest
  ): Promise<PreOpDocumentDto | null> {
    try {
      const r = await getClient().post<PreOpDocumentDto>(
        `/ip-management/journeys/${journeyId}/pre-op/documents/${docId}/verify`, req);
      return r.data;
    } catch (e) {
      console.warn('[ip-management] verifyPreOpDocument failed', e);
      return null;
    }
  },

  async approvePreOpClearance(
    journeyId: string, req: ApprovePreOpClearanceRequest
  ): Promise<PreOpClearanceDto | null> {
    try {
      const r = await getClient().post<PreOpClearanceDto>(
        `/ip-management/journeys/${journeyId}/pre-op/clearance/approve`, req);
      return r.data;
    } catch (e) {
      console.warn('[ip-management] approvePreOpClearance failed', e);
      return null;
    }
  },

  async deferPreOpClearance(
    journeyId: string, req: DeferPreOpClearanceRequest
  ): Promise<PreOpClearanceDto | null> {
    try {
      const r = await getClient().post<PreOpClearanceDto>(
        `/ip-management/journeys/${journeyId}/pre-op/clearance/defer`, req);
      return r.data;
    } catch (e) {
      console.warn('[ip-management] deferPreOpClearance failed', e);
      return null;
    }
  },

  // ── Pre-Op Section Clearance (dept coordination) ──────────────────────────
  async requestSection(
    journeyId: string, category: string, urgency = 'Normal'
  ): Promise<PreOpSectionClearanceDto | null> {
    try {
      const r = await getClient().post<PreOpSectionClearanceDto>(
        `/ip-management/journeys/${journeyId}/pre-op/sections/${category}/request`,
        { urgency });
      return r.data;
    } catch (e) {
      console.warn('[ip-management] requestSection failed', e);
      return null;
    }
  },

  async respondToSection(
    journeyId: string, category: string, req: RespondToSectionRequest
  ): Promise<PreOpSectionClearanceDto | null> {
    try {
      const r = await getClient().post<PreOpSectionClearanceDto>(
        `/ip-management/journeys/${journeyId}/pre-op/sections/${category}/respond`, req);
      return r.data;
    } catch (e) {
      console.warn('[ip-management] respondToSection failed', e);
      return null;
    }
  },

  async confirmSection(
    journeyId: string, category: string, req: ConfirmSectionRequest
  ): Promise<PreOpSectionClearanceDto | null> {
    try {
      const r = await getClient().post<PreOpSectionClearanceDto>(
        `/ip-management/journeys/${journeyId}/pre-op/sections/${category}/confirm`, req);
      return r.data;
    } catch (e) {
      console.warn('[ip-management] confirmSection failed', e);
      return null;
    }
  },

  async putSectionOnHold(
    journeyId: string, category: string, req: PutSectionOnHoldRequest
  ): Promise<PreOpSectionClearanceDto | null> {
    try {
      const r = await getClient().post<PreOpSectionClearanceDto>(
        `/ip-management/journeys/${journeyId}/pre-op/sections/${category}/hold`, req);
      return r.data;
    } catch (e) {
      console.warn('[ip-management] putSectionOnHold failed', e);
      return null;
    }
  },

  async rejectSection(
    journeyId: string, category: string, req: RejectSectionRequest
  ): Promise<PreOpSectionClearanceDto | null> {
    try {
      const r = await getClient().post<PreOpSectionClearanceDto>(
        `/ip-management/journeys/${journeyId}/pre-op/sections/${category}/reject`, req);
      return r.data;
    } catch (e) {
      console.warn('[ip-management] rejectSection failed', e);
      return null;
    }
  },

  async requestMoreInfo(
    journeyId: string, category: string, req: RequestMoreInfoRequest
  ): Promise<PreOpSectionClearanceDto | null> {
    try {
      const r = await getClient().post<PreOpSectionClearanceDto>(
        `/ip-management/journeys/${journeyId}/pre-op/sections/${category}/needs-info`, req);
      return r.data;
    } catch (e) {
      console.warn('[ip-management] requestMoreInfo failed', e);
      return null;
    }
  },

  async escalateSection(
    journeyId: string, category: string, req: EscalateSectionRequest
  ): Promise<PreOpSectionClearanceDto | null> {
    try {
      const r = await getClient().post<PreOpSectionClearanceDto>(
        `/ip-management/journeys/${journeyId}/pre-op/sections/${category}/escalate`, req);
      return r.data;
    } catch (e) {
      console.warn('[ip-management] escalateSection failed', e);
      return null;
    }
  },

  // ── IOL Catalog ───────────────────────────────────────────────────────────
  async getIolCatalog(): Promise<IolCatalogItemDto[]> {
    try {
      const r = await getClient().get<IolCatalogItemDto[]>('/ip-management/iol-catalog');
      return Array.isArray(r.data) ? r.data : [];
    } catch (e) {
      console.warn('[ip-management] getIolCatalog failed', e);
      return [];
    }
  },

  // ── Ward Checklist (S1 — Form 2) ──────────────────────────────────────────
  async getWardChecklist(journeyId: string, paymentMode?: string): Promise<WardChecklistDto | null> {
    try {
      const params = paymentMode ? { paymentMode } : undefined;
      const r = await getClient().get<WardChecklistDto>(
        `/ip-management/journeys/${journeyId}/ward-checklist`,
        { params },
      );
      return r.data;
    } catch (e) {
      console.warn('[ip-management] getWardChecklist failed', e);
      return null;
    }
  },

  async getWardInvestigationChecklist(journeyId: string): Promise<WardInvestigationChecklistDto | null> {
    try {
      const r = await getClient().get<WardInvestigationChecklistDto>(
        `/ip-management/journeys/${journeyId}/ward-investigation-checklist`,
      );
      return normalizeWardInvestigationChecklist(r.data);
    } catch (e) {
      console.warn('[ip-management] getWardInvestigationChecklist failed', e);
      return null;
    }
  },

  async saveWardInvestigationCompletion(
    journeyId: string,
    itemId: string,
    req: SaveWardChecklistCompletionRequest,
  ): Promise<WardInvestigationChecklistDto | null> {
    try {
      const r = await getClient().post<WardInvestigationChecklistDto>(
        `/ip-management/journeys/${journeyId}/ward-investigation-checklist/completions/${itemId}`,
        req,
      );
      return normalizeWardInvestigationChecklist(r.data);
    } catch (e) {
      console.warn('[ip-management] saveWardInvestigationCompletion failed', e);
      return null;
    }
  },

  async saveWardInvestigationResult(
    journeyId: string,
    itemId: string,
    req: SaveWardInvestigationResultRequest,
  ): Promise<WardInvestigationChecklistDto | null> {
    try {
      const r = await getClient().put<WardInvestigationChecklistDto>(
        `/ip-management/journeys/${journeyId}/ward-investigation-checklist/completions/${itemId}/result`,
        req,
      );
      return normalizeWardInvestigationChecklist(r.data);
    } catch (e) {
      console.warn('[ip-management] saveWardInvestigationResult failed', e);
      return null;
    }
  },

  async verifyWardInvestigation(
    journeyId: string,
    itemId: string,
    req: VerifyWardInvestigationRequest = {},
  ): Promise<WardInvestigationChecklistDto | null> {
    try {
      const r = await getClient().post<WardInvestigationChecklistDto>(
        `/ip-management/journeys/${journeyId}/ward-investigation-checklist/completions/${itemId}/verify`,
        req,
      );
      return normalizeWardInvestigationChecklist(r.data);
    } catch (e) {
      console.warn('[ip-management] verifyWardInvestigation failed', e);
      return null;
    }
  },

  async uploadWardInvestigationDocument(
    journeyId: string,
    itemId: string,
    req: UploadInvestigationDocumentRequest,
  ): Promise<WardInvestigationChecklistDto | null> {
    try {
      const r = await getClient().post<WardInvestigationChecklistDto>(
        `/ip-management/journeys/${journeyId}/ward-investigation-checklist/completions/${itemId}/document`,
        req,
      );
      return normalizeWardInvestigationChecklist(r.data);
    } catch (e) {
      console.warn('[ip-management] uploadWardInvestigationDocument failed', e);
      return null;
    }
  },

  async getWardInvestigationDocument(
    journeyId: string,
    itemId: string,
  ): Promise<InvestigationDocumentDto | null> {
    try {
      const r = await getClient().get<InvestigationDocumentDto>(
        `/ip-management/journeys/${journeyId}/ward-investigation-checklist/completions/${itemId}/document`,
      );
      return r.data;
    } catch (e) {
      console.warn('[ip-management] getWardInvestigationDocument failed', e);
      return null;
    }
  },

  async getWardInvestigationSummary(journeyId: string): Promise<WardInvestigationSummaryDto | null> {
    try {
      const r = await getClient().get<WardInvestigationSummaryDto>(
        `/ip-management/journeys/${journeyId}/ward-investigation-checklist/summary`,
      );
      return r.data;
    } catch (e) {
      console.warn('[ip-management] getWardInvestigationSummary failed', e);
      return null;
    }
  },

  async saveWardChecklistCompletion(
    journeyId: string,
    itemId: string,
    req: SaveWardChecklistCompletionRequest,
  ): Promise<WardChecklistDto | null> {
    try {
      const r = await getClient().post<WardChecklistDto>(
        `/ip-management/journeys/${journeyId}/ward-checklist/completions/${itemId}`,
        req,
      );
      return r.data;
    } catch (e) {
      console.warn('[ip-management] saveWardChecklistCompletion failed', e);
      return null;
    }
  },

  // ── Medication Log (S2 — Form 4 pre-op) ───────────────────────────────────
  async getMedicationLog(journeyId: string): Promise<MedicationLogDto | null> {
    try {
      const r = await getClient().get<MedicationLogDto>(
        `/ip-management/journeys/${journeyId}/medication-log`,
      );
      return r.data;
    } catch (e) {
      console.warn('[ip-management] getMedicationLog failed', e);
      return null;
    }
  },

  async updateMedicationLogMeta(
    journeyId: string,
    req: UpdateMedicationLogMetaRequest,
  ): Promise<MedicationLogDto | null> {
    try {
      const r = await getClient().put<MedicationLogDto>(
        `/ip-management/journeys/${journeyId}/medication-log/meta`,
        req,
      );
      return r.data;
    } catch (e) {
      console.warn('[ip-management] updateMedicationLogMeta failed', e);
      return null;
    }
  },

  async addMedicationDrug(
    journeyId: string,
    req: AddMedicationDrugRequest,
  ): Promise<MedicationLogDto | null> {
    try {
      const r = await getClient().post<MedicationLogDto>(
        `/ip-management/journeys/${journeyId}/medication-log/drugs`,
        req,
      );
      return r.data;
    } catch (e) {
      console.warn('[ip-management] addMedicationDrug failed', e);
      return null;
    }
  },

  async saveMedicationDose(
    journeyId: string,
    doseId: string,
    req: SaveMedicationDoseRequest,
  ): Promise<MedicationLogDto | null> {
    try {
      const r = await getClient().post<MedicationLogDto>(
        `/ip-management/journeys/${journeyId}/medication-log/doses/${doseId}`,
        req,
      );
      return r.data;
    } catch (e) {
      console.warn('[ip-management] saveMedicationDose failed', e);
      return null;
    }
  },

  async removeMedicationDrug(
    journeyId: string,
    medicineName: string,
  ): Promise<MedicationLogDto | null> {
    try {
      const r = await getClient().delete<MedicationLogDto>(
        `/ip-management/journeys/${journeyId}/medication-log/drugs/${encodeURIComponent(medicineName)}`,
      );
      return r.data;
    } catch (e) {
      console.warn('[ip-management] removeMedicationDrug failed', e);
      return null;
    }
  },

  // ── Ward Post-Op Checklist (S2 — Form 4 post-op) ──────────────────────────
  async getWardPostOpChecklist(journeyId: string): Promise<WardPostOpChecklistDto | null> {
    try {
      const r = await getClient().get<WardPostOpChecklistDto>(
        `/ip-management/journeys/${journeyId}/ward-postop-checklist`,
      );
      return r.data;
    } catch (e) {
      console.warn('[ip-management] getWardPostOpChecklist failed', e);
      return null;
    }
  },

  async saveWardPostOpCompletion(
    journeyId: string,
    itemId: string,
    req: SaveWardPostOpCompletionRequest,
  ): Promise<WardPostOpChecklistDto | null> {
    try {
      const r = await getClient().post<WardPostOpChecklistDto>(
        `/ip-management/journeys/${journeyId}/ward-postop-checklist/completions/${itemId}`,
        req,
      );
      return r.data;
    } catch (e) {
      console.warn('[ip-management] saveWardPostOpCompletion failed', e);
      return null;
    }
  },

  async saveIolStickerChecks(
    journeyId: string,
    req: IolStickerChecksDto,
  ): Promise<WardPostOpChecklistDto | null> {
    try {
      const r = await getClient().put<WardPostOpChecklistDto>(
        `/ip-management/journeys/${journeyId}/ward-postop-checklist/iol-sticker`,
        req,
      );
      return r.data;
    } catch (e) {
      console.warn('[ip-management] saveIolStickerChecks failed', e);
      return null;
    }
  },

  // ── OT Surgical Safety (S3 — Form 1 OT) ────────────────────────────────────
  async getSurgicalSafetyChecklist(journeyId: string): Promise<SurgicalSafetyChecklistDto | null> {
    try {
      const r = await getClient().get<SurgicalSafetyChecklistDto>(
        `/ip-management/journeys/${journeyId}/surgical-safety`,
      );
      return normalizeSurgicalSafetyChecklist(r.data);
    } catch (e) {
      console.warn('[ip-management] getSurgicalSafetyChecklist failed', e);
      return null;
    }
  },

  async saveBeforeAnaesthesia(
    journeyId: string,
    req: SaveBeforeAnaesthesiaRequest,
  ): Promise<SurgicalSafetyChecklistDto | null> {
    try {
      const r = await getClient().put<SurgicalSafetyChecklistDto>(
        `/ip-management/journeys/${journeyId}/surgical-safety/before-anaesthesia`,
        req,
      );
      return normalizeSurgicalSafetyChecklist(r.data);
    } catch (e) {
      console.warn('[ip-management] saveBeforeAnaesthesia failed', e);
      return null;
    }
  },

  async saveWhoTimeout(
    journeyId: string,
    req: SaveWhoTimeoutRequest,
  ): Promise<SurgicalSafetyChecklistDto | null> {
    try {
      const r = await getClient().put<SurgicalSafetyChecklistDto>(
        `/ip-management/journeys/${journeyId}/surgical-safety/who-timeout`,
        req,
      );
      return normalizeSurgicalSafetyChecklist(r.data);
    } catch (e) {
      console.warn('[ip-management] saveWhoTimeout failed', e);
      return null;
    }
  },

  async saveAfterSurgery(
    journeyId: string,
    req: SaveAfterSurgeryRequest,
  ): Promise<SurgicalSafetyChecklistDto | null> {
    try {
      const r = await getClient().put<SurgicalSafetyChecklistDto>(
        `/ip-management/journeys/${journeyId}/surgical-safety/after-surgery`,
        req,
      );
      return normalizeSurgicalSafetyChecklist(r.data);
    } catch (e) {
      console.warn('[ip-management] saveAfterSurgery failed', e);
      return null;
    }
  },

  // ── PAC Assessment (S4 — Form 3) ───────────────────────────────────────────
  async getPacAssessment(journeyId: string): Promise<PacAssessmentDto | null> {
    try {
      const r = await getClient().get<PacAssessmentDto>(
        `/ip-management/journeys/${journeyId}/pac-assessment`,
      );
      return normalizePacAssessment(r.data);
    } catch (e) {
      console.warn('[ip-management] getPacAssessment failed', e);
      return null;
    }
  },

  async savePacAssessment(
    journeyId: string,
    req: SavePacAssessmentRequest,
  ): Promise<ApiMutationResult<PacAssessmentDto>> {
    try {
      const r = await getClient().put<PacAssessmentDto>(
        `/ip-management/journeys/${journeyId}/pac-assessment`,
        req,
      );
      return { data: normalizePacAssessment(r.data) };
    } catch (e) {
      const error = formatApiError(e, 'Failed to save PAC assessment');
      console.warn('[ip-management] savePacAssessment failed', e);
      return { data: null, error };
    }
  },

  async completePacAssessment(
    journeyId: string,
  ): Promise<ApiMutationResult<CompletePacAssessmentResultDto>> {
    try {
      const r = await getClient().post<CompletePacAssessmentResultDto>(
        `/ip-management/journeys/${journeyId}/pac-assessment/complete`,
      );
      if (!r.data) return { data: null, error: 'Empty response from server' };
      return {
        data: {
          assessment: normalizePacAssessment(r.data.assessment),
          unverifiedCriticalWarnings: r.data.unverifiedCriticalWarnings ?? [],
        },
      };
    } catch (e) {
      const error = formatApiError(e, 'Failed to complete PAC assessment');
      console.warn('[ip-management] completePacAssessment failed', e);
      return { data: null, error };
    }
  },

  // ── Anaesthesia Monitoring (S4 — Form 5) ───────────────────────────────────
  async getAnaesthesiaMonitoring(journeyId: string): Promise<AnaesthesiaMonitoringDto | null> {
    try {
      const r = await getClient().get<AnaesthesiaMonitoringDto>(
        `/ip-management/journeys/${journeyId}/anaesthesia-monitoring`,
      );
      return normalizeAnaesthesiaMonitoring(r.data);
    } catch (e) {
      console.warn('[ip-management] getAnaesthesiaMonitoring failed', e);
      return null;
    }
  },

  async savePreOpReview(
    journeyId: string,
    req: SavePreOpReviewRequest,
  ): Promise<AnaesthesiaMonitoringDto | null> {
    try {
      const r = await getClient().put<AnaesthesiaMonitoringDto>(
        `/ip-management/journeys/${journeyId}/anaesthesia-monitoring/pre-op-review`,
        req,
      );
      return normalizeAnaesthesiaMonitoring(r.data);
    } catch (e) {
      console.warn('[ip-management] savePreOpReview failed', e);
      return null;
    }
  },

  async addMonitoringReading(
    journeyId: string,
    req: SaveMonitoringReadingRequest,
  ): Promise<AnaesthesiaMonitoringDto | null> {
    try {
      const r = await getClient().post<AnaesthesiaMonitoringDto>(
        `/ip-management/journeys/${journeyId}/anaesthesia-monitoring/readings`,
        req,
      );
      return normalizeAnaesthesiaMonitoring(r.data);
    } catch (e) {
      console.warn('[ip-management] addMonitoringReading failed', e);
      return null;
    }
  },

  async updateMonitoringReading(
    journeyId: string,
    readingId: string,
    req: UpdateMonitoringReadingRequest,
  ): Promise<AnaesthesiaMonitoringDto | null> {
    try {
      const r = await getClient().put<AnaesthesiaMonitoringDto>(
        `/ip-management/journeys/${journeyId}/anaesthesia-monitoring/readings/${readingId}`,
        req,
      );
      return normalizeAnaesthesiaMonitoring(r.data);
    } catch (e) {
      console.warn('[ip-management] updateMonitoringReading failed', e);
      return null;
    }
  },

  async removeMonitoringReading(
    journeyId: string,
    readingId: string,
  ): Promise<AnaesthesiaMonitoringDto | null> {
    try {
      const r = await getClient().delete<AnaesthesiaMonitoringDto>(
        `/ip-management/journeys/${journeyId}/anaesthesia-monitoring/readings/${readingId}`,
      );
      return normalizeAnaesthesiaMonitoring(r.data);
    } catch (e) {
      console.warn('[ip-management] removeMonitoringReading failed', e);
      return null;
    }
  },

  async saveDischargeClearance(
    journeyId: string,
    req: SaveDischargeClearanceRequest,
  ): Promise<AnaesthesiaMonitoringDto | null> {
    try {
      const r = await getClient().put<AnaesthesiaMonitoringDto>(
        `/ip-management/journeys/${journeyId}/anaesthesia-monitoring/discharge-clearance`,
        req,
      );
      return normalizeAnaesthesiaMonitoring(r.data);
    } catch (e) {
      console.warn('[ip-management] saveDischargeClearance failed', e);
      return null;
    }
  },

  // ── Counsellor Outpatient Safety Checklist (S0) ───────────────────────────
  async getCounsellorOutpatientChecklist(sessionId: string): Promise<CounsellorOutpatientChecklistDto | null> {
    try {
      const r = await getClient().get<CounsellorOutpatientChecklistDto>(
        `/ip-management/counsellor/sessions/${sessionId}/outpatient-checklist`);
      return r.data;
    } catch (e) {
      console.warn('[ip-management] getCounsellorOutpatientChecklist failed', e);
      return null;
    }
  },

  async saveCounsellorOutpatientCompletion(
    sessionId: string,
    itemId: string,
    req: SaveCounsellorCompletionRequest,
  ): Promise<CounsellorOutpatientChecklistDto | null> {
    try {
      const r = await getClient().post<CounsellorOutpatientChecklistDto>(
        `/ip-management/counsellor/sessions/${sessionId}/outpatient-checklist/completions/${itemId}`,
        req);
      return r.data;
    } catch (e) {
      console.warn('[ip-management] saveCounsellorOutpatientCompletion failed', e);
      return null;
    }
  },

  async getCounsellorPreOpInvestigations(
    sessionId: string,
  ): Promise<CounsellorPreOpInvestigationChecklistDto | null> {
    try {
      const r = await getClient().get<CounsellorPreOpInvestigationChecklistDto>(
        `/ip-management/counsellor/sessions/${sessionId}/pre-op-investigations`);
      return r.data;
    } catch (e) {
      console.warn('[ip-management] getCounsellorPreOpInvestigations failed', e);
      return null;
    }
  },

  async saveCounsellorPreOpInvestigationResult(
    sessionId: string,
    itemId: string,
    req: SaveCounsellorInvestigationResultRequest,
  ): Promise<CounsellorPreOpInvestigationChecklistDto | null> {
    try {
      const r = await getClient().post<CounsellorPreOpInvestigationChecklistDto>(
        `/ip-management/counsellor/sessions/${sessionId}/pre-op-investigations/${itemId}`,
        req);
      return r.data;
    } catch (e) {
      console.warn('[ip-management] saveCounsellorPreOpInvestigationResult failed', e);
      return null;
    }
  },

  // ── Audit Log ──────────────────────────────────────────────────────────────
  async getJourneyAudit(journeyId: string): Promise<JourneyAuditLogDto[]> {
    try {
      const r = await getClient().get<JourneyAuditLogDto[]>(`/ip-management/journeys/${journeyId}/audit`);
      return Array.isArray(r.data)
        ? r.data.map(row => normalizeJourneyAuditLog(row as JourneyAuditLogDto & Record<string, unknown>, journeyId))
        : [];
    } catch (e) {
      console.warn('[ip-management] getJourneyAudit failed', e);
      return [];
    }
  },

  /**
   * Ward board load: journeys + wards in one shot. Throws so the page can show retry UI.
   */
  async fetchWardData(branchId: string): Promise<{
    journeys: PatientJourneyRowDto[];
    wards: WardDto[];
  }> {
    const params = { branchId };
    const [journeyRes, wardRes] = await Promise.all([
      getClient().get<PatientJourneyRowDto[]>('/ip-management/journeys', { params }),
      getClient().get<WardDto[]>('/ip-management/wards', { params }),
    ]);
    return {
      journeys: Array.isArray(journeyRes.data) ? journeyRes.data : [],
      wards: Array.isArray(wardRes.data) ? wardRes.data : [],
    };
  },

  async fetchWardDashboardSummary(
    branchId: string,
    date?: string,
  ): Promise<WardDashboardSummaryDto | null> {
    const params: Record<string, string> = { branchId };
    if (date) params.date = date;
    const res = await getClient().get<WardDashboardSummaryDto>(
      '/ip-management/journeys/dashboard-summary',
      { params },
    );
    return res.data ?? null;
  },

  async getOutboxHealth(): Promise<Record<string, unknown>> {
    try {
      const r = await getClient().get('/ip-management/integration/outbox/health');
      return (r.data ?? {}) as Record<string, unknown>;
    } catch (e) {
      throw new Error(formatApiError(e, 'Could not load IP outbox stats.'));
    }
  },

  async listOutboxDead(): Promise<import('../billing/integration-health').OutboxDeadLetter[]> {
    try {
      const r = await getClient().get('/ip-management/integration/outbox/dead');
      return Array.isArray(r.data) ? r.data : [];
    } catch (e) {
      throw new Error(formatApiError(e, 'Could not load IP dead letters.'));
    }
  },

  async getOutboxEvent(eventId: string): Promise<import('../billing/integration-health').OutboxEventDetail> {
    try {
      const r = await getClient().get(`/ip-management/integration/outbox/events/${eventId}`);
      return r.data;
    } catch (e) {
      throw new Error(formatApiError(e, 'Could not load outbox event.'));
    }
  },

  async requeueOutbox(eventIds: string[], eventType?: string): Promise<number> {
    try {
      const r = await getClient().post('/ip-management/integration/outbox/requeue', { eventIds, eventType });
      return Number(r.data?.requeued ?? 0);
    } catch (e) {
      throw new Error(formatApiError(e, 'Could not requeue outbox events.'));
    }
  },

  async abandonOutbox(eventId: string, reason: string, compensatingAction?: string): Promise<void> {
    try {
      await getClient().post('/ip-management/integration/outbox/abandon', {
        eventId,
        reason,
        compensatingAction,
      });
    } catch (e) {
      throw new Error(formatApiError(e, 'Could not abandon outbox event.'));
    }
  },
};

/** @deprecated Use ipManagementApi.fetchWardData — kept for existing imports. */
export async function fetchWardData(branchId: string): Promise<{
  journeys: PatientJourneyRowDto[];
  wards: WardDto[];
}> {
  return ipManagementApi.fetchWardData(branchId);
}

/** @deprecated Use ipManagementApi.fetchWardDashboardSummary — kept for existing imports. */
export async function fetchWardDashboardSummary(
  branchId: string,
  date?: string,
): Promise<WardDashboardSummaryDto | null> {
  return ipManagementApi.fetchWardDashboardSummary(branchId, date);
}
