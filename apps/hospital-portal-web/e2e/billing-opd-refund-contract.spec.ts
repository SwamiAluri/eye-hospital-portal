/**
 * B3R — pending-tab refund dialog posts Auth-compatible request body.
 * B4 close-loop (authorize/complete) is covered in billing-opd-refund-closeloop.spec.ts.
 *
 *   npx playwright test e2e/billing-opd-refund-contract.spec.ts --project=chromium
 */
import { test, expect, type Page } from '@playwright/test';
import { loginAsRole } from './helpers/auth';
import { REFUND_TEST_IDS } from '../src/lib/billing/refund-contract';

const BILL_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';

function finalizedPaidBill() {
  return {
    id: BILL_ID,
    tenantId: 't1',
    billNumber: 'OPD-2026-REF1',
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
    amountPaid: 10000,
    balanceDue: 0,
    status: 'paid',
    isFreeVisit: false,
    isCredit: false,
    isInsurance: false,
    insuranceClaimAmount: 0,
    generatedBy: 'e2e',
    isFinalized: true,
    payments: [],
  };
}

async function mockDesk(page: Page) {
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
  await page.route('**/opdbills**', async (route) => {
    const req = route.request();
    if (req.method() !== 'GET') {
      await route.continue();
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ bills: [finalizedPaidBill()], total: 1 }),
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
  await page.route('**/patients/suggest**', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
  });
}

test.describe('B3R OPD refund request contract', () => {
  test.describe.configure({ timeout: 90_000 });

  test('existing Refund dialog posts opdBillId aliases and not billId', async ({ page }) => {
    const posts: Record<string, unknown>[] = [];
    await page.setViewportSize({ width: 1400, height: 900 });
    await loginAsRole(page, 'admin');
    await mockDesk(page);
    await page.route(/\/refunds\/request$/i, async (route) => {
      if (route.request().method() !== 'POST') {
        await route.fallback();
        return;
      }
      posts.push(route.request().postDataJSON() as Record<string, unknown>);
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          id: 'refund-1',
          billId: BILL_ID,
          refundAmount: 10000,
          status: 'pending',
        }),
      });
    });

    await page.goto('/dashboard/billing/opd', { waitUntil: 'domcontentloaded' });
    await expect(page.getByText(/Pending \(/)).toBeVisible({ timeout: 20_000 });
    await page.getByText(/Pending \(/).first().click();
    await expect(page.getByTestId(REFUND_TEST_IDS.trigger)).toBeVisible({ timeout: 20_000 });
    await page.getByTestId(REFUND_TEST_IDS.trigger).click();
    await expect(page.getByTestId(REFUND_TEST_IDS.dialog)).toBeVisible();
    await page.getByTestId(REFUND_TEST_IDS.reason).fill('Duplicate cash collection');
    await page.getByTestId(REFUND_TEST_IDS.submit).click();
    await expect.poll(() => posts.length).toBe(1);
    expect(posts[0].opdBillId).toBe(BILL_ID);
    expect(posts[0].billId).toBeUndefined();
    expect(posts[0].refundAmount).toBe(10000);
    expect(posts[0].refundReason).toBe('Duplicate cash collection');
    expect(posts[0].amount).toBeUndefined();
    expect(typeof posts[0].refundMode).toBe('string');
  });
});
