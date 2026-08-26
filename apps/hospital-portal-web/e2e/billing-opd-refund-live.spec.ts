/**
 * B3R-A live Auth refund binding — no money moved (tenant has no matching bill).
 *
 *   npx playwright test e2e/billing-opd-refund-live.spec.ts --project=chromium
 */
import { test, expect } from '@playwright/test';
import { apiLogin, apiHeaders, E2E_API_BASE } from './helpers/auth';

const GHOST = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';

test.describe('B3R-A live Auth refund contract', () => {
  test.describe.configure({ timeout: 60_000 });

  test('portal JSON binds opdBillId; authorize/complete use /{id} routes', async ({ request }) => {
    const login = await apiLogin(request);
    const headers = apiHeaders(login.accessToken);

    const portal = await request.post(`${E2E_API_BASE}/Refunds/request`, {
      headers,
      data: {
        opdBillId: GHOST,
        refundAmount: 100,
        refundReason: 'Duplicate cash collection',
        refundMode: 'cash',
        notes: 'b3r-a live',
      },
    });
    expect(portal.status()).toBe(400);
    const portalBody = (await portal.json()) as { message?: string };
    expect(portalBody.message).toBe('Bill not found');
    expect(portalBody.message).not.toMatch(/00000000/);

    const empty = await request.post(`${E2E_API_BASE}/Refunds/request`, {
      headers,
      data: {},
    });
    expect(empty.status()).toBe(400);
    expect(((await empty.json()) as { message?: string }).message).toMatch(/opdBillId is required/i);

    const legacy = await request.post(`${E2E_API_BASE}/Refunds/request`, {
      headers,
      data: { billId: GHOST, amount: 100, reason: 'Duplicate cash collection' },
    });
    expect(legacy.status()).toBe(400);
    expect(((await legacy.json()) as { message?: string }).message).toBe('Bill not found');

    const authorize = await request.post(`${E2E_API_BASE}/Refunds/${GHOST}/authorize`, {
      headers,
      data: { approved: false, notes: 'probe', denialReason: 'no receipt' },
    });
    expect(authorize.status()).toBe(400);
    expect(((await authorize.json()) as { message?: string }).message).toMatch(/Refund with ID/i);

    const authorizeWrong = await request.post(`${E2E_API_BASE}/Refunds/authorize`, {
      headers,
      data: { refundId: GHOST, approved: true },
    });
    expect(authorizeWrong.status()).toBe(405);

    const complete = await request.post(`${E2E_API_BASE}/Refunds/${GHOST}/complete`, {
      headers,
      data: { refundMode: 'cash' },
    });
    expect(complete.status()).toBe(400);
    expect(((await complete.json()) as { message?: string }).message).toMatch(/Refund with ID/i);

    const completeWrong = await request.post(`${E2E_API_BASE}/Refunds/complete`, {
      headers,
      data: { refundId: GHOST, paymentReference: 'x' },
    });
    expect(completeWrong.status()).toBe(405);

    const completeNoMode = await request.post(`${E2E_API_BASE}/Refunds/${GHOST}/complete`, {
      headers,
      data: { notes: 'x' },
    });
    expect(completeNoMode.status()).toBe(400);
    expect(((await completeNoMode.json()) as { message?: string }).message).toMatch(/refundMode is required/i);
  });
});
