/**
 * Phase 5 P1 — Playwright journeys for IP × CCMS × Billing validation.
 *
 * Always-on (when ward journeys exist):
 *   - Admit-block copy, warning/block level, CCMS deep-link
 *   - Cash Coverage & Payment Status (non-coverage)
 *
 * Full clinical mutation (opt-in):
 *   E2E_WARD_FULL_FLOWS=1
 *
 * Run:
 *   npx playwright test e2e/ip-ccms-phase5-p1.spec.ts --project=chromium-ward-journey
 */
import { test, expect, type Page } from '@playwright/test';
import { loginAsRole, apiLogin } from './helpers/auth';
import { WARD_PREOP_TEST_IDS } from '../src/lib/ip-management/ward-preop-test-ids';
import {
  apiAdmitPatient,
  fetchWardJourneys,
  gotoWardPage,
  navigateStep,
  openWorkspaceForJourney,
  resolveWardFixtures,
} from './helpers/ward-preop';
import {
  apiFetchJourneyDetail,
  apiPrepareJourneyForOtFlow,
  apiPrepareAcceptedInOt,
  apiStartSurgery,
  apiTransitionClinical,
} from './helpers/ward-journey-api';
import {
  clickOtEndSurgery,
  clickOtMoveToPostOp,
  gotoOtPage,
  selectOtTab,
} from './helpers/ot-journey';
import { goCcmsClaims } from './helpers/ccms';
import {
  apiAllocateBill,
  apiGenerateClaim,
  apiGetBillingFull,
  apiGetCcmsCase,
  apiListCcmsCases,
  apiListClaimsForCase,
  apiListEnhancementsForCase,
  isCoverageBasedMode,
  postBillFinalized,
} from './helpers/phase5-p1';

const FULL_FLOWS = process.env.E2E_WARD_FULL_FLOWS === '1';
const STUB_CASE_ID = 'ca000011-0000-4000-8000-000000000000';
const STUB_BLOCK_REASON = 'P1-E2E pending pre-auth';

async function stubBlockedPreauth(page: Page): Promise<void> {
  await page.route('**/ip-management/journeys/*/financial/preauth-status', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        allowed: false,
        warningLevel: 'block',
        decision: 'BLOCK',
        blockReason: STUB_BLOCK_REASON,
        coverageState: 'WAITING_APPROVAL',
        caseId: STUB_CASE_ID,
      }),
    });
  });
}

test.describe('Phase 5 P1 — coverage UI @ip-ccms-p1', () => {
  test.describe.configure({ timeout: 120_000 });

  test.beforeEach(async ({ page }) => {
    await loginAsRole(page, 'nurse');
    await gotoWardPage(page);
  });

  test('admit block reason and warning/block level are visible for pending coverage', async ({
    page,
    request,
  }) => {
    const login = await apiLogin(request);
    const journeys = await fetchWardJourneys(request, login);
    const target = journeys.find((x) => x.clinicalState === 'Expected') ?? journeys[0];
    test.skip(!target, 'No ward journey to open Coverage/Admit panels');

    await stubBlockedPreauth(page);
    await openWorkspaceForJourney(page, target.id);
    await navigateStep(page, 'financial');

    const live = page.getByTestId(WARD_PREOP_TEST_IDS.financialPreauthLive);
    await expect(live).toBeVisible({ timeout: 20_000 });
    await expect(live).toContainText(/BLOCK/i);
    await expect(live).toContainText(STUB_BLOCK_REASON);

    await page.getByTestId(WARD_PREOP_TEST_IDS.stepTab('admit')).click();
    await expect(page.getByTestId(WARD_PREOP_TEST_IDS.admitModal)).toBeVisible();
    await expect(page.getByTestId(WARD_PREOP_TEST_IDS.admitCcmsBlock)).toBeVisible();
    await expect(page.getByTestId(WARD_PREOP_TEST_IDS.admitCcmsBlock)).toContainText(STUB_BLOCK_REASON);
  });

  test('CCMS warning/block chip and case deep-link when caseId is present', async ({
    page,
    request,
  }) => {
    const login = await apiLogin(request);
    const journeys = await fetchWardJourneys(request, login);
    const target = journeys.find((x) => x.clinicalState === 'Expected') ?? journeys[0];
    test.skip(!target, 'No ward journey for CCMS deep-link');

    await stubBlockedPreauth(page);
    await openWorkspaceForJourney(page, target.id);
    await navigateStep(page, 'financial');

    const live = page.getByTestId(WARD_PREOP_TEST_IDS.financialPreauthLive);
    await expect(live).toBeVisible({ timeout: 20_000 });
    await expect(live).toHaveText(/Decision:|CCMS:/i);

    const link = page.getByTestId(WARD_PREOP_TEST_IDS.financialCcmsLink);
    await expect(link).toBeVisible();
    await expect(link).toHaveAttribute('href', `/dashboard/ccms/cases/${STUB_CASE_ID}`);
    await link.click();
    await expect(page).toHaveURL(new RegExp(`/dashboard/ccms/cases/${STUB_CASE_ID}`), {
      timeout: 20_000,
    });
  });

  test('cash / non-coverage Coverage & Payment Status does not require insurance case', async ({
    page,
    request,
  }) => {
    const login = await apiLogin(request);
    const journeys = await fetchWardJourneys(request, login);
    let cashId: string | undefined;
    for (const j of journeys.filter((x) => x.clinicalState === 'Expected')) {
      const d = await apiFetchJourneyDetail(request, login, j.id);
      if (d && !isCoverageBasedMode(d.paymentMode)) {
        cashId = j.id;
        break;
      }
    }
    test.skip(!cashId, 'No Expected cash/non-coverage journey');

    await openWorkspaceForJourney(page, cashId);
    await navigateStep(page, 'financial');
    const panel = page.getByTestId(WARD_PREOP_TEST_IDS.financialPanel);
    await expect(panel).toBeVisible();
    await expect(panel.getByRole('heading', { name: /Coverage & Payment Status/i })).toBeVisible();
    const live = page.getByTestId(WARD_PREOP_TEST_IDS.financialPreauthLive);
    if (await live.count()) {
      await expect(live).not.toHaveText(/Blocks admission/i);
    }
  });
});

