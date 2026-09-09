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
 * Auto-open Finish only for sealed completed outcomes.
 * RepeatCounselling uses the Start Session gate instead — do not seal the workspace.
 */
export function shouldAutoOpenFinishSummary(
  queueStatus: WaitingListStatus,
  isSurgeryDoneState = false,
): boolean {
  if (queueStatus === 'RepeatCounselling') return false;
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
      return 'Session saved and marked complete. Finish is the terminal confirmation for this counselling journey.';
    case 'RepeatCounselling':
      return 'Session closed with a repeat-counselling outcome. Start a repeat session from the waiting list when the patient returns.';
    case 'AddOnSurgery':
      return 'Package upgrade recorded. Queue shows add-on surgery counselling.';
    case 'SurgeryDone':
      return 'Linked surgery is complete. This counselling session is read-only.';
    default:
      return 'Counselling has not been completed yet. Use Save session from Notes when ready.';
  }
}
