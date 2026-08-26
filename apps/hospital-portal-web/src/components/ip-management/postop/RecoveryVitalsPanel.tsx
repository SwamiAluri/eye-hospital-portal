'use client';

import { useCallback, useEffect, useState } from 'react';
import { Loader2, Plus } from 'lucide-react';
import { toast } from 'react-hot-toast';
import {
  ipManagementApi,
  type AddVitalSignRequest,
  type VitalSignDto,
} from '@/lib/api/ip-management.api';

function fmtTime(dt: string | null | undefined): string {
  if (!dt) return '—';
  return new Date(dt).toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

const EMPTY: Record<string, string> = {
  bloodPressureSystolic: '',
  bloodPressureDiastolic: '',
  pulseRate: '',
  oxygenSaturation: '',
  temperature: '',
  respiratoryRate: '',
  notes: '',
};

export function RecoveryVitalsPanel({
  journeyId,
  readOnly,
  onChanged,
}: {
  journeyId: string;
  readOnly?: boolean;
  onChanged?: () => void;
}) {
  const [rows, setRows] = useState<VitalSignDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(EMPTY);

  const load = useCallback(async () => {
    setLoading(true);
    const data = await ipManagementApi.getVitals(journeyId);
    setRows([...data].sort((a, b) => new Date(b.recordedAt).getTime() - new Date(a.recordedAt).getTime()));
    setLoading(false);
  }, [journeyId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function handleAdd() {
    if (readOnly) return;
    setSaving(true);
    const req: AddVitalSignRequest = {
      bloodPressureSystolic: form.bloodPressureSystolic ? Number(form.bloodPressureSystolic) : undefined,
      bloodPressureDiastolic: form.bloodPressureDiastolic ? Number(form.bloodPressureDiastolic) : undefined,
      pulseRate: form.pulseRate ? Number(form.pulseRate) : undefined,
      oxygenSaturation: form.oxygenSaturation ? Number(form.oxygenSaturation) : undefined,
      temperature: form.temperature ? Number(form.temperature) : undefined,
      respiratoryRate: form.respiratoryRate ? Number(form.respiratoryRate) : undefined,
      notes: form.notes.trim() || undefined,
    };
    const created = await ipManagementApi.addVital(journeyId, req);
    setSaving(false);
    if (!created) {
      toast.error('Failed to save observation');
      return;
    }
    toast.success('Observation recorded');
    setForm(EMPTY);
    setShowForm(false);
    await load();
    onChanged?.();
  }

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-gray-500 py-8 justify-center">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading vitals…
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold text-gray-900">Recovery vitals</h3>
          <p className="text-xs text-gray-500 mt-0.5">
            Same observation chart as ward / pre-op — not a separate post-op series.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded-full font-medium">
            {rows.length} observation{rows.length === 1 ? '' : 's'}
          </span>
          {!readOnly && (
            <button
              type="button"
              onClick={() => setShowForm(s => !s)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-indigo-600 text-white hover:bg-indigo-700"
            >
              <Plus className="h-3.5 w-3.5" /> Add observation
            </button>
          )}
        </div>
      </div>

      {showForm && !readOnly && (
        <div className="rounded-xl border border-indigo-100 bg-indigo-50/40 p-4 space-y-3">
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {[
              { key: 'bloodPressureSystolic', label: 'BP systolic' },
              { key: 'bloodPressureDiastolic', label: 'BP diastolic' },
              { key: 'pulseRate', label: 'Pulse' },
              { key: 'oxygenSaturation', label: 'SpO₂ %' },
              { key: 'temperature', label: 'Temp °C' },
              { key: 'respiratoryRate', label: 'Resp. rate' },
            ].map(({ key, label }) => (
              <label key={key} className="block text-xs">
                <span className="text-gray-600 font-medium">{label}</span>
                <input
                  type="number"
                  value={form[key]}
                  onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
                  className="mt-1 w-full border border-gray-300 rounded-lg px-2.5 py-1.5 text-sm bg-white"
                />
              </label>
            ))}
          </div>
          <label className="block text-xs">
            <span className="text-gray-600 font-medium">Notes (pain / nausea)</span>
            <input
              value={form.notes}
              onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
              className="mt-1 w-full border border-gray-300 rounded-lg px-2.5 py-1.5 text-sm bg-white"
              placeholder="Optional"
            />
          </label>
          <div className="flex gap-2 justify-end">
            <button type="button" onClick={() => setShowForm(false)} className="px-3 py-1.5 text-xs border rounded-lg">
              Cancel
            </button>
            <button
              type="button"
              disabled={saving}
              onClick={() => void handleAdd()}
              className="px-3 py-1.5 text-xs bg-indigo-600 text-white rounded-lg disabled:opacity-60"
            >
              {saving ? 'Saving…' : 'Save observation'}
            </button>
          </div>
        </div>
      )}

      {rows.length === 0 ? (
        <p className="text-sm text-gray-500 py-6 text-center">No recovery observations yet.</p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-gray-200">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-xs text-gray-500 uppercase tracking-wide">
              <tr>
                <th className="text-left px-3 py-2 font-medium">Time</th>
                <th className="text-left px-3 py-2 font-medium">BP</th>
                <th className="text-left px-3 py-2 font-medium">Pulse</th>
                <th className="text-left px-3 py-2 font-medium">SpO₂</th>
                <th className="text-left px-3 py-2 font-medium">Temp</th>
                <th className="text-left px-3 py-2 font-medium">Notes</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {rows.map(v => (
                <tr key={v.id} className="hover:bg-gray-50/80">
                  <td className="px-3 py-2 whitespace-nowrap">{fmtTime(v.recordedAt)}</td>
                  <td className="px-3 py-2">
                    {v.bloodPressureSystolic != null && v.bloodPressureDiastolic != null
                      ? `${v.bloodPressureSystolic}/${v.bloodPressureDiastolic}`
                      : '—'}
                  </td>
                  <td className="px-3 py-2">{v.pulseRate ?? '—'}</td>
                  <td className="px-3 py-2">{v.oxygenSaturation != null ? `${v.oxygenSaturation}%` : '—'}</td>
                  <td className="px-3 py-2">{v.temperature ?? '—'}</td>
                  <td className="px-3 py-2 text-gray-600 max-w-[12rem] truncate">{v.notes || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {rows.length >= 3 && (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-800">
          <b>Multiple readings on chart.</b> Confirm stability against day-care discharge criteria before marking ready.
        </div>
      )}
    </div>
  );
}
