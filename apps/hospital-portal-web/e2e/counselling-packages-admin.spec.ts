/**
 * Counselling package templates admin (Master Data → Counsellor packages).
 */
import { test, expect } from '@playwright/test';

test.describe('Counselling packages admin @counselling', () => {
  test.describe.configure({ timeout: 90_000 });

  test('packages page loads with builder actions', async ({ page }) => {
    await page.goto('/dashboard/master-data/counsellor/packages', { waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('heading', { name: /Counselling packages/i })).toBeVisible({
      timeout: 20_000,
    });
    await expect(page.getByRole('button', { name: 'New package' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Settings' })).toBeVisible();
  });
});
