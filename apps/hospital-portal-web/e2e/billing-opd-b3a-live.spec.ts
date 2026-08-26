/**
 * B3A live smoke — authenticated /dashboard/billing/opd against the running UAT stack.
 * Read-only: does not POST payment, discount, billitems, finalize, or refund.
 *
 *   npx playwright test e2e/billing-opd-b3a-live.spec.ts --project=chromium
 */
import { test, expect } from '@playwright/test';
import { loginAsRole } from './helpers/auth';
import { WORKSTATION_TEST_IDS } from '../src/lib/billing/workstation-model';

test.describe('B3A live billing workstation', () => {
  test.describe.configure({ timeout: 90_000 });

  test('authenticated clerk opens /dashboard/billing/opd without mutating the ledger', async ({
    page,
  }) => {
    const mutations: string[] = [];
    const opdGets: string[] = [];

    await page.setViewportSize({ width: 1400, height: 900 });
    await loginAsRole(page, 'admin');

    page.on('request', (req) => {
      const method = req.method();
      const url = req.url();
      if (method === 'GET' && /\/opdbills/i.test(url)) {
        opdGets.push(url);
      }
      if (method === 'GET' || method === 'HEAD' || method === 'OPTIONS') return;
      if (/opdbills|billitems|ip-management|ccms|chargereconciliation/i.test(url)) {
        mutations.push(`${method} ${url}`);
      }
    });

    const response = await page.goto('/dashboard/billing/opd', { waitUntil: 'domcontentloaded' });
    expect(response?.ok() ?? false).toBeTruthy();

    await expect(page.getByRole('heading', { name: 'IP Billing' })).toBeVisible({ timeout: 20_000 });
    await expect(page.getByTestId(WORKSTATION_TEST_IDS.search)).toBeVisible();
    await expect(page.locator('nav[aria-label="Main navigation"]')).toBeVisible();
    await expect(page.getByTestId(WORKSTATION_TEST_IDS.root)).toHaveCount(0);
    await expect(page.getByTestId(WORKSTATION_TEST_IDS.empty)).toBeVisible();

    const search = page.getByTestId(WORKSTATION_TEST_IDS.search).locator('input');
    await search.fill('Meena');
    await expect(page.getByTestId(WORKSTATION_TEST_IDS.root)).toHaveCount(0);
    await expect(page.getByTestId(WORKSTATION_TEST_IDS.empty)).toBeVisible();

    expect(
      mutations.filter((m) => /payment|refund|credit|discount|billitems|finalize|lock/i.test(m)),
    ).toEqual([]);
    expect(opdGets.some((u) => /\/opdbills/i.test(u))).toBeTruthy();
  });
});
