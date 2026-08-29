import { isCoveragePaymentTypeValue } from '@/lib/counsellors-desk/session-utils';
import { isCcmsPreAuthAwaiting } from '@/lib/ccms/ccms-preauth-awaiting';

/**
 * Counsellor Waiting List — Pre-Auth Queue membership (§4).
 *
 * Coverage/insurance patientType alone is NOT enough.
 * Requires an existing CCMS case whose state is in the IP/CCMS awaiting set.
 */
export function isWaitingListPreAuthQueue(args: {
  patientType?: string | null;
  /** CCMS currentState when a case was returned for the counselling session. */
  ccmsState?: string | null;
  /** False when by-sessions returned no case for this session. */
  hasCcmsCase: boolean;
  /** Optional IP-style decision; BLOCK remains actionable when present. */
  ccmsDecision?: string | null;
}): boolean {
  if (!isCoveragePaymentTypeValue(args.patientType)) return false;
  if (!args.hasCcmsCase) return false;
  return isCcmsPreAuthAwaiting(args.ccmsState, args.ccmsDecision);
}
