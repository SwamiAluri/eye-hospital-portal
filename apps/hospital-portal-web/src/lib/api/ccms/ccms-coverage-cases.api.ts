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

export interface CoverageCase {
  id: string;
  tenantId: string;
  caseNumber: string;
  counselingSessionId?: string;
  patientId: string;
  branchId?: string;
  payerType: 'Insurance' | 'TPA' | 'CoPay' | 'CGHS' | 'SGHS' | 'GovernmentScheme' | 'Camp' | 'ESH';
  paymentType: string;
  insuranceProviderId?: string;
  tpaId?: string;
  governmentSchemeId?: string;
  membershipNumber?: string;
  policyNumber?: string;
  currentState: CcmsState;
  financialYearId?: string;
  estimatedAmount?: number;
  approvedAmount?: number;
  patientPayableAmount?: number;
  createdAt: string;
  updatedAt: string;
  status: string;
}

export interface CreateCoverageCaseRequest {
  counselingSessionId?: string;
  patientId: string;
  branchId?: string;
  payerType: string;
  paymentType: string;
  insuranceProviderId?: string;
  tpaId?: string;
  governmentSchemeId?: string;
  membershipNumber?: string;
  policyNumber?: string;
  estimatedAmount?: number;
}

export interface CasesListResponse {
  cases: CoverageCase[];
  totalCount: number;
  pageNumber: number;
  pageSize: number;
}

export interface AdmissionValidation {
  allowed: boolean;
  warningLevel: 'None' | 'Info' | 'Warning' | 'Block';
  warningMessage?: string;
  blockReason?: string;
  caseId?: string;
  approvedAmount?: number;
  preAuthNumber?: string;
}

export async function listCoverageCases(params?: {
  pageNumber?: number;
  pageSize?: number;
  state?: string;
  payerType?: string;
  patientId?: string;
  branchId?: string;
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
  const { data } = await getCcmsApi().get(`/ccms/coverage-cases/by-session/${sessionId}`);
  return data ?? null;
}

export async function getCasesBySessionIds(sessionIds: string[]): Promise<CoverageCase[]> {
  const { data } = await getCcmsApi().post('/ccms/coverage-cases/by-sessions', { sessionIds });
  return Array.isArray(data) ? data : [];
}

export async function validateAdmission(params: {
  journeyId: string;
  sessionId: string;
  tenantId: string;
  isEmergency?: boolean;
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
