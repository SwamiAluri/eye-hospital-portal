/**
 * Wave 2E-2R browser UAT — single primary counselling journey navigation.
 */
import fs from 'fs';
import path from 'path';
import { test, expect, type Page } from '@playwright/test';
import {
  counsellingJourneyStage,
  goCounsellingSession,
  goCoverageTabWithWizard,
  goCoverageWizardStep,
  goOutpatientSafety,
  goToPhase,
  hasCounsellingFixture,
} from './helpers/counselling';

const SCREENSHOT_DIR = path.join(process.cwd(), 'e2e', 'screenshots', 'wave2e2r');

const VIEWPORTS = [
  { label: '1440x900', width: 1440, height: 900 },
  { label: '1280x800', width: 1280, height: 800 },
  { label: '1024x768', width: 1024, height: 768 },
  { label: '768x1024', width: 768, height: 1024 },
  { label: '375x667', width: 375, height: 667 },
] as const;

const PRIMARY_STAGES = ['quote', 'decision', 'insurance', 'notes', 'close'] as const;

function shot(page: Page, name: string) {
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
  return page.screenshot({ path: path.join(SCREENSHOT_DIR, `${name}.png`), fullPage: true });
}

async function assertSinglePrimaryWorkflow(page: Page) {
  const journeyRail = page.getByTestId('counselling-journey-rail');
  await expect(journeyRail).toBeVisible();
  await expect(journeyRail).toHaveAttribute('aria-label', 'Counselling workflow');

  for (const stage of PRIMARY_STAGES) {
    await expect(counsellingJourneyStage(page, stage)).toBeVisible();
  }

  await expect(page.getByRole('tab', { name: 'Counselling', exact: true })).toHaveCount(0);
  await expect(page.getByRole('tab', { name: /Coverage/i })).toHaveCount(0);
  await expect(page.getByTestId('counselling-phase-nav')).toHaveCount(0);
}

async function assertNoHorizontalOverflow(page: Page) {
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth + 2,
  );
  expect(overflow).toBe(false);
}

test.describe('Wave 2E-2R Navigation IA UAT @wave2e2r-uat', () => {
  test.describe.configure({ mode: 'serial', timeout: 300_000 });

  test.beforeEach(() => {
    test.skip(!hasCounsellingFixture(), 'Set E2E_COUNSELLING_SESSION_ID');
  });

  for (const vp of VIEWPORTS) {
    test(`A — Quote @ ${vp.label}`, async ({ page }) => {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await goCounsellingSession(page);
      await assertSinglePrimaryWorkflow(page);
      await expect(page.getByTestId('counselling-quote-workspace')).toBeVisible();
      await assertNoHorizontalOverflow(page);
      await shot(page, `quote-${vp.label}`);
    });
  }

  for (const vp of VIEWPORTS) {
    test(`B — Decision @ ${vp.label}`, async ({ page }) => {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await goCounsellingSession(page);
      await goToPhase(page, 'decision');
      await assertSinglePrimaryWorkflow(page);
      await expect(page.getByTestId('counselling-decision-workspace')).toBeVisible();
      await assertNoHorizontalOverflow(page);
      await shot(page, `decision-${vp.label}`);
    });
  }

  for (const vp of VIEWPORTS) {
    test(`C — Notes @ ${vp.label}`, async ({ page }) => {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await goCounsellingSession(page);
      await goToPhase(page, 'wrapup');
      await assertSinglePrimaryWorkflow(page);
      await expect(page.getByTestId('counselling-notes-workspace')).toBeVisible();
      await assertNoHorizontalOverflow(page);
      await shot(page, `notes-${vp.label}`);
    });
  }

  for (const vp of VIEWPORTS) {
    test(`D — Insurance / Policy @ ${vp.label}`, async ({ page }) => {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await goCounsellingSession(page);
      const insurance = counsellingJourneyStage(page, 'insurance');
      test.skip(
        (await insurance.getAttribute('data-journey-status')) === 'skipped',
        'Insurance skipped on fixture',
      );
      await goCoverageTabWithWizard(page);
      await assertSinglePrimaryWorkflow(page);
      await assertNoHorizontalOverflow(page);
      await shot(page, `insurance-policy-${vp.label}`);
    });
  }

  test('E — Insurance / Documents @ 1440×900', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await goCounsellingSession(page);
    const insurance = counsellingJourneyStage(page, 'insurance');
    test.skip(
      (await insurance.getAttribute('data-journey-status')) === 'skipped',
      'Insurance skipped on fixture',
    );
    await goCoverageTabWithWizard(page);
    await goCoverageWizardStep(page, 'documents');
    await expect(page.locator('[data-testid^="ccms-doc-row-"]').first()).toBeVisible({
      timeout: 30_000,
    });
    await shot(page, 'insurance-documents-1440x900');
  });

  for (const vp of VIEWPORTS) {
    test(`F — Outpatient access @ ${vp.label}`, async ({ page }) => {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await goCounsellingSession(page);
      await goOutpatientSafety(page);
      await assertSinglePrimaryWorkflow(page);
      await assertNoHorizontalOverflow(page);
      await shot(page, `outpatient-${vp.label}`);
    });
  }

  test('G — keyboard focus on primary workflow @ 1440×900', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await goCounsellingSession(page);
    const decisionBtn = counsellingJourneyStage(page, 'decision').getByRole('button');
    if (await decisionBtn.isVisible().catch(() => false)) {
      await decisionBtn.focus();
      await expect(decisionBtn).toBeFocused();
    }
    await page.getByTestId('counselling-outpatient-access').focus();
    await expect(page.getByTestId('counselling-outpatient-access')).toBeFocused();
  });
});
