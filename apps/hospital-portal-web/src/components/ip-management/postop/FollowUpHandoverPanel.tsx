'use client';

import { useCallback, useEffect, useState } from 'react';
import { Check, Loader2 } from 'lucide-react';
import { toast } from 'react-hot-toast';
import {
  ipManagementApi,
  type SavePostOpInstructionRequest,
} from '@/lib/api/ip-management.api';
import { useAuthStore } from '@/lib/auth-store';
import { resolveIpRoleActions } from '@/lib/ip-management/ip-role-actions';
import { isoToDatetimeLocal } from '@/lib/ip-management/follow-up-appointment';
import { FollowUpAppointmentPanel } from '@/components/ip-management/postop/FollowUpAppointmentPanel';

const HANDOVER_KEYS = [
  { key: 'medsBriefed', label: 'Attendant briefed on medication schedule' },
  { key: 'redFlags', label: 'Red-flag symptoms explained and understood' },
  { key: 'printed', label: 'Printed instructions handed over' },
  { key: 'followupConfirmed', label: 'Follow-up date confirmed with attendant' },
  { key: 'emergencyContact', label: 'Contact number for emergencies given' },
] as const;

type HandoverKey = (typeof HANDOVER_KEYS)[number]['key'];

function parseHandover(notes: string | null | undefined): Record<HandoverKey, boolean> {
  const base = Object.fromEntries(HANDOVER_KEYS.map(h => [h.key, false])) as Record<HandoverKey, boolean>;
  if (!notes) return base;
  try {
    const marker = notes.match(/\[handover:(\{.*?\})\]/);
    if (!marker) return base;
    const parsed = JSON.parse(marker[1]) as Partial<Record<HandoverKey, boolean>>;
    for (const h of HANDOVER_KEYS) {
      if (parsed[h.key]) base[h.key] = true;
    }
  } catch {
    /* ignore */
  }
  return base;
}

function withHandover(notes: string | null | undefined, flags: Record<HandoverKey, boolean>, attendant: string): string {
  const stripped = (notes ?? '').replace(/\n?\[handover:\{.*?\}\]/g, '').replace(/\n?\[attendant:.*?\]/g, '').trim();
  const parts = [stripped];
  if (attendant.trim()) parts.push(`[attendant:${attendant.trim()}]`);
  parts.push(`[handover:${JSON.stringify(flags)}]`);
  return parts.filter(Boolean).join('\n');
}

function parseAttendant(notes: string | null | undefined): string {
  const m = notes?.match(/\[attendant:(.*?)\]/);
  return m?.[1] ?? '';
}

