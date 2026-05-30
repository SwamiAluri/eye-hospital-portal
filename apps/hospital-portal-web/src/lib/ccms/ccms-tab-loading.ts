import type { CcmsTabKey } from './ccms-next-step';

/** Which case slices to fetch based on active tab and workflow state. */
export interface CaseDataLoadFlags {
  policies: boolean;
  preAuths: boolean;
  workflowHistory: boolean;
  workflowActions: boolean;
  events: boolean;
  billing: boolean;
  claims: boolean;
  settlements: boolean;
  communications: boolean;
  documents: boolean;
  eligibility: boolean;
  policyCapture: boolean;
}

const POST_APPROVAL = new Set([
  'APPROVED', 'PARTIAL_APPROVAL', 'ADMISSION_READY', 'ADMITTED',
  'SURGERY_SCHEDULED', 'SURGERY_COMPLETED',
  'BILL_PENDING', 'BILL_FINALIZED', 'CLAIM_READY', 'CLAIM_SUBMITTED', 'CLAIM_IN_PROCESS',
  'SETTLEMENT_PENDING', 'PARTIAL_SETTLEMENT', 'FULL_SETTLEMENT', 'RECONCILED', 'CLOSED',
]);

const POST_BILLING = new Set([
  'BILL_FINALIZED', 'CLAIM_READY', 'CLAIM_SUBMITTED', 'CLAIM_IN_PROCESS',
  'SETTLEMENT_PENDING', 'PARTIAL_SETTLEMENT', 'FULL_SETTLEMENT', 'RECONCILED', 'CLOSED',
]);

const POST_CLAIM = new Set([
  'CLAIM_SUBMITTED', 'CLAIM_IN_PROCESS',
  'SETTLEMENT_PENDING', 'PARTIAL_SETTLEMENT', 'FULL_SETTLEMENT', 'RECONCILED', 'CLOSED',
]);

const INTAKE_STATES = new Set([
  'DRAFT', 'ELIGIBILITY_PENDING', 'ELIGIBILITY_VERIFIED', 'POLICY_CAPTURED',
  'AUTHORIZATION_REQUIRED', 'PREAUTH_SENT', 'PREAUTH_GENERATED', 'WAITING_APPROVAL',
  'CLARIFICATION_REQUIRED', 'RESUBMITTED',
]);

export function getCaseDataLoadFlags(
  tab: CcmsTabKey,
  currentState?: string | null,
  isWorkflowAdmin = false,
): CaseDataLoadFlags {
  const state = currentState ?? '';
  const isIntake = INTAKE_STATES.has(state);

  return {
    policies: true,
    preAuths: true,
    workflowHistory: tab === 'overview' || tab === 'communications',
    workflowActions: isWorkflowAdmin,
    events: tab === 'events',
    billing: tab === 'billing' || POST_APPROVAL.has(state),
    claims: tab === 'claims' || POST_BILLING.has(state),
    settlements: tab === 'settlement' || POST_CLAIM.has(state),
    communications: tab === 'overview' || tab === 'communications',
    documents: tab === 'overview',
    eligibility: tab === 'overview' && isIntake,
    policyCapture: tab === 'overview' && isIntake,
  };
}

/** Maps tab load flags to backend workspace `sections` query param. */
export function buildWorkspaceSections(flags: CaseDataLoadFlags): string {
  const sections: string[] = ['policies', 'preauths'];
  if (flags.workflowHistory) sections.push('workflowhistory');
  if (flags.workflowActions) sections.push('workflowactions');
  if (flags.events) sections.push('events');
  if (flags.billing) sections.push('billing');
  if (flags.claims) sections.push('claims');
  if (flags.settlements) sections.push('settlements');
  if (flags.communications) sections.push('communications');
  if (flags.documents) sections.push('documents');
  if (flags.eligibility) sections.push('eligibility');
  if (flags.policyCapture) sections.push('policycapture');
  return sections.sort().join(',');
}
