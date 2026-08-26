'use client';

import { useState } from 'react';
import Link from 'next/link';
import type { PreauthStatusDto } from '@/lib/api/ip-management.api';
import { remindCcmsTeam } from '@/lib/api/ccms/ccms-coverage-cases.api';
import { CoveragePaymentTerms, patientDueFromCollection } from '@/lib/ip-management/coverage-payment-terminology';
import { coverageToneToBadge } from '@/lib/ip-management/ip-target-badges';

function fmtINR(n: number): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency', currency: 'INR', maximumFractionDigits: 0,
  }).format(n);
}

type ChipTone = 'ok' | 'warn' | 'danger' | 'neutral' | 'info';

function coverageChip(preauth: PreauthStatusDto | null, paymentMode?: string | null): {
  label: string;
  tone: ChipTone;
} {
  if (preauth?.ccmsUnavailable) {
    return { label: 'Coverage unavailable', tone: 'warn' };
  }
  const state = (preauth?.coverageState ?? '').toUpperCase();
  const mode = (paymentMode ?? preauth?.paymentMode ?? '').toLowerCase();
  const selfPay = !mode || mode === 'cash' || mode === 'selfpay' || mode === 'self-pay';

  if (!preauth?.caseId && selfPay) {
    return { label: 'Self-pay', tone: 'neutral' };
  }
  if (!preauth?.caseId) {
    return { label: 'No coverage case', tone: 'warn' };
  }

  if (state === 'APPROVED' || state === 'ADMISSION_READY') {
    return { label: 'Approved', tone: 'ok' };
  }
  if (state === 'PARTIAL_APPROVAL') {
    return { label: 'Partially approved', tone: 'info' };
  }
  if (state === 'SETTLEMENT_PENDING' || state === 'PARTIAL_SETTLEMENT' || state === 'CLAIM_SUBMITTED' || state === 'CLAIM_IN_PROCESS') {
    return { label: 'Approved · settlement pending', tone: 'info' };
  }
  if (state === 'REJECTED') {
    return { label: 'Rejected', tone: 'danger' };
  }
  if (state === 'WAITING_APPROVAL' || state === 'PREAUTH_SENT' || state === 'CLARIFICATION_REQUIRED' || state === 'RESUBMITTED') {
    return { label: 'Awaiting pre-auth', tone: 'warn' };
  }
  if (state === 'EXPIRED' || state === 'CANCELLED' || state === 'ABORTED') {
    return { label: state.charAt(0) + state.slice(1).toLowerCase(), tone: 'danger' };
  }
  if (preauth.decision === 'BLOCK') return { label: 'Blocked', tone: 'danger' };
  if (preauth.decision === 'WARN') return { label: 'Warning', tone: 'warn' };
  return { label: preauth.coverageStatus ?? state ?? 'Coverage', tone: 'neutral' };
}

/** S-18 — Coverage context block (read-only). CCMS owns coverage; IP only displays
 * status vs patient payment vs clinical discharge as separate concerns.
 */
