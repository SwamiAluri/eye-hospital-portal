'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { Mail, Paperclip, Send, X, RefreshCw, CheckCircle2 } from 'lucide-react';
import { toast } from 'react-hot-toast';
import type { CoverageCase } from '@/lib/api/ccms/ccms-coverage-cases.api';
import type { PreAuthorization } from '@/lib/api/ccms/ccms-authorizations.api';
import { submitAuth, getPreAuthByCaseId } from '@/lib/api/ccms/ccms-authorizations.api';
import type { CounsellorDraftSnapshot } from '@/lib/api/ccms/parse-counsellor-draft';
import type { CcmsCommunicationLog } from '@/lib/api/ccms/ccms-communications.api';
import { sendCommunication } from '@/lib/api/ccms/ccms-communications.api';
import { useCcmsCaseDocuments, type CaseDocument } from '@/hooks/use-ccms-case';
import { INTAKE_DOC_SLOTS } from '@/lib/ccms/ccms-document-slots';
import { buildCommsContext, generateSmartDraft } from '@/lib/ccms/ccms-comms-templates';
import { resolveTpaEmail, resolveDisplayAmounts } from '@/lib/ccms/build-preauth-prefill';
import { isPendingPreAuth } from '@/lib/ccms/ccms-visit-policy-prereq';
import type { VisitPolicy } from '@/lib/api/ccms/visit-policies.api';
import type { InsurancePayer, TpaOrganization } from '@/lib/api/ccms/ccms-master-data.api';
import { useFocusTrap } from '@/hooks/useFocusTrap';

interface Props {
  case_: CoverageCase;
  auth: PreAuthorization;
  draft?: CounsellorDraftSnapshot | null;
  comms?: CcmsCommunicationLog[];
  primaryPolicy?: VisitPolicy | null;
  payers?: InsurancePayer[];
  tpas?: TpaOrganization[];
  /** Pre-loaded intake documents from React Query cache. */
  intakeDocuments?: CaseDocument[];
  intakeDocumentsLoading?: boolean;
  /** When true, renders as a centered modal overlay */
  modal?: boolean;
  open?: boolean;
  onClose?: () => void;
  onSent: () => void;
}

const INTAKE_KEYS = new Set(INTAKE_DOC_SLOTS.map(s => s.key));

function slotLabel(documentType: string): string {
  const slot = INTAKE_DOC_SLOTS.find(s => s.key === documentType);
  return slot?.label ?? documentType.replace(/_/g, ' ');
}

function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

