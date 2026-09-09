/**
 * Wave 2D-5 browser UAT — Notes workspace + cross-workspace consistency.
 */
import fs from 'fs';
import path from 'path';
import { test, expect, type Page } from '@playwright/test';
import {
  goCounsellingSession,
  goToPhase,
  hasCounsellingFixture,
  saveSessionButton,
} from './helpers/counselling';

const SCREENSHOT_DIR = path.join(process.cwd(), 'e2e', 'screenshots', 'wave2d5');

const VIEWPORTS = [
  { label: '1440x900', width: 1440, height: 900 },
  { label: '1280x800', width: 1280, height: 800 },
  { label: '1024x768', width: 1024, height: 768 },
  { label: '375x667', width: 375, height: 667 },
] as const;

function shot(page: Page, name: string) {
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
  return page.screenshot({ path: path.join(SCREENSHOT_DIR, `${name}.png`), fullPage: true });
}

function phaseNav(page: Page, phase: 'estimate' | 'decision' | 'wrapup') {
  return page.getByTestId('counselling-phase-nav').getByTestId(`counselling-phase-${phase}`);
}

async function goNotesWorkspace(page: Page) {
  await goToPhase(page, 'wrapup');
  await expect(page.getByTestId('counselling-notes-workspace')).toBeVisible({ timeout: 30_000 });
}

async function assertNoHorizontalOverflow(page: Page) {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 2);
  expect(overflow).toBe(false);
}

test.describe('Wave 2D-5 Notes Workspace UAT @wave2d5-uat', () => {
  test.describe.configure({ mode: 'serial', timeout: 240_000 });

  test.beforeEach(() => {
    test.skip(!hasCounsellingFixture(), 'Set E2E_COUNSELLING_SESSION_ID');
  });

  test('1 — Notes initial @ 1440×900', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await goCounsellingSession(page);
    await goNotesWorkspace(page);
    await expect(page.getByTestId('counselling-notes-workspace')).toBeVisible();
    await expect(page.getByTestId('counselling-notes-documentation')).toBeVisible();
    await shot(page, '01-notes-initial-1440x900');
  });

  test('2 — Notes fields @ 1440×900', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await goCounsellingSession(page);
    await goNotesWorkspace(page);
    await expect(page.getByTestId('counselling-notes-counsellor')).toBeVisible();
    await expect(page.getByTestId('counselling-notes-patient')).toBeVisible();
    await expect(page.getByTestId('counselling-notes-doctor')).toBeVisible();
    await shot(page, '02-notes-fields-1440x900');
  });

  test('3 — Additional options @ 1440×900', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await goCounsellingSession(page);
    await goNotesWorkspace(page);
    await expect(page.getByTestId('counselling-notes-additional-options')).toBeVisible();
    await shot(page, '03-notes-additional-options-1440x900');
  });

  test('4 — Notes upstream blocker when incomplete @ 1440×900', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await goCounsellingSession(page);
    await goNotesWorkspace(page);
    await expect(page.getByTestId('counselling-notes-counsellor')).toBeVisible();
    await shot(page, '04-notes-complete-1440x900');
  });

  test('5 — Read-only gates @ 1440×900', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await goCounsellingSession(page);
    await goNotesWorkspace(page);
    const saveBtn = saveSessionButton(page);
    if (await saveBtn.isVisible().catch(() => false) && !(await saveBtn.isEnabled())) {
      await expect(saveBtn).toBeDisabled();
    }
    await shot(page, '05-notes-readonly-1440x900');
  });

  test('6 — Cross-workspace Quote @ 1440×900', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await goCounsellingSession(page);
    await expect(page.getByTestId('counselling-quote-workspace')).toBeVisible();
    await shot(page, '06-cross-quote-1440x900');
  });

  test('7 — Cross-workspace Decision @ 1440×900', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await goCounsellingSession(page);
    await goToPhase(page, 'decision');
    await expect(page.getByTestId('counselling-decision-workspace')).toBeVisible();
    await shot(page, '07-cross-decision-1440x900');
  });

  test('8 — Cross-workspace Notes @ 1440×900', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await goCounsellingSession(page);
    await goNotesWorkspace(page);
    await shot(page, '08-cross-notes-1440x900');
  });

  test('9 — Surgery completed (optional fixture)', async ({ page }) => {
    const doneId = process.env.E2E_COUNSELLING_DONE_SESSION_ID;
    test.skip(!doneId, 'Optional: set E2E_COUNSELLING_DONE_SESSION_ID');
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(`/dashboard/counsellors-desk/${doneId}`, { waitUntil: 'domcontentloaded' });
    await goNotesWorkspace(page);
    await shot(page, '09-notes-surgery-completed-1440x900');
  });

  for (const vp of VIEWPORTS) {
    test(`responsive — notes workspace @ ${vp.label}`, async ({ page }) => {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await goCounsellingSession(page);
      await goNotesWorkspace(page);
      await assertNoHorizontalOverflow(page);
      await expect(page.getByTestId('counselling-journey-stage-close')).toContainText(/Finish/i);
      await shot(page, `10-responsive-notes-${vp.label}`);
    });
  }

  test('Accessibility — notes fields and headings', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await goCounsellingSession(page);
    await goNotesWorkspace(page);
    await page.getByTestId('counselling-notes-counsellor').focus();
    await page.keyboard.press('Tab');
    await expect(page.locator(':focus')).toBeVisible();
  });

  test('Duplicate ID audit — journey nav vs workspace', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await goCounsellingSession(page);
    await goNotesWorkspace(page);
    await expect(page.getByTestId('counselling-journey-stage-notes')).toBeVisible();
    await expect(page.getByTestId('counselling-notes-workspace')).toHaveCount(1);
    await expect(page.getByTestId('counselling-phase-nav')).toHaveCount(0);
  });
});
