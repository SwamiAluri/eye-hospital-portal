import { getCcmsApi } from './ccms-base';
import type { CoverageCase } from './ccms-coverage-cases.api';
import type { VisitPolicy } from './visit-policies.api';
import type { PreAuthorization } from './ccms-authorizations.api';
import type { BillingWithAllocations } from './ccms-billing.api';
import type { ClaimPacket } from './ccms-claims.api';
import type { Settlement } from './ccms-settlements.api';
import type { CcmsCommunicationLog } from './ccms-communications.api';
import type { CaseDocument } from './ccms-documents.api';
import type { ApprovalEvent } from './ccms-approvals.api';
import type { WorkflowHistoryEntry } from './ccms-workflow.api';
import type { EligibilityCheck, PolicyCapture } from './ccms-eligibility.api';

/** Raw workspace payload from GET /ccms/coverage-cases/{id}/workspace */
export interface CoverageCaseWorkspace {
  case: CoverageCase;
  policies?: VisitPolicy[] | null;
  preAuths?: PreAuthorization[] | null;
  billing?: BillingWithAllocations | null;
  claims?: ClaimPacket[] | null;
  settlements?: Settlement[] | null;
  communications?: CcmsCommunicationLog[] | null;
  documents?: CaseDocument[] | null;
  approvalEvents?: ApprovalEvent[] | null;
  workflowHistory?: WorkflowHistoryEntry[] | null;
  workflowActions?: string[] | null;
  eligibilityChecks?: EligibilityCheck[] | null;
  policyCapture?: PolicyCapture | null;
}

export async function getCoverageCaseWorkspace(
  caseId: string,
  sections: string,
): Promise<CoverageCaseWorkspace> {
  const params = sections ? { sections } : undefined;
  const { data } = await getCcmsApi().get(`/ccms/coverage-cases/${caseId}/workspace`, { params });
  return data as CoverageCaseWorkspace;
}
