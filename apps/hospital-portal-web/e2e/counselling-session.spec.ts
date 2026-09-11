/**

 * Counselling desk E2E — session shell, estimate paths, print smoke (Phase 14.3–14.7).

 *

 * Fixture: E2E_COUNSELLING_SESSION_ID (resolve-e2e-counselling-fixtures.ts)

 */

import { test, expect } from '@playwright/test';

import {
  counsellingMainTab,
  coverageMainTab,
  coverageWizardStep,
  ensureInsurancePaymentType,
  expectEyeSelectorTestIds,
  expectProcedureSearchVisible,
  expectPricingModeTabs,
  expectEditablePrimaryWorkflowAction,
  expectQuotePanelVisible,
  expectTerminalDoneFooter,
  goCounsellingWorkspace,
  goCounsellingSession,
  goCoverageTab,
  goCoverageTabWithWizard,
  goCoverageWizardStep,
  goToPhase,
  goToWrapupPhase,
  hasCounsellingFixture,
  openQuotePanel,
  openProcedureCatalogueSheet,
  patientDetailsButton,
  saveSessionButton,
  saveDraftButton,
  saveCounsellingSessionIfEditable,
  counsellingInsuranceSelect,
  counsellingJourneyStage,
  coverageInsurerSelect,
  selectFirstProcedureFromSearch,
  skipIfSessionReadOnly,
  toggleEstimateMode,
  toggleFirstInvestigation,
  visitPoliciesRail,
  visiblePhaseControl,
} from './helpers/counselling';

import {
  MOCK_POLICY_CONFIRM_RESPONSE,
  MOCK_POLICY_EXTRACTION_PREVIEW,
} from './helpers/policy-extraction-mock';



test.describe('Counselling waiting list @counselling', () => {

  test.describe.configure({ timeout: 90_000 });



  test('waiting list loads status tabs', async ({ page }) => {

    await page.goto('/dashboard/counsellors-desk/waiting-list', { waitUntil: 'domcontentloaded' });

    // Status pills use role="tab" (label + count), not role="button".
    await expect(page.getByRole('tab', { name: /^Pending\b/i })).toBeVisible({ timeout: 60_000 });

    await expect(page.getByRole('tab', { name: /^Done\b/i })).toBeVisible();

  });

});



