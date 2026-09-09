/**
 * Wave 2E-1 browser UAT — session shell typography + card reduction.
 */
import fs from 'fs';
import path from 'path';
import { test, expect, type Page } from '@playwright/test';
import {
  coverageTestIds,
  goCounsellingSession,
  goCoverageWizardStep,
  goCoverageTabWithWizard,
  goToPhase,
  hasCounsellingFixture,
} from './helpers/counselling';

const SCREENSHOT_DIR = path.join(process.cwd(), 'e2e', 'screenshots', 'wave2e1');

const VIEWPORTS = [
  { label: '1440x900', width: 1440, height: 900 },
  { label: '1280x800', width: 1280, height: 800 },
  { label: '1024x768', width: 1024, height: 768 },
  { label: '768x1024', width: 768, height: 1024 },
  { label: '375x667', width: 375, height: 667 },
] as const;

function shot(page: Page, name: string) {
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
  return page.screenshot({ path: path.join(SCREENSHOT_DIR, `${name}.png`), fullPage: true });
}

async function assertShellTestIds(page: Page) {
  await expect(page.getByTestId('counselling-session-chrome')).toBeVisible();
  await expect(page.getByTestId('counselling-action-bar')).toBeVisible();
  await expect(page.getByTestId('counselling-journey-rail')).toBeVisible();
}

async function assertNoHorizontalOverflow(page: Page) {
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth + 2,
  );
  expect(overflow).toBe(false);
}

test.describe('Wave 2E-1 Session Shell UAT @wave2e1-uat', () => {
  test.describe.configure({ mode: 'serial', timeout: 300_000 });

  test.beforeEach(() => {
    test.skip(!hasCounsellingFixture(), 'Set E2E_COUNSELLING_SESSION_ID');
  });

  for (const vp of VIEWPORTS) {
    test(`shell — Quote @ ${vp.label}`, async ({ page }) => {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await goCounsellingSession(page);
      await assertShellTestIds(page);
      await expect(page.getByTestId('counselling-quote-workspace')).toBeVisible();
      await assertNoHorizontalOverflow(page);
      await shot(page, `quote-${vp.label}`);
    });
  }

  for (const vp of VIEWPORTS) {
    test(`shell — Decision @ ${vp.label}`, async ({ page }) => {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await goCounsellingSession(page);
      await goToPhase(page, 'decision');
      await expect(page.getByTestId('counselling-decision-workspace')).toBeVisible();
      await assertNoHorizontalOverflow(page);
      await shot(page, `decision-${vp.label}`);
    });
  }

  for (const vp of VIEWPORTS) {
    test(`shell — Notes @ ${vp.label}`, async ({ page }) => {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await goCounsellingSession(page);
      await goToPhase(page, 'wrapup');
      await expect(page.getByTestId('counselling-notes-workspace')).toBeVisible();
      await assertNoHorizontalOverflow(page);
      await shot(page, `notes-${vp.label}`);
    });
  }

  for (const vp of VIEWPORTS) {
    test(`shell — Coverage @ ${vp.label}`, async ({ page }) => {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await goCounsellingSession(page);
      const coverageTab = page.getByRole('tab', { name: /Coverage/i });
      if (await coverageTab.isVisible().catch(() => false)) {
        await goCoverageTabWithWizard(page);
        await assertNoHorizontalOverflow(page);
        await shot(page, `coverage-${vp.label}`);
      } else {
        test.skip(true, 'Coverage tab not visible for fixture');
      }
    });
  }

  test('shell — Documents @ 1440×900', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await goCounsellingSession(page);
    const coverageTab = page.getByRole('tab', { name: /Coverage/i });
    test.skip(!(await coverageTab.isVisible().catch(() => false)), 'Coverage tab not visible');
    await goCoverageTabWithWizard(page);
    await goCoverageWizardStep(page, 'documents');
    await expect(page.locator('[data-testid^="ccms-doc-row-"]').first()).toBeVisible({
      timeout: 30_000,
    });
    await shot(page, 'documents-1440x900');
  });

  for (const vp of VIEWPORTS) {
    test(`shell — Outpatient @ ${vp.label}`, async ({ page }) => {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await goCounsellingSession(page);
      const outpatientTab = page.getByRole('tab', { name: /Outpatient Safety/i });
      await outpatientTab.click();
      await expect(outpatientTab).toHaveAttribute('data-state', 'active');
      await expect(
        page
          .getByText(/Outpatient Safety Checklist|Loading safety checklist|not configured/i)
          .first(),
      ).toBeVisible({ timeout: 30_000 });
      await assertNoHorizontalOverflow(page);
      await shot(page, `outpatient-${vp.label}`);
    });
  }

  test('shell — patient details link preserved @ 1440×900', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await goCounsellingSession(page);
    await expect(page.getByTestId('counselling-btn-patient-details')).toBeVisible();
  });
});
