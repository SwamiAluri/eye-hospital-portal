'use client';

import React, { useState } from 'react';
import { FileText, Send, CheckCircle, Clock, AlertCircle, X } from 'lucide-react';
import { toast } from 'react-hot-toast';
import type { ClaimPacket } from '@/lib/api/ccms/ccms-claims.api';
import { generateClaimPacket, submitClaim, acknowledgeClaim } from '@/lib/api/ccms/ccms-claims.api';

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function inr(n: number) {
  return '₹' + n.toLocaleString('en-IN', { minimumFractionDigits: 2 });
}

function StatusChip({ status }: { status: string }) {
  const cfg: Record<string, { label: string; cls: string; icon: React.ReactNode }> = {
    draft:        { label: 'Draft',        cls: 'bg-gray-100 text-gray-600',    icon: <FileText  className="w-3 h-3" /> },
    ready:        { label: 'Ready',        cls: 'bg-blue-50 text-blue-700',     icon: <CheckCircle className="w-3 h-3" /> },
    submitted:    { label: 'Submitted',    cls: 'bg-indigo-50 text-indigo-700', icon: <Send       className="w-3 h-3" /> },
    acknowledged: { label: 'Acknowledged', cls: 'bg-green-50 text-green-700',  icon: <CheckCircle className="w-3 h-3" /> },
    rejected:     { label: 'Rejected',     cls: 'bg-red-50 text-red-700',      icon: <AlertCircle className="w-3 h-3" /> },
  };
  const c = cfg[status?.toLowerCase()] ?? cfg.draft;
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium ${c.cls}`}>
      {c.icon}{c.label}
    </span>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────────────────────

interface Props {
  caseId: string;
  claim: ClaimPacket | null;
  onUpdate: () => void;
  canSubmit?: boolean;
  canAcknowledge?: boolean;
  loading?: boolean;
}

export function ClaimSubmissionForm({
  caseId: _caseId,
  claim,
  onUpdate,
  canSubmit = true,
  canAcknowledge = true,
  loading: externalLoading,
}: Props) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Submission form
  const [submissionMethod, setSubmissionMethod] = useState<'Portal' | 'Email' | 'Physical'>('Portal');
  const [referenceNumber, setReferenceNumber] = useState('');

  // Acknowledge form
  const [tpaAckRef, setTpaAckRef] = useState('');
  const [showAckForm, setShowAckForm] = useState(false);

  const status = claim?.status?.toLowerCase() ?? '';

  async function handleGenerate() {
    if (!claim) return;
    setBusy(true); setError(null);
    try {
      const updated = await generateClaimPacket(claim.id);
      onUpdate();
      toast.success(`Packet generated — ${updated.claimNumber}`);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to generate packet.');
    } finally { setBusy(false); }
  }

  async function handleSubmit() {
    if (!claim) return;
    setBusy(true); setError(null);
    try {
      await submitClaim(claim.id, {
        submissionMethod,
        referenceNumber: referenceNumber || undefined,
      });
      onUpdate();
      toast.success('Claim submitted to TPA');
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to submit claim.');
    } finally { setBusy(false); }
  }

  async function handleAcknowledge() {
    if (!claim) return;
    setBusy(true); setError(null);
    try {
      await acknowledgeClaim(claim.id, {
        tpaAckReference: tpaAckRef || undefined,
      });
      setShowAckForm(false);
      onUpdate();
      toast.success('TPA acknowledgement recorded');
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to record acknowledgement.');
    } finally { setBusy(false); }
  }

  const isLoading = busy || externalLoading;

  if (!claim) {
    return (
      <div className="rounded-xl border border-gray-200 p-8 text-center">
        <FileText className="w-8 h-8 text-gray-300 mx-auto mb-2" />
        <p className="text-sm text-gray-500">No claim packet generated yet.</p>
        <p className="text-xs text-gray-400 mt-1">Use Generate Claim above after bill allocation is complete.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Claim summary card */}
      <div className="rounded-xl border border-gray-100 bg-white divide-y divide-gray-50">
        <div className="flex items-center justify-between px-4 py-3">
          <div>
            <p className="text-xs text-gray-500">Claim Number</p>
            <p className="text-sm font-semibold text-gray-900 font-mono">{claim.claimNumber}</p>
          </div>
          <StatusChip status={claim.status} />
        </div>
        <div className="grid grid-cols-2 gap-0 divide-x divide-gray-50">
          <div className="px-4 py-3">
            <p className="text-[10px] text-gray-400">Claimed Amount</p>
            <p className="text-sm font-bold text-indigo-700">{inr(claim.claimedAmount)}</p>
          </div>
          <div className="px-4 py-3">
            <p className="text-[10px] text-gray-400">Submitted At</p>
            <p className="text-sm text-gray-700">
              {claim.submittedAt
                ? new Date(claim.submittedAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
                : '—'}
            </p>
          </div>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="flex items-start gap-2 rounded-lg bg-red-50 border border-red-100 p-3">
          <AlertCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
          <p className="text-xs text-red-700 flex-1">{error}</p>
          <button onClick={() => setError(null)}><X className="w-3.5 h-3.5 text-red-400" /></button>
        </div>
      )}

      {/* State-dependent actions */}
      {status === 'draft' && (
        <div className="rounded-xl border border-blue-100 bg-blue-50 p-4">
          <p className="text-xs text-blue-700 font-medium mb-2">Claim packet is in draft.</p>
          <p className="text-xs text-blue-600 mb-3">Generate the final packet to lock the claim documents before submission.</p>
          <button
            onClick={handleGenerate}
            disabled={isLoading}
            className="px-4 py-1.5 rounded-lg bg-blue-600 text-white text-xs font-medium hover:bg-blue-700 disabled:opacity-50 flex items-center gap-1.5"
          >
            <FileText className="w-3.5 h-3.5" />
            {isLoading ? 'Generating…' : 'Generate Packet'}
          </button>
        </div>
      )}

      {status === 'ready' && canSubmit && (
        <div className="rounded-xl border border-indigo-100 bg-indigo-50 p-4 space-y-3">
          <p className="text-xs text-indigo-700 font-medium">Packet ready — submit to TPA / insurer.</p>
          <div className="space-y-2">
            <div>
              <label className="block text-[10px] text-indigo-600 mb-1">Submission Method</label>
              <select
                value={submissionMethod}
                onChange={e => setSubmissionMethod(e.target.value as typeof submissionMethod)}
                className="w-full rounded-lg border border-indigo-200 px-3 py-1.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-400"
              >
                <option value="Portal">TPA Portal</option>
                <option value="Email">Email</option>
                <option value="Physical">Physical Copy</option>
              </select>
            </div>
            <div>
              <label className="block text-[10px] text-indigo-600 mb-1">Reference Number (optional)</label>
              <input
                type="text"
                placeholder="Portal / courier / email ref."
                value={referenceNumber}
                onChange={e => setReferenceNumber(e.target.value)}
                className="w-full rounded-lg border border-indigo-200 px-3 py-1.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-400"
              />
            </div>
          </div>
          <button
            onClick={handleSubmit}
            disabled={isLoading}
            className="px-4 py-1.5 rounded-lg bg-indigo-600 text-white text-xs font-medium hover:bg-indigo-700 disabled:opacity-50 flex items-center gap-1.5"
          >
            <Send className="w-3.5 h-3.5" />
            {isLoading ? 'Submitting…' : 'Submit Claim'}
          </button>
        </div>
      )}

      {status === 'submitted' && canAcknowledge && (
        <div className="rounded-xl border border-green-100 bg-green-50 p-4 space-y-3">
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-green-600" />
            <p className="text-xs text-green-700 font-medium">
              Claim submitted — awaiting TPA acknowledgement.
            </p>
          </div>

          {!showAckForm ? (
            <button
              onClick={() => setShowAckForm(true)}
              className="text-xs text-green-700 underline"
            >
              Record TPA Acknowledgement
            </button>
          ) : (
            <div className="space-y-2">
              <div>
                <label className="block text-[10px] text-green-600 mb-1">TPA Acknowledgement Ref.</label>
                <input
                  type="text"
                  placeholder="TPA claim number / ack. ref."
                  value={tpaAckRef}
                  onChange={e => setTpaAckRef(e.target.value)}
                  className="w-full rounded-lg border border-green-200 px-3 py-1.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-green-400"
                />
              </div>
              <div className="flex gap-2">
                <button
                  onClick={handleAcknowledge}
                  disabled={isLoading}
                  className="px-4 py-1.5 rounded-lg bg-green-600 text-white text-xs font-medium hover:bg-green-700 disabled:opacity-50 flex items-center gap-1.5"
                >
                  <CheckCircle className="w-3.5 h-3.5" />
                  {isLoading ? 'Saving…' : 'Save Acknowledgement'}
                </button>
                <button
                  onClick={() => setShowAckForm(false)}
                  className="text-xs text-gray-500 hover:text-gray-700"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {status === 'rejected' && (
        <div className="flex items-start gap-2 rounded-xl border border-red-100 bg-red-50 p-4">
          <AlertCircle className="w-5 h-5 text-red-600 shrink-0" />
          <div>
            <p className="text-xs text-red-700 font-medium">Claim rejected by TPA.</p>
            <p className="text-[10px] text-red-600 mt-0.5">Review rejection details with the insurance cell and resubmit if applicable.</p>
          </div>
        </div>
      )}

      {status === 'acknowledged' && (
        <div className="flex items-center gap-2 rounded-xl border border-green-100 bg-green-50 p-4">
          <CheckCircle className="w-5 h-5 text-green-600 shrink-0" />
          <div>
            <p className="text-xs text-green-700 font-medium">TPA acknowledged the claim.</p>
            <p className="text-[10px] text-green-600">Awaiting TPA review and settlement decision.</p>
          </div>
        </div>
      )}
    </div>
  );
}
