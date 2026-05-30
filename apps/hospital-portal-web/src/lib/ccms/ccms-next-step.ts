/**
 * Maps CCMS workflow state → tab-centric "next step" guidance for operators.
 * Domain actions live on tabs; sidebar shows instructions only (Phase 1).
 */

export type CcmsTabKey =
  | 'overview'
  | 'authorization'
  | 'billing'
  | 'claims'
  | 'settlement'
  | 'events'
  | 'communications';

export interface CcmsNextStep {
  tab: CcmsTabKey;
  tabLabel: string;
  title: string;
  instruction: string;
  actionHint?: string;
}

const TERMINAL = new Set(['CLOSED', 'CANCELLED', 'ABORTED', 'REJECTED', 'EXPIRED']);

/** Intake states — work primarily on Overview until pre-auth is ready */
const INTAKE = new Set([
  'DRAFT',
  'ELIGIBILITY_PENDING',
  'ELIGIBILITY_VERIFIED',
  'POLICY_CAPTURED',
  'AUTHORIZATION_REQUIRED',
]);

const PREAUTH = new Set([
  'PREAUTH_GENERATED',
  'PREAUTH_SENT',
  'WAITING_APPROVAL',
  'CLARIFICATION_REQUIRED',
  'RESUBMITTED',
]);

const CLINICAL = new Set([
  'APPROVED',
  'PARTIAL_APPROVAL',
  'ADMISSION_READY',
  'ADMITTED',
  'SURGERY_SCHEDULED',
  'SURGERY_COMPLETED',
]);

const BILLING_CLAIMS = new Set([
  'BILL_PENDING',
  'BILL_FINALIZED',
  'CLAIM_READY',
  'CLAIM_SUBMITTED',
  'CLAIM_IN_PROCESS',
]);

const SETTLEMENT = new Set([
  'SETTLEMENT_PENDING',
  'PARTIAL_SETTLEMENT',
  'FULL_SETTLEMENT',
  'RECONCILED',
]);

export function getCcmsNextStep(state: string): CcmsNextStep | null {
  if (TERMINAL.has(state)) {
    if (state === 'CLOSED') {
      return {
        tab: 'overview',
        tabLabel: 'Overview',
        title: 'Case closed',
        instruction: 'This case is closed. All tabs are read-only for audit review.',
      };
    }
    return {
      tab: 'events',
      tabLabel: 'Events',
      title: getTerminalTitle(state),
      instruction: 'Review the event stream and workflow history. Contact a workflow admin if the case must be reopened.',
    };
  }

  if (INTAKE.has(state)) {
    return intakeStep(state);
  }
  if (PREAUTH.has(state)) {
    return preAuthStep(state);
  }
  if (CLINICAL.has(state)) {
    return clinicalStep(state);
  }
  if (BILLING_CLAIMS.has(state)) {
    return billingClaimsStep(state);
  }
  if (SETTLEMENT.has(state)) {
    return settlementStep(state);
  }

  return {
    tab: 'overview',
    tabLabel: 'Overview',
    title: 'Review case',
    instruction: `Current state: ${state.replace(/_/g, ' ')}. Use the workflow tabs to continue.`,
  };
}

function getTerminalTitle(state: string): string {
  switch (state) {
    case 'REJECTED': return 'TPA rejected';
    case 'EXPIRED': return 'Pre-auth expired';
    case 'CANCELLED': return 'Case cancelled';
    case 'ABORTED': return 'Case aborted';
    default: return 'Case ended';
  }
}

function intakeStep(state: string): CcmsNextStep {
  const base = { tab: 'overview' as const, tabLabel: 'Overview' };
  switch (state) {
    case 'DRAFT':
      return {
        ...base,
        title: 'Complete intake',
        instruction: 'Verify counsellor coverage data is saved, then record eligibility and capture the visit policy.',
        actionHint: 'Overview → insurance section, or Counsellor Desk Coverage tab',
      };
    case 'ELIGIBILITY_PENDING':
      return {
        ...base,
        title: 'Verify eligibility',
        instruction: 'Record the eligibility check result on the Overview tab before proceeding.',
        actionHint: 'Overview → Intake → Verify Eligibility',
      };
    case 'ELIGIBILITY_VERIFIED':
      return {
        ...base,
        title: 'Capture policy',
        instruction: 'Confirm visit policies and record policy capture (sum insured) on the Overview tab.',
        actionHint: 'Overview → Intake → Visit Policies / Policy Capture',
      };
    case 'POLICY_CAPTURED':
    case 'AUTHORIZATION_REQUIRED':
      return {
        tab: 'authorization',
        tabLabel: 'Pre-Auth',
        title: 'Generate pre-authorization',
        instruction: 'Open the Pre-Auth tab and click Generate Pre-Auth to create the TPA request.',
        actionHint: 'Pre-Auth tab → Generate Pre-Auth',
      };
    default:
      return { ...base, title: 'Intake', instruction: 'Complete intake on the Overview tab.' };
  }
}

