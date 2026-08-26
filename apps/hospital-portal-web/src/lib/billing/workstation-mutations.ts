import type { OpdBill } from '@/lib/api/opd-billing.api';

export const ADD_ITEM_TEST_IDS = {
  trigger: 'ip-billing-add-item',
  dialog: 'ip-billing-add-item-dialog',
  search: 'ip-billing-add-item-search',
  option: 'ip-billing-add-item-option',
  qty: 'ip-billing-add-item-qty',
  submit: 'ip-billing-add-item-submit',
  previewNet: 'ip-billing-add-item-preview-net',
  previewDue: 'ip-billing-add-item-preview-due',
} as const;

export const DISCOUNT_TEST_IDS = {
  trigger: 'ip-billing-discount',
  dialog: 'ip-billing-discount-dialog',
  percent: 'ip-billing-discount-percent',
  reason: 'ip-billing-discount-reason',
  submit: 'ip-billing-discount-submit',
  preview: 'ip-billing-discount-preview',
} as const;

export type AddBillItemRequestBody = {
  opdBillId: string;
  serviceVariantId: string;
  quantity: number;
  idempotencyKey: string;
  sourceType: 'Manual';
  notes?: string;
};

export type ApplyWorkstationDiscountBody = {
  opdBillId: string;
  discountPercentage: number;
  discountReason: string;
  idempotencyKey: string;
};

export function billItemIdempotencyKey(billId: string): string {
  const id = typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  return `billitem:${billId}:${id}`;
}

/** Keep the same key across retries of one Add item attempt. */
export function reuseOrCreateBillItemKey(current: string, billId: string): string {
  if (billId && current.startsWith(`billitem:${billId}:`)) return current;
  return billItemIdempotencyKey(billId);
}

export function buildAddBillItemRequest(input: {
  opdBillId: string;
  serviceVariantId: string;
  quantity: number;
  idempotencyKey: string;
  notes?: string;
}): AddBillItemRequestBody {
  if (!input.opdBillId?.trim()) {
    throw new Error('opdBillId is required');
  }
  if (!input.serviceVariantId?.trim()) {
    throw new Error('serviceVariantId is required');
  }
  if (!input.idempotencyKey?.trim()) {
    throw new Error('idempotencyKey is required');
  }
  if (!(input.quantity >= 1) || !Number.isInteger(input.quantity)) {
    throw new Error('quantity must be a whole number of at least 1');
  }
  return {
    opdBillId: input.opdBillId,
    serviceVariantId: input.serviceVariantId,
    quantity: input.quantity,
    idempotencyKey: input.idempotencyKey,
    sourceType: 'Manual',
    notes: input.notes,
  };
}

export function discountIdempotencyKey(billId: string): string {
  const compact = (value: string) => value.replace(/-/g, '');
  const id = typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  return `disc:${compact(billId)}:${compact(id)}`;
}

/** Keep the same key across retries of one Apply discount attempt. */
export function reuseOrCreateDiscountKey(current: string, billId: string): string {
  const prefix = `disc:${billId.replace(/-/g, '')}:`;
  if (billId && current.startsWith(prefix)) return current;
  return discountIdempotencyKey(billId);
}

export function buildApplyDiscountRequest(input: {
  opdBillId: string;
  discountPercentage: number;
  discountReason: string;
  idempotencyKey: string;
}): ApplyWorkstationDiscountBody {
  if (!input.opdBillId?.trim()) {
    throw new Error('opdBillId is required');
  }
  if (!input.idempotencyKey?.trim()) {
    throw new Error('idempotencyKey is required');
  }
  if (!(input.discountPercentage > 0) || input.discountPercentage > 100) {
    throw new Error('discountPercentage must be between 0 and 100');
  }
  const reason = input.discountReason.trim();
  if (!reason) {
    throw new Error('discountReason is required');
  }
  return {
    opdBillId: input.opdBillId,
    discountPercentage: input.discountPercentage,
    discountReason: reason,
    idempotencyKey: input.idempotencyKey,
  };
}

/** Display-only. Server ApplyDiscountAsync uses MidpointRounding.AwayFromZero on GrossAmount. */
export function previewDiscountAmount(grossAmount: number, discountPercentage: number): number {
  const gross = Number(grossAmount) || 0;
  const pct = Number(discountPercentage) || 0;
  if (gross <= 0 || pct <= 0) return 0;
  const raw = gross * (pct / 100);
  return (Math.sign(raw) * Math.round(Math.abs(raw) * 100)) / 100;
}

export function previewItemAmount(unitPrice: number, quantity: number): number {
  const qty = Number(quantity) || 0;
  const price = Number(unitPrice) || 0;
  if (qty <= 0 || price < 0) return 0;
  return (Math.round(price * qty * 100) / 100);
}

export function canMutateWorkstationBill(
  bill: Pick<OpdBill, 'status' | 'isFinalized'> | null | undefined,
  canUpdateBill: boolean,
): boolean {
  if (!bill || !canUpdateBill) return false;
  if (bill.isFinalized) return false;
  if (bill.status === 'cancelled') return false;
  return true;
}

export function canApplyWorkstationDiscount(
  bill: Pick<OpdBill, 'status' | 'isFinalized'> | null | undefined,
  canUpdateBill: boolean,
): boolean {
  if (!canMutateWorkstationBill(bill, canUpdateBill)) return false;
  if (bill?.status === 'paid') return false;
  return true;
}
