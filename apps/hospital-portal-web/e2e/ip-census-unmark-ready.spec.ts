/**
 * IP-011 — reversible Mark Ready: reason-required revert, then re-mark.
 *
 *   npx playwright test e2e/ip-census-unmark-ready.spec.ts --project=chromium-ward-journey
 */
import { test, expect, type Page } from '@playwright/test';
import { loginAsRole } from './helpers/auth';
import { IP_CENSUS_TEST_IDS } from '../src/lib/ip-management/ip-census-test-ids';

const JOURNEY_A = '11111111-1111-4111-8111-111111111111';
const REASON = 'BP 180/100, deferred pending review';

function journeyRow(clinicalState: string) {
  return {
    id: JOURNEY_A,
    patientId: JOURNEY_A,
    uhid: 'UAT-011',
    patientName: 'Meena Iyer',
    eyeOperated: 'OD',
    procedureName: 'Phaco',
    packageAmount: 0,
    totalPaid: 0,
    balanceDue: 0,
    wardName: 'Day Care',
    bedNumber: 'B-01',
    clinicalState,
    otState: 'NotSent',
    financialState: 'Draft',
    postOpState: 'NotStarted',
    admittedAt: '2026-08-24T08:00:00Z',
    surgeryScheduledAt: null,
    isLocked: false,
    isBillingLocked: false,
    admissionType: 'Elective',
    patientGender: 'F',
    patientDob: '1972-03-14',
    patientAge: 54,
    paymentMode: null,
    isEmergencyFc: false,
    emergencyFcReason: null,
    otReturnReason: null,
    counselingSessionId: null,
    otDetailsSaved: false,
    updatedAt: '2026-08-24T08:00:00Z',
  };
}

const CLEAR_GATES = {
  transition: 'ReadyForSurgery',
  canProceed: true,
  requiresOverride: false,
  warnings: [] as unknown[],
};

function detailBody(clinicalState: string) {
  return {
    ...journeyRow(clinicalState),
    branchId: 'b1',
    createdAt: '2026-08-24T08:00:00Z',
  };
}

async function mockCensus(page: Page, getRow: () => ReturnType<typeof journeyRow>) {
  await page.route('**/ip-management/journeys**', async (route) => {
    const url = new URL(route.request().url());
    const path = url.pathname.replace(/\/$/, '');
    if (!/\/ip-management\/journeys$/.test(path)) {
      await route.continue();
      return;
    }
    if (route.request().method() !== 'GET') {
      await route.continue();
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([getRow()]),
    });
  });
}

async function mockGates(page: Page, body: unknown) {
  await page.route('**/ip-management/journeys/**/transition-gates**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(body),
    });
  });
}

async function openCensusRail(page: Page) {
  await page.setViewportSize({ width: 1400, height: 900 });
  await loginAsRole(page, 'admin');
  await page.addInitScript(() => {
    try {
      const raw = localStorage.getItem('permissions');
      const perms: string[] = raw ? JSON.parse(raw) : [];
      if (!Array.isArray(perms)) return;
      if (!perms.includes('*') && !perms.includes('ip.ot.unmark_ready')) {
        perms.push('ip.ot.unmark_ready', 'ip.ot.mark_ready', 'ward.checklist.edit');
        localStorage.setItem('permissions', JSON.stringify(perms));
      }
    } catch {
      /* ignore */
    }
  });
  await page.goto('/dashboard/ip-management', { waitUntil: 'domcontentloaded' });
  await expect(page.getByTestId(IP_CENSUS_TEST_IDS.row(JOURNEY_A))).toBeVisible({ timeout: 20_000 });
  await page.getByTestId(IP_CENSUS_TEST_IDS.row(JOURNEY_A)).click();
  await expect(page.getByTestId(IP_CENSUS_TEST_IDS.rail)).toBeVisible();
}

test.describe('IP-011 census unmark ready @ip-census', () => {
  test.describe.configure({ timeout: 90_000 });

  test('confirm stays disabled until 10 characters, then revert and re-mark', async ({ page }) => {
    let clinicalState = 'ReadyForSurgery';
    const posts: Record<string, unknown>[] = [];

    await mockCensus(page, () => journeyRow(clinicalState));
    await mockGates(page, CLEAR_GATES);
    await page.route('**/ip-management/journeys/**/clinical-transition', async (route) => {
      if (route.request().method() !== 'POST') {
        await route.continue();
        return;
      }
      const body = route.request().postDataJSON() as Record<string, unknown>;
      posts.push(body);
      const next = body.newState === 'Admitted' ? 'Admitted' : 'ReadyForSurgery';
      clinicalState = next;
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(detailBody(next)),
      });
    });

    await openCensusRail(page);

    await page.getByTestId(IP_CENSUS_TEST_IDS.unmarkReady).click();
    await expect(page.getByTestId('reason-confirm-dialog')).toBeVisible();
    const submit = page.getByTestId('reason-confirm-submit');
    await expect(submit).toBeDisabled();
    await page.getByTestId('reason-confirm-input').fill('short');
    await expect(submit).toBeDisabled();
    await page.getByTestId('reason-confirm-input').fill(REASON);
    await expect(submit).toBeEnabled();
    await submit.click();

    await expect.poll(() => posts.length).toBe(1);
    expect(posts[0].newState).toBe('Admitted');
    expect(posts[0].reason).toBe(REASON);
    expect(posts[0].acknowledgeWarnings).toBeUndefined();
    await expect(page.getByTestId('reason-confirm-dialog')).toBeHidden();

    const primary = page.getByTestId(IP_CENSUS_TEST_IDS.primaryAction);
    await expect(primary).toContainText(/Mark ready/i);
    await expect(primary).toBeEnabled();
    await primary.click();

    await expect.poll(() => posts.length).toBe(2);
    expect(posts[1].newState).toBe('ReadyForSurgery');
    expect(posts[1].acknowledgeWarnings).toBeUndefined();
  });
});
