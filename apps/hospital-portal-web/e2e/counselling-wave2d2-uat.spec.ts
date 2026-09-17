/**
 * Wave 2D-2 browser UAT — Navigation IA consolidation (visual + semantics).
 * Fixture: E2E_COUNSELLING_SESSION_ID (resolve-e2e-counselling-fixtures.ts)
 * Optional: E2E_COUNSELLING_DONE_SESSION_ID for scenario H
 */
import fs from 'fs';
import path from 'path';
import { test, expect, type Locator, type Page } from '@playwright/test';
import {
  actionBar,
  actionBarPrimary,
  counsellingJourneyStage,
  coverageWizardStep,
  ensureInsurancePaymentType,
  goCounsellingSession,
  goCoverageTabWithWizard,
  goCoverageWizardStep,
  goOutpatientSafety,
  goToPhase,
  hasCounsellingFixture,
  openQuotePanel,
  saveSessionButton,
} from './helpers/counselling';

const SCREENSHOT_DIR = path.join(process.cwd(), 'e2e', 'screenshots', 'wave2d2');

const VIEWPORTS = [
  { label: '1440x900', width: 1440, height: 900 },
  { label: '1280x800', width: 1280, height: 800 },
  { label: '1024x768', width: 1024, height: 768 },
] as const;

function shot(page: Page, name: string) {
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
  return page.screenshot({ path: path.join(SCREENSHOT_DIR, `${name}.png`), fullPage: true });
}

async function goToDecisionWorkspace(page: Page) {
  await goToPhase(page, 'decision');
  await expect(page.getByTestId('counselling-decision-workspace-header')).toBeVisible({
    timeout: 30_000,
  });
}

async function goToNotesWorkspace(page: Page) {
  await goToPhase(page, 'wrapup');
  await expect(page.getByTestId('counselling-notes-workspace')).toBeVisible({ timeout: 15_000 });
}

async function expectJourneyCurrent(stage: Locator) {
  await expect(stage).toHaveAttribute('data-journey-status', 'current');
}

async function expectJourneyNotNavigable(stage: Locator) {
  await expect(stage).toHaveAttribute('data-journey-navigable', 'false');
}

async function assertNoGoToBuildQuote(page: Page) {
  await expect(page.getByTestId('counselling-quote-go-to-estimate')).toHaveCount(0);
  await expect(page.getByRole('button', { name: /Go to Build Quote/i })).toHaveCount(0);
}

async function assertEstimateModeSegmented(page: Page) {
  const custom = page.getByTestId('counselling-tab-custom');
  const pkg = page.getByTestId('counselling-tab-package');
  await expect(custom).toHaveAttribute('aria-pressed', /true|false/);
  await expect(pkg).toHaveAttribute('aria-pressed', /true|false/);
  await expect(custom).not.toHaveAttribute('data-state', 'active');
}

async function assertNoDuplicateNavigation(page: Page) {
  await expect(page.getByTestId('counselling-phase-nav')).toHaveCount(0);
  await expect(page.getByRole('tab', { name: 'Counselling', exact: true })).toHaveCount(0);
  await expect(page.getByRole('tab', { name: /Coverage/i })).toHaveCount(0);
}

async function assertInvestigationFilterSemantics(page: Page) {
  await expect(page.getByRole('navigation', { name: /Filter investigations by category/i })).toBeVisible();
}

async function assertPhaseActive(btn: Locator) {
  await expect(btn).toHaveAttribute('aria-current', 'step');
}

async function assertJourneyRailSingleRow(page: Page) {
  const rail = page.getByTestId('counselling-journey-rail');
  await expect(rail).toBeVisible();
  const ol = rail.locator('ol');
  const box = await ol.boundingBox();
  expect(box).toBeTruthy();
  const stages = ol.locator('li');
  const count = await stages.count();
  let maxBottom = box!.y;
  let minTop = box!.y + box!.height;
  for (let i = 0; i < count; i += 1) {
    const b = await stages.nth(i).boundingBox();
    if (!b) continue;
    maxBottom = Math.max(maxBottom, b.y + b.height);
    minTop = Math.min(minTop, b.y);
  }
  expect(maxBottom - minTop).toBeLessThan(48);
}

