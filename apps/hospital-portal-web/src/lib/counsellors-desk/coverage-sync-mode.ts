import type { CcmsState } from '@/lib/api/ccms/ccms-coverage-cases.api';

export type CoverageSyncMode = 'editable' | 'locked';

const EDITABLE_CCMS_STATES = new Set<CcmsState | string>([
  'DRAFT',
  'ELIGIBILITY_PENDING',
  'ELIGIBILITY_VERIFIED',
  'POLICY_CAPTURED',
]);

const LOCKED_CCMS_STATES = new Set<CcmsState | string>([
  'PREAUTH_SENT',
  'WAITING_APPROVAL',
  'APPROVED',
  'PARTIAL_APPROVAL',
  'REJECTED',
  'EXPIRED',
  'CANCELLED',
  'CLOSED',
  'ABORTED',
]);

/** CCMS workflow lock only — counselling dirty state does not block editing. */
export function resolveCoverageSyncMode(ccmsState?: string | null): CoverageSyncMode {
  if (ccmsState && LOCKED_CCMS_STATES.has(ccmsState)) {
    return 'locked';
  }
  if (!ccmsState || EDITABLE_CCMS_STATES.has(ccmsState)) {
    return 'editable';
  }
  return 'locked';
}

export function isCoverageFormReadOnly(syncMode: CoverageSyncMode, ccmsEditable: boolean): boolean {
  if (syncMode === 'locked') return true;
  return !ccmsEditable;
}

/**
 * Whether the counsellor may upload/replace/remove case documents.
 * Independent of policy/estimate form lock — document collection continues through
 * pre-auth and post-submit states unless the counselling session itself is gated.
 */
export function canMutateCoverageDocuments(options?: {
  forceReadOnly?: boolean;
}): boolean {
  return !options?.forceReadOnly;
}
