/**
 * F0.4 + B9 — Master Data admin shows integration "Used by" badges.
 */
import { test, expect } from '@playwright/test';

test.describe('Master Data — integration badges', () => {
  test('appointments group shows wired Used by badge', async ({ page }) => {
    await page.goto('/dashboard/master-data/appointments');
    await expect(page.getByText(/appointment\.type/i).first()).toBeVisible({ timeout: 20_000 });
    await expect(page.getByText(/Used by/i).first()).toBeVisible();
    await expect(page.getByText(/wired/i).first()).toBeVisible();
  });
});
