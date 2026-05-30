'use client';

import React, { useState } from 'react';
import { X, CheckCircle2, RefreshCw } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { reconcileCase } from '@/lib/api/ccms/ccms-settlements.api';
import { useFocusTrap } from '@/hooks/useFocusTrap';

interface Props {
  caseId: string;
  caseNumber: string;
  totalClaimed: number;
  totalSettled: number;
  open: boolean;
  onClose: () => void;
  onReconciled: () => void;
}

export function ReconcileCaseModal({
  caseId, caseNumber, totalClaimed, totalSettled, open, onClose, onReconciled,
}: Props) {
  const [notes, setNotes] = useState('');
  const [confirmed, setConfirmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const containerRef = useFocusTrap(open);

  if (!open) return null;

  const discrepancy = totalClaimed - totalSettled;
  const hasDiscrepancy = Math.abs(discrepancy) > 0.01;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!confirmed) { toast.error('Please confirm before reconciling'); return; }
    setBusy(true);
    try {
      await reconcileCase(caseId, { reconcileNotes: notes || undefined });
      toast.success('Case reconciled');
      onReconciled();
      onClose();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } }; message?: string })
        ?.response?.data?.error ?? (err as { message?: string })?.message ?? 'Failed to reconcile';
      toast.error(msg);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
      role="dialog" aria-modal="true" aria-label="Reconcile Case">
      <div ref={containerRef} className="bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-green-600" />
            <div>
              <p className="text-sm font-bold text-gray-900">Reconcile Case</p>
              <p className="text-[11px] text-gray-400">Case {caseNumber}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400"><X className="w-4 h-4" /></button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {/* Financial summary */}
          <div className="rounded-xl bg-gray-50 border border-gray-200 p-4 space-y-2">
            <div className="flex justify-between text-xs">
              <span className="text-gray-500">Total Claimed</span>
              <span className="font-semibold text-gray-800">₹{totalClaimed.toLocaleString('en-IN')}</span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-gray-500">Total Settled</span>
              <span className="font-semibold text-green-700">₹{totalSettled.toLocaleString('en-IN')}</span>
            </div>
            <div className={`flex justify-between text-xs border-t border-gray-200 pt-2 mt-1 ${hasDiscrepancy ? 'text-amber-700' : 'text-green-700'}`}>
              <span className="font-semibold">Discrepancy</span>
              <span className="font-bold">
                {hasDiscrepancy ? `₹${Math.abs(discrepancy).toLocaleString('en-IN')} (${discrepancy > 0 ? 'underpaid' : 'overpaid'})` : 'None — fully settled'}
              </span>
            </div>
          </div>

          {hasDiscrepancy && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-xs text-amber-800">
              <p className="font-semibold mb-1">Discrepancy detected</p>
              <p>There is a difference between claimed and settled amounts. Please document the reason below before reconciling.</p>
            </div>
          )}

          {/* Notes */}
          <div>
            <label className="block text-[10px] font-semibold uppercase tracking-widest text-gray-400 mb-1">
              Reconciliation Notes{hasDiscrepancy && <span className="text-red-500 ml-0.5">*</span>}
            </label>
            <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={3}
              placeholder="Add discrepancy reasons, write-off notes, or close remarks…"
              required={hasDiscrepancy}
              className="w-full px-3 py-2 text-xs border border-gray-200 rounded-xl resize-none focus:outline-none focus:ring-2 focus:ring-indigo-400/40"
            />
          </div>

          {/* Confirm */}
          <label className="flex items-start gap-2 cursor-pointer select-none">
            <input type="checkbox" checked={confirmed} onChange={e => setConfirmed(e.target.checked)}
              className="mt-0.5 accent-green-600"
            />
            <span className="text-xs text-gray-600">
              I confirm that all financial records for this case are accurate and authorise reconciliation.
            </span>
          </label>

          {/* Footer */}
          <div className="flex gap-2">
            <button type="button" onClick={onClose}
              className="flex-1 py-2 text-xs font-semibold border border-gray-200 rounded-xl hover:bg-gray-50 text-gray-600">
              Cancel
            </button>
            <button type="submit" disabled={busy || !confirmed}
              className="flex-1 py-2 text-xs font-semibold bg-green-600 text-white rounded-xl hover:bg-green-700 disabled:opacity-50 flex items-center justify-center gap-1.5">
              {busy && <RefreshCw className="w-3 h-3 animate-spin" />}
              Reconcile
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
