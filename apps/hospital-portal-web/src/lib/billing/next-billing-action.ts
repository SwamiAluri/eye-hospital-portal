import type { OpdBill } from '@/lib/api/opd-billing.api';

export type NextBillingActionKind = 'collect' | 'finalize' | 'none';

export type NextBillingAction = {
  kind: NextBillingActionKind;
  label: string;
  reason: string;
};

/**
 * Next permitted Billing action for the workstation.
 * Collect remains the only collection path (CollectPaymentDrawer).
 * Add item and Discount are footer mutations (B3), not next-action kinds.
 * Refund request / authorize / complete live on the workstation refunds section.
 */
export function resolveNextBillingAction(input: {
  bill: Pick<OpdBill, 'balanceDue' | 'isFinalized' | 'amountPaid' | 'status'> | null;
  canCollect: boolean;
}): NextBillingAction {
  const { bill, canCollect } = input;

  if (!bill) {
    return {
      kind: 'none',
      label: 'No bill selected',
      reason: 'Search for a patient or open a bill from Pending to continue.',
    };
  }

  if (bill.status === 'cancelled') {
    return {
      kind: 'none',
      label: 'Bill cancelled',
      reason: 'This bill is cancelled. Collection is closed.',
    };
  }

  if (bill.isFinalized) {
    return {
      kind: 'none',
      label: 'Bill finalized',
      reason: 'This bill is finalized. No further collection on this workstation.',
    };
  }

  const due = Number(bill.balanceDue) || 0;
  if (due > 0) {
    if (!canCollect) {
      return {
        kind: 'none',
        label: 'Collection not permitted',
        reason: 'You do not have permission to collect payment on this bill.',
      };
    }
    return {
      kind: 'collect',
      label: 'Collect payment',
      reason: `₹${due.toLocaleString('en-IN')} is currently due.`,
    };
  }

  const paid = Number(bill.amountPaid) || 0;
  if (paid > 0) {
    return {
      kind: 'finalize',
      label: 'Finalize bill',
      reason: 'Nothing is due. Finalize to lock the bill against further edits.',
    };
  }

  return {
    kind: 'none',
    label: 'Nothing due',
    reason: 'This bill has no outstanding balance.',
  };
}
