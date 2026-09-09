/**
 * Wave 2E-2 browser UAT — navigation restyle + IA visual consolidation.
 */
import fs from 'fs';
import path from 'path';
import { test, expect, type Page } from '@playwright/test';
import {
  goCounsellingSession,
  goCoverageTabWithWizard,
  goCoverageWizardStep,
  goToPhase,
  hasCounsellingFixture,
} from './helpers/counselling';

const SCREENSHOT_DIR = path.join(process.cwd(), 'e2e', 'screenshots', 'wave2e2');

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

async function assertNavFamiliesDistinct(page: Page) {
  const moduleTab = page.getByRole('tab', { name: 'Counselling', exact: true });
  await expect(moduleTab).toBeVisible();
  const moduleClass = await moduleTab.evaluate((el) => el.className);
  expect(moduleClass).toMatch(/border-b-2/);

  const journeyRail = page.getByTestId('counselling-journey-rail');
  await expect(journeyRail).toBeVisible();
  const progressOnly = page.locator('[data-journey-navigable="false"]').first();
  if (await progressOnly.count()) {
    await expect(progressOnly).not.toHaveRole('button');
  }

  const phaseNav = page.getByTestId('counselling-phase-nav');
  await expect(phaseNav).toBeVisible();
  const phaseButton = phaseNav.getByTestId('counselling-phase-estimate');
  const phaseClass = await phaseButton.evaluate((el) => el.className);
  expect(phaseClass).toMatch(/border-b-2/);
  expect(phaseClass).not.toMatch(/rounded-md border px-2/);
}

async function assertNoHorizontalOverflow(page: Page) {
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth + 2,
  );
  expect(overflow).toBe(false);
}

test.describe('Wave 2E-2 Navigation UAT @wave2e2-uat', () => {
  test.describe.configure({ mode: 'serial', timeout: 300_000 });

  test.beforeEach(() => {
    test.skip(!hasCounsellingFixture(), 'Set E2E_COUNSELLING_SESSION_ID');
  });

  for (const vp of VIEWPORTS) {
    test(`A — Counselling / Quote @ ${vp.label}`, async ({ page }) => {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await goCounsellingSession(page);
      await assertNavFamiliesDistinct(page);
      await expect(page.getByTestId('counselling-quote-workspace')).toBeVisible();
      await assertNoHorizontalOverflow(page);
      await shot(page, `quote-${vp.label}`);
    });
  }

  for (const vp of VIEWPORTS) {
    test(`B — Counselling / Decision @ ${vp.label}`, async ({ page }) => {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await goCounsellingSession(page);
      await goToPhase(page, 'decision');
      await expect(page.getByTestId('counselling-decision-workspace')).toBeVisible();
      await assertNoHorizontalOverflow(page);
      await shot(page, `decision-${vp.label}`);
    });
  }

  for (const vp of VIEWPORTS) {
    test(`C — Counselling / Notes @ ${vp.label}`, async ({ page }) => {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await goCounsellingSession(page);
      await goToPhase(page, 'wrapup');
      await expect(page.getByTestId('counselling-notes-workspace')).toBeVisible();
      await assertNoHorizontalOverflow(page);
      await shot(page, `notes-${vp.label}`);
    });
  }

  for (const vp of VIEWPORTS) {
    test(`D — Coverage / Policy @ ${vp.label}`, async ({ page }) => {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await goCounsellingSession(page);
      const coverageTab = page.getByRole('tab', { name: /Coverage/i });
      test.skip(!(await coverageTab.isVisible().catch(() => false)), 'Coverage tab hidden');
      await goCoverageTabWithWizard(page);
      await assertNoHorizontalOverflow(page);
      await shot(page, `coverage-policy-${vp.label}`);
    });
  }

  test('E — Coverage / Documents @ 1440×900', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await goCounsellingSession(page);
    const coverageTab = page.getByRole('tab', { name: /Coverage/i });
    test.skip(!(await coverageTab.isVisible().catch(() => false)), 'Coverage tab hidden');
    await goCoverageTabWithWizard(page);
    await goCoverageWizardStep(page, 'documents');
    await expect(page.locator('[data-testid^="ccms-doc-row-"]').first()).toBeVisible({
      timeout: 30_000,
    });
    await shot(page, 'coverage-documents-1440x900');
  });

  for (const vp of VIEWPORTS) {
    test(`F — Outpatient @ ${vp.label}`, async ({ page }) => {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await goCounsellingSession(page);
      const tab = page.getByRole('tab', { name: /Outpatient Safety/i });
      await tab.click();
      await expect(tab).toHaveAttribute('data-state', 'active');
      await expect(
        page.getByText(/Outpatient Safety Checklist|Loading safety checklist|not configured/i).first(),
      ).toBeVisible({ timeout: 30_000 });
      await assertNoHorizontalOverflow(page);
      await shot(page, `outpatient-${vp.label}`);
    });
  }

  test('G — keyboard focus on module and workspace steps @ 1440×900', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await goCounsellingSession(page);
    await page.getByRole('tab', { name: 'Counselling', exact: true }).focus();
    await page.keyboard.press('Tab');
    await expect(page.locator(':focus')).toBeVisible();
    await page.getByTestId('counselling-phase-decision').focus();
    await expect(page.getByTestId('counselling-phase-decision')).toBeFocused();
  });
});
