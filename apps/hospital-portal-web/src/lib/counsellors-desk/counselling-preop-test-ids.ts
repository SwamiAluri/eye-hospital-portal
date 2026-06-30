/** Playwright / QA test IDs for optional counsellor pre-op investigation values (Phase 9). */
export const COUNSELLING_PREOP_TEST_IDS = {
  panel: 'counselling-preop-investigations-panel',
  investigation: (itemKey: string) => `counselling-preop-investigation-${itemKey}`,
  save: 'counselling-preop-investigation-save',
} as const;
