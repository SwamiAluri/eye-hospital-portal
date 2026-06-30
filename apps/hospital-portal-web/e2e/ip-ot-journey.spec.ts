/**
 * E2E: OT journey WF-04–06 — accept, start, end, move to PostOp
 *
 * Requires:
 *   E2E_WARD_FULL_FLOWS=1
 *   npm run resolve:e2e:ward
 *   ReadyForSurgery journey (promoted to SentToOT in-test)
 */
import { test, expect } from '@playwright/test';
import { loginAsRole, apiLogin } from './helpers/auth';
import { OT_TEST_IDS } from '../src/lib/ip-management/ot-test-ids';
import { resolveWardFixtures } from './helpers/ward-preop';
import {
  apiFetchJourneyDetail,
  apiPrepareJourneyForOtFlow,
  apiTransitionClinical,
} from './helpers/ward-journey-api';
import {
  clickOtAccept,
  clickOtEndSurgery,
  clickOtMoveToPostOp,
  clickOtStartSurgery,
  gotoOtPage,
  otJourneyRow,
  selectOtTab,
} from './helpers/ot-journey';

const FULL_FLOWS = process.env.E2E_WARD_FULL_FLOWS === '1';

test.describe('OT journey workflow @ip-ot-journey', () => {
  test('WF-04–06: accept → start → end → move to PostOp', async ({ page, request }) => {
    test.skip(!FULL_FLOWS, 'Set E2E_WARD_FULL_FLOWS=1 with seeded journeys');

    const login = await apiLogin(request);
    const fixtures = await resolveWardFixtures(request, login);
    const ready = fixtures.ready;
    test.skip(!ready, 'No ReadyForSurgery journey for OT flow');

    const prepared = await apiPrepareJourneyForOtFlow(request, login, ready);
    test.skip(!prepared || prepared.clinicalState !== 'SentToOT', 'Could not prepare SentToOT journey');

    await loginAsRole(page, 'ot_nurse');
    await gotoOtPage(page);
    await selectOtTab(page, 'SentToOT');

    const row = otJourneyRow(page, ready.id);
    await expect(row).toBeVisible({ timeout: 15_000 });

    await clickOtAccept(page, ready.id);
    await expect
      .poll(async () => {
        const d = await apiFetchJourneyDetail(request, login, ready.id);
        return d?.otState ?? '';
      }, { timeout: 30_000 })
      .toBe('Accepted');

    await selectOtTab(page, 'OTAccepted');
    await expect(page.getByTestId(OT_TEST_IDS.startSurgeryBtn(ready.id))).toBeVisible({
      timeout: 15_000,
    });

    await clickOtStartSurgery(page, ready.id);
    let detail = await apiFetchJourneyDetail(request, login, ready.id);
    expect(detail?.clinicalState).toBe('InOT');

    await selectOtTab(page, 'InOT');
    await clickOtEndSurgery(page, ready.id);
    detail = await apiFetchJourneyDetail(request, login, ready.id);
    expect(detail?.clinicalState).toBe('SurgeryCompleted');

    await selectOtTab(page, 'SurgeryCompleted');
    await clickOtMoveToPostOp(page, ready.id);
    await expect
      .poll(async () => {
        const d = await apiFetchJourneyDetail(request, login, ready.id);
        return d?.clinicalState ?? '';
      }, { timeout: 30_000 })
      .toBe('PostOp');
  });

  test('WF-04 smoke: OT page loads with SentToOT filter', async ({ page }) => {
    await loginAsRole(page, 'ot_nurse');
    await gotoOtPage(page);
    await selectOtTab(page, 'SentToOT');
    await expect(page.getByTestId(OT_TEST_IDS.statusTab('SentToOT'))).toBeVisible();
  });
});
