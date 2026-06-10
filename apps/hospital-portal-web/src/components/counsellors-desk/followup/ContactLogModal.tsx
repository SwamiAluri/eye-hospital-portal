'use client';

import { useEffect, useMemo, useState } from 'react';
import { X, Phone, MessageSquare, Mail, Calendar, Clock, User } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { counsellorsDeskApi } from '@/lib/api/counsellors-desk.api';
import { useCounsellorMasterOptions } from '@/hooks/use-counsellor-master-options';
import { commChannelCodeToApi } from '@/lib/counsellors-desk/counsellor-master-maps';
import type { LucideIcon } from 'lucide-react';

interface ContactLogModalProps {
  isOpen: boolean;
  onClose: () => void;
  sessionId: string;
  patientName: string;
  phone: string | null;
  onLogged: () => void;
}

const CHANNEL_ICONS: Record<string, LucideIcon> = {
  PHONE: Phone,
  SMS: MessageSquare,
  WHATSAPP: MessageSquare,
  EMAIL: Mail,
  IN_PERSON: User,
};

const FALLBACK_CHANNELS = [
  { value: 'PHONE', label: 'Phone Call' },
  { value: 'WHATSAPP', label: 'WhatsApp' },
  { value: 'SMS', label: 'SMS' },
  { value: 'EMAIL', label: 'Email' },
];

const OUTCOMES = [
  { id: 'Answered', label: 'Answered', color: 'border-emerald-400 bg-emerald-50 text-emerald-700' },
  { id: 'NoAnswer', label: 'No Answer', color: 'border-amber-400 bg-amber-50 text-amber-700' },
  { id: 'Busy', label: 'Busy', color: 'border-orange-400 bg-orange-50 text-orange-700' },
  { id: 'LeftMessage', label: 'Left Message', color: 'border-sky-400 bg-sky-50 text-sky-700' },
  { id: 'Declined', label: 'Declined', color: 'border-red-400 bg-red-50 text-red-700' },
] as const;

type Outcome = (typeof OUTCOMES)[number]['id'];

