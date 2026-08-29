/**
 * Authoritative IP/CCMS "awaiting pre-auth" set.
 * Lifted from CoverageContextBlock so Counselling Waiting List reuses the same SoT
 * instead of inventing a second state list.
 */
export const CCMS_PREAUTH_AWAITING_STATES = [
  'WAITING_APPROVAL',
  'PREAUTH_SENT',
  'CLARIFICATION_REQUIRED',
  'RESUBMITTED',
  'PREAUTH_GENERATED',
] as const;

export type CcmsPreAuthAwaitingState = (typeof CCMS_PREAUTH_AWAITING_STATES)[number];

const AWAITING = new Set<string>(CCMS_PREAUTH_AWAITING_STATES);

/**
 * True when CCMS coverage/pre-auth needs attention (IP rail + counsellor Pre-Auth Queue).
 * Preserves existing IP behavior: decision === 'BLOCK' is actionable even if state is not in the set.
 */
export function isCcmsPreAuthAwaiting(
  state?: string | null,
  decision?: string | null,
): boolean {
  if (decision === 'BLOCK') return true;
  if (!state) return false;
  return AWAITING.has(state.toUpperCase());
}