export function PreAuthEmailComposer({
  case_,
  auth,
  draft,
  comms = [],
  primaryPolicy,
  payers = [],
  tpas = [],
  intakeDocuments,
  intakeDocumentsLoading,
  modal = false,
  open = true,
  onClose,
  onSent,
}: Props) {
  const containerRef = useFocusTrap(modal && open);
  const [to, setTo] = useState('');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [recipientType, setRecipientType] = useState<'tpa' | 'insurance'>('tpa');
  const [tpaRef, setTpaRef] = useState('');
  const ownDocsQuery = useCcmsCaseDocuments(intakeDocuments === undefined ? case_.id : null);
  const allDocuments = intakeDocuments ?? ownDocsQuery.data ?? [];
  const docsLoading = intakeDocuments !== undefined
    ? (intakeDocumentsLoading ?? false)
    : ownDocsQuery.isLoading;
  const documents = useMemo(
    () => allDocuments.filter(d => d.isActive && INTAKE_KEYS.has(d.documentType)),
    [allDocuments],
  );
  const [selectedDocIds, setSelectedDocIds] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);

  const ctx = useMemo(
    () => buildCommsContext(case_, draft, comms, recipientType),
    [case_, draft, comms, recipientType],
  );

  const displayAmounts = useMemo(
    () => resolveDisplayAmounts(auth, case_, draft),
    [auth, case_, draft],
  );

  useEffect(() => {
    const resolved = resolveTpaEmail(draft, case_, payers, tpas, primaryPolicy);
    setTo(resolved.email);
    setRecipientType(resolved.recipientType);

    const state = case_.currentState === 'PREAUTH_GENERATED' ? 'PREAUTH_GENERATED' : 'AUTHORIZATION_REQUIRED';
    const draftEmail = generateSmartDraft(state, 'email', resolved.recipientType, ctx);

    const { requested, estimated } = resolveDisplayAmounts(auth, case_, draft);
    const financialBlock = [
      '',
      'Pre-authorization details:',
      requested > 0 ? `  Requested amount : ₹${requested.toLocaleString('en-IN')}` : '',
      estimated > 0 ? `  Estimated cost   : ₹${estimated.toLocaleString('en-IN')}` : '',
      auth.treatingDoctorName ? `  Treating doctor  : ${auth.treatingDoctorName}` : '',
      auth.admissionDate ? `  Admission date   : ${new Date(auth.admissionDate).toLocaleDateString('en-IN')}` : '',
      (auth.roomClassRequested || auth.roomTypeRequested)
        ? `  Room class       : ${auth.roomClassRequested ?? auth.roomTypeRequested}` : '',
    ].filter(Boolean).join('\n');

    setSubject(draftEmail.subject);
    setBody(`${draftEmail.body}${financialBlock}`);
  }, [case_, draft, comms, auth, ctx, payers, tpas, primaryPolicy]);

  useEffect(() => {
    setSelectedDocIds(new Set(documents.map(d => d.id)));
  }, [documents]);

  function toggleDoc(id: string) {
    setSelectedDocIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    const trimmedTo = to.trim();
    if (!trimmedTo) {
      toast.error('Recipient email is required — enter the TPA or insurer claims email');
      return;
    }
    if (!isValidEmail(trimmedTo)) {
      toast.error('Enter a valid email address for the TPA / insurer');
      return;
    }

    setBusy(true);
    let emailOk = false;

    try {
      // Resolve auth from server first — composer may hold stale id if generate didn't persist
      let authToSubmit = auth;
      try {
        const list = await getPreAuthByCaseId(case_.id);
        const hit = list.find(a => a.id === auth.id)
          ?? list.find(isPendingPreAuth);
        if (hit) authToSubmit = hit;
        else if (list.length === 0) {
          toast.error('No pre-authorization record found. Complete Generate Pre-Auth (all 3 tabs → Submit), then send.');
          return;
        }
      } catch {
        /* use local auth */
      }

      const selected = documents.filter(d => selectedDocIds.has(d.id));
      let finalBody = body;
      if (selected.length > 0) {
        finalBody += '\n\nAttached documents:\n'
          + selected.map(d => `  • ${slotLabel(d.documentType)}: ${d.fileName}${d.url ? ` (${d.url})` : ''}`).join('\n');
      }

      try {
        const commResult = await sendCommunication(case_.id, {
          channel: 'email',
          recipientType,
          recipientRef: trimmedTo,
          subject,
          body: finalBody,
          direction: 'outbound',
        });
        emailOk = commResult.success;
        if (!commResult.success) {
          toast.error(
            commResult.error
              ? `Email not delivered: ${commResult.error}`
              : 'Email dispatch failed — logged in Comms tab',
            { duration: 6000 },
          );
        }
      } catch (commErr: unknown) {
        const commMsg = (commErr as { message?: string })?.message ?? 'Email dispatch failed';
        toast.error(`Email not sent (${commMsg}).`, { duration: 6000 });
      }

      const alreadySent = Boolean(authToSubmit.submittedAt)
        || authToSubmit.status.toUpperCase() === 'SENT';

      if (!emailOk && !alreadySent) {
        toast.error('Pre-auth was not marked sent — fix the email and try again, or use the Comms tab.', { duration: 7000 });
        return;
      }

      if (!alreadySent) {
        await submitAuth(authToSubmit.id, { tpaReferenceNumber: tpaRef.trim() || undefined });
        toast.success('Pre-auth sent to TPA/Insurer');
      } else if (emailOk) {
        toast.success('Email sent — pre-auth was already submitted to TPA');
      } else {
        toast.error('Email not delivered — see Comms tab for details');
        return;
      }

      onSent();
      onClose?.();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } }; message?: string })
        ?.response?.data?.error ?? (err as { message?: string })?.message ?? 'Failed to mark pre-auth sent';
      toast.error(msg);
    } finally {
      setBusy(false);
    }
  }

  if (!open) return null;

  const inner = (
    <form onSubmit={handleSend} className="space-y-4">
      <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-3 space-y-1">
        <div className="flex justify-between text-xs">
          <span className="text-gray-500">Pre-auth request</span>
          <span className="font-semibold text-gray-800">
            {displayAmounts.requested > 0
              ? `₹${displayAmounts.requested.toLocaleString('en-IN')}`
              : '—'}
          </span>
        </div>
        {auth.treatingDoctorName && (
          <div className="flex justify-between text-xs">
            <span className="text-gray-500">Treating doctor</span>
            <span className="text-gray-700">{auth.treatingDoctorName}</span>
          </div>
        )}
      </div>

      <div>
        <label className="block text-[10px] font-semibold uppercase tracking-widest text-gray-400 mb-1">
          To (TPA / Insurer)
        </label>
        {!to.trim() && (
          <p className="text-xs text-amber-700 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2 mb-2">
            No TPA email on file — enter the claims desk address manually (check payer master data or policy documents).
          </p>
        )}
        <input
          type="email"
          required
          value={to}
          onChange={e => setTo(e.target.value)}
          placeholder="claims@tpa.com"
          className="w-full px-3 py-2 text-xs border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-400/40"
        />
      </div>

      <div>
        <label className="block text-[10px] font-semibold uppercase tracking-widest text-gray-400 mb-1">
          Subject
        </label>
        <input
          type="text"
          required
          value={subject}
          onChange={e => setSubject(e.target.value)}
          className="w-full px-3 py-2 text-xs border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-400/40"
        />
      </div>

      <div>
        <label className="block text-[10px] font-semibold uppercase tracking-widest text-gray-400 mb-1">
          Message
        </label>
        <textarea
          required
          rows={12}
          value={body}
          onChange={e => setBody(e.target.value)}
          className="w-full px-3 py-2 text-xs border border-gray-200 rounded-xl resize-y focus:outline-none focus:ring-2 focus:ring-indigo-400/40 font-mono leading-relaxed"
        />
      </div>

      <div>
        <div className="flex items-center gap-1.5 mb-2">
          <Paperclip className="w-3.5 h-3.5 text-gray-400" />
          <label className="text-[10px] font-semibold uppercase tracking-widest text-gray-400">
            Attachments (patient documents)
          </label>
        </div>
        {docsLoading ? (
          <p className="text-xs text-gray-400 italic">Loading documents…</p>
        ) : documents.length === 0 ? (
          <p className="text-xs text-amber-600 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2">
            No intake documents uploaded yet. Upload from the Overview tab before sending.
          </p>
        ) : (
          <ul className="space-y-1.5 max-h-36 overflow-y-auto border border-gray-100 rounded-xl p-2">
            {documents.map(doc => (
              <li key={doc.id}>
                <label className="flex items-start gap-2 cursor-pointer select-none text-xs py-1 px-1 rounded-lg hover:bg-gray-50">
                  <input
                    type="checkbox"
                    checked={selectedDocIds.has(doc.id)}
                    onChange={() => toggleDoc(doc.id)}
                    className="mt-0.5 accent-indigo-600"
                  />
                  <span className="min-w-0">
                    <span className="font-medium text-gray-800 block truncate">{slotLabel(doc.documentType)}</span>
                    <span className="text-gray-400 truncate block">{doc.fileName}</span>
                  </span>
                  {selectedDocIds.has(doc.id) && (
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 flex-shrink-0 ml-auto" />
                  )}
                </label>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div>
        <label className="block text-[10px] font-semibold uppercase tracking-widest text-gray-400 mb-1">
          TPA Reference No. <span className="normal-case font-normal">(optional)</span>
        </label>
        <input
          type="text"
          value={tpaRef}
          onChange={e => setTpaRef(e.target.value)}
          placeholder="e.g. TPA/2026/XXXXX"
          className="w-full px-3 py-2 text-xs border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-400/40"
        />
      </div>

      <label className="flex items-start gap-2 cursor-pointer select-none">
        <input type="checkbox" required className="mt-0.5 accent-indigo-600" />
        <span className="text-xs text-gray-600">
          I confirm this pre-authorization is complete and ready to be sent to the TPA / insurer.
        </span>
      </label>

      <div className="flex gap-2 pt-1">
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            className="flex-1 py-2 text-xs font-semibold border border-gray-200 rounded-xl hover:bg-gray-50 text-gray-600 transition-colors"
          >
            {modal ? 'Cancel' : 'Send later'}
          </button>
        )}
        <button
          type="submit"
          disabled={busy}
          className="flex-1 py-2 text-xs font-semibold bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 disabled:opacity-50 transition-colors flex items-center justify-center gap-1.5"
        >
          {busy ? <RefreshCw className="w-3 h-3 animate-spin" /> : <Send className="w-3 h-3" />}
          Send to TPA / Insurer
        </button>
      </div>
    </form>
  );

  if (modal) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
        <div ref={containerRef} role="dialog" aria-modal="true" className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
          <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 sticky top-0 bg-white z-10">
            <div className="flex items-center gap-2">
              <Mail className="w-4 h-4 text-indigo-600" />
              <div>
                <p className="text-sm font-bold text-gray-900">Send Pre-Auth to TPA / Insurer</p>
                <p className="text-[11px] text-gray-400 mt-0.5">
                  {auth.preAuthNumber ?? `₹${auth.requestedAmount.toLocaleString('en-IN')} requested`}
                </p>
              </div>
            </div>
            <button type="button" onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400">
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="p-5">{inner}</div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white border border-indigo-200 rounded-2xl overflow-hidden">
      <div className="flex items-center gap-2 px-5 py-3 border-b border-indigo-100 bg-indigo-50/50">
        <Mail className="w-4 h-4 text-indigo-600" />
        <div>
          <p className="text-sm font-bold text-indigo-900">Send to TPA / Insurer</p>
          <p className="text-[11px] text-indigo-500">Review the generated email, select attachments, then send.</p>
        </div>
      </div>
      <div className="p-5">{inner}</div>
    </div>
  );
}
