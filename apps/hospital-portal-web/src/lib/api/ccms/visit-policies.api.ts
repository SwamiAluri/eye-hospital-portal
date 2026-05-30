// CCMS – Visit Insurance Policies API client
// Maps to migration 122 (ccms_visit_insurance_policies)
import { getCcmsApi } from './ccms-base';

// ── Types ────────────────────────────────────────────────────────────────────

export type RelationshipToInsured =
  | 'self' | 'spouse' | 'child' | 'parent' | 'other';

export type AccommodationClass =
  | 'general' | 'semi-private' | 'private' | 'icu';

export interface UnderwritingCondition {
  code: string;
  label: string;
  since?: number;  // year (e.g. 2019)
}

export interface UnderwritingSnapshot {
  conditions: UnderwritingCondition[];
  alcoholUse: boolean;
  hivRisk: boolean;
  otherAilments?: string;
}

export interface VisitPolicy {
  id: string;
  tenantId: string;
  sessionId?: string;
  coverageCaseId?: string;

  // Policy identifiers
  policyNumber: string;
  cardNumber?: string;
  membershipNumber?: string;

  // Payer
  insuranceProviderId?: string;
  insuranceProviderName?: string;
  tpaProviderId?: string;
  tpaProviderName?: string;

  // Insured
  insuredName?: string;
  relationshipToInsured?: RelationshipToInsured;

  // Employment
  occupation?: string;
  designation?: string;
  companyName?: string;
  employeeId?: string;
  videNumber?: string;
  contactNumber?: string;

  // Doctor
  doctorName?: string;
  doctorRegNumber?: string;
  doctorQualification?: string;
  doctorContact?: string;

  // Accommodation
  accommodationClass?: AccommodationClass;
  detailsText?: string;

  // TPA
  tpaCoordinatorName?: string;

  // Multi-policy
  isPrimary: boolean;
  sortOrder: number;

  // Underwriting
  underwritingSnapshot?: UnderwritingSnapshot;

  // Tax
  serviceTaxApplicable?: boolean;

  status: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateVisitPolicyRequest {
  sessionId?: string;
  coverageCaseId?: string;
  policyNumber: string;
  cardNumber?: string;
  membershipNumber?: string;
  insuranceProviderId?: string;
  tpaProviderId?: string;
  insuredName?: string;
  relationshipToInsured?: RelationshipToInsured;
  occupation?: string;
  designation?: string;
  companyName?: string;
  employeeId?: string;
  videNumber?: string;
  contactNumber?: string;
  doctorName?: string;
  doctorRegNumber?: string;
  doctorQualification?: string;
  doctorContact?: string;
  accommodationClass?: AccommodationClass;
  detailsText?: string;
  tpaCoordinatorName?: string;
  isPrimary?: boolean;
  sortOrder?: number;
  underwritingSnapshot?: UnderwritingSnapshot;
  serviceTaxApplicable?: boolean;
}

export type UpdateVisitPolicyRequest = Partial<CreateVisitPolicyRequest>;

// ── API functions ────────────────────────────────────────────────────────────

/** GET /ccms/coverage-cases/{caseId}/policies */
export async function getPoliciesByCase(caseId: string): Promise<VisitPolicy[]> {
  const { data } = await getCcmsApi().get(
    `/ccms/coverage-cases/${caseId}/policies`,
  );
  return Array.isArray(data) ? data : [];
}

/** GET /ccms/sessions/{sessionId}/policies */
export async function getPoliciesBySession(sessionId: string): Promise<VisitPolicy[]> {
  const { data } = await getCcmsApi().get(
    `/ccms/sessions/${sessionId}/policies`,
  );
  return Array.isArray(data) ? data : [];
}

/** POST /ccms/coverage-cases/{caseId}/policies */
export async function createPolicy(
  caseId: string,
  req: CreateVisitPolicyRequest,
): Promise<VisitPolicy> {
  const { data } = await getCcmsApi().post(
    `/ccms/coverage-cases/${caseId}/policies`,
    req,
  );
  return data;
}

/** PUT /ccms/coverage-cases/{caseId}/policies/{id} */
export async function updatePolicy(
  caseId: string,
  policyId: string,
  req: UpdateVisitPolicyRequest,
): Promise<VisitPolicy> {
  const { data } = await getCcmsApi().put(
    `/ccms/coverage-cases/${caseId}/policies/${policyId}`,
    req,
  );
  return data;
}

/** DELETE /ccms/coverage-cases/{caseId}/policies/{id} */
export async function deletePolicy(caseId: string, policyId: string): Promise<void> {
  await getCcmsApi().delete(`/ccms/coverage-cases/${caseId}/policies/${policyId}`);
}

/** POST /ccms/coverage-cases/{caseId}/policies/{id}/set-primary */
export async function setPrimaryPolicy(
  caseId: string,
  policyId: string,
): Promise<VisitPolicy> {
  const { data } = await getCcmsApi().post(
    `/ccms/coverage-cases/${caseId}/policies/${policyId}/set-primary`,
  );
  return data;
}
