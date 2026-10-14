// CCMS – Eligibility Checks & Policy Capture API client
import { getCcmsApi } from './ccms-base';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export interface EligibilityCheck {
  id: string;
  coverageCase_Id: string;
  policyNumber: string;
  membershipId?: string;
  checkMethod: 'manual' | 'api' | 'portal';
  responseCode?: string;
  isEligible: boolean;
  eligibilityResponseJson?: string;
  checkedAt: string;
  createdAt: string;
  createdByUserId?: string;
}

export interface CreateEligibilityCheckRequest {
  policyNumber: string;
  membershipId?: string;
  isEligible: boolean;
  checkMethod?: 'manual' | 'api' | 'portal';
  responseCode?: string;
  eligibilityResponseJson?: string;
}

export interface PolicyCapture {
  id: string;
  coverageCase_Id: string;
  policyNumber: string;
  memberName?: string;
  memberDob?: string;            // ISO date
  policyStartDate?: string;      // ISO date
  policyEndDate?: string;        // ISO date
  sumInsured: number;
  balanceSumInsured: number;
  cumulativeBonusAmount: number;
  roomEntitlement?: string;
  policyDocsJson?: string;
  capturedAt: string;
  createdAt: string;
}

export interface CreatePolicyCaptureRequest {
  policyNumber: string;
  memberName?: string;
  memberDob?: string;
  policyStartDate?: string;
  policyEndDate?: string;
  sumInsured: number;
  balanceSumInsured: number;
  cumulativeBonusAmount: number;
  roomEntitlement?: string;
  policyDocsJson?: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Eligibility Checks
// ─────────────────────────────────────────────────────────────────────────────

export interface EligibilityCheckListResponse {
  eligibilityChecks: unknown[];
  totalCount: number;
  pageNumber?: number;
  pageSize?: number;
}

/** GET /ccms/eligibility-checks/by-patient/{patientId} */
export async function getEligibilityChecksByPatient(
  patientId: string,
  pageNumber = 1,
  pageSize = 20,
): Promise<EligibilityCheckListResponse> {
  const { data } = await getCcmsApi().get(`/ccms/eligibility-checks/by-patient/${patientId}`, {
    params: { pageNumber, pageSize },
  });
  return data;
}

/** GET /ccms/coverage-cases/{caseId}/eligibility-checks */
export async function getEligibilityChecks(caseId: string): Promise<EligibilityCheck[]> {
  const { data } = await getCcmsApi().get(
    `/ccms/coverage-cases/${caseId}/eligibility-checks`,
  );
  return data;
}

/** POST /ccms/coverage-cases/{caseId}/eligibility-checks */
export async function createEligibilityCheck(
  caseId: string,
  req: CreateEligibilityCheckRequest,
): Promise<EligibilityCheck> {
  const { data } = await getCcmsApi().post(
    `/ccms/coverage-cases/${caseId}/eligibility-checks`,
    req,
  );
  return data;
}

// ─────────────────────────────────────────────────────────────────────────────
// Policy Captures
// ─────────────────────────────────────────────────────────────────────────────

/** GET /ccms/coverage-cases/{caseId}/policy-captures */
export async function getPolicyCaptures(caseId: string): Promise<PolicyCapture[]> {
  const { data } = await getCcmsApi().get(
    `/ccms/coverage-cases/${caseId}/policy-captures`,
  );
  return data;
}

/** GET /ccms/coverage-cases/{caseId}/policy-captures/latest */
export async function getLatestPolicyCapture(
  caseId: string,
): Promise<PolicyCapture | null> {
  const resp = await getCcmsApi().get(
    `/ccms/coverage-cases/${caseId}/policy-captures/latest`,
    { validateStatus: s => s === 200 || s === 204 },
  );
  return resp.status === 204 ? null : resp.data;
}

/** POST /ccms/coverage-cases/{caseId}/policy-captures */
export async function createPolicyCapture(
  caseId: string,
  req: CreatePolicyCaptureRequest,
): Promise<PolicyCapture> {
  const { data } = await getCcmsApi().post(
    `/ccms/coverage-cases/${caseId}/policy-captures`,
    req,
  );
  return data;
}
