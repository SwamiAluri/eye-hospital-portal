/**
 * Wave 7 G3 — live UI (no preauth stubs).
 * Needs Auth :5073, IP :5074, CCMS :7075, Next :3000.
 *
 *   npm run test:e2e:wave7-g3-ui
 */
import { test, expect } from '@playwright/test';
import { loginAsRole, apiLogin, apiHeaders } from './helpers/auth';
import {
  E2E_IP_API_BASE,
  gotoWardPage,
  navigateStep,
  openWorkspaceForJourney,
} from './helpers/ward-preop';
import { WARD_PREOP_TEST_IDS } from '../src/lib/ip-management/ward-preop-test-ids';
import { coverageTestIds } from '../src/lib/counsellors-desk/coverage-test-ids';
import { counsellingSessionUrl } from './helpers/counselling';
import { apiListCcmsCases } from './helpers/phase5-p1';
import { goCcmsOperationalAnalytics } from './helpers/ccms';
import { E2E_BRANCH_ID } from './helpers/patient-hub';

test.describe('Wave 7 G3 — live coverage UI @ip-ccms-g3', () => {
  test.describe.configure({ timeout: 120_000 });

  test.beforeEach(async ({ page }) => {
    await loginAsRole(page, 'admin');
  });

  test('admit panel shows live WAITING_APPROVAL blockReason for UAT-IP-091', async ({
    page,
    request,
  }) => {
    const login = await apiLogin(request);
    const res = await request.get(`${E2E_IP_API_BASE}/ip-management/journeys`, {
      headers: apiHeaders(login.accessToken),
      params: { branchId: E2E_BRANCH_ID },
    });
    expect(res.ok()).toBeTruthy();
    const rows = (await res.json()) as Record<string, unknown>[];
    const target = rows.find((r) => String(r.uhid ?? r.Uhid ?? '') === 'UAT-IP-091');
    const journeyId = String(target?.id ?? target?.Id ?? '');
    test.skip(!journeyId, 'UAT-IP-091 not on UAT branch census');

    await gotoWardPage(page);
    await page.getByTestId(WARD_PREOP_TEST_IDS.search).fill('UAT-IP-091');
    await openWorkspaceForJourney(page, journeyId);

    await navigateStep(page, 'financial');
    const live = page.getByTestId(WARD_PREOP_TEST_IDS.financialPreauthLive);
    await expect(live).toBeVisible({ timeout: 20_000 });
    await expect(live).toContainText(/BLOCK/i);
    await expect(live).toContainText(/awaiting TPA|WAITING_APPROVAL|pre-auth/i);
    await expect(live).not.toContainText(/unavailable/i);

    await page.getByTestId(WARD_PREOP_TEST_IDS.stepTab('admit')).click();
    await expect(page.getByTestId(WARD_PREOP_TEST_IDS.admitModal)).toBeVisible();
    const block = page.getByTestId(WARD_PREOP_TEST_IDS.admitCcmsBlock);
    await expect(block).toBeVisible();
    await expect(block).toContainText(/BLOCK/i);
    await expect(block).toContainText(/awaiting TPA|WAITING_APPROVAL|pre-auth/i);
    await expect(page.getByTestId(WARD_PREOP_TEST_IDS.admitSubmit)).toBeDisabled();
  });

  test('counselling coverage session shows CCMS decision strip and case link', async ({
    page,
    request,
  }) => {
    const login = await apiLogin(request);
    const listed = await apiListCcmsCases(request, login);
    const withSession = listed.find((c) => c.sessionId);
    test.skip(!withSession?.sessionId, 'No CCMS case with sessionId for counselling strip');

    await page.goto(counsellingSessionUrl(withSession.sessionId));
    const strip = page.getByTestId(coverageTestIds.counsellingCcmsStatus);
    await expect(strip).toBeVisible({ timeout: 30_000 });
    await expect(strip).toContainText(/\b(ALLOW|WARN|BLOCK)\b/);
    await expect(strip).not.toContainText(/Coverage status unavailable/i);
    const caseLink = strip.getByRole('link', { name: /Open CCMS case/i });
    await expect(caseLink).toBeVisible();
    await expect(caseLink).toHaveAttribute('href', /\/dashboard\/ccms\/cases\//);
  });

  test('CCMS operational analytics page loads journey KPIs', async ({ page }) => {
    await goCcmsOperationalAnalytics(page);
    await expect(page.getByRole('heading', { name: /Operational Analytics/i })).toBeVisible();
    await expect(page.getByTestId('ccms-operational-journey-kpis')).toBeVisible({ timeout: 20_000 });
    await expect(page.getByText(/Emergency FC/i).first()).toBeVisible();
    await expect(page.getByTestId('ccms-operational-analytics').getByText(/Failed to load analytics/i)).toHaveCount(0);
  });

  test('ward Coverage & Payment Status shows partial approval payer vs patient share', async ({
    page,
    request,
  }) => {
    const login = await apiLogin(request);
    const res = await request.get(`${E2E_IP_API_BASE}/ip-management/journeys`, {
      headers: apiHeaders(login.accessToken),
      params: { branchId: E2E_BRANCH_ID },
    });
    expect(res.ok()).toBeTruthy();
    const rows = (await res.json()) as Record<string, unknown>[];
    const target = rows.find((r) => String(r.uhid ?? r.Uhid ?? '') === 'UAT-IP-106');
    const journeyId = String(target?.id ?? target?.Id ?? '');
    test.skip(!journeyId, 'UAT-IP-106 not on UAT branch census');

    const pre = await request.get(
      `${E2E_IP_API_BASE}/ip-management/journeys/${journeyId}/financial/preauth-status`,
      { headers: apiHeaders(login.accessToken) },
    );
    expect(pre.ok()).toBeTruthy();
    const body = (await pre.json()) as Record<string, unknown>;
    const decision = String(body.decision ?? body.Decision ?? '').toUpperCase();
    test.skip(decision !== 'WARN', 'PARTIAL_APPROVAL seed not linked — apply _seed_w7_ccms_partial_approval.sql');

    await gotoWardPage(page);
    await page.getByTestId(WARD_PREOP_TEST_IDS.search).fill('UAT-IP-106');
    await openWorkspaceForJourney(page, journeyId);
    await navigateStep(page, 'financial');

    await expect(page.getByTestId(WARD_PREOP_TEST_IDS.financialPreauthLive)).toContainText(/WARN/i, {
      timeout: 20_000,
    });
    await expect(page.getByTestId(WARD_PREOP_TEST_IDS.financialPayerShare)).toBeVisible();
    await expect(page.getByTestId(WARD_PREOP_TEST_IDS.financialPatientShare)).toBeVisible();
    await expect(page.getByTestId(WARD_PREOP_TEST_IDS.financialPayerShare)).toContainText(/70/);
    await expect(page.getByTestId(WARD_PREOP_TEST_IDS.financialPatientShare)).toContainText(/30/);
  });
});
