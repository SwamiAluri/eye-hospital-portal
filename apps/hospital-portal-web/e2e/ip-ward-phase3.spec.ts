/**
 * E2E: Phase 3 continuity — journey summaries, post-op workspace shell (WF-06/07)
 */
import { test, expect } from '@playwright/test';
import { loginAsRole } from './helpers/auth';
import { WARD_PREOP_TEST_IDS } from '../src/lib/ip-management/ward-preop-test-ids';
import { WARD_POSTOP_TEST_IDS } from '../src/lib/ip-management/ward-postop-test-ids';
import { gotoWardPage, selectWardStatusTab } from './helpers/ward-preop';

test.describe('Ward Phase 3 continuity @ip-ward-phase3', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsRole(page, 'nurse');
    await gotoWardPage(page);
  });

  test('Post-Op workspace has Form 4 only — no legacy nurse/surgeon tabs', async ({ page }) => {
    await page.getByTestId(WARD_PREOP_TEST_IDS.wardStatusTab('PostOp')).click();
    const row = page.locator('[data-clinical-state="PostOp"]').first();
    test.skip(await row.count() === 0, 'No PostOp journey in branch');
    await row.click();
    await page.getByTestId(WARD_PREOP_TEST_IDS.drawerPrimaryAction).click();

    const workspace = page.getByTestId(WARD_POSTOP_TEST_IDS.workspace);
    await expect(workspace).toBeVisible();
    await expect(page.getByTestId(WARD_POSTOP_TEST_IDS.tabForm4)).toBeVisible();
    await expect(page.getByTestId(WARD_POSTOP_TEST_IDS.tabOverview)).toBeVisible();
    await expect(page.getByText('Nurse Checklist')).toHaveCount(0);
    await expect(page.getByText('Surgeon Checklist')).toHaveCount(0);
    await expect(page.getByTestId(WARD_POSTOP_TEST_IDS.btnMarkReady)).toBeVisible();
  });

  test('Journey modal pre-op tab is read-only with workspace deep link', async ({ page }) => {
    await selectWardStatusTab(page, 'All');
    const row = page.locator('[data-clinical-state="SentToOT"]').first();
    test.skip(await row.count() === 0, 'No SentToOT journey in branch');

    await row.click();
    await page.getByTestId(WARD_PREOP_TEST_IDS.drawerPrimaryAction).click();
    const modal = page.getByTestId('journey-modal');
    await expect(modal).toBeVisible();
    await modal.getByTestId('journey-tab-preop').click();
    await expect(page.getByTestId('journey-preop-summary')).toBeVisible();
    await expect(page.getByTestId('journey-deep-link-preop-workspace')).toHaveCount(0);
    await expect(page.locator('[data-testid^="ward-preop-section-"]')).toHaveCount(0);
  });

  test('Journey modal post-op tab shows read-only Form 4 summary', async ({ page }) => {
    await selectWardStatusTab(page, 'All');
    const row = page.locator('[data-clinical-state="SurgeryCompleted"]').first();
    test.skip(await row.count() === 0, 'No SurgeryCompleted journey in branch');

    await row.click();
    await page.getByTestId(WARD_PREOP_TEST_IDS.drawerPrimaryAction).click();
    const modal = page.getByTestId('journey-modal');
    await expect(modal).toBeVisible();
    await modal.getByTestId('journey-tab-postop').click();
    await expect(page.getByTestId('journey-postop-summary')).toBeVisible();
    await expect(page.getByText('Read-only post-op summary')).toBeVisible();
  });
});
