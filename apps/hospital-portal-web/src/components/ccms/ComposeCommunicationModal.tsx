/**
 * @deprecated This modal is no longer used. The inline compose panel in
 * CaseCommunicationsTab replaces it entirely. Kept for reference only.
 */
'use client';

import React, { useEffect, useState } from 'react';
import { X, Send, Mail, MessageSquare, Phone } from 'lucide-react';
import { toast } from 'react-hot-toast';
import {
  getCommunicationTemplates,
  sendCommunication,
  type CommunicationTemplate,
  type SendCommunicationPayload,
} from '@/lib/api/ccms/ccms-communications.api';
import type { CounsellorDraftSnapshot } from '@/lib/api/ccms/parse-counsellor-draft';

interface Props {
  caseId: string;
  open: boolean;
  onClose: () => void;
  onSent: () => void;
  draft?: CounsellorDraftSnapshot | null;
  patientEmail?: string;
  patientPhone?: string;
}

const CHANNELS = [
  { id: 'email', label: 'Email', icon: Mail },
  { id: 'sms', label: 'SMS', icon: MessageSquare },
  { id: 'whatsapp', label: 'WhatsApp', icon: MessageSquare },
  { id: 'phone', label: 'Phone (log only)', icon: Phone },
  { id: 'in_person', label: 'In person (log only)', icon: Phone },
] as const;

const RECIPIENTS = [
  { id: 'tpa', label: 'TPA / Insurer' },
  { id: 'insurance', label: 'Insurance company' },
  { id: 'patient', label: 'Patient' },
  { id: 'internal', label: 'Internal (counsellor / billing / OT)' },
] as const;

export function ComposeCommunicationModal({
  caseId,
  open,
  onClose,
  onSent,
  draft,
  patientEmail,
  patientPhone,
}: Props) {
  const [channel, setChannel] = useState<SendCommunicationPayload['channel']>('email');
  const [recipientType, setRecipientType] = useState<SendCommunicationPayload['recipientType']>('tpa');
  const [recipientRef, setRecipientRef] = useState('');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [templates, setTemplates] = useState<CommunicationTemplate[]>([]);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    getCommunicationTemplates(channel === 'whatsapp' ? 'sms' : channel)
      .then(setTemplates)
      .catch(() => setTemplates([]));
  }, [open, channel]);

  useEffect(() => {
    if (!open) return;
    if (recipientType === 'tpa' || recipientType === 'insurance') {
      setRecipientRef(draft?.tpaContactEmail ?? draft?.tpaContactPhone ?? '');
    } else if (recipientType === 'patient') {
      setRecipientRef(patientEmail ?? patientPhone ?? '');
    } else {
      setRecipientRef('');
    }
  }, [open, recipientType, draft, patientEmail, patientPhone]);

  if (!open) return null;

  const applyTemplate = (t: CommunicationTemplate) => {
    if (t.subjectTemplate) setSubject(t.subjectTemplate);
    setBody(t.bodyTemplate);
  };

  const handleSend = async () => {
    if (!body.trim() && channel !== 'phone' && channel !== 'in_person') {
      toast.error('Message body is required');
      return;
    }
    setBusy(true);
    try {
      const result = await sendCommunication(caseId, {
        channel,
        recipientType,
        recipientRef: recipientRef || undefined,
        subject: subject || undefined,
        body,
      });
      if (result.success) {
        toast.success('Message sent and logged');
        onSent();
        onClose();
      } else {
        toast.error(result.error ?? 'Send failed — logged with error status');
        onSent();
        onClose();
      }
    } catch {
      toast.error('Could not send communication');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <p className="text-sm font-bold text-gray-800">Send communication</p>
          <button type="button" onClick={onClose} className="p-1 rounded-lg hover:bg-gray-100 text-gray-500">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          <div>
            <label className="text-[11px] font-semibold text-gray-600">Channel</label>
            <div className="flex flex-wrap gap-2 mt-1">
              {CHANNELS.map(c => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => setChannel(c.id)}
                  className={`text-[11px] font-semibold px-2.5 py-1.5 rounded-lg border transition-colors ${
                    channel === c.id
                      ? 'bg-indigo-600 text-white border-indigo-600'
                      : 'border-gray-200 text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  {c.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-[11px] font-semibold text-gray-600">Recipient</label>
            <select
              value={recipientType}
              onChange={e => setRecipientType(e.target.value as SendCommunicationPayload['recipientType'])}
              className="mt-1 w-full text-xs border border-gray-200 rounded-xl px-3 py-2"
            >
              {RECIPIENTS.map(r => (
                <option key={r.id} value={r.id}>{r.label}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-[11px] font-semibold text-gray-600">To (email / phone)</label>
            <input
              value={recipientRef}
              onChange={e => setRecipientRef(e.target.value)}
              className="mt-1 w-full text-xs border border-gray-200 rounded-xl px-3 py-2"
              placeholder="recipient@tpa.com or +91…"
            />
          </div>

          {templates.length > 0 && (
            <div>
              <label className="text-[11px] font-semibold text-gray-600">Template</label>
              <select
                className="mt-1 w-full text-xs border border-gray-200 rounded-xl px-3 py-2"
                defaultValue=""
                onChange={e => {
                  const t = templates.find(x => x.templateCode === e.target.value);
                  if (t) applyTemplate(t);
                }}
              >
                <option value="">— Select template —</option>
                {templates.map(t => (
                  <option key={t.id} value={t.templateCode}>{t.templateName ?? t.templateCode}</option>
                ))}
              </select>
            </div>
          )}

          {(channel === 'email') && (
            <div>
              <label className="text-[11px] font-semibold text-gray-600">Subject</label>
              <input
                value={subject}
                onChange={e => setSubject(e.target.value)}
                className="mt-1 w-full text-xs border border-gray-200 rounded-xl px-3 py-2"
              />
            </div>
          )}

          <div>
            <label className="text-[11px] font-semibold text-gray-600">Message</label>
            <textarea
              value={body}
              onChange={e => setBody(e.target.value)}
              rows={5}
              className="mt-1 w-full text-xs border border-gray-200 rounded-xl px-3 py-2"
              placeholder="Pre-auth request details…"
            />
          </div>

          <button
            type="button"
            onClick={handleSend}
            disabled={busy}
            className="w-full flex items-center justify-center gap-2 text-xs font-semibold py-2.5 rounded-xl bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50"
          >
            <Send className="w-3.5 h-3.5" />
            {busy ? 'Sending…' : 'Send & log'}
          </button>
        </div>
      </div>
    </div>
  );
}
