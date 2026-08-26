import { describe, expect, it, vi } from 'vitest';
import type { OpdBill } from '@/lib/api/opd-billing.api';
import {
  DEEP_LINK_MESSAGES,
  resolveBillingDeepLink,
  type BillingDeepLinkDeps,
} from './resolve-billing-deep-link';

const bill = { id: 'bill-1', billNumber: 'IP-0001', balanceDue: 90000 } as OpdBill;

function deps(overrides: Partial<BillingDeepLinkDeps> = {}): BillingDeepLinkDeps {
  return {
    getFinancialSummary: vi.fn().mockResolvedValue({ opdBillId: 'bill-1' }),
    getOpdBill: vi.fn().mockResolvedValue(bill),
    ...overrides,
  };
}

describe('resolveBillingDeepLink', () => {
  it('does nothing when the page is opened without a deep link', async () => {
    const d = deps();
    expect(await resolveBillingDeepLink({}, d)).toEqual({ status: 'none' });
    expect(d.getOpdBill).not.toHaveBeenCalled();
    expect(d.getFinancialSummary).not.toHaveBeenCalled();
  });

  it('loads the bill directly from billId without consulting the journey', async () => {
    const d = deps();
    const result = await resolveBillingDeepLink({ billId: 'bill-1' }, d);

    expect(result).toEqual({ status: 'ready', bill });
    expect(d.getOpdBill).toHaveBeenCalledWith('bill-1');
    expect(d.getFinancialSummary).not.toHaveBeenCalled();
  });

  it('resolves a journeyId through the financial summary', async () => {
    const d = deps();
    const result = await resolveBillingDeepLink({ journeyId: 'journey-9' }, d);

    expect(result).toEqual({ status: 'ready', bill });
    expect(d.getFinancialSummary).toHaveBeenCalledWith('journey-9');
    expect(d.getOpdBill).toHaveBeenCalledWith('bill-1');
  });

  it('prefers billId when both are present, so one round trip is skipped', async () => {
    const d = deps();
    await resolveBillingDeepLink({ billId: 'bill-explicit', journeyId: 'journey-9' }, d);

    expect(d.getOpdBill).toHaveBeenCalledWith('bill-explicit');
    expect(d.getFinancialSummary).not.toHaveBeenCalled();
  });

  it('reports no-bill for an admitted patient who has not been billed yet', async () => {
    const d = deps({ getFinancialSummary: vi.fn().mockResolvedValue({ opdBillId: null }) });
    const result = await resolveBillingDeepLink({ journeyId: 'journey-9' }, d);

    expect(result).toEqual({ status: 'no-bill' });
    expect(d.getOpdBill).not.toHaveBeenCalled();
  });

  it('treats a null summary as unavailable, never as no-bill', async () => {
    // getFinancialSummary swallows its own errors and returns null. Reading that
    // as "no bill" would invite a duplicate bill for a patient who already has one.
    const d = deps({ getFinancialSummary: vi.fn().mockResolvedValue(null) });
    const result = await resolveBillingDeepLink({ journeyId: 'journey-9' }, d);

    expect(result).toEqual({ status: 'error', message: DEEP_LINK_MESSAGES.summaryUnavailable });
    expect(d.getOpdBill).not.toHaveBeenCalled();
  });

  it('surfaces a user-facing message when the summary call throws', async () => {
    const d = deps({ getFinancialSummary: vi.fn().mockRejectedValue(new Error('503')) });
    const result = await resolveBillingDeepLink({ journeyId: 'journey-9' }, d);

    expect(result).toEqual({ status: 'error', message: DEEP_LINK_MESSAGES.summaryUnavailable });
  });

  it('surfaces a user-facing message when the bill cannot be fetched', async () => {
    const d = deps({ getOpdBill: vi.fn().mockRejectedValue(new Error('404')) });
    const result = await resolveBillingDeepLink({ billId: 'bill-gone' }, d);

    expect(result).toEqual({ status: 'error', message: DEEP_LINK_MESSAGES.billUnavailable });
  });

  it('never leaks a raw status code or exception text to the user', async () => {
    const d = deps({ getOpdBill: vi.fn().mockRejectedValue(new Error('Request failed with status code 409')) });
    const result = await resolveBillingDeepLink({ billId: 'bill-1' }, d);

    expect(result.status).toBe('error');
    const message = result.status === 'error' ? result.message : '';
    expect(message).not.toMatch(/\d{3}|Error|undefined/);
  });
});
