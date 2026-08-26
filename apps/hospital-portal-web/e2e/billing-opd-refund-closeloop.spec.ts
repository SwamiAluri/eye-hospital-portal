/**
 * B4 — refund close-loop on the existing /dashboard/billing/opd workstation.
 * Does not create /dashboard/cashier or a refund queue.
 *
 *   npx playwright test e2e/billing-opd-refund-closeloop.spec.ts --project=chromium
 */
import { test, expect, type Page } from '@playwright/test';
import { loginAsRole } from './helpers/auth';
import { WORKSTATION_TEST_IDS } from '../src/lib/billing/workstation-model';
import { REFUND_TEST_IDS } from '../src/lib/billing/refund-contract';

const BILL_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const REFUND_ID = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const RECEIPT = 'RCP-20260826-00000001';

function bill(paymentsExtra: object[] = []) {
  return {
    id: BILL_ID,
    tenantId: 't1',
    billNumber: 'IPD-2026-00841',
    patientId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
    patientName: 'Meena Iyer',
    patientMrn: 'UAT-002',
    appointmentId: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
    branchId: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
    billDate: '2026-08-26T09:00:00Z',
    createdAt: '2026-08-26T09:00:00Z',
    consultationFee: 0,
    registrationFee: 0,
    additionalCharges: 0,
    grossAmount: 100000,
    discountPercentage: 0,
    discountAmount: 0,
    taxAmount: 0,
    netAmount: 100000,
    amountPaid: paymentsExtra.length ? 29000 : 30000,
    balanceDue: paymentsExtra.length ? 71000 : 70000,
    status: 'partial',
    isFreeVisit: false,
    isCredit: false,
    isInsurance: false,
    insuranceClaimAmount: 0,
    generatedBy: 'e2e',
    isFinalized: false,
    payments: [
      {
        id: 'pay-1',
        opdBillId: BILL_ID,
        paymentReference: 'PAY-1',
        receiptNumber: RECEIPT,
        amount: 30000,
        paymentMode: 'cash',
        paymentKind: 'Payment',
        paymentDate: '2026-08-26T10:00:00Z',
        createdAt: '2026-08-26T10:00:00Z',
        status: 'completed',
      },
      ...paymentsExtra,
    ],
  };
}

async function mockDesk(page: Page, state: {
  refunds: Array<Record<string, unknown>>;
  completed: boolean;
}) {
  await page.route('**/master-values/**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        items: [
          { code: 'CASH', label: 'Cash' },
          { code: 'UPI', label: 'UPI' },
        ],
      }),
    });
  });
  await page.route('**/chargereconciliation/completeness**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        implantsRecorded: 0,
        implantsCharged: 0,
        implantsMissingCharge: 0,
        consumablesPending: 0,
        warnings: [],
      }),
    });
  });
  await page.route('**/opdbills**', async (route) => {
    const req = route.request();
    const url = new URL(req.url());
    const path = url.pathname.replace(/\/$/, '');
    if (req.method() === 'GET' && path.toLowerCase().includes(BILL_ID.toLowerCase())) {
      const extra = state.completed
        ? [{
            id: 'pay-refund',
            opdBillId: BILL_ID,
            paymentReference: `REF-${REFUND_ID.replace(/-/g, '')}`,
            receiptNumber: 'RCP-REF-1',
            amount: 1000,
            paymentMode: 'cash',
            paymentKind: 'Refund',
            paymentDate: '2026-08-26T12:00:00Z',
            createdAt: '2026-08-26T12:00:00Z',
            status: 'completed',
          }]
        : [];
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(bill(extra)),
      });
      return;
    }
    if (req.method() === 'GET' && /\/opdbills$/i.test(path)) {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ bills: [bill()], total: 1 }),
      });
      return;
    }
    await route.continue();
  });
  await page.route(`**/opdbills/${BILL_ID}`, async (route) => {
    if (route.request().method() !== 'GET') {
      await route.continue();
      return;
    }
    const extra = state.completed
      ? [{
          id: 'pay-refund',
          opdBillId: BILL_ID,
          paymentReference: `REF-${REFUND_ID.replace(/-/g, '')}`,
          receiptNumber: 'RCP-REF-1',
          amount: 1000,
          paymentMode: 'cash',
          paymentKind: 'Refund',
          paymentDate: '2026-08-26T12:00:00Z',
          createdAt: '2026-08-26T12:00:00Z',
          status: 'completed',
        }]
      : [];
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(bill(extra)),
    });
  });
  await page.route('**/billitems/bill/**', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
  });
  await page.route(/\/refunds\/bill\//i, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(state.refunds),
    });
  });
  await page.route('**/appointments**', async (route) => {
    if (route.request().method() !== 'GET') {
      await route.fallback();
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ items: [] }),
    });
  });
  await page.route('**/patients/suggest**', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
  });
}