export function CoverageContextBlock({
  preauth,
  paymentMode,
  showPayerShare,
  allowRemind = false,
}: {
  preauth: PreauthStatusDto | null;
  paymentMode?: string | null;
  showPayerShare: boolean;
  /** CCMS mutation. Census must leave this false. */
  allowRemind?: boolean;
}) {
  const [reminding, setReminding] = useState(false);
  const [remindMsg, setRemindMsg] = useState('');
  const chip = coverageChip(preauth, paymentMode);
  const state = (preauth?.coverageState ?? '').toUpperCase();
  const payer = preauth?.payerShareAmount ?? null;
  const obligation = preauth?.patientObligationAmount ?? preauth?.patientShareAmount ?? null;
  const collected = preauth?.collectedAmount ?? null;
  const due = obligation != null ? patientDueFromCollection(obligation, collected) : null;
  const approved = preauth?.approvedAmount ?? null;
  const settlementPending = ['SETTLEMENT_PENDING', 'PARTIAL_SETTLEMENT', 'CLAIM_SUBMITTED', 'CLAIM_IN_PROCESS'].includes(state);
  const awaiting =
    ['WAITING_APPROVAL', 'PREAUTH_SENT', 'CLARIFICATION_REQUIRED', 'RESUBMITTED', 'PREAUTH_GENERATED'].includes(state)
    || preauth?.decision === 'BLOCK';
  const rejected = state === 'REJECTED';
  const mode = (paymentMode ?? preauth?.paymentMode ?? '').toLowerCase();
  const selfPay = (!preauth?.caseId && (!mode || mode === 'cash' || mode === 'selfpay' || mode === 'self-pay'));
  const caseHref = preauth?.caseId ? `/dashboard/ccms/cases/${preauth.caseId}` : null;

  async function onRemind() {
    if (!preauth?.caseId) return;
    setReminding(true);
    setRemindMsg('');
    try {
      await remindCcmsTeam(preauth.caseId, 'Please follow up on pre-authorization from IP ward.');
      setRemindMsg('CCMS team notified.');
    } catch {
      setRemindMsg('Could not send reminder.');
    } finally {
      setReminding(false);
    }
  }

  return (
    <section className="rail-section" data-testid="coverage-context-block">
      <p className="panel-h">Coverage</p>

      <div className="flex items-center justify-between gap-2">
        <span
          data-testid="coverage-context-chip"
          className={`badge ${coverageToneToBadge(chip.tone)}`}
        >
          {chip.label}
        </span>
        {(paymentMode || preauth?.paymentMode) && (
          <span className="text-[11px] text-gray-500 truncate">{paymentMode ?? preauth?.paymentMode}</span>
        )}
      </div>

      {preauth?.ccmsUnavailable && (
        <p className="mt-2 rounded-md border border-amber-200 bg-amber-50 px-2.5 py-2 text-xs text-amber-900">
          Coverage &amp; Claims is unreachable. Clinical cash paths are unaffected; coverage-based admit stays blocked.
        </p>
      )}

      {selfPay && !preauth?.ccmsUnavailable && (
        <p className="mt-2 text-xs text-gray-600">No coverage case. The patient pays the full amount.</p>
      )}

      {awaiting && !preauth?.ccmsUnavailable && (
        <p className="mt-2 rounded-md border border-amber-200 bg-amber-50 px-2.5 py-2 text-xs text-amber-900">
          {preauth?.blockReason || preauth?.warningMessage || 'Pre-authorization is pending.'}
          {' '}
          <span className="font-semibold">May block coverage-based admit / OT acceptance.</span>
        </p>
      )}

      {rejected && (
        <p className="mt-2 rounded-md border border-red-200 bg-red-50 px-2.5 py-2 text-xs text-red-900">
          {preauth?.blockReason || 'TPA rejected pre-auth.'}{' '}
          <span className="font-semibold">Patient is now fully liable.</span>
        </p>
      )}

      {settlementPending && (
        <p className="mt-2 rounded-md border border-gray-200 bg-gray-50 px-2.5 py-2 text-xs text-gray-700">
          Claim / settlement in progress. <span className="font-semibold">Does not block discharge.</span>
        </p>
      )}

      {approved != null && approved > 0 && (
        <p className="mt-2 flex justify-between text-xs text-gray-600">
          <span>Approved amount</span>
          <span className="font-semibold tabular-nums text-gray-800">{fmtINR(approved)}</span>
        </p>
      )}
      {showPayerShare && payer !== null && (
        <p className="mt-1 flex justify-between text-xs text-gray-600">
          <span>Payer share</span>
          <span className="font-semibold tabular-nums text-gray-800">{fmtINR(payer)}</span>
        </p>
      )}
      {obligation != null && (
        <p className="mt-1 flex justify-between text-xs text-gray-600">
          <span>{CoveragePaymentTerms.patientPaymentStatus}</span>
          <span className="font-semibold tabular-nums text-gray-800">{fmtINR(obligation)}</span>
        </p>
      )}
      {due != null && (
        <p className="mt-1 flex justify-between text-xs text-gray-600">
          <span>Patient due</span>
          <span className="font-semibold tabular-nums text-gray-800">{fmtINR(due)}</span>
        </p>
      )}

      <div className="mt-2 flex flex-wrap gap-2">
        {caseHref && (
          <Link
            href={caseHref}
            className="text-xs font-medium text-blue-700 hover:text-blue-900"
            data-testid="coverage-context-open-case"
          >
            Open coverage case →
          </Link>
        )}
        {allowRemind && awaiting && preauth?.caseId && (
          <button
            type="button"
            disabled={reminding}
            onClick={() => void onRemind()}
            className="text-xs font-medium text-amber-800 hover:text-amber-950 disabled:opacity-50"
            data-testid="coverage-context-remind"
          >
            {reminding ? 'Sending…' : 'Remind CCMS team'}
          </button>
        )}
      </div>
      {remindMsg && <p className="mt-1 text-[11px] text-gray-500">{remindMsg}</p>}
    </section>
  );
}
