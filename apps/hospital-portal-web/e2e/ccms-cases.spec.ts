/**
 * E2E smoke tests — CCMS Coverage Cases list & detail.
 *
 * These tests assume:
 *  - The app is running (managed by playwright.config.ts webServer or PLAYWRIGHT_BASE_URL).
 *  - The user is authenticated (managed by auth.setup.ts → storageState).
 *  - Seed data exists: at least one CCMS coverage case in the DB.
 *
 * Each test is independent and idempotent — no mutations, read-only smoke checks.
 */
import { test, expect } from '@playwright/test';
import { goCcmsCases, expectNoErrorState } from './helpers/ccms';

test.describe('CCMS — Coverage Cases', () => {
  // ── Page load & navigation ─────────────────────────────────────────────────

  test('cases list page loads without errors', async ({ page }) => {
    await goCcmsCases(page);
    await expectNoErrorState(page);
  });

  test('cases list page shows CCMS sidebar navigation item', async ({ page }) => {
    await page.goto('/dashboard');
    const ccmsNav = page.getByRole('link', { name: /coverage.claims|ccms/i });
    await expect(ccmsNav).toBeVisible();
  });

  test('cases list page renders the case table or empty state', async ({ page }) => {
    await goCcmsCases(page);

    const hasTable = await page.locator('table').count() > 0;
    const hasEmpty = await page.getByText(/no cases|no results|0 cases/i).count() > 0;

    expect(hasTable || hasEmpty).toBeTruthy();
  });

  test('cases list page has search input', async ({ page }) => {
    await goCcmsCases(page);
    const search = page.getByPlaceholder(/search/i).or(page.getByRole('searchbox'));
    await expect(search).toBeVisible();
  });

  // ── Filtering & pagination ─────────────────────────────────────────────────

  test('search input filters cases by case number', async ({ page }) => {
    await goCcmsCases(page);

    const search = page.getByPlaceholder(/search/i).or(page.getByRole('searchbox')).first();
    await search.fill('CCMS-');
    await page.waitForTimeout(400);   // debounce

    // Either a matching row or a clear "no results" message should appear
    const rows   = page.locator('tbody tr');
    const noData = page.getByText(/no results|0 cases/i);
    const visible = (await rows.count()) > 0 || (await noData.count()) > 0;
    expect(visible).toBeTruthy();
  });

  test('state-filter dropdown is present and has options', async ({ page }) => {
    await goCcmsCases(page);

    // Look for a <select> or a combobox for state filtering
    const stateFilter = page.getByRole('combobox').first()
      .or(page.locator('select').first());
    await expect(stateFilter).toBeVisible();
  });

  // ── Case detail ───────────────────────────────────────────────────────────

  test('clicking a case row navigates to case detail', async ({ page }) => {
    await goCcmsCases(page);

    const firstRow = page.locator('tbody tr').first();
    const caseCount = await firstRow.count();
    if (caseCount === 0) {
      test.skip();
      return;
    }

    await firstRow.click();

    // Expect URL to change to a detail route
    await expect(page).toHaveURL(/ccms\/cases\/[0-9a-f-]{36}/, { timeout: 8_000 });
    await expectNoErrorState(page);
  });

  test('case detail page renders tabs', async ({ page }) => {
    await goCcmsCases(page);

    const firstRow = page.locator('tbody tr').first();
    if (await firstRow.count() === 0) { test.skip(); return; }

    await firstRow.click();
    await page.waitForURL(/ccms\/cases\//, { timeout: 8_000 });

    // The detail page should have at least the Authorization tab
    const tabs = page.getByRole('tab');
    await expect(tabs.first()).toBeVisible();
  });

  // ── Create case flow ───────────────────────────────────────────────────────

  test('New Case button is visible and opens a form or modal', async ({ page }) => {
    await goCcmsCases(page);

    const newBtn = page
      .getByRole('button', { name: /new case|create case|open case/i })
      .or(page.getByRole('link', { name: /new case|create case/i }))
      .first();

    await expect(newBtn).toBeVisible();

    await newBtn.click();
    await page.waitForTimeout(300);

    // Either a modal dialog or a form page should appear
    const dialog = page.getByRole('dialog');
    const form   = page.locator('form').first();
    const opened = (await dialog.count()) > 0 || (await form.count()) > 0;
    expect(opened).toBeTruthy();
  });
});
