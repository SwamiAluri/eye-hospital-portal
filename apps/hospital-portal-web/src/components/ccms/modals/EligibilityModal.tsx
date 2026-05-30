'use client';

import React, { useState, useEffect } from 'react';
import { X, CheckCircle2, XCircle, RefreshCw, ShieldCheck, Calendar } from 'lucide-react';
import { toast } from 'react-hot-toast';
import {
  createEligibilityCheck, getEligibilityChecks,
  type EligibilityCheck, type CreateEligibilityCheckRequest,
} from '@/lib/api/ccms/ccms-eligibility.api';
import { useFocusTrap } from '@/hooks/useFocusTrap';

interface Props {
  caseId: string;
  policyNumber?: string;
  open: boolean;
  onClose: () => void;
  onVerified?: (check: EligibilityCheck) => void;
}

const METHOD_OPTIONS: { value: 'manual' | 'api' | 'portal'; label: string }[] = [
  { value: 'manual',  label: 'Manual (phone/letter)' },
  { value: 'portal',  label: 'TPA Portal' },
  { value: 'api',     label: 'API / EDI' },
];

export function EligibilityModal({ caseId, policyNumber, open, onClose, onVerified }: Props) {
  const [step,           setStep]           = useState<'check' | 'history'>('check');
  const [policyNum,      setPolicyNum]      = useState(policyNumber ?? '');
  const [membershipId,   setMembershipId]   = useState('');
  const [isEligible,     setIsEligible]     = useState<boolean | null>(null);
  const [checkMethod,    setCheckMethod]    = useState<'manual' | 'api' | 'portal'>('manual');
  const [responseCode,   setResponseCode]   = useState('');
  const [notes,          setNotes]          = useState('');
  const [busy,           setBusy]           = useState(false);
  const [history,        setHistory]        = useState<EligibilityCheck[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const containerRef = useFocusTrap(open);

  useEffect(() => {
    if (open) {
      setPolicyNum(policyNumber ?? '');
      setStep('check');
    }
  }, [open, policyNumber]);

  useEffect(() => {
    if (open && step === 'history') {
      setHistoryLoading(true);
      getEligibilityChecks(caseId)
        .then(setHistory)
        .catch(() => toast.error('Failed to load history'))
        .finally(() => setHistoryLoading(false));
    }
  }, [open, step, caseId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!policyNum.trim()) { toast.error('Policy number is required'); return; }
    if (isEligible === null) { toast.error('Please select eligibility status'); return; }

    setBusy(true);
    try {
      const req: CreateEligibilityCheckRequest = {
        policyNumber:         policyNum.trim(),
        membershipId:         membershipId || undefined,
        isEligible,
        checkMethod,
        responseCode:         responseCode || undefined,
        eligibilityResponseJson: notes ? JSON.stringify({ notes }) : undefined,
      };
      const result = await createEligibilityCheck(caseId, req);
      toast.success(`Eligibility ${isEligible ? 'verified' : 'marked ineligible'}`);
      onVerified?.(result);
      onClose();
    } catch {
      toast.error('Failed to record eligibility check');
    } finally {
      setBusy(false);
    }
  };

  if (!open) return null;

  const inp = 'w-full px-3 py-2 text-xs border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-400/30';
  const sel = inp + ' bg-white';

  return (
    <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center bg-black/30 p-4">
      <div ref={containerRef} role="dialog" aria-modal="true" className="bg-white rounded-2xl shadow-2xl w-full max-w-md flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-indigo-500" />
            <div>
              <h2 className="text-sm font-bold text-gray-900">Eligibility Verification</h2>
              <p className="text-[10px] text-gray-400">Check and record insurance eligibility</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-xl hover:bg-gray-100 text-gray-400">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-100">
          {(['check', 'history'] as const).map(t => (
            <button key={t} onClick={() => setStep(t)}
              className={`flex-1 py-2.5 text-[11px] font-semibold flex items-center justify-center gap-1 ${
                step === t ? 'border-b-2 border-indigo-500 text-indigo-700' : 'text-gray-400 hover:text-gray-600'
              }`}>
              {t === 'check' ? <><ShieldCheck className="w-3 h-3" />New Check</> : <><Calendar className="w-3 h-3" />History</>}
            </button>
          ))}
        </div>

        {step === 'check' ? (
          <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-5 space-y-4">
            <div>
              <label className="text-[10px] font-semibold text-gray-500 uppercase tracking-widest block mb-1">
                Policy Number <span className="text-red-500">*</span>
              </label>
              <input value={policyNum} onChange={e => setPolicyNum(e.target.value)}
                className={inp} placeholder="Policy number" />
            </div>

            <div>
              <label className="text-[10px] font-semibold text-gray-500 uppercase tracking-widest block mb-1">
                Membership / Card ID
              </label>
              <input value={membershipId} onChange={e => setMembershipId(e.target.value)}
                className={inp} placeholder="Optional" />
            </div>

            <div>
              <label className="text-[10px] font-semibold text-gray-500 uppercase tracking-widest block mb-1">
                Check Method
              </label>
              <select value={checkMethod} onChange={e => setCheckMethod(e.target.value as any)} className={sel}>
                {METHOD_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>

            <div>
              <label className="text-[10px] font-semibold text-gray-500 uppercase tracking-widest block mb-2">
                Eligibility Status <span className="text-red-500">*</span>
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button type="button" onClick={() => setIsEligible(true)}
                  className={`flex items-center justify-center gap-2 py-2.5 rounded-xl border text-xs font-semibold transition-colors ${
                    isEligible === true
                      ? 'bg-green-600 border-green-600 text-white'
                      : 'border-gray-200 text-gray-600 hover:bg-green-50 hover:border-green-200'
                  }`}>
                  <CheckCircle2 className="w-3.5 h-3.5" />Eligible
                </button>
                <button type="button" onClick={() => setIsEligible(false)}
                  className={`flex items-center justify-center gap-2 py-2.5 rounded-xl border text-xs font-semibold transition-colors ${
                    isEligible === false
                      ? 'bg-red-600 border-red-600 text-white'
                      : 'border-gray-200 text-gray-600 hover:bg-red-50 hover:border-red-200'
                  }`}>
                  <XCircle className="w-3.5 h-3.5" />Not Eligible
                </button>
              </div>
            </div>

            <div>
              <label className="text-[10px] font-semibold text-gray-500 uppercase tracking-widest block mb-1">
                Response Code / Reference
              </label>
              <input value={responseCode} onChange={e => setResponseCode(e.target.value)}
                className={inp} placeholder="TPA response code or reference" />
            </div>

            <div>
              <label className="text-[10px] font-semibold text-gray-500 uppercase tracking-widest block mb-1">
                Notes
              </label>
              <textarea value={notes} onChange={e => setNotes(e.target.value)}
                rows={2} className={`${inp} resize-none`}
                placeholder="Additional notes about the eligibility check…" />
            </div>

            <button type="submit" disabled={busy || isEligible === null}
              className="w-full py-2.5 text-xs font-bold rounded-xl bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50 flex items-center justify-center gap-2">
              {busy ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <ShieldCheck className="w-3.5 h-3.5" />}
              {busy ? 'Saving…' : 'Record Eligibility Check'}
            </button>
          </form>
        ) : (
          <div className="flex-1 overflow-y-auto p-4 space-y-2">
            {historyLoading
              ? Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="h-12 animate-pulse bg-gray-100 rounded-xl" />
                ))
              : history.length === 0
                ? (
                  <div className="text-center py-8">
                    <ShieldCheck className="w-8 h-8 text-gray-300 mx-auto mb-2" />
                    <p className="text-xs text-gray-400">No eligibility checks recorded yet.</p>
                  </div>
                )
                : history.map(c => (
                  <div key={c.id}
                    className={`rounded-xl border p-3 flex items-start justify-between ${
                      c.isEligible ? 'bg-green-50 border-green-100' : 'bg-red-50 border-red-100'
                    }`}>
                    <div>
                      <p className="text-xs font-semibold text-gray-800">{c.policyNumber}</p>
                      <p className="text-[10px] text-gray-500 mt-0.5">
                        {c.checkMethod} · {new Date(c.checkedAt).toLocaleDateString('en-IN', {
                          day: '2-digit', month: 'short', year: '2-digit', hour: '2-digit', minute: '2-digit',
                        })}
                        {c.responseCode && ` · ${c.responseCode}`}
                      </p>
                    </div>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full flex-shrink-0 ${
                      c.isEligible ? 'bg-green-600 text-white' : 'bg-red-600 text-white'
                    }`}>
                      {c.isEligible ? 'Eligible' : 'Ineligible'}
                    </span>
                  </div>
                ))
            }
          </div>
        )}
      </div>
    </div>
  );
}
