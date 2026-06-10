'use client';

import { useState } from 'react';
import { useMasterValues } from '@/hooks/use-master-values';
import { masterLabelForValue } from '@/lib/master-data/appointment-master';

interface Props {
  open: boolean;
  title?: string;
  description?: string;
  onClose: () => void;
  onConfirm: (reason: string) => void | Promise<void>;
  confirming?: boolean;
}

export function AppointmentCancelDialog({
  open,
  title = 'Cancel appointment',
  description = 'Select a cancellation reason from Master Data.',
  onClose,
  onConfirm,
  confirming = false,
}: Props) {
  const { options: cancelReasons, loading } = useMasterValues('appointment.cancel_reason');
  const [reasonCode, setReasonCode] = useState('');

  if (!open) return null;

  const handleConfirm = () => {
    if (!reasonCode) return;
    const label = masterLabelForValue(cancelReasons, reasonCode);
    void onConfirm(label || reasonCode);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-5 space-y-4">
        <div>
          <h3 className="text-sm font-bold text-gray-900">{title}</h3>
          <p className="text-xs text-gray-500 mt-1">{description}</p>
        </div>
        <div>
          <label className="block text-[10px] font-semibold uppercase tracking-widest text-gray-400 mb-1">
            Cancellation reason
          </label>
          <select
            value={reasonCode}
            onChange={(e) => setReasonCode(e.target.value)}
            disabled={loading || confirming}
            className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-400/30 bg-white"
          >
            <option value="">{loading ? 'Loading…' : '— select reason —'}</option>
            {cancelReasons.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>
        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={confirming}
            className="px-3 py-1.5 text-xs font-medium border border-gray-200 rounded-lg hover:bg-gray-50"
          >
            Back
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={!reasonCode || confirming}
            className="px-3 py-1.5 text-xs font-semibold bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50"
          >
            {confirming ? 'Cancelling…' : 'Confirm cancel'}
          </button>
        </div>
      </div>
    </div>
  );
}