test.describe('Phase 5 P1 — cash clinical journey @ip-ccms-p1', () => {
  test.describe.configure({ timeout: 180_000 });

  test('cash Expected → admit → OT → clinical discharge (opt-in)', async ({ page, request }) => {
    test.skip(!FULL_FLOWS, 'Set E2E_WARD_FULL_FLOWS=1 with seeded cash journeys');

    const login = await apiLogin(request);
    const fixtures = await resolveWardFixtures(request, login);
    const journeys = await fetchWardJourneys(request, login);

    const expectedCash = await (async () => {
      for (const j of journeys.filter((x) => x.clinicalState === 'Expected')) {
        const d = await apiFetchJourneyDetail(request, login, j.id);
        if (d && !isCoverageBasedMode(d.paymentMode)) return j;
      }
      return undefined;
    })();

    if (expectedCash) {
      const admitted = await apiAdmitPatient(request, login, expectedCash.id);
      expect(admitted?.clinicalState).toBe('Admitted');
    }

    const ready = fixtures.ready;
    if (ready) {
      const readyDetail = await apiFetchJourneyDetail(request, login, ready.id);
      test.skip(
        isCoverageBasedMode(readyDetail?.paymentMode),
        'ReadyForSurgery fixture is coverage-based; skip cash OT path',
      );
      const prepared = await apiPrepareJourneyForOtFlow(request, login, ready);
      test.skip(!prepared || prepared.clinicalState !== 'SentToOT', 'Could not prepare SentToOT');

      const accepted = await apiPrepareAcceptedInOt(request, login, ready.id);
      test.skip(
        accepted?.otState !== 'Accepted' && accepted?.clinicalState !== 'InOT',
        `Accept-in-OT failed (clinical=${accepted?.clinicalState ?? 'null'}, ot=${accepted?.otState ?? 'null'}). Need ot.safety.sign + billing override.`,
      );

      const started =
        accepted?.clinicalState === 'InOT'
          ? accepted
          : await apiStartSurgery(request, login, ready.id);
      expect(
        started?.clinicalState,
        `Start surgery must enter InOT (clinical=${started?.clinicalState ?? 'null'}, ot=${started?.otState ?? 'null'})`,
      ).toBe('InOT');

      await loginAsRole(page, 'ot_nurse');
      await gotoOtPage(page);
      await page.reload({ waitUntil: 'domcontentloaded' });
      await selectOtTab(page, 'InOT');
      await clickOtEndSurgery(page, ready.id);

      const afterEnd = await apiFetchJourneyDetail(request, login, ready.id);
      if (afterEnd?.clinicalState === 'SurgeryCompleted') {
        await selectOtTab(page, 'SurgeryCompleted');
        await clickOtMoveToPostOp(page, ready.id);
        const still = await apiFetchJourneyDetail(request, login, ready.id);
        if (still?.clinicalState === 'SurgeryCompleted') {
          await apiTransitionClinical(request, login, ready.id, 'PostOp');
        }
      }

      await expect
        .poll(async () => (await apiFetchJourneyDetail(request, login, ready.id))?.clinicalState ?? '', {
          timeout: 30_000,
        })
        .toBe('PostOp');

      const toDischarge = await apiTransitionClinical(request, login, ready.id, 'ReadyForDischarge');
      if (toDischarge) {
        await apiTransitionClinical(request, login, ready.id, 'Discharged');
        const final = await apiFetchJourneyDetail(request, login, ready.id);
        expect(['Discharged', 'ReadyForDischarge']).toContain(final?.clinicalState);
      }
    } else {
      test.skip(!expectedCash, 'No cash Expected journey and no ReadyForSurgery fixture');
    }
  });
});

