/**
 * FE-004 — cashier collect-payment drawer from the census rail.
 *
 *   npx playwright test e2e/ip-census-collect-payment.spec.ts --project=chromium-ward-journey
 */
import { test, expect, type Page } from '@playwright/test';
import { loginAsRole } from './helpers/auth';
import { IP_CENSUS_TEST_IDS } from '../src/lib/ip-management/ip-census-test-ids';
import { COLLECT_PAYMENT_TEST_IDS } from '../src/lib/ip-management/collect-payment';

const JOURNEY_A = '11111111-1111-4111-8111-111111111111';
const BILL_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const RECEIPT = 'RCP-20260824-00001204';

function journeyRow(overrides: Record<string, unknown> = {}) {
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
    clinicalState: 'Admitted',
    otState: 'NotSent',
    financialState: 'PartiallyPaid',
    postOpState: 'NotStarted',
    admittedAt: '2026-08-24T08:00:00Z',
    surgeryScheduledAt: null,
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
    otDetailsSaved: false,
    updatedAt: '2026-08-24T08:00:00Z',
    ...overrides,
  };
}

function paidBill() {
  return {
    id: BILL_ID,
    billNumber: 'IPD-2026-00841',
    isFinalized: false,
    payments: [
      {
        id: 'p1',
        receiptNumber: RECEIPT,
        amount: 10000,
        paymentMode: 'cash',
        paymentDate: '2026-08-24T10:00:00Z',
        createdAt: '2026-08-24T10:00:00Z',
      },
    ],
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

async function mockSummary(page: Page, getSummary: () => unknown) {
  await page.route('**/ip-management/journeys/**/financial-summary**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(getSummary()),
    });
  });
}

async function mockQuietJourneyExtras(page: Page) {
  await page.route('**/ip-management/journeys/**/audit**', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
  });
  await page.route('**/ip-management/journeys/**/financial/preauth-status**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ allowed: true, warningLevel: 'none' }),
    });
  });
}

async function openCensusAs(
  page: Page,
  opts: { permissions: string[]; roles: string[] },
) {
  await page.setViewportSize({ width: 1400, height: 900 });
  await loginAsRole(page, 'admin');
  await page.addInitScript(({ permissions, roles }) => {
    localStorage.setItem('permissions', JSON.stringify(permissions));
    localStorage.setItem('roles', JSON.stringify(roles));
  }, opts);
  await page.goto('/dashboard/ip-management', { waitUntil: 'domcontentloaded' });
  await expect(page.getByTestId(IP_CENSUS_TEST_IDS.row(JOURNEY_A))).toBeVisible({ timeout: 20_000 });
  await page.getByTestId(IP_CENSUS_TEST_IDS.row(JOURNEY_A)).click();
  await expect(page.getByTestId(IP_CENSUS_TEST_IDS.rail)).toBeVisible();
}

const CASHIER_PERMS = ['ip.view', 'ip_management.view', 'ip.billing.collect', 'bill.update', 'bill.create'];
const CASHIER_NO_CREATE = ['ip.view', 'ip_management.view', 'ip.billing.collect', 'bill.update'];
const NURSE_PERMS = ['ip.view', 'ip_management.view', 'ward.checklist.edit', 'ip.admit', 'ip.ot.mark_ready'];

