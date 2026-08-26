import type { AddPaymentRequest, OpdBill, OpdBillPayment, PaymentMode } from '@/lib/api/opd-billing.api';
import type { IpRoleActions } from './ip-role-actions';

export const COLLECT_PAYMENT_TEST_IDS = {
  drawer: 'collect-payment-drawer',
  amount: 'collect-payment-amount',
  submit: 'collect-payment-submit',
  create: 'collect-payment-create',
  receipt: 'collect-payment-receipt',
  print: 'collect-payment-print',
  finalized: 'collect-payment-finalized',
  overDue: 'collect-payment-over-due',
  patientDue: 'collect-payment-patient-due',
  openBill: 'collect-payment-open-bill',
  retry: 'collect-payment-retry',
  stale: 'collect-payment-stale',
} as const;

export type CollectFinSummary = {
  opdBillId?: string | null;
  billNumber?: string | null;
  packageEstimate?: number;
  billedAmount: number;
  patientResponsibility?: number;
  insuranceResponsibility?: number;
  patientBalance?: number;
  totalCollected: number;
  balanceDue: number;
  isFinalized?: boolean;
} | null;

export type CollectPaymentKind = 'Payment' | 'Advance';

export const BILLING_DESK_VIEW_PERMISSIONS = [
  'bill.view',
  'opd_bill.view',
  'bill.update',
  'ip.billing.collect',
  'bill.create',
] as const;

export function paymentIdempotencyKey(billId: string): string {
  const id = typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  return `payment:${billId}:${id}`;
}

/** Keep the same key across retries of one attempt; mint a new key when the bill changes. */
export function reuseOrCreatePaymentKey(current: string, billId: string): string {
  if (billId && current.startsWith(`payment:${billId}:`)) return current;
  return paymentIdempotencyKey(billId);
}

/**
 * The only browser payment body. Callers must not send `billId` or omit the key.
 * Extra tender fields (card/UPI) are optional and never substitute for these five.
 */
export function buildAddPaymentRequest(input: {
  opdBillId: string;
  paymentMode: PaymentMode;
  amount: number;
  paymentKind: CollectPaymentKind;
  idempotencyKey: string;
  notes?: string;
}): AddPaymentRequest {
  if (!input.opdBillId?.trim()) {
    throw new Error('opdBillId is required');
  }
  if (!input.idempotencyKey?.trim()) {
    throw new Error('idempotencyKey is required');
  }
  if (!(input.amount > 0) || Number.isNaN(input.amount)) {
    throw new Error('amount must be greater than zero');
  }
  if (input.paymentKind !== 'Payment' && input.paymentKind !== 'Advance') {
    throw new Error('paymentKind must be Payment or Advance');
  }
  if (!input.paymentMode) {
    throw new Error('paymentMode is required');
  }
  return {
    opdBillId: input.opdBillId,
    paymentMode: input.paymentMode,
    amount: input.amount,
    paymentKind: input.paymentKind,
    idempotencyKey: input.idempotencyKey,
    notes: input.notes,
  };
}

export function previewDueAfter(patientDue: number, amount: number): number {
  return Math.max(0, patientDue - amount);
}

export function isOverPatientDue(patientDue: number, amount: number): boolean {
  return amount > 0 && amount > patientDue;
}

/** Patient Payment/Advance cannot exceed collectible due. Insurance tender is backend-capped on ledger remaining. */
export function isPatientTenderBlocked(
  kind: CollectPaymentKind,
  patientDue: number,
  amount: number,
): boolean {
  return (kind === 'Payment' || kind === 'Advance') && isOverPatientDue(patientDue, amount);
}

export function canOpenCollectDrawer(
  persona: string,
  actions: Pick<IpRoleActions, 'canBill'>,
): boolean {
  return persona === 'cashier' && actions.canBill;
}

export function hasExistingBill(
  financialState: string,
  summary: CollectFinSummary,
): boolean {
  if (summary?.opdBillId) return true;
  return financialState !== 'NotCreated';
}

/**
 * Same ceiling Auth uses for patient Payment/Advance:
 * min(PatientObligation.PatientBalance, OpdBill.BalanceDue).
 * Display/enforce only — the server remains the source of truth.
 */
export function collectiblePatientCap(
  patientBalance: number,
  ledgerBalanceDue: number,
): number {
  const obligation = Math.max(0, patientBalance);
  const ledger = Math.max(0, ledgerBalanceDue);
  return Math.min(obligation, ledger);
}

export function patientDueFromSummary(
  summary: CollectFinSummary,
  fallbackDue: number,
): number {
  const ledgerDue = Math.max(0, summary?.balanceDue ?? fallbackDue);
  let obligation: number | null = null;
  if (summary?.patientBalance != null) {
    obligation = Math.max(0, summary.patientBalance);
  } else if (summary?.patientResponsibility != null) {
    obligation = Math.max(0, summary.patientResponsibility - (summary.totalCollected ?? 0));
  }
  if (obligation == null) return ledgerDue;
  return collectiblePatientCap(obligation, ledgerDue);
}

export function latestReceipt(bill: OpdBill | null | undefined): {
  receiptNumber: string;
  amount: number;
  paymentMode: string;
} | null {
  const payments = bill?.payments ?? [];
  const withReceipt = [...payments]
    .filter((p: Partial<OpdBillPayment>) => p.receiptNumber)
    .sort((a, b) => {
      const ta = Date.parse(a.createdAt || a.paymentDate || '');
      const tb = Date.parse(b.createdAt || b.paymentDate || '');
      return (Number.isNaN(tb) ? 0 : tb) - (Number.isNaN(ta) ? 0 : ta);
    });
  const hit = withReceipt[0];
  if (!hit?.receiptNumber) return null;
  return {
    receiptNumber: hit.receiptNumber,
    amount: hit.amount,
    paymentMode: hit.paymentMode,
  };
}

export function isOpdBill(value: OpdBill | OpdBillPayment): value is OpdBill {
  return 'billNumber' in value && 'payments' in value;
}

export function axiosStatus(err: unknown): number | undefined {
  if (typeof err !== 'object' || err === null) return undefined;
  const response = (err as { response?: { status?: number } }).response;
  return response?.status;
}

export function axiosMessage(err: unknown): string {
  if (typeof err !== 'object' || err === null) return '';
  const data = (err as { response?: { data?: unknown } }).response?.data;
  if (typeof data === 'string') return data;
  if (data && typeof data === 'object') {
    const record = data as Record<string, unknown>;
    const msg = record.message ?? record.error;
    if (typeof msg === 'string') return msg;
  }
  return err instanceof Error ? err.message : '';
}

export function isFinalizedError(message: string): boolean {
  return /finaliz/i.test(message);
}

export function isConcurrentAmountError(status: number | undefined, message: string): boolean {
  if (status === 409 && !isFinalizedError(message)) return true;
  return status === 400 && /exceeds (collectible patient due|balance due)/i.test(message);
}
