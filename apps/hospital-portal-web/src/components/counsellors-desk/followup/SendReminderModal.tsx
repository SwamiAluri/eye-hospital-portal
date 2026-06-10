'use client';

import { useState, useEffect, useMemo } from 'react';
import { X, MessageSquare, Mail, Smartphone, Send } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { counsellorsDeskApi } from '@/lib/api/counsellors-desk.api';
import type { SendReminderPayload } from '@/types/counsellors-desk';
import { useCounsellorMasterOptions } from '@/hooks/use-counsellor-master-options';
import {
  commChannelCodeToApi,
  filterReminderChannelOptions,
  templateFromMasterOption,
} from '@/lib/counsellors-desk/counsellor-master-maps';

interface SendReminderModalProps {
  isOpen: boolean;
  onClose: () => void;
  patientId: string;
  patientName: string;
  phone: string | null;
  journeyId?: string;
  onSent?: () => void;
}

const FALLBACK_REMINDER_TYPES = [
  { value: 'APPOINTMENT', label: 'Appointment Reminder' },
  { value: 'FOLLOW_UP', label: 'Follow-Up Reminder' },
  { value: 'PRE_OP_DAY', label: 'Pre-Op Day Reminder' },
];

const FALLBACK_CHANNELS = [
  { value: 'SMS', label: 'SMS' },
  { value: 'WHATSAPP', label: 'WhatsApp' },
  { value: 'EMAIL', label: 'Email' },
];

export default function SendReminderModal({
  isOpen,
  onClose,
  patientId,
  patientName,
  phone,
  journeyId,
  onSent,
}: SendReminderModalProps) {
  const { commChannelOptions, reminderTypeOptions } = useCounsellorMasterOptions();

  const channelChoices = useMemo(() => {
    const fromMaster = filterReminderChannelOptions(commChannelOptions);
    return fromMaster.length > 0
      ? fromMaster.map((o) => ({ value: o.value, label: o.label }))
      : FALLBACK_CHANNELS;
  }, [commChannelOptions]);

  const reminderChoices = useMemo(
    () =>
      reminderTypeOptions.length > 0
        ? reminderTypeOptions
        : FALLBACK_REMINDER_TYPES,
    [reminderTypeOptions],
  );

  const firstName = patientName.split(' ')[0] || patientName;

  const [channelCode, setChannelCode] = useState('SMS');
  const [reminderCode, setReminderCode] = useState('APPOINTMENT');
  const [message, setMessage] = useState('');
  const [saving, setSaving] = useState(false);
  const [charCount, setCharCount] = useState(0);

  useEffect(() => {
    if (!isOpen) return;
    if (channelChoices.length > 0) setChannelCode(channelChoices[0].value);
    if (reminderChoices.length > 0) setReminderCode(reminderChoices[0].value);
  }, [isOpen, channelChoices, reminderChoices]);

  useEffect(() => {
    if (!isOpen) return;
    const opt = reminderChoices.find((o) => o.value === reminderCode) ?? reminderChoices[0];
    if (!opt) return;
    const template = templateFromMasterOption(opt, firstName);
    setMessage(template);
    setCharCount(template.length);
  }, [reminderCode, reminderChoices, firstName, isOpen]);

  useEffect(() => {
    setCharCount(message.length);
  }, [message]);

  if (!isOpen) return null;

  const apiChannel = commChannelCodeToApi(channelCode) as SendReminderPayload['channel'];

  const handleSend = async () => {
    if (!message.trim()) return;
    setSaving(true);
    try {
      const payload: SendReminderPayload = {
        channel: apiChannel,
        messageType: reminderCode,
        message,
        ...(journeyId ? { journeyId } : {}),
      };
      await counsellorsDeskApi.sendReminder(patientId, payload);
      toast.success(`Reminder sent via ${apiChannel} to ${patientName}`);
      onSent?.();
      onClose();
    } catch {
      toast.error('Failed to send reminder. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const channelColor: Record<string, string> = {
    SMS: 'border-blue-500 bg-blue-50 text-blue-700',
    WhatsApp: 'border-emerald-500 bg-emerald-50 text-emerald-700',
    Email: 'border-violet-500 bg-violet-50 text-violet-700',
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg mx-4 overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 bg-gradient-to-r from-violet-50 to-indigo-50">
          <div>
            <h2 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
              <Send className="w-4 h-4 text-violet-600" />
              Send Reminder
            </h2>
            <p className="text-xs text-gray-500 mt-0.5">
              {patientName}
              {phone ? <span className="ml-2 text-gray-400 font-mono">{phone}</span> : ''}
            </p>
          </div>
          <button type="button" onClick={onClose} className="p-1.5 rounded-lg hover:bg-white/70 transition-colors">
            <X className="w-4 h-4 text-gray-500" />
          </button>
        </div>

        <div className="px-5 py-4 space-y-4">
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
              Channel
            </label>
            <div className="flex gap-2 flex-wrap">
              {channelChoices.map((c) => {
                const api = commChannelCodeToApi(c.value);
                const icon =
                  api === 'Email' ? (
                    <Mail className="w-3.5 h-3.5" />
                  ) : api === 'WhatsApp' ? (
                    <MessageSquare className="w-3.5 h-3.5" />
                  ) : (
                    <Smartphone className="w-3.5 h-3.5" />
                  );
                return (
                  <button
                    key={c.value}
                    type="button"
                    onClick={() => setChannelCode(c.value)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border transition-all ${
                      channelCode === c.value
                        ? (channelColor[api] ?? 'border-violet-400 bg-violet-50 text-violet-700')
                        : 'border-gray-200 text-gray-500 hover:border-gray-300 bg-white'
                    }`}
                  >
                    {icon}
                    {c.label}
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
              Reminder Type
            </label>
            <div className="flex flex-wrap gap-1.5">
              {reminderChoices.map((t) => (
                <button
                  key={t.value}
                  type="button"
                  onClick={() => setReminderCode(t.value)}
                  className={`px-2.5 py-1 rounded-md text-xs font-medium border transition-all ${
                    reminderCode === t.value
                      ? 'border-violet-400 bg-violet-50 text-violet-700'
                      : 'border-gray-200 text-gray-500 hover:border-gray-300 bg-white'
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide">
                Message
              </label>
              <span className={`text-xs ${charCount > 160 ? 'text-amber-600' : 'text-gray-400'}`}>
                {charCount}
                {apiChannel === 'SMS' ? '/160 chars' : ''}
              </span>
            </div>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={5}
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-violet-400 resize-none leading-relaxed"
              placeholder="Enter reminder message…"
            />
            {apiChannel === 'SMS' && charCount > 160 && (
              <p className="text-xs text-amber-600 mt-1">
                Message exceeds 160 characters — will be split into {Math.ceil(charCount / 160)} SMS parts.
              </p>
            )}
          </div>
        </div>

        <div className="flex items-center justify-between px-5 py-3 border-t border-gray-100 bg-gray-50">
          <p className="text-xs text-gray-400">Logged to patient contact history.</p>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-1.5 text-xs text-gray-600 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => void handleSend()}
              disabled={saving || !message.trim()}
              className="flex items-center gap-1.5 px-4 py-1.5 text-xs font-semibold text-white bg-violet-600 rounded-lg hover:bg-violet-700 disabled:opacity-50 transition-colors"
            >
              <Send className="w-3 h-3" />
              {saving ? 'Sending…' : `Send ${apiChannel}`}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
