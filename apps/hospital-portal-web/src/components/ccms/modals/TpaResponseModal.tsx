'use client';

import React, { useEffect, useState } from 'react';
import { X, CheckCircle, RefreshCw, AlertCircle, MessageSquare, GitBranch } from 'lucide-react';
import { toast } from 'react-hot-toast';
import {
  recordTpaResponse,
  addClarificationQuery,
  type PreAuthorization,
  type TpaResponseRequest,
} from '@/lib/api/ccms/ccms-authorizations.api';
import type { CoverageCase } from '@/lib/api/ccms/ccms-coverage-cases.api';
import type { CounsellorDraftSnapshot } from '@/lib/api/ccms/parse-counsellor-draft';
import { resolveDisplayAmounts } from '@/lib/ccms/build-preauth-prefill';
import type { TpaResponsePrefill } from '@/lib/ccms/tpa-response-prefill';
import { useFocusTrap } from '@/hooks/useFocusTrap';

type Decision = 'APPROVED' | 'PARTIAL' | 'REJECTED' | 'CLARIFICATION';

interface Props {
  auth: PreAuthorization;
  case_?: CoverageCase | null;
  draft?: CounsellorDraftSnapshot | null;
  prefill?: TpaResponsePrefill | null;
  open: boolean;
  onClose: () => void;
  onSaved: (updated: PreAuthorization) => void;
}

const DECISIONS: { value: Decision; label: string; cls: string; icon: React.ReactNode }[] = [
  { value: 'APPROVED',      label: 'Approved',             cls: 'border-green-400 bg-green-50 text-green-800',   icon: <CheckCircle  className="w-4 h-4 text-green-600" /> },
  { value: 'PARTIAL',       label: 'Partial Approval',     cls: 'border-purple-400 bg-purple-50 text-purple-800', icon: <GitBranch    className="w-4 h-4 text-purple-600" /> },
  { value: 'REJECTED',      label: 'Rejected',             cls: 'border-red-400 bg-red-50 text-red-800',         icon: <AlertCircle  className="w-4 h-4 text-red-600" /> },
  { value: 'CLARIFICATION', label: 'Clarification Needed', cls: 'border-amber-400 bg-amber-50 text-amber-800',   icon: <MessageSquare className="w-4 h-4 text-amber-600" /> },
];

const ROOM_CLASSES = ['General', 'Twin Sharing', 'Semi-Private', 'Private', 'Suite'];

function Label({ text, required }: { text: string; required?: boolean }) {
  return (
    <label className="block text-[10px] font-semibold uppercase tracking-widest text-gray-400 mb-1">
      {text}{required && <span className="text-red-500 ml-0.5">*</span>}
    </label>
  );
}

function Field({ children }: { children: React.ReactNode }) {
  return <div className="space-y-1">{children}</div>;
}

