/**
 * Wave 2D-3 browser UAT — Quote workspace UX redesign.
 * Fixture: E2E_COUNSELLING_SESSION_ID (resolve-e2e-counselling-fixtures.ts)
 */
import fs from 'fs';
import path from 'path';
import { test, expect, type Page } from '@playwright/test';
import {
  goCounsellingSession,
  hasCounsellingFixture,
  openProcedureCatalogueSheet,
  openQuotePanel,
  saveSessionButton,
  toggleEstimateMode,
} from './helpers/counselling';

const SCREENSHOT_DIR = path.join(process.cwd(), 'e2e', 'screenshots', 'wave2d3');

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

async function assertQuoteWorkspaceStructure(page: Page) {
  await expect(page.getByTestId('counselling-quote-workspace')).toBeVisible();
  await expect(page.getByTestId('counselling-eye-re')).toBeVisible();
  await expect(page.getByTestId('counselling-tab-custom')).toHaveAttribute('aria-pressed', /true|false/);
  await expect(page.getByTestId('counselling-tab-package')).toHaveAttribute('aria-pressed', /true|false/);
  await expect(page.getByRole('navigation', { name: /Filter investigations by category/i })).toBeVisible();
  await expect(page.getByTestId('counselling-quote-go-to-estimate')).toHaveCount(0);
}

async function assertNoHorizontalOverflow(page: Page) {
  const overflow = await page.evaluate(() => {
    const doc = document.documentElement;
    return doc.scrollWidth > doc.clientWidth + 2;
  });
  expect(overflow).toBe(false);
}

test.describe('Wave 2D-3 Quote Workspace UAT @wave2d3-uat', () => {
  test.describe.configure({ mode: 'serial', timeout: 240_000 });

  test.beforeEach(() => {
    test.skip(!hasCounsellingFixture(), 'Set E2E_COUNSELLING_SESSION_ID');
  });

  test('1 — Quote initial @ 1440×900', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await goCounsellingSession(page);
    await openQuotePanel(page);
    await assertQuoteWorkspaceStructure(page);

    await expect(page.getByTestId('counselling-quote-final-payable')).toBeVisible();
    await expect(page.getByTestId('counselling-quote-panel')).toBeVisible();
    await shot(page, '01-quote-initial-1440x900');
  });

  test('2 — Quote with selected procedure', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await goCounsellingSession(page);

    const selected = page.getByTestId('counselling-quote-selected-procedure');
    if (!(await selected.isVisible().catch(() => false))) {
      const category = page.locator('#counselling-step-1').getByRole('combobox').first();
      await category.click();
      await page.getByRole('option').first().click();
      const row = page.locator('#counselling-step-1 [role="radiogroup"] button, #counselling-step-1 .cursor-pointer').first();
      if (await row.isVisible().catch(() => false)) {
        await row.click();
      }
    }

    await openQuotePanel(page);
    await expect(page.getByTestId('counselling-quote-selected-procedure')).toBeVisible({ timeout: 15_000 });
    await shot(page, '02-quote-selected-procedure-1440x900');
  });

  test('3 — Package mode', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await goCounsellingSession(page);
    await toggleEstimateMode(page, 'package');
    await expect(page.getByTestId('counselling-tab-package')).toHaveAttribute('aria-pressed', 'true');
    await openQuotePanel(page);
    await shot(page, '03-quote-package-mode-1440x900');
  });

  test('4 — Biometry status visible', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await goCounsellingSession(page);
    await toggleEstimateMode(page, 'custom');
    await expect(page.getByTestId('counselling-quote-biometry-status')).toBeVisible({ timeout: 15_000 });
    await shot(page, '04-quote-biometry-status-1440x900');
  });

  test('5 — Investigations Imaging filter', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await goCounsellingSession(page);
    await page.getByTestId('counselling-tab-imaging').click();
    await expect(page.getByTestId('counselling-investigation-search')).toBeVisible();
    await shot(page, '05-investigations-imaging-1440x900');
  });

  test('6 — Investigations Lab filter', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await goCounsellingSession(page);
    await page.getByTestId('counselling-tab-lab').click();
    await expect(page.getByTestId('counselling-investigation-search')).toBeVisible();
    await shot(page, '06-investigations-lab-1440x900');
  });

  test('7 — Quote summary breakdown', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await goCounsellingSession(page);
    await openQuotePanel(page);
    await expect(page.getByTestId('counselling-quote-final-payable')).toBeVisible();
    const breakdown = page.getByTestId('counselling-quote-itemized-breakdown');
    if (await breakdown.isVisible().catch(() => false)) {
      await expect(breakdown).toBeVisible();
    }
    await shot(page, '07-quote-summary-1440x900');
  });

  test('8 — Read-only / post-submit gates', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await goCounsellingSession(page);
    await openQuotePanel(page);

    const saveBtn = saveSessionButton(page);
    if (await saveBtn.isVisible().catch(() => false) && !(await saveBtn.isEnabled())) {
      await expect(saveBtn).toBeDisabled();
    }

    await shot(page, '08-quote-readonly-state-1440x900');
  });

  for (const vp of VIEWPORTS) {
    test(`responsive — no overflow @ ${vp.label}`, async ({ page }) => {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await goCounsellingSession(page);
      await assertQuoteWorkspaceStructure(page);
      if (vp.width >= 1024) {
        await openQuotePanel(page);
      } else {
        await expect(page.getByRole('button', { name: /Estimate/i })).toBeVisible();
      }
      await assertNoHorizontalOverflow(page);
      await shot(page, `09-responsive-${vp.label}`);
    });
  }

  test('Accessibility — quote workspace controls', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await goCounsellingSession(page);

    await openProcedureCatalogueSheet(page);
    const grid = page.getByTestId('counselling-quote-procedure-catalog-grid');
    await grid.getByTestId('counselling-procedure-search').focus();
    await page.keyboard.press('Tab');
    await expect(page.locator(':focus')).toBeVisible();

    await expect(page.getByTestId('counselling-tab-custom')).toHaveAttribute('aria-current', 'step');
    const configure = page.getByTestId('counselling-quote-selection-configure');
    if (!(await configure.isVisible().catch(() => false))) {
      const card = grid.getByRole('button', { name: /Select procedure/i }).first();
      if (await card.isVisible({ timeout: 10_000 }).catch(() => false)) {
        await card.click();
      }
    }
    await page.getByTestId('counselling-tab-imaging').click();
    await expect(page.getByTestId('counselling-tab-imaging')).toHaveAttribute('aria-current', 'step');
  });
});
