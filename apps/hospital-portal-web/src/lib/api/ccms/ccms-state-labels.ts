/** Human-readable labels for CCMS_MAIN workflow state codes */
export const CCMS_STATE_LABELS: Record<string, string> = {
  DRAFT: 'Draft',
  ELIGIBILITY_PENDING: 'Eligibility Verification',
  ELIGIBILITY_VERIFIED: 'Eligibility Verified',
  POLICY_CAPTURED: 'Policy Captured',
  AUTHORIZATION_REQUIRED: 'Authorization Required',
  PREAUTH_GENERATED: 'Pre-Auth Generated',
  PREAUTH_SENT: 'Pre-Auth Sent',
  WAITING_APPROVAL: 'Waiting for TPA',
  CLARIFICATION_REQUIRED: 'Clarification Required',
  RESUBMITTED: 'Resubmitted',
  APPROVED: 'Approved',
  PARTIAL_APPROVAL: 'Partial Approval',
  ADMISSION_READY: 'Admission Ready',
  ADMITTED: 'Admitted',
  SURGERY_SCHEDULED: 'Surgery Scheduled',
  SURGERY_COMPLETED: 'Surgery Completed',
  BILL_PENDING: 'Bill Pending',
  BILL_FINALIZED: 'Bill Finalized',
  CLAIM_READY: 'Claim Ready',
  CLAIM_SUBMITTED: 'Claim Submitted',
  CLAIM_IN_PROCESS: 'Claim In Process',
  SETTLEMENT_PENDING: 'Settlement Pending',
  PARTIAL_SETTLEMENT: 'Partial Settlement',
  FULL_SETTLEMENT: 'Full Settlement',
  RECONCILED: 'Reconciled',
  CLOSED: 'Case Closed',
  REJECTED: 'Rejected',
  EXPIRED: 'Pre-Auth Expired',
  CANCELLED: 'Cancelled',
  ABORTED: 'Aborted',
  UNKNOWN: 'Unknown state',
};

export function getStateLabel(code: string): string {
  if (!code || code === '(start)') return 'Start';
  return CCMS_STATE_LABELS[code] ?? code.replace(/_/g, ' ');
}

export const TRIGGER_LABELS: Record<string, string> = {
  START: 'Case started',
  VERIFY_ELIGIBILITY: 'Eligibility check started',
  ELIGIBILITY_APPROVED: 'Eligibility approved',
  ELIGIBILITY_FAILED: 'Eligibility failed',
  CAPTURE_POLICY: 'Policy captured',
  REQUIRE_AUTHORIZATION: 'Authorization required',
  GENERATE_PREAUTH: 'Pre-auth generated',
  SEND_PREAUTH: 'Pre-auth sent to TPA',
  WAIT_RESPONSE: 'Awaiting TPA response',
  RECEIVE_APPROVAL: 'TPA approved',
  RECEIVE_PARTIAL: 'TPA partially approved',
  RECEIVE_REJECTION: 'TPA rejected',
  REQUEST_CLARIFICATION: 'Clarification requested',
  RESUBMIT: 'Pre-auth resubmitted',
  PREPARE_ADMISSION: 'Admission prepared',
  ADMIT_PATIENT: 'Patient admitted',
  SCHEDULE_SURGERY: 'Surgery scheduled',
  COMPLETE_SURGERY: 'Surgery completed',
  GENERATE_BILL: 'Bill generation triggered',
  FINALIZE_BILL: 'Bill finalized',
  PREPARE_CLAIM: 'Claim packet prepared',
  SUBMIT_CLAIM: 'Claim submitted',
  CLAIM_ACKNOWLEDGED: 'Claim acknowledged by TPA',
  RECEIVE_SETTLEMENT: 'Settlement received',
  PARTIAL_PAYMENT: 'Partial payment recorded',
  FULL_PAYMENT: 'Full payment received',
  RECONCILE: 'Settlement reconciled',
  CLOSE_CASE: 'Case closed',
  EXPIRE_PREAUTH: 'Pre-auth expired',
  ABORT: 'Case aborted',
  CANCEL: 'Case cancelled',
  COUNSELLOR_REMIND: 'Counsellor reminder',
};

export function getTriggerLabel(code: string): string {
  return TRIGGER_LABELS[code] ?? code.replace(/_/g, ' ');
}

// ── process_status (secondary TPA communication status on authorizations) ──────

export const PROCESS_STATUS_LABELS: Record<string, string> = {
  DRAFT: 'Draft',
  GENERATED: 'Generated',
  SENT: 'Sent',
  ACKNOWLEDGED: 'Acknowledged',
  REPLY_RECEIVED: 'Reply Received',
  CLOSED: 'Closed',
};

export function getProcessStatusLabel(code: string): string {
  return PROCESS_STATUS_LABELS[code] ?? code.replace(/_/g, ' ');
}

// ── Insurance cell desk → current_state mapping ───────────────────────────────

export const PREAUTH_DESK_STATES = {
  READY_TO_SEND: ['PREAUTH_GENERATED'] as string[],
  AWAITING_TPA:  ['PREAUTH_SENT', 'WAITING_APPROVAL', 'RESUBMITTED'] as string[],
  CLARIFICATION: ['CLARIFICATION_REQUIRED'] as string[],
  APPROVED:      ['APPROVED', 'PARTIAL_APPROVAL'] as string[],
} as const;

export type PreAuthDeskFilter = keyof typeof PREAUTH_DESK_STATES | 'ALL';
