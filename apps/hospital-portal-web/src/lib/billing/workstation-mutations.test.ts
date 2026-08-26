import { describe, expect, it } from 'vitest';
import {
  buildAddBillItemRequest,
  buildApplyDiscountRequest,
  canApplyWorkstationDiscount,
  canMutateWorkstationBill,
  previewDiscountAmount,
  previewItemAmount,
  reuseOrCreateBillItemKey,
  reuseOrCreateDiscountKey,
} from './workstation-mutations';

describe('buildAddBillItemRequest', () => {
  it('requires opdBillId, variant, quantity, and idempotencyKey', () => {
    expect(() => buildAddBillItemRequest({
      opdBillId: '',
      serviceVariantId: 'v1',
      quantity: 1,
      idempotencyKey: 'billitem:b1:1',
    })).toThrow(/opdBillId/);
    expect(buildAddBillItemRequest({
      opdBillId: 'b1',
      serviceVariantId: 'v1',
      quantity: 2,
      idempotencyKey: 'billitem:b1:1',
    })).toEqual({
      opdBillId: 'b1',
      serviceVariantId: 'v1',
      quantity: 2,
      idempotencyKey: 'billitem:b1:1',
      sourceType: 'Manual',
      notes: undefined,
    });
  });

  it('does not include unitPriceOverride or billId', () => {
    const body = buildAddBillItemRequest({
      opdBillId: 'b1',
      serviceVariantId: 'v1',
      quantity: 1,
      idempotencyKey: 'billitem:b1:k',
    });
    expect(body).not.toHaveProperty('billId');
    expect(body).not.toHaveProperty('unitPriceOverride');
  });
});

describe('buildApplyDiscountRequest', () => {
  it('sends opdBillId, percentage, reason, and idempotencyKey — no PIN', () => {
    const body = buildApplyDiscountRequest({
      opdBillId: 'b1',
      discountPercentage: 10,
      discountReason: '  staff family  ',
      idempotencyKey: 'disc:b1:k',
    });
    expect(body).toEqual({
      opdBillId: 'b1',
      discountPercentage: 10,
      discountReason: 'staff family',
      idempotencyKey: 'disc:b1:k',
    });
    expect(body).not.toHaveProperty('authorizationPin');
    expect(body).not.toHaveProperty('billId');
  });

  it('requires idempotencyKey', () => {
    expect(() => buildApplyDiscountRequest({
      opdBillId: 'b1',
      discountPercentage: 10,
      discountReason: 'staff',
      idempotencyKey: '  ',
    })).toThrow(/idempotencyKey/);
  });
});

describe('previews', () => {
  it('estimates line amount and discount away-from-zero', () => {
    expect(previewItemAmount(3200, 1)).toBe(3200);
    expect(previewDiscountAmount(120000, 10)).toBe(12000);
  });
});

describe('mutation gates', () => {
  it('blocks add/discount on finalized or cancelled bills', () => {
    expect(canMutateWorkstationBill({ status: 'partial', isFinalized: true }, true)).toBe(false);
    expect(canMutateWorkstationBill({ status: 'cancelled', isFinalized: false }, true)).toBe(false);
    expect(canMutateWorkstationBill({ status: 'partial', isFinalized: false }, false)).toBe(false);
    expect(canMutateWorkstationBill({ status: 'partial', isFinalized: false }, true)).toBe(true);
    expect(canApplyWorkstationDiscount({ status: 'paid', isFinalized: false }, true)).toBe(false);
    expect(canApplyWorkstationDiscount({ status: 'partial', isFinalized: false }, true)).toBe(true);
  });
});

describe('reuseOrCreateBillItemKey', () => {
  it('reuses the key for the same bill on retry', () => {
    const first = reuseOrCreateBillItemKey('', 'b1');
    expect(first.startsWith('billitem:b1:')).toBe(true);
    expect(reuseOrCreateBillItemKey(first, 'b1')).toBe(first);
    expect(reuseOrCreateBillItemKey(first, 'b2').startsWith('billitem:b2:')).toBe(true);
  });
});

describe('reuseOrCreateDiscountKey', () => {
  it('reuses the key for the same bill on retry', () => {
    const first = reuseOrCreateDiscountKey('', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa');
    expect(first.startsWith('disc:aaaaaaaaaaaa4aaa8aaaaaaaaaaaaaaa:')).toBe(true);
    expect(reuseOrCreateDiscountKey(first, 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa')).toBe(first);
  });
});
