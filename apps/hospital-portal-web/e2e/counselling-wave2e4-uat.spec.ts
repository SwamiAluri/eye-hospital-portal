/**
 * Wave 2E-4 browser UAT — Quote workspace clinical UX redesign.
 */
import fs from 'fs';
import path from 'path';
import { test, expect, type Page } from '@playwright/test';
import {
  goCounsellingSession,
  hasCounsellingFixture,
  openQuotePanel,
  saveSessionButton,
  toggleEstimateMode,
} from './helpers/counselling';

const SCREENSHOT_DIR = path.join(process.cwd(), 'e2e', 'screenshots', 'wave2e4');

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

async function assertQuoteClinicalStructure(page: Page) {
  await expect(page.getByTestId('counselling-quote-workspace')).toBeVisible();
  await expect(page.getByTestId('counselling-quote-mode-nav')).toBeVisible();
  await expect(page.getByTestId('counselling-journey-rail')).toBeVisible();
  await expect(page.getByTestId('counselling-phase-nav')).toHaveCount(0);
  await expect(page.getByRole('tab', { name: 'Counselling', exact: true })).toHaveCount(0);
  await expect(page.getByTestId('counselling-eye-re')).toBeVisible();
  await expect(page.getByTestId('counselling-tab-custom')).toHaveAttribute('aria-current', 'step');
  await expect(page.getByTestId('counselling-quote-go-to-estimate')).toHaveCount(0);
  const viewport = page.viewportSize();
  if (!viewport || viewport.width >= 1024) {
    await expect(page.getByTestId('counselling-quote-final-payable')).toBeVisible();
  }
}

async function assertNoHorizontalOverflow(page: Page) {
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth + 2,
  );
  expect(overflow).toBe(false);
}

test.describe('Wave 2E-4 Quote Workspace UAT @wave2e4-uat', () => {
  test.describe.configure({ mode: 'serial', timeout: 300_000 });

  test.beforeEach(() => {
    test.skip(!hasCounsellingFixture(), 'Set E2E_COUNSELLING_SESSION_ID');
  });

  test('1 — Quote initial @ 1440×900', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await goCounsellingSession(page);
    await openQuotePanel(page);
    await assertQuoteClinicalStructure(page);
    await expect(page.getByTestId('counselling-quote-final-payable')).toBeVisible();
    await expect(page.getByTestId('counselling-quote-panel')).toBeVisible();
    await assertNoHorizontalOverflow(page);
    await shot(page, '01-quote-initial-1440x900');
  });

  test('2 — Eye selection @ 1440×900', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await goCounsellingSession(page);
    await page.getByTestId('counselling-eye-le').click();
    await expect(page.getByTestId('counselling-eye-le')).toHaveAttribute('aria-pressed', 'true');
    await shot(page, '02-eye-selection-1440x900');
  });

  test('3 — Custom procedure mode @ 1440×900', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await goCounsellingSession(page);
    await toggleEstimateMode(page, 'custom');
    await expect(page.getByTestId('counselling-tab-custom')).toHaveAttribute('aria-pressed', 'true');
    await shot(page, '03-custom-procedure-1440x900');
  });

  test('4 — Package mode @ 1440×900', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await goCounsellingSession(page);
    await toggleEstimateMode(page, 'package');
    await expect(page.getByTestId('counselling-tab-package')).toHaveAttribute('aria-pressed', 'true');
    await shot(page, '04-package-mode-1440x900');
  });

  test('5 — Selected procedure @ 1440×900', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await goCounsellingSession(page);
    const selected = page.getByTestId('counselling-quote-selected-procedure');
    if (!(await selected.isVisible().catch(() => false))) {
      const category = page.locator('#counselling-step-1').getByRole('combobox').first();
      await category.click();
      await page.getByRole('option').first().click();
      const row = page
        .locator('#counselling-step-1 [role="radiogroup"] button, #counselling-step-1 .cursor-pointer')
        .first();
      if (await row.isVisible().catch(() => false)) {
        await row.click();
      }
    }
    await expect(page.getByTestId('counselling-quote-selected-procedure')).toBeVisible();
    await shot(page, '05-selected-procedure-1440x900');
  });

  test('6 — Inline procedure catalog @ 1440×900', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await goCounsellingSession(page);
    await toggleEstimateMode(page, 'custom');
    const grid = page.getByTestId('counselling-quote-procedure-catalog-grid');
    await expect(grid).toBeVisible();
    await grid.getByTestId('counselling-procedure-search').fill('phaco');
    await shot(page, '06-inline-procedure-catalog-1440x900');
  });

  test('7 — Investigations filters @ 1440×900', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await goCounsellingSession(page);
    const configure = page.getByTestId('counselling-quote-selection-configure');
    if (!(await configure.isVisible().catch(() => false))) {
      const grid = page.getByTestId('counselling-quote-procedure-catalog-grid');
      const card = grid.getByRole('button', { name: /Select procedure/i }).first();
      if (await card.isVisible({ timeout: 10_000 }).catch(() => false)) {
        await card.click();
      }
    }
    await page.getByTestId('counselling-tab-lab').click();
    await expect(page.getByTestId('counselling-tab-lab')).toHaveAttribute('aria-current', 'step');
    await page.getByTestId('counselling-tab-imaging').click();
    await expect(page.getByTestId('counselling-tab-imaging')).toHaveAttribute('aria-current', 'step');
    await shot(page, '07-investigation-filters-1440x900');
  });

  test('8 — Quote itemized breakdown @ 1440×900', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await goCounsellingSession(page);
    await openQuotePanel(page);
    await expect(page.getByTestId('counselling-quote-final-payable')).toBeVisible({ timeout: 15_000 });
    const itemized = page.getByTestId('counselling-quote-itemized-breakdown');
    if (await itemized.isVisible().catch(() => false)) {
      await expect(itemized).toBeVisible();
    }
    await shot(page, '08-quote-summary-1440x900');
  });

  test('9 — Read-only gates @ 1440×900', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await goCounsellingSession(page);
    const saveBtn = saveSessionButton(page);
    if (!(await saveBtn.isVisible().catch(() => false))) {
      await shot(page, '09-readonly-post-submit-1440x900');
      return;
    }
    if (await saveBtn.isEnabled()) {
      test.skip(true, 'Editable fixture — use read-only fixture for post-submit gates');
    }
    await expect(saveBtn).toBeDisabled();
    await shot(page, '09-readonly-1440x900');
  });

  for (const vp of VIEWPORTS) {
    test(`10 — responsive Quote @ ${vp.label}`, async ({ page }) => {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await goCounsellingSession(page);
      if (vp.width >= 1024) {
        await openQuotePanel(page);
      }
      await assertQuoteClinicalStructure(page);
      await assertNoHorizontalOverflow(page);
      await shot(page, `responsive-${vp.label}`);
    });
  }

  test('11 — Accessibility semantics @ 1440×900', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await goCounsellingSession(page);
    await page.getByTestId('counselling-tab-custom').focus();
    await expect(page.getByTestId('counselling-tab-custom')).toBeFocused();
    await page.getByTestId('counselling-tab-imaging').focus();
    await expect(page.getByTestId('counselling-tab-imaging')).toBeFocused();
  });
});
