/**
 * E2E: Cancel today's surgery — full WF-10 flow
 *
 * Requires live API + seeded journeys:
 *   E2E_WARD_FULL_FLOWS=1 && npm run resolve:e2e:ward
 */
import { test, expect } from '@playwright/test';
import { loginAsRole, apiLogin } from './helpers/auth';
import { WARD_PREOP_TEST_IDS } from '../src/lib/ip-management/ward-preop-test-ids';
import {
  closeWorkspace,
  gotoWardPage,
  openWorkspaceForJourney,
  resolveWardFixtures,
  selectWardStatusTab,
} from './helpers/ward-preop';
import {
  apiCancelTodaySurgery,
  apiFetchJourneyDetail,
} from './helpers/ward-journey-api';

const FULL_FLOWS = process.env.E2E_WARD_FULL_FLOWS === '1';

test.describe('Cancel today surgery @ip-ward-cancel', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsRole(page, 'nurse');
    await gotoWardPage(page);
  });

  test('Expected workspace exposes cancel-today action', async ({ page }) => {
    await selectWardStatusTab(page, 'Expected');
    const row = page.locator('[data-clinical-state="Expected"]').first();
    test.skip(await row.count() === 0, 'No Expected journey in branch');
    await row.click();
    await page.getByTestId(WARD_PREOP_TEST_IDS.drawerPrimaryAction).click();
    await expect(page.getByTestId(WARD_PREOP_TEST_IDS.workspace)).toBeVisible();

    await expect(page.getByTestId(WARD_PREOP_TEST_IDS.cancelTodayBtn)).toBeVisible();
    await page.getByTestId(WARD_PREOP_TEST_IDS.cancelTodayBtn).click();
    await expect(page.getByTestId(WARD_PREOP_TEST_IDS.cancelTodayModal)).toBeVisible();
    await page.getByTestId(WARD_PREOP_TEST_IDS.cancelTodayModal).getByRole('button', { name: 'Close' }).click();
    await expect(page.getByTestId(WARD_PREOP_TEST_IDS.cancelTodayModal)).toBeHidden();
    await closeWorkspace(page);
  });

  test('ward list has no inline send-to-OT shortcut (G7 / 2.9)', async ({ page }) => {
    await page.getByTestId(WARD_PREOP_TEST_IDS.wardStatusTab('ReadyForSurgery')).click();
    const row = page.locator('[data-clinical-state="ReadyForSurgery"]').first();
    test.skip(await row.count() === 0, 'No ReadyForSurgery journey');
    await expect(row.getByText('→OT')).toHaveCount(0);
  });

  test('WF-10: cancel admitted journey parks in CancelledSurgery with pending rebook', async ({
    page,
    request,
  }) => {
    test.skip(!FULL_FLOWS, 'Set E2E_WARD_FULL_FLOWS=1 with seeded journeys (npm run resolve:e2e:ward)');

    const login = await apiLogin(request);
    const fixtures = await resolveWardFixtures(request, login);
    const admitted = fixtures.admitted;
    test.skip(!admitted, 'No Admitted journey for cancel flow');

    const before = await apiFetchJourneyDetail(request, login, admitted.id);
    test.skip(before?.clinicalState !== 'Admitted', 'Fixture journey is no longer Admitted');

    await openWorkspaceForJourney(page, admitted.id);
    await page.getByTestId(WARD_PREOP_TEST_IDS.cancelTodayBtn).click();
    await expect(page.getByTestId(WARD_PREOP_TEST_IDS.cancelTodayModal)).toBeVisible();

    await page.getByTestId(WARD_PREOP_TEST_IDS.cancelTodayModal).locator('textarea').fill('E2E cancel today — patient unwell');
    await page.getByTestId(WARD_PREOP_TEST_IDS.cancelTodaySubmit).click();
    await expect(page.getByTestId(WARD_PREOP_TEST_IDS.cancelTodayModal)).toBeHidden({ timeout: 30_000 });
    await closeWorkspace(page);

    // Phase 1: cancel parks the journey in the CancelledSurgery off-ramp (was: revert to Expected).
    // The dedicated "Cancelled" ward lane + rebook badge UI assertion lands with Phase 3.
    const after = await apiFetchJourneyDetail(request, login, admitted.id);
    expect(after?.clinicalState).toBe('CancelledSurgery');
    expect(after?.pendingRebook).toBe(true);
    expect(after?.cancelledFromState).toBe('Admitted');
  });

  test('WF-10 API: cancel today sets annotations on ReadyForSurgery journey', async ({ request }) => {
    test.skip(!FULL_FLOWS, 'Set E2E_WARD_FULL_FLOWS=1');

    const login = await apiLogin(request);
    const fixtures = await resolveWardFixtures(request, login);
    const readyId = process.env.E2E_WARD_CANCEL_API_JOURNEY_ID ?? fixtures.ready?.id;
    test.skip(!readyId, 'No ReadyForSurgery journey for API cancel');

    const before = await apiFetchJourneyDetail(request, login, readyId);
    test.skip(
      !before || !['ReadyForSurgery', 'Admitted'].includes(before.clinicalState),
      'Cancel API journey not in cancellable state',
    );

    const result = await apiCancelTodaySurgery(
      request,
      login,
      readyId,
      'E2E API cancel today',
    );
    expect(result?.clinicalState).toBe('CancelledSurgery');
    expect(result?.pendingRebook).toBe(true);
    expect(result?.surgeryCancelledAt).toBeTruthy();
  });
});
