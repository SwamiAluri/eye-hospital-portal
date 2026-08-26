/** Stable selectors for OT journey E2E (WF-04–06). */
export const OT_TEST_IDS = {
  page: 'ot-page',
  statusTab: (filter: string) => `ot-status-tab-${filter}`,
  journeyRow: (journeyId: string) => `ot-journey-row-${journeyId}`,
  acceptBtn: (journeyId: string) => `ot-accept-btn-${journeyId}`,
  startSurgeryBtn: (journeyId: string) => `ot-start-surgery-btn-${journeyId}`,
  endSurgeryBtn: (journeyId: string) => `ot-end-surgery-btn-${journeyId}`,
  moveToPostOpBtn: (journeyId: string) => `ot-move-postop-btn-${journeyId}`,
  confirmDialog: 'ot-confirm-dialog',
  confirmYes: 'ot-confirm-yes',
  liveState: 'ot-live-state',
  loadError: 'ot-load-error',
  loadRetry: 'ot-load-retry',
  emptyBoard: 'ot-empty',
  emptyFilter: 'ot-empty-filter',
  search: 'ot-search',
} as const;
