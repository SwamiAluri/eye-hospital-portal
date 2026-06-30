/**
 * Phase 5 — Program closure E2E smoke (merge guard, journey summaries)
 */
import { test, expect } from '@playwright/test';
import { loginAsRole } from './helpers/auth';
import { WARD_PREOP_TEST_IDS } from '../src/lib/ip-management/ward-preop-test-ids';
import { WARD_POSTOP_TEST_IDS } from '../src/lib/ip-management/ward-postop-test-ids';
import { gotoWardPage } from './helpers/ward-preop';

test.describe('Ward program closure @ip-ward-closure', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsRole(page, 'nurse');
    await gotoWardPage(page);
  });

  test('merged MR row shows badge when present in list', async ({ page }) => {
    const mergedRow = page.locator('tr').filter({
      has: page.getByTestId(WARD_PREOP_TEST_IDS.mergedMrBadge),
    }).first();
    test.skip(await mergedRow.count() === 0, 'No merged-MR journey in branch');
    await expect(mergedRow.getByTestId(WARD_PREOP_TEST_IDS.mergedMrBadge)).toBeVisible();
    await expect(mergedRow.locator('.line-through').first()).toBeVisible();
  });

  test('journey modal pre-op tab is read-only summary', async ({ page }) => {
    await page.getByTestId(WARD_PREOP_TEST_IDS.wardStatusTab('All')).click();
    const row = page.locator('[data-clinical-state="InOT"]').first();
    test.skip(await row.count() === 0, 'No InOT journey');
    await row.click();
    await page.getByTestId(WARD_PREOP_TEST_IDS.drawerPrimaryAction).click();
    await page.getByRole('button', { name: 'Pre-Op' }).click();
    await expect(page.getByTestId('journey-preop-summary')).toBeVisible();
    await expect(page.locator('[data-testid^="ward-preop-section-"]')).toHaveCount(0);
  });

  test('post-op workspace is Form 4 primary surface', async ({ page }) => {
    await page.getByTestId(WARD_PREOP_TEST_IDS.wardStatusTab('PostOp')).click();
    const row = page.locator('[data-clinical-state="PostOp"]').first();
    test.skip(await row.count() === 0, 'No PostOp journey');
    await row.click();
    await page.getByTestId(WARD_PREOP_TEST_IDS.drawerPrimaryAction).click();
    await expect(page.getByTestId(WARD_POSTOP_TEST_IDS.workspace)).toBeVisible();
    await expect(page.getByText('Nurse Checklist')).toHaveCount(0);
  });
});
