import { type Page, expect } from '@playwright/test';

export const COUNSELLING_SESSION_ID = process.env.E2E_COUNSELLING_SESSION_ID ?? '';

export type CounsellingPhaseId = 'estimate' | 'decision' | 'wrapup';

export function hasCounsellingFixture(): boolean {
  return Boolean(COUNSELLING_SESSION_ID);
}

export function counsellingSessionUrl(sessionId = COUNSELLING_SESSION_ID): string {
  return `/dashboard/counsellors-desk/${sessionId}`;
}

/** Main counselling workspace tab (Radix TabsTrigger → role=tab). */
export function counsellingMainTab(page: Page) {
  return page.getByRole('tab', { name: 'Counselling', exact: true });
}

/** Desktop sidebar phase control (avoids duplicate ids from mobile pills). */
export function visiblePhaseControl(page: Page, phase: CounsellingPhaseId) {
  return page.locator('nav.hidden.lg\\:block').getByTestId(`counselling-phase-${phase}`);
}

/** Navigate to a counselling session and wait for the counselling workspace shell. */
export async function goCounsellingSession(page: Page, sessionId = COUNSELLING_SESSION_ID): Promise<void> {
  await page.goto(counsellingSessionUrl(sessionId), { waitUntil: 'domcontentloaded' });
  await page.waitForLoadState('networkidle').catch(() => undefined);
  await expect(counsellingMainTab(page)).toBeVisible({ timeout: 60_000 });
  await expect(visiblePhaseControl(page, 'estimate')).toBeVisible({ timeout: 60_000 });
  await goToPhase(page, 'estimate');
  await expect(page.locator('#counselling-step-1')).toBeVisible({ timeout: 30_000 });
}

export function saveSessionButton(page: Page) {
  return page.getByTestId('counselling-btn-save-session');
}

export function phaseNextButton(page: Page) {
  return page.getByTestId('counselling-btn-phase-next');
}

/** Desktop quote aside or mobile estimate bottom-sheet strip. */
export async function expectQuotePanelVisible(page: Page): Promise<void> {
  const desktopQuote = page.getByTestId('counselling-quote-panel');
  const mobileEstimate = page.getByRole('button', { name: /Estimate/i });
  await expect(desktopQuote.or(mobileEstimate).first()).toBeVisible({ timeout: 30_000 });
}

/** Expand mobile quote sheet if needed; no-op on desktop. */
export async function openQuotePanel(page: Page): Promise<void> {
  const mobileStrip = page.getByRole('button', { name: /Estimate/i });
  if (await mobileStrip.isVisible().catch(() => false)) {
    const expanded = await page
      .getByTestId('counselling-quote-mode-badge')
      .isVisible()
      .catch(() => false);
    if (!expanded) {
      await mobileStrip.click();
    }
  }
  await expectQuotePanelVisible(page);
}

/** Switch Custom / Package tabs in the Build estimate card. */
export async function toggleEstimateMode(page: Page, mode: 'custom' | 'package'): Promise<void> {
  await goToPhase(page, 'estimate');
  const testId = mode === 'custom' ? 'counselling-tab-custom' : 'counselling-tab-package';
  const tab = page.getByTestId(testId);
  await expect(tab).toBeVisible({ timeout: 30_000 });
  await tab.click();
  await expect(tab).toHaveAttribute('data-state', 'active');
}

/** Click a phase in the session flow (estimate, decision, wrapup). */
export async function goToPhase(page: Page, phase: CounsellingPhaseId): Promise<void> {
  await visiblePhaseControl(page, phase).click();
}

/** Advance to the next phase using the footer Next button. */
export async function goToNextPhase(page: Page): Promise<void> {
  const next = phaseNextButton(page);
  await expect(next).toBeVisible({ timeout: 15_000 });
  await next.click();
}

/** Navigate to wrap-up phase via phase nav (no validation required). */
export async function goToWrapupPhase(page: Page): Promise<void> {
  await goToPhase(page, 'decision');
  await goToPhase(page, 'wrapup');
  await expect(saveSessionButton(page)).toBeVisible({ timeout: 15_000 });
}

