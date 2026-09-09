/**
 * Wave 2E-5 browser UAT — Notes workspace redesign (Quote design language).
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

const SCREENSHOT_DIR = path.join(process.cwd(), 'e2e', 'screenshots', 'wave2e5');

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

async function goNotesWorkspace(page: Page) {
  await goToPhase(page, 'wrapup');
  await expect(page.getByTestId('counselling-notes-workspace')).toBeVisible({ timeout: 30_000 });
}

async function assertNoHorizontalOverflow(page: Page) {
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth + 2,
  );
  expect(overflow).toBe(false);
}

test.describe('Wave 2E-5 Notes Redesign UAT @wave2e5-uat', () => {
  test.describe.configure({ mode: 'serial', timeout: 240_000 });

  test.beforeEach(() => {
    test.skip(!hasCounsellingFixture(), 'Set E2E_COUNSELLING_SESSION_ID');
  });

  test('1 — Notes documentation focus @ 1440×900', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await goCounsellingSession(page);
    await goNotesWorkspace(page);
    await expect(page.getByTestId('counselling-notes-documentation')).toBeVisible();
    await expect(page.getByTestId('counselling-notes-counsellor')).toBeVisible();
    await expect(page.getByTestId('counselling-notes-patient')).toBeVisible();
    await expect(page.getByTestId('counselling-notes-doctor')).toBeVisible();
    await expect(page.getByText('Pre-admission lab values')).toHaveCount(0);
    await expect(page.getByTestId('counselling-notes-readiness')).toHaveCount(0);
    await shot(page, '01-notes-documentation-1440x900');
  });

  test('2 — No readiness strip @ 1440×900', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await goCounsellingSession(page);
    await goNotesWorkspace(page);
    await expect(page.getByTestId('counselling-notes-readiness')).toHaveCount(0);
    await shot(page, '02-notes-no-readiness-1440x900');
  });

  test('3 — Edit counsellor note + Save Draft remains @ 1440×900', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await goCounsellingSession(page);
    await goNotesWorkspace(page);
    const field = page.getByTestId('counselling-notes-counsellor');
    if (await field.isEditable().catch(() => false)) {
      await field.fill(`Wave2E5 note ${Date.now()}`);
    }
    await expect(page.getByRole('button', { name: /Save Draft/i })).toBeVisible();
    await expect(saveSessionButton(page)).toBeVisible();
    await shot(page, '03-notes-edit-actions-1440x900');
  });

  test('4 — Quote/Decision unchanged smoke @ 1440×900', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await goCounsellingSession(page);
    await expect(page.getByTestId('counselling-quote-workspace')).toBeVisible();
    await goToPhase(page, 'decision');
    await expect(page.getByTestId('counselling-decision-workspace')).toBeVisible();
    await shot(page, '04-cross-quote-decision-1440x900');
  });

  for (const vp of VIEWPORTS) {
    test(`responsive — notes @ ${vp.label}`, async ({ page }) => {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await goCounsellingSession(page);
      await goNotesWorkspace(page);
      await assertNoHorizontalOverflow(page);
      await expect(page.getByTestId('counselling-notes-counsellor')).toBeVisible();
      await expect(page.getByTestId('counselling-journey-stage-close')).toContainText(/Finish/i);
      await shot(page, `05-responsive-notes-${vp.label}`);
    });
  }
});
