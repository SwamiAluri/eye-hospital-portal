/** CS-03 — Print gating for Repeat Counselling Finish review. */
export function resolveCounsellingPrintDisabledReason(params: {
  isRepeatState: boolean;
  finishSummaryActive: boolean;
  canPrintEstimate: boolean;
}): string | null {
  if (params.isRepeatState && !params.finishSummaryActive) {
    return 'Start repeat session to continue';
  }
  if (params.canPrintEstimate) return null;
  return 'Select a procedure or package to print an estimate';
}