function preAuthStep(state: string): CcmsNextStep {
  const base = { tab: 'authorization' as const, tabLabel: 'Pre-Auth' };
  switch (state) {
    case 'PREAUTH_GENERATED':
      return {
        ...base,
        title: 'Send to TPA',
        instruction: 'Open the pre-auth record and send it to the insurer / TPA.',
        actionHint: 'Pre-Auth tab → Send to TPA',
      };
    case 'PREAUTH_SENT':
    case 'WAITING_APPROVAL':
      return {
        ...base,
        title: 'Awaiting TPA decision',
        instruction: 'When the TPA responds, record the decision on the Pre-Auth tab.',
        actionHint: 'Pre-Auth tab → Record Response',
      };
    case 'CLARIFICATION_REQUIRED':
      return {
        ...base,
        title: 'Clarification required',
        instruction: 'Respond to the TPA query, then resubmit the pre-auth from the Pre-Auth tab.',
      };
    case 'RESUBMITTED':
      return {
        ...base,
        title: 'Resubmitted',
        instruction: 'Send the updated pre-auth to TPA and await decision.',
        actionHint: 'Pre-Auth tab → Send to TPA',
      };
    default:
      return { ...base, title: 'Pre-auth', instruction: 'Continue on the Pre-Auth tab.' };
  }
}

function clinicalStep(state: string): CcmsNextStep {
  if (state === 'APPROVED' || state === 'PARTIAL_APPROVAL') {
    return {
      tab: 'overview',
      tabLabel: 'Overview',
      title: 'TPA approved — clinical phase',
      instruction: 'Admission and surgery are handled in IP / OT modules. CCMS will advance when those events occur.',
      actionHint: 'IP Management → admit patient when ready',
    };
  }
  if (state === 'ADMISSION_READY' || state === 'ADMITTED') {
    return {
      tab: 'overview',
      tabLabel: 'Overview',
      title: 'Patient admission',
      instruction: 'Complete admission in IP Management. Billing begins after surgery and discharge.',
    };
  }
  if (state === 'SURGERY_SCHEDULED') {
    return {
      tab: 'overview',
      tabLabel: 'Overview',
      title: 'Surgery scheduled',
      instruction: 'OT will mark surgery complete; CCMS state updates automatically when integrated.',
    };
  }
  return {
    tab: 'billing',
    tabLabel: 'Billing',
    title: 'Post-surgery billing',
    instruction: 'After discharge and bill finalization in IP/Billing, import and allocate the bill on the Billing tab.',
    actionHint: 'Billing tab → Import from billing → Allocate',
  };
}

function billingClaimsStep(state: string): CcmsNextStep {
  switch (state) {
    case 'BILL_PENDING':
    case 'BILL_FINALIZED':
      return {
        tab: 'billing',
        tabLabel: 'Billing',
        title: 'Allocate bill',
        instruction: 'Import hospital bill lines and allocate insurance vs patient share.',
        actionHint: 'Billing tab → Allocate Bill',
      };
    case 'CLAIM_READY':
      return {
        tab: 'claims',
        tabLabel: 'Claims',
        title: 'Generate claim',
        instruction: 'Create the claim packet from allocated billing data.',
        actionHint: 'Claims tab → Generate Claim',
      };
    case 'CLAIM_SUBMITTED':
      return {
        tab: 'claims',
        tabLabel: 'Claims',
        title: 'Claim submitted',
        instruction: 'Track submission or acknowledge TPA receipt on the Claims tab.',
        actionHint: 'Claims tab → Acknowledge TPA receipt',
      };
    case 'CLAIM_IN_PROCESS':
      return {
        tab: 'settlement',
        tabLabel: 'Settlement',
        title: 'Awaiting settlement',
        instruction: 'When insurer payment arrives, record it on the Settlement tab.',
        actionHint: 'Settlement tab → Record Payment',
      };
    default:
      return {
        tab: 'claims',
        tabLabel: 'Claims',
        title: 'Claims',
        instruction: 'Continue claim workflow on the Claims tab.',
      };
  }
}

function settlementStep(state: string): CcmsNextStep {
  switch (state) {
    case 'SETTLEMENT_PENDING':
    case 'PARTIAL_SETTLEMENT':
      return {
        tab: 'settlement',
        tabLabel: 'Settlement',
        title: 'Record payment',
        instruction: 'Record insurer payment(s) on the Settlement tab.',
        actionHint: 'Settlement tab → Record Payment',
      };
    case 'FULL_SETTLEMENT':
      return {
        tab: 'settlement',
        tabLabel: 'Settlement',
        title: 'Reconcile',
        instruction: 'Reconcile settlements against the claim on the Settlement tab.',
        actionHint: 'Settlement tab → Reconcile',
      };
    case 'RECONCILED':
      return {
        tab: 'settlement',
        tabLabel: 'Settlement',
        title: 'Close case',
        instruction: 'After reconciliation, close the case from the Settlement tab.',
        actionHint: 'Settlement tab → Close Case',
      };
    default:
      return {
        tab: 'settlement',
        tabLabel: 'Settlement',
        title: 'Settlement',
        instruction: 'Continue on the Settlement tab.',
      };
  }
}

/** Raw workflow triggers reserved for workflow admins only */
export const ADMIN_ONLY_TRIGGERS = new Set([
  'CANCEL',
  'ABORT',
  'EXPIRE_PREAUTH',
]);

/** Hidden from Workflow Admin UI — use Pre-Auth tab domain actions instead */
export const WORKFLOW_ADMIN_HIDDEN_TRIGGERS = new Set([
  'GENERATE_PREAUTH',
  'SEND_PREAUTH',
  'WAIT_RESPONSE',
  'RECEIVE_APPROVAL',
  'RECEIVE_PARTIAL',
  'RECEIVE_REJECTION',
  'REQUEST_CLARIFICATION',
  'RESUBMIT',
]);

export function filterAdminWorkflowActions<T extends { actionCode: string }>(
  actions: T[],
  includeAllForAdmin: boolean,
): T[] {
  if (includeAllForAdmin) return actions;
  return actions.filter(a => !ADMIN_ONLY_TRIGGERS.has(a.actionCode));
}
