/**

 * E2E: IP checklist closure flow (S6–S8) + ward pre-op workspace integration.

 *

 * Prerequisites: migrations 134–142, Nurse / Counsellor test users, ward journeys.

 *

 * Set E2E_WARD_FULL_FLOWS=1 and seed Expected → Admitted → ReadyForSurgery journeys

 * (npm run resolve:e2e:ward).

 */

import { test, expect } from '@playwright/test';

import { loginAsRole, apiLogin } from './helpers/auth';

import {

  apiSaveInvestigationResult,

  apiVerifyInvestigation,

  enterInvestigationValue,

  ensureInvestigationVerified,

  fetchWardInvestigationChecklist,

  fetchWardJourneys,

  findInvestigationItem,

  findJourneyByState,

  gotoWardPage,

  navigateChecklistSection,

  openWorkspaceForJourney,

  resolveWardFixtures,

} from './helpers/ward-preop';

import { WARD_PREOP_TEST_IDS } from '../src/lib/ip-management/ward-preop-test-ids';



const FULL_FLOWS = process.env.E2E_WARD_FULL_FLOWS === '1';



test.describe('IP checklist closure @ip-checklist', () => {

  test.describe.configure({ timeout: 120_000 });



  test('ward workspace smoke when Expected journey exists', async ({ page, request }) => {

    await loginAsRole(page, 'nurse');

    const login = await apiLogin(request);

    const expected = findJourneyByState(await fetchWardJourneys(request, login), 'Expected');

    test.skip(!expected, 'No Expected journey — run counselling finalize OT or resolve:e2e:ward');



    await gotoWardPage(page);

    await openWorkspaceForJourney(page, expected.id);

    await expect(page.getByTestId(WARD_PREOP_TEST_IDS.sectionInvestigations)).toBeVisible();

  });



  test.describe('Full closure path', () => {

    test.skip(!FULL_FLOWS, 'Set E2E_WARD_FULL_FLOWS=1 with seeded journeys');



    test('Expected investigations → verify → ward + OT access', async ({ page, request }) => {

      const login = await apiLogin(request);

      const fixtures = await resolveWardFixtures(request, login);

      test.skip(!fixtures.expected, 'No Expected journey');



      await ensureInvestigationVerified(request, login, fixtures.expected!.id, 'blood_sugar', '97');



      await loginAsRole(page, 'nurse');

      await gotoWardPage(page);

      await openWorkspaceForJourney(page, fixtures.expected!.id);

      await navigateChecklistSection(page, 'investigations');

      await expect(
        page.getByTestId(WARD_PREOP_TEST_IDS.investigationRow('blood_sugar')).getByText('Verified', {
          exact: true,
        }).first(),
      ).toBeVisible({ timeout: 15_000 });



      await loginAsRole(page, 'ot_nurse');

      await page.goto('/dashboard/ip-management/operation-theatre');

      await expect(page).not.toHaveURL(/unauthorized/);

    });



    test('API verify path matches ward investigation checklist', async ({ request }) => {

      const login = await apiLogin(request);

      const fixtures = await resolveWardFixtures(request, login);

      test.skip(!fixtures.expected, 'No Expected journey');



      const checklist = await fetchWardInvestigationChecklist(request, login, fixtures.expected!.id);

      const bloodSugar = findInvestigationItem(checklist, 'blood_sugar');

      test.skip(!bloodSugar, 'blood_sugar not in catalog');



      await apiSaveInvestigationResult(
        request,
        login,
        fixtures.expected!.id,
        bloodSugar.itemId,
        '96',
        'mg/dL',
      );

      const saved = await apiVerifyInvestigation(

        request,

        login,

        fixtures.expected!.id,

        bloodSugar.itemId,

      );

      expect(saved).toBeTruthy();



      const after = await fetchWardInvestigationChecklist(request, login, fixtures.expected!.id);

      const verified = findInvestigationItem(after, 'blood_sugar');

      expect(verified?.entryStatus).toBe('verified');

    });

  });

});


