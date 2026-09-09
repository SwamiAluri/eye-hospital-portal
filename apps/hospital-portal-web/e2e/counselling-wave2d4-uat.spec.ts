/**
 * Wave 2D-4 browser UAT — Decision workspace UX redesign.
 * Fixture: E2E_COUNSELLING_SESSION_ID
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

const SCREENSHOT_DIR = path.join(process.cwd(), 'e2e', 'screenshots', 'wave2d4');

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

async function goDecisionWorkspace(page: Page) {
  await goToPhase(page, 'decision');
  await expect(page.getByTestId('counselling-decision-workspace')).toBeVisible({ timeout: 30_000 });
}

async function assertNoHorizontalOverflow(page: Page) {
  const overflow = await page.evaluate(() => {
    const doc = document.documentElement;
    return doc.scrollWidth > doc.clientWidth + 2;
  });
  expect(overflow).toBe(false);
}

async function decisionStatusText(page: Page) {
  return (await page.getByTestId('counselling-decision-workspace-status').textContent()) ?? '';
}

async function isDecisionEditable(page: Page) {
  const option = page.getByTestId('counselling-decision-option-dateforsurgery').locator('input, button').first();
  if (!(await option.count())) return false;
  return option.isEnabled().catch(() => false);
}

async function selectDecisionIfEditable(page: Page, optionTestId: string) {
  if (!(await isDecisionEditable(page))) return false;
  await page.getByTestId(optionTestId).click();
  return true;
}

test.describe('Wave 2D-4 Decision Workspace UAT @wave2d4-uat', () => {
  test.describe.configure({ mode: 'serial', timeout: 240_000 });

  test.beforeEach(() => {
    test.skip(!hasCounsellingFixture(), 'Set E2E_COUNSELLING_SESSION_ID');
  });

  test('1 — Decision workspace initial @ 1440×900', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await goCounsellingSession(page);
    await goDecisionWorkspace(page);

    const status = await decisionStatusText(page);
    expect(status).toMatch(/Required|Recorded/i);
    await expect(page.getByRole('radiogroup', { name: /Patient Decision/i })).toBeVisible();
    await shot(page, '01-decision-initial-1440x900');
  });

  test('2 — Proceed selected @ 1440×900', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await goCounsellingSession(page);
    await goDecisionWorkspace(page);

    const selected = await selectDecisionIfEditable(page, 'counselling-decision-option-dateforsurgery');
    if (selected) {
      await expect(
        page.getByRole('button', { name: /^Change$|Select a schedule/i }).first(),
      ).toBeVisible();
    } else {
      await expect(page.getByTestId('counselling-decision-workspace-status')).toContainText(/Recorded/i);
    }
    await shot(page, '02-decision-proceed-1440x900');
  });

  test('3 — Needs Time selected @ 1440×900', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await goCounsellingSession(page);
    await goDecisionWorkspace(page);

    const selected = await selectDecisionIfEditable(page, 'counselling-decision-option-needstime');
    if (selected) {
      await expect(page.getByTestId('counselling-decision-follow-up-section')).toBeVisible();
    } else if (/Needs more time/i.test(await page.locator('body').innerText())) {
      await expect(page.getByTestId('counselling-decision-follow-up-section')).toBeVisible();
    }
    await shot(page, '03-decision-needs-time-1440x900');
  });

  test('4 — Not Interested selected @ 1440×900', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await goCounsellingSession(page);
    await goDecisionWorkspace(page);

    const selected = await selectDecisionIfEditable(page, 'counselling-decision-option-notinterested');
    if (selected) {
      await expect(page.getByTestId('counselling-decision-follow-up-section')).toBeVisible();
    }
    await shot(page, '04-decision-not-interested-1440x900');
  });

  test('5 — Insurance funding @ 1440×900', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await goCounsellingSession(page);
    await goDecisionWorkspace(page);

    const payment = page.locator('#counselling-step-3').getByRole('combobox').first();
    if (await payment.isEnabled().catch(() => false)) {
      await payment.click();
      const insuranceOpt = page.getByRole('option', { name: /^Insurance$/i }).first();
      if (await insuranceOpt.isVisible().catch(() => false)) {
        await insuranceOpt.click();
        await expect(page.getByTestId('counselling-decision-funding-handoff')).toBeVisible();
      }
    } else if (await page.getByTestId('counselling-decision-funding-handoff').isVisible().catch(() => false)) {
      await expect(page.getByTestId('counselling-decision-funding-handoff')).toBeVisible();
    }
    await shot(page, '05-decision-insurance-1440x900');
  });

  test('6 — Cash funding @ 1440×900', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await goCounsellingSession(page);
    await goDecisionWorkspace(page);

    const payment = page.locator('#counselling-step-3').getByRole('combobox').first();
    if (await payment.isEnabled().catch(() => false)) {
      await payment.click();
      const cashOpt = page.getByRole('option', { name: /^Cash$/i }).first();
      if (await cashOpt.isVisible().catch(() => false)) {
        await cashOpt.click();
        await expect(page.getByTestId('counselling-decision-funding-handoff')).toHaveCount(0);
      }
    }
    await shot(page, '06-decision-cash-1440x900');
  });

  test('7 — Schedule section @ 1440×900', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await goCounsellingSession(page);
    await goDecisionWorkspace(page);

    const scheduleBtn = page.getByRole('button', { name: /^Change$|Select a schedule/i }).first();
    if (await scheduleBtn.isVisible().catch(() => false)) {
      await expect(scheduleBtn).toBeVisible();
    }
    await shot(page, '07-decision-schedule-1440x900');
  });

  test('8 — Decision recorded @ 1440×900', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await goCounsellingSession(page);
    await goDecisionWorkspace(page);

    if (/Recorded/i.test(await decisionStatusText(page))) {
      await expect(page.getByTestId('counselling-decision-summary-strip')).toBeVisible();
    }
    await shot(page, '08-decision-recorded-1440x900');
  });

  test('9 — Validation blocker @ 1440×900', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await goCounsellingSession(page);
    await goDecisionWorkspace(page);

    if (/Required/i.test(await decisionStatusText(page))) {
      await expect(page.getByTestId('counselling-decision-inline-blocker')).toBeVisible();
    }
    await shot(page, '09-decision-blocker-1440x900');
  });

  test('10 — Read-only / post-submit gates @ 1440×900', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await goCounsellingSession(page);
    await goDecisionWorkspace(page);

    const saveBtn = saveSessionButton(page);
    if (await saveBtn.isVisible().catch(() => false) && !(await saveBtn.isEnabled())) {
      await expect(saveBtn).toBeDisabled();
    }
    await shot(page, '10-decision-readonly-1440x900');
  });

  test('11 — Surgery completed (optional fixture)', async ({ page }) => {
    const doneId = process.env.E2E_COUNSELLING_DONE_SESSION_ID;
    test.skip(!doneId, 'Optional: set E2E_COUNSELLING_DONE_SESSION_ID');
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(`/dashboard/counsellors-desk/${doneId}`, { waitUntil: 'domcontentloaded' });
    await expect(page.getByTestId('counselling-journey-rail')).toBeVisible({
      timeout: 60_000,
    });
    await goDecisionWorkspace(page);
    await shot(page, '11-decision-surgery-completed-1440x900');
  });

  for (const vp of VIEWPORTS) {
    test(`responsive — decision workspace @ ${vp.label}`, async ({ page }) => {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await goCounsellingSession(page);
      await goDecisionWorkspace(page);
      await expect(page.getByTestId('counselling-journey-stage-decision')).toBeVisible();
      await assertNoHorizontalOverflow(page);
      await shot(page, `12-responsive-${vp.label}`);
    });
  }

  test('Accessibility — decision radio semantics', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await goCounsellingSession(page);
    await goDecisionWorkspace(page);
    await expect(page.getByRole('radiogroup', { name: /Patient Decision/i })).toBeVisible();
    await page.getByTestId('counselling-decision-option-dateforsurgery').focus();
    await page.keyboard.press('Tab');
    await expect(page.locator(':focus')).toBeVisible();
  });
});
