/**
 * B1 regression — Ward discharge CollectPaymentDrawer.
 *
 *   npx playwright test e2e/ip-ward-discharge-collect-payment.spec.ts --project=chromium-ward-journey
 */
import { test, expect, type Page } from '@playwright/test';
import { loginAsRole } from './helpers/auth';
import { WARD_PREOP_TEST_IDS } from '../src/lib/ip-management/ward-preop-test-ids';
import { WARD_DISCHARGE_TEST_IDS } from '../src/lib/ip-management/ward-discharge-test-ids';
import { COLLECT_PAYMENT_TEST_IDS } from '../src/lib/ip-management/collect-payment';

const JOURNEY_A = '11111111-1111-4111-8111-111111111111';
const BILL_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const RECEIPT = 'RCP-20260826-WARD-0001';

function journeyRow() {
  return {
    id: JOURNEY_A,
    patientId: JOURNEY_A,
    uhid: 'UAT-002',
    patientName: 'Meena Iyer',
    eyeOperated: 'OD',
    procedureName: 'Phaco',
    packageAmount: 120000,
    totalPaid: 30000,
    balanceDue: 10000,
    wardName: 'Day Care',
    bedNumber: 'B-04',
    clinicalState: 'ReadyForDischarge',
    otState: 'Completed',
    financialState: 'PartiallyPaid',
    postOpState: 'Completed',
    admittedAt: '2026-08-24T08:00:00Z',
    surgeryScheduledAt: '2026-08-24T10:00:00Z',
    isLocked: false,
    isBillingLocked: false,
    admissionType: 'Elective',
    patientGender: 'F',
    patientDob: '1972-03-14',
    patientAge: 54,
    paymentMode: 'Insurance',
    isEmergencyFc: false,
    emergencyFcReason: null,
    otReturnReason: null,
    counselingSessionId: null,
    otDetailsSaved: true,
    updatedAt: '2026-08-26T08:00:00Z',
  };
}

function paidBill() {
  return {
    id: BILL_ID,
    billNumber: 'IPD-2026-00841',
    isFinalized: false,
    amountPaid: 40000,
    balanceDue: 0,
    payments: [
      {
        id: 'p1',
        receiptNumber: RECEIPT,
        amount: 10000,
        paymentMode: 'cash',
        paymentDate: '2026-08-26T10:00:00Z',
        createdAt: '2026-08-26T10:00:00Z',
      },
    ],
  };
}

const DUE_SUMMARY = {
  opdBillId: BILL_ID,
  billNumber: 'IPD-2026-00841',
  billedAmount: 120000,
  patientResponsibility: 40000,
  insuranceResponsibility: 80000,
  patientBalance: 10000,
  totalCollected: 30000,
  balanceDue: 90000,
  financialStatus: 'partial',
  isFinalized: false,
  packageEstimate: 120000,
};

const SETTLED_SUMMARY = {
  ...DUE_SUMMARY,
  patientBalance: 0,
  totalCollected: 40000,
  financialStatus: 'paid',
};

async function mockWardDischarge(page: Page, getSummary: () => unknown) {
  const isIpApi = (url: URL) =>
    url.port === '5074' || /\/api\/ip-management/i.test(url.pathname);

  await page.route(isIpApi, async (route) => {
    const req = route.request();
    const path = new URL(req.url()).pathname.replace(/\/$/, '');
    if (req.method() === 'OPTIONS') {
      await route.fulfill({ status: 204 });
      return;
    }
    const json = (body: unknown) => route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(body),
    });
    if (/\/ip-management\/wards$/i.test(path)) {
      await json([{ id: 'ward-1', name: 'Day Care' }]);
      return;
    }
    if (/\/ip-management\/journeys$/i.test(path)) {
      await json([journeyRow()]);
      return;
    }
    if (/financial-summary$/i.test(path)) {
      await json(getSummary());
      return;
    }
    if (/transition-gates$/i.test(path)) {
      await json({
        transition: 'Discharged',
        canProceed: false,
        requiresOverride: false,
        warnings: [],
      });
      return;
    }
    if (/ward-postop-checklist$/i.test(path)) {
      await json({ items: [] });
      return;
    }
    if (/preauth-status$/i.test(path)) {
      await json({ allowed: true, warningLevel: 'none' });
      return;
    }
    if (/dashboard-summary$/i.test(path)) {
      await json({ total: 1, readyForDischarge: 1 });
      return;
    }
    await json({ items: [], warnings: [], allowed: true, readings: [] });
  });
}