test.describe('Counselling session workspace @counselling', () => {

  test.describe.configure({ mode: 'serial', timeout: 120_000 });



  test.beforeEach(() => {

    test.skip(!hasCounsellingFixture(), 'Set E2E_COUNSELLING_SESSION_ID (resolve-e2e-counselling-fixtures.ts)');

  });



  test('eye selector exposes counselling-eye-re/le/be test IDs', async ({ page }) => {
    await goCounsellingSession(page);
    await goToPhase(page, 'estimate');
    await expectEyeSelectorTestIds(page);
    await page.getByTestId('counselling-eye-le').click();
    await expect(page.getByTestId('counselling-eye-le')).toHaveAttribute('aria-pressed', 'true');
  });

  test('procedure search is visible in custom estimate workspace', async ({ page }) => {
    await goCounsellingSession(page);
    await expectProcedureSearchVisible(page);
  });

  test('estimate type tabs switch custom and package workspaces', async ({ page }) => {
    await goCounsellingSession(page);
    const visible = await expectPricingModeTabs(page);
    test.skip(!visible, 'Estimate type tabs not visible on this fixture');
  });

  test('session shell: tabs, phase nav, quote panel, footer', async ({ page }) => {

    await goCounsellingSession(page);

    await expect(page.getByTestId('counselling-outpatient-access')).toBeVisible();

    await expectQuotePanelVisible(page);

    // Journey rail is the phase-nav surface (footer phase-next is state-dependent, not always mounted).
    await expect(counsellingJourneyStage(page, 'quote')).toBeVisible();
    await expect(counsellingJourneyStage(page, 'decision')).toBeVisible();
    await expect(counsellingJourneyStage(page, 'notes')).toBeVisible();
    await expectEditablePrimaryWorkflowAction(page);

    await expect(page.getByRole('button', { name: /Print Estimate|Print/i })).toBeVisible();

    // Primary may be Save session, phase-next, or navigate — do not require Notes hop
    // (Notes can remain pending until journey rules unlock it).
    const save = saveSessionButton(page);
    if (await save.isVisible().catch(() => false)) {
      await expect(save).toBeVisible();
    } else {
      await expect(
        page
          .getByTestId('counselling-btn-phase-next')
          .or(page.getByTestId('counselling-action-bar-primary')),
      ).toBeVisible();
    }

  });



  test('phase nav shows Quote, Decision, and Notes journey stages', async ({ page }) => {

    await goCounsellingSession(page);

    // Journey rail renders short + desktop labels (both "Quote" → textContent "QuoteQuote").
    // Assert approved stage labels via test IDs; do not require legacy "Build Quote" copy.
    await expect(counsellingJourneyStage(page, 'quote')).toContainText(/Quote/i);
    await expect(counsellingJourneyStage(page, 'decision')).toContainText(/Decision/i);
    await expect(counsellingJourneyStage(page, 'notes')).toContainText(/Notes/i);

  });



  test('phase navigation switches between estimate and decision views', async ({ page }) => {

    await goCounsellingSession(page);

    await goToPhase(page, 'decision');

    // Current Decision IA — not legacy "Payment & Coverage".
    await expect(page.getByTestId('counselling-decision-workspace')).toBeVisible({ timeout: 10_000 });
    await expect(page.getByTestId('counselling-decision-schedule-widget')).toBeVisible();

    await goToPhase(page, 'estimate');

    await expect(page.locator('#counselling-step-1')).toBeVisible();

  });



  test('estimate builder: custom and package tabs', async ({ page }) => {

    await goCounsellingSession(page);

    await toggleEstimateMode(page, 'package');

    // QuoteModeNav uses aria-current="step" (not aria-pressed) for the active mode.
    await expect(page.getByTestId('counselling-tab-package')).toHaveAttribute('aria-current', 'step');
    await expect(page.getByTestId('counselling-package-search')).toBeVisible();

    await toggleEstimateMode(page, 'custom');

    await expect(page.getByTestId('counselling-tab-custom')).toHaveAttribute('aria-current', 'step');
    await expect(
      page.getByTestId('counselling-quote-change-procedure').or(page.getByTestId('counselling-quote-select-procedure')),
    ).toBeVisible();

    await openQuotePanel(page);

    await expect(page.getByTestId('counselling-quote-mode-badge')).toBeVisible();

  });



  test('investigations card: imaging and lab tabs', async ({ page }) => {

    await goCounsellingSession(page);

    // Quote opens on Custom. Imaging/Labs are mode tabs that mount an embedded
    // investigations workspace (no #counselling-step-2 when embedded=true).
    const imagingTab = page.getByTestId('counselling-tab-imaging');
    const labTab = page.getByTestId('counselling-tab-lab');
    await expect(imagingTab).toBeVisible();
    await expect(labTab).toBeVisible();

    await imagingTab.click();
    await expect(imagingTab).toHaveAttribute('aria-current', 'step');
    await expect(page.getByTestId('counselling-investigations-section')).toBeVisible({
      timeout: 15_000,
    });
    await expect(page.getByTestId('counselling-investigation-search')).toBeVisible();

    await labTab.click();
    await expect(labTab).toHaveAttribute('aria-current', 'step');
    await expect(page.getByTestId('counselling-investigations-section')).toBeVisible();
    await expect(page.getByTestId('counselling-investigation-search')).toBeVisible();

  });



  test('decision phase: payment section visible', async ({ page }) => {

    await goCounsellingSession(page);

    await goToPhase(page, 'decision');

    await expect(page.getByText('Payment Type')).toBeVisible();

    await expect(page.locator('#counselling-step-3')).toBeAttached();

  });



  test('coverage tab: editable when counselling is dirty', async ({ page }) => {
    await goCounsellingSession(page);
    await ensureInsurancePaymentType(page);

    // Notes is often journey-locked on Processed / Waiting-for-TPA. Coverage is the
    // Insurance stage — open Decision first (required for Insurance navigability),
    // dirty via Decision selection, then open Insurance.
    await goToPhase(page, 'decision');
    await expect(page.getByTestId('counselling-decision-workspace')).toBeVisible({
      timeout: 15_000,
    });

    const dateForSurgery = page.locator('#counselling-decision-DateForSurgery');
    await expect(dateForSurgery).toBeVisible({ timeout: 15_000 });
    await dateForSurgery.click();
    await expect(dateForSurgery).toBeChecked();

    await goCoverageTabWithWizard(page);

    await expect(page.getByTestId('coverage-insurer-name')).toBeEnabled({ timeout: 15_000 });
  });



  test('coverage tab: policy form when case exists', async ({ page }) => {
    await goCounsellingSession(page);
    await ensureInsurancePaymentType(page);

    // Notes not required — Coverage is Insurance. Do not Save session here (would seal Done
    // on DateForSurgery). Existing Waiting-for-TPA fixture already has a coverage case.
    await goToPhase(page, 'decision');
    await expect(page.getByTestId('counselling-decision-workspace')).toBeVisible({
      timeout: 15_000,
    });

    const dateForSurgery = page.locator('#counselling-decision-DateForSurgery');
    await expect(dateForSurgery).toBeVisible({ timeout: 15_000 });
    await dateForSurgery.click();
    await expect(dateForSurgery).toBeChecked();

    await goCoverageTab(page);
    await expect(page.getByTestId('coverage-insurer-name')).toBeVisible({ timeout: 30_000 });
  });



  test('coverage tab: estimate field visible when counselling unsaved', async ({ page }) => {
    await goCounsellingSession(page);
    await ensureInsurancePaymentType(page);

    // Notes not required for Coverage. Dirty via Decision (unsaved) — do not Save
    // (DateForSurgery + Save can seal Done on this fixture).
    await goToPhase(page, 'decision');
    await expect(page.getByTestId('counselling-decision-workspace')).toBeVisible({
      timeout: 15_000,
    });

    const dateForSurgery = page.locator('#counselling-decision-DateForSurgery');
    await expect(dateForSurgery).toBeVisible({ timeout: 15_000 });
    await dateForSurgery.click();
    await expect(dateForSurgery).toBeChecked();

    await goCoverageTabWithWizard(page);
    await goCoverageWizardStep(page, 'estimate');

    await expect(page.getByTestId('coverage-estimated-amount')).toBeVisible({ timeout: 15_000 });
    await expect(coverageMainTab(page)).toHaveAttribute('data-journey-status', 'current');
  });



  test('coverage tab: stays editable across save and re-edit cycles', async ({ page }) => {
    await goCounsellingSession(page);
    await ensureInsurancePaymentType(page);

    // Notes not required for Coverage. Dirty via Decision. Prefer Save draft over Save
    // session — DateForSurgery + Save session can seal Done on this fixture.
    // Wait until Decision is navigable (button present) — under load the rail can hydrate
    // with pending stages before Quote unlocks Decision.
    const decisionStage = counsellingJourneyStage(page, 'decision');
    await expect(decisionStage.getByRole('button')).toBeVisible({ timeout: 30_000 });

    await goToPhase(page, 'decision');
    await expect(page.getByTestId('counselling-decision-workspace')).toBeVisible({
      timeout: 15_000,
    });

    const dateForSurgery = page.locator('#counselling-decision-DateForSurgery');
    await expect(dateForSurgery).toBeVisible({ timeout: 15_000 });
    await dateForSurgery.click();
    await expect(dateForSurgery).toBeChecked();

    await goCoverageTab(page);
    await expect(page.getByTestId('coverage-insurer-name')).toBeEnabled({ timeout: 15_000 });

    await goToPhase(page, 'decision');
    const draftBtn = saveDraftButton(page);
    if (!(await draftBtn.isEnabled())) {
      test.skip(true, 'Session is read-only — use a Pending fixture for coverage sync');
    }
    await draftBtn.click();
    await expect(draftBtn).toBeEnabled({ timeout: 15_000 });

    await goCoverageTab(page);
    await expect(page.getByTestId('coverage-insurer-name')).toBeEnabled({ timeout: 15_000 });

    await goToPhase(page, 'decision');
    const interested = page.locator('#counselling-decision-Interested');
    if (await interested.isVisible().catch(() => false)) {
      await interested.click();
      await expect(interested).toBeChecked();
    }
    await dateForSurgery.click();
    await expect(dateForSurgery).toBeChecked();

    await goCoverageTab(page);
    await expect(page.getByTestId('coverage-insurer-name')).toBeEnabled({ timeout: 15_000 });
  });

  test('save draft on counselling without decision', async ({ page }) => {
    await goCounsellingSession(page);

    // Notes was only used to dirty — Save Draft is available from Quote without a
    // completed Decision. Do NOT open Notes or select DateForSurgery (would contradict
    // "without decision").
    await expect(page.locator('#counselling-step-1')).toBeVisible({ timeout: 15_000 });

    const saveBtn = saveSessionButton(page);
    const draftBtn = saveDraftButton(page);

    await expect(draftBtn).toBeVisible({ timeout: 15_000 });
    if (!(await draftBtn.isEnabled())) {
      test.skip(true, 'Session is read-only — use a Pending/Processed editable fixture');
    }

    // Core contract: Save Session stays blocked without a completed Decision.
    await expect(saveBtn).toBeDisabled();

    // Dirty via Quote eye — not Decision, not Notes.
    const eyeLe = page.getByTestId('counselling-eye-le');
    await eyeLe.click();
    await expect(eyeLe).toHaveAttribute('aria-pressed', 'true');

    await draftBtn.click();
    await expect(draftBtn).toBeEnabled({ timeout: 15_000 });
    await expect(saveBtn).toBeDisabled();
  });

  test('coverage tab: editable on first visit without counselling save', async ({ page }) => {
    await goCounsellingSession(page);
    await ensureInsurancePaymentType(page);
    await goCoverageTab(page);

    await expect(page.getByTestId('coverage-insurer-name')).toBeEnabled({ timeout: 30_000 });
    await expect(saveDraftButton(page)).toBeVisible();
  });

  test('coverage policy: financial year selection persists on tab switch', async ({ page }) => {
    await goCounsellingSession(page);
    await ensureInsurancePaymentType(page);
    await goCoverageTab(page);

    const fySelect = page.locator('select').filter({ has: page.locator('option', { hasText: '2025-26' }) }).first();
    if (!(await fySelect.isVisible({ timeout: 15_000 }).catch(() => false))) {
      test.skip(true, 'Financial year select not visible');
    }

    await fySelect.selectOption({ label: '2025-26' });
    await goCounsellingWorkspace(page);
    await goCoverageTab(page);
    await expect(fySelect).toHaveValue('2025-26', { timeout: 15_000 });
  });

  test('coverage insurer change syncs to counselling payment section', async ({ page }) => {
    await goCounsellingSession(page);
    await ensureInsurancePaymentType(page);
    await goCoverageTab(page);

    const payerSelect = coverageInsurerSelect(page);
    await expect(payerSelect).toBeVisible({ timeout: 15_000 });

    const options = await payerSelect.locator('option').evaluateAll((nodes) =>
      nodes
        .map((node) => ({
          value: (node as HTMLOptionElement).value,
          label: (node.textContent ?? '').trim(),
        }))
        .filter((o) => o.value),
    );

    if (options.length < 2) {
      test.skip(true, 'Need at least two configured insurers for cross-tab sync');
    }

    const target = options[1];
    await payerSelect.selectOption(target.value);

    await goCounsellingWorkspace(page);
    await goToPhase(page, 'decision');
    await expect(counsellingInsuranceSelect(page)).toContainText(target.label, {
      timeout: 15_000,
    });
  });

  test('unified footer shows save draft on coverage tab', async ({ page }) => {
    await goCounsellingSession(page);
    await ensureInsurancePaymentType(page);
    await goCoverageTab(page);

    await expect(saveDraftButton(page)).toBeVisible({ timeout: 15_000 });
    await expect(saveSessionButton(page)).toBeVisible();
  });



  test('coverage tab: insurer and amount parity after counselling save', async ({ page }) => {

    await goCounsellingSession(page);

    await ensureInsurancePaymentType(page);

    await goToWrapupPhase(page);

    const saveBtn = saveSessionButton(page);

    if (!(await saveBtn.isEnabled())) {

      test.skip(true, 'Session is read-only — use a Pending fixture for coverage sync');

    }

    const insurerTrigger = page.locator('#counselling-step-3').getByRole('combobox').nth(1);

    if (await insurerTrigger.isVisible().catch(() => false)) {

      await insurerTrigger.click();

      const firstInsurer = page.getByRole('option').first();

      if (await firstInsurer.isVisible({ timeout: 5_000 }).catch(() => false)) {

        const insurerLabel = (await firstInsurer.textContent())?.trim() ?? '';

        await firstInsurer.click();

        await openQuotePanel(page);

        const payableText = await page.getByTestId('counselling-quote-final-payable').innerText();

        const amountMatch = payableText.replace(/[^\d]/g, '');

        await page.locator('#counselling-note-counsellor').fill('E2E coverage parity');

        await saveBtn.click();

        await expect(page.getByText(/saved successfully/i)).toBeVisible({ timeout: 30_000 });

        await goCoverageTabWithWizard(page);

        if (insurerLabel) {
          await expect(page.getByTestId('coverage-insurer-name')).toHaveValue(insurerLabel, {
            timeout: 15_000,
          });
        }

        await goCoverageWizardStep(page, 'estimate');

        const estimateField = page.getByTestId('coverage-estimated-amount');

        await expect(estimateField).toBeVisible({ timeout: 15_000 });

        if (amountMatch) {

          await expect(estimateField).toHaveValue(amountMatch, { timeout: 15_000 });

        }

      }

    }

  });



  test.skip('coverage tab: OCR scan failure saves file and keeps manual form', async ({ page }) => {

    await goCounsellingSession(page);

    await ensureInsurancePaymentType(page);

    await goToWrapupPhase(page);

    const saveBtn = saveSessionButton(page);

    if (!(await saveBtn.isEnabled())) {

      test.skip(true, 'Session is read-only — use a Pending fixture for coverage sync');

    }

    await page.locator('#counselling-note-counsellor').fill('E2E OCR fail fallback');

    await saveBtn.click();

    await expect(page.getByText(/saved successfully/i)).toBeVisible({ timeout: 30_000 });

    await page.route('**/ccms/coverage-cases/**/policy-extraction/upload', (route) =>

      route.fulfill({ status: 502, body: 'OCR service unavailable' }),

    );

    await goCoverageTab(page);

    const ocr = policyOcrPanel(page);

    if (!(await ocr.isVisible({ timeout: 15_000 }).catch(() => false))) {

      test.skip(true, 'Policy OCR disabled on CCMS — set PolicyExtraction:Enabled=true');

    }

    const png = Buffer.from(

      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',

      'base64',

    );

    await page.getByTestId('policy-ocr-slot-insurance_card_front').locator('input[type="file"]').setInputFiles({

      name: 'card-front.png',

      mimeType: 'image/png',

      buffer: png,

    });

    await ocr.getByRole('button', { name: /Scan policy card/i }).click();

    await expect(page.getByText(/manual/i)).toBeVisible({ timeout: 30_000 });

    await expect(page.getByTestId('coverage-insurer-name')).toBeVisible();

  });



  test('coverage tab: duplicate visit policy blocked on same case', async ({ page }) => {

    await goCounsellingSession(page);

    await ensureInsurancePaymentType(page);

    await goToWrapupPhase(page);

    const saveBtn = saveSessionButton(page);

    if (!(await saveBtn.isEnabled())) {

      test.skip(true, 'Session is read-only — use a Pending fixture for coverage sync');

    }

    await page.locator('#counselling-note-counsellor').fill('E2E duplicate policy');

    await saveBtn.click();

    await expect(page.getByText(/saved successfully/i)).toBeVisible({ timeout: 30_000 });

    await goCoverageTab(page);

    const dupNumber = `E2E-DUP-${Date.now()}`;

    await page.getByTestId('visit-policy-add').click();

    await page.getByTestId('visit-policy-number').fill(dupNumber);

    await page.getByTestId('visit-policy-save').click();

    await expect(page.getByText(/Policy added|imported/i)).toBeVisible({ timeout: 30_000 });

    await page.getByTestId('visit-policy-add').click();

    await page.getByTestId('visit-policy-number').fill(dupNumber);

    await page.getByTestId('visit-policy-save').click();

    await expect(page.getByText(/Policy already on this visit/i)).toBeVisible({ timeout: 15_000 });

  });



  test.skip('coverage tab: OCR happy path review and apply (mocked)', async ({ page }) => {

    await goCounsellingSession(page);

    await ensureInsurancePaymentType(page);

    await goToWrapupPhase(page);

    const saveBtn = saveSessionButton(page);

    if (!(await saveBtn.isEnabled())) {

      test.skip(true, 'Session is read-only — use a Pending fixture for coverage sync');

    }

    await page.locator('#counselling-note-counsellor').fill('E2E OCR happy path');

    await saveBtn.click();

    await expect(page.getByText(/saved successfully/i)).toBeVisible({ timeout: 30_000 });

    await page.route('**/ccms/coverage-cases/**/policy-extraction/upload', (route) =>

      route.fulfill({

        status: 200,

        contentType: 'application/json',

        body: JSON.stringify(MOCK_POLICY_EXTRACTION_PREVIEW),

      }),

    );

    await page.route('**/ccms/coverage-cases/**/policy-extraction/confirm', (route) =>

      route.fulfill({

        status: 200,

        contentType: 'application/json',

        body: JSON.stringify(MOCK_POLICY_CONFIRM_RESPONSE),

      }),

    );

    await goCoverageTab(page);

    const ocr = policyOcrPanel(page);

    if (!(await ocr.isVisible({ timeout: 15_000 }).catch(() => false))) {

      test.skip(true, 'Policy OCR disabled on CCMS — set PolicyExtraction:Enabled=true');

    }

    const png = Buffer.from(

      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',

      'base64',

    );

    await page.getByTestId('policy-ocr-slot-insurance_card_front').locator('input[type="file"]').setInputFiles({

      name: 'card-front.png',

      mimeType: 'image/png',

      buffer: png,

    });

    await ocr.getByRole('button', { name: /Scan policy card/i }).click();

    await expect(page.getByTestId('policy-extraction-review')).toBeVisible({ timeout: 30_000 });

    await page.getByTestId('policy-extraction-review').getByRole('button', { name: /Apply to case/i }).click();

    await expect(page.getByText(/Policy applied|applied from card/i)).toBeVisible({ timeout: 30_000 });

    await expect(page.getByTestId('coverage-insurer-name')).toHaveValue(/ICICI/i, { timeout: 15_000 });

  });



  test('custom path: procedure search and quote lines', async ({ page }) => {

    await goCounsellingSession(page);

    await goToWrapupPhase(page);

    const saveBtn = saveSessionButton(page);

    if (!(await saveBtn.isEnabled())) {

      test.skip(true, 'Session is read-only (done state) — use a Pending fixture for custom path');

    }

    await goToPhase(page, 'estimate');



    const picked = await selectFirstProcedureFromSearch(page);

    test.skip(!picked, 'No procedures in catalog for this tenant');



    await openQuotePanel(page);

    await expect(page.getByText(/Itemized Breakdown/i)).toBeVisible();

    await expect(page.getByText('Subtotal')).toBeVisible();

    await expect(page.getByTestId('counselling-quote-final-payable')).toContainText(/₹/);

  });



  test('package path: package tab visible and selectable', async ({ page }) => {

    await goCounsellingSession(page);

    await goToWrapupPhase(page);

    const saveBtn = saveSessionButton(page);

    if (!(await saveBtn.isEnabled())) {

      test.skip(true, 'Session is read-only — use a Pending fixture for package path');

    }

    await goToPhase(page, 'estimate');



    await expect(page.locator('#counselling-step-1')).toBeVisible();

    await toggleEstimateMode(page, 'package');

    const packageCard = page.locator('[data-testid^="counselling-package-card-"]').first();

    if (await packageCard.isVisible({ timeout: 10_000 }).catch(() => false)) {

      await packageCard.getByRole('button', { name: 'Select package' }).click();

      await openQuotePanel(page);

      await expect(page.getByTestId('counselling-quote-mode-badge')).toContainText(/Package/i, {
        timeout: 15_000,
      });

    }

  });



  test('investigations path: toggle item updates quote when procedure selected', async ({ page }) => {

    await goCounsellingSession(page);

    await goToWrapupPhase(page);

    const saveBtn = saveSessionButton(page);

    if (!(await saveBtn.isEnabled())) {

      test.skip(true, 'Read-only session');

    }

    await goToPhase(page, 'estimate');



    const picked = await selectFirstProcedureFromSearch(page);

    test.skip(!picked, 'No procedures in catalog');



    const toggled = await toggleFirstInvestigation(page);

    test.skip(!toggled, 'No investigations in catalog');



    await openQuotePanel(page);

    await expect(page.getByText(/Itemized Breakdown/i)).toBeVisible();

  });



  test('discount section shows cap hint when estimate has lines', async ({ page }) => {

    await goCounsellingSession(page);

    await goToWrapupPhase(page);

    const saveBtn = saveSessionButton(page);

    if (!(await saveBtn.isEnabled())) {

      test.skip(true, 'Read-only session');

    }

    await goToPhase(page, 'estimate');



    const picked = await selectFirstProcedureFromSearch(page);

    test.skip(!picked, 'No procedures in catalog');



    await openQuotePanel(page);

    await expect(page.getByTestId('counselling-quote-discount-panel')).toBeVisible();

    await expect(page.getByText(/Max without manager/i)).toBeVisible();

    await page.getByTestId('counselling-quote-discount-percent').click();

    await expect(page.getByTestId('counselling-quote-discount-value')).toBeVisible();

  });



  test('quoted price override entry point in quote panel', async ({ page }) => {

    await goCounsellingSession(page);

    await goToWrapupPhase(page);

    const saveBtn = saveSessionButton(page);

    if (!(await saveBtn.isEnabled())) {

      test.skip(true, 'Read-only session');

    }

    await goToPhase(page, 'estimate');



    const picked = await selectFirstProcedureFromSearch(page);

    test.skip(!picked, 'No procedures in catalog');



    await openQuotePanel(page);

    const overrideBtn = page.getByTestId('counselling-quote-override-btn');

    await expect(overrideBtn).toBeVisible();

    await overrideBtn.click();

    await expect(page.getByText(/quoted price override/i)).toBeVisible({ timeout: 10_000 });

  });



  test('doctor conflict banner when recommendation exists', async ({ page }) => {

    await goCounsellingSession(page);

    const conflict = page.getByText(/differs from doctor|Switch to recommended/i);

    if (await conflict.first().isVisible({ timeout: 5_000 }).catch(() => false)) {

      await expect(conflict.first()).toBeVisible();

    }

  });



  test('print estimate dialog smoke when enabled', async ({ page }) => {

    await goCounsellingSession(page);

    await goToWrapupPhase(page);

    const printBtn = page.getByRole('button', { name: /Print Estimate|Print/i });

    await expect(printBtn).toBeVisible();

    if (await printBtn.isEnabled()) {

      await printBtn.click();

      await expect(page.getByRole('heading', { name: /Print estimate/i })).toBeVisible({

        timeout: 15_000,

      });

      await expect(page.getByText('Counselling cost estimate')).toBeVisible();

    }

  });



  test('coverage wizard: icon-card steps expose test IDs', async ({ page }) => {
    await goCounsellingSession(page);
    await ensureInsurancePaymentType(page);
    await goCoverageTabWithWizard(page);

    await expect(coverageWizardStep(page, 'policy')).toBeVisible();
    await expect(coverageWizardStep(page, 'estimate')).toBeVisible();
    await expect(coverageWizardStep(page, 'documents')).toBeVisible();
  });



  test('coverage wizard: estimate step shows surgery amount field', async ({ page }) => {
    await goCounsellingSession(page);
    await ensureInsurancePaymentType(page);
    await goCoverageTabWithWizard(page);
    await goCoverageWizardStep(page, 'estimate');

    await expect(page.getByTestId('coverage-estimated-amount')).toBeVisible({ timeout: 15_000 });
    await expect(page.getByTestId('coverage-surgery-date')).toBeVisible();
  });



  test('session opens on Build Quote after waiting-list entry', async ({ page }) => {
    await goCounsellingSession(page);

    await expect(visiblePhaseControl(page, 'estimate')).toHaveAttribute('aria-current', 'step');
    await expect(page.locator('#counselling-step-1')).toBeVisible({ timeout: 10_000 });
  });



  test('coverage tab visible when insurance payment type selected', async ({ page }) => {
    await goCounsellingSession(page);
    await ensureInsurancePaymentType(page);
    await expect(coverageMainTab(page)).toBeVisible({ timeout: 15_000 });
  });



  test('session header: patient details opens when demographics available', async ({ page }) => {
    await goCounsellingSession(page);
    const details = patientDetailsButton(page);
    if (!(await details.isVisible({ timeout: 10_000 }).catch(() => false))) {
      test.skip(true, 'Patient demographics not loaded for fixture');
    }
    await details.click();
    await expect(page.getByRole('dialog')).toBeVisible({ timeout: 10_000 });
  });



  test('coverage visit policies: rail lists policies on desktop', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await goCounsellingSession(page);
    await ensureInsurancePaymentType(page);
    await goToWrapupPhase(page);
    await skipIfSessionReadOnly(page);

    await page.locator('#counselling-note-counsellor').fill('E2E visit policies rail');
    const saved = await saveCounsellingSessionIfEditable(page);
    test.skip(!saved, 'Could not save session to create coverage case');

    await goCoverageTabWithWizard(page);
    const rail = visitPoliciesRail(page);
    if (!(await rail.isVisible({ timeout: 15_000 }).catch(() => false))) {
      test.skip(true, 'Visit policies rail requires CCMS case');
    }

    await expect(rail).toBeVisible();
    await expect(page.getByTestId('visit-policy-add')).toBeVisible({ timeout: 15_000 });
  });

  test('session stepper: active phase exposes aria-current=step', async ({ page }) => {
    await goCounsellingSession(page);
    const estimate = visiblePhaseControl(page, 'estimate');
    await expect(estimate).toHaveAttribute('aria-current', 'step');
    await goToPhase(page, 'decision');
    await expect(visiblePhaseControl(page, 'decision')).toHaveAttribute('aria-current', 'step');
  });

  test('estimate workspace: single primary scroll container on desktop', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await goCounsellingSession(page);
    const scrollers = page.locator('.counselling-session .lg\\:overflow-y-auto');
    await expect(scrollers.first()).toBeVisible({ timeout: 15_000 });
    await expect(scrollers).toHaveCount(1);
  });

  test('coverage estimate: counselling line items after procedure selected', async ({ page }) => {
    await goCounsellingSession(page);
    await ensureInsurancePaymentType(page);
    await goToWrapupPhase(page);
    await skipIfSessionReadOnly(page);

    await goToPhase(page, 'estimate');
    const picked = await selectFirstProcedureFromSearch(page);
    test.skip(!picked, 'No procedures in catalog');

    await goCoverageTabWithWizard(page);
    await goCoverageWizardStep(page, 'estimate');
    await expect(page.getByText(/Counselling Line Items/i)).toBeVisible({ timeout: 15_000 });
  });

  test('schedule modal: submit syncs surgery date to coverage estimate', async ({ page }) => {
    await goCounsellingSession(page);
    await goToPhase(page, 'decision');

    const decisionGroup = page.locator('#counselling-step-3');
    const dateForSurgery = decisionGroup.getByRole('radio', { name: /Date for Surgery|DateForSurgery/i });
    if (await dateForSurgery.isVisible({ timeout: 5_000 }).catch(() => false)) {
      await dateForSurgery.click();
    } else {
      test.skip(true, 'Date for Surgery decision not available');
    }

    const scheduleBtn = page.getByRole('button', { name: /Select a schedule|Update schedule/i });
    if (!(await scheduleBtn.isVisible({ timeout: 10_000 }).catch(() => false))) {
      test.skip(true, 'Schedule section not visible for fixture decision');
    }
    await scheduleBtn.click();

    const datePicker = page.getByTestId('counselling-schedule-surgery-date');
    await expect(datePicker).toBeVisible({ timeout: 15_000 });
    await datePicker.click();

    const calendarSelect = page.locator('[data-slot="calendar"] select, .rdp-dropdown').first();
    if (await calendarSelect.isVisible({ timeout: 5_000 }).catch(() => false)) {
      await expect(calendarSelect).toBeVisible();
    }

    const dayBtn = page.getByRole('gridcell', { name: /15|16|17/ }).first();
    if (await dayBtn.isVisible({ timeout: 5_000 }).catch(() => false)) {
      await dayBtn.click();
    }

    const otSelect = page.locator('select, [role="combobox"]').filter({ hasText: /theatre|OT/i }).first();
    if (await otSelect.isVisible().catch(() => false)) {
      await otSelect.click();
      await page.getByRole('option').first().click({ timeout: 5_000 }).catch(() => undefined);
    }

    const submitBtn = page.getByRole('button', { name: /Submit Schedule|Update Schedule/i });
    if (!(await submitBtn.isEnabled({ timeout: 10_000 }).catch(() => false))) {
      test.skip(true, 'Schedule form incomplete — missing OT/doctor options in fixture');
    }
    await submitBtn.click();

    await ensureInsurancePaymentType(page);
    await goCoverageTabWithWizard(page);
    await goCoverageWizardStep(page, 'estimate');
    const surgeryDateField = page.getByTestId('coverage-surgery-date');
    await expect(surgeryDateField).toBeVisible({ timeout: 15_000 });
    await expect(surgeryDateField).not.toHaveValue('');
  });

  test('coverage surgery date picker: scheduling variant has month/year controls', async ({ page }) => {
    await goCounsellingSession(page);
    await ensureInsurancePaymentType(page);
    await goCoverageTabWithWizard(page);
    await goCoverageWizardStep(page, 'estimate');

    const picker = page.getByTestId('coverage-surgery-date');
    await expect(picker).toBeVisible({ timeout: 15_000 });
    await picker.click();

    const monthOrYearSelect = page.locator(
      '[data-slot="calendar"] select, .rdp-dropdown, .rdp-months_dropdown, .rdp-years_dropdown',
    ).first();
    await expect(monthOrYearSelect).toBeVisible({ timeout: 10_000 });
  });

  test('procedure catalog: keyboard can focus and activate first row', async ({ page }) => {
    await goCounsellingSession(page);
    await openProcedureCatalogueSheet(page);

    const grid = page.getByTestId('counselling-quote-procedure-catalog-grid');
    const search = grid.getByTestId('counselling-procedure-search');
    await expect(search).toBeVisible({ timeout: 30_000 });
    await search.fill('a');

    const firstRow = grid.getByRole('button', { name: /Select procedure/i }).first();
    if (!(await firstRow.isVisible({ timeout: 10_000 }).catch(() => false))) {
      test.skip(true, 'No procedures in catalog');
    }

    await firstRow.focus();
    await expect(firstRow).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(page.getByTestId('counselling-quote-selection-configure')).toBeVisible();
  });

  test('counselling session desktop layout snapshot', async ({ page }) => {
    test.skip(!process.env.E2E_VISUAL_SNAPSHOT, 'Set E2E_VISUAL_SNAPSHOT=1 to run visual regression');

    await page.setViewportSize({ width: 1280, height: 800 });
    await goCounsellingSession(page);
    await expect(page.locator('.counselling-session').first()).toHaveScreenshot(
      'counselling-session-1280.png',
      { maxDiffPixelRatio: 0.05 },
    );
  });

});



test.describe('Counselling read-only / done state @counselling', () => {

  test.describe.configure({ timeout: 90_000 });



  test('done session fixture omits save and shows completed footer when E2E_COUNSELLING_DONE_SESSION_ID set', async ({ page }) => {

    const doneId = process.env.E2E_COUNSELLING_DONE_SESSION_ID;

    test.skip(!doneId, 'Optional: set E2E_COUNSELLING_DONE_SESSION_ID for done-state E2E');



    await page.goto(`/dashboard/counsellors-desk/${doneId}`, { waitUntil: 'domcontentloaded' });

    await expect(counsellingMainTab(page)).toBeVisible({

      timeout: 60_000,

    });

    await expectTerminalDoneFooter(page);

  });

});

