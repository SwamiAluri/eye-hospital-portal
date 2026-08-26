/**
 * B3R-B live RefundService lifecycle against seeded UAT-IP-131 OpdBill.
 * Uses existing UAT simulate/payment (not simulate/refund) then Auth Refunds API.
 *
 *   npx playwright test e2e/billing-opd-refund-lifecycle.spec.ts --project=chromium
 */
import { test, expect } from '@playwright/test';
import { apiLogin, apiHeaders, E2E_API_BASE } from './helpers/auth';
import { E2E_BRANCH_ID } from './helpers/patient-hub';
import { E2E_IP_API_BASE } from './helpers/ward-preop';

const UAT_CODE = 'UAT-IP-131';
const PAYMENT_AMOUNT = 30_000;
const REFUND_AMOUNT = 1_000;

type BillDto = {
  id: string;
  amountPaid: number;
  balanceDue: number;
  isFinalized?: boolean;
  isCancelled?: boolean;
  refundStatus?: string | null;
  payments?: Array<{
    id: string;
    paymentKind?: string | null;
    amount: number;
    idempotencyKey?: string | null;
    paymentReference?: string | null;
  }>;
};

type RefundDto = {
  id: string;
  status: string;
  refundAmount: number;
  billId?: string;
};

test.describe('B3R-B live refund lifecycle', () => {
  test.describe.configure({ timeout: 90_000 });

  test('request does not post money; complete posts Refund ledger line', async ({ request }) => {
    const login = await apiLogin(request);
    const headers = apiHeaders(login.accessToken);

    const statusRes = await request.get(
      `${E2E_IP_API_BASE}/dev/uat/status?branchId=${E2E_BRANCH_ID}`,
      { headers },
    );
    expect(statusRes.ok()).toBeTruthy();
    const status = (await statusRes.json()) as {
      rows?: Array<{ code?: string; journeyId?: string }>;
    };
    const row = (status.rows ?? []).find((r) => r.code === UAT_CODE);
    expect(row?.journeyId).toBeTruthy();
    const journeyId = row!.journeyId as string;

    const ensureRes = await request.post(`${E2E_API_BASE}/opdbills/ip-ensure`, {
      headers,
      data: { patientJourneyId: journeyId },
    });
    expect(ensureRes.ok()).toBeTruthy();
    let bill = (await ensureRes.json()) as BillDto;
    expect(bill.id).toBeTruthy();
    expect(bill.isFinalized).toBeFalsy();

    if (!(bill.amountPaid > 0)) {
      const hasCollect = (bill.payments ?? []).some(
        (p) => p.paymentKind === 'Payment' || p.paymentKind === 'Advance',
      );
      if (!hasCollect) {
        const sim = await request.post(
          `${E2E_IP_API_BASE}/dev/uat/simulate/payment?branchId=${E2E_BRANCH_ID}`,
          {
            headers,
            data: {
              journeyId,
              amount: PAYMENT_AMOUNT,
              paymentMode: 'Cash',
              reason: 'B3R-B UAT payment for refund certification',
            },
          },
        );
        expect(sim.ok(), await sim.text()).toBeTruthy();
        const simBody = (await sim.json()) as { error?: string };
        expect(simBody.error, JSON.stringify(simBody)).toBeFalsy();
      } else {
        const sync = await request.post(`${E2E_API_BASE}/opdbills/payment`, {
          headers,
          data: {
            opdBillId: bill.id,
            paymentMode: 'cash',
            amount: 1,
            paymentKind: 'Payment',
            notes: 'B3R-B header reproject from existing ledger lines',
            idempotencyKey: `b3rb-reproject:${bill.id}`,
          },
        });
        expect(sync.ok(), await sync.text()).toBeTruthy();
      }

      const afterPay = await request.get(`${E2E_API_BASE}/opdbills/${bill.id}`, { headers });
      expect(afterPay.ok()).toBeTruthy();
      bill = (await afterPay.json()) as BillDto;
    }

    expect(bill.amountPaid).toBeGreaterThanOrEqual(REFUND_AMOUNT);
    const paidBefore = bill.amountPaid;
    const refundLinesBefore = (bill.payments ?? []).filter((p) => p.paymentKind === 'Refund');

    const requestRes = await request.post(`${E2E_API_BASE}/Refunds/request`, {
      headers,
      data: {
        opdBillId: bill.id,
        refundAmount: REFUND_AMOUNT,
        refundReason: 'Duplicate cash collection',
        refundMode: 'cash',
        notes: 'B3R-B refund lifecycle',
      },
    });
    expect(requestRes.ok(), await requestRes.text()).toBeTruthy();
    const refund = (await requestRes.json()) as RefundDto;
    expect(refund.id).toBeTruthy();
    expect(refund.status).toBe('pending');

    const afterRequest = (await (
      await request.get(`${E2E_API_BASE}/opdbills/${bill.id}`, { headers })
    ).json()) as BillDto;
    expect(afterRequest.amountPaid).toBe(paidBefore);
    expect(
      (afterRequest.payments ?? []).filter((p) => p.paymentKind === 'Refund').length,
    ).toBe(refundLinesBefore.length);

    const byBill = await request.get(`${E2E_API_BASE}/Refunds/bill/${bill.id}`, { headers });
    expect(byBill.ok()).toBeTruthy();
    const listed = (await byBill.json()) as RefundDto[];
    expect(listed.some((r) => r.id === refund.id && r.status === 'pending')).toBeTruthy();

    const authz = await request.post(`${E2E_API_BASE}/Refunds/${refund.id}/authorize`, {
      headers,
      data: { approved: true, notes: 'B3R-B authorize' },
    });
    expect(authz.ok(), await authz.text()).toBeTruthy();
    expect(((await authz.json()) as RefundDto).status).toBe('approved');

    const afterAuth = (await (
      await request.get(`${E2E_API_BASE}/opdbills/${bill.id}`, { headers })
    ).json()) as BillDto;
    expect(
      (afterAuth.payments ?? []).filter((p) => p.paymentKind === 'Refund').length,
    ).toBe(refundLinesBefore.length);
    expect(afterAuth.amountPaid).toBe(paidBefore);

    const complete = await request.post(`${E2E_API_BASE}/Refunds/${refund.id}/complete`, {
      headers,
      data: { refundMode: 'cash', notes: 'B3R-B complete' },
    });
    expect(complete.ok(), await complete.text()).toBeTruthy();
    expect(((await complete.json()) as RefundDto).status).toBe('completed');

    const after = (await (
      await request.get(`${E2E_API_BASE}/opdbills/${bill.id}`, { headers })
    ).json()) as BillDto;
    const refundLine = (after.payments ?? []).find(
      (p) => p.paymentKind === 'Refund' && p.paymentReference === `REF-${refund.id.replace(/-/g, '')}`,
    );
    expect(refundLine).toBeTruthy();
    expect(refundLine!.amount).toBe(REFUND_AMOUNT);
    expect(refundLine!.paymentReference).toBe(`REF-${refund.id.replace(/-/g, '')}`);
    expect(after.amountPaid).toBe(paidBefore - REFUND_AMOUNT);
  });
});
