import { type Page, expect, test } from '@playwright/test';

export const COUNSELLING_SESSION_ID = process.env.E2E_COUNSELLING_SESSION_ID ?? '';

/** Mirrors `coverage-test-ids.ts` for Playwright helpers (no src imports in e2e). */
export const coverageTestIds = {
  insurerName: 'coverage-insurer-name',
  estimatedAmount: 'coverage-estimated-amount',
  policyOcrPanel: 'policy-card-ocr-panel',
  stepPolicy: 'coverage-step-policy',
  stepEstimate: 'coverage-step-estimate',
  stepDocuments: 'coverage-step-documents',
  visitPoliciesRail: 'coverage-visit-policies-rail',
  manageVisitPolicies: 'coverage-manage-visit-policies',
  visitPolicyAdd: 'visit-policy-add',
  visitPolicyNumber: 'visit-policy-number',
  visitPolicySave: 'visit-policy-save',
  surgeryDate: 'coverage-surgery-date',
  policyExpiryDate: 'coverage-policy-expiry-date',
} as const;

export type CounsellingPhaseId = 'estimate' | 'decision' | 'wrapup';
export type CoverageWizardStepId = 'policy' | 'estimate' | 'documents';

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

/** Coverage & Pre-Auth main tab (visible when payment type requires CCMS). */
export function coverageMainTab(page: Page) {
  return page.getByRole('tab', { name: /Coverage & Pre-Auth/i });
}

/** Open the Coverage & Pre-Auth workspace tab. */
export async function goCoverageTab(page: Page): Promise<void> {
  const tab = coverageMainTab(page);
  await expect(tab).toBeVisible({ timeout: 30_000 });
  await tab.click();
  await expect(tab).toHaveAttribute('data-state', 'active');
}

/** Open Coverage tab and wait for wizard step nav. */
export async function goCoverageTabWithWizard(page: Page): Promise<void> {
  await goCoverageTab(page);
  await expect(coverageWizardStep(page, 'policy')).toBeVisible({ timeout: 30_000 });
}

/** Save counselling session when editable; returns false if read-only. */
export async function saveCounsellingSessionIfEditable(page: Page): Promise<boolean> {
  const saveBtn = saveSessionButton(page);
  if (!(await saveBtn.isEnabled())) return false;
  await saveBtn.click();
  await expect(page.getByText(/saved successfully/i)).toBeVisible({ timeout: 30_000 });
  return true;
}

/** Policy step OCR panel (requires saved counselling + coverage case). */
export function policyOcrPanel(page: Page) {
  return page.getByTestId(coverageTestIds.policyOcrPanel);
}

/** Coverage wizard icon-card step button. */
export function coverageWizardStep(page: Page, step: CoverageWizardStepId) {
  const id =
    step === 'policy'
      ? coverageTestIds.stepPolicy
      : step === 'estimate'
        ? coverageTestIds.stepEstimate
        : coverageTestIds.stepDocuments;
  return page.getByTestId(id);
}

/** Open a Coverage wizard step (Policy / Estimate / Documents). */
export async function goCoverageWizardStep(page: Page, step: CoverageWizardStepId): Promise<void> {
  const btn = coverageWizardStep(page, step);
  await expect(btn).toBeVisible({ timeout: 15_000 });
  await btn.click();
  await expect(btn).toHaveAttribute('aria-current', 'step');
}

/** Visit policies summary → Manage Policies CTA. */
export function manageVisitPoliciesButton(page: Page) {
  return page.getByTestId(coverageTestIds.manageVisitPolicies);
}

/** Right-rail visit policy CRUD section. */
export function visitPoliciesRail(page: Page) {
  return page.getByTestId(coverageTestIds.visitPoliciesRail);
}

export function patientDetailsButton(page: Page) {
  return page.getByTestId('counselling-btn-patient-details');
}

export async function goToSessionNotesPhase(page: Page): Promise<void> {
  await goToPhase(page, 'decision');
  await goToPhase(page, 'wrapup');
  await expect(saveSessionButton(page)).toBeVisible({ timeout: 15_000 });
}

/** @deprecated Use goToSessionNotesPhase */
export async function goToWrapupPhase(page: Page): Promise<void> {
  return goToSessionNotesPhase(page);
}

/** @deprecated Use coverageWizardStep(page, step) — numbered tabs removed in Phase 5. */
export function coverageStepTab(page: Page, _label: RegExp) {
  return page.getByTestId(coverageTestIds.stepEstimate);
}

/** Skip when session save is disabled (read-only fixture). */
export async function skipIfSessionReadOnly(page: Page): Promise<void> {
  const saveBtn = saveSessionButton(page);
  if (!(await saveBtn.isEnabled())) {
    test.skip(true, 'Session is read-only — use a Pending fixture for coverage sync');
  }
}

/** Ensure Insurance payment type so the coverage tab is available. */
export async function ensureInsurancePaymentType(page: Page): Promise<void> {
  await goToPhase(page, 'decision');
  const coverageTab = coverageMainTab(page);
  if (await coverageTab.isVisible().catch(() => false)) return;

  const paymentTrigger = page
    .locator('#counselling-step-3')
    .getByRole('combobox')
    .first();
  await expect(paymentTrigger).toBeVisible({ timeout: 15_000 });
  await paymentTrigger.click();
  await page.getByRole('option', { name: /^Insurance$/i }).click();
  await expect(coverageTab).toBeVisible({ timeout: 15_000 });
}

/** Counselling wizard icon-card step (Build Quote / Patient Decision / Session Notes). */
export function counsellingPhaseStep(page: Page, phase: CounsellingPhaseId) {
  return page.getByTestId(`counselling-phase-${phase}`);
}

/** @deprecated Use counsellingPhaseStep — horizontal wizard replaced vertical sidebar. */
export function visiblePhaseControl(page: Page, phase: CounsellingPhaseId) {
  return counsellingPhaseStep(page, phase);
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

export function saveDraftButton(page: Page) {
  return page.getByTestId('counselling-btn-save-draft');
}

export function counsellingInsuranceSelect(page: Page) {
  return page.getByTestId('counselling-insurance-company');
}

export function coverageInsurerSelect(page: Page) {
  return page.getByTestId('coverage-insurer-name').locator('select');
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
