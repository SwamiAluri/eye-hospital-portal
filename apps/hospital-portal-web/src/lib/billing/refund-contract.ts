export const REFUND_TEST_IDS = {
  trigger: 'billing-opd-refund',
  dialog: 'billing-opd-refund-dialog',
  amount: 'billing-opd-refund-amount',
  reason: 'billing-opd-refund-reason',
  submit: 'billing-opd-refund-submit',
  section: 'ip-billing-refunds',
  row: 'ip-billing-refund-row',
  authorize: 'ip-billing-refund-authorize',
  reject: 'ip-billing-refund-reject',
  complete: 'ip-billing-refund-complete',
  actionDialog: 'ip-billing-refund-action-dialog',
  actionNotes: 'ip-billing-refund-action-notes',
  actionSubmit: 'ip-billing-refund-action-submit',
} as const;

export type RefundWorkflowStatus = 'pending' | 'approved' | 'rejected' | 'completed';

export type RefundRecord = {
  id: string;
  billId: string;
  refundAmount: number;
  refundReason: string;
  refundMode: string;
  status: RefundWorkflowStatus;
  notes?: string;
  requestedAt?: string;
  createdAt?: string;
};

export function canRequestRefundOnBill(
  bill: { amountPaid?: number | null; status?: string | null } | null | undefined,
  canRefund: boolean,
): boolean {
  if (!canRefund || !bill) return false;
  if (String(bill.status || '').toLowerCase() === 'cancelled') return false;
  return (Number(bill.amountPaid) || 0) > 0;
}

export function refundLedgerReference(refundId: string): string {
  const compact = refundId.replace(/-/g, '').toLowerCase();
  if (!compact) return '';
  return `REF-${compact}`;
}

export function findRefundLedgerLine<T extends { paymentKind?: string | null; paymentReference?: string | null }>(
  payments: T[] | null | undefined,
  refundId: string,
): T | undefined {
  const ref = refundLedgerReference(refundId);
  if (!ref) return undefined;
  return (payments ?? []).find(
    (p) =>
      String(p.paymentKind || '').toLowerCase() === 'refund'
      && String(p.paymentReference || '').replace(/-/g, '').toLowerCase() === ref.replace(/-/g, '').toLowerCase(),
  );
}

export function normalizeRefund(raw: unknown): RefundRecord {
  const r = (raw ?? {}) as Record<string, unknown>;
  const id = String(r.id ?? '').trim();
  const billId = String(r.billId ?? r.opdBillId ?? '').trim();
  const statusRaw = String(r.status ?? 'pending').toLowerCase();
  const status: RefundWorkflowStatus =
    statusRaw === 'approved' || statusRaw === 'rejected' || statusRaw === 'completed'
      ? statusRaw
      : 'pending';
  return {
    id,
    billId,
    refundAmount: Number(r.refundAmount) || 0,
    refundReason: String(r.refundReason ?? '').trim(),
    refundMode: String(r.refundMode ?? 'cash').trim() || 'cash',
    status,
    notes: String(r.notes ?? '').trim() || undefined,
    requestedAt: r.requestedAt ? String(r.requestedAt) : undefined,
    createdAt: r.createdAt ? String(r.createdAt) : undefined,
  };
}

export type RequestRefundBody = {
  opdBillId: string;
  refundAmount: number;
  refundReason: string;
  refundMode?: string;
  notes?: string;
};

export type AuthorizeRefundBody = {
  approved: boolean;
  notes?: string;
};

export type CompleteRefundBody = {
  refundMode: string;
  notes?: string;
};

export function buildRequestRefundRequest(input: {
  opdBillId: string;
  refundAmount: number;
  refundReason: string;
  refundMode?: string;
  notes?: string;
}): RequestRefundBody {
  if (!input.opdBillId?.trim()) {
    throw new Error('opdBillId is required');
  }
  if (!(input.refundAmount > 0) || !Number.isFinite(input.refundAmount)) {
    throw new Error('refundAmount must be greater than zero');
  }
  const reason = input.refundReason.trim();
  if (!reason) {
    throw new Error('refundReason is required');
  }
  return {
    opdBillId: input.opdBillId.trim(),
    refundAmount: input.refundAmount,
    refundReason: reason,
    refundMode: input.refundMode,
    notes: input.notes?.trim() || undefined,
  };
}

export function buildAuthorizeRefundPath(refundId: string): string {
  if (!refundId?.trim()) {
    throw new Error('refundId is required');
  }
  return `/refunds/${refundId.trim()}/authorize`;
}

export function buildAuthorizeRefundBody(input: {
  approved: boolean;
  notes?: string;
  denialReason?: string;
}): AuthorizeRefundBody {
  const notes = (input.notes ?? input.denialReason ?? '').trim() || undefined;
  return { approved: input.approved, notes };
}

export function buildCompleteRefundPath(refundId: string): string {
  if (!refundId?.trim()) {
    throw new Error('refundId is required');
  }
  return `/refunds/${refundId.trim()}/complete`;
}

export function buildCompleteRefundBody(input: {
  refundMode: string;
  notes?: string;
}): CompleteRefundBody {
  const refundMode = input.refundMode.trim();
  if (!refundMode) {
    throw new Error('refundMode is required');
  }
  return {
    refundMode,
    notes: input.notes?.trim() || undefined,
  };
}

export function refundsByBillPath(billId: string): string {
  if (!billId?.trim()) {
    throw new Error('opdBillId is required');
  }
  return `/refunds/bill/${billId.trim()}`;
}
