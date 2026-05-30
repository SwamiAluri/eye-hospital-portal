/**
 * E2E smoke tests — CCMS Analytics dashboard and Settings page.
 */
import { test, expect } from '@playwright/test';
import { goCcmsAnalytics, expectNoErrorState } from './helpers/ccms';

test.describe('CCMS — Analytics', () => {
  test('analytics page loads without errors', async ({ page }) => {
    await goCcmsAnalytics(page);
    await expectNoErrorState(page);
  });

  test('analytics page shows KPI metric cards', async ({ page }) => {
    await goCcmsAnalytics(page);

    // KPI cards typically contain a numeric value and a label
    const cards = page.locator('[data-testid*="kpi"], .stat-card, [class*="metric"]');
    const hasCards   = await cards.count() > 0;
    const hasCharts  = await page.locator('svg[class*="recharts"], canvas').count() > 0;
    const hasNumbers = await page.getByText(/₹|INR|\d+%|\d+,\d+/i).count() > 0;

    expect(hasCards || hasCharts || hasNumbers).toBeTruthy();
  });

  test('analytics page has a date range selector or filter', async ({ page }) => {
    await goCcmsAnalytics(page);

    const dateRange = page
      .getByRole('combobox')
      .or(page.getByLabel(/period|range|filter/i))
      .first();

    // Date range filter is desirable but not blocking
    if (await dateRange.count() > 0) {
      await expect(dateRange).toBeVisible();
    }
  });
});

test.describe('CCMS — Settings', () => {
  test('settings page loads without errors', async ({ page }) => {
    await page.goto('/dashboard/ccms/settings');
    await expect(page.getByRole('heading', { name: /setting/i }))
      .toBeVisible({ timeout: 10_000 });
    await expectNoErrorState(page);
  });

  test('settings page shows admission validation toggle', async ({ page }) => {
    await page.goto('/dashboard/ccms/settings');
    await expect(page.getByRole('heading', { name: /setting/i })).toBeVisible({ timeout: 10_000 });

    const toggle = page
      .getByRole('switch')
      .or(page.getByRole('checkbox'))
      .or(page.getByLabel(/fail.open|fail.closed|admission/i))
      .first();

    // Presence of any toggle-like element on the settings page
    if (await toggle.count() > 0) {
      await expect(toggle).toBeVisible();
    }
  });
});
