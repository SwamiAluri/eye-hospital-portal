/**
 * E2E: WF-10.7 — counselling rebook clears pendingRebook
 *
 * Uses internal apply-rebook sync (same path as OT reschedule).
 * Requires E2E_INTERNAL_API_KEY matching ip-management AuthService:InternalApiKey.
 */
import { test, expect } from '@playwright/test';
import { loginAsRole, apiLogin } from './helpers/auth';
import { WARD_PREOP_TEST_IDS } from '../src/lib/ip-management/ward-preop-test-ids';
import { gotoWardPage, resolveWardFixtures } from './helpers/ward-preop';
import {
  apiApplyCounsellingRebook,
  apiCancelTodaySurgery,
  apiFetchJourneyDetail,
  apiRebookCancelledSurgery,
} from './helpers/ward-journey-api';

const FULL_FLOWS = process.env.E2E_WARD_FULL_FLOWS === '1';
const HAS_INTERNAL_KEY = Boolean(
  process.env.E2E_INTERNAL_API_KEY ?? process.env.AuthService__InternalApiKey,
);

test.describe('Counselling rebook clears pendingRebook @ip-ward-rebook', () => {
  test('WF-10.7: apply-rebook clears pendingRebook flag and returns row to Expected', async ({
    page,
    request,
  }) => {
    test.skip(!FULL_FLOWS, 'Set E2E_WARD_FULL_FLOWS=1');
    test.skip(!HAS_INTERNAL_KEY, 'Set E2E_INTERNAL_API_KEY for internal journey-sync');

    const login = await apiLogin(request);
    const fixtures = await resolveWardFixtures(request, login);
    const targetId = process.env.E2E_WARD_REBOOK_JOURNEY_ID ?? fixtures.admitted?.id ?? fixtures.ready?.id;
    test.skip(!targetId, 'No journey for rebook test');

    const before = await apiFetchJourneyDetail(request, login, targetId);
    test.skip(!before, 'Journey not found');

    if (before.clinicalState !== 'Expected' || !before.pendingRebook) {
      const cancelled = await apiCancelTodaySurgery(
        request,
        login,
        targetId,
        'E2E setup for rebook test',
      );
      test.skip(!cancelled?.pendingRebook, 'Could not set pendingRebook via cancel');
    }

    const withRebook = await apiFetchJourneyDetail(request, login, targetId);
    test.skip(!withRebook?.pendingRebook, 'Journey missing pendingRebook after setup');
    test.skip(!withRebook?.otFinalizeScheduleId, 'Journey has no otFinalizeScheduleId for rebook sync');

    const newDate = new Date();
    newDate.setDate(newDate.getDate() + 14);
    const surgeryScheduledAt = newDate.toISOString();

    const rebooked = await apiApplyCounsellingRebook(
      request,
      withRebook.otFinalizeScheduleId!,
      surgeryScheduledAt,
    );
    expect(rebooked?.pendingRebook).toBe(false);

    const after = await apiFetchJourneyDetail(request, login, targetId);
    expect(after?.pendingRebook).toBe(false);

    await loginAsRole(page, 'nurse');
    await gotoWardPage(page);
    await page.getByTestId(WARD_PREOP_TEST_IDS.wardStatusTab('Expected')).click();
    const row = page.getByTestId(WARD_PREOP_TEST_IDS.wardJourneyRow(targetId));
    await expect(row).toBeVisible({ timeout: 15_000 });
    await expect(row).toHaveAttribute('data-clinical-state', 'Expected');
  });

  test('Phase 1: explicit ward rebook moves CancelledSurgery → Expected', async ({ request }) => {
    test.skip(!FULL_FLOWS, 'Set E2E_WARD_FULL_FLOWS=1');

    const login = await apiLogin(request);
    const fixtures = await resolveWardFixtures(request, login);
    const targetId = fixtures.admitted?.id ?? fixtures.ready?.id;
    test.skip(!targetId, 'No journey for ward-rebook test');

    const before = await apiFetchJourneyDetail(request, login, targetId);
    test.skip(
      !before || !['Admitted', 'ReadyForSurgery'].includes(before.clinicalState),
      'Journey not in a cancellable state',
    );

    const cancelled = await apiCancelTodaySurgery(request, login, targetId, 'E2E ward-rebook setup');
    expect(cancelled?.clinicalState).toBe('CancelledSurgery');
    expect(cancelled?.pendingRebook).toBe(true);

    const rebooked = await apiRebookCancelledSurgery(request, login, targetId);
    expect(rebooked?.clinicalState).toBe('Expected');
    expect(rebooked?.pendingRebook).toBe(false);
  });
});