/** Pick first procedure via inline catalog search. Returns false if none available. */
export async function selectFirstProcedureFromSearch(page: Page): Promise<boolean> {
  await toggleEstimateMode(page, 'custom');

  const search = page.getByTestId('counselling-procedure-search');
  await expect(search).toBeVisible({ timeout: 30_000 });

  const row = page
    .locator('#counselling-step-1')
    .getByRole('button')
    .filter({ hasText: /₹/ })
    .first();

  if (await row.isVisible({ timeout: 10_000 }).catch(() => false)) {
    await row.click();
    return true;
  }

  await search.fill('a');
  const filteredRow = page
    .locator('#counselling-step-1')
    .getByRole('button')
    .filter({ hasText: /₹/ })
    .first();

  if (!(await filteredRow.isVisible({ timeout: 10_000 }).catch(() => false))) {
    return false;
  }
  await filteredRow.click();
  return true;
}

/** Assert RE/LE/BE eye selector test IDs. */
export async function expectEyeSelectorTestIds(page: Page): Promise<void> {
  await expect(page.getByTestId('counselling-eye-re')).toBeVisible({ timeout: 15_000 });
  await expect(page.getByTestId('counselling-eye-le')).toBeVisible();
  await expect(page.getByTestId('counselling-eye-be')).toBeVisible();
}

/** Assert inline procedure search is visible and accepts input. */
export async function expectProcedureSearchVisible(page: Page): Promise<void> {
  await toggleEstimateMode(page, 'custom');
  const search = page.getByTestId('counselling-procedure-search');
  await expect(search).toBeVisible({ timeout: 30_000 });
  await search.fill('cat');
  await expect(search).toHaveValue('cat');
}

/** @deprecated Use expectProcedureSearchVisible */
export async function expectProcedureComboboxSearchable(page: Page): Promise<void> {
  return expectProcedureSearchVisible(page);
}

/** Assert estimate type tabs switch custom ↔ package. */
export async function expectPricingModeTabs(page: Page): Promise<boolean> {
  await goToPhase(page, 'estimate');
  const customTab = page.getByTestId('counselling-tab-custom');
  if (!(await customTab.isVisible({ timeout: 10_000 }).catch(() => false))) {
    return false;
  }
  await toggleEstimateMode(page, 'package');
  await expect(page.getByTestId('counselling-tab-package')).toHaveAttribute('data-state', 'active');
  await toggleEstimateMode(page, 'custom');
  await expect(customTab).toHaveAttribute('data-state', 'active');
  return true;
}

/** @deprecated Use expectPricingModeTabs */
export async function expectPricingModeSelect(page: Page): Promise<boolean> {
  return expectPricingModeTabs(page);
}

/** @deprecated Use expectPricingModeTabs */
export async function expectPricingModeGlassRadio(page: Page): Promise<boolean> {
  return expectPricingModeTabs(page);
}

/** Toggle first investigation row. Returns false if none. */
export async function toggleFirstInvestigation(page: Page): Promise<boolean> {
  await expect(page.locator('#counselling-step-2')).toBeVisible({ timeout: 30_000 });
  const row = page
    .locator('#counselling-step-2 button')
    .filter({ hasText: /₹/ })
    .first();
  if (!(await row.isVisible({ timeout: 10_000 }).catch(() => false))) {
    return false;
  }
  await row.click();
  return true;
}

/** @deprecated Use goToPhase(page, 'decision') */
export async function goToProgressStep(page: Page, _step: number): Promise<void> {
  if (_step <= 2) {
    await goToPhase(page, 'estimate');
    return;
  }
  await goToPhase(page, 'decision');
}

/** @deprecated Use goToPhase(page, 'decision') */
export async function openFinalizeSection(
  page: Page,
  _key: 'payment' | 'decision' | 'schedule' | 'notes' | 'options',
): Promise<void> {
  await goToPhase(page, 'decision');
}

/** @deprecated Use selectFirstProcedureFromSearch */
export async function selectFirstProcedureFromCombobox(page: Page): Promise<boolean> {
  return selectFirstProcedureFromSearch(page);
}
