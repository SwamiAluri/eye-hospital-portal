'use client';

import React, { useState, useEffect } from 'react';
import { X, Landmark, RefreshCw } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { recordSettlement, type Settlement, type RecordSettlementRequest } from '@/lib/api/ccms/ccms-settlements.api';
import { useFocusTrap } from '@/hooks/useFocusTrap';

interface Props {
  caseId: string;
  claimAmount: number;          // total claimed
  alreadySettled: number;       // sum of previous settlements
  claimPacketId?: string;
  open: boolean;
  onClose: () => void;
  onRecorded: (settlement: Settlement) => void;
}

const PAYMENT_MODES = ['NEFT', 'RTGS', 'IMPS', 'Cheque', 'Cash'] as const;

function Label({ text, required }: { text: string; required?: boolean }) {
  return (
    <label className="block text-[10px] font-semibold uppercase tracking-widest text-gray-400 mb-1">
      {text}{required && <span className="text-red-500 ml-0.5">*</span>}
    </label>
  );
}

export function RecordSettlementModal({
  caseId, claimAmount, alreadySettled, claimPacketId, open, onClose, onRecorded,
}: Props) {
  const outstanding = Math.max(claimAmount - alreadySettled, 0);

  const [amount,    setAmount]    = useState(String(outstanding > 0 ? outstanding : ''));
  const [mode,      setMode]      = useState<typeof PAYMENT_MODES[number] | ''>('NEFT');
  const [utr,       setUtr]       = useState('');
  const [bankRef,   setBankRef]   = useState('');
  const [payDate,   setPayDate]   = useState('');
  const [remarks,   setRemarks]   = useState('');
  const [busy, setBusy] = useState(false);
  const containerRef = useFocusTrap(open);

  useEffect(() => {
    if (open) {
      const out = Math.max(claimAmount - alreadySettled, 0);
      setAmount(String(out > 0 ? out : ''));
      setMode('NEFT');
      setUtr('');
      setBankRef('');
      setPayDate('');
      setRemarks('');
    }
  }, [open, claimAmount, alreadySettled]);

  if (!open) return null;

  const settled    = parseFloat(amount) || 0;
  const remaining  = Math.max(outstanding - settled, 0);
  const isFullSettle = settled >= outstanding && outstanding > 0;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!settled || settled <= 0) { toast.error('Enter a valid settlement amount'); return; }
    if (settled > outstanding)    { toast.error(`Amount exceeds outstanding (₹${outstanding.toLocaleString('en-IN')})`); return; }
    setBusy(true);
    try {
      const req: RecordSettlementRequest = {
        claimPacketId,
        settledAmount:    settled,
        claimAmount,
        paymentMode:      mode || undefined,
        paymentReference: utr || undefined,
        paymentDate:      payDate || undefined,
        bankReference:    bankRef || undefined,
        remarks:          remarks || undefined,
      };
      const result = await recordSettlement(caseId, req);
      toast.success(isFullSettle ? 'Full settlement recorded' : 'Partial settlement recorded');
      onRecorded(result);
      onClose();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } }; message?: string })
        ?.response?.data?.error ?? (err as { message?: string })?.message ?? 'Failed to record settlement';
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
          <div className="flex items-center gap-2">
            <Landmark className="w-4 h-4 text-indigo-500" />
            <div>
              <p className="text-sm font-bold text-gray-900">Record Settlement</p>
              <p className="text-[11px] text-gray-400">Outstanding: ₹{outstanding.toLocaleString('en-IN')}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400"><X className="w-4 h-4" /></button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {/* Outstanding summary */}
          <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-3 grid grid-cols-3 gap-2 text-center">
            {[
              { label: 'Claimed',   value: claimAmount,     cls: 'text-gray-700' },
              { label: 'Settled',   value: alreadySettled,  cls: 'text-green-700' },
              { label: 'Outstanding', value: outstanding,   cls: 'text-red-700 font-bold' },
            ].map(({ label, value, cls }) => (
              <div key={label}>
                <p className="text-[9px] uppercase tracking-widest text-gray-400">{label}</p>
                <p className={`text-xs font-semibold ${cls}`}>₹{value.toLocaleString('en-IN')}</p>
              </div>
            ))}
          </div>

          {/* Amount */}
          <div>
            <Label text="Settlement Amount (₹)" required />
            <input type="number" min="0" max={outstanding} step="0.01" value={amount}
              onChange={e => setAmount(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-400/40 text-right font-semibold"
            />
            {settled > 0 && settled < outstanding && (
              <p className="text-[11px] text-amber-600 mt-1">
                Partial payment — ₹{remaining.toLocaleString('en-IN')} will remain outstanding
              </p>
            )}
            {isFullSettle && (
              <p className="text-[11px] text-green-600 mt-1 font-semibold">Full settlement — case will advance to Full Settlement state</p>
            )}
          </div>

          {/* Payment mode */}
          <div>
            <Label text="Payment Mode" />
            <div className="flex flex-wrap gap-2">
              {PAYMENT_MODES.map(m => (
                <button key={m} type="button" onClick={() => setMode(m)}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-lg border transition-colors ${
                    mode === m ? 'bg-indigo-600 text-white border-indigo-600' : 'border-gray-200 text-gray-600 hover:border-indigo-300'
                  }`}
                >
                  {m}
                </button>
              ))}
            </div>
          </div>

          {/* UTR / Reference */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label text="UTR / Reference No." />
              <input type="text" value={utr} onChange={e => setUtr(e.target.value)}
                placeholder="UTR number"
                className="w-full px-3 py-2 text-xs border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-400/40"
              />
            </div>
            <div>
              <Label text="Bank Reference" />
              <input type="text" value={bankRef} onChange={e => setBankRef(e.target.value)}
                placeholder="Bank ref no."
                className="w-full px-3 py-2 text-xs border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-400/40"
              />
            </div>
          </div>

          {/* Payment date */}
          <div>
            <Label text="Payment Date" />
            <input type="date" value={payDate} onChange={e => setPayDate(e.target.value)}
              className="w-full px-3 py-2 text-xs border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-400/40"
            />
          </div>

          {/* Remarks */}
          <div>
            <Label text="Remarks" />
            <textarea value={remarks} onChange={e => setRemarks(e.target.value)}
              rows={2} placeholder="Notes for finance team…"
              className="w-full px-3 py-2 text-xs border border-gray-200 rounded-xl resize-none focus:outline-none focus:ring-2 focus:ring-indigo-400/40"
            />
          </div>

          {/* Footer */}
          <div className="flex gap-2 pt-1">
            <button type="button" onClick={onClose}
              className="flex-1 py-2 text-xs font-semibold border border-gray-200 rounded-xl hover:bg-gray-50 text-gray-600">
              Cancel
            </button>
            <button type="submit" disabled={busy || !settled}
              className="flex-1 py-2 text-xs font-semibold bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 disabled:opacity-50 flex items-center justify-center gap-1.5">
              {busy && <RefreshCw className="w-3 h-3 animate-spin" />}
              Record Payment
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
