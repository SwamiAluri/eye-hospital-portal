/**
 * B2 — IP Billing workstation on /dashboard/billing/opd (S-12).
 *
 *   npx playwright test e2e/billing-opd-workstation.spec.ts --project=chromium
 */
import { test, expect, type Page } from '@playwright/test';
import { loginAsRole, apiLogin, seedBrowserAuthWithPermissions } from './helpers/auth';
import { COLLECT_PAYMENT_TEST_IDS } from '../src/lib/ip-management/collect-payment';
import { WORKSTATION_TEST_IDS } from '../src/lib/billing/workstation-model';
import { ADD_ITEM_TEST_IDS, DISCOUNT_TEST_IDS } from '../src/lib/billing/workstation-mutations';

const BILL_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const JOURNEY_ID = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee';
const RECEIPT = 'RCP-20260826-00000001';

function workstationBill() {
  return {
    id: BILL_ID,
    tenantId: 't1',
    billNumber: 'IPD-2026-00841',
    patientId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
    patientName: 'Meena Iyer',
    patientMrn: 'UAT-002',
    patientJourneyId: JOURNEY_ID,
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
    amountPaid: 30000,
    balanceDue: 70000,
    status: 'partial',
    isFreeVisit: false,
    isCredit: false,
    isInsurance: true,
    insuranceProvider: 'Star Health',
    insuranceClaimAmount: 0,
    generatedBy: 'e2e',
    isFinalized: false,
    payments: [
      {
        id: 'pay-adv',
        opdBillId: BILL_ID,
        paymentReference: 'REF-ADV',
        receiptNumber: RECEIPT,
        amount: 20000,
        paymentMode: 'cash',
        paymentKind: 'Advance',
        paymentDate: '2026-08-26T10:00:00Z',
        createdAt: '2026-08-26T10:00:00Z',
        status: 'completed',
      },
      {
        id: 'pay-pay',
        opdBillId: BILL_ID,
        paymentReference: 'REF-PAY',
        receiptNumber: 'RCP-20260826-00000002',
        amount: 10000,
        paymentMode: 'upi',
        paymentKind: 'Payment',
        paymentDate: '2026-08-26T11:00:00Z',
        createdAt: '2026-08-26T11:00:00Z',
        status: 'completed',
      },
    ],
  };
}

function journeyDetail() {
  return {
    id: JOURNEY_ID,
    patientId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
    uhid: 'UAT-002',
    patientName: 'Meena Iyer',
    patientAge: 58,
    patientGender: 'F',
    procedureName: 'Phaco + IOL',
    eyeOperated: 'OD',
    surgeonName: 'Dr Rao',
    admittedAt: '2026-08-26T07:00:00Z',
    paymentMode: 'Insurance',
    packageAmount: 100000,
    financialState: 'PartiallyPaid',
    clinicalState: 'Admitted',
    otState: 'NotSent',
    postOpState: 'NotStarted',
    totalPaid: 20000,
    balanceDue: 80000,
    wardName: 'Day Care',
    bedNumber: 'B-04',
    isLocked: false,
    isBillingLocked: false,
    admissionType: 'DayCare',
    isEmergencyFc: false,
    otDetailsSaved: false,
    counselingSessionId: null,
  };
}

