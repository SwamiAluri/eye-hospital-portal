/** Stable `data-testid` values for Ward Discharge Workspace (S-09 Shell B). */
export const WARD_DISCHARGE_TEST_IDS = {
  workspace: 'ward-discharge-workspace',
  stepNav: 'ward-discharge-step-nav',
  stepTab: (key: string) => `ward-discharge-step-${key}`,
  btnSave: 'ward-discharge-btn-save',
  btnDischarge: 'ward-discharge-btn-discharge',
  btnOverride: 'ward-discharge-btn-override',
  collectLink: 'ward-discharge-collect-now',
  followupMissing: 'ward-discharge-followup-missing',
  followupBooked: 'ward-discharge-followup-booked',
  btnBookFollowUp: 'ward-discharge-btn-book-followup',
  btnLinkFollowUp: 'ward-discharge-btn-link-followup',
} as const;
