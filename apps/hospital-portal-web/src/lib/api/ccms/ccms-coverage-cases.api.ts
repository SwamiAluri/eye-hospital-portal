// CCMS – Coverage Cases API client
import { getCcmsApi } from './ccms-base';

export type CcmsState =
  | 'DRAFT'
  | 'ELIGIBILITY_PENDING'
  | 'ELIGIBILITY_VERIFIED'
  | 'POLICY_CAPTURED'
  | 'AUTHORIZATION_REQUIRED'
  | 'PREAUTH_SENT'
  | 'PREAUTH_GENERATED'
  | 'WAITING_APPROVAL'
  | 'APPROVED'
  | 'PARTIAL_APPROVAL'
  | 'ADMISSION_READY'
  | 'ADMITTED'
  | 'SURGERY_SCHEDULED'
  | 'SURGERY_COMPLETED'
  | 'BILL_PENDING'
  | 'BILL_FINALIZED'
  | 'CLAIM_READY'
  | 'CLAIM_SUBMITTED'
  | 'CLAIM_IN_PROCESS'
  | 'SETTLEMENT_PENDING'
  | 'PARTIAL_SETTLEMENT'
  | 'FULL_SETTLEMENT'
  | 'RECONCILED'
  | 'CLOSED'
  | 'REJECTED'
  | 'CLARIFICATION_REQUIRED'
  | 'RESUBMITTED'
  | 'EXPIRED'
  | 'CANCELLED'
  | 'ABORTED';

export type RelationshipToInsured = 'Self' | 'Spouse' | 'Child' | 'Parent' | 'Other';
export type RoomClassEntitlement = 'General' | 'Semi-Private' | 'Private' | 'ICU';
export type UrgencyLevel = 'Elective' | 'Urgent' | 'Emergency';

export interface CoverageCase {
  id: string;
  caseNumber: string;
  // sessionId matches the backend DTO field (was counselingSessionId — fixed)
  sessionId?: string;
  patientId: string;
  patientName?: string;
  branchId?: string;
  doctorId?: string;
  financialYearId?: string;
  journeyId?: string;
  coveragePackageId?: string;
  payerType: string;
  paymentType?: string;
  insuranceProviderId?: string;
  tpaProviderId?: string;
  governmentSchemeId?: string;
  workflowInstanceId?: string;
  currentState: CcmsState;
  approvedAmount?: number;
  roomClassApproved?: string;
  preAuthNumber?: string;
  preAuthExpiry?: string;
  isDraft?: boolean;
  draftSavedAt?: string;
  createdAt: string;
  updatedAt: string;

  // Counsellor-captured data (from detail DTO)
  counsellorDraftJson?: string;
  insurerName?: string;
  processStatus?: string;

  // Service tax (from detail DTO, migration 124)
  serviceTaxApplicable?: boolean;
  serviceTaxPercent?: number;
  serviceTaxAmount?: number;

  // Entity status
  entityStatus?: string;

  // Financial summary fields (from summary DTO — populated from counsellor draft)
  estimatedAmount?: number;
  patientPayableAmount?: number;
  policyNumber?: string;
}

export interface CreateCoverageCaseRequest {
  /** Preferred — matches backend SessionId */
  sessionId?: string;
  /** Alias accepted by backend CreateCoverageCaseRequest.CounselingSessionId */
  counselingSessionId?: string;
  patientId: string;
  branchId?: string;
  payerType: string;
  paymentType: string;
  insuranceProviderId?: string;
  tpaId?: string;
  tpaProviderId?: string;
  governmentSchemeId?: string;
  membershipNumber?: string;
  policyNumber?: string;
  estimatedAmount?: number;
  insurerName?: string;
  counsellorDraftJson?: string;
  patientName?: string;
}

export interface UpdateCoverageCaseRequest {
  insurerName?: string;
  insuranceProviderId?: string;
  policyNumber?: string;
  membershipNumber?: string;
  insuredName?: string;
  relationshipToInsured?: RelationshipToInsured;
  sumInsured?: number;
  coPay?: number;
  roomClassEntitlement?: RoomClassEntitlement;
  networkHospitalConfirmed?: boolean;
  policyExpiry?: string;
  financialYearId?: string;
  coverageNotes?: string;
  surgeryDate?: string;
  diagnosisCode?: string;
  procedureCode?: string;
  urgencyLevel?: UrgencyLevel;
  estimatedSurgery?: number;
  estimatedRoom?: number;
  estimatedMedicines?: number;
  estimatedLab?: number;
  estimatedOther?: number;
  estimatedAmount?: number;
  tpaContactPerson?: string;
  tpaContactEmail?: string;
  tpaContactPhone?: string;
  clinicalNotes?: string;
  paymentType?: string;
  isDraft?: boolean;
  counsellorDraftJson?: string;
}