test.describe('B1 ward discharge collect @ip-ward', () => {
  test.describe.configure({ timeout: 90_000 });

  test('opens CollectPaymentDrawer as Advance, retries the same key, refreshes server due', async ({ page }) => {
    const paymentBodies: Record<string, unknown>[] = [];
    let settled = false;
    await page.setViewportSize({ width: 1400, height: 900 });
    await loginAsRole(page, 'admin');
    await mockWardDischarge(page, () => (settled ? SETTLED_SUMMARY : DUE_SUMMARY));
    await page.route(/\/opdbills\/payment$/i, async (route) => {
      if (route.request().method() !== 'POST') {
        await route.continue();
        return;
      }
      const body = JSON.parse(route.request().postData() || '{}') as Record<string, unknown>;
      paymentBodies.push(body);
      if (paymentBodies.length === 1) {
        await route.fulfill({
          status: 503,
          contentType: 'application/json',
          body: JSON.stringify({ message: 'temporarily unavailable' }),
        });
        return;
      }
      settled = true;
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(paidBill()),
      });
    });

    await page.goto(
      `/dashboard/ip-management/ward?patient=${JOURNEY_A}&intent=discharge`,
      { waitUntil: 'domcontentloaded' },
    );
    await expect(page.getByTestId(WARD_PREOP_TEST_IDS.wardPage)).toBeVisible({ timeout: 20_000 });
    await expect(page.getByTestId(WARD_DISCHARGE_TEST_IDS.workspace)).toBeVisible({ timeout: 20_000 });
    await expect(page.getByTestId(WARD_DISCHARGE_TEST_IDS.collectLink)).toBeVisible();
    await page.getByTestId(WARD_DISCHARGE_TEST_IDS.collectLink).click();
    await expect(page.getByTestId(COLLECT_PAYMENT_TEST_IDS.drawer)).toBeVisible();
    await expect(page.getByTestId(COLLECT_PAYMENT_TEST_IDS.amount)).toHaveValue('10000');
    await expect(page.getByRole('radio', { name: 'Advance', exact: true })).toBeChecked();

    await page.getByTestId(COLLECT_PAYMENT_TEST_IDS.submit).click();
    await expect(page.getByTestId(COLLECT_PAYMENT_TEST_IDS.retry)).toBeVisible();
    await page.getByTestId(COLLECT_PAYMENT_TEST_IDS.retry).click();
    // Ward onCollected closes the drawer and reloads financial-summary from the server.
    await expect(page.getByTestId(COLLECT_PAYMENT_TEST_IDS.drawer)).toBeHidden({ timeout: 15_000 });
    await expect(page.getByTestId(WARD_DISCHARGE_TEST_IDS.workspace)).toContainText('₹40,000');
    await expect(page.getByTestId(WARD_DISCHARGE_TEST_IDS.workspace)).toContainText('Patient due ₹0');

    expect(paymentBodies).toHaveLength(2);
    expect(paymentBodies[0].billId).toBeUndefined();
    expect(paymentBodies[1].billId).toBeUndefined();
    expect(paymentBodies[0].opdBillId).toBe(BILL_ID);
    expect(paymentBodies[1].opdBillId).toBe(BILL_ID);
    expect(paymentBodies[0].paymentKind).toBe('Advance');
    expect(paymentBodies[1].paymentKind).toBe('Advance');
    expect(paymentBodies[0].paymentMode).toBeTruthy();
    expect(Number(paymentBodies[0].amount)).toBe(10000);
    expect(String(paymentBodies[0].idempotencyKey)).toMatch(new RegExp(`^payment:${BILL_ID}:`));
    expect(paymentBodies[0].idempotencyKey).toBe(paymentBodies[1].idempotencyKey);
  });
});