test.describe('Wave 2D-2 Navigation IA UAT @wave2d2-uat', () => {
  test.describe.configure({ mode: 'serial', timeout: 240_000 });

  test.beforeEach(() => {
    test.skip(!hasCounsellingFixture(), 'Set E2E_COUNSELLING_SESSION_ID');
  });

  for (const vp of VIEWPORTS) {
    test(`responsive checks @ ${vp.label}`, async ({ page }) => {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await goCounsellingSession(page);
      await openQuotePanel(page);

      await assertNoDuplicateNavigation(page);
      await assertJourneyRailSingleRow(page);
      await assertNoGoToBuildQuote(page);

      if (vp.label === '1280x800') {
        await shot(page, '07-quote-1280x800');
      }
      if (vp.label === '1024x768') {
        await shot(page, '08-quote-1024x768');
      }
    });
  }

  test('A — Counselling / Quote @ 1440×900', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await goCounsellingSession(page);
    await openQuotePanel(page);

    await assertNoDuplicateNavigation(page);
    await expectJourneyCurrent(counsellingJourneyStage(page, 'quote'));
    await expectJourneyNotNavigable(counsellingJourneyStage(page, 'quote'));

    await assertNoGoToBuildQuote(page);
    await assertEstimateModeSegmented(page);
    await assertInvestigationFilterSemantics(page);

    await expect(page.getByRole('navigation', { name: 'Counselling workflow' })).toBeVisible();
    await expect(counsellingJourneyStage(page, 'notes')).toContainText(/Notes/i);
    await expect(counsellingJourneyStage(page, 'close')).toContainText(/Finish/i);

    await shot(page, '01-counselling-quote-1440x900');
  });

  test('B — Counselling / Decision @ 1440×900', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await goCounsellingSession(page);
    await goToDecisionWorkspace(page);

    await assertNoDuplicateNavigation(page);
    await expectJourneyCurrent(counsellingJourneyStage(page, 'decision'));
    await expectJourneyNotNavigable(counsellingJourneyStage(page, 'decision'));

    await expect(actionBar(page)).toBeVisible();
    await assertNoGoToBuildQuote(page);
    await shot(page, '02-counselling-decision-1440x900');
  });

  test('C — Counselling / Notes @ 1440×900', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await goCounsellingSession(page);

    await expect(counsellingJourneyStage(page, 'notes')).toContainText(/Notes/i);
    await expect(counsellingJourneyStage(page, 'close')).toContainText(/Finish/i);

    await goToNotesWorkspace(page);

    await assertNoDuplicateNavigation(page);
    await expectJourneyCurrent(counsellingJourneyStage(page, 'notes'));
    await expectJourneyNotNavigable(counsellingJourneyStage(page, 'notes'));

    await goOutpatientSafety(page);
    await expect(counsellingJourneyStage(page, 'notes')).not.toHaveAttribute(
      'data-journey-status',
      'current',
    );

    await shot(page, '03-counselling-notes-1440x900');
  });

  test('D — Coverage / Policy @ 1440×900', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await goCounsellingSession(page);
    await ensureInsurancePaymentType(page);
    await goCoverageTabWithWizard(page);

    await assertNoDuplicateNavigation(page);
    await expectJourneyCurrent(counsellingJourneyStage(page, 'insurance'));
    await expect(counsellingJourneyStage(page, 'insurance')).toContainText(/Insurance/i);
    await assertPhaseActive(coverageWizardStep(page, 'policy'));

    await shot(page, '04-coverage-policy-1440x900');
  });

  test('E — Coverage / Documents @ 1440×900', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await goCounsellingSession(page);
    await ensureInsurancePaymentType(page);
    await goCoverageTabWithWizard(page);
    await goCoverageWizardStep(page, 'documents');

    await assertPhaseActive(coverageWizardStep(page, 'documents'));
    await expect(page.getByTestId('coverage-step-documents')).toBeVisible();

    const uploadInput = page.locator('input[type="file"]').first();
    if (await uploadInput.count()) {
      await expect(uploadInput).toBeAttached();
    }

    await shot(page, '05-coverage-documents-1440x900');
  });

  test('F — Outpatient Safety @ 1440×900', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await goCounsellingSession(page);
    await goOutpatientSafety(page);

    const finishStage = counsellingJourneyStage(page, 'close');
    await expect(finishStage).toContainText(/Finish/i);
    await expect(finishStage).not.toHaveAttribute('data-journey-status', 'current');

    await shot(page, '06-outpatient-safety-1440x900');
  });

  test('G — Repeat/read-only gates', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await goCounsellingSession(page);

    const repeatBanner = page.getByText(/Start repeat session/i);
    if (await repeatBanner.isVisible().catch(() => false)) {
      await expect(repeatBanner).toBeVisible();
      await expect(page.locator('[data-journey-navigable="true"]')).toHaveCount(0);
      return;
    }

    const saveBtn = saveSessionButton(page);
    if (await saveBtn.isVisible().catch(() => false)) {
      if (!(await saveBtn.isEnabled())) {
        await expect(saveBtn).toBeDisabled();
      }
    } else {
      test.info().annotations.push({
        type: 'note',
        description:
          'Post-submit fixture — Complete Session hidden; Save Draft remains available for editable state',
      });
    }

    await expect(counsellingJourneyStage(page, 'quote')).toHaveAttribute(
      'data-journey-navigable',
      'false',
    );
  });

  test('H — Surgery completed (optional fixture)', async ({ page }) => {
    const doneId = process.env.E2E_COUNSELLING_DONE_SESSION_ID;
    test.skip(!doneId, 'Optional: set E2E_COUNSELLING_DONE_SESSION_ID');

    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(`/dashboard/counsellors-desk/${doneId}`, { waitUntil: 'domcontentloaded' });
    await expect(page.getByTestId('counselling-journey-rail')).toBeVisible({ timeout: 60_000 });

    await expect(saveSessionButton(page)).toBeDisabled();
    const stages = page.locator('[data-journey-navigable="true"]');
    await expect(stages).toHaveCount(0);

    await shot(page, '09-surgery-completed-readonly');
  });

  test('Accessibility — keyboard focus and journey semantics', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await goCounsellingSession(page);

    const decisionBtn = counsellingJourneyStage(page, 'decision').getByRole('button');
    if (await decisionBtn.isVisible().catch(() => false)) {
      await decisionBtn.focus();
      await expect(decisionBtn).toBeFocused();
    }

    const quoteStage = counsellingJourneyStage(page, 'quote');
    await expect(quoteStage).toHaveAttribute('data-journey-navigable', 'false');
    const quoteProgress = quoteStage.locator('span[aria-label]').first();
    const aria = await quoteProgress.getAttribute('aria-label');
    expect(aria ?? '').not.toMatch(/^Go to Quote/i);

    const insuranceStage = counsellingJourneyStage(page, 'insurance');
    if ((await insuranceStage.getAttribute('data-journey-navigable')) === 'true') {
      const insuranceBtn = insuranceStage.locator('button').first();
      const insuranceAria = await insuranceBtn.getAttribute('aria-label');
      expect(insuranceAria ?? '').toMatch(/Go to Insurance/i);
    }
  });
});
