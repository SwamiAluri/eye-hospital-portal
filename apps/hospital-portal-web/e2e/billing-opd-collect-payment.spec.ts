/**
 * B1 — canonical /dashboard/billing/opd collect uses CollectPaymentDrawer
 * with opdBillId + a reused idempotency key.
 *
 *   npx playwright test e2e/billing-opd-collect-payment.spec.ts --project=chromium
 */
import { test, expect, type Page } from '@playwright/test';
import { loginAsRole } from './helpers/auth';
import { COLLECT_PAYMENT_TEST_IDS } from '../src/lib/ip-management/collect-payment';

const BILL_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const RECEIPT = 'RCP-20260826-00000001';

function pendingBill() {
  return {
    id: BILL_ID,
    tenantId: 't1',
    billNumber: 'OPD-2026-0001',
    patientId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
    patientName: 'Meena Iyer',
    appointmentId: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
    branchId: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
    billDate: '2026-08-26T09:00:00Z',
    createdAt: '2026-08-26T09:00:00Z',
    consultationFee: 10000,
    registrationFee: 0,
    additionalCharges: 0,
    grossAmount: 10000,
    discountPercentage: 0,
    discountAmount: 0,
    taxAmount: 0,
    netAmount: 10000,
    amountPaid: 0,
    balanceDue: 10000,
    status: 'pending',
    isFreeVisit: false,
    isCredit: false,
    isInsurance: false,
    insuranceClaimAmount: 0,
    generatedBy: 'e2e',
    isFinalized: false,
    payments: [],
  };
}

function paidBill() {
  return {
    ...pendingBill(),
    amountPaid: 10000,
    balanceDue: 0,
    status: 'paid',
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

async function mockBillingDesk(page: Page) {
  await page.route('**/master-values/**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ items: [
        { code: 'CASH', label: 'Cash' },
        { code: 'UPI', label: 'UPI' },
        { code: 'CARD', label: 'Card' },
      ] }),
    });
  });
  await page.route('**/opdbills**', async (route) => {
    const req = route.request();
    const url = new URL(req.url());
    const path = url.pathname.replace(/\/$/, '');
    if (req.method() === 'POST' && /\/opdbills\/payment$/i.test(path)) {
      await route.continue();
      return;
    }
    if (req.method() === 'GET' && path.toLowerCase().includes(BILL_ID)) {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(pendingBill()),
      });
      return;
    }
    if (req.method() === 'GET' && /\/opdbills$/i.test(path)) {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ bills: [pendingBill()], total: 1 }),
      });
      return;
    }
    await route.continue();
  });
  await page.route('**/billitems/bill/**', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
  });
  await page.route('**/chargereconciliation/completeness**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ implantsRecorded: 0, implantsCharged: 0, implantsMissingCharge: 0, consumablesPending: 0, warnings: [] }),
    });
  });
  await page.route('**/appointments**', async (route) => {
    if (route.request().method() !== 'GET') {
      await route.continue();
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ items: [] }),
    });
  });
}

