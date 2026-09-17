import type { WaitingListStatus } from '@/types/counsellors-desk';

/** Terminal counselling outcomes that unlock the Finish summary surface. */
export function isCounsellingTerminalOutcome(
  queueStatus: WaitingListStatus,
  isSurgeryDoneState = false,
): boolean {
  return (
    isSurgeryDoneState ||
    queueStatus === 'Done' ||
    queueStatus === 'RepeatCounselling' ||
    queueStatus === 'AddOnSurgery' ||
    queueStatus === 'SurgeryDone'
  );
}

/**
 * Auto-open Finish for sealed completed outcomes (Done, Repeat, AddOn, SurgeryDone).
 * Start Repeat / Re-evaluate entry is owned by the Waiting List — not an in-session grey gate.
 */
export function shouldAutoOpenFinishSummary(
  queueStatus: WaitingListStatus,
  isSurgeryDoneState = false,
): boolean {
  return isCounsellingTerminalOutcome(queueStatus, isSurgeryDoneState);
}

export function finishOutcomeHeadline(queueStatus: WaitingListStatus): string {
  switch (queueStatus) {
    case 'Done':
      return 'Counselling completed';
    case 'RepeatCounselling':
      return 'Repeat counselling required';
    case 'AddOnSurgery':
      return 'Add-on surgery counselling completed';
    case 'SurgeryDone':
      return 'Surgery completed';
    default:
      return 'Session outcome';
  }
}

export function finishOutcomeDetail(queueStatus: WaitingListStatus): string {
  switch (queueStatus) {
    case 'Done':
      return 'Session completed. Finish is the terminal confirmation for this counselling journey.';
    case 'RepeatCounselling':
      return 'Session closed with a repeat-counselling outcome. Start a repeat session from the waiting list when the patient returns.';
    case 'AddOnSurgery':
      return 'Package upgrade recorded. Queue shows add-on surgery counselling.';
    case 'SurgeryDone':
      return 'Linked surgery is complete. This counselling session is read-only.';
    default:
      return 'Counselling has not been completed yet. Use Complete Session from Notes when ready.';
  }
}
