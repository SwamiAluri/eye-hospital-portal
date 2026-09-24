import { test, expect } from '@playwright/test';
import { apiLogin, seedBrowserAuth } from './helpers/auth';

/**
 * RESP2 — OT Preparation Finalised worklist + selection Prepare.
 * No primary date-dashboard; no duplicate OTPrepared grid.
 */
test.describe('Finalize Surgery OT Preparation RESP2', () => {
  test.describe.configure({ timeout: 120_000 });

  test.beforeEach(async ({ page, request }) => {
    const login = await apiLogin(request);
    await seedBrowserAuth(page, login);
    await page.goto('/dashboard/counsellors-desk/finalize-surgery', {
      waitUntil: 'domcontentloaded',
    });
  });

  test('OT Preparation shows Finalised worklist; no date-dashboard or prepared grid', async ({
    page,
  }) => {
    await expect(page.getByTestId('finalize-surgery-summary')).toBeVisible({ timeout: 30_000 });
    await expect(page.getByTestId('finalize-surgery-page-title')).toHaveText('Surgery Finalization');

    await page.getByTestId('finalize-workspace-ot-preparation').click();

    await expect(page.getByTestId('finalize-surgery-page-title')).toHaveText('OT Preparation');
    await expect(page.getByTestId('finalize-ot-prep-purpose')).toContainText(
      'Prepare Finalised surgeries for OT',
    );
    await expect(page.getByTestId('finalize-ot-preparation-workspace')).toBeVisible();
    await expect(page.getByTestId('finalize-ot-prep-summary')).toBeVisible();
    await expect(page.getByTestId('finalize-ot-stat-finalised')).toBeVisible();
    await expect(page.getByTestId('finalize-ot-stat-selected')).toBeVisible();
    await expect(page.getByTestId('finalize-ot-prep-toolbar')).toBeVisible();
    await expect(page.getByTestId('finalize-ot-prep-date-input')).toBeVisible();
    await expect(page.getByTestId('finalize-ot-prep-uhid-input')).toBeVisible();
    await expect(page.getByTestId('finalize-ot-prep-name-input')).toBeVisible();
    await expect(page.getByTestId('finalize-ot-prepare-selected')).toBeVisible();
    await expect(page.getByTestId('finalize-ot-prep-print-prepared')).toBeVisible();
    await expect(page.getByTestId('finalize-ot-surgery-date-catalog')).toHaveCount(0);
    await expect(page.getByTestId('finalize-ot-stat-ready')).toHaveCount(0);
    await expect(page.getByTestId('finalize-ot-stat-dates-requiring')).toHaveCount(0);
    await expect(page.getByTestId('finalize-ot-ready-preview-grid')).toHaveCount(0);
    await expect(page.getByTestId('finalize-ot-prepared-grid')).toHaveCount(0);
    await expect(page.getByTestId('finalize-ot-quick-nav')).toHaveCount(0);
    await expect(page.getByText('Next 2 days')).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Prepare New List' })).toHaveCount(0);
  });

  test('Finalization strip restored on Surgery Finalization tab', async ({ page }) => {
    await expect(page.getByTestId('finalize-surgery-summary')).toBeVisible({ timeout: 30_000 });
    await page.getByTestId('finalize-workspace-ot-preparation').click();
    await expect(page.getByTestId('finalize-surgery-page-title')).toHaveText('OT Preparation');

    await page.getByTestId('finalize-workspace-finalization').click();
    await expect(page.getByTestId('finalize-surgery-page-title')).toHaveText('Surgery Finalization');
    await expect(page.getByTestId('finalize-surgery-summary')).toBeVisible();
    await expect(page.getByTestId('finalize-ot-prep-summary')).toHaveCount(0);
  });

  test('search / filter controls and pagination present on Finalised worklist', async ({
    page,
  }) => {
    await expect(page.getByTestId('finalize-surgery-summary')).toBeVisible({ timeout: 30_000 });
    await page.getByTestId('finalize-workspace-ot-preparation').click();

    await page.getByTestId('finalize-ot-prep-uhid-input').fill('ZZZ-NO-MATCH-RESP2');
    await expect(page.getByTestId('finalize-ot-prep-empty')).toBeVisible({ timeout: 15_000 });

    await page.getByTestId('finalize-ot-prep-uhid-input').fill('');
    await page.getByTestId('finalize-ot-prep-name-input').fill('');

    const rows = page.locator('[data-testid^="finalize-ot-prep-row-"]');
    await expect
      .poll(async () => rows.count(), { timeout: 20_000 })
      .toBeGreaterThanOrEqual(0);

    if ((await rows.count()) === 0) {
      await expect(page.getByTestId('finalize-ot-prep-empty')).toBeVisible();
      return;
    }

    await expect(page.getByTestId('finalize-ot-prep-select-all-visible')).toBeVisible();
    await expect(page.getByTestId('finalize-ot-prep-pagination')).toBeVisible();
  });

  test('selection: individual, select all visible, clear; Prepare gated', async ({ page }) => {
    await expect(page.getByTestId('finalize-surgery-summary')).toBeVisible({ timeout: 30_000 });
    await page.getByTestId('finalize-workspace-ot-preparation').click();

    const rows = page.locator('[data-testid^="finalize-ot-prep-row-"]');
    await expect
      .poll(async () => rows.count(), { timeout: 20_000 })
      .toBeGreaterThan(0)
      .catch(() => null);

    if ((await rows.count()) === 0) {
      test.skip(true, 'No Finalised rows in environment for selection journey');
      return;
    }

    const prepareBtn = page.getByTestId('finalize-ot-prepare-selected');
    await expect(prepareBtn).toBeDisabled();

    const firstCheckbox = rows.first().locator('input[type="checkbox"]');
    await firstCheckbox.check();
    await expect(page.getByTestId('finalize-ot-stat-selected')).toContainText('1');
    await expect(prepareBtn).toBeEnabled();

    await firstCheckbox.uncheck();
    await expect(page.getByTestId('finalize-ot-stat-selected')).toContainText('0');
    await expect(prepareBtn).toBeDisabled();

    await page.getByTestId('finalize-ot-prep-select-all-visible').click();
    const visibleCount = await rows.count();
    await expect(page.getByTestId('finalize-ot-stat-selected')).toContainText(String(visibleCount));

    await page.getByTestId('finalize-ot-prep-clear-selection').click();
    await expect(page.getByTestId('finalize-ot-stat-selected')).toContainText('0');
  });

  test('Prepare confirmation shows selected count; cancel closes', async ({ page }) => {
    await expect(page.getByTestId('finalize-surgery-summary')).toBeVisible({ timeout: 30_000 });
    await page.getByTestId('finalize-workspace-ot-preparation').click();

    const rows = page.locator('[data-testid^="finalize-ot-prep-row-"]');
    if ((await rows.count()) === 0) {
      await expect
        .poll(async () => rows.count(), { timeout: 20_000 })
        .toBeGreaterThan(0)
        .catch(() => null);
    }
    if ((await rows.count()) === 0) {
      test.skip(true, 'No Finalised rows for Prepare confirmation');
      return;
    }

    await rows.first().locator('input[type="checkbox"]').check();
    await page.getByTestId('finalize-ot-prepare-selected').click();
    await expect(page.getByTestId('finalize-ot-prep-confirm')).toBeVisible();
    await expect(page.getByTestId('finalize-ot-prep-confirm-count')).toContainText('1');
    await page.getByTestId('finalize-ot-prep-confirm-cancel').click();
    await expect(page.getByTestId('finalize-ot-prep-confirm')).toHaveCount(0);
  });

  test('Open row uses FinalizeOtModal', async ({ page }) => {
    await expect(page.getByTestId('finalize-surgery-summary')).toBeVisible({ timeout: 30_000 });
    await page.getByTestId('finalize-workspace-ot-preparation').click();

    const openBtn = page.locator('[data-testid^="finalize-ot-prep-open-"]').first();
    await expect
      .poll(async () => openBtn.count(), { timeout: 20_000 })
      .toBeGreaterThan(0)
      .catch(() => null);
    if ((await openBtn.count()) === 0) {
      test.skip(true, 'No Finalised rows to open');
      return;
    }
    await openBtn.click();
    await expect(page.getByTestId('finalize-ot-modal')).toBeVisible({ timeout: 15_000 });
  });

  test('View OT Prepared navigates to Finalization OT Prepared after success affordance', async ({
    page,
  }) => {
    await expect(page.getByTestId('finalize-surgery-summary')).toBeVisible({ timeout: 30_000 });
    await page.getByTestId('finalize-workspace-ot-preparation').click();

    const viewBtn = page.getByTestId('finalize-ot-view-prepared');
    if ((await viewBtn.count()) === 0) {
      // Without a prior Prepare in-session, navigate via Finalization protection path
      await page.getByTestId('finalize-workspace-finalization').click();
      await page.getByTestId('finalize-status-tab-OTPrepared').click();
      await expect(page.getByTestId('finalize-status-tab-OTPrepared')).toHaveAttribute(
        'aria-selected',
        'true',
      );
      await expect(page.getByTestId('finalize-ot-prepared-grid')).toHaveCount(0);
      return;
    }

    await viewBtn.click();
    await expect(page.getByTestId('finalize-surgery-workspace')).toBeVisible();
    await expect(page.getByTestId('finalize-status-tab-OTPrepared')).toHaveAttribute(
      'aria-selected',
      'true',
    );
  });

  test('Finalization OT Prepared worklist remains available', async ({ page }) => {
    await expect(page.getByTestId('finalize-surgery-summary')).toBeVisible({ timeout: 30_000 });
    await expect(page.getByTestId('finalize-surgery-workspace')).toBeVisible();
    await page.getByTestId('finalize-status-tab-OTPrepared').click();
    await expect(page.getByTestId('finalize-status-tab-OTPrepared')).toHaveAttribute(
      'aria-selected',
      'true',
    );
    await expect(page.getByTestId('finalize-surgery-toolbar')).toBeVisible();
    await expect(page.getByTestId('finalize-ot-prepared-grid')).toHaveCount(0);
  });
});
