/**

 * Counselling desk E2E — session shell, estimate paths, print smoke (Phase 14.3–14.7).

 *

 * Fixture: E2E_COUNSELLING_SESSION_ID (resolve-e2e-counselling-fixtures.ts)

 */

import { test, expect } from '@playwright/test';

import {
  counsellingMainTab,
  expectEyeSelectorTestIds,
  expectProcedureSearchVisible,
  expectPricingModeTabs,
  expectQuotePanelVisible,
  goCounsellingSession,
  goToPhase,
  goToWrapupPhase,
  hasCounsellingFixture,
  openQuotePanel,
  phaseNextButton,
  saveSessionButton,
  selectFirstProcedureFromSearch,
  toggleEstimateMode,
  toggleFirstInvestigation,
  visiblePhaseControl,
} from './helpers/counselling';



test.describe('Counselling waiting list @counselling', () => {

  test.describe.configure({ timeout: 90_000 });



  test('waiting list loads status tabs', async ({ page }) => {

    await page.goto('/dashboard/counsellors-desk/waiting-list', { waitUntil: 'domcontentloaded' });

    await expect(page.getByRole('button', { name: /^Pending\b/i })).toBeVisible({ timeout: 60_000 });

    await expect(page.getByRole('button', { name: /^Done \d+/ })).toBeVisible();

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

  test('procedure combobox opens Command search', async ({ page }) => {
    await goCounsellingSession(page);
    await expectProcedureComboboxSearchable(page);
  });

  test('estimate type tabs switch custom and package workspaces', async ({ page }) => {
    await goCounsellingSession(page);
    const visible = await expectPricingModeTabs(page);
    test.skip(!visible, 'Estimate type tabs not visible on this fixture');
  });

  test('session shell: tabs, phase nav, quote panel, footer', async ({ page }) => {

    await goCounsellingSession(page);

    await expect(page.getByRole('tab', { name: 'Outpatient Safety', exact: true })).toBeVisible();

    await expectQuotePanelVisible(page);

    await expect(page.getByTestId('counselling-quote-final-payable')).toBeVisible();

    await expect(phaseNextButton(page)).toBeVisible();

    await goToWrapupPhase(page);

    await expect(page.getByRole('button', { name: /Print Estimate|Print/i })).toBeVisible();

    await expect(saveSessionButton(page)).toBeVisible();

  });



  test('phase nav shows 3 phases including Build Quote', async ({ page }) => {

    await goCounsellingSession(page);

    await expect(visiblePhaseControl(page, 'estimate')).toContainText(/Build Quote/i);
    await expect(visiblePhaseControl(page, 'decision')).toContainText(/Patient Decision/i);
    await expect(visiblePhaseControl(page, 'wrapup')).toContainText(/Wrap-up/i);

  });



  test('phase navigation switches between estimate and decision views', async ({ page }) => {

    await goCounsellingSession(page);

    await goToPhase(page, 'decision');

    await expect(page.getByText('Payment & coverage')).toBeVisible({ timeout: 10_000 });

    await goToPhase(page, 'estimate');

    await expect(page.locator('#counselling-step-1')).toBeVisible();

  });



  test('estimate builder: custom and package tabs', async ({ page }) => {

    await goCounsellingSession(page);

    await toggleEstimateMode(page, 'package');

    await expect(page.getByTestId('counselling-tab-package')).toHaveAttribute('data-state', 'active');
    await expect(page.getByTestId('counselling-package-search')).toBeVisible();

    await toggleEstimateMode(page, 'custom');

    await expect(page.getByTestId('counselling-tab-custom')).toHaveAttribute('data-state', 'active');
    await expect(page.getByTestId('counselling-procedure-search')).toBeVisible();

    await openQuotePanel(page);

    await expect(page.getByTestId('counselling-quote-mode-badge')).toBeVisible();

  });



  test('investigations card: imaging and lab tabs', async ({ page }) => {

    await goCounsellingSession(page);

    await expect(page.locator('#counselling-step-2')).toBeVisible();

    await expect(page.getByTestId('counselling-tab-imaging')).toBeVisible();

    await page.getByTestId('counselling-tab-lab').click();

    await expect(page.getByTestId('counselling-investigation-search')).toBeVisible();

  });



  test('decision phase: payment section visible', async ({ page }) => {

    await goCounsellingSession(page);

    await goToPhase(page, 'decision');

    await expect(page.getByText('Payment type')).toBeVisible();

    await expect(page.locator('#counselling-step-3')).toBeAttached();

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

    await expect(page.getByText(/itemized breakdown/i)).toBeVisible();

    await expect(page.getByText('Itemized subtotal')).toBeVisible();

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

    await expect(page.getByText(/itemized breakdown/i)).toBeVisible();

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

    await expect(page.getByText('Discount', { exact: true })).toBeVisible();

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

});



test.describe('Counselling read-only / done state @counselling', () => {

  test.describe.configure({ timeout: 90_000 });



  test('done session fixture disables save when E2E_COUNSELLING_DONE_SESSION_ID set', async ({ page }) => {

    const doneId = process.env.E2E_COUNSELLING_DONE_SESSION_ID;

    test.skip(!doneId, 'Optional: set E2E_COUNSELLING_DONE_SESSION_ID for done-state E2E');



    await page.goto(`/dashboard/counsellors-desk/${doneId}`, { waitUntil: 'domcontentloaded' });

    await expect(counsellingMainTab(page)).toBeVisible({

      timeout: 60_000,

    });

    await expect(saveSessionButton(page)).toBeDisabled();

  });

});

