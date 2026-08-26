/**
 * IP-013 — assign a day-care slot, then the census (and rail) show AM-1.
 *
 *   npx playwright test e2e/ip-census-slot-assign.spec.ts --project=chromium-ward-journey
 */
import { test, expect, type Page } from '@playwright/test';
import { E2E_API_BASE, E2E_EMAIL, E2E_PASSWORD, E2E_TENANT_ID, seedBrowserAuth, type LoginPayload } from './helpers/auth';
import { IP_CENSUS_TEST_IDS } from '../src/lib/ip-management/ip-census-test-ids';
import { IP_SLOT_TEST_IDS } from '../src/lib/ip-management/ip-slot-test-ids';

const JOURNEY_A = '11111111-1111-4111-8111-111111111111';
const JOURNEY_B = '22222222-2222-4222-8222-222222222222';
const THEATRE_ID = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
const SLOT_ID = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const ARRIVE = '2026-08-25T02:30:00.000Z';

function journeyRow(overrides: Record<string, unknown> = {}) {
  return {
    id: JOURNEY_A,
    patientId: JOURNEY_A,
    uhid: 'UAT-013',
    patientName: 'Meena Iyer',
    eyeOperated: 'OD',
    procedureName: 'Phaco',
    packageAmount: 0,
    totalPaid: 0,
    balanceDue: 0,
    wardName: 'Day Care',
    bedNumber: 'B-01',
    clinicalState: 'Admitted',
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
    slotId: null,
    slotLabel: null,
    slotSession: null,
    slotSequenceNo: null,
    plannedArrivalAt: null,
    ...overrides,
  };
}

function assignedSlotRow() {
  return {
    id: SLOT_ID,
    journeyId: JOURNEY_A,
    theatreId: THEATRE_ID,
    theatreName: 'Theatre 1',
    slotDate: '2026-08-25',
    session: 'Morning',
    sequenceNo: 1,
    plannedArrivalAt: ARRIVE,
    slotLabel: 'AM-1',
    releasedAt: null,
    patientName: 'Meena Iyer',
    uhid: 'UAT-013',
    procedureName: 'Phaco',
    eyeOperated: 'OD',
    clinicalState: 'Admitted',
    pacCompleted: false,
  };
}

function emptyBoard() {
  return {
    date: '2026-08-25',
    theatreId: THEATRE_ID,
    morning: [] as unknown[],
    afternoon: [] as unknown[],
    evening: [] as unknown[],
    unassigned: [{
      journeyId: JOURNEY_A,
      patientName: 'Meena Iyer',
      uhid: 'UAT-013',
      procedureName: 'Phaco',
      eyeOperated: 'OD',
      clinicalState: 'Admitted',
    }],
  };
}

async function loginCoordinator(page: Page) {
  const res = await page.request.post(`${E2E_API_BASE}/auth/login`, {
    data: { email: E2E_EMAIL, password: E2E_PASSWORD, tenantId: E2E_TENANT_ID },
  });
  expect(res.ok()).toBeTruthy();
  const login = (await res.json()) as LoginPayload;
  const permissions = [...new Set([
    ...(login.permissions ?? []),
    'ip.ot.send',
    'ward.checklist.edit',
    'ip_management.view',
  ])];
  await seedBrowserAuth(page, { ...login, permissions });
}

async function mockSlotAssignApis(page: Page, state: { assigned: boolean; posted: Record<string, unknown> | null }) {
  await page.route('**/otbooking/theaters**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([{ id: THEATRE_ID, name: 'Theatre 1', code: 'OT1' }]),
    });
  });

  // Match `/api/ip-management/slots` (IP Functions), not the Next page
  // `/dashboard/ip-management/slots`.
  await page.route('**/api/ip-management/slots**', async (route) => {
    if (route.request().resourceType() === 'document') {
      await route.continue();
      return;
    }
    const url = new URL(route.request().url());
    const path = url.pathname.replace(/\/$/, '');
    const method = route.request().method();

    if (path.endsWith('/slots/metrics') && method === 'GET') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          assignedCount: state.assigned ? 1 : 0,
          readyCount: 0,
          avgArrivalToDischargeMinutes: null,
          avgTurnoverMinutes: null,
        }),
      });
      return;
    }

    if (path.endsWith('/slots') && method === 'GET') {
      const board = emptyBoard();
      if (state.assigned) {
        board.morning = [assignedSlotRow()];
        board.unassigned = [];
      }
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(board),
      });
      return;
    }

    if (path.endsWith('/slots') && method === 'POST') {
      state.posted = route.request().postDataJSON() as Record<string, unknown>;
      state.assigned = true;
      await route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify(assignedSlotRow()),
      });
      return;
    }

    await route.continue();
  });

  await page.route('**/ip-management/journeys**', async (route) => {
    const url = new URL(route.request().url());
    const path = url.pathname.replace(/\/$/, '');
    if (/transition-gates/.test(path)) {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          transition: 'ReadyForSurgery',
          canProceed: true,
          requiresOverride: false,
          warnings: [],
        }),
      });
      return;
    }
    if (!/\/ip-management\/journeys$/.test(path) || route.request().method() !== 'GET') {
      await route.continue();
      return;
    }
    const row = state.assigned
      ? journeyRow({
        slotId: SLOT_ID,
        slotLabel: 'AM-1',
        slotSession: 'Morning',
        slotSequenceNo: 1,
        plannedArrivalAt: ARRIVE,
      })
      : journeyRow();
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([row]),
    });
  });
}

