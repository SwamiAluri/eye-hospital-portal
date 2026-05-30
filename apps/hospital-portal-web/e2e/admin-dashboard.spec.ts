import { test, expect } from '@playwright/test';

test.describe('Admin Command Center', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/dashboard/admin/overview');
    await expect(page.getByRole('heading', { name: /hospital command center/i })).toBeVisible({
      timeout: 20_000,
    });
  });

  test('renders KPI strip without object Object or undefined', async ({ page }) => {
    const body = await page.locator('main, [class*="flex-col"]').first().textContent();
    expect(body).not.toContain('[object Object]');
    expect(body).not.toMatch(/undefined%/);
  });

  test('shows primary sections', async ({ page }) => {
    await expect(page.getByText(/recent activity/i)).toBeVisible();
    await expect(page.getByText(/system alerts/i)).toBeVisible();
    await expect(page.getByText(/module snapshots/i)).toBeVisible();
    await expect(page.getByText(/quick actions/i)).toBeVisible();
  });

  test('refresh button reloads dashboard', async ({ page }) => {
    await page.getByRole('button', { name: /refresh/i }).click();
    await expect(page.getByRole('heading', { name: /hospital command center/i })).toBeVisible();
  });

  test('KPI tiles link to admin destinations', async ({ page }) => {
    const usersLink = page.locator('a[href="/dashboard/admin/users"]').first();
    await expect(usersLink).toBeVisible();
  });

  test('admin index redirects to overview', async ({ page }) => {
    await page.goto('/dashboard/admin');
    await expect(page).toHaveURL(/\/dashboard\/admin\/overview/);
  });
});
