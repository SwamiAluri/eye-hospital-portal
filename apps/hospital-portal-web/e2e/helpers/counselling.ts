import { type Page, expect, test } from '@playwright/test';

export const COUNSELLING_SESSION_ID = process.env.E2E_COUNSELLING_SESSION_ID ?? '';

/** Mirrors `coverage-test-ids.ts` for Playwright helpers (no src imports in e2e). */
export const coverageTestIds = {
  insurerName: 'coverage-insurer-name',
  /** @deprecated Wave 2C — use estimateMirrorPayable */
  estimatedAmount: 'coverage-estimated-amount',
  estimateMirror: 'coverage-estimate-mirror',
  estimateMirrorPayable: 'coverage-estimate-mirror-payable',
  submitToClaims: 'coverage-submit-to-claims',
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

/** Primary workflow stage for the Quote counselling workspace. */
export function counsellingMainTab(page: Page) {
  return counsellingJourneyStage(page, 'quote');
}

/** Primary workflow stage for the Insurance coverage workspace. */
export function coverageMainTab(page: Page) {
  return counsellingJourneyStage(page, 'insurance');
}

/** Return to the counselling workspace from Insurance or Outpatient. */
export async function goCounsellingWorkspace(page: Page): Promise<void> {
  const counsellingVisible = await page
    .locator(
      '#counselling-step-1, [data-testid="counselling-decision-workspace"], [data-testid="counselling-notes-workspace"]',
    )
    .first()
    .isVisible()
    .catch(() => false);
  if (counsellingVisible) return;
  await clickJourneyStage(page, 'quote');
  await expect(page.locator('#counselling-step-1')).toBeVisible({ timeout: 30_000 });
}

/** Open the Insurance (Coverage) workspace via the primary journey navigation. */
export async function goCoverageTab(page: Page): Promise<void> {
  if (await page.getByTestId(coverageTestIds.stepPolicy).isVisible().catch(() => false)) {
    return;
  }
  const insurance = counsellingJourneyStage(page, 'insurance');
  const status = await insurance.getAttribute('data-journey-status');
  if (status === 'skipped') {
    test.skip(true, 'Insurance stage skipped — cash/self-pay session');
  }
  await expect(insurance).toBeVisible({ timeout: 30_000 });

  const navigable = await insurance.getAttribute('data-journey-navigable');
  if (navigable !== 'true') {
    test.skip(
      true,
      `Insurance stage not navigable (status=${status ?? 'unknown'}) — journey requires a complete Decision before Coverage`,
    );
  }

  await insurance.getByRole('button').click();
  await expect(insurance).toHaveAttribute('data-journey-status', 'current', { timeout: 15_000 });
  await expect(page.getByTestId(coverageTestIds.stepPolicy)).toBeVisible({ timeout: 30_000 });
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
  // Journey rail can open Notes directly; do not require Decision workspace first
  // (decision-complete / TPA-waiting fixtures often skip or seal Decision UI).
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

/** Ensure Insurance payment type so the coverage workflow is available. */
export async function ensureInsurancePaymentType(page: Page): Promise<void> {
  const insuranceStage = counsellingJourneyStage(page, 'insurance');
  const status = await insuranceStage.getAttribute('data-journey-status').catch(() => null);
  if (status !== 'skipped') return;

  await goToPhase(page, 'decision');

  const paymentTrigger = page
    .locator('#counselling-step-3')
    .getByRole('combobox')
    .first();
  await expect(paymentTrigger).toBeVisible({ timeout: 15_000 });
  await paymentTrigger.click();
  await page.getByRole('option', { name: /^Insurance$/i }).click();
  await expect(insuranceStage).not.toHaveAttribute('data-journey-status', 'skipped', {
    timeout: 15_000,
  });
}

/** Counselling journey rail stage (Wave 2E-2R primary workflow). */
export function counsellingJourneyStage(
  page: Page,
  stage: 'quote' | 'decision' | 'insurance' | 'notes' | 'close',
) {
  return page.getByTestId(`counselling-journey-stage-${stage}`);
}

/** Open Outpatient Safety via the session chrome access link (not a journey stage). */
export async function goOutpatientSafety(page: Page): Promise<void> {
  const link = page.getByTestId('counselling-outpatient-access');
  await expect(link).toBeVisible({ timeout: 30_000 });
  await link.click();
  await expect(
    page.getByText(/Outpatient Safety Checklist|Loading safety checklist|not configured/i).first(),
  ).toBeVisible({ timeout: 30_000 });
}

/** @deprecated Wave 2A — use counsellingJourneyStage */
export function counsellingPhaseStep(page: Page, phase: CounsellingPhaseId) {
  const stage =
    phase === 'estimate' ? 'quote' : phase === 'decision' ? 'decision' : 'notes';
  return counsellingJourneyStage(page, stage);
}

/** @deprecated Use counsellingPhaseStep — horizontal wizard replaced vertical sidebar. */
export function visiblePhaseControl(page: Page, phase: CounsellingPhaseId) {
  return counsellingPhaseStep(page, phase);
}

/** Navigate to a counselling session and wait for the primary workflow shell. */
export async function goCounsellingSession(page: Page, sessionId = COUNSELLING_SESSION_ID): Promise<void> {
  await page.goto(counsellingSessionUrl(sessionId), { waitUntil: 'domcontentloaded' });
  // Do not wait for networkidle: counselling session keeps long-lived / slow requests
  // open (e.g. CCMS coverage policies). Readiness is the journey-rail + estimate shell.
  await expect(page.getByTestId('counselling-journey-rail')).toBeVisible({ timeout: 60_000 });
  await expect(counsellingJourneyStage(page, 'quote')).toBeVisible({ timeout: 60_000 });
  const onEstimate = await page.locator('#counselling-step-1').isVisible().catch(() => false);
  if (!onEstimate) {
    await goToPhase(page, 'estimate');
  }
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

/**
 * Live action-bar primary for editable sessions.
 * Kind depends on workflow state: save_session | phase_next | navigate (not always phase-next).
 */
export function actionBarPrimary(page: Page) {
  return page
    .getByTestId('counselling-btn-save-session')
    .or(page.getByTestId('counselling-btn-phase-next'))
    .or(page.getByTestId('counselling-action-bar-primary'));
}

export function actionBar(page: Page) {
  return page.getByTestId('counselling-action-bar');
}

export function actionBarStatusHint(page: Page) {
  return page.getByTestId('counselling-action-bar-status-hint');
}

/** Assert editable session exposes a real primary workflow control (not phase-next-only). */
export async function expectEditablePrimaryWorkflowAction(page: Page): Promise<void> {
  await expect(actionBar(page)).toBeVisible({ timeout: 30_000 });
  await expect(actionBarPrimary(page).first()).toBeVisible({ timeout: 15_000 });
}

/**
 * Terminal Done/Completed footer: Save absent, completed hint, Print available.
 * Do not assert a disabled Save button — production omits Save when sealed.
 */
export async function expectTerminalDoneFooter(page: Page): Promise<void> {
  await expect(actionBar(page)).toBeVisible({ timeout: 60_000 });
  await expect(saveSessionButton(page)).toHaveCount(0);
  await expect(actionBarStatusHint(page)).toContainText(/completed|read-only|Session complete/i);
  await expect(page.getByRole('button', { name: /Print/i })).toBeVisible();
}

export function journeyStage(page: Page, stageId: string) {
  return page.getByTestId(`counselling-journey-stage-${stageId}`);
}

export function quoteFinalPayable(page: Page) {
  return page.getByTestId('counselling-quote-final-payable');
}

export function coverageEstimateMirror(page: Page) {
  return page.getByTestId(coverageTestIds.estimateMirror);
}

export function coverageEstimateMirrorPayable(page: Page) {
  return page.getByTestId(coverageTestIds.estimateMirrorPayable);
}

/** Desktop Estimate rail (Final Payable) or mobile estimate strip.
 * Obsolete: `counselling-quote-panel` is no longer mounted.
 * Terminal Finish-summary sessions hide the Estimate rail; Quote workspace remains.
 */
export async function expectQuotePanelVisible(page: Page): Promise<void> {
  const viewport = page.viewportSize();
  const mobileEstimate = page.getByRole('button', { name: /Estimate/i });
  if (viewport && viewport.width < 1024) {
    await expect(mobileEstimate).toBeVisible({ timeout: 30_000 });
    return;
  }
  const payable = quoteFinalPayable(page);
  if (await payable.isVisible().catch(() => false)) {
    await expect(payable).toBeVisible();
    return;
  }
  // Allow brief paint of Estimate rail before falling back to Quote workspace.
  const appeared = await payable
    .waitFor({ state: 'visible', timeout: 5_000 })
    .then(() => true)
    .catch(() => false);
  if (appeared) {
    await expect(payable).toBeVisible();
    return;
  }
  await expect(page.getByTestId('counselling-quote-workspace')).toBeVisible({ timeout: 30_000 });
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

/** Switch Custom / Package mode in the Build estimate card. */
export async function toggleEstimateMode(page: Page, mode: 'custom' | 'package'): Promise<void> {
  await goToPhase(page, 'estimate');
  const testId = mode === 'custom' ? 'counselling-tab-custom' : 'counselling-tab-package';
  const tab = page.getByTestId(testId);
  await expect(tab).toBeVisible({ timeout: 30_000 });
  await tab.click();
  await expect(tab).toHaveAttribute('aria-current', 'step');
}

async function clickJourneyStage(page: Page, stageId: 'quote' | 'decision' | 'notes'): Promise<void> {
  const stage = counsellingJourneyStage(page, stageId);
  await expect(stage).toBeVisible({ timeout: 15_000 });
  const button = stage.getByRole('button');
  if (await button.isVisible().catch(() => false)) {
    await button.click();
    return;
  }
  await stage.click();
}

/** Click a phase in the session flow (estimate, decision, wrapup). */
export async function goToPhase(page: Page, phase: CounsellingPhaseId): Promise<void> {
  if (phase === 'estimate') {
    if (await page.locator('#counselling-step-1').isVisible().catch(() => false)) {
      return;
    }
    await clickJourneyStage(page, 'quote');
    await expect(page.locator('#counselling-step-1')).toBeVisible({ timeout: 30_000 });
    return;
  }

  if (phase === 'decision') {
    if (await page.getByTestId('counselling-decision-workspace').isVisible().catch(() => false)) {
      return;
    }
    await clickJourneyStage(page, 'decision');
    await expect(page.getByTestId('counselling-decision-workspace')).toBeVisible({ timeout: 30_000 });
    return;
  }

  if (phase === 'wrapup') {
    if (await page.getByTestId('counselling-notes-workspace').isVisible().catch(() => false)) {
      return;
    }
    await clickJourneyStage(page, 'notes');
    await expect(page.getByTestId('counselling-notes-workspace')).toBeVisible({ timeout: 30_000 });
    return;
  }
}

/** Advance to the next phase using the footer Next button. */
export async function goToNextPhase(page: Page): Promise<void> {
  const next = phaseNextButton(page);
  await expect(next).toBeVisible({ timeout: 15_000 });
  await next.click();
}

/** Ensure inline procedure catalog grid is visible on the Custom Procedure tab.
 * Fixtures may already have a procedure selected — Clear returns to the catalog (UI-only).
 */
export async function openProcedureCatalogGrid(page: Page): Promise<void> {
  await toggleEstimateMode(page, 'custom');
  const grid = page.getByTestId('counselling-quote-procedure-catalog-grid');
  if (!(await grid.isVisible().catch(() => false))) {
    const clearSelected = page.getByTestId('counselling-quote-change-procedure');
    await expect(clearSelected).toBeVisible({ timeout: 15_000 });
    await clearSelected.click();
  }
  await expect(grid).toBeVisible({
    timeout: 15_000,
  });
}

/** @deprecated Use openProcedureCatalogGrid — Wave 2F removed the modal/sheet catalogue. */
export async function openProcedureCatalogueSheet(page: Page): Promise<void> {
  return openProcedureCatalogGrid(page);
}

/** Pick first procedure via inline catalog grid search. Returns false if none available. */
export async function selectFirstProcedureFromSearch(page: Page): Promise<boolean> {
  await openProcedureCatalogGrid(page);

  const grid = page.getByTestId('counselling-quote-procedure-catalog-grid');
  const search = grid.getByTestId('counselling-procedure-search');
  await expect(search).toBeVisible({ timeout: 30_000 });

  await search.fill('a');
  const card = grid.getByRole('button', { name: /Select procedure/i }).first();

  if (!(await card.isVisible({ timeout: 10_000 }).catch(() => false))) {
    return false;
  }
  await card.click();
  return true;
}

/** Assert RE/LE/BE eye selector test IDs. */
export async function expectEyeSelectorTestIds(page: Page): Promise<void> {
  await expect(page.getByTestId('counselling-eye-re')).toBeVisible({ timeout: 15_000 });
  await expect(page.getByTestId('counselling-eye-le')).toBeVisible();
  await expect(page.getByTestId('counselling-eye-be')).toBeVisible();
}

/** Assert inline procedure catalog search is visible and accepts input. */
export async function expectProcedureSearchVisible(page: Page): Promise<void> {
  await openProcedureCatalogGrid(page);
  const grid = page.getByTestId('counselling-quote-procedure-catalog-grid');
  const search = grid.getByTestId('counselling-procedure-search');
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
  await expect(page.getByTestId('counselling-tab-package')).toHaveAttribute('aria-current', 'step');
  await toggleEstimateMode(page, 'custom');
  await expect(customTab).toHaveAttribute('aria-current', 'step');
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
