/** Backend-aligned counselling session read permission (CounselingController GETs). */
/** Canonical counselling session mutate permission (Assign, Start, Complete, etc.). */
export const COUNSELLING_SESSIONS_UPDATE_PERMISSION = 'counseling_sessions.update';
export const COUNSELLING_SESSIONS_READ_PERMISSION = 'counseling_sessions.read';
/** Phase 3I Slice 6 — supervisory General Reassign (A→B). Not inherited from .update. */
export const COUNSELLING_SESSIONS_REASSIGN_PERMISSION = 'counseling_sessions.reassign';

/**
 * Counsellor identity — mirrors AuthService counsellor heuristics (role / userType).
 * Used for Assign-to-me and counsellor peer flows.
 */
export function isCounsellorIdentity(input: {
  roles?: string[] | null;
  userType?: string | null;
}): boolean {
  const roles = input.roles ?? [];
  if (
    roles.some(
      (r) => typeof r === 'string' && r.toLowerCase().includes('counsel'),
    )
  ) {
    return true;
  }
  const userType = input.userType?.trim();
  if (userType && userType.toLowerCase().includes('counsel')) {
    return true;
  }
  return false;
}

/**
 * System Administrator / Admin actor for initial assignment (UAT product decision).
 * Distinct from counsellor identity — Admin may assign but does not become owner.
 */
export function isAdminInitialAssignActor(input: {
  roles?: string[] | null;
  userType?: string | null;
}): boolean {
  const roles = input.roles ?? [];
  if (
    roles.some((r) => {
      if (typeof r !== 'string') return false;
      const n = r.toLowerCase();
      return n.includes('admin') || n.includes('administrator');
    })
  ) {
    return true;
  }
  const userType = input.userType?.trim()?.toLowerCase() ?? '';
  return userType.includes('admin') || userType.includes('administrator');
}

/**
 * Phase 3I Slice 3 (UAT-confirmed): initial Assign actors are
 * authorized counsellor OR authorized System Administrator / Admin,
 * with counseling_sessions.update (or *).
 */
export function canShowCounsellingInitialAssign(input: {
  hasUpdatePermission: boolean;
  roles?: string[] | null;
  userType?: string | null;
}): boolean {
  if (!input.hasUpdatePermission) return false;
  return (
    isCounsellorIdentity(input) || isAdminInitialAssignActor(input)
  );
}

/** Assign to me — counsellor identity only (Admin is never owner via this control). */
export function canShowCounsellingAssignToMe(input: {
  roles?: string[] | null;
  userType?: string | null;
}): boolean {
  return isCounsellorIdentity(input);
}

/**
 * Phase 3I Slice 6 — Reassign CTA visibility is permission-based only (PD-S6-01).
 * Do not use role-name "Supervisor" checks.
 */
export function canShowCounsellingReassign(input: {
  hasReassignPermission: boolean;
}): boolean {
  return Boolean(input.hasReassignPermission);
}

/**
 * Waiting List initial Assign eligibility (Slice 3):
 * Pending AND unassigned only.
 * Done/Repeat ownership for lifecycle uses Assign-to-me / claim-for-lifecycle — not this grid Assign CTA.
 */
export function isWaitingListEligibleForInitialAssign(input: {
  status?: string | null;
  counselorId?: string | null;
}): boolean {
  if (input.counselorId) return false;
  return input.status === 'Pending';
}

/**
 * Phase 3I Slice 6 — Waiting List Reassign eligibility (FE gate only; server authoritative).
 * Owned Pending or Processed (Processing/InProgress). Done/Repeat/SurgeryDone excluded.
 */
export function isWaitingListEligibleForReassign(input: {
  status?: string | null;
  counselorId?: string | null;
}): boolean {
  if (!input.counselorId) return false;
  return input.status === 'Pending' || input.status === 'Processed';
}

/** @deprecated Use isCounsellorIdentity — kept for older test imports. */
export const isCounsellingInitialAssignActor = isCounsellorIdentity;
