import type { WaitingListStatus } from '@/types/counsellors-desk';

/**
 * Authoritative Waiting List status derivation (same rules as counsellors-desk.api
 * getWaitingList mapping). Prefer queueStatus when present; fall back to session
 * status for patient-session reads that omit queue hydration.
 */
export function deriveWaitingListStatus(input: {
  queueStatus?: string | null;
  sessionStatus?: string | null;
  patientAgreedToSurgery?: boolean | null;
  otStatus?: string | null;
}): WaitingListStatus {
  if (input.otStatus === 'SurgeryDone') return 'SurgeryDone';

  const rawQueue = (input.queueStatus ?? '').trim();
  if (rawQueue === 'Waiting') return 'Pending';
  if (rawQueue === 'Called' || rawQueue === 'InProgress') return 'Processed';
  if (rawQueue === 'AddOnSurgery') return 'AddOnSurgery';
  if (rawQueue === 'Completed') {
    return input.patientAgreedToSurgery === true ? 'Done' : 'RepeatCounselling';
  }

  const sess = (input.sessionStatus ?? '').trim().toLowerCase();
  if (sess === 'scheduled') return 'Pending';
  if (sess === 'inprogress' || sess === 'in_progress') return 'Processed';
  if (sess === 'completed' || sess === 'done') {
    return input.patientAgreedToSurgery === true ? 'Done' : 'RepeatCounselling';
  }

  // No queue / session signal — treat as Pending (fresh counselling work).
  return 'Pending';
}

/** Statuses that still need counsellor attention on the normal Waiting List. */
export function isWaitingListActionableStatus(status: WaitingListStatus): boolean {
  return (
    status === 'Pending' ||
    status === 'Processed' ||
    status === 'Done' ||
    status === 'RepeatCounselling'
  );
}

/**
 * OT Returned operational attention — unresolved counselling work only.
 * Done remains on the normal Waiting List (Re-evaluate); it is not OT attention.
 * RepeatCounselling / Pending / Processed remain OT-actionable.
 */
export function isOtReturnedActionableStatus(status: WaitingListStatus): boolean {
  return (
    status === 'Pending' ||
    status === 'Processed' ||
    status === 'RepeatCounselling'
  );
}

/** Prefer open/repeat work over Done when multiple sessions exist. */
export function otReturnedLifecyclePriority(status: WaitingListStatus): number {
  switch (status) {
    case 'RepeatCounselling':
      return 4;
    case 'Processed':
      return 3;
    case 'Pending':
      return 2;
    case 'Done':
      return 1;
    default:
      return 0;
  }
}
