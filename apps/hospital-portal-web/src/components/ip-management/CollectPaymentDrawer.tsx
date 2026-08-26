'use client';

import { useEffect, useId, useRef, useState } from 'react';
import Link from 'next/link';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { usePaymentModes } from '@/hooks/use-payment-modes';
import type { PaymentMode } from '@/lib/api/opd-billing.api';
import type { PatientJourneyRowDto } from '@/lib/api/ip-management.api';
import {
  COLLECT_PAYMENT_TEST_IDS as T,
  axiosMessage,
  axiosStatus,
  buildAddPaymentRequest,
  hasExistingBill,
  isConcurrentAmountError,
  isFinalizedError,
  isPatientTenderBlocked,
  latestReceipt,
  patientDueFromSummary,
  paymentIdempotencyKey,
  previewDueAfter,
  reuseOrCreatePaymentKey,
  type CollectFinSummary,
  type CollectPaymentKind,
} from '@/lib/ip-management/collect-payment';
import { opdBillingApi } from '@/lib/api/opd-billing.api';
import { formatApiError } from '@/lib/api/ip-management.api';

function fmtINR(n: number): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency', currency: 'INR', maximumFractionDigits: 0,
  }).format(n);
}

type DrawerView = 'form' | 'create' | 'success' | 'duplicate' | 'finalized' | 'stale' | 'error';

export interface CollectPaymentDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  journey: PatientJourneyRowDto;
  finSummary: CollectFinSummary;
  canCreateBill: boolean;
  collectedBy: string;
  billingHref: string;
  onCollected: () => void;
  onRefreshSummary: () => Promise<CollectFinSummary>;
  /** Census/discharge default Advance. OPD desk passes Payment. */
  initialKind?: CollectPaymentKind;
}

