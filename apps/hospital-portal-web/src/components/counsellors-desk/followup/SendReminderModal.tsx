'use client';

import { useState, useEffect } from 'react';
import { X, MessageSquare, Mail, Smartphone, Send } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { counsellorsDeskApi } from '@/lib/api/counsellors-desk.api';
import type { ReminderMessageType, SendReminderPayload } from '@/types/counsellors-desk';

interface SendReminderModalProps {
  isOpen: boolean;
  onClose: () => void;
  patientId: string;
  patientName: string;ī
  phone: string | null;
  journeyId?: string;
  onSent?: () => void;
}

const CHANNELS: { id: SendReminderPayload['channel']; label: string; icon: React.ReactNode }[] = [
  { id: 'SMS',      label: 'SMS',      icon: <Smartphone className="w-3.5 h-3.5" /> },
  { id: 'WhatsApp', label: 'WhatsApp', icon: <MessageSquare className="w-3.5 h-3.5" /> },
  { id: 'Email',    label: 'Email',    icon: <Mail className="w-3.5 h-3.5" /> },
];

const MESSAGE_TYPES: { id: ReminderMessageType; label: string }[] = [
  { id: 'CallbackReminder',    label: 'Callback Reminder' },
  { id: 'AppointmentReminder', label: 'Appointment Reminder' },
  { id: 'WellnessCheck',       label: 'Wellness Check' },
  { id: 'PostSurgeryFollowup', label: 'Post-Surgery Follow-up' },
  { id: 'General',             label: 'General' },
];

const TEMPLATES: Record<ReminderMessageType, string> = {
  CallbackReminder:
    `Hi {name}, this is a reminder that we have a scheduled callback with you soon regarding your upcoming procedure. Please expect our call or reach us at the hospital helpline. Thank you.`,
  AppointmentReminder:
    `Hi {name}, this is a friendly reminder about your upcoming appointment at our hospital. Please confirm your attendance or contact us to reschedule. Thank you.`,
  WellnessCheck:
    `Hi {name}, we're checking in to see how you're doing. If you have any concerns or questions about your health, please don't hesitate to reach out to our care team. Take care!`,
  PostSurgeryFollowup:
    `Hi {name}, we hope you're recovering well after your recent procedure. Please contact us if you experience any unusual symptoms. Your next post-op visit is important — please schedule it at your earliest convenience.`,
  General:
    `Hi {name}, this is a message from our care team at the hospital. Please reach out to us at your earliest convenience. Thank you.`,
};

export default function SendReminderModal({
  isOpen,
  onClose,
  patientId,
  patientName,
  phone,
  journeyId,
  onSent,
}: SendReminderModalProps) {
  const [channel, setChannel]           = useState<SendReminderPayload['channel']>('SMS');
  const [messageType, setMessageType]   = useState<ReminderMessageType>('General');
  const [message, setMessage]           = useState(TEMPLATES.General.replace('{name}', patientName.split(' ')[0]));
  const [saving, setSaving]             = useState(false);
  const [charCount, setCharCount]       = useState(message.length);

  useEffect(() => {
    if (!isOpen) return;
    const template = TEMPLATES[messageType].replace('{name}', patientName.split(' ')[0]);
    setMessage(template);
    setCharCount(template.length);
  }, [messageType, patientName, isOpen]);

  useEffect(() => {
    setCharCount(message.length);
  }, [message]);

  if (!isOpen) return null;

  const handleSend = async () => {
    if (!message.trim()) return;
    setSaving(true);
    try {
      const payload: SendReminderPayload = {
        channel,
        messageType,
        message,
        ...(journeyId ? { journeyId } : {}),
      };
      await counsellorsDeskApi.sendReminder(patientId, payload);
      toast.success(`Reminder sent via ${channel} to ${patientName}`);
      onSent?.();
      onClose();
    } catch {
      toast.error('Failed to send reminder. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const channelColor: Record<SendReminderPayload['channel'], string> = {
    SMS:      'border-blue-500 bg-blue-50 text-blue-700',
    WhatsApp: 'border-emerald-500 bg-emerald-50 text-emerald-700',
    Email:    'border-violet-500 bg-violet-50 text-violet-700',
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg mx-4 overflow-hidden">
        {/* Header */}
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
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-white/70 transition-colors">
            <X className="w-4 h-4 text-gray-500" />
          </button>
        </div>

        <div className="px-5 py-4 space-y-4">
          {/* Channel */}
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
              Channel
            </label>
            <div className="flex gap-2">
              {CHANNELS.map((c) => (
                <button
                  key={c.id}
                  onClick={() => setChannel(c.id)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border transition-all ${
                    channel === c.id
                      ? channelColor[c.id]
                      : 'border-gray-200 text-gray-500 hover:border-gray-300 bg-white'
                  }`}
                >
                  {c.icon}
                  {c.label}
                </button>
              ))}
            </div>
          </div>

          {/* Message Type */}
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
              Message Type
            </label>
            <div className="flex flex-wrap gap-1.5">
              {MESSAGE_TYPES.map((t) => (
                <button
                  key={t.id}
                  onClick={() => setMessageType(t.id)}
                  className={`px-2.5 py-1 rounded-md text-xs font-medium border transition-all ${
                    messageType === t.id
                      ? 'border-violet-400 bg-violet-50 text-violet-700'
                      : 'border-gray-200 text-gray-500 hover:border-gray-300 bg-white'
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          {/* Message */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide">
                Message
              </label>
              <span className={`text-xs ${charCount > 160 ? 'text-amber-600' : 'text-gray-400'}`}>
                {charCount}{channel === 'SMS' ? '/160 chars' : ''}
              </span>
            </div>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={5}
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-violet-400 resize-none leading-relaxed"
              placeholder="Enter reminder message…"
            />
            {channel === 'SMS' && charCount > 160 && (
              <p className="text-xs text-amber-600 mt-1 flex items-center gap-1">
                Message exceeds 160 characters — will be split into {Math.ceil(charCount / 160)} SMS parts.
              </p>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-5 py-3 border-t border-gray-100 bg-gray-50">
          <p className="text-xs text-gray-400">
            This will be logged to the patient's contact history.
          </p>
          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="px-3 py-1.5 text-xs text-gray-600 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSend}
              disabled={saving || !message.trim()}
              className="flex items-center gap-1.5 px-4 py-1.5 text-xs font-semibold text-white bg-violet-600 rounded-lg hover:bg-violet-700 disabled:opacity-50 transition-colors"
            >
              <Send className="w-3 h-3" />
              {saving ? 'Sending…' : `Send ${channel}`}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
