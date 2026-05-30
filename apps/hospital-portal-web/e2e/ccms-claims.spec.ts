/**
 * E2E smoke tests — CCMS Claims Queue and Reconciliation workbench.
 */
import { test, expect } from '@playwright/test';
import { goCcmsClaims, goCcmsReconciliation, expectNoErrorState } from './helpers/ccms';

test.describe('CCMS — Claims Queue', () => {
  test('claims queue page loads without errors', async ({ page }) => {
    await goCcmsClaims(page);
    await expectNoErrorState(page);
  });

  test('claims queue renders table or empty state', async ({ page }) => {
    await goCcmsClaims(page);

    const hasTable = await page.locator('table').count() > 0;
    const hasEmpty = await page.getByText(/no claims|empty|0 claims/i).count() > 0;

    expect(hasTable || hasEmpty).toBeTruthy();
  });

  test('claims table has expected column headers', async ({ page }) => {
    await goCcmsClaims(page);

    if (await page.locator('table').count() === 0) { test.skip(); return; }

    const headers = page.locator('th');
    await expect(headers.filter({ hasText: /claim/i }).first()).toBeVisible();
    await expect(headers.filter({ hasText: /amount/i }).first()).toBeVisible();
    await expect(headers.filter({ hasText: /status/i }).first()).toBeVisible();
  });

  test('Generate Claim modal has aria-modal attribute', async ({ page }) => {
    await goCcmsClaims(page);

    const genBtn = page
      .getByRole('button', { name: /generate claim|new claim/i })
      .first();

    if (await genBtn.count() === 0) { test.skip(); return; }

    await genBtn.click();
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible({ timeout: 5_000 });
    await expect(dialog).toHaveAttribute('aria-modal', 'true');
  });
});

test.describe('CCMS — Reconciliation Workbench', () => {
  test('reconciliation page loads without errors', async ({ page }) => {
    await goCcmsReconciliation(page);
    await expectNoErrorState(page);
  });

  test('reconciliation page shows settlement list or empty state', async ({ page }) => {
    await goCcmsReconciliation(page);

    const hasTable   = await page.locator('table').count() > 0;
    const hasContent = await page.locator('[data-testid="reconciliation-list"]').count() > 0;
    const hasEmpty   = await page.getByText(/no settlements|empty|0 settlements/i).count() > 0;

    expect(hasTable || hasContent || hasEmpty).toBeTruthy();
  });

  test('Record Settlement modal has aria-modal attribute', async ({ page }) => {
    await goCcmsReconciliation(page);

    const recordBtn = page
      .getByRole('button', { name: /record settlement|add settlement/i })
      .first();

    if (await recordBtn.count() === 0) { test.skip(); return; }

    await recordBtn.click();
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible({ timeout: 5_000 });
    await expect(dialog).toHaveAttribute('aria-modal', 'true');
  });
});
