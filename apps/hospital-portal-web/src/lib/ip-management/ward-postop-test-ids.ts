/** Stable `data-testid` values for Ward Post-Op Workspace (S-08 Shell B). */
export const WARD_POSTOP_TEST_IDS = {
  workspace: 'ward-postop-workspace',
  /** @deprecated Prefer stepTab('vitals') — kept for e2e phase3 compat. */
  tabOverview: 'ward-postop-tab-overview',
  /** @deprecated Prefer stepTab('nurse') — kept for e2e phase3 compat. */
  tabForm4: 'ward-postop-tab-form4',
  stepNav: 'ward-postop-step-nav',
  stepTab: (key: string) => `ward-postop-step-${key}`,
  btnMarkReady: 'ward-postop-btn-mark-ready',
  btnSave: 'ward-postop-btn-save',
  btnAddTaper: 'ward-postop-btn-add-taper',
  taperEmpty: 'ward-postop-taper-empty',
  taperTable: 'ward-postop-taper-table',
} as const;