export function FollowUpHandoverPanel({
  journeyId,
  patientId,
  patientName,
  readOnly,
  onChanged,
}: {
  journeyId: string;
  patientId?: string | null;
  patientName?: string | null;
  readOnly?: boolean;
  onChanged?: () => void;
}) {
  const permissions = useAuthStore(s => s.permissions);
  const actions = resolveIpRoleActions(permissions);
  const [followupDate, setFollowupDate] = useState('');
  const [followupDoctorId, setFollowupDoctorId] = useState('');
  const [followupAppointmentId, setFollowupAppointmentId] = useState<string | null>(null);
  const [eyeCare, setEyeCare] = useState('');
  const [flags, setFlags] = useState<Record<HandoverKey, boolean>>(
    () => Object.fromEntries(HANDOVER_KEYS.map(h => [h.key, false])) as Record<HandoverKey, boolean>,
  );
  const [attendant, setAttendant] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const data = await ipManagementApi.getPostOpInstructions(journeyId);
    if (data) {
      setFollowupDate(isoToDatetimeLocal(data.followupDate));
      setFollowupDoctorId(data.followupDoctorId ?? '');
      setFollowupAppointmentId(data.followupAppointmentId ?? null);
      setEyeCare(data.eyeCareInstructions ?? '');
      setFlags(parseHandover(data.dietaryInstructions));
      setAttendant(parseAttendant(data.dietaryInstructions));
    }
    setLoading(false);
  }, [journeyId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function handleSave() {
    if (readOnly) return;
    setSaving(true);
    try {
      const existing = await ipManagementApi.getPostOpInstructions(journeyId);
      const payload: SavePostOpInstructionRequest = {
        medications: existing?.medications ?? undefined,
        activityRestrictions: existing?.activityRestrictions ?? undefined,
        eyeCareInstructions: eyeCare || existing?.eyeCareInstructions || undefined,
        warningSigns: existing?.warningSigns ?? undefined,
        followupDate: followupDate ? new Date(followupDate).toISOString() : undefined,
        followupDoctorId: followupDoctorId || undefined,
        dietaryInstructions: withHandover(existing?.dietaryInstructions, flags, attendant),
      };
      await ipManagementApi.savePostOpInstructions(journeyId, payload);
      toast.success('Follow-up & handover saved');
      onChanged?.();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Failed to save handover');
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-gray-500 py-8 justify-center">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading…
      </div>
    );
  }

  const doneCount = HANDOVER_KEYS.filter(h => flags[h.key]).length;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold text-gray-900">Follow-up &amp; handover</h3>
          <p className="text-xs text-gray-500 mt-0.5">
            Discharge requires a booked clinic appointment. A date typed on this form is not a slot.
          </p>
        </div>
        <span className="text-xs bg-gray-100 text-gray-700 px-2 py-0.5 rounded-full font-medium">
          Handover {doneCount}/{HANDOVER_KEYS.length}
        </span>
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        <div className="rounded-xl border border-gray-200 p-4 space-y-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Follow-up appointment</p>
          <FollowUpAppointmentPanel
            journeyId={journeyId}
            patientId={patientId}
            patientName={patientName}
            followupDate={followupDate}
            followupDoctorId={followupDoctorId}
            followupAppointmentId={followupAppointmentId}
            canBook={actions.canBookFollowUp}
            canLink={actions.canLinkFollowUp}
            readOnly={readOnly}
            onFollowupDateChange={setFollowupDate}
            onLinked={next => {
              setFollowupAppointmentId(next.followupAppointmentId);
              setFollowupDate(next.followupDate);
              setFollowupDoctorId(next.followupDoctorId);
              onChanged?.();
            }}
          />
        </div>

        <div className="rounded-xl border border-gray-200 p-4 space-y-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Handover</p>
          <ul className="space-y-1.5">
            {HANDOVER_KEYS.map(h => (
              <li key={h.key}>
                <button
                  type="button"
                  disabled={readOnly}
                  onClick={() => setFlags(f => ({ ...f, [h.key]: !f[h.key] }))}
                  className="flex w-full items-center gap-2.5 rounded-lg px-2 py-1.5 text-left text-sm hover:bg-gray-50 disabled:opacity-60"
                >
                  <span
                    className={[
                      'flex h-5 w-5 shrink-0 items-center justify-center rounded border',
                      flags[h.key] ? 'border-emerald-500 bg-emerald-500 text-white' : 'border-gray-300',
                    ].join(' ')}
                  >
                    {flags[h.key] && <Check className="h-3 w-3" />}
                  </span>
                  {h.label}
                </button>
              </li>
            ))}
          </ul>
          <label className="block text-xs">
            <span className="font-medium text-gray-700">Handed over to</span>
            <input
              value={attendant}
              disabled={readOnly}
              onChange={e => setAttendant(e.target.value)}
              className="mt-1 w-full border rounded-lg px-2.5 py-1.5 text-sm disabled:bg-gray-50"
              placeholder="Attendant name and relationship"
            />
          </label>
        </div>
      </div>

      {!readOnly && (
        <div className="flex justify-end">
          <button
            type="button"
            disabled={saving}
            onClick={() => void handleSave()}
            className="px-3 py-1.5 text-xs font-medium rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-60"
          >
            {saving ? 'Saving…' : 'Save follow-up & handover'}
          </button>
        </div>
      )}
    </div>
  );
}