test.describe('IP-013 slot assign → census @ip-census', () => {
  test.describe.configure({ timeout: 90_000 });

  test('assigning AM-1 on the board shows the slot on the census row and rail', async ({ page }) => {
    const state = { assigned: false, posted: null as Record<string, unknown> | null };
    await mockSlotAssignApis(page, state);
    await loginCoordinator(page);

    await page.setViewportSize({ width: 1400, height: 900 });
    await page.goto('/dashboard/ip-management/slots', { waitUntil: 'domcontentloaded' });
    await expect(page.getByTestId(IP_SLOT_TEST_IDS.board)).toBeVisible({ timeout: 20_000 });
    await expect(page.getByTestId(IP_SLOT_TEST_IDS.theatre)).toHaveValue(THEATRE_ID);
    await expect(page.getByTestId(IP_SLOT_TEST_IDS.assign('Morning'))).toBeVisible();

    await page.getByTestId(IP_SLOT_TEST_IDS.assign('Morning')).click();
    await expect(page.getByTestId(IP_SLOT_TEST_IDS.assignDialog)).toBeVisible();
    await page.getByTestId(IP_SLOT_TEST_IDS.assignPatient).selectOption(JOURNEY_A);
    await page.getByTestId(IP_SLOT_TEST_IDS.assignSubmit).click();

    await expect.poll(() => state.posted).not.toBeNull();
    expect(state.posted!.journeyId).toBe(JOURNEY_A);
    expect(state.posted!.session).toBe('Morning');
    expect(state.posted!.theatreId).toBe(THEATRE_ID);
    await expect(page.getByTestId(IP_SLOT_TEST_IDS.row(JOURNEY_A))).toBeVisible();
    await expect(page.getByText('Slot assigned')).toBeVisible();

    await page.goto('/dashboard/ip-management', { waitUntil: 'domcontentloaded' });
    await expect(page.getByTestId(IP_CENSUS_TEST_IDS.row(JOURNEY_A))).toBeVisible({ timeout: 20_000 });
    await expect(page.getByTestId(IP_CENSUS_TEST_IDS.slotCell(JOURNEY_A))).toHaveText('AM-1');

    await page.getByTestId(IP_CENSUS_TEST_IDS.sessionFilter).selectOption('Afternoon');
    await expect(page.getByTestId(IP_CENSUS_TEST_IDS.row(JOURNEY_A))).toHaveCount(0);
    await page.getByTestId(IP_CENSUS_TEST_IDS.sessionFilter).selectOption('Morning');
    await expect(page.getByTestId(IP_CENSUS_TEST_IDS.row(JOURNEY_A))).toBeVisible();

    await page.getByTestId(IP_CENSUS_TEST_IDS.row(JOURNEY_A)).click();
    await expect(page.getByTestId(IP_CENSUS_TEST_IDS.rail)).toBeVisible();
    await expect(page.getByTestId(IP_CENSUS_TEST_IDS.railSlot)).toContainText('AM-1');
    await expect(page.getByTestId(IP_CENSUS_TEST_IDS.railArrive)).toBeVisible();
  });

  test('Ready for OT tab lists patients in slot sequence', async ({ page }) => {
    await page.route('**/ip-management/journeys**', async (route) => {
      const url = new URL(route.request().url());
      const path = url.pathname.replace(/\/$/, '');
      if (/transition-gates/.test(path)) {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            transition: 'SentToOT',
            canProceed: true,
            requiresOverride: false,
            warnings: [],
          }),
        });
        return;
      }
      if (!/\/ip-management\/journeys$/.test(path) || route.request().method() !== 'GET') {
        await route.continue();
        return;
      }
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([
          journeyRow({
            id: JOURNEY_B,
            patientId: JOURNEY_B,
            patientName: 'Tara Nair',
            uhid: 'UAT-013B',
            clinicalState: 'ReadyForSurgery',
            slotLabel: 'AM-2',
            slotSession: 'Morning',
            slotSequenceNo: 2,
            plannedArrivalAt: '2026-08-25T02:45:00.000Z',
          }),
          journeyRow({
            clinicalState: 'ReadyForSurgery',
            slotLabel: 'AM-1',
            slotSession: 'Morning',
            slotSequenceNo: 1,
            plannedArrivalAt: '2026-08-25T03:15:00.000Z',
          }),
        ]),
      });
    });

    await loginCoordinator(page);
    await page.setViewportSize({ width: 1400, height: 900 });
    await page.goto('/dashboard/ip-management?tab=ReadyForOt', { waitUntil: 'domcontentloaded' });
    await expect(page.getByTestId(IP_CENSUS_TEST_IDS.row(JOURNEY_A))).toBeVisible({ timeout: 20_000 });
    await expect(page.getByTestId(IP_CENSUS_TEST_IDS.row(JOURNEY_B))).toBeVisible();

    const names = page.locator('tbody tr[data-testid^="ip-census-row-"] td:nth-child(2) p.font-semibold');
    await expect(names).toHaveCount(2);
    await expect(names.nth(0)).toHaveText('Meena Iyer');
    await expect(names.nth(1)).toHaveText('Tara Nair');
    await expect(page.getByTestId(IP_CENSUS_TEST_IDS.slotCell(JOURNEY_A))).toHaveText('AM-1');
    await expect(page.getByTestId(IP_CENSUS_TEST_IDS.slotCell(JOURNEY_B))).toHaveText('AM-2');
  });
});
