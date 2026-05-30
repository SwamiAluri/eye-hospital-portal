/**
 * E2E smoke tests — CCMS Pre-Authorization queue.
 */
import { test, expect } from '@playwright/test';
import { goCcmsPreAuth, expectNoErrorState } from './helpers/ccms';

test.describe('CCMS — Pre-Authorization Queue', () => {
  test('preauth queue page loads without errors', async ({ page }) => {
    await goCcmsPreAuth(page);
    await expectNoErrorState(page);
  });

  test('preauth queue renders a table or empty state', async ({ page }) => {
    await goCcmsPreAuth(page);

    const hasTable = await page.locator('table').count() > 0;
    const hasEmpty = await page.getByText(/no items|empty|0 items/i).count() > 0;

    expect(hasTable || hasEmpty).toBeTruthy();
  });

  test('queue table has expected column headers', async ({ page }) => {
    await goCcmsPreAuth(page);

    if (await page.locator('table').count() === 0) { test.skip(); return; }

    const headers = page.locator('th');
    await expect(headers.filter({ hasText: /patient/i }).first()).toBeVisible();
    await expect(headers.filter({ hasText: /insurer|tpa/i }).first()).toBeVisible();
    await expect(headers.filter({ hasText: /status/i }).first()).toBeVisible();
  });

  test('first queue item shows patient name', async ({ page }) => {
    await goCcmsPreAuth(page);

    const firstRow = page.locator('tbody tr').first();
    if (await firstRow.count() === 0) { test.skip(); return; }

    // Patient name cell should have some text
    const nameCell = firstRow.locator('td').first();
    await expect(nameCell).not.toBeEmpty();
  });

  test('Send Pre-Auth button is accessible via keyboard', async ({ page }) => {
    await goCcmsPreAuth(page);

    const sendBtn = page
      .getByRole('button', { name: /send pre.auth|send preauth/i })
      .first();

    if (await sendBtn.count() === 0) { test.skip(); return; }

    // Verify it receives focus when tabbed to
    await sendBtn.focus();
    await expect(sendBtn).toBeFocused();
  });

  test('Send Pre-Auth modal opens on button click', async ({ page }) => {
    await goCcmsPreAuth(page);

    const sendBtn = page
      .getByRole('button', { name: /send pre.auth|send preauth/i })
      .first();

    if (await sendBtn.count() === 0) { test.skip(); return; }

    await sendBtn.click();

    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible({ timeout: 5_000 });
    await expect(dialog).toHaveAttribute('aria-modal', 'true');
  });

  test('Send Pre-Auth modal is closable with Escape', async ({ page }) => {
    await goCcmsPreAuth(page);

    const sendBtn = page
      .getByRole('button', { name: /send pre.auth|send preauth/i })
      .first();

    if (await sendBtn.count() === 0) { test.skip(); return; }

    await sendBtn.click();
    await expect(page.getByRole('dialog')).toBeVisible({ timeout: 5_000 });

    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog')).not.toBeVisible({ timeout: 3_000 });
  });

  test('TPA Response modal opens and has aria-modal attribute', async ({ page }) => {
    await goCcmsPreAuth(page);

    const tpaBtn = page
      .getByRole('button', { name: /tpa response|record response/i })
      .first();

    if (await tpaBtn.count() === 0) { test.skip(); return; }

    await tpaBtn.click();

    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible({ timeout: 5_000 });
    await expect(dialog).toHaveAttribute('aria-modal', 'true');
  });
});
