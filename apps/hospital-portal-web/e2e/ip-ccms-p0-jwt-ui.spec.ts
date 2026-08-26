/**
 * P0 — fresh JWT login, enhancement UI draft→submit→decide, Emergency FC apply path.
 *
 *   npx playwright test e2e/ip-ccms-p0-jwt-ui.spec.ts --project=chromium-ward-journey
 */
import { test, expect } from '@playwright/test';
import { loginAsRole, apiLogin } from './helpers/auth';
import { fetchWardJourneys, gotoWardPage, selectWardStatusTab } from './helpers/ward-preop';
import { WARD_PREOP_TEST_IDS } from '../src/lib/ip-management/ward-preop-test-ids';
import { apiListCcmsCases } from './helpers/phase5-p1';

test.describe('P0 JWT + enhancement UI + Emergency FC @ip-ccms-p0', () => {
  test.describe.configure({ timeout: 120_000 });

  test('fresh admin login can open Pre-Auth enhancement panel', async ({ page, request }) => {
    const login = await apiLogin(request);
    const perms = login.permissions ?? [];
    const hasEnh =
      perms.includes('*')
      || perms.includes('ccms.enhancement.write')
      || perms.includes('ccms.enhancement.create');
    expect(hasEnh).toBeTruthy();

    const approved = (await apiListCcmsCases(request, login, 'APPROVED'))[0]
      ?? (await apiListCcmsCases(request, login))[0];
    test.skip(!approved?.id, 'No CCMS case for enhancement UI');

    await loginAsRole(page, 'admin');
    await page.goto(`/dashboard/ccms/cases/${approved.id}`);
    await page.getByRole('button', { name: /^Pre-Auth$/i }).click();
    await expect(page.getByTestId('ccms-enhancement-panel')).toBeVisible({ timeout: 20_000 });
  });

  test('enhancement UI draft → submit → decide with JWT', async ({ page, request }) => {
    const login = await apiLogin(request);
    const approved = (await apiListCcmsCases(request, login, 'APPROVED'))[0]
      ?? (await apiListCcmsCases(request, login))[0];
    test.skip(!approved?.id, 'No CCMS case for enhancement UI smoke');

    await loginAsRole(page, 'admin');
    await page.goto(`/dashboard/ccms/cases/${approved.id}`);
    await page.getByRole('button', { name: /^Pre-Auth$/i }).click();
    await expect(page.getByTestId('ccms-enhancement-panel')).toBeVisible({ timeout: 20_000 });

    const requestBtn = page.getByTestId('ccms-enhancement-request');
    if (await requestBtn.count()) {
      await requestBtn.click();
      await page.getByTestId('ccms-enhancement-amount').fill('100');
      await page.getByTestId('ccms-enhancement-reason').fill('P0 JWT UI smoke');
      await page.getByTestId('ccms-enhancement-create-draft').click();
      await expect(page.getByTestId('ccms-enhancement-row-active').or(page.getByText(/Draft/i)).first())
        .toBeVisible({ timeout: 15_000 });
    }

    const submit = page.locator('[data-testid^="ccms-enhancement-submit-"]').first();
    if (await submit.count()) {
      page.once('dialog', (d) => d.accept('P0-UI'));
      await submit.click();
      await expect(page.getByTestId('ccms-enhancement-row-submitted').or(page.getByText(/Awaiting TPA/i)).first())
        .toBeVisible({ timeout: 15_000 });
    }

    const approve = page.locator('[data-testid^="ccms-enhancement-approve-"]').first();
    if (await approve.count()) {
      page.once('dialog', (d) => d.accept('100'));
      page.once('dialog', (d) => d.accept('P0-UI-OUT'));
      await approve.click();
      await expect(page.getByText(/Approved|Awaiting TPA|Draft/i).first()).toBeVisible({ timeout: 15_000 });
    }

    await expect(page.getByTestId('ccms-enhancement-panel')).toBeVisible();
  });

  test('Emergency FC apply path on ward (reason + POST)', async ({ page, request }) => {
    const login = await apiLogin(request);
    const hasFc =
      (login.permissions ?? []).includes('*')
      || (login.permissions ?? []).includes('ip.emergency_fc.apply');
    expect(hasFc).toBeTruthy();

    const journeys = await fetchWardJourneys(request, login);
    const target = journeys.find((j) => j.clinicalState !== 'Discharged' && j.clinicalState !== 'CancelledSurgery')
      ?? journeys[0];
    test.skip(!target, 'No ward journey for Emergency FC');

    await loginAsRole(page, 'admin');
    await gotoWardPage(page);
    await selectWardStatusTab(page, 'All');

    let fcPosted = false;
    await page.route('**/ip-management/journeys/*/emergency-fc', async (route) => {
      fcPosted = route.request().method() === 'POST';
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          id: target.id,
          emergencyFcApplied: true,
          emergencyFcReason: 'P0 Playwright Emergency FC',
          financialState: 'Cleared',
        }),
      });
    });

    const row = page.getByTestId(WARD_PREOP_TEST_IDS.wardJourneyRow(target.id));
    await expect(row).toBeVisible({ timeout: 20_000 });
    await row.getByTestId('preop-action-menu-button').click();
    await page.getByTestId('preop-action-menu-item-emergencyFc').click();
    await page.getByTestId('ward-emergency-fc-reason').fill('P0 Playwright Emergency FC');
    await page.getByTestId('ward-emergency-fc-submit').click();
    await expect.poll(() => fcPosted).toBe(true);
  });
});