const PARTIAL_SUMMARY = {
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

test.describe('FE-004 census collect payment @ip-census', () => {
  test.describe.configure({ timeout: 90_000 });

  test('cashier collects an advance from the rail and sees the receipt', async ({ page }) => {
    const paymentBodies: Record<string, unknown>[] = [];
    await mockCensus(page, () => journeyRow());
    await mockSummary(page, () => PARTIAL_SUMMARY);
    await mockQuietJourneyExtras(page);
    await page.route(/\/opdbills\/payment$/i, async (route) => {
      if (route.request().method() !== 'POST') {
        await route.continue();
        return;
      }
      paymentBodies.push(JSON.parse(route.request().postData() || '{}') as Record<string, unknown>);
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(paidBill()),
      });
    });

    await openCensusAs(page, { permissions: CASHIER_PERMS, roles: ['Cashier'] });
    await expect(page.getByTestId(IP_CENSUS_TEST_IDS.rail)).toHaveAttribute('data-persona', 'cashier');
    await expect(page.getByTestId(IP_CENSUS_TEST_IDS.primaryAction)).toHaveText(/Collect payment/i);
    await page.getByTestId(IP_CENSUS_TEST_IDS.primaryAction).click();
    await expect(page.getByTestId(COLLECT_PAYMENT_TEST_IDS.drawer)).toBeVisible();
    await expect(page.getByTestId(COLLECT_PAYMENT_TEST_IDS.amount)).toHaveValue('10000');
    await page.getByTestId(COLLECT_PAYMENT_TEST_IDS.submit).click();
    await expect(page.getByTestId(COLLECT_PAYMENT_TEST_IDS.receipt)).toHaveText(RECEIPT);
    await expect(page.getByTestId(COLLECT_PAYMENT_TEST_IDS.print)).toBeVisible();
    expect(paymentBodies).toHaveLength(1);
    expect(paymentBodies[0].billId).toBeUndefined();
    expect(paymentBodies[0].opdBillId).toBe(BILL_ID);
    expect(paymentBodies[0].paymentKind).toBe('Advance');
    expect(paymentBodies[0].paymentMode).toBeTruthy();
    expect(Number(paymentBodies[0].amount)).toBe(10000);
    expect(String(paymentBodies[0].idempotencyKey)).toMatch(new RegExp(`^payment:${BILL_ID}:`));
  });

  test('retry after a billing failure reuses the same idempotency key', async ({ page }) => {
    const keys: string[] = [];
    const retryBodies: Record<string, unknown>[] = [];
    let failOnce = true;
    await mockCensus(page, () => journeyRow());
    await mockSummary(page, () => PARTIAL_SUMMARY);
    await mockQuietJourneyExtras(page);
    await page.route(/\/opdbills\/payment$/i, async (route) => {
      if (route.request().method() !== 'POST') {
        await route.continue();
        return;
      }
      const body = JSON.parse(route.request().postData() || '{}') as Record<string, unknown>;
      retryBodies.push(body);
      keys.push(String(body.idempotencyKey ?? ''));
      if (failOnce) {
        failOnce = false;
        await route.fulfill({
          status: 500,
          contentType: 'application/json',
          body: JSON.stringify({ message: 'Payments are temporarily unavailable', error: 'c-77af21' }),
        });
        return;
      }
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(paidBill()),
      });
    });

    await openCensusAs(page, { permissions: CASHIER_PERMS, roles: ['Cashier'] });
    await page.getByTestId(IP_CENSUS_TEST_IDS.primaryAction).click();
    await page.getByTestId(COLLECT_PAYMENT_TEST_IDS.submit).click();
    await expect(page.getByTestId(COLLECT_PAYMENT_TEST_IDS.retry)).toBeVisible();
    await page.getByTestId(COLLECT_PAYMENT_TEST_IDS.retry).click();
    await expect(page.getByTestId(COLLECT_PAYMENT_TEST_IDS.receipt)).toHaveText(RECEIPT);
    expect(keys).toHaveLength(2);
    expect(keys[0]).toBe(keys[1]);
    expect(keys[0]).toMatch(new RegExp(`^payment:${BILL_ID}:`));
    expect(retryBodies[0].opdBillId).toBe(BILL_ID);
    expect(retryBodies[1].opdBillId).toBe(BILL_ID);
    expect(retryBodies[0].paymentKind).toBe('Advance');
    expect(retryBodies[1].paymentKind).toBe('Advance');
    expect(retryBodies[0].billId).toBeUndefined();
    expect(retryBodies[1].billId).toBeUndefined();
  });

  test('create-then-collect when no bill exists', async ({ page }) => {
    let hasBill = false;
    await mockCensus(page, () => journeyRow({
      financialState: 'NotCreated',
      clinicalState: 'Expected',
      totalPaid: 0,
      balanceDue: 0,
      wardName: null,
      bedNumber: null,
      patientName: 'Tara Nair',
      uhid: 'UAT-033',
    }));
    await mockSummary(page, () => (hasBill ? {
      ...PARTIAL_SUMMARY,
      billedAmount: 0,
      patientResponsibility: 0,
      patientBalance: 0,
      totalCollected: 0,
      balanceDue: 0,
    } : {
      billedAmount: 0,
      totalCollected: 0,
      balanceDue: 0,
      packageEstimate: 100000,
      financialStatus: 'not_created',
      isFinalized: false,
    }));
    await mockQuietJourneyExtras(page);
    await page.route(/\/opdbills\/ip-ensure$/i, async (route) => {
      if (route.request().method() !== 'POST') {
        await route.continue();
        return;
      }
      hasBill = true;
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ id: BILL_ID, billNumber: 'IPD-2026-00841', isFinalized: false, payments: [] }),
      });
    });
    await page.route(/\/opdbills\/payment$/i, async (route) => {
      if (route.request().method() !== 'POST') {
        await route.continue();
        return;
      }
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(paidBill()),
      });
    });

    await openCensusAs(page, { permissions: CASHIER_PERMS, roles: ['Cashier'] });
    await expect(page.getByTestId(IP_CENSUS_TEST_IDS.primaryAction)).toHaveText(/Create bill and collect/i);
    await page.getByTestId(IP_CENSUS_TEST_IDS.primaryAction).click();
    await expect(page.getByTestId(COLLECT_PAYMENT_TEST_IDS.create)).toBeVisible();
    await page.getByTestId(COLLECT_PAYMENT_TEST_IDS.create).click();
    await expect(page.getByTestId(COLLECT_PAYMENT_TEST_IDS.amount)).toBeVisible();
    await page.getByTestId(COLLECT_PAYMENT_TEST_IDS.amount).fill('10000');
    await page.getByTestId(COLLECT_PAYMENT_TEST_IDS.submit).click();
    await expect(page.getByTestId(COLLECT_PAYMENT_TEST_IDS.receipt)).toHaveText(RECEIPT);
  });

  test('nurse never sees the collect drawer', async ({ page }) => {
    await mockCensus(page, () => journeyRow());
    await mockSummary(page, () => PARTIAL_SUMMARY);
    await mockQuietJourneyExtras(page);
    await page.route('**/ip-management/journeys/**/transition-gates**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ transition: 'ReadyForSurgery', canProceed: true, requiresOverride: false, warnings: [] }),
      });
    });

    await openCensusAs(page, { permissions: NURSE_PERMS, roles: ['Nurse'] });
    await expect(page.getByTestId(IP_CENSUS_TEST_IDS.rail)).toHaveAttribute('data-persona', 'ward');
    await expect(page.getByTestId(IP_CENSUS_TEST_IDS.primaryAction)).toHaveText(/Mark ready/i);
    await expect(page.getByTestId(COLLECT_PAYMENT_TEST_IDS.drawer)).toHaveCount(0);
    await page.getByTestId(IP_CENSUS_TEST_IDS.primaryAction).click();
    await expect(page.getByTestId(COLLECT_PAYMENT_TEST_IDS.drawer)).toHaveCount(0);
  });

  test('cashier without bill.create does not see create-and-collect', async ({ page }) => {
    await mockCensus(page, () => journeyRow({ financialState: 'NotCreated', totalPaid: 0, balanceDue: 0 }));
    await mockSummary(page, () => ({
      billedAmount: 0,
      totalCollected: 0,
      balanceDue: 0,
      financialStatus: 'not_created',
      isFinalized: false,
    }));
    await mockQuietJourneyExtras(page);

    await openCensusAs(page, { permissions: CASHIER_NO_CREATE, roles: ['Cashier'] });
    await expect(page.getByTestId(IP_CENSUS_TEST_IDS.rail)).toHaveAttribute('data-persona', 'cashier');
    await expect(page.getByTestId(IP_CENSUS_TEST_IDS.primaryAction)).toHaveText(/Open full record/i);
    await expect(page.getByTestId(COLLECT_PAYMENT_TEST_IDS.create)).toHaveCount(0);
    await expect(page.getByTestId(COLLECT_PAYMENT_TEST_IDS.drawer)).toHaveCount(0);
  });
});
