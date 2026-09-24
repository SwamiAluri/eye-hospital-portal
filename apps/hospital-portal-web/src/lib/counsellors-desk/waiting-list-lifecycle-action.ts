import type { WaitingListStatus } from '@/types/counsellors-desk';
import { isCoveragePaymentTypeValue } from '@/lib/counsellors-desk/session-utils';
import { isWaitingListEligibleForInitialAssign } from '@/lib/counsellors-desk/counselling-auth';
import { resolveOwnershipRelation } from '@/lib/counsellors-desk/counselling-ownership';

export type WaitingListLifecycleActionKind =
  | 'assign'
  | 'open'
  | 'view'
  | 'continue'
  | 're-evaluate'
  | 'start-repeat'
  | 'preauth';

export type WaitingListLifecycleAction = {
  label: string;
  kind: WaitingListLifecycleActionKind;
};

/**
 * Phase 3I — Waiting List primary CTA (ownership-safe).
 * Pending/Processing + NULL → Assign.
 * PD-B: unassigned RepeatCounselling + canAssign → Assign (Admin/explicit Assign).
 * Done always exposes Re-evaluate (claim-for-lifecycle when ownership would change).
 * Owned / peer RepeatCounselling → Start Repeat.
 */
export function resolveWaitingListLifecycleAction(input: {
  status: WaitingListStatus;
  counselorId?: string | null;
  currentUserId?: string | null;
  activeTab: string;
  patientType?: string | null;
  canAssign?: boolean;
}): WaitingListLifecycleAction {
  if (
    input.activeTab === 'PreAuthQueue' &&
    isCoveragePaymentTypeValue(input.patientType)
  ) {
    return { label: 'Pre-Auth', kind: 'preauth' };
  }

  const ownership = resolveOwnershipRelation(input.counselorId, input.currentUserId);
  const canAssign = input.canAssign !== false;

  if (
    canAssign &&
    isWaitingListEligibleForInitialAssign({
      status: input.status,
      counselorId: input.counselorId,
    })
  ) {
    return { label: 'Assign', kind: 'assign' };
  }

  switch (input.status) {
    case 'Pending':
      if (ownership === 'current') return { label: 'Start Counseling', kind: 'open' };
      return { label: 'View', kind: 'view' };
    case 'Processed':
      if (ownership === 'current') return { label: 'Continue', kind: 'continue' };
      return { label: 'View', kind: 'view' };
    case 'Done':
      return { label: 'Re-evaluate', kind: 're-evaluate' };
    case 'RepeatCounselling':
      return { label: 'Start Repeat', kind: 'start-repeat' };
    case 'AddOnSurgery':
    case 'SurgeryDone':
      return { label: 'View', kind: 'view' };
    default:
      return { label: 'View', kind: 'view' };
  }
}