test.describe('B4 OPD refund close-loop', () => {
  test.describe.configure({ timeout: 90_000 });

  test('request then authorize then complete posts Refund ledger line on the workstation', async ({ page }) => {
    const posts: { url: string; body: Record<string, unknown> }[] = [];
    const state = {
      refunds: [] as Array<Record<string, unknown>>,
      completed: false,
    };

    await page.setViewportSize({ width: 1400, height: 900 });
    await mockDesk(page, state);
    await loginAsRole(page, 'admin');

    await page.route(/\/refunds\/request$/i, async (route) => {
      if (route.request().method() !== 'POST') {
        await route.fallback();
        return;
      }
      const body = route.request().postDataJSON() as Record<string, unknown>;
      posts.push({ url: route.request().url(), body });
      state.refunds = [{
        id: REFUND_ID,
        billId: BILL_ID,
        refundAmount: 1000,
        refundReason: 'Duplicate cash collection',
        refundMode: 'cash',
        status: 'pending',
        requestedAt: '2026-08-26T11:00:00Z',
      }];
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(state.refunds[0]),
      });
    });
    await page.route(new RegExp(`/refunds/${REFUND_ID}/authorize$`, 'i'), async (route) => {
      if (route.request().method() !== 'POST') {
        await route.fallback();
        return;
      }
      const body = route.request().postDataJSON() as Record<string, unknown>;
      posts.push({ url: route.request().url(), body });
      state.refunds = [{ ...state.refunds[0], status: 'approved' }];
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(state.refunds[0]),
      });
    });
    await page.route(new RegExp(`/refunds/${REFUND_ID}/complete$`, 'i'), async (route) => {
      if (route.request().method() !== 'POST') {
        await route.fallback();
        return;
      }
      const body = route.request().postDataJSON() as Record<string, unknown>;
      posts.push({ url: route.request().url(), body });
      state.completed = true;
      state.refunds = [{ ...state.refunds[0], status: 'completed' }];
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(state.refunds[0]),
      });
    });

    await page.goto(`/dashboard/billing/opd?billId=${BILL_ID}`, { waitUntil: 'domcontentloaded' });
    const desk = page.getByTestId(WORKSTATION_TEST_IDS.root);
    await expect(desk).toBeVisible({ timeout: 20_000 });
    await expect(page.getByTestId(REFUND_TEST_IDS.section)).toBeVisible();

    await desk.getByTestId(REFUND_TEST_IDS.trigger).click();
    await expect(page.getByTestId(REFUND_TEST_IDS.dialog)).toBeVisible();
    await page.getByTestId(REFUND_TEST_IDS.amount).fill('1000');
    await page.getByTestId(REFUND_TEST_IDS.reason).fill('Duplicate cash collection');
    await page.getByTestId(REFUND_TEST_IDS.submit).click();

    await expect.poll(() => posts.length).toBe(1);
    expect(posts[0].url).toMatch(/\/refunds\/request$/i);
    expect(posts[0].body.opdBillId).toBe(BILL_ID);
    expect(posts[0].body.billId).toBeUndefined();

    await expect(desk.getByTestId(REFUND_TEST_IDS.authorize)).toBeVisible({ timeout: 20_000 });
    await desk.getByTestId(REFUND_TEST_IDS.authorize).click();
    await expect(page.getByTestId(REFUND_TEST_IDS.actionDialog)).toBeVisible();
    await page.getByTestId(REFUND_TEST_IDS.actionSubmit).click();

    await expect.poll(() => posts.length).toBe(2);
    expect(posts[1].url).toMatch(new RegExp(`/refunds/${REFUND_ID}/authorize$`, 'i'));
    expect(posts[1].body.approved).toBe(true);

    await expect(desk.getByTestId(REFUND_TEST_IDS.complete)).toBeVisible({ timeout: 20_000 });
    await desk.getByTestId(REFUND_TEST_IDS.complete).click();
    await page.getByTestId(REFUND_TEST_IDS.actionSubmit).click();

    await expect.poll(() => posts.length).toBe(3);
    expect(posts[2].url).toMatch(new RegExp(`/refunds/${REFUND_ID}/complete$`, 'i'));
    expect(posts[2].body.refundMode).toBeTruthy();
    expect(posts[2].body.paymentReference).toBeUndefined();

    await expect(desk.getByTestId(WORKSTATION_TEST_IDS.payments)).toContainText('Refund');
    await expect(desk.getByTestId(WORKSTATION_TEST_IDS.payments)).toContainText('RCP-REF-1');
  });
});