export interface SubmitToClaimsRequest {
  requestedAmount: number;
  estimatedSurgeryDate?: string;
  diagnosisCodes?: string[];
  procedureCodes?: string[];
  clinicalNotes?: string;
  urgencyLevel?: UrgencyLevel;
  tpaContact?: string;
  tpaEmail?: string;
  tpaPhone?: string;
  notes?: string;
  // Service tax fields
  estimatedTotalCost?: number;
  serviceTaxApplicable?: boolean;
  serviceTaxPercent?: number;
  serviceTaxAmount?: number;
}

export interface SubmitToClaimsResponse {
  caseId?: string;
  preAuthId?: string;
  caseNumber?: string;
  coverageCase?: CoverageCase;
  message?: string;
}

export interface CasesListResponse {
  cases: CoverageCase[];
  totalCount: number;
  pageNumber: number;
  pageSize: number;
}

export interface AdmissionValidation {
  allowed: boolean;
  warningLevel?: string;
  warningMessage?: string;
  blockReason?: string;
  caseId?: string;
  approvedAmount?: number;
  preAuthNumber?: string;
  decision?: string;
  coverageState?: string;
  isEmergencyFinancialClearance?: boolean;
  paymentType?: string;
  lastUpdatedAt?: string;
  payerShareAmount?: number;
  patientShareAmount?: number;
}

export async function listCoverageCases(params?: {
  pageNumber?: number;
  pageSize?: number;
  state?: string;
  payerType?: string;
  patientId?: string;
  branchId?: string;
  search?: string;
}): Promise<CasesListResponse> {
  const { data } = await getCcmsApi().get('/ccms/coverage-cases', { params });
  return data;
}

export async function getCoverageCaseById(id: string): Promise<CoverageCase> {
  const { data } = await getCcmsApi().get(`/ccms/coverage-cases/${id}`);
  return data;
}

export async function createCoverageCase(req: CreateCoverageCaseRequest): Promise<CoverageCase> {
  const { data } = await getCcmsApi().post('/ccms/coverage-cases', req);
  return data;
}

export async function getCaseBySessionId(sessionId: string): Promise<CoverageCase | null> {
  const resp = await getCcmsApi().get(`/ccms/coverage-cases/by-session/${sessionId}`, {
    // 204 = no case yet (not an error), 404 = same old behaviour — treat both as null
    validateStatus: (s) => s === 200 || s === 204 || s === 404,
  });
  if (resp.status !== 200) return null;
  return (resp.data as CoverageCase) ?? null;
}

export async function getCasesBySessionIds(sessionIds: string[]): Promise<CoverageCase[]> {
  const { data } = await getCcmsApi().post('/ccms/coverage-cases/by-sessions', { sessionIds });
  return Array.isArray(data) ? data : [];
}

export async function validateAdmission(params: {
  journeyId?: string;
  sessionId?: string;
  tenantId?: string;
  emergencyFcApplied?: boolean;
}): Promise<AdmissionValidation> {
  const { data } = await getCcmsApi().get('/ccms/integration/validate-admission', { params });
  return data;
}

export async function recordEligibility(
  caseId: string,
  body: { eligibilityStatus: 'verified' | 'failed'; notes?: string }
): Promise<CoverageCase> {
  const { data } = await getCcmsApi().post(`/ccms/coverage-cases/${caseId}/eligibility`, body);
  return data;
}

export async function fireCaseTransition(
  caseId: string,
  body: { triggerEvent: string; notes?: string }
): Promise<CoverageCase> {
  const { data } = await getCcmsApi().post(`/ccms/coverage-cases/${caseId}/transition`, body);
  return data;
}

export async function updateCoverageCase(
  caseId: string,
  payload: UpdateCoverageCaseRequest
): Promise<CoverageCase> {
  const { data } = await getCcmsApi().patch(`/ccms/coverage-cases/${caseId}`, payload);
  return data;
}

export async function submitToClaimsTeam(
  caseId: string,
  payload: SubmitToClaimsRequest
): Promise<SubmitToClaimsResponse> {
  const { data } = await getCcmsApi().post(`/ccms/coverage-cases/${caseId}/submit-to-claims`, payload);
  return data;
}

export async function remindCcmsTeam(
  caseId: string,
  notes?: string
): Promise<{ message: string }> {
  const { data } = await getCcmsApi().post(`/ccms/coverage-cases/${caseId}/remind`, { notes });
  return data;
}