async function mockWorkstation(page: Page) {
  await page.route('**/master-values/**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        items: [
          { code: 'CASH', label: 'Cash' },
          { code: 'UPI', label: 'UPI' },
          { code: 'CARD', label: 'Card' },
        ],
      }),
    });
  });
  await page.route('**/chargereconciliation/completeness**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        implantsRecorded: 1,
        implantsCharged: 0,
        implantsMissingCharge: 1,
        consumablesPending: 1,
        warnings: ['1 consumable is unmapped and not charged'],
      }),
    });
  });
  await page.route(`**/ip-management/journeys/${JOURNEY_ID}/financial-summary**`, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        opdBillId: BILL_ID,
        billedAmount: 100000,
        totalCollected: 20000,
        balanceDue: 80000,
        packageEstimate: 100000,
        advances: 20000,
        financialStatus: 'PartiallyPaid',
        insuranceResponsibility: 80000,
        patientResponsibility: 20000,
      }),
    });
  });
  await page.route(`**/ip-management/journeys/${JOURNEY_ID}`, async (route) => {
    if (route.request().url().includes('financial-summary')) {
      await route.fallback();
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(journeyDetail()),
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
        body: JSON.stringify(workstationBill()),
      });
      return;
    }
    if (req.method() === 'GET' && /\/opdbills$/i.test(path)) {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ bills: [workstationBill()], total: 1 }),
      });
      return;
    }
    await route.continue();
  });
  await page.route(`**/${BILL_ID}`, async (route) => {
    if (route.request().method() === 'GET') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(workstationBill()),
      });
      return;
    }
    await route.continue();
  });
  await page.route('**/billitems/bill/**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([
        {
          id: 'line-1',
          opdBillId: BILL_ID,
          quantity: 1,
          unitPrice: 62000,
          subtotal: 62000,
          discountAmount: 0,
          discountPercentage: 0,
          taxAmount: 0,
          taxPercentage: 0,
          totalAmount: 62000,
          status: 'posted',
          serviceCode: 'PHACO',
          serviceName: 'Phaco surgery',
          sourceType: 'Package',
        },
        {
          id: 'line-2',
          opdBillId: BILL_ID,
          quantity: 1,
          unitPrice: 14000,
          subtotal: 14000,
          discountAmount: 0,
          discountPercentage: 0,
          taxAmount: 0,
          taxPercentage: 0,
          totalAmount: 14000,
          status: 'posted',
          serviceCode: 'IOL',
          serviceName: 'Alcon SN60WF',
          sourceType: 'Implant',
        },
      ]),
    });
  });
  await page.route(/\/refunds\/bill\//i, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: '[]',
    });
  });
  await page.route('**/servicecatalog/full**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        categories: [
          {
            id: 'cat-ot',
            code: 'OT',
            name: 'OT extras',
            displayOrder: 1,
            isActive: true,
            services: [
              {
                id: 'svc-ctr',
                code: 'CTR',
                name: 'Capsule support',
                isActive: true,
                variants: [
                  {
                    id: 'variant-ctr',
                    code: 'CTR-01',
                    name: 'Capsular tension ring',
                    price: 3200,
                    priceType: 'FIXED',
                    hasIolOptions: false,
                    displayOrder: 1,
                    isActive: true,
                  },
                ],
              },
            ],
          },
        ],
      }),
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