export function CollectPaymentDrawer({
  open,
  onOpenChange,
  journey,
  finSummary,
  canCreateBill,
  collectedBy,
  billingHref,
  onCollected,
  onRefreshSummary,
  initialKind = 'Advance',
}: CollectPaymentDrawerProps) {
  const { modes } = usePaymentModes();
  const amountId = useId();
  const [view, setView] = useState<DrawerView>('form');
  const [kind, setKind] = useState<CollectPaymentKind>(initialKind);
  const [mode, setMode] = useState<PaymentMode>('cash');
  const [amount, setAmount] = useState('');
  const [reference, setReference] = useState('');
  const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [receipt, setReceipt] = useState<{ receiptNumber: string; amount: number; paymentMode: string } | null>(null);
  const [typedAmount, setTypedAmount] = useState(0);
  const [staleDue, setStaleDue] = useState(0);
  const keyRef = useRef('');
  const inFlight = useRef<Promise<void> | null>(null);
  const billId = finSummary?.opdBillId ?? null;
  const patientDue = patientDueFromSummary(finSummary, journey.balanceDue);
  const billed = finSummary?.billedAmount ?? journey.packageAmount ?? 0;
  const collected = finSummary?.totalCollected ?? journey.totalPaid ?? 0;
  const payerShare = finSummary?.insuranceResponsibility ?? 0;
  const noBill = !hasExistingBill(journey.financialState, finSummary);
  const finalized = Boolean(finSummary?.isFinalized);
  const amountNum = Number.parseFloat(amount) || 0;
  const tenderBlocked = isPatientTenderBlocked(kind, patientDue, amountNum);
  const dueAfter = previewDueAfter(patientDue, amountNum);

  useEffect(() => {
    if (!open) {
      setView('form');
      setKind(initialKind);
      setAmount('');
      setReference('');
      setNotes('');
      setBusy(false);
      setError('');
      setReceipt(null);
      keyRef.current = '';
      inFlight.current = null;
      return;
    }
    if (finalized) {
      setView('finalized');
      return;
    }
    if (noBill) {
      setView('create');
      return;
    }
    setView(current => (current === 'success' || current === 'duplicate' || current === 'stale' || current === 'error' ? current : 'form'));
  }, [open, journey.id, billId, finalized, noBill, initialKind]);

  useEffect(() => {
    if (!open || noBill || finalized) return;
    setAmount(current => (current === '' && patientDue > 0 ? String(patientDue) : current));
  }, [open, noBill, finalized, patientDue]);

  useEffect(() => {
    if (!open || !billId) return;
    keyRef.current = reuseOrCreatePaymentKey(keyRef.current, billId);
  }, [open, billId]);

  useEffect(() => {
    if (modes[0] && mode === 'cash') setMode(modes[0].apiMode);
    // Only seed from master once when the drawer opens.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, modes]);

  const meta = [journey.uhid, journey.wardName, journey.bedNumber, finSummary?.billNumber]
    .filter(Boolean)
    .join(' · ');

  const close = () => onOpenChange(false);

  const printReceipt = () => {
    if (!receipt) return;
    const html = `<!doctype html><html><head><title>${receipt.receiptNumber}</title>
      <style>body{font-family:sans-serif;padding:24px}h1{font-size:22px} .mono{font-family:ui-monospace,monospace;font-size:20px}</style>
      </head><body>
      <h1>Payment receipt</h1>
      <p class="mono">${receipt.receiptNumber}</p>
      <p>${journey.patientName ?? ''} · ${journey.uhid ?? ''}</p>
      <p>Amount ${fmtINR(receipt.amount)} · ${receipt.paymentMode}</p>
      <p>Collected by ${collectedBy || '—'}</p>
      </body></html>`;
    const w = window.open('', '_blank', 'noopener,noreferrer');
    if (!w) return;
    w.document.write(html);
    w.document.close();
    w.focus();
    w.print();
  };

  const runCreate = async () => {
    if (!canCreateBill || busy) return;
    setBusy(true);
    setError('');
    try {
      await opdBillingApi.ensureIpBill({ patientJourneyId: journey.id });
      const next = await onRefreshSummary();
      const nextDue = patientDueFromSummary(next, journey.balanceDue);
      setAmount(nextDue > 0 ? String(nextDue) : '');
      setView('form');
    } catch (err) {
      setError(formatApiError(err, 'Could not create the bill. Nothing was charged.'));
    } finally {
      setBusy(false);
    }
  };

  const runCollect = async () => {
    if (!billId || amountNum <= 0) return;
    if (isPatientTenderBlocked(kind, patientDue, amountNum)) return;
    if (inFlight.current) return inFlight.current;
    const work = (async () => {
      setBusy(true);
      setError('');
      keyRef.current = reuseOrCreatePaymentKey(keyRef.current, billId);
      try {
        const bill = await opdBillingApi.addPayment(buildAddPaymentRequest({
          opdBillId: billId,
          paymentMode: mode,
          amount: amountNum,
          paymentKind: kind,
          idempotencyKey: keyRef.current,
          notes: [reference, notes].filter(Boolean).join(' · ') || undefined,
        }));
        const rec = latestReceipt(bill);
        setReceipt(rec);
        setView('success');
        onCollected();
      } catch (err) {
        const status = axiosStatus(err);
        const message = axiosMessage(err);
        if (isFinalizedError(message) || (status === 409 && /finaliz/i.test(message))) {
          setView('finalized');
          return;
        }
        if (isConcurrentAmountError(status, message)) {
          const next = await onRefreshSummary();
          setTypedAmount(amountNum);
          setStaleDue(patientDueFromSummary(next, journey.balanceDue));
          setView('stale');
          return;
        }
        setError(formatApiError(err, 'Payments are temporarily unavailable. Nothing was charged and no receipt was issued.'));
        setView('error');
      } finally {
        setBusy(false);
      }
    })();
    inFlight.current = work.finally(() => { inFlight.current = null; });
    return inFlight.current;
  };

  const retrySameKey = () => {
    setView('form');
    void runCollect();
  };

  const title =
    view === 'success' ? 'Payment collected'
    : view === 'duplicate' ? 'Already collected'
    : view === 'stale' ? 'Amounts changed'
    : 'Collect payment';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent data-testid={T.drawer} size="lg" className="ip-target max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription className="sr-only">
            Collect an advance or payment against the Billing ledger for this admission.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div>
            <p className="text-sm font-semibold text-gray-900">{journey.patientName}</p>
            <p className="text-xs text-gray-500 mt-0.5">{meta || journey.clinicalState}</p>
          </div>

          {view === 'finalized' && (
            <div data-testid={T.finalized} className="rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-900">
              <b>Bill {finSummary?.billNumber ?? ''} is finalized.</b> Collection is closed.
              Any further money movement goes through an adjustment or refund with authorisation.
            </div>
          )}

          {view === 'create' && (
            <>
              <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 text-sm text-amber-950">
                <b>No bill exists for this admission.</b> Creating it opens the Billing ledger
                so you can collect. Itemised package explosion is not wired yet — billed amount
                may start at ₹0.
              </div>
              {(journey.packageAmount > 0 || (finSummary?.packageEstimate ?? 0) > 0) && (
                <div className="rounded-lg border border-gray-100 bg-gray-50 px-3 py-2 text-sm">
                  <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-1">Package to be created</p>
                  <div className="flex justify-between gap-2">
                    <span>{journey.procedureName || 'Admission package'}</span>
                    <span className="tabular-nums font-medium">
                      {fmtINR(finSummary?.packageEstimate ?? journey.packageAmount)}
                    </span>
                  </div>
                </div>
              )}
              {!canCreateBill && (
                <p className="text-sm text-gray-600">You do not have permission to create a bill.</p>
              )}
            </>
          )}

          {(view === 'form' || view === 'error') && !noBill && (
            <>
              <div className="rounded-lg border border-gray-100 bg-gray-50 px-3 py-2 text-sm space-y-1">
                <div className="flex justify-between gap-2"><span className="text-gray-500">Billed</span><span className="tabular-nums">{fmtINR(billed)}</span></div>
                <div className="flex justify-between gap-2">
                  <span className="text-gray-500">Payer share{journey.paymentMode ? ` · ${journey.paymentMode}` : ''}</span>
                  <span className="tabular-nums">{fmtINR(payerShare)}</span>
                </div>
                <div className="flex justify-between gap-2"><span className="text-gray-500">Collected</span><span className="tabular-nums">{fmtINR(collected)}</span></div>
                <div className="flex justify-between gap-2 font-semibold">
                  <span>Patient due</span>
                  <span data-testid={T.patientDue} className="tabular-nums">{fmtINR(patientDue)}</span>
                </div>
              </div>
              <fieldset className="text-sm">
                <legend className="text-xs font-medium text-gray-600 mb-1">Type</legend>
                <div className="flex gap-4">
                  {(['Advance', 'Payment'] as const).map(k => (
                    <label key={k} className="inline-flex items-center gap-1.5">
                      <input type="radio" name="collect-kind" checked={kind === k} onChange={() => setKind(k)} />
                      {k}
                    </label>
                  ))}
                </div>
              </fieldset>
              <div className="grid grid-cols-2 gap-3">
                <label className="text-sm">
                  <span className="text-xs font-medium text-gray-600">Mode</span>
                  <select
                    className="mt-1 w-full rounded-md border border-gray-200 px-2 py-1.5 text-sm"
                    value={mode}
                    onChange={e => setMode(e.target.value as PaymentMode)}
                  >
                    {modes.map(m => (
                      <option key={m.masterCode} value={m.apiMode}>{m.label}</option>
                    ))}
                  </select>
                </label>
                <label className="text-sm" htmlFor={amountId}>
                  <span className="text-xs font-medium text-gray-600">Amount</span>
                  <input
                    id={amountId}
                    data-testid={T.amount}
                    type="number"
                    min={0}
                    step="1"
                    className="mt-1 w-full rounded-md border border-gray-200 px-2 py-1.5 text-sm tabular-nums"
                    value={amount}
                    onChange={e => setAmount(e.target.value)}
                  />
                </label>
              </div>
              <label className="text-sm block">
                <span className="text-xs font-medium text-gray-600">Reference</span>
                <input
                  className="mt-1 w-full rounded-md border border-gray-200 px-2 py-1.5 text-sm"
                  placeholder="UPI / card / cheque reference"
                  value={reference}
                  onChange={e => setReference(e.target.value)}
                />
              </label>
              <label className="text-sm block">
                <span className="text-xs font-medium text-gray-600">Notes</span>
                <input
                  className="mt-1 w-full rounded-md border border-gray-200 px-2 py-1.5 text-sm"
                  placeholder="Optional"
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                />
              </label>
              {tenderBlocked && (
                <p data-testid={T.overDue} className="text-sm text-red-800 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                  This amount exceeds the current collectible patient due of {fmtINR(patientDue)}. Patient payments cannot exceed patient obligation.
                </p>
              )}
              <div className="rounded-lg border border-blue-100 bg-blue-50 px-3 py-2 text-sm text-blue-950">
                <b>After this payment</b> · Patient due <b>{fmtINR(dueAfter)}</b>
                {dueAfter === 0 && (finSummary?.balanceDue ?? 0) <= patientDue
                  ? <> · Bill status becomes <b>Paid</b></>
                  : null}
              </div>
            </>
          )}

          {(view === 'success' || view === 'duplicate') && receipt && (
            <div className="space-y-2">
              <div className="rounded-lg border border-teal-200 bg-teal-50 px-3 py-2.5 text-sm text-teal-950">
                {view === 'duplicate' ? (
                  <>This payment was already recorded. Showing the original receipt{' '}
                    <b data-testid={T.receipt} className="font-mono text-base">{receipt.receiptNumber}</b>
                    {' '}— no second charge was made.</>
                ) : (
                  <><b>{fmtINR(receipt.amount)} collected.</b> Receipt{' '}
                    <b data-testid={T.receipt} className="font-mono text-base">{receipt.receiptNumber}</b></>
                )}
              </div>
              <div className="text-sm space-y-1">
                <div className="flex justify-between"><span className="text-gray-500">Mode</span><span>{receipt.paymentMode}</span></div>
                <div className="flex justify-between"><span className="text-gray-500">Collected by</span><span>{collectedBy || '—'}</span></div>
                <div className="flex justify-between font-semibold"><span>Patient due now</span><span className="tabular-nums">{fmtINR(dueAfter)}</span></div>
              </div>
            </div>
          )}

          {view === 'stale' && (
            <div data-testid={T.stale} className="space-y-2">
              <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 text-sm text-amber-950">
                <b>This bill changed while you were typing.</b> Patient due is now <b>{fmtINR(staleDue)}</b>.
              </div>
              <div className="text-sm space-y-1">
                <div className="flex justify-between"><span className="text-gray-500">You entered</span><span className="tabular-nums">{fmtINR(typedAmount)}</span></div>
                <div className="flex justify-between font-semibold"><span>Current due</span><span className="tabular-nums">{fmtINR(staleDue)}</span></div>
              </div>
            </div>
          )}

          {view === 'error' && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-900">
              <b>Payments are temporarily unavailable.</b> Nothing was charged and no receipt was issued.
              Please don&apos;t write a manual receipt — try again in a moment.
              {error ? <div className="text-xs text-red-800 mt-2 font-mono">{error}</div> : null}
            </div>
          )}

          {error && view === 'create' && (
            <p className="text-sm text-red-700">{error}</p>
          )}
        </div>

        <DialogFooter className="mt-2">
          {view === 'finalized' && (
            <>
              <button type="button" className="rounded-lg border border-gray-200 px-3 py-2 text-sm" onClick={close}>Close</button>
              <Link data-testid={T.openBill} href={billingHref} className="rounded-lg bg-blue-600 px-3 py-2 text-sm font-semibold text-white text-center">
                Open bill
              </Link>
            </>
          )}
          {view === 'create' && (
            <>
              <button type="button" className="rounded-lg border border-gray-200 px-3 py-2 text-sm" onClick={close}>Cancel</button>
              {canCreateBill && (
                <button
                  type="button"
                  data-testid={T.create}
                  disabled={busy}
                  onClick={() => void runCreate()}
                  className="rounded-lg bg-blue-600 px-3 py-2 text-sm font-semibold text-white disabled:opacity-60"
                >
                  {busy ? 'Creating…' : 'Create bill & collect'}
                </button>
              )}
            </>
          )}
          {(view === 'form') && (
            <>
              <button type="button" className="rounded-lg border border-gray-200 px-3 py-2 text-sm" onClick={close}>Cancel</button>
              <button
                type="button"
                data-testid={T.submit}
                disabled={busy || amountNum <= 0 || !billId || tenderBlocked}
                onClick={() => void runCollect()}
                className="rounded-lg bg-blue-600 px-3 py-2 text-sm font-semibold text-white disabled:opacity-60"
              >
                {busy ? 'Collecting…' : `Collect ${fmtINR(amountNum)}`}
              </button>
            </>
          )}
          {(view === 'success' || view === 'duplicate') && (
            <>
              <button type="button" className="rounded-lg border border-gray-200 px-3 py-2 text-sm" onClick={close}>Close</button>
              <button
                type="button"
                data-testid={T.print}
                onClick={printReceipt}
                className="rounded-lg bg-blue-600 px-3 py-2 text-sm font-semibold text-white"
              >
                Print receipt
              </button>
            </>
          )}
          {view === 'stale' && (
            <>
              <button type="button" className="rounded-lg border border-gray-200 px-3 py-2 text-sm" onClick={close}>Cancel</button>
              <button
                type="button"
                className="rounded-lg bg-blue-600 px-3 py-2 text-sm font-semibold text-white"
                onClick={() => {
                  setAmount(staleDue > 0 ? String(staleDue) : '');
                  keyRef.current = billId ? paymentIdempotencyKey(billId) : '';
                  setView('form');
                }}
              >
                Review updated amounts
              </button>
            </>
          )}
          {view === 'error' && (
            <>
              <button type="button" className="rounded-lg border border-gray-200 px-3 py-2 text-sm" onClick={close}>Cancel</button>
              <button
                type="button"
                data-testid={T.retry}
                disabled={busy}
                onClick={retrySameKey}
                className="rounded-lg bg-blue-600 px-3 py-2 text-sm font-semibold text-white disabled:opacity-60"
              >
                Retry
              </button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
