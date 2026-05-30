'use client';

import React, { useState } from 'react';
import { X, Lock, RefreshCw } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { closeCase } from '@/lib/api/ccms/ccms-settlements.api';
import { useFocusTrap } from '@/hooks/useFocusTrap';

interface Props {
  caseId: string;
  caseNumber: string;
  open: boolean;
  onClose: () => void;
  onClosed: () => void;
}

export function CloseCaseModal({ caseId, caseNumber, open, onClose, onClosed }: Props) {
  const [confirmed, setConfirmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const containerRef = useFocusTrap(open);

  if (!open) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!confirmed) {
      toast.error('Please confirm before closing the case');
      return;
    }
    setBusy(true);
    try {
      await closeCase(caseId);
      toast.success('Case closed');
      onClosed();
      onClose();
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { error?: string } } })?.response?.data?.error
        ?? (err as { message?: string })?.message
        ?? 'Failed to close case';
      toast.error(msg);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
      role="dialog"
      aria-modal="true"
      aria-label="Close Case"
    >
      <div ref={containerRef} className="bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <Lock className="w-4 h-4 text-gray-700" />
            <div>
              <p className="text-sm font-bold text-gray-900">Close Case</p>
              <p className="text-[11px] text-gray-400">Case {caseNumber}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400">
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <p className="text-xs text-gray-600">
            This case has been reconciled. Closing marks it as complete and prevents further financial actions.
          </p>

          <label className="flex items-start gap-2 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={confirmed}
              onChange={e => setConfirmed(e.target.checked)}
              className="mt-0.5 accent-gray-700"
            />
            <span className="text-xs text-gray-600">
              I confirm reconciliation is complete and authorise closing this case.
            </span>
          </label>

          <div className="flex gap-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2 text-xs font-semibold border border-gray-200 rounded-xl hover:bg-gray-50 text-gray-600"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={busy || !confirmed}
              className="flex-1 py-2 text-xs font-semibold bg-gray-800 text-white rounded-xl hover:bg-gray-900 disabled:opacity-50 flex items-center justify-center gap-1.5"
            >
              {busy && <RefreshCw className="w-3 h-3 animate-spin" />}
              Close Case
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
