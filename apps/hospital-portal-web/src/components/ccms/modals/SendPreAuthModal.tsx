'use client';

import React, { useState } from 'react';
import { X, Send, RefreshCw } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { submitAuth, type PreAuthorization } from '@/lib/api/ccms/ccms-authorizations.api';
import { useFocusTrap } from '@/hooks/useFocusTrap';

interface Props {
  auth: PreAuthorization;
  open: boolean;
  onClose: () => void;
  onSent: (updated: PreAuthorization) => void;
}

export function SendPreAuthModal({ auth, open, onClose, onSent }: Props) {
  const [tpaRef, setTpaRef]   = useState('');
  const [notes, setNotes]     = useState('');
  const [busy,  setBusy]      = useState(false);
  const containerRef = useFocusTrap(open);

  if (!open) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      const updated = await submitAuth(auth.id, { tpaReferenceNumber: tpaRef || undefined });
      toast.success('Pre-auth sent to TPA');
      setTpaRef(''); setNotes('');
      onSent(updated);
      onClose();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } }; message?: string })
        ?.response?.data?.error ?? (err as { message?: string })?.message ?? 'Failed to send';
      toast.error(msg);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div ref={containerRef} role="dialog" aria-modal="true" className="bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <div>
            <p className="text-sm font-bold text-gray-900">Send to TPA</p>
            <p className="text-[11px] text-gray-400 mt-0.5">
              {auth.preAuthNumber ?? `Pre-auth for ₹${auth.requestedAmount.toLocaleString('en-IN')}`}
            </p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400">
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {/* Request summary */}
          <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-3 space-y-1">
            <div className="flex justify-between text-xs">
              <span className="text-gray-500">Requested amount</span>
              <span className="font-semibold text-gray-800">₹{auth.requestedAmount.toLocaleString('en-IN')}</span>
            </div>
            {auth.roomClassRequested && (
              <div className="flex justify-between text-xs">
                <span className="text-gray-500">Room class</span>
                <span className="text-gray-700">{auth.roomClassRequested}</span>
              </div>
            )}
          </div>

          {/* TPA ref (optional at send time) */}
          <div>
            <label className="block text-[10px] font-semibold uppercase tracking-widest text-gray-400 mb-1">
              TPA Reference No. <span className="normal-case font-normal text-gray-400">(optional)</span>
            </label>
            <input
              type="text"
              value={tpaRef}
              onChange={e => setTpaRef(e.target.value)}
              placeholder="e.g. TPA/2026/XXXXX"
              className="w-full px-3 py-2 text-xs border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-400/40"
            />
          </div>

          {/* Notes */}
          <div>
            <label className="block text-[10px] font-semibold uppercase tracking-widest text-gray-400 mb-1">
              Notes <span className="normal-case font-normal">(optional)</span>
            </label>
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              rows={2}
              placeholder="Additional instructions or notes for TPA…"
              className="w-full px-3 py-2 text-xs border border-gray-200 rounded-xl resize-none focus:outline-none focus:ring-2 focus:ring-indigo-400/40"
            />
          </div>

          {/* Confirm checkbox */}
          <label className="flex items-start gap-2 cursor-pointer select-none">
            <input type="checkbox" required className="mt-0.5 accent-indigo-600" />
            <span className="text-xs text-gray-600">
              I confirm this pre-authorization request is complete and ready to be transmitted to the TPA / insurer.
            </span>
          </label>

          {/* Footer */}
          <div className="flex gap-2 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2 text-xs font-semibold border border-gray-200 rounded-xl hover:bg-gray-50 text-gray-600 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={busy}
              className="flex-1 py-2 text-xs font-semibold bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 disabled:opacity-50 transition-colors flex items-center justify-center gap-1.5"
            >
              {busy ? <RefreshCw className="w-3 h-3 animate-spin" /> : <Send className="w-3 h-3" />}
              Send to TPA
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