test.describe('B2 IP billing workstation', () => {
  test.describe.configure({ timeout: 90_000 });

  test('opens the S-12 workbench from billId and keeps the B1 collect contract', async ({ page }) => {
    const keys: string[] = [];
    await page.setViewportSize({ width: 1400, height: 900 });
    await loginAsRole(page, 'admin');
    await mockWorkstation(page);
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
      };
      expect(body.opdBillId).toBe(BILL_ID);
      expect(body.billId).toBeUndefined();
      expect(body.paymentKind).toBe('Payment');
      expect(body.idempotencyKey).toMatch(new RegExp(`^payment:${BILL_ID}:`));
      keys.push(body.idempotencyKey ?? '');
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          ...workstationBill(),
          amountPaid: 100000,
          balanceDue: 0,
          status: 'paid',
        }),
      });
    });

    await page.goto(`/dashboard/billing/opd?billId=${BILL_ID}&journeyId=${JOURNEY_ID}`, {
      waitUntil: 'domcontentloaded',
    });

    await expect(page.getByTestId(WORKSTATION_TEST_IDS.root)).toBeVisible({ timeout: 20_000 });
    await expect(page.getByTestId(WORKSTATION_TEST_IDS.context)).toContainText('Meena Iyer');
    await expect(page.getByTestId(WORKSTATION_TEST_IDS.context)).toContainText('UAT-002');
    await expect(page.getByTestId(WORKSTATION_TEST_IDS.summary)).toBeVisible();
    await expect(page.getByTestId('ip-billing-charges')).toContainText('1,00,000');
    await expect(page.getByTestId('ip-billing-advance')).toContainText('20,000');
    await expect(page.getByTestId('ip-billing-paid')).toContainText('30,000');
    await expect(page.getByTestId('ip-billing-due')).toContainText('70,000');
    await expect(page.getByTestId(WORKSTATION_TEST_IDS.charges)).toContainText('Phaco surgery');
    await expect(page.getByTestId(WORKSTATION_TEST_IDS.charges)).toContainText('Alcon SN60WF');
    await expect(page.getByTestId(WORKSTATION_TEST_IDS.charges)).toContainText('Extra');
    await expect(page.getByTestId(WORKSTATION_TEST_IDS.charges)).toContainText('Package');
    await expect(page.getByTestId(WORKSTATION_TEST_IDS.payments)).toContainText(RECEIPT);
    await expect(page.getByTestId(WORKSTATION_TEST_IDS.payments)).toContainText('Advance');
    await expect(page.getByTestId(WORKSTATION_TEST_IDS.payments)).toContainText('Payment');
    await expect(page.getByTestId(WORKSTATION_TEST_IDS.payments)).toContainText('RCP-20260826-00000002');
    await expect(page.getByTestId(WORKSTATION_TEST_IDS.nextAction)).toContainText('Collect payment');
    await expect(page.getByTestId(WORKSTATION_TEST_IDS.payerShare)).toContainText('80,000');
    await expect(page.getByTestId(WORKSTATION_TEST_IDS.patientShare)).toContainText('20,000');
    await expect(page.getByTestId(WORKSTATION_TEST_IDS.completeness)).toContainText('Charge mapping');
    await expect(page.getByTestId(ADD_ITEM_TEST_IDS.trigger)).toBeVisible();
    await expect(page.getByTestId(DISCOUNT_TEST_IDS.trigger)).toBeVisible();
    await expect(page.getByRole('heading', { name: 'IP Billing' })).toBeVisible();
    await expect(page.getByTestId(WORKSTATION_TEST_IDS.search)).toBeVisible();

    await page.getByTestId('billing-opd-collect').first().click();
    await expect(page.getByTestId(COLLECT_PAYMENT_TEST_IDS.drawer)).toBeVisible();
    await page.getByTestId(COLLECT_PAYMENT_TEST_IDS.submit).click();
    expect(keys).toHaveLength(1);
  });

  test('switching bills clears the previous patient before the next bill loads', async ({ page }) => {
    const BILL_B = '99999999-9999-4999-8999-999999999999';
    const JOURNEY_B = 'ffffffff-ffff-4fff-8fff-ffffffffffff';
    let releaseB: (() => void) | undefined;
    const holdB = new Promise<void>((resolve) => { releaseB = resolve; });

    await page.setViewportSize({ width: 1440, height: 900 });
    await loginAsRole(page, 'admin');
    await mockWorkstation(page);
    await page.route(`**/opdbills/${BILL_B}`, async (route) => {
      if (route.request().method() !== 'GET') {
        await route.fallback();
        return;
      }
      await holdB;
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          ...workstationBill(),
          id: BILL_B,
          billNumber: 'IPD-2026-00999',
          patientName: 'Ravi Kumar',
          patientMrn: 'UAT-099',
          patientJourneyId: JOURNEY_B,
          netAmount: 50000,
          amountPaid: 0,
          balanceDue: 50000,
          payments: [],
        }),
      });
    });
    await page.route(`**/ip-management/journeys/${JOURNEY_B}**`, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          ...journeyDetail(),
          id: JOURNEY_B,
          patientName: 'Ravi Kumar',
          uhid: 'UAT-099',
          procedureName: 'Vitrectomy',
        }),
      });
    });

    await page.goto(`/dashboard/billing/opd?billId=${BILL_ID}`, { waitUntil: 'domcontentloaded' });
    await expect(page.getByTestId(WORKSTATION_TEST_IDS.context)).toContainText('Meena Iyer');
    await expect(page.getByTestId(WORKSTATION_TEST_IDS.context)).toContainText('UAT-002');

    const navigation = page.goto(`/dashboard/billing/opd?billId=${BILL_B}`, { waitUntil: 'domcontentloaded' });
    await expect(page.getByTestId(WORKSTATION_TEST_IDS.context)).toHaveCount(0);
    await expect(page.getByText(/Opening the bill you selected/)).toBeVisible();
    releaseB?.();
    await navigation;
    await expect(page.getByTestId(WORKSTATION_TEST_IDS.root)).toBeVisible({ timeout: 20_000 });
    await expect(page.getByTestId(WORKSTATION_TEST_IDS.context)).toContainText('Ravi Kumar');
    await expect(page.getByTestId(WORKSTATION_TEST_IDS.context)).toContainText('UAT-099');
    await expect(page.getByTestId(WORKSTATION_TEST_IDS.context)).not.toContainText('Meena Iyer');
    await expect(page.getByTestId(WORKSTATION_TEST_IDS.context)).not.toContainText('UAT-002');
    await expect(page.getByTestId('ip-billing-due')).toContainText('50,000');

    await page.goto(`/dashboard/billing/opd?billId=${BILL_ID}`, { waitUntil: 'domcontentloaded' });
    await expect(page.getByTestId(WORKSTATION_TEST_IDS.context)).toContainText('Meena Iyer');
    await expect(page.getByTestId(WORKSTATION_TEST_IDS.context)).not.toContainText('Ravi Kumar');
  });

  test('browse and search do not POST financial or clinical mutations', async ({ page }) => {
    const mutations: string[] = [];
    await page.setViewportSize({ width: 1280, height: 800 });
    await loginAsRole(page, 'admin');
    await mockWorkstation(page);
    await page.route('**/patients/suggest**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([
          {
            id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
            firstName: 'Meena',
            lastName: 'Iyer',
            mrn: 'UAT-002',
            dateOfBirth: '1968-01-01',
            gender: 'F',
          },
        ]),
      });
    });
    page.on('request', (req) => {
      const method = req.method();
      if (method === 'GET' || method === 'HEAD' || method === 'OPTIONS') return;
      const url = req.url();
      if (/opdbills|ip-management|ccms|chargereconciliation|billitems/i.test(url)) {
        mutations.push(`${method} ${url}`);
      }
    });

    await page.goto('/dashboard/billing/opd', { waitUntil: 'domcontentloaded' });
    await expect(page.getByTestId(WORKSTATION_TEST_IDS.empty)).toBeVisible({ timeout: 20_000 });
    await expect(page.getByRole('heading', { name: 'IP Billing' })).toBeVisible();

    const search = page.getByTestId(WORKSTATION_TEST_IDS.search).locator('input');
    await search.fill('Meena');
    await expect(page.getByText('Meena Iyer').first()).toBeVisible({ timeout: 10_000 });
    await page.getByText('Meena Iyer').first().click();
    await expect(page.getByTestId(WORKSTATION_TEST_IDS.root)).toBeVisible({ timeout: 20_000 });
    expect(mutations.filter((m) => /payment|refund|credit|transition|admit|discharge/i.test(m))).toEqual([]);
  });

  test('empty search results do not fabricate a patient or bill', async ({ page }) => {
    await page.setViewportSize({ width: 1024, height: 768 });
    await loginAsRole(page, 'admin');
    await mockWorkstation(page);
    await page.route('**/patients/suggest**', async (route) => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
    });
    await page.goto('/dashboard/billing/opd', { waitUntil: 'domcontentloaded' });
    await expect(page.getByTestId(WORKSTATION_TEST_IDS.empty)).toBeVisible();
    await page.getByTestId(WORKSTATION_TEST_IDS.search).locator('input').fill('Zzznobody');
    await expect(page.getByTestId(WORKSTATION_TEST_IDS.root)).toHaveCount(0);
    await expect(page.getByTestId(WORKSTATION_TEST_IDS.empty)).toBeVisible();
  });

  test('failed bill fetch is an error, not another patient\'s totals', async ({ page }) => {
    await loginAsRole(page, 'admin');
    await mockWorkstation(page);
    await page.route(`**/${BILL_ID}`, async (route) => {
      if (route.request().method() === 'GET') {
        await route.fulfill({
          status: 404,
          contentType: 'application/json',
          body: JSON.stringify({ message: 'not found' }),
        });
        return;
      }
      await route.continue();
    });
    await page.goto(`/dashboard/billing/opd?billId=${BILL_ID}`, { waitUntil: 'domcontentloaded' });
    await expect(page.getByText(/couldn't open that bill/i)).toBeVisible({ timeout: 20_000 });
    await expect(page.getByTestId(WORKSTATION_TEST_IDS.root)).toHaveCount(0);
  });

  test('paid bill offers finalize and view-only clerks do not see Collect', async ({ page }) => {
    const login = await apiLogin(page.request);
    await seedBrowserAuthWithPermissions(page, login, ['bill.view']);
    await mockWorkstation(page);
    await page.route(`**/${BILL_ID}`, async (route) => {
      if (route.request().method() === 'GET') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            ...workstationBill(),
            amountPaid: 100000,
            balanceDue: 0,
            status: 'paid',
          }),
        });
        return;
      }
      await route.continue();
    });
    await page.goto(`/dashboard/billing/opd?billId=${BILL_ID}`, { waitUntil: 'domcontentloaded' });
    await expect(page.getByTestId(WORKSTATION_TEST_IDS.root)).toBeVisible({ timeout: 20_000 });
    await expect(page.getByTestId('billing-opd-collect')).toHaveCount(0);
    await expect(page.getByTestId(ADD_ITEM_TEST_IDS.trigger)).toHaveCount(0);
    await expect(page.getByTestId(DISCOUNT_TEST_IDS.trigger)).toHaveCount(0);
    await expect(page.getByTestId(WORKSTATION_TEST_IDS.nextAction)).toContainText('Finalize bill');
  });

  test('Add item posts catalog variant with opdBillId and idempotencyKey', async ({ page }) => {
    const posts: Record<string, unknown>[] = [];
    await page.setViewportSize({ width: 1400, height: 900 });
    await loginAsRole(page, 'admin');
    await mockWorkstation(page);
    await page.route(/\/billitems\/?$/i, async (route) => {
      if (route.request().method() !== 'POST') {
        await route.fallback();
        return;
      }
      const body = route.request().postDataJSON() as Record<string, unknown>;
      posts.push(body);
      await route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify({
          id: 'line-new',
          opdBillId: BILL_ID,
          serviceName: 'Capsular tension ring',
          sourceType: 'Manual',
          quantity: 1,
          unitPrice: 3200,
          totalAmount: 3200,
        }),
      });
    });

    await page.goto(`/dashboard/billing/opd?billId=${BILL_ID}&journeyId=${JOURNEY_ID}`, {
      waitUntil: 'domcontentloaded',
    });
    await expect(page.getByTestId(ADD_ITEM_TEST_IDS.trigger)).toBeVisible({ timeout: 20_000 });
    await page.getByTestId(ADD_ITEM_TEST_IDS.trigger).click();
    await expect(page.getByTestId(ADD_ITEM_TEST_IDS.dialog)).toBeVisible();
    await page.getByTestId(ADD_ITEM_TEST_IDS.option).first().click();
    await page.getByTestId(ADD_ITEM_TEST_IDS.submit).click();
    await expect.poll(() => posts.length).toBe(1);
    expect(posts[0].opdBillId).toBe(BILL_ID);
    expect(posts[0].billId).toBeUndefined();
    expect(posts[0].serviceVariantId).toBe('variant-ctr');
    expect(posts[0].sourceType).toBe('Manual');
    expect(String(posts[0].idempotencyKey)).toMatch(new RegExp(`^billitem:${BILL_ID}:`));
    expect(posts[0].unitPriceOverride).toBeUndefined();
  });

  test('Discount posts opdBillId percentage and reason without a PIN', async ({ page }) => {
    const posts: Record<string, unknown>[] = [];
    await page.setViewportSize({ width: 1400, height: 900 });
    await loginAsRole(page, 'admin');
    await mockWorkstation(page);
    await page.route(/\/opdbills\/discount$/i, async (route) => {
      if (route.request().method() !== 'POST') {
        await route.fallback();
        return;
      }
      const body = route.request().postDataJSON() as Record<string, unknown>;
      posts.push(body);
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          ...workstationBill(),
          discountAmount: 10000,
          netAmount: 90000,
          balanceDue: 60000,
        }),
      });
    });

    await page.goto(`/dashboard/billing/opd?billId=${BILL_ID}&journeyId=${JOURNEY_ID}`, {
      waitUntil: 'domcontentloaded',
    });
    await expect(page.getByTestId(DISCOUNT_TEST_IDS.trigger)).toBeVisible({ timeout: 20_000 });
    await page.getByTestId(DISCOUNT_TEST_IDS.trigger).click();
    await expect(page.getByTestId(DISCOUNT_TEST_IDS.dialog)).toBeVisible();
    await page.getByTestId(DISCOUNT_TEST_IDS.reason).fill('Staff family concession');
    await page.getByTestId(DISCOUNT_TEST_IDS.submit).click();
    await expect.poll(() => posts.length).toBe(1);
    expect(posts[0].opdBillId).toBe(BILL_ID);
    expect(posts[0].billId).toBeUndefined();
    expect(posts[0].discountPercentage).toBe(10);
    expect(posts[0].discountReason).toBe('Staff family concession');
    expect(posts[0].authorizationPin).toBeUndefined();
    expect(String(posts[0].idempotencyKey)).toMatch(
      new RegExp(`^disc:${BILL_ID.replace(/-/g, '')}:`),
    );
  });

  test('Finalize posts canonical /opdbills/{id}/finalize and not LockBill', async ({ page }) => {
    const finalizeUrls: string[] = [];
    await page.setViewportSize({ width: 1400, height: 900 });
    await loginAsRole(page, 'admin');
    await mockWorkstation(page);
    await page.route('**/chargereconciliation/completeness**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          implantsRecorded: 0,
          implantsCharged: 0,
          implantsMissingCharge: 0,
          consumablesPending: 0,
          exceptionsOpen: 0,
          warnings: [],
        }),
      });
    });
    await page.route(`**/${BILL_ID}`, async (route) => {
      if (route.request().method() === 'GET') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            ...workstationBill(),
            amountPaid: 100000,
            balanceDue: 0,
            status: 'paid',
          }),
        });
        return;
      }
      await route.continue();
    });
    await page.route(new RegExp(`/opdbills/${BILL_ID}/finalize$`, 'i'), async (route) => {
      if (route.request().method() !== 'POST') {
        await route.fallback();
        return;
      }
      finalizeUrls.push(route.request().url());
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          ...workstationBill(),
          amountPaid: 100000,
          balanceDue: 0,
          status: 'paid',
          isFinalized: true,
        }),
      });
    });

    await page.goto(`/dashboard/billing/opd?billId=${BILL_ID}&journeyId=${JOURNEY_ID}`, {
      waitUntil: 'domcontentloaded',
    });
    await expect(page.getByTestId('billing-opd-finalize')).toBeVisible({ timeout: 20_000 });
    await page.getByTestId('billing-opd-finalize').click();
    await page.getByRole('button', { name: /Yes, Finalize Bill/i }).click();
    await expect.poll(() => finalizeUrls.length).toBe(1);
    expect(finalizeUrls[0]).toMatch(new RegExp(`/opdbills/${BILL_ID}/finalize`, 'i'));
    expect(finalizeUrls[0]).not.toMatch(/lock/i);
  });

  test('workstation remains usable at 1440, 1280, and 1024', async ({ page }) => {
    await loginAsRole(page, 'admin');
    await mockWorkstation(page);
    for (const width of [1440, 1280, 1024]) {
      await page.setViewportSize({ width, height: 900 });
      await page.goto(`/dashboard/billing/opd?billId=${BILL_ID}`, { waitUntil: 'domcontentloaded' });
      await expect(page.getByTestId(WORKSTATION_TEST_IDS.root)).toBeVisible({ timeout: 20_000 });
      await expect(page.getByTestId(WORKSTATION_TEST_IDS.search)).toBeVisible();
      await expect(page.getByTestId(WORKSTATION_TEST_IDS.context)).toBeVisible();
      await expect(page.getByTestId(WORKSTATION_TEST_IDS.summary)).toBeVisible();
      await expect(page.getByRole('heading', { name: 'Patient context' })).toBeVisible();
    }
  });
});
