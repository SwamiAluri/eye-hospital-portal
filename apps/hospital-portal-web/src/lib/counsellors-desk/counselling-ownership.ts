/**
 * Phase 3I — counselling ownership relation helpers (FE UX only).
 * Backend owner ACL remains Slice 4.
 */

export type OwnershipRelation = 'unassigned' | 'current' | 'other';

export function normalizeId(id?: string | null): string | null {
  if (id == null) return null;
  const trimmed = String(id).trim();
  return trimmed ? trimmed.toLowerCase() : null;
}

/** True when CounselorId is set and equals the authenticated user. */
export function isCounsellingSessionOwner(
  counselorId?: string | null,
  currentUserId?: string | null,
): boolean {
  const owner = normalizeId(counselorId);
  const user = normalizeId(currentUserId);
  if (!owner || !user) return false;
  return owner === user;
}

export function resolveOwnershipRelation(
  counselorId?: string | null,
  currentUserId?: string | null,
): OwnershipRelation {
  const owner = normalizeId(counselorId);
  if (!owner) return 'unassigned';
  const user = normalizeId(currentUserId);
  if (user && owner === user) return 'current';
  return 'other';
}

/**
 * Waiting List Done/Repeat CTA ownership path (FE decision only).
 * Server remains authoritative for claim-for-lifecycle.
 * No peer target — claim always assigns to current actor.
 * NULL and other-owner both use claim-for-lifecycle (not Slice 3 Assign).
 */
export type LifecycleOwnershipDecision =
  | { path: 'continue' }
  | { path: 'claim'; expectedCounselorId: string | null }
  | { path: 'blocked'; reason: 'not-counsellor' | 'missing-owner' };

export function resolveLifecycleOwnershipDecision(input: {
  counselorId?: string | null;
  currentUserId?: string | null;
  canAssignToMe: boolean;
}): LifecycleOwnershipDecision {
  const ownership = resolveOwnershipRelation(input.counselorId, input.currentUserId);
  if (ownership === 'current') return { path: 'continue' };
  if (!input.canAssignToMe || !normalizeId(input.currentUserId)) {
    return { path: 'blocked', reason: 'not-counsellor' };
  }
  if (ownership === 'unassigned') return { path: 'claim', expectedCounselorId: null };
  const expected = normalizeId(input.counselorId);
  if (!expected) return { path: 'blocked', reason: 'missing-owner' };
  // Preserve original casing for API expectedCounselorId (GUID string from row).
  return { path: 'claim', expectedCounselorId: String(input.counselorId).trim() };
}

/**
 * FE read-only ownership overlay (not backend security).
 * Unassigned active work (Pending/Processed) and other-owner sessions are sealed for mutation.
 * Workflow-sealed states (Done/Repeat/AddOn/SurgeryDone) remain sealed by callers.
 */
export function isOwnershipReadOnly(input: {
  counselorId?: string | null;
  currentUserId?: string | null;
  queueStatus?: string | null;
}): boolean {
  const ownership = resolveOwnershipRelation(input.counselorId, input.currentUserId);
  if (ownership === 'other') return true;
  if (ownership === 'unassigned') {
    const status = input.queueStatus ?? '';
    return status === 'Pending' || status === 'Processed';
  }
  return false;
}

/**
 * PD-PENDING-READONLY-01 — Pending queue status seals counselling-content edits until
 * explicit Start Counseling (Auth StartSession → Processing/InProgress).
 * Based on persisted queue status only — never query params.
 */
export function isPendingLifecycleReadOnly(queueStatus?: string | null): boolean {
  return (queueStatus ?? '') === 'Pending';
}

/** Shared disabled-action copy for sealed / non-owner counselling content. */
export const COUNSELLING_CONTENT_READ_ONLY_REASON = 'Session is read-only';

/**
 * FE gate for Save Draft CTA + handleSaveDraft early-return.
 * Ownership lock must disable Save Draft for viewable non-owners (Admin included).
 * Does not grant mutation rights — backend owner ACL remains authoritative.
 */
export function resolveSaveDraftDisabledReason(input: {
  isSurgeryDoneState: boolean;
  pendingLocksMutations: boolean;
  ownershipLocksMutations: boolean;
  isSaving: boolean;
  isSavingDraft: boolean;
  isRepeatState: boolean;
}): string | null {
  if (input.isSurgeryDoneState) return COUNSELLING_CONTENT_READ_ONLY_REASON;
  if (input.ownershipLocksMutations) return COUNSELLING_CONTENT_READ_ONLY_REASON;
  if (input.pendingLocksMutations) return 'Start counselling to continue';
  if (input.isSaving || input.isSavingDraft) return 'Saving…';
  if (input.isRepeatState) return 'Start repeat session to continue';
  return null;
}

/**
 * FE gate for Complete Session CTA.
 * Ownership / pending / surgery-done seals take precedence over decision validation.
 */
export function resolveCompleteSessionDisabledReason(input: {
  isSurgeryDoneState: boolean;
  pendingLocksMutations: boolean;
  ownershipLocksMutations: boolean;
  isSaving: boolean;
  isSavingDraft: boolean;
  decisionValidationError: string | null;
}): string | null {
  if (input.isSurgeryDoneState) return COUNSELLING_CONTENT_READ_ONLY_REASON;
  if (input.ownershipLocksMutations) return COUNSELLING_CONTENT_READ_ONLY_REASON;
  if (input.pendingLocksMutations) return 'Start counselling to continue';
  if (input.isSaving) return 'Completing session…';
  if (input.isSavingDraft) return 'Saving…';
  return input.decisionValidationError;
}