export default function ContactLogModal({
  isOpen,
  onClose,
  sessionId,
  patientName,
  phone,
  onLogged,
}: ContactLogModalProps) {
  const { commChannelOptions, callbackTypeOptions } = useCounsellorMasterOptions();

  const channelChoices = useMemo(
    () =>
      commChannelOptions.length > 0
        ? commChannelOptions.map((o) => ({ value: o.value, label: o.label }))
        : FALLBACK_CHANNELS,
    [commChannelOptions],
  );

  const callbackChoices = useMemo(
    () =>
      callbackTypeOptions.length > 0
        ? callbackTypeOptions
        : [{ value: 'SCHEDULED', label: 'Scheduled Callback' }],
    [callbackTypeOptions],
  );

  const [channelCode, setChannelCode] = useState('PHONE');
  const [callbackTypeCode, setCallbackTypeCode] = useState('SCHEDULED');
  const [outcome, setOutcome] = useState<Outcome>('Answered');
  const [notes, setNotes] = useState('');
  const [callDuration, setCallDuration] = useState('');
  const [scheduleCallback, setScheduleCallback] = useState(false);
  const [callbackDate, setCallbackDate] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    if (channelChoices.length > 0) setChannelCode(channelChoices[0].value);
    if (callbackChoices.length > 0) setCallbackTypeCode(callbackChoices[0].value);
  }, [isOpen, channelChoices, callbackChoices]);

  if (!isOpen) return null;

  const apiChannel = commChannelCodeToApi(channelCode);
  const showDuration = apiChannel === 'Phone' || apiChannel === 'WhatsApp';

  const handleSubmit = async () => {
    setSaving(true);
    setError(null);
    try {
      await counsellorsDeskApi.logCommunication(sessionId, {
        channel: apiChannel,
        direction: 'Outbound',
        communicationAt: new Date().toISOString(),
        outcome,
        callDurationMinutes: callDuration ? parseInt(callDuration, 10) : undefined,
        responseSummary: notes || undefined,
      });

      if (scheduleCallback && callbackDate) {
        await counsellorsDeskApi.scheduleCallback(sessionId, {
          callbackDate,
          callbackReason: notes || 'Follow-up call scheduled',
          preferredChannel: apiChannel,
          callbackType: callbackTypeCode,
        });
      }

      toast.success('Contact logged successfully');
      onLogged();
      onClose();
      resetForm();
    } catch {
      setError('Failed to log contact. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const resetForm = () => {
    setChannelCode(channelChoices[0]?.value ?? 'PHONE');
    setCallbackTypeCode(callbackChoices[0]?.value ?? 'SCHEDULED');
    setOutcome('Answered');
    setNotes('');
    setCallDuration('');
    setScheduleCallback(false);
    setCallbackDate('');
    setError(null);
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  const selectedOutcome = OUTCOMES.find((o) => o.id === outcome);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40" onClick={handleClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 overflow-hidden">
        <div className="px-5 py-4 bg-gradient-to-r from-blue-600 to-indigo-600">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-sm font-semibold text-white flex items-center gap-1.5">
                <Phone className="w-4 h-4" />
                Log Contact
              </h2>
              <p className="text-xs text-blue-100 mt-0.5">
                {patientName}
                {phone ? <span className="ml-2 font-mono opacity-80">{phone}</span> : ''}
              </p>
            </div>
            <button onClick={handleClose} className="p-1.5 rounded-lg hover:bg-white/20 transition-colors">
              <X className="w-4 h-4 text-white" />
            </button>
          </div>
        </div>

        <div className="px-5 py-4 space-y-4">
          {error && (
            <div className="text-xs text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
              {error}
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">
              Channel
            </label>
            <div className="flex gap-1.5 flex-wrap">
              {channelChoices.map((c) => {
                const Icon = CHANNEL_ICONS[c.value.toUpperCase()] ?? MessageSquare;
                return (
                  <button
                    key={c.value}
                    type="button"
                    onClick={() => setChannelCode(c.value)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border transition-all ${
                      channelCode === c.value
                        ? 'border-blue-500 bg-blue-50 text-blue-700 shadow-sm'
                        : 'border-gray-200 text-gray-500 hover:border-gray-300 bg-white'
                    }`}
                  >
                    <Icon className="w-3.5 h-3.5" />
                    {c.label}
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">
              Outcome
            </label>
            <div className="flex flex-wrap gap-1.5">
              {OUTCOMES.map((o) => (
                <button
                  key={o.id}
                  type="button"
                  onClick={() => setOutcome(o.id)}
                  className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-all ${
                    outcome === o.id ? o.color : 'border-gray-200 text-gray-500 hover:border-gray-300 bg-white'
                  }`}
                >
                  {o.label}
                </button>
              ))}
            </div>
          </div>

          {showDuration && (
            <div className="flex items-center gap-3">
              <Clock className="w-4 h-4 text-gray-400 flex-shrink-0" />
              <div className="flex items-center gap-2">
                <label className="text-xs text-gray-500 whitespace-nowrap">Call duration:</label>
                <input
                  type="number"
                  min={0}
                  max={120}
                  value={callDuration}
                  onChange={(e) => setCallDuration(e.target.value)}
                  placeholder="mins"
                  className="w-20 border border-gray-200 rounded-lg px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-blue-400 text-center"
                />
                <span className="text-xs text-gray-400">min</span>
              </div>
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">
              Notes
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              placeholder="Briefly describe the conversation…"
              className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-400 resize-none"
            />
          </div>

          <div className="bg-gray-50 rounded-xl p-3 border border-gray-100 space-y-3">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={scheduleCallback}
                onChange={(e) => setScheduleCallback(e.target.checked)}
                className="w-4 h-4 rounded accent-blue-600"
              />
              <span className="text-xs font-semibold text-gray-600 flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-blue-500" />
                Schedule a Callback
              </span>
            </label>
            {scheduleCallback && (
              <>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Callback type</label>
                  <select
                    value={callbackTypeCode}
                    onChange={(e) => setCallbackTypeCode(e.target.value)}
                    className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                  >
                    {callbackChoices.map((c) => (
                      <option key={c.value} value={c.value}>
                        {c.label}
                      </option>
                    ))}
                  </select>
                </div>
                <input
                  type="date"
                  value={callbackDate}
                  onChange={(e) => setCallbackDate(e.target.value)}
                  min={new Date().toISOString().split('T')[0]}
                  className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                />
              </>
            )}
          </div>
        </div>

        <div className="flex items-center justify-between px-5 py-3 border-t border-gray-100 bg-gray-50/80">
          {selectedOutcome && (
            <span className={`text-xs px-2.5 py-1 rounded-full border font-semibold ${selectedOutcome.color}`}>
              {selectedOutcome.label}
            </span>
          )}
          <div className="flex gap-2 ml-auto">
            <button
              type="button"
              onClick={handleClose}
              className="px-3 py-1.5 text-xs text-gray-600 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => void handleSubmit()}
              disabled={saving}
              className="px-4 py-1.5 text-xs font-semibold text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-60 transition-colors"
            >
              {saving ? 'Logging…' : 'Log Contact'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
