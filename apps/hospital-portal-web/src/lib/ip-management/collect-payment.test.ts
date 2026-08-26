import { describe, expect, it } from 'vitest';
import type { OpdBill } from '@/lib/api/opd-billing.api';
import { resolveIpRoleActions } from './ip-role-actions';
import {
  buildAddPaymentRequest,
  canOpenCollectDrawer,
  collectiblePatientCap,
  hasExistingBill,
  isConcurrentAmountError,
  isOverPatientDue,
  isPatientTenderBlocked,
  latestReceipt,
  patientDueFromSummary,
  paymentIdempotencyKey,
  previewDueAfter,
  reuseOrCreatePaymentKey,
} from './collect-payment';

describe('collect-payment helpers', () => {
  it('builds a payment:{billId}:{uuid} key', () => {
    const key = paymentIdempotencyKey('bill-1');
    expect(key.startsWith('payment:bill-1:')).toBe(true);
    expect(key.length).toBeGreaterThan('payment:bill-1:'.length + 8);
  });

  it('reuses the key for the same bill and mints a new one when the bill changes', () => {
    const first = paymentIdempotencyKey('bill-1');
    expect(reuseOrCreatePaymentKey(first, 'bill-1')).toBe(first);
    const next = reuseOrCreatePaymentKey(first, 'bill-2');
    expect(next.startsWith('payment:bill-2:')).toBe(true);
    expect(next).not.toBe(first);
  });

  it('builds the canonical payment body with opdBillId and idempotencyKey', () => {
    const body = buildAddPaymentRequest({
      opdBillId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      paymentMode: 'cash',
      amount: 10000,
      paymentKind: 'Payment',
      idempotencyKey: 'payment:aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa:retry-1',
      notes: 'UPI-9',
    });
    expect(body).toEqual({
      opdBillId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      paymentMode: 'cash',
      amount: 10000,
      paymentKind: 'Payment',
      idempotencyKey: 'payment:aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa:retry-1',
      notes: 'UPI-9',
    });
    expect(body).not.toHaveProperty('billId');
  });

  it('refuses a payment body missing opdBillId, key, amount, or kind', () => {
    const base = {
      opdBillId: 'b1',
      paymentMode: 'cash' as const,
      amount: 10,
      paymentKind: 'Advance' as const,
      idempotencyKey: 'payment:b1:k',
    };
    expect(() => buildAddPaymentRequest({ ...base, opdBillId: '' })).toThrow(/opdBillId/);
    expect(() => buildAddPaymentRequest({ ...base, idempotencyKey: '  ' })).toThrow(/idempotencyKey/);
    expect(() => buildAddPaymentRequest({ ...base, amount: 0 })).toThrow(/amount/);
  });

  it('blocks patient Payment and Advance above collectible due', () => {
    expect(isOverPatientDue(10000, 15000)).toBe(true);
    expect(isOverPatientDue(10000, 10000)).toBe(false);
    expect(previewDueAfter(10000, 15000)).toBe(0);
    expect(isPatientTenderBlocked('Payment', 15000, 105000)).toBe(true);
    expect(isPatientTenderBlocked('Advance', 15000, 20000)).toBe(true);
    expect(isPatientTenderBlocked('Payment', 15000, 15000)).toBe(false);
  });

  it('opens the drawer only for a cashier who can bill', () => {
    const cashier = resolveIpRoleActions(['bill.update']);
    const nurse = resolveIpRoleActions(['ward.checklist.edit']);
    expect(canOpenCollectDrawer('cashier', cashier)).toBe(true);
    expect(canOpenCollectDrawer('ward', { ...nurse, canBill: true })).toBe(false);
    expect(canOpenCollectDrawer('cashier', nurse)).toBe(false);
  });

  it('treats NotCreated without an opdBillId as no bill', () => {
    expect(hasExistingBill('NotCreated', null)).toBe(false);
    expect(hasExistingBill('NotCreated', { billedAmount: 0, totalCollected: 0, balanceDue: 0 })).toBe(false);
    expect(hasExistingBill('NotCreated', { opdBillId: 'b1', billedAmount: 0, totalCollected: 0, balanceDue: 0 })).toBe(true);
    expect(hasExistingBill('PartiallyPaid', null)).toBe(true);
  });

  it('does not use TPA-inclusive balanceDue as patient due', () => {
    expect(patientDueFromSummary({
      billedAmount: 105000,
      patientResponsibility: 15000,
      totalCollected: 0,
      balanceDue: 105000,
    }, 1)).toBe(15000);
  });

  it('caps collectible due at min(patientBalance, ledger remaining)', () => {
    expect(collectiblePatientCap(15000, 105000)).toBe(15000);
    expect(collectiblePatientCap(0, 90000)).toBe(0);
    expect(collectiblePatientCap(20000, 10000)).toBe(10000);
    expect(patientDueFromSummary({
      billedAmount: 105000,
      patientBalance: 0,
      patientResponsibility: 15000,
      totalCollected: 15000,
      balanceDue: 90000,
    }, 90000)).toBe(0);
    expect(patientDueFromSummary({
      billedAmount: 105000,
      patientBalance: 15000,
      totalCollected: 0,
      balanceDue: 105000,
    }, 105000)).toBe(15000);
    expect(isPatientTenderBlocked('Payment', 15000, 15001)).toBe(true);
    expect(isPatientTenderBlocked('Payment', 0, 1)).toBe(true);
  });

  it('picks the latest receipt from the returned bill', () => {
    const bill = {
      billNumber: 'IP-1',
      payments: [
        { receiptNumber: 'RCP-OLD', amount: 1, paymentMode: 'cash', paymentDate: '2026-08-01T00:00:00Z', createdAt: '2026-08-01T00:00:00Z' },
        { receiptNumber: 'RCP-NEW', amount: 10000, paymentMode: 'cash', paymentDate: '2026-08-24T10:00:00Z', createdAt: '2026-08-24T10:00:00Z' },
      ],
    } as OpdBill;
    expect(latestReceipt(bill)).toEqual({
      receiptNumber: 'RCP-NEW',
      amount: 10000,
      paymentMode: 'cash',
    });
  });

  it('treats a non-finalized 409 / exceeds-due 400 as a concurrent amount change', () => {
    expect(isConcurrentAmountError(409, 'Bill changed')).toBe(true);
    expect(isConcurrentAmountError(409, 'Bill is finalized and cannot be modified')).toBe(false);
    expect(isConcurrentAmountError(400, 'Payment amount (10000.00) exceeds balance due (0.00)')).toBe(true);
    expect(isConcurrentAmountError(400, 'Payment amount (105000.00) exceeds collectible patient due (15000.00)')).toBe(true);
  });
});
