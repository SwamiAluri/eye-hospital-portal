/**
 * Phase 3I Slice 12 — Reassignment Required filter helpers (PD-S12-14).
 * Operational condition only — not a counselling lifecycle Status.
 */

export const REASSIGNMENT_REQUIRED_QUERY_PARAM = 'reassignmentRequired';

export function parseReassignmentRequiredParam(value: string | null | undefined): boolean {
  return value === 'true' || value === '1';
}

export function toggleReassignmentRequiredInSearchParams(
  current: URLSearchParams,
  enabled: boolean,
): URLSearchParams {
  const next = new URLSearchParams(current.toString());
  if (enabled) {
    next.set(REASSIGNMENT_REQUIRED_QUERY_PARAM, 'true');
  } else {
    next.delete(REASSIGNMENT_REQUIRED_QUERY_PARAM);
  }
  return next;
}
