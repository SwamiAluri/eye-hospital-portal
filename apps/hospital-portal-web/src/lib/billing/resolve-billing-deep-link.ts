import type { OpdBill } from '@/lib/api/opd-billing.api';

/**
 * Resolves a `?billId` / `?journeyId` deep link arriving from an IP surface into
 * the bill the user meant to open.
 *
 * `no-bill` is a normal outcome, not a failure: an admitted patient legitimately
 * has no bill until one is created. It must stay distinct from `error` so the UI
 * can offer the create flow instead of telling the user something went wrong.
 */

export type BillingDeepLink =
  | { status: 'none' }
  | { status: 'ready'; bill: OpdBill }
  | { status: 'no-bill' }
  | { status: 'error'; message: string };

export interface BillingDeepLinkDeps {
  getFinancialSummary: (journeyId: string) => Promise<{ opdBillId?: string | null } | null>;
  getOpdBill: (billId: string) => Promise<OpdBill>;
}

export const DEEP_LINK_MESSAGES = {
  summaryUnavailable: "We couldn't load this patient's billing details. Try refreshing.",
  billUnavailable: "We couldn't open that bill. It may have been cancelled or merged.",
} as const;

export async function resolveBillingDeepLink(
  params: { billId?: string | null; journeyId?: string | null },
  deps: BillingDeepLinkDeps,
): Promise<BillingDeepLink> {
  const { billId, journeyId } = params;

  if (!billId && !journeyId) return { status: 'none' };

  let resolvedBillId = billId ?? null;

  // A journey link carries no bill id, so ask Billing what it resolves to.
  if (!resolvedBillId && journeyId) {
    let summary: { opdBillId?: string | null } | null;
    try {
      summary = await deps.getFinancialSummary(journeyId);
    } catch {
      return { status: 'error', message: DEEP_LINK_MESSAGES.summaryUnavailable };
    }
    // getFinancialSummary swallows its own errors and returns null, which is
    // indistinguishable from a failed call - treat it as unavailable rather than
    // as "no bill", so we never invite a second bill for a patient who has one.
    if (!summary) {
      return { status: 'error', message: DEEP_LINK_MESSAGES.summaryUnavailable };
    }
    resolvedBillId = summary.opdBillId ?? null;
  }

  if (!resolvedBillId) return { status: 'no-bill' };

  try {
    return { status: 'ready', bill: await deps.getOpdBill(resolvedBillId) };
  } catch {
    return { status: 'error', message: DEEP_LINK_MESSAGES.billUnavailable };
  }
}
