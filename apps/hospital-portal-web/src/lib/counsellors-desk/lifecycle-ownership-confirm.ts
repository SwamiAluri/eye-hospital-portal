/**
 * Phase 3I — explicit lifecycle ownership confirmation copy (Done/Repeat claim).
 * Shown only when CounselorId will change (NULL or other → current).
 */

export function formatCounsellorDisplayName(input: {
  firstName?: string | null;
  lastName?: string | null;
  fallback?: string | null;
}): string {
  const parts = [input.firstName, input.lastName]
    .map((p) => (p == null ? '' : String(p).trim()))
    .filter(Boolean);
  if (parts.length) return parts.join(' ');
  const fallback = input.fallback?.trim();
  return fallback || 'You';
}

export function buildLifecycleOwnershipConfirmCopy(input: {
  kind: 're-evaluate' | 'start-repeat';
  currentOwnerName?: string | null;
  continueAsName: string;
}): {
  title: string;
  currentOwnerLabel: string;
  continueAsLabel: string;
  confirmText: string;
} {
  return {
    title: input.kind === 're-evaluate' ? 'Re-evaluate Session' : 'Start Repeat Session',
    currentOwnerLabel: input.currentOwnerName?.trim() || 'Unassigned',
    continueAsLabel: input.continueAsName,
    confirmText: 'Continue as me',
  };
}

/** True when Processing assign-to-self should open the counselling workflow. */
export function shouldOpenProcessingAfterAssign(input: {
  sessionStatus?: string | null;
  assignedCounselorId?: string | null;
  currentUserId?: string | null;
}): boolean {
  if (input.sessionStatus !== 'Processed') return false;
  const assigned = (input.assignedCounselorId ?? '').trim().toLowerCase();
  const me = (input.currentUserId ?? '').trim().toLowerCase();
  return Boolean(assigned && me && assigned === me);
}