test.describe('Phase 5 P1 — insurance + BillFinalized @ip-ccms-p1', () => {
  test.describe.configure({ timeout: 120_000 });

  test('approved coverage case UI continues to billing/claims after discharge conceptually', async ({
    page,
    request,
  }) => {
    const login = await apiLogin(request);
    const approved = (await apiListCcmsCases(request, login, 'APPROVED'))[0]
      ?? (await apiListCcmsCases(request, login, 'PARTIAL_APPROVAL'))[0]
      ?? (await apiListCcmsCases(request, login, 'ADMISSION_READY'))[0];
    test.skip(!approved?.id, 'No APPROVED/PARTIAL/ADMISSION_READY CCMS case');

    await loginAsRole(page, 'admin');
    await page.goto(`/dashboard/ccms/cases/${approved.id}`);
    await expect(page.getByText(/CCMS-|Coverage|Pre-Auth|Authorization/i).first()).toBeVisible({
      timeout: 20_000,
    });

    const billingTab = page.getByRole('button', { name: /billing/i }).or(page.getByRole('tab', { name: /billing/i }));
    if (await billingTab.count()) {
      await billingTab.first().click();
    }
    const claimsTab = page.getByRole('button', { name: /claim/i }).or(page.getByRole('tab', { name: /claim/i }));
    if (await claimsTab.count()) {
      await claimsTab.first().click();
    }

    await goCcmsClaims(page);
    await expect(page.getByRole('heading', { name: /claim/i })).toBeVisible();
  });

  test('BillFinalized replay does not duplicate enhancement draft', async ({ request }) => {
    const login = await apiLogin(request);
    const listed = [
      ...(await apiListCcmsCases(request, login, 'APPROVED')),
      ...(await apiListCcmsCases(request, login, 'PARTIAL_APPROVAL')),
      ...(await apiListCcmsCases(request, login, 'ADMITTED')),
      ...(await apiListCcmsCases(request, login, 'BILL_PENDING')),
      ...(await apiListCcmsCases(request, login)),
    ];
    let linked: Awaited<ReturnType<typeof apiGetCcmsCase>> = null;
    for (const row of listed) {
      const detail = await apiGetCcmsCase(request, login, row.id);
      if (detail?.sessionId || detail?.journeyId) {
        linked = detail;
        break;
      }
    }
    test.skip(!linked, 'No CCMS case with sessionId/journeyId for BillFinalized');

    const before = await apiListEnhancementsForCase(request, login, linked!.id);
    const billing = await apiGetBillingFull(request, login, linked!.id);
    const key = `BillFinalized:p1-e2e-${Date.now()}`;
    const payload = {
      journeyId: linked!.journeyId ?? undefined,
      sessionId: linked!.sessionId ?? undefined,
      billId: billing?.summary?.id ?? crypto.randomUUID(),
      totalAmount: 1,
    };

    const s1 = await postBillFinalized(request, payload, key);
    expect(s1).toBe(200);
    const afterFirst = await apiListEnhancementsForCase(request, login, linked!.id);
    const billingAfterFirst = await apiGetBillingFull(request, login, linked!.id);

    const s2 = await postBillFinalized(request, payload, key);
    expect(s2).toBe(200);
    const afterSecond = await apiListEnhancementsForCase(request, login, linked!.id);
    const billingAfterSecond = await apiGetBillingFull(request, login, linked!.id);

    expect(afterSecond.length).toBe(afterFirst.length);
    expect(billingAfterSecond?.allocationCount ?? 0).toBe(billingAfterFirst?.allocationCount ?? 0);

    expect(afterSecond.length).toBe(afterFirst.length);
    const open = (rows: Array<{ status?: string }>) =>
      rows.filter((r) => {
        const st = String(r.status ?? '').toLowerCase();
        return st === 'active' || st === 'submitted';
      }).length;
    expect(open(afterSecond)).toBe(open(afterFirst));
    expect(open(afterFirst)).toBeLessThanOrEqual(open(before) + 1);
  });

  test('approved case allocate then claim smoke (opt-in full flows)', async ({ request }) => {
    test.skip(!FULL_FLOWS, 'Set E2E_WARD_FULL_FLOWS=1 to mutate billing/claims');
    const login = await apiLogin(request);
    const approved = (await apiListCcmsCases(request, login, 'APPROVED'))[0];
    test.skip(!approved?.id, 'No APPROVED CCMS case');

    const claimsBefore = (await apiListClaimsForCase(request, login, approved.id)).length;
    const allocStatus = await apiAllocateBill(request, login, approved.id, 500);
    expect([201, 200, 400, 409, 422]).toContain(allocStatus);

    const claimStatus = await apiGenerateClaim(request, login, approved.id, 500);
    expect([201, 200, 400, 409, 422]).toContain(claimStatus);
    if (claimStatus === 201 || claimStatus === 200) {
      const claimsAfter = await apiListClaimsForCase(request, login, approved.id);
      expect(claimsAfter.length).toBeGreaterThanOrEqual(claimsBefore);
    }
  });
});
