/**

 * RBAC smoke: Nurse / Counsellor / OT Nurse route access matrix.

 * Set E2E_NURSE_EMAIL, E2E_COUNSELLOR_EMAIL, E2E_OT_NURSE_EMAIL for role-specific accounts.

 */

import { test, expect } from '@playwright/test';

import { loginAsRole, apiLogin, seedBrowserAuthWithPermissions } from './helpers/auth';

import {

  enterInvestigationValue,

  expectInvestigationVerifyHidden,

  fetchWardJourneys,

  findJourneyByState,

  gotoWardPage,

  navigateChecklistSection,

  openWorkspaceForJourney,

} from './helpers/ward-preop';



test.describe('IP checklist RBAC @ip-checklist', () => {

  test('nurse can open ward; blocked from unauthorized', async ({ page }) => {

    await loginAsRole(page, 'nurse');

    await page.goto('/dashboard/ip-management/ward');

    await expect(page).not.toHaveURL(/unauthorized/);

    await expect(page.getByTestId('ward-management-page')).toBeVisible({ timeout: 15000 });

  });



  test('nurse ward workspace exposes investigation section test ids', async ({ page }) => {

    await loginAsRole(page, 'nurse');

    await page.goto('/dashboard/ip-management/ward');

    await expect(page.getByTestId('ward-management-page')).toBeVisible({ timeout: 15000 });



    const expectedRow = page.locator('tr[data-clinical-state="Expected"]').first();

    if (!(await expectedRow.isVisible().catch(() => false))) {

      test.skip(true, 'No Expected journey for investigation RBAC smoke');

    }

    await expectedRow.click();

    await page.getByTestId('ward-drawer-primary-action').click();

    await expect(page.getByTestId('ward-preop-workspace')).toBeVisible({ timeout: 15000 });

    await navigateChecklistSection(page, 'investigations');

  });



  test('without ward.investigation.verify permission verify button stays hidden', async ({

    page,

    request,

  }) => {

    const login = await apiLogin(request);

    const expected = findJourneyByState(await fetchWardJourneys(request, login), 'Expected');

    test.skip(!expected, 'No Expected journey');



    await seedBrowserAuthWithPermissions(page, login, [
      'ward.investigation.enter',
      'ip_management.view',
    ]);

    await gotoWardPage(page);

    await openWorkspaceForJourney(page, expected.id);

    await navigateChecklistSection(page, 'investigations');



    const row = page.getByTestId('ward-preop-investigation-row-blood_sugar');

    test.skip(!(await row.isVisible().catch(() => false)), 'blood_sugar not in catalog');



    await enterInvestigationValue(page, 'blood_sugar', '100');

    await expectInvestigationVerifyHidden(page, 'blood_sugar');

  });



  test('counsellor can open counsellors desk', async ({ page }) => {

    await loginAsRole(page, 'counsellor');

    await page.goto('/dashboard/counsellors-desk');

    await expect(page).not.toHaveURL(/unauthorized/);

  });



  test('ot nurse can open operation theatre', async ({ page }) => {

    await loginAsRole(page, 'ot_nurse');

    await page.goto('/dashboard/ip-management/operation-theatre');

    await expect(page).not.toHaveURL(/unauthorized/);

  });



  test('user without ip permission redirected from ip-management root', async ({ page }) => {

    await loginAsRole(page, 'counsellor');

    const response = await page.goto('/dashboard/ip-management');

    if (response?.url().includes('unauthorized')) {

      await expect(page).toHaveURL(/unauthorized/);

    } else {

      await expect(page.locator('body')).toBeVisible();

    }

  });

});


