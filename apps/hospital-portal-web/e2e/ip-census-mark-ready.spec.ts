/**
 * IP-010 — census Mark Ready preflight: blocked before click, one-click when clear, 409 refetch.
 *
 *   npx playwright test e2e/ip-census-mark-ready.spec.ts --project=chromium-ward-journey
 */
import { test, expect, type Page } from '@playwright/test';
import { loginAsRole } from './helpers/auth';
import { IP_CENSUS_TEST_IDS } from '../src/lib/ip-management/ip-census-test-ids';
import { WARD_PREOP_TEST_IDS } from '../src/lib/ip-management/ward-preop-test-ids';

const JOURNEY_A = '11111111-1111-4111-8111-111111111111';

function journeyRow(clinicalState = 'Admitted') {
  return {
    id: JOURNEY_A,
    patientId: JOURNEY_A,
    uhid: 'UAT-010',
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

const UNSIGNED_CONSENT_GATES = {
  transition: 'ReadyForSurgery',
  canProceed: false,
  requiresOverride: false,
  warnings: [{
    code: 'surgical_consent_unsigned',
    message: 'Surgical consent must be signed with the consent PDF on file.',
    severity: 'block',
    canOverride: false,
  }],
};

async function mockList(page: Page, row = journeyRow(), onListGet?: () => void) {
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
    onListGet?.();
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([row]),
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
  await page.goto('/dashboard/ip-management', { waitUntil: 'domcontentloaded' });
  await expect(page.getByTestId(IP_CENSUS_TEST_IDS.row(JOURNEY_A))).toBeVisible({ timeout: 20_000 });
  await page.getByTestId(IP_CENSUS_TEST_IDS.row(JOURNEY_A)).click();
  await expect(page.getByTestId(IP_CENSUS_TEST_IDS.rail)).toBeVisible();
}

test.describe('IP-010 census Mark Ready preflight @ip-census', () => {
  test.describe.configure({ timeout: 90_000 });

  test('unsigned consent disables the primary and shows the reason before any click', async ({ page }) => {
    await mockList(page);
    await mockGates(page, UNSIGNED_CONSENT_GATES);
    await openCensusRail(page);

    const primary = page.getByTestId(IP_CENSUS_TEST_IDS.primaryAction);
    await expect(page.getByTestId(WARD_PREOP_TEST_IDS.markReadyHardBlock('surgical_consent_unsigned'))).toBeVisible();
    await expect(page.getByText('Surgical consent must be signed with the consent PDF on file.')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Open step' })).toBeVisible();
    await expect(primary).toBeDisabled();
  });

  test('clear gates mark ready in one click without acknowledging warnings', async ({ page }) => {
    let posted: Record<string, unknown> | null = null;
    await mockList(page, journeyRow());
    await mockGates(page, CLEAR_GATES);
    await page.route('**/ip-management/journeys/**/clinical-transition', async (route) => {
      if (route.request().method() !== 'POST') {
        await route.continue();
        return;
      }
      posted = route.request().postDataJSON() as Record<string, unknown>;
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          ...journeyRow('ReadyForSurgery'),
          branchId: 'b1',
          createdAt: '2026-08-24T08:00:00Z',
        }),
      });
    });

    await openCensusRail(page);
    const primary = page.getByTestId(IP_CENSUS_TEST_IDS.primaryAction);
    await expect(primary).toBeEnabled();
    await primary.click();

    await expect.poll(() => posted).not.toBeNull();
    expect(posted!.newState).toBe('ReadyForSurgery');
    expect(posted!.acknowledgeWarnings).toBeUndefined();
  });

  test('stale row 409 surfaces the API error and refetches the census', async ({ page }) => {
    let listGets = 0;
    await mockList(page, journeyRow(), () => { listGets += 1; });
    await mockGates(page, CLEAR_GATES);
    await page.route('**/ip-management/journeys/**/clinical-transition', async (route) => {
      if (route.request().method() !== 'POST') {
        await route.continue();
        return;
      }
      await route.fulfill({
        status: 409,
        contentType: 'application/json',
        body: JSON.stringify({ message: 'This record was updated by another user. Refresh and try again.' }),
      });
    });

    await openCensusRail(page);
    const getsAfterOpen = listGets;
    await expect(page.getByTestId(IP_CENSUS_TEST_IDS.primaryAction)).toBeEnabled();
    await page.getByTestId(IP_CENSUS_TEST_IDS.primaryAction).click();

    await expect(page.getByText(/updated by another user/i)).toBeVisible();
    await expect.poll(() => listGets).toBeGreaterThan(getsAfterOpen);
  });
});
