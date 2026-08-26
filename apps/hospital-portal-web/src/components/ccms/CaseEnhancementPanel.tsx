'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { AlertTriangle, Plus, RefreshCw, Send, CheckCircle2, XCircle } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { getApiErrorMessage } from '@/lib/auth-interceptors';
import {
  createEnhancement,
  decideEnhancement,
  getEnhancementGap,
  getEnhancementsByCaseId,
  submitEnhancement,
  type Enhancement,
  type EnhancementGapEvaluation,
} from '@/lib/api/ccms/ccms-enhancements.api';

function inr(n: number) {
  return '₹' + n.toLocaleString('en-IN', { maximumFractionDigits: 0 });
}

function statusLabel(status: string) {
  if (status === 'submitted') return { text: 'Awaiting TPA', cls: 'bg-indigo-50 text-indigo-700' };
  if (status === 'approved') return { text: 'Approved', cls: 'bg-green-50 text-green-700' };
  if (status === 'rejected') return { text: 'Rejected', cls: 'bg-red-50 text-red-700' };
  return { text: 'Draft', cls: 'bg-amber-50 text-amber-700' };
}

export function CaseEnhancementPanel({
  caseId,
  caseApprovedAmount,
  eligibleAmountHint,
  canWrite,
}: {
  caseId: string;
  caseApprovedAmount: number;
  eligibleAmountHint?: number;
  canWrite: boolean;
}) {
  const [rows, setRows] = useState<Enhancement[]>([]);
  const [gap, setGap] = useState<EnhancementGapEvaluation | null>(null);
  const [eligibleInput, setEligibleInput] = useState(
    String(eligibleAmountHint && eligibleAmountHint > 0 ? eligibleAmountHint : caseApprovedAmount || ''),
  );
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [requestAmount, setRequestAmount] = useState('');
  const [reason, setReason] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const list = await getEnhancementsByCaseId(caseId);
      setRows(list);
      const eligible = Number(eligibleInput);
      if (Number.isFinite(eligible) && eligible > 0) {
        const g = await getEnhancementGap(caseId, eligible);
        setGap(g);
        if (!requestAmount && g.gapAmount > 0) setRequestAmount(String(g.gapAmount));
      } else {
        setGap(null);
      }
    } catch (err) {
      toast.error(getApiErrorMessage(err, 'Failed to load enhancements'));
    } finally {
      setLoading(false);
    }
  }, [caseId, eligibleInput, requestAmount]);

  useEffect(() => { void load(); }, [caseId]); // eslint-disable-line react-hooks/exhaustive-deps -- reload on case change only

  const open = rows.find(r => r.status === 'active' || r.status === 'submitted');

  async function onCreate() {
    const amount = Number(requestAmount);
    if (!(amount > 0)) {
      toast.error('Enter a positive requested amount');
      return;
    }
    setBusy(true);
    try {
      await createEnhancement(caseId, {
        enhancementType: 'amount',
        requestedAmount: amount,
        reason: reason || 'Coverage enhancement',
        source: 'case_ui',
      });
      toast.success('Enhancement draft created — submit to TPA before recording outcome');
      setShowCreate(false);
      await load();
    } catch (err) {
      toast.error(getApiErrorMessage(err, 'Create failed'));
    } finally {
      setBusy(false);
    }
  }

  async function onSubmit(id: string) {
    const ref = window.prompt('TPA reference (optional)') ?? undefined;
    setBusy(true);
    try {
      await submitEnhancement(id, { tpaReferenceNumber: ref || undefined });
      toast.success('Enhancement marked as sent to TPA');
      await load();
    } catch (err) {
      toast.error(getApiErrorMessage(err, 'Submit failed'));
    } finally {
      setBusy(false);
    }
  }

  async function onDecide(id: string, approved: boolean, requested: number, fromSubmitted: boolean) {
    const amount = approved
      ? Number(window.prompt('Additional approved amount (INR)', String(requested)) ?? '')
      : 0;
    if (approved && !(amount >= 0)) return;

    let hospitalOverride = false;
    let overrideReason: string | undefined;
    if (!fromSubmitted) {
      const ok = window.confirm(
        'This draft was not submitted to TPA. Record as hospital override? (audited)',
      );
      if (!ok) return;
      overrideReason = window.prompt('Override reason (required)') ?? '';
      if (!overrideReason.trim()) {
        toast.error('Override reason required');
        return;
      }
      hospitalOverride = true;
    }

    const tpaRef = fromSubmitted
      ? (window.prompt('TPA outcome reference (optional)') ?? undefined)
      : undefined;

    setBusy(true);
    try {
      await decideEnhancement(id, {
        approved,
        approvedAmount: amount,
        tpaReferenceNumber: tpaRef || undefined,
        hospitalOverride,
        overrideReason,
      });
      toast.success(approved ? 'Enhancement approved — coverage projection updated' : 'Enhancement rejected');
      await load();
    } catch (err) {
      toast.error(getApiErrorMessage(err, 'Decision failed'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="bg-white border border-gray-200 rounded-2xl p-4 space-y-3" data-testid="ccms-enhancement-panel">
      <div className="flex items-center justify-between gap-2">
        <div>
          <p className="text-sm font-bold text-gray-800">Coverage enhancements</p>
          <p className="text-[11px] text-gray-500">
            When eligible charges exceed approved coverage. Payer approval is never assumed.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => void load()}
            className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400"
            aria-label="Refresh"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          </button>
          {canWrite && !open && (
            <button
              type="button"
              data-testid="ccms-enhancement-request"
              onClick={() => setShowCreate(true)}
              className="inline-flex items-center gap-1 text-[11px] font-semibold px-2.5 py-1.5 rounded-xl bg-indigo-600 text-white"
            >
              <Plus className="w-3 h-3" /> Request
            </button>
          )}
        </div>
      </div>

      <div className="flex flex-wrap items-end gap-2">
        <label className="text-[10px] font-semibold uppercase tracking-wide text-gray-400">
          Eligible amount
          <input
            type="number"
            className="mt-1 block w-36 rounded-lg border border-gray-200 px-2 py-1.5 text-xs"
            value={eligibleInput}
            onChange={e => setEligibleInput(e.target.value)}
            onBlur={() => void load()}
          />
        </label>
        <p className="text-[11px] text-gray-500 pb-1.5">
          Case approved: <span className="font-semibold text-gray-700">{inr(caseApprovedAmount)}</span>
        </p>
      </div>

      {gap?.needsEnhancement && (
        <div className="flex gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-[11px] text-amber-900">
          <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
          <div>
            Gap {inr(gap.gapAmount)} — recommendation: <strong>{gap.recommendation.replace(/_/g, ' ')}</strong>
            {gap.hasOpenEnhancement ? ' (open request already exists).' : '.'}
          </div>
        </div>
      )}

      {showCreate && (
        <div className="rounded-xl border border-indigo-200 bg-indigo-50/40 p-3 space-y-2">
          <input
            type="number"
            placeholder="Requested additional amount"
            data-testid="ccms-enhancement-amount"
            className="w-full rounded-lg border border-gray-200 px-2 py-1.5 text-xs"
            value={requestAmount}
            onChange={e => setRequestAmount(e.target.value)}
          />
          <input
            type="text"
            placeholder="Reason"
            data-testid="ccms-enhancement-reason"
            className="w-full rounded-lg border border-gray-200 px-2 py-1.5 text-xs"
            value={reason}
            onChange={e => setReason(e.target.value)}
          />
          <div className="flex gap-2">
            <button
              type="button"
              disabled={busy}
              data-testid="ccms-enhancement-create-draft"
              onClick={() => void onCreate()}
              className="text-[11px] font-semibold px-3 py-1.5 rounded-lg bg-indigo-600 text-white disabled:opacity-50"
            >
              Create draft
            </button>
            <button
              type="button"
              onClick={() => setShowCreate(false)}
              className="text-[11px] font-semibold px-3 py-1.5 rounded-lg border border-gray-200"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="h-16 rounded-xl bg-gray-100 animate-pulse" />
      ) : rows.length === 0 ? (
        <p className="text-xs text-gray-400 py-2">No enhancement requests on this case.</p>
      ) : (
        <ul className="space-y-2">
          {rows.map(e => {
            const sc = statusLabel(e.status);
            return (
              <li key={e.id} data-testid={`ccms-enhancement-row-${e.status}`} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-gray-100 px-3 py-2">
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-gray-800">
                    {inr(e.requestedAmount)} · {e.enhancementType}
                  </p>
                  <p className="text-[11px] text-gray-500 truncate">{e.reason || '—'}</p>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${sc.cls}`}>{sc.text}</span>
                  {canWrite && e.status === 'active' && (
                    <button
                      type="button"
                      disabled={busy}
                      data-testid={`ccms-enhancement-submit-${e.id}`}
                      onClick={() => void onSubmit(e.id)}
                      className="inline-flex items-center gap-1 text-[10px] font-semibold text-indigo-700"
                    >
                      <Send className="w-3 h-3" /> Submit to TPA
                    </button>
                  )}
                  {canWrite && (e.status === 'submitted' || e.status === 'active') && (
                    <>
                      <button
                        type="button"
                        disabled={busy}
                        data-testid={`ccms-enhancement-approve-${e.id}`}
                        onClick={() => void onDecide(e.id, true, e.requestedAmount, e.status === 'submitted')}
                        className="inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-700"
                      >
                        <CheckCircle2 className="w-3 h-3" /> {e.status === 'submitted' ? 'TPA approve' : 'Override approve'}
                      </button>
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => void onDecide(e.id, false, 0, e.status === 'submitted')}
                        className="inline-flex items-center gap-1 text-[10px] font-semibold text-red-600"
                      >
                        <XCircle className="w-3 h-3" /> Reject
                      </button>
                    </>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

