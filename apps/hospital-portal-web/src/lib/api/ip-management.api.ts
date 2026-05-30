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
}

export interface PatientJourneyDetailDto extends PatientJourneyRowDto {
  branchId: string;
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
  createdAt: string;
  updatedAt: string;
}

export interface AdmitPatientRequest {
  wardId?: string;
  admissionType?: string;        // DayCare | IPD | Emergency
  bedNumber?: string;
  admittedAt?: string;
  attendantName?: string;
  attendantPhone?: string;
  attendantRelationship?: string;
  primarySurgeonId?: string;
  primaryNurseId?: string;
  overrideStateCheck?: boolean;
  bypassFinancialClearance?: boolean;
  overrideReason?: string;
}

export interface UpdateWardAssignmentRequest {
  wardId?: string;
  bedNumber?: string;
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
  iolBarcodeVerified?: boolean;
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

export interface TransitionRequest {
  newState: string;
  reason?: string;
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
  eyeCareInstructions?: string;
  warningSigns?: string;
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

// ─── Audit Log Types ──────────────────────────────────────────────────────────

export interface JourneyAuditLogDto {
  id: string;
  journeyId: string;
  fieldChanged: string;
  oldValue: string | null;
  newValue: string | null;
  changedAt: string;
  changedByUserId: string;
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
}

export interface BatchSavePreOpCompletionsRequest {
  items: SavePreOpCompletionRequest[];
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
    } catch (e) {
      console.warn('[ip-management] admitPatient failed', e);
      return null;
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

  async transitionClinical(id: string, req: TransitionRequest): Promise<PatientJourneyDetailDto> {
    const r = await getClient().post<PatientJourneyDetailDto>(`/ip-management/journeys/${id}/clinical-transition`, req);
    return r.data;
  },

  async acceptInOT(id: string): Promise<PatientJourneyDetailDto> {
    const r = await getClient().post<PatientJourneyDetailDto>(`/ip-management/journeys/${id}/accept`, {});
    return r.data;
  },

  async startSurgery(id: string): Promise<PatientJourneyDetailDto> {
    const r = await getClient().post<PatientJourneyDetailDto>(`/ip-management/journeys/${id}/start-surgery`, {});
    return r.data;
  },

  async transitionFinancial(id: string, req: TransitionRequest): Promise<PatientJourneyDetailDto | null> {
    try {
      const r = await getClient().post<PatientJourneyDetailDto>(`/ip-management/journeys/${id}/financial-transition`, req);
      return r.data;
    } catch (e) {
      console.warn('[ip-management] transitionFinancial failed', e);
      return null;
    }
  },

  async applyEmergencyFc(id: string, req: EmergencyFcRequest): Promise<PatientJourneyDetailDto | null> {
    try {
      const r = await getClient().put<PatientJourneyDetailDto>(`/ip-management/journeys/${id}/emergency-fc`, req);
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

  async addBilling(journeyId: string, req: AddBillingTransactionRequest): Promise<BillingTransactionDto | null> {
    try {
      const r = await getClient().post<BillingTransactionDto>(`/ip-management/journeys/${journeyId}/billing`, req);
      return r.data;
    } catch (e) {
      console.warn('[ip-management] addBilling failed', e);
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
    } catch (e) {
      console.warn('[ip-management] savePostOpInstructions failed', e);
      return null;
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

  // ── Audit Log ──────────────────────────────────────────────────────────────
  async getJourneyAudit(journeyId: string): Promise<JourneyAuditLogDto[]> {
    try {
      const r = await getClient().get<JourneyAuditLogDto[]>(`/ip-management/journeys/${journeyId}/audit`);
      return Array.isArray(r.data) ? r.data : [];
    } catch (e) {
      console.warn('[ip-management] getJourneyAudit failed', e);
      return [];
    }
  },
};

/**
 * Fetches both journeys and wards for the Ward page in a single call.
 * Unlike the methods on ipManagementApi, this function does NOT swallow errors —
 * it lets them propagate so the caller can display an error state and retry.
 */
export async function fetchWardData(branchId: string): Promise<{
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
}