test.describe('B1 OPD billing collect', () => {
  test.describe.configure({ timeout: 90_000 });
  test('posts opdBillId + idempotencyKey and reuses the key on retry', async ({ page }) => {
    const keys: string[] = [];
    const pageErrors: string[] = [];
    page.on('pageerror', (err) => pageErrors.push(err.stack || err.message));

    await page.setViewportSize({ width: 1400, height: 900 });
    await loginAsRole(page, 'admin');
    await mockBillingDesk(page);
    await page.route(`**/${BILL_ID}`, async (route) => {
      if (route.request().method() === 'GET') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(pendingBill()),
        });
        return;
      }
      await route.continue();
    });
    await page.route(/\/opdbills\/payment$/i, async (route) => {
      if (route.request().method() !== 'POST') {
        await route.continue();
        return;
      }
      const body = route.request().postDataJSON() as {
        opdBillId?: string;
        billId?: string;
        idempotencyKey?: string;
        paymentKind?: string;
        paymentMode?: string;
        amount?: number;
      };
      expect(body.opdBillId).toBe(BILL_ID);
      expect(body.billId).toBeUndefined();
      expect(body.paymentKind).toBe('Payment');
      expect(body.paymentMode).toBeTruthy();
      expect(body.amount).toBeGreaterThan(0);
      expect(body.idempotencyKey).toMatch(new RegExp(`^payment:${BILL_ID}:`));
      keys.push(body.idempotencyKey ?? '');
      if (keys.length === 1) {
        await route.fulfill({
          status: 503,
          contentType: 'application/json',
          body: JSON.stringify({ message: 'temporarily unavailable' }),
        });
        return;
      }
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(paidBill()),
      });
    });

    await page.goto(`/dashboard/billing/opd?billId=${BILL_ID}`, { waitUntil: 'domcontentloaded' });
    const collectBtn = page.getByTestId('billing-opd-collect').first();
    if (!(await collectBtn.isVisible().catch(() => false))) {
      await page.getByRole('button', { name: /Pending/i }).click();
    }
    try {
      await expect(collectBtn).toBeVisible({ timeout: 20_000 });
    } catch (err) {
      throw new Error(`Collect button missing. pageErrors:\n${pageErrors.join('\n\n')}\n\n${err}`);
    }
    await page.getByTestId('billing-opd-collect').first().click();
    await expect(page.getByTestId(COLLECT_PAYMENT_TEST_IDS.drawer)).toBeVisible();
    await page.getByTestId(COLLECT_PAYMENT_TEST_IDS.submit).click();
    await expect(page.getByTestId(COLLECT_PAYMENT_TEST_IDS.retry)).toBeVisible();
    await page.getByTestId(COLLECT_PAYMENT_TEST_IDS.retry).click();
    await expect(page.getByTestId(COLLECT_PAYMENT_TEST_IDS.receipt)).toHaveText(RECEIPT);
    expect(keys).toHaveLength(2);
    expect(keys[0]).toBe(keys[1]);
  });

  test('IP copay collect shows patient obligation, not TPA-inclusive ledger due', async ({ page }) => {
    const copayBillId = '6338e671-2358-4d00-9f91-5dd7f400f1bb';
    const journeyId = '984f4f33-5fdd-4e18-9c09-cc55dacffc9d';
    const copayBill = {
      ...pendingBill(),
      id: copayBillId,
      billNumber: 'IP-2026-B18EB36E',
      patientJourneyId: journeyId,
      netAmount: 105000,
      grossAmount: 105000,
      amountPaid: 0,
      balanceDue: 105000,
      isInsurance: true,
      insuranceClaimAmount: 90000,
    };

    await page.setViewportSize({ width: 1400, height: 900 });
    await loginAsRole(page, 'admin');
    await mockBillingDesk(page);
    await page.route(`**/ip-management/journeys/${journeyId}/financial-summary**`, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          opdBillId: copayBillId,
          billedAmount: 105000,
          totalCollected: 0,
          balanceDue: 105000,
          insuranceResponsibility: 90000,
          patientResponsibility: 15000,
          patientBalance: 15000,
          ccmsPatientShare: 15000,
          ccmsPatientShareAvailable: true,
          financialStatus: 'Unpaid',
        }),
      });
    });
    await page.route('**/opdbills**', async (route) => {
      const req = route.request();
      const url = new URL(req.url());
      const path = url.pathname.replace(/\/$/, '');
      if (req.method() === 'GET' && path.toLowerCase().includes(copayBillId)) {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(copayBill),
        });
        return;
      }
      if (req.method() === 'GET' && /\/opdbills$/i.test(path)) {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ bills: [copayBill], total: 1 }),
        });
        return;
      }
      await route.continue();
    });
    await page.route(`**/${copayBillId}`, async (route) => {
      if (route.request().method() === 'GET') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(copayBill),
        });
        return;
      }
      await route.continue();
    });

    await page.goto(`/dashboard/billing/opd?billId=${copayBillId}`, { waitUntil: 'domcontentloaded' });
    const collectBtn = page.getByTestId('billing-opd-collect').first();
    if (!(await collectBtn.isVisible().catch(() => false))) {
      await page.getByRole('button', { name: /Pending/i }).click();
    }
    await expect(collectBtn).toBeVisible({ timeout: 20_000 });
    await collectBtn.click();
    await expect(page.getByTestId(COLLECT_PAYMENT_TEST_IDS.drawer)).toBeVisible();
    await expect(page.getByTestId(COLLECT_PAYMENT_TEST_IDS.patientDue)).toHaveText(/₹15,000/);
    await expect(page.getByTestId(COLLECT_PAYMENT_TEST_IDS.amount)).toHaveValue('15000');

    await page.getByTestId(COLLECT_PAYMENT_TEST_IDS.amount).fill('15001');
    await expect(page.getByTestId(COLLECT_PAYMENT_TEST_IDS.overDue)).toContainText('₹15,000');
    await expect(page.getByTestId(COLLECT_PAYMENT_TEST_IDS.submit)).toBeDisabled();

    await page.getByTestId(COLLECT_PAYMENT_TEST_IDS.amount).fill('105000');
    await expect(page.getByTestId(COLLECT_PAYMENT_TEST_IDS.overDue)).toBeVisible();
    await expect(page.getByTestId(COLLECT_PAYMENT_TEST_IDS.submit)).toBeDisabled();

    await page.getByTestId(COLLECT_PAYMENT_TEST_IDS.amount).fill('15000');
    await expect(page.getByTestId(COLLECT_PAYMENT_TEST_IDS.overDue)).toHaveCount(0);
    await expect(page.getByTestId(COLLECT_PAYMENT_TEST_IDS.submit)).toBeEnabled();
  });
});
