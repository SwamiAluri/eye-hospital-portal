import type { FinalizeStatus } from '@/types/counsellors-desk';

/** Authoritative backend permission for Finalize OT mutations (CounselingController OT endpoints). */
export const FINALIZE_OT_MUTATE_PERMISSION = 'counseling_sessions.update';

/** Backend permission for Finalize OT list/detail reads. */
export const FINALIZE_OT_READ_PERMISSION = 'counseling_sessions.read';

/**
 * IP checklist permission for outpatient safety checklist edits only.
 * Must NOT gate OT schedule confirm/finalise/prepare/details mutations.
 */
export const FINALIZE_OUTPATIENT_CHECKLIST_EDIT_PERMISSION =
  'counsellor.outpatient_checklist.edit';

function hasCode(permissions: readonly string[] | null | undefined, code: string): boolean {
  if (!permissions?.length) return false;
  if (permissions.includes('*')) return true;
  return permissions.includes(code);
}

/** True when JWT grants OT finalize/prepare/confirm mutations. */
export function canMutateFinalizeOt(
  permissions: readonly string[] | null | undefined,
): boolean {
  return hasCode(permissions, FINALIZE_OT_MUTATE_PERMISSION);
}

/** True when JWT may edit the outpatient safety checklist (separate from OT mutations). */
export function canEditFinalizeOutpatientChecklist(
  permissions: readonly string[] | null | undefined,
): boolean {
  return hasCode(permissions, FINALIZE_OUTPATIENT_CHECKLIST_EDIT_PERMISSION);
}

export function resolveFinalizeOtFormLocked(params: {
  isStatusLocked: boolean;
  canMutateOt: boolean;
}): boolean {
  return params.isStatusLocked || !params.canMutateOt;
}

export function resolveFinalizeChecklistReadOnly(params: {
  isStatusLocked: boolean;
  canEditChecklist: boolean;
}): boolean {
  return params.isStatusLocked || !params.canEditChecklist;
}

type QueuePrimary = {
  label: string;
  action?: 'confirm' | 'finalise' | 'cancel' | 'reopen';
  openModal?: boolean;
  variant?: 'primary' | 'outline' | 'ghost';
};

/**
 * Row primary CTA. Without mutate permission, mutation shortcuts become view-only Open.
 */
export function resolveFinalizeQueuePrimaryAction(
  status: FinalizeStatus,
  canMutateOt: boolean,
): QueuePrimary {
  let primary: QueuePrimary;
  switch (status) {
    case 'NotConfirmed':
      primary = { label: 'Confirm', action: 'confirm', variant: 'primary' };
      break;
    case 'Confirmed':
      primary = { label: 'Finalise', action: 'finalise', variant: 'primary' };
      break;
    case 'Cancelled':
    case 'OTPrepared':
      primary = { label: 'Reopen', action: 'reopen', variant: 'outline' };
      break;
    case 'Finalised':
    case 'SurgeryDone':
    default:
      primary = { label: 'Open', openModal: true, variant: 'ghost' };
      break;
  }

  if (!canMutateOt && primary.action) {
    return { label: 'Open', openModal: true, variant: 'ghost' };
  }
  return primary;
}
