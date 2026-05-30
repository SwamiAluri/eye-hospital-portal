'use client';

import React, { useState, useEffect } from 'react';
import { X, FileText, RefreshCw, CheckCircle } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { createClaim, generateClaimPacket, submitClaim, type ClaimPacket } from '@/lib/api/ccms/ccms-claims.api';
import { useFocusTrap } from '@/hooks/useFocusTrap';

interface Props {
  caseId: string;
  billedAmount: number;
  approvedAmount: number;
  open: boolean;
  onClose: () => void;
  onUpdated: () => void;
}

type Step = 'draft' | 'generated' | 'submitted';

const STEP_ORDER: Step[] = ['draft', 'generated', 'submitted'];

export function GenerateClaimModal({
  caseId, billedAmount, approvedAmount, open, onClose, onUpdated,
}: Props) {
  const [step,        setStep]        = useState<Step>('draft');
  const [amount,      setAmount]      = useState('');
  const [notes,       setNotes]       = useState('');
  const [subMethod,   setSubMethod]   = useState<'Portal' | 'Email' | 'Physical'>('Portal');
  const [subRef,      setSubRef]      = useState('');
  const [claim,       setClaim]       = useState<ClaimPacket | null>(null);
  const [busy, setBusy] = useState(false);
  const containerRef = useFocusTrap(open);

  useEffect(() => {
    if (open) {
      setStep('draft');
      setAmount(String(approvedAmount > 0 ? approvedAmount : billedAmount || ''));
      setNotes('');
      setSubMethod('Portal');
      setSubRef('');
      setClaim(null);
    }
  }, [open, approvedAmount, billedAmount]);

  const handleClose = () => {
    if (claim && step !== 'draft') onUpdated();
    onClose();
  };

  if (!open) return null;

  const stepIndex = (s: Step) => STEP_ORDER.indexOf(s);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!amount || Number(amount) <= 0) { toast.error('Enter claim amount'); return; }
    setBusy(true);
    try {
      const created = await createClaim({ caseId, claimedAmount: Number(amount), notes: notes || undefined });
      const generated = await generateClaimPacket(created.id);
      setClaim(generated);
      setStep('generated');
      toast.success('Claim packet generated');
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } }; message?: string })
        ?.response?.data?.error ?? (err as { message?: string })?.message ?? 'Failed to create claim';
      toast.error(msg);
    } finally {
      setBusy(false);
    }
  };

  const handleSubmit = async () => {
    if (!claim) return;
    setBusy(true);
    try {
      await submitClaim(claim.id, {
        submissionMethod: subMethod,
        referenceNumber:  subRef || undefined,
      });
      setStep('submitted');
      toast.success('Claim submitted');
      onUpdated();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } }; message?: string })
        ?.response?.data?.error ?? (err as { message?: string })?.message ?? 'Failed to submit claim';
      toast.error(msg);
    } finally {
      setBusy(false);
    }
  };

  const steps: { key: Step; label: string }[] = [
    { key: 'draft',     label: '1 Draft' },
    { key: 'generated', label: '2 Generated' },
    { key: 'submitted', label: '3 Submitted' },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div ref={containerRef} role="dialog" aria-modal="true" className="bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <FileText className="w-4 h-4 text-indigo-500" />
            <p className="text-sm font-bold text-gray-900">Generate Claim</p>
          </div>
          <button onClick={handleClose} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400"><X className="w-4 h-4" /></button>
        </div>

        {/* Step indicator */}
        <div className="px-5 pt-4 flex items-center gap-0">
          {steps.map((s, i) => (
            <React.Fragment key={s.key}>
              <div className={`flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider ${
                step === s.key ? 'text-indigo-600' : stepIndex(step) > stepIndex(s.key) ? 'text-green-600' : 'text-gray-300'
              }`}>
                {stepIndex(step) > stepIndex(s.key)
                  ? <CheckCircle className="w-3.5 h-3.5" />
                  : <span className={`w-4 h-4 rounded-full border-2 flex items-center justify-center text-[9px] font-bold ${
                      step === s.key ? 'border-indigo-600 bg-indigo-600 text-white' : 'border-gray-200 text-gray-300'
                    }`}>{i + 1}</span>
                }
                {s.label}
              </div>
              {i < steps.length - 1 && <div className="flex-1 h-px bg-gray-200 mx-1" />}
            </React.Fragment>
          ))}
        </div>

        <div className="p-5 space-y-4">
          {step === 'draft' && (
            <form onSubmit={handleCreate} className="space-y-4">
              {/* Amount summary */}
              <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-3 grid grid-cols-2 gap-2 text-center">
                <div>
                  <p className="text-[9px] uppercase tracking-widest text-gray-400">Bill Total</p>
                  <p className="text-xs font-semibold text-gray-700">₹{billedAmount.toLocaleString('en-IN')}</p>
                </div>
                <div>
                  <p className="text-[9px] uppercase tracking-widest text-gray-400">Approved</p>
                  <p className="text-xs font-semibold text-indigo-700">₹{approvedAmount.toLocaleString('en-IN')}</p>
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-semibold uppercase tracking-widest text-gray-400 mb-1">
                  Claim Amount (₹)<span className="text-red-500 ml-0.5">*</span>
                </label>
                <input type="number" min="0" value={amount} onChange={e => setAmount(e.target.value)}
                  className="w-full px-3 py-2 text-sm font-semibold border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-400/40 text-right"
                />
                <p className="text-[10px] text-gray-400 mt-1">Typically set to approved amount. Can be adjusted.</p>
              </div>

              <div>
                <label className="block text-[10px] font-semibold uppercase tracking-widest text-gray-400 mb-1">Notes</label>
                <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2}
                  placeholder="Any notes for the claim packet…"
                  className="w-full px-3 py-2 text-xs border border-gray-200 rounded-xl resize-none focus:outline-none focus:ring-2 focus:ring-indigo-400/40"
                />
              </div>

              <div className="flex gap-2">
                <button type="button" onClick={handleClose}
                  className="flex-1 py-2 text-xs font-semibold border border-gray-200 rounded-xl hover:bg-gray-50 text-gray-600">
                  Cancel
                </button>
                <button type="submit" disabled={busy}
                  className="flex-1 py-2 text-xs font-semibold bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 disabled:opacity-50 flex items-center justify-center gap-1.5">
                  {busy && <RefreshCw className="w-3 h-3 animate-spin" />}
                  Generate Packet
                </button>
              </div>
            </form>
          )}

          {step === 'generated' && claim && (
            <div className="space-y-4">
              <div className="rounded-xl bg-green-50 border border-green-200 p-4 flex items-center gap-3">
                <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0" />
                <div>
                  <p className="text-xs font-semibold text-green-800">Claim packet generated</p>
                  <p className="text-[11px] text-green-700 mt-0.5">Claim #{claim.claimNumber} · ₹{claim.claimedAmount.toLocaleString('en-IN')}</p>
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-semibold uppercase tracking-widest text-gray-400 mb-2">
                  Submission Method
                </label>
                <div className="flex gap-2">
                  {(['Portal', 'Email', 'Physical'] as const).map(m => (
                    <button key={m} type="button" onClick={() => setSubMethod(m)}
                      className={`flex-1 py-2 text-xs font-semibold rounded-xl border transition-colors ${
                        subMethod === m ? 'bg-indigo-600 text-white border-indigo-600' : 'border-gray-200 text-gray-600 hover:border-indigo-300'
                      }`}
                    >{m}</button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-semibold uppercase tracking-widest text-gray-400 mb-1">
                  Reference / Tracking No. <span className="normal-case font-normal text-gray-400">(optional)</span>
                </label>
                <input type="text" value={subRef} onChange={e => setSubRef(e.target.value)}
                  placeholder="Portal submission ID or courier tracking #"
                  className="w-full px-3 py-2 text-xs border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-400/40"
                />
              </div>

              <div className="flex gap-2">
                <button type="button" onClick={handleClose}
                  className="flex-1 py-2 text-xs font-semibold border border-gray-200 rounded-xl hover:bg-gray-50 text-gray-600">
                  Close
                </button>
                <button onClick={handleSubmit} disabled={busy}
                  className="flex-1 py-2 text-xs font-semibold bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 disabled:opacity-50 flex items-center justify-center gap-1.5">
                  {busy && <RefreshCw className="w-3 h-3 animate-spin" />}
                  Submit Claim
                </button>
              </div>
            </div>
          )}

          {step === 'submitted' && claim && (
            <div className="space-y-4">
              <div className="rounded-xl bg-green-50 border border-green-200 p-4 text-center">
                <CheckCircle className="w-8 h-8 text-green-600 mx-auto mb-2" />
                <p className="text-sm font-bold text-green-800">Claim Submitted</p>
                <p className="text-xs text-green-700 mt-1">#{claim.claimNumber} · ₹{claim.claimedAmount.toLocaleString('en-IN')}</p>
              </div>
              <button onClick={handleClose}
                className="w-full py-2.5 text-xs font-semibold bg-gray-100 text-gray-700 rounded-xl hover:bg-gray-200">
                Close
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
