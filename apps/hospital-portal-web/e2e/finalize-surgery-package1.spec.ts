import { test, expect } from '@playwright/test';
import { apiLogin, seedBrowserAuth } from './helpers/auth';

/**
 * Package 1 — Finalize Surgery bounded journeys.
 * KPI honesty always asserted. Confirm/Cancel mutation journeys run when
 * a NotConfirmed row is present; otherwise skipped (Manual UAT with seed).
 */
test.describe('Finalize Surgery Package 1', () => {
  test.describe.configure({ timeout: 120_000 });

  test.beforeEach(async ({ page, request }) => {
    const login = await apiLogin(request);
    await seedBrowserAuth(page, login);
    await page.goto('/dashboard/counsellors-desk/finalize-surgery', {
      waitUntil: 'domcontentloaded',
    });
  });

  test('KPI strip shows Awaiting Finalise and not Avg. Wait', async ({ page }) => {
    const summary = page.getByTestId('finalize-surgery-summary');
    await expect(summary).toBeVisible({ timeout: 30_000 });
    await expect(summary.getByText('Awaiting Finalise')).toBeVisible();
    await expect(summary.getByText('Avg. Wait')).toHaveCount(0);
    await expect(page.getByTestId('finalize-stat-avg-wait')).toHaveCount(0);
    await expect(page.getByTestId('finalize-stat-needs-attention')).toBeVisible();
    await expect(page.getByTestId('finalize-stat-surgery-done')).toBeVisible();
  });

  test('Journey A — Confirm requires Reporting Time then Confirmed', async ({ page }) => {
    const summary = page.getByTestId('finalize-surgery-summary');
    await expect(summary).toBeVisible({ timeout: 30_000 });

    const openBtn = page
      .locator('[data-testid="finalize-row-open"], button:has-text("Open"), button:has-text("View")')
      .first();
    const hasRow = await openBtn.isVisible({ timeout: 15_000 }).catch(() => false);
    test.skip(!hasRow, 'No Finalize row available — Manual UAT with seed');

    await openBtn.click();
    const dialog = page.getByRole('dialog').or(page.locator('[role="dialog"]')).first();
    await expect(dialog).toBeVisible({ timeout: 15_000 });

    const confirmBtn = dialog.getByRole('button', { name: /^Confirm$/i });
    const canConfirm = await confirmBtn.isVisible().catch(() => false);
    test.skip(!canConfirm, 'Opened row is not NotConfirmed — Manual UAT with seed');

    const reporting = dialog.locator('#reporting-time, input[name="reportingTime"], input[type="time"]').first();
    if (await reporting.isVisible().catch(() => false)) {
      await reporting.fill('');
      await confirmBtn.click();
      await expect(
        dialog.getByText(/Reporting time is required|valid reporting time/i).first(),
      ).toBeVisible({ timeout: 5_000 });
      await reporting.fill('07:30');
    }

    await confirmBtn.click();
    await expect(dialog.getByText(/Confirmed/i).first()).toBeVisible({ timeout: 20_000 });
  });

  test('Journey B — Cancel requires confirmation dialog + reason', async ({ page }) => {
    const summary = page.getByTestId('finalize-surgery-summary');
    await expect(summary).toBeVisible({ timeout: 30_000 });

    const openBtn = page
      .locator('[data-testid="finalize-row-open"], button:has-text("Open"), button:has-text("View")')
      .first();
    const hasRow = await openBtn.isVisible({ timeout: 15_000 }).catch(() => false);
    test.skip(!hasRow, 'No Finalize row available — Manual UAT with seed');

    await openBtn.click();
    const dialog = page.getByRole('dialog').or(page.locator('[role="dialog"]')).first();
    await expect(dialog).toBeVisible({ timeout: 15_000 });

    const cancelBtn = dialog.getByRole('button', { name: /Cancel Surgery/i });
    const canCancel = await cancelBtn.isVisible().catch(() => false);
    test.skip(!canCancel, 'Opened row has no Cancel CTA — Manual UAT with seed');

    await cancelBtn.click();
    await expect(page.getByText('Cancel surgery?')).toBeVisible({ timeout: 10_000 });
    await expect(page.getByLabel(/Cancellation reason/i)).toBeVisible();

    const submit = page.getByRole('button', { name: /^Cancel surgery$/i }).last();
    await submit.click();
    await expect(page.getByText(/Cancellation reason is required/i)).toBeVisible({
      timeout: 5_000,
    });

    await page.getByLabel(/Cancellation reason/i).fill('E2E Package 1 cancel reason');
    await submit.click();
    await expect(page.getByText(/Cancelled|cancel/i).first()).toBeVisible({ timeout: 20_000 });
  });

  test('Package LA — Confirmed queue Finalise remains; modal has no Finalise footer', async ({
    page,
  }) => {
    const summary = page.getByTestId('finalize-surgery-summary');
    await expect(summary).toBeVisible({ timeout: 30_000 });

    const confirmedTab = page.getByRole('button', { name: /^Confirmed$/i }).first();
    if (await confirmedTab.isVisible({ timeout: 5_000 }).catch(() => false)) {
      await confirmedTab.click();
    }

    const row = page
      .locator('[data-testid="finalize-surgery-work-row"]')
      .filter({ has: page.getByRole('button', { name: /^Finalise$/i }) })
      .first();
    const hasRow = await row.isVisible({ timeout: 15_000 }).catch(() => false);
    test.skip(!hasRow, 'No Confirmed row with Finalise CTA — Manual UAT with seed');

    await expect(row.getByRole('button', { name: /^Finalise$/i })).toBeVisible();
    await row.click();

    const dialog = page.getByTestId('finalize-ot-modal');
    await expect(dialog).toBeVisible({ timeout: 15_000 });
    await expect(dialog.getByRole('button', { name: /^Finalise$/i })).toHaveCount(0);
    await expect(dialog.getByRole('button', { name: /Save \(will revert\)/i })).toBeVisible();
    await expect(dialog.getByRole('button', { name: /Cancel Surgery/i })).toBeVisible();
    await dialog.getByRole('button', { name: /^Close$/i }).click();
  });
});
