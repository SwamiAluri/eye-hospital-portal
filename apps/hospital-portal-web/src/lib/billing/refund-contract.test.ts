import { describe, expect, it } from 'vitest';
import {
  buildAuthorizeRefundBody,
  buildAuthorizeRefundPath,
  buildCompleteRefundBody,
  buildCompleteRefundPath,
  buildRequestRefundRequest,
  canRequestRefundOnBill,
  findRefundLedgerLine,
  normalizeRefund,
  refundLedgerReference,
  refundsByBillPath,
} from './refund-contract';

describe('buildRequestRefundRequest', () => {
  it('posts opdBillId aliases and never billId', () => {
    const body = buildRequestRefundRequest({
      opdBillId: 'bill-1',
      refundAmount: 500,
      refundReason: 'Duplicate payment',
      refundMode: 'cash',
      notes: '  desk note  ',
    });
    expect(body).toEqual({
      opdBillId: 'bill-1',
      refundAmount: 500,
      refundReason: 'Duplicate payment',
      refundMode: 'cash',
      notes: 'desk note',
    });
    expect(body).not.toHaveProperty('billId');
    expect(body).not.toHaveProperty('amount');
    expect(body).not.toHaveProperty('reason');
  });

  it('requires opdBillId, amount, and reason', () => {
    expect(() => buildRequestRefundRequest({
      opdBillId: '',
      refundAmount: 1,
      refundReason: 'Duplicate payment',
    })).toThrow(/opdBillId/);
    expect(() => buildRequestRefundRequest({
      opdBillId: 'bill-1',
      refundAmount: 0,
      refundReason: 'Duplicate payment',
    })).toThrow(/refundAmount/);
    expect(() => buildRequestRefundRequest({
      opdBillId: 'bill-1',
      refundAmount: 1,
      refundReason: '   ',
    })).toThrow(/refundReason/);
  });
});

describe('authorize and complete paths', () => {
  const id = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';

  it('authorize uses /refunds/{id}/authorize and maps denialReason to notes', () => {
    expect(buildAuthorizeRefundPath(id)).toBe(`/refunds/${id}/authorize`);
    expect(buildAuthorizeRefundBody({ approved: false, denialReason: 'Insufficient docs' })).toEqual({
      approved: false,
      notes: 'Insufficient docs',
    });
    expect(buildAuthorizeRefundBody({ approved: true })).toEqual({
      approved: true,
      notes: undefined,
    });
  });

  it('complete uses /refunds/{id}/complete with refundMode, not paymentReference', () => {
    expect(buildCompleteRefundPath(id)).toBe(`/refunds/${id}/complete`);
    const body = buildCompleteRefundBody({ refundMode: 'upi', notes: 'paid out' });
    expect(body).toEqual({ refundMode: 'upi', notes: 'paid out' });
    expect(body).not.toHaveProperty('paymentReference');
    expect(body).not.toHaveProperty('refundId');
  });

  it('lists refunds by Auth bill route', () => {
    expect(refundsByBillPath(id)).toBe(`/refunds/bill/${id}`);
  });
});

describe('refund close-loop helpers', () => {
  it('allows request while AmountPaid remains, including unfinalized bills', () => {
    expect(canRequestRefundOnBill({ amountPaid: 28001, status: 'partially_paid' }, true)).toBe(true);
    expect(canRequestRefundOnBill({ amountPaid: 0, status: 'paid' }, true)).toBe(false);
    expect(canRequestRefundOnBill({ amountPaid: 100, status: 'cancelled' }, true)).toBe(false);
    expect(canRequestRefundOnBill({ amountPaid: 100, status: 'paid' }, false)).toBe(false);
  });

  it('maps Auth billId JSON onto the workstation record', () => {
    const row = normalizeRefund({
      id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      billId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
      refundAmount: 1000,
      refundReason: 'Duplicate payment',
      refundMode: 'cash',
      status: 'pending',
    });
    expect(row.billId).toBe('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb');
    expect(row.status).toBe('pending');
  });

  it('matches the Auth Refund payment reference', () => {
    const id = 'a01b59df-749e-42db-80f4-a6d1968d097f';
    expect(refundLedgerReference(id)).toBe('REF-a01b59df749e42db80f4a6d1968d097f');
    expect(
      findRefundLedgerLine(
        [{ paymentKind: 'Refund', paymentReference: 'REF-a01b59df749e42db80f4a6d1968d097f' }],
        id,
      )?.paymentReference,
    ).toBe('REF-a01b59df749e42db80f4a6d1968d097f');
  });
});
