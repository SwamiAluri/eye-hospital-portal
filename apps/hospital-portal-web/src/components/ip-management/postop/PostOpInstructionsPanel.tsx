'use client';

import { useCallback, useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { toast } from 'react-hot-toast';
import {
  ipManagementApi,
  type SavePostOpInstructionRequest,
} from '@/lib/api/ip-management.api';

const DEFAULT_WARNINGS =
  'Return immediately if severe pain, sudden vision loss, increasing redness, discharge, or flashes/floaters.';

export function PostOpInstructionsPanel({
  journeyId,
  readOnly,
  onChanged,
}: {
  journeyId: string;
  readOnly?: boolean;
  onChanged?: () => void;
}) {
  const [form, setForm] = useState<SavePostOpInstructionRequest>({
    medications: '',
    activityRestrictions: '',
    dietaryInstructions: '',
    eyeCareInstructions: '',
    warningSigns: DEFAULT_WARNINGS,
    followupDate: '',
    followupDoctorId: '',
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const data = await ipManagementApi.getPostOpInstructions(journeyId);
    if (data) {
      setForm({
        medications: data.medications ?? '',
        activityRestrictions: data.activityRestrictions ?? '',
        dietaryInstructions: data.dietaryInstructions ?? '',
        eyeCareInstructions: data.eyeCareInstructions ?? '',
        warningSigns: data.warningSigns || DEFAULT_WARNINGS,
        followupDate: data.followupDate?.slice(0, 16) ?? '',
        followupDoctorId: data.followupDoctorId ?? '',
      });
      setSavedAt(data.savedAt);
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
      const payload: SavePostOpInstructionRequest = {
        ...form,
        followupDate: form.followupDate ? new Date(form.followupDate).toISOString() : undefined,
      };
      const saved = await ipManagementApi.savePostOpInstructions(journeyId, payload);
      toast.success('Post-op instructions saved');
      setSavedAt(saved?.savedAt ?? null);
      onChanged?.();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Failed to save instructions');
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-gray-500 py-8 justify-center">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading instructions…
      </div>
    );
  }

  const fields: { key: keyof SavePostOpInstructionRequest; label: string; rows?: number; hint?: string }[] = [
    { key: 'medications', label: 'Medication regime', rows: 4 },
    { key: 'eyeCareInstructions', label: 'Eye care instructions', rows: 3 },
    { key: 'activityRestrictions', label: 'Activity restrictions', rows: 2 },
    { key: 'dietaryInstructions', label: 'Dietary instructions', rows: 2 },
    {
      key: 'warningSigns',
      label: 'Red-flag symptoms (printed copy)',
      rows: 3,
      hint: 'Must be on the printed copy in the patient’s language.',
    },
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold text-gray-900">Post-op instructions</h3>
          <p className="text-xs text-gray-500 mt-0.5">
            {savedAt
              ? `Last saved ${new Date(savedAt).toLocaleString('en-IN')}`
              : 'Not saved yet — draft from procedure when available'}
          </p>
        </div>
        {!readOnly && (
          <button
            type="button"
            disabled={saving}
            onClick={() => void handleSave()}
            className="px-3 py-1.5 text-xs font-medium rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-60"
          >
            {saving ? 'Saving…' : 'Save instructions'}
          </button>
        )}
      </div>

      <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
        <b>Red-flag symptoms must be on the printed copy.</b> Endophthalmitis presents late and at home;
        the sheet is the safety net once the patient leaves.
      </div>

      {fields.map(({ key, label, rows, hint }) => (
        <label key={key} className="block text-xs">
          <span className="font-medium text-gray-700">{label}</span>
          <textarea
            value={(form[key] as string) ?? ''}
            onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
            disabled={readOnly}
            rows={rows ?? 2}
            className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm resize-none disabled:bg-gray-50"
          />
          {hint && <span className="text-gray-500 mt-0.5 block">{hint}</span>}
        </label>
      ))}
    </div>
  );
}
