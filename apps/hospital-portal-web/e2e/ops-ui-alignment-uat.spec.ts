/**
 * One-shot visual UAT for Waiting List + Finalize Surgery redesign.
 * Run: npx playwright test e2e/ops-ui-alignment-uat.spec.ts --project=chromium
 */
import { test, expect } from '@playwright/test';
import path from 'path';
import fs from 'fs';

const OUT = path.join(__dirname, 'screenshots', 'ops-ui-alignment');

test.describe('Ops UI alignment UAT', () => {
  test.beforeAll(() => {
    fs.mkdirSync(OUT, { recursive: true });
  });

  test('Waiting List desktop / tablet / narrow', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/dashboard/counsellors-desk/waiting-list', { waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('heading', { name: 'Waiting List' })).toBeVisible({ timeout: 60_000 });
    await expect(page.locator('main').getByText("Counsellor's Desk")).toHaveCount(0);
    await expect(page.getByText('Queue overview')).toHaveCount(0);
    await expect(page.getByTestId('waiting-list-summary')).toBeVisible();
    await expect(page.getByTestId('waiting-list-stats')).toBeVisible();
    await expect(page.getByTestId('waiting-list-stat-patients')).toBeVisible();
    await expect(page.getByTestId('waiting-list-stat-pending')).toBeVisible();
    await expect(page.getByTestId('waiting-list-stat-processing')).toBeVisible();
    await expect(page.getByTestId('waiting-list-stat-done')).toBeVisible();
    await expect(page.getByTestId('waiting-list-stat-repeat-counselling')).toBeVisible();
    await expect(page.getByTestId('waiting-list-summary-strip')).toHaveAttribute(
      'data-status-style',
      'pill-tab',
    );
    await expect(page.getByTestId('waiting-list-status-tab-All')).toHaveAttribute('aria-selected', 'true');
    await expect(page.getByTestId('waiting-list-queue-toolbar')).toBeVisible();
    await expect(page.getByTestId('waiting-list-queue')).toBeVisible();
    await expect(page.getByTestId('waiting-list-filters-toggle')).toHaveCount(0);
    await expect(page.getByRole('button', { name: /^Filters$/i })).toHaveCount(0);
    await expect(page.getByTestId('waiting-list-patient-name')).toHaveCount(0);
    await expect(page.getByTestId('waiting-list-mrd')).toHaveCount(0);
    await expect(page.getByTestId('waiting-list-quick-search')).toBeVisible();
    await expect(page.getByTestId('waiting-list-date-filters')).toBeVisible();
    await expect(page.getByTestId('waiting-list-add-patient')).toBeVisible();
    // No View/Open nav buttons in queue
    const queue = page.getByTestId('waiting-list-queue');
    await expect(queue.getByRole('button', { name: /^View$/i })).toHaveCount(0);
    await expect(queue.getByRole('button', { name: /^Open$/i })).toHaveCount(0);

    const overflow = await page.evaluate(() => ({
      scrollWidth: document.documentElement.scrollWidth,
      clientWidth: document.documentElement.clientWidth,
    }));
    expect(overflow.scrollWidth).toBeLessThanOrEqual(overflow.clientWidth + 1);
    await page.screenshot({ path: path.join(OUT, 'waiting-list-desktop.png'), fullPage: true });

    for (const [w, h, name] of [
      [900, 800, 'waiting-list-tablet'],
      [390, 844, 'waiting-list-narrow'],
    ] as const) {
      await page.setViewportSize({ width: w, height: h });
      const ov = await page.evaluate(() => ({
        scrollWidth: document.documentElement.scrollWidth,
        clientWidth: document.documentElement.clientWidth,
      }));
      expect(ov.scrollWidth, `no page H-scroll at ${w}`).toBeLessThanOrEqual(ov.clientWidth + 1);
      await page.screenshot({ path: path.join(OUT, `${name}.png`), fullPage: true });
    }
  });

  test('Finalize Surgery desktop / tablet / narrow + modals', async ({ page }) => {
    test.setTimeout(90_000);
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/dashboard/counsellors-desk/finalize-surgery', { waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('heading', { name: 'Surgery Finalization' })).toBeVisible({ timeout: 60_000 });
    // Page content must not repeat Counsellor's Desk breadcrumb (sidebar context is enough)
    await expect(page.locator('main').getByText("Counsellor's Desk")).toHaveCount(0);
    await expect(page.getByTestId('finalize-surgery-summary')).toBeVisible();
    await expect(page.getByTestId('finalize-stat-scheduled')).toBeVisible();
    await expect(page.getByTestId('finalize-stat-needs-attention')).toBeVisible();
    await expect(page.getByTestId('finalize-stat-surgery-done')).toBeVisible();
    await expect(page.getByTestId('finalize-stat-avg-wait')).toBeVisible();
    await expect(page.getByTestId('finalize-surgery-workspace-nav')).toBeVisible();
    await expect(page.getByTestId('finalize-workspace-finalization')).toBeVisible();
    await expect(page.getByTestId('finalize-workspace-ot-preparation')).toBeVisible();
    await expect(page.getByTestId('finalize-surgery-status-nav')).toHaveAttribute(
      'data-status-style',
      'pill-tab',
    );
    await expect(page.getByTestId('finalize-surgery-workspace')).toBeVisible();
    await expect(page.getByTestId('finalize-surgery-toolbar')).toBeVisible();
    await expect(page.getByText('Schedule overview')).toHaveCount(0);
    await expect(page.getByText('Surgery schedule and finalization work queue')).toHaveCount(0);
    await expect(page.getByTestId('finalize-stat-scheduled').getByText('Scheduled')).toBeVisible();
    // Status pills live inside the Surgery Finalization workspace (approved layout)
    await expect(
      page.getByTestId('finalize-surgery-workspace').getByTestId('finalize-surgery-status-nav'),
    ).toBeVisible();
    await expect(page.getByTestId('finalize-status-tab-All')).toHaveAttribute('aria-selected', 'true');
    await expect(page.getByTestId('finalize-surgery-table-viewport')).toBeVisible();
    // Pagination reuses Waiting List component (client-side slice)
    await expect(page.getByTestId('finalize-surgery-workspace').locator('.animate-pulse')).toHaveCount(0, {
      timeout: 30_000,
    });
    const rowCount = await page.getByTestId('finalize-surgery-work-row').count();
    if (rowCount > 0) {
      await expect(page.getByTestId('finalize-surgery-pagination')).toBeVisible();
      await expect(page.getByTestId('finalize-surgery-pagination').getByText(/Showing/)).toBeVisible();
      await expect(page.getByTestId('finalize-surgery-pagination').getByText(/records/)).toBeVisible();
      if (rowCount >= 10) {
        await expect(page.getByTestId('waiting-list-pagination-page-2')).toBeVisible();
        await page.getByTestId('waiting-list-pagination-next').click();
        await expect(page.getByTestId('waiting-list-pagination-page-2')).toHaveAttribute(
          'aria-current',
          'page',
        );
        await page.getByTestId('finalize-status-tab-NotConfirmed').click();
        await expect(page.getByTestId('finalize-status-tab-NotConfirmed')).toHaveAttribute(
          'aria-selected',
          'true',
        );
        // Filter change resets to page 1 (Waiting List behaviour)
        await expect(page.getByTestId('waiting-list-pagination-page-1')).toHaveAttribute(
          'aria-current',
          'page',
        );
        await page.getByTestId('finalize-status-tab-All').click();
      }
    }
    // OT Preparation is a separate workspace — not stacked under the queue
    await expect(
      page.getByTestId('finalize-surgery-workspace').getByTestId('finalize-prepared-ot-list'),
    ).toHaveCount(0);

    await page.getByTestId('finalize-workspace-ot-preparation').click();
    await expect(page.getByTestId('finalize-ot-preparation-workspace')).toBeVisible();
    await expect(page.getByTestId('finalize-prepared-ot-list')).toBeVisible();
    await expect(page.getByText(/No prepared OT list for this date/i)).toBeVisible();
    await expect(page.getByRole('button', { name: 'Load OT List' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Prepare New List' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Manage' })).toHaveCount(0);

    await page.getByTestId('finalize-workspace-finalization').click();
    await expect(page.getByTestId('finalize-surgery-workspace')).toBeVisible();

    const overflow = await page.evaluate(() => ({
      scrollWidth: document.documentElement.scrollWidth,
      clientWidth: document.documentElement.clientWidth,
    }));
    expect(overflow.scrollWidth).toBeLessThanOrEqual(overflow.clientWidth + 1);
    await page.screenshot({ path: path.join(OUT, 'finalize-surgery-desktop.png'), fullPage: true });

    for (const [w, h, name] of [
      [1280, 800, 'finalize-surgery-1280'],
      [1024, 768, 'finalize-surgery-1024'],
      [900, 800, 'finalize-surgery-tablet'],
      [768, 900, 'finalize-surgery-768'],
      [390, 844, 'finalize-surgery-narrow'],
    ] as const) {
      await page.setViewportSize({ width: w, height: h });
      const ov = await page.evaluate(() => ({
        scrollWidth: document.documentElement.scrollWidth,
        clientWidth: document.documentElement.clientWidth,
      }));
      expect(ov.scrollWidth, `no page H-scroll at ${w}`).toBeLessThanOrEqual(ov.clientWidth + 1);
      await page.screenshot({ path: path.join(OUT, `${name}.png`), fullPage: true });
    }

    await page.setViewportSize({ width: 1440, height: 900 });

    // Prefer an editable Not Confirmed row for date/time/anaesthesia control UAT
    await page.getByTestId('finalize-status-tab-NotConfirmed').click();
    await expect(page.getByTestId('finalize-status-tab-NotConfirmed')).toHaveAttribute('aria-selected', 'true');
    await expect(page.getByTestId('finalize-surgery-workspace').locator('.animate-pulse')).toHaveCount(0, {
      timeout: 30_000,
    });
    const row = page.getByTestId('finalize-surgery-work-row').first();
    if (await row.count()) {
      await row.click();
      const dialog = page.getByRole('dialog');
      await expect(dialog).toBeVisible({ timeout: 30_000 });
      await expect(dialog.getByRole('heading').first()).toBeVisible({ timeout: 30_000 });
      await expect(dialog.locator('.animate-pulse')).toHaveCount(0, { timeout: 30_000 });
      await expect(dialog.getByTestId('finalize-ot-surgery-schedule')).toBeVisible();
      await expect(dialog.getByTestId('finalize-ot-anaesthesia-team')).toBeVisible();
      await expect(dialog.getByTestId('finalize-ot-financial')).toBeVisible();
      await expect(dialog.getByTestId('finalize-ot-outpatient-safety')).toBeVisible();
      await expect(dialog.getByTestId('finalize-ot-notes')).toBeVisible();
      await expect(dialog.getByText('Patient Details')).toHaveCount(0);
      await expect(dialog.getByText('Date of Birth')).toHaveCount(0);
      const modalBox = await dialog.boundingBox();
      if (modalBox) {
        expect(modalBox.width).toBeLessThanOrEqual(1000);
        expect(modalBox.height).toBeLessThanOrEqual(Math.round(900 * 0.9));
      }

      // Date / time / anaesthetist controls (editable Not Confirmed rows)
      const surgeryDate = dialog.getByTestId('finalize-ot-surgery-date');
      if (await surgeryDate.count()) {
        await surgeryDate.click();
        await page.waitForTimeout(400);
        await page.screenshot({ path: path.join(OUT, 'finalize-ot-date-picker.png') });
        await page.keyboard.press('Escape');
        await expect(dialog).toBeVisible();
      }

      const startTime = dialog.getByTestId('finalize-ot-start-time');
      if (await startTime.count()) {
        await startTime.click();
        await expect(page.getByRole('group', { name: 'Select time' })).toBeVisible({ timeout: 10_000 });
        await page.screenshot({ path: path.join(OUT, 'finalize-ot-time-picker.png') });
        await page.keyboard.press('Escape');
        await expect(dialog).toBeVisible();
      }

      const anesthetistRoot = dialog.getByTestId('anesthetist-select');
      await anesthetistRoot.scrollIntoViewIfNeeded().catch(() => undefined);
      const anesthetistTrigger = dialog.getByTestId('anesthetist-select-trigger');
      if (await anesthetistTrigger.count()) {
        await anesthetistTrigger.click();
        await expect(page.getByPlaceholder('Search anaesthetists…')).toBeVisible({ timeout: 10_000 });
        await page.screenshot({ path: path.join(OUT, 'finalize-ot-anesthetist-dropdown.png') });
        const staffItems = page.locator('[cmdk-item]');
        const staffCount = await staffItems.count();
        expect(staffCount).toBeGreaterThan(1); // at least one staff + Other
        let staffLabel = '';
        if (staffCount > 1) {
          staffLabel = ((await staffItems.nth(0).innerText()).split('\n')[0] ?? '').trim();
        }
        await page.getByPlaceholder('Search anaesthetists…').fill('Other');
        await page.getByTestId('anesthetist-select-other').press('Enter');
        await expect(dialog.getByTestId('anesthetist-manual-name')).toBeVisible({ timeout: 10_000 });
        await page.screenshot({ path: path.join(OUT, 'finalize-ot-anesthetist-other.png') });
        if (staffLabel && staffLabel !== 'Other / Not listed') {
          await dialog.getByTestId('anesthetist-manual-name').fill(staffLabel);
          await expect(dialog.getByTestId('anesthetist-duplicate-warning')).toBeVisible({ timeout: 5_000 });
          await page.screenshot({ path: path.join(OUT, 'finalize-ot-anesthetist-duplicate.png') });
          await dialog.getByTestId(/anesthetist-select-existing-/).first().click();
          await expect(dialog.getByTestId('anesthetist-manual-name')).toHaveCount(0);
        }

        // Anaesthesia Type selection
        const anesthesiaTrigger = dialog.getByTestId('finalize-ot-anesthesia-type').getByRole('combobox');
        await anesthesiaTrigger.click();
        await page.getByRole('option', { name: /Topical|Local|General|Sedation|Block/i }).first().click();
        await expect(dialog.getByTestId('finalize-ot-anesthesia-type')).not.toContainText('Select anaesthesia type');
        await page.screenshot({ path: path.join(OUT, 'finalize-ot-anesthesia-type-selected.png') });
      }

      await page.screenshot({ path: path.join(OUT, 'finalize-ot-modal.png') });
      await page.setViewportSize({ width: 900, height: 800 });
      await page.screenshot({ path: path.join(OUT, 'finalize-ot-modal-tablet.png') });
      await page.setViewportSize({ width: 390, height: 844 });
      await page.screenshot({ path: path.join(OUT, 'finalize-ot-modal-narrow.png') });
      await page.setViewportSize({ width: 1440, height: 900 });
      if (await dialog.isVisible()) {
        await dialog.getByText('Close', { exact: true }).click({ timeout: 5_000 });
        await expect(dialog).toHaveCount(0);
      }
    }

    // Prepare OT List — switches to OT workspace + opens same prepare modal
    const prepareBtn = page.getByRole('button', { name: 'Prepare OT List' }).first();
    if (await prepareBtn.isEnabled()) {
      await prepareBtn.click();
      await expect(page.getByTestId('finalize-ot-preparation-workspace')).toBeVisible();
      await expect(page.getByRole('heading', { name: 'Prepare OT List' })).toBeVisible();
      await expect(page.getByRole('button', { name: 'Lock & Prepare' })).toBeVisible();
      await page.screenshot({ path: path.join(OUT, 'prepare-ot-modal.png') });
      await page.getByRole('button', { name: 'Cancel' }).click();
    }
  });
});
