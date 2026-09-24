/**
 * Phase 3I Slice 11 — Analytics My Work / Authorized Branch scope helpers.
 * Scope filter only — not entitlement (PD-ANALYTICS-01 / PD-S11-10).
 */

export const ANALYTICS_AUTHORIZED_BRANCH_LABEL = 'Authorized Branch';
export const ANALYTICS_MY_WORK_LABEL = 'My Work';

/**
 * PD-S11-08 — default counselor filter from reassign capability.
 * has reassign → Authorized Branch (null); else → My Work (current user id).
 */
export function resolveInitialAnalyticsCounselorId(input: {
  hasReassignPermission: boolean;
  currentUserId: string | null | undefined;
}): string | null {
  if (input.hasReassignPermission) return null;
  const id = input.currentUserId?.trim();
  return id ? id : null;
}

/**
 * Display label for the active counselor scope control.
 */
export function analyticsCounselorScopeLabel(input: {
  counselorId: string | null;
  currentUserId: string | null | undefined;
  selectedCounselorName?: string | null;
}): string {
  if (!input.counselorId) return ANALYTICS_AUTHORIZED_BRANCH_LABEL;
  if (
    input.currentUserId &&
    input.counselorId === input.currentUserId
  ) {
    return ANALYTICS_MY_WORK_LABEL;
  }
  return (
    input.selectedCounselorName?.trim() ||
    input.counselorId
  );
}