export function TpaResponseModal({ auth, case_, draft, prefill, open, onClose, onSaved }: Props) {
  const [decision,      setDecision]      = useState<Decision | ''>('');
  const [approvedAmount, setApprovedAmount] = useState('');
  const [rejectedAmount, setRejectedAmount] = useState('');
  const [roomClass,     setRoomClass]     = useState(auth.roomClassApproved ?? '');
  const [tpaRef,        setTpaRef]        = useState(auth.tpaReferenceNumber ?? '');
  const [preAuthNo,     setPreAuthNo]     = useState(auth.preAuthNumber ?? '');
  const [validFrom,     setValidFrom]     = useState('');
  const [validUntil,    setValidUntil]    = useState('');
  const [rejectReason,  setRejectReason]  = useState('');
  const [clarNotes,     setClarNotes]     = useState('');
  const [busy, setBusy] = useState(false);
  const containerRef = useFocusTrap(open);

  const displayRequested = case_
    ? resolveDisplayAmounts(auth, case_, draft ?? undefined).requested
    : auth.requestedAmount;

  useEffect(() => {
    if (!open) return;
    setDecision('');
    setApprovedAmount(auth.approvedAmount > 0 ? String(auth.approvedAmount) : '');
    setRejectedAmount('');
    setRoomClass(auth.roomClassApproved ?? '');
    setTpaRef(auth.tpaReferenceNumber ?? '');
    setPreAuthNo(auth.preAuthNumber ?? '');
    setValidFrom('');
    setValidUntil('');
    setRejectReason('');
    setClarNotes('');

    if (prefill) {
      if (prefill.decision) setDecision(prefill.decision);
      if (prefill.approvedAmount != null) setApprovedAmount(String(prefill.approvedAmount));
      if (prefill.preAuthNumber) setPreAuthNo(prefill.preAuthNumber);
      if (prefill.tpaRef) setTpaRef(prefill.tpaRef);
      if (prefill.rejectReason) setRejectReason(prefill.rejectReason);
      if (prefill.clarNotes) setClarNotes(prefill.clarNotes);
      if (!prefill.approvedAmount && displayRequested > 0
          && (prefill.decision === 'APPROVED' || prefill.decision === 'PARTIAL')) {
        setApprovedAmount(String(displayRequested));
      }
    } else if (displayRequested > 0 && !approvedAmount) {
      setApprovedAmount(String(displayRequested));
    }
  }, [open, auth.id, prefill, displayRequested]);

  if (!open) return null;

  const needsAmount   = decision === 'APPROVED' || decision === 'PARTIAL';
  const needsReject   = decision === 'REJECTED';
  const needsClarific = decision === 'CLARIFICATION';
  const fromEmail     = prefill?.source === 'email_parse';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!decision) { toast.error('Select a decision'); return; }
    if (needsAmount && !approvedAmount) { toast.error('Enter approved amount'); return; }
    if (needsReject && !rejectReason)   { toast.error('Enter rejection reason'); return; }
    if (needsClarific && !clarNotes)    { toast.error('Enter the TPA clarification query'); return; }

    setBusy(true);
    try {
      const req: TpaResponseRequest = {
        actionType:         decision === 'APPROVED' ? 'Approve'
                          : decision === 'PARTIAL'  ? 'PartiallyApprove'
                          : decision === 'REJECTED' ? 'Deny'
                          : 'QueryRaise',
        decision,
        approvedAmount:     needsAmount   ? Number(approvedAmount) : undefined,
        roomClassApproved:  roomClass     || undefined,
        preAuthNumber:      preAuthNo     || undefined,
        tpaReferenceNumber: tpaRef        || undefined,
        validFrom:          validFrom     || undefined,
        validUntil:         validUntil    || undefined,
        rejectionReason:    needsReject   ? rejectReason
                          : decision === 'PARTIAL' && rejectedAmount
                            ? `Partial approval. Disallowed: ₹${rejectedAmount}`
                            : undefined,
        eventSource:        fromEmail ? 'email_parse' : 'manual',
      };

      const updated = await recordTpaResponse(auth.id, {
        ...req,
        notes: needsClarific ? clarNotes : req.rejectionReason,
      });

      if (needsClarific && clarNotes.trim()) {
        try {
          await addClarificationQuery(auth.id, clarNotes.trim());
        } catch {
          /* RecordTpaResponse may have already created clarification server-side */
        }
      }

      toast.success(fromEmail ? 'TPA response applied from email draft' : `Response recorded — ${decision}`);
      onSaved(updated);
      onClose();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } }; message?: string })
        ?.response?.data?.error ?? (err as { message?: string })?.message ?? 'Failed to record response';
      toast.error(msg);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div ref={containerRef} role="dialog" aria-modal="true" className="bg-white rounded-2xl shadow-2xl w-full max-w-lg mx-4 max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 flex-shrink-0">
          <div>
            <p className="text-sm font-bold text-gray-900">Record TPA Response</p>
            <p className="text-[11px] text-gray-400 mt-0.5">
              {auth.preAuthNumber ?? `Auth ${auth.id.slice(0, 8)}`} · Requested ₹{displayRequested.toLocaleString('en-IN')}
            </p>
          </div>
          <button type="button" onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400">
            <X className="w-4 h-4" />
          </button>
        </div>

        {fromEmail && (
          <div className="mx-5 mt-3 px-3 py-2 bg-indigo-50 border border-indigo-100 rounded-xl text-xs text-indigo-800">
            Parsed from inbound email — review all fields before saving.
          </div>
        )}

        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-5 space-y-4">
          <Field>
            <Label text="TPA Decision" required />
            <div className="grid grid-cols-2 gap-2">
              {DECISIONS.map(d => (
                <button
                  key={d.value}
                  type="button"
                  onClick={() => setDecision(d.value)}
                  className={`flex items-center gap-2 px-3 py-2.5 rounded-xl border-2 text-xs font-semibold transition-all ${
                    decision === d.value ? d.cls + ' ring-2 ring-offset-1 ring-indigo-400' : 'border-gray-200 text-gray-600 hover:border-gray-300'
                  }`}
                >
                  {d.icon}{d.label}
                </button>
              ))}
            </div>
          </Field>

          {needsAmount && (
            <div className="grid grid-cols-2 gap-3">
              <Field>
                <Label text="Approved Amount (₹)" required />
                <input
                  type="number" min="0" value={approvedAmount}
                  onChange={e => setApprovedAmount(e.target.value)}
                  placeholder="0"
                  className="w-full px-3 py-2 text-xs border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-400/40 text-right"
                />
              </Field>
              {decision === 'PARTIAL' && (
                <Field>
                  <Label text="Rejected Amount (₹)" />
                  <input
                    type="number" min="0" value={rejectedAmount}
                    onChange={e => setRejectedAmount(e.target.value)}
                    placeholder="0"
                    className="w-full px-3 py-2 text-xs border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-400/40 text-right"
                  />
                </Field>
              )}
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <Field>
              <Label text="Pre-Auth Number" />
              <input
                type="text" value={preAuthNo}
                onChange={e => setPreAuthNo(e.target.value)}
                placeholder="TPA issued number"
                className="w-full px-3 py-2 text-xs border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-400/40"
              />
            </Field>
            <Field>
              <Label text="TPA Reference No." />
              <input
                type="text" value={tpaRef}
                onChange={e => setTpaRef(e.target.value)}
                placeholder="Reference #"
                className="w-full px-3 py-2 text-xs border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-400/40"
              />
            </Field>
          </div>

          {needsAmount && (
            <>
              <Field>
                <Label text="Room Class Approved" />
                <select
                  value={roomClass} onChange={e => setRoomClass(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-400/40 bg-white"
                >
                  <option value="">— Not specified —</option>
                  {ROOM_CLASSES.map(r => <option key={r} value={r}>{r}</option>)}
                </select>
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field>
                  <Label text="Valid From" />
                  <input type="date" value={validFrom} onChange={e => setValidFrom(e.target.value)}
                    className="w-full px-3 py-2 text-xs border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-400/40"
                  />
                </Field>
                <Field>
                  <Label text="Valid Until" />
                  <input type="date" value={validUntil} onChange={e => setValidUntil(e.target.value)}
                    className="w-full px-3 py-2 text-xs border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-400/40"
                  />
                </Field>
              </div>
            </>
          )}

          {needsReject && (
            <Field>
              <Label text="Rejection Reason" required />
              <textarea
                value={rejectReason} onChange={e => setRejectReason(e.target.value)}
                rows={3} placeholder="State the reason provided by TPA / insurer…"
                className="w-full px-3 py-2 text-xs border border-gray-200 rounded-xl resize-none focus:outline-none focus:ring-2 focus:ring-indigo-400/40"
              />
            </Field>
          )}

          {needsClarific && (
            <Field>
              <Label text="Clarification Query from TPA" required />
              <textarea
                value={clarNotes} onChange={e => setClarNotes(e.target.value)}
                rows={3} placeholder="What has the TPA asked for…"
                className="w-full px-3 py-2 text-xs border border-gray-200 rounded-xl resize-none focus:outline-none focus:ring-2 focus:ring-indigo-400/40"
              />
            </Field>
          )}
        </form>

        <div className="px-5 py-4 border-t border-gray-100 flex gap-2 flex-shrink-0">
          <button
            type="button" onClick={onClose}
            className="flex-1 py-2 text-xs font-semibold border border-gray-200 rounded-xl hover:bg-gray-50 text-gray-600"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit as unknown as React.MouseEventHandler}
            disabled={busy || !decision}
            className="flex-1 py-2 text-xs font-semibold bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 disabled:opacity-50 flex items-center justify-center gap-1.5"
          >
            {busy && <RefreshCw className="w-3 h-3 animate-spin" />}
            Save Response
          </button>
        </div>
      </div>
    </div>
  );
}
