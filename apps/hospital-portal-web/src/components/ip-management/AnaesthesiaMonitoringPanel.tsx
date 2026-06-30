'use client';

import { useCallback, useEffect, useState } from 'react';
import { Activity, Loader2, Plus, Trash2 } from 'lucide-react';
import { toast } from 'react-hot-toast';
import {
  ipManagementApi,
  AnaesthesiaMonitoringDto,
  SaveDischargeClearanceRequest,
} from '@/lib/api/ip-management.api';

export interface AnaesthesiaMonitoringPanelProps {
  journeyId: string;
  mode: 'ot' | 'discharge';
  readOnly?: boolean;
  onClearanceChange?: (complete: boolean) => void;
}

const DEFAULT_INTERVALS = [0, 1, 2, 3, 4, 5, 10, 15, 20];

function fmtTime(dt: string | null | undefined): string {
  if (!dt) return '—';
  return new Date(dt).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
}

export function AnaesthesiaMonitoringPanel({
  journeyId,
  mode,
  readOnly = false,
  onClearanceChange,
}: AnaesthesiaMonitoringPanelProps) {
  const [data, setData] = useState<AnaesthesiaMonitoringDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [preOpPulse, setPreOpPulse] = useState('');
  const [preOpBp, setPreOpBp] = useState('');
  const [preOpSpo2, setPreOpSpo2] = useState('');
  const [preOpConsent, setPreOpConsent] = useState(false);

  const [newElapsed, setNewElapsed] = useState('');
  const [newPulse, setNewPulse] = useState('');
  const [newSpo2, setNewSpo2] = useState('');

  const [dischargePr, setDischargePr] = useState('');
  const [dischargeBp, setDischargeBp] = useState('');
  const [generalNormal, setGeneralNormal] = useState<boolean | null>(null);
  const [dischargeRemarks, setDischargeRemarks] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    const result = await ipManagementApi.getAnaesthesiaMonitoring(journeyId);
    setData(result);
    if (result) {
      setPreOpPulse(result.preOpPulse != null ? String(result.preOpPulse) : '');
      setPreOpBp(result.preOpBp ?? '');
      setPreOpSpo2(result.preOpSpo2 != null ? String(result.preOpSpo2) : '');
      setPreOpConsent(result.preOpConsentConfirmed);
      setDischargePr(result.dischargePr != null ? String(result.dischargePr) : '');
      setDischargeBp(result.dischargeBp ?? '');
      setGeneralNormal(result.generalConditionNormal);
      setDischargeRemarks(result.dischargeRemarks ?? '');
      onClearanceChange?.(result.dischargeClearanceComplete);
    }
    setLoading(false);
  }, [journeyId, onClearanceChange]);

  useEffect(() => {
    load();
  }, [load]);

  async function savePreOpReview() {
    if (readOnly) return;
    setSaving(true);
    const updated = await ipManagementApi.savePreOpReview(journeyId, {
      pulse: preOpPulse ? Number(preOpPulse) : null,
      bp: preOpBp || null,
      spo2: preOpSpo2 ? Number(preOpSpo2) : null,
      consentConfirmed: preOpConsent,
    });
    if (updated) {
      setData(updated);
      toast.success('Pre-op review saved');
    } else toast.error('Failed to save pre-op review');
    setSaving(false);
  }

  async function addReading(elapsedMin?: number) {
    if (readOnly) return;
    const min = elapsedMin ?? (newElapsed ? Number(newElapsed) : NaN);
    if (Number.isNaN(min)) {
      toast.error('Enter elapsed minutes');
      return;
    }
    setSaving(true);
    const updated = await ipManagementApi.addMonitoringReading(journeyId, {
      elapsedMin: min,
      pulse: newPulse ? Number(newPulse) : null,
      spo2: newSpo2 ? Number(newSpo2) : null,
    });
    if (updated) {
      setData(updated);
      setNewElapsed('');
      setNewPulse('');
      setNewSpo2('');
    } else toast.error('Failed to add reading');
    setSaving(false);
  }

  async function removeReading(readingId: string) {
    if (readOnly) return;
    setSaving(true);
    const updated = await ipManagementApi.removeMonitoringReading(journeyId, readingId);
    if (updated) setData(updated);
    else toast.error('Failed to remove reading');
    setSaving(false);
  }

  async function saveDischargeClearance() {
    if (readOnly) return;
    setSaving(true);
    const req: SaveDischargeClearanceRequest = {
      pulse: dischargePr ? Number(dischargePr) : null,
      bp: dischargeBp || null,
      generalConditionNormal: generalNormal,
      remarks: dischargeRemarks || null,
    };
    const updated = await ipManagementApi.saveDischargeClearance(journeyId, req);
    if (updated) {
      setData(updated);
      onClearanceChange?.(updated.dischargeClearanceComplete);
      toast.success('Discharge clearance saved');
    } else toast.error('Failed to save discharge clearance');
    setSaving(false);
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8 text-gray-400">
        <Loader2 className="h-5 w-5 animate-spin mr-2" /> Loading monitoring…
      </div>
    );
  }

  if (!data) {
    return <p className="text-sm text-red-600">Could not load anaesthesia monitoring.</p>;
  }

  if (mode === 'discharge') {
    return (
      <div className="space-y-4 border border-emerald-100 rounded-xl p-4 bg-emerald-50/50">
        <div className="flex items-center gap-2">
          <Activity className="h-4 w-4 text-emerald-600" />
          <h4 className="text-sm font-semibold text-gray-800">Anaesthesia Discharge Clearance (Form 5)</h4>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs text-gray-600 mb-1">Pulse (PR)</label>
            <input
              type="number"
              disabled={readOnly}
              value={dischargePr}
              onChange={e => setDischargePr(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-xs disabled:bg-gray-50"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-600 mb-1">BP</label>
            <input
              type="text"
              disabled={readOnly}
              value={dischargeBp}
              onChange={e => setDischargeBp(e.target.value)}
              placeholder="120/80"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-xs disabled:bg-gray-50"
            />
          </div>
        </div>
        <div>
          <label className="block text-xs text-gray-600 mb-1">General Condition</label>
          <div className="flex gap-2">
            {([
              { val: true, label: 'Normal' },
              { val: false, label: 'Abnormal' },
            ] as const).map(({ val, label }) => (
              <button
                key={label}
                type="button"
                disabled={readOnly}
                onClick={() => setGeneralNormal(val)}
                className={`px-3 py-1.5 text-xs rounded-lg border ${generalNormal === val ? 'bg-emerald-600 text-white border-emerald-600' : 'border-gray-300 text-gray-600'}`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
        <div>
          <label className="block text-xs text-gray-600 mb-1">Remarks</label>
          <textarea
            rows={2}
            disabled={readOnly}
            value={dischargeRemarks}
            onChange={e => setDischargeRemarks(e.target.value)}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-xs resize-none disabled:bg-gray-50"
          />
        </div>
        {data.dischargeClearedAt && (
          <p className="text-xs text-gray-500">Cleared at {fmtTime(data.dischargeClearedAt)}</p>
        )}
        {!readOnly && (
          <button
            type="button"
            disabled={saving}
            onClick={saveDischargeClearance}
            className="w-full py-2 text-sm font-medium text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg disabled:opacity-50"
          >
            {saving ? 'Saving…' : 'Save Discharge Clearance'}
          </button>
        )}
        {!data.dischargeClearanceComplete && !readOnly && (
          <p className="text-xs text-amber-600">Optional: anaesthesia discharge clearance not yet recorded.</p>
        )}
      </div>
    );
  }

  const readings = data.readings ?? [];
  const usedIntervals = new Set(readings.map(r => r.elapsedMin));
  const quickIntervals = DEFAULT_INTERVALS.filter(m => !usedIntervals.has(m));

  return (
    <div className="space-y-5 border border-cyan-100 rounded-xl p-4 bg-cyan-50/30">
      <div className="flex items-center gap-2">
        <Activity className="h-4 w-4 text-cyan-600" />
        <h4 className="text-sm font-semibold text-gray-800">Anaesthesia Monitoring (Form 5)</h4>
      </div>

      {/* Pre-op review */}
      <section className="space-y-3">
        <p className="text-xs font-bold uppercase tracking-wide text-gray-500">Pre-op Review</p>
        <div className="grid grid-cols-3 gap-3">
          <div>
            <label className="block text-xs text-gray-600 mb-1">Pulse</label>
            <input
              type="number"
              disabled={readOnly}
              value={preOpPulse}
              onChange={e => setPreOpPulse(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-2 py-1.5 text-xs disabled:bg-gray-50"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-600 mb-1">BP</label>
            <input
              type="text"
              disabled={readOnly}
              value={preOpBp}
              onChange={e => setPreOpBp(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-2 py-1.5 text-xs disabled:bg-gray-50"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-600 mb-1">SpO₂ (%)</label>
            <input
              type="number"
              disabled={readOnly}
              value={preOpSpo2}
              onChange={e => setPreOpSpo2(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-2 py-1.5 text-xs disabled:bg-gray-50"
            />
          </div>
        </div>
        <label className="flex items-center gap-2 text-sm text-gray-700">
          <input
            type="checkbox"
            disabled={readOnly}
            checked={preOpConsent}
            onChange={e => setPreOpConsent(e.target.checked)}
            className="rounded border-gray-300"
          />
          Consent confirmed
        </label>
        {data.preOpReviewAt && (
          <p className="text-xs text-gray-400">Last saved {fmtTime(data.preOpReviewAt)}</p>
        )}
        {!readOnly && (
          <button
            type="button"
            disabled={saving}
            onClick={savePreOpReview}
            className="px-3 py-1.5 text-xs font-medium text-white bg-cyan-600 hover:bg-cyan-700 rounded-lg"
          >
            Save Pre-op Review
          </button>
        )}
      </section>

      {/* Intra-op readings */}
      <section className="space-y-3">
        <p className="text-xs font-bold uppercase tracking-wide text-gray-500">Intra-op Monitoring</p>
        {quickIntervals.length > 0 && !readOnly && (
          <div className="flex flex-wrap gap-1.5">
            <span className="text-[10px] text-gray-500 self-center mr-1">Quick add (min):</span>
            {quickIntervals.map(m => (
              <button
                key={m}
                type="button"
                onClick={() => addReading(m)}
                className="px-2 py-0.5 text-[10px] border border-cyan-200 text-cyan-700 rounded hover:bg-cyan-100"
              >
                {m}
              </button>
            ))}
          </div>
        )}
        <div className="overflow-x-auto">
          <table className="w-full text-xs border-collapse">
            <thead>
              <tr className="bg-gray-50 text-gray-500">
                <th className="text-left px-2 py-1.5 border border-gray-200">Elapsed (min)</th>
                <th className="text-left px-2 py-1.5 border border-gray-200">Pulse</th>
                <th className="text-left px-2 py-1.5 border border-gray-200">SpO₂</th>
                <th className="text-left px-2 py-1.5 border border-gray-200">Recorded</th>
                {!readOnly && <th className="w-8 border border-gray-200" />}
              </tr>
            </thead>
            <tbody>
              {readings.length === 0 ? (
                <tr>
                  <td colSpan={readOnly ? 4 : 5} className="px-2 py-4 text-center text-gray-400 border border-gray-200">
                    No readings yet
                  </td>
                </tr>
              ) : (
                readings.map(r => (
                  <tr key={r.id}>
                    <td className="px-2 py-1.5 border border-gray-200 font-medium">{r.elapsedMin}</td>
                    <td className="px-2 py-1.5 border border-gray-200">{r.pulse ?? '—'}</td>
                    <td className="px-2 py-1.5 border border-gray-200">{r.spo2 ?? '—'}</td>
                    <td className="px-2 py-1.5 border border-gray-200 text-gray-400">{fmtTime(r.recordedAt)}</td>
                    {!readOnly && (
                      <td className="border border-gray-200 text-center">
                        <button type="button" onClick={() => removeReading(r.id)} className="p-1 text-red-500 hover:bg-red-50 rounded">
                          <Trash2 className="h-3 w-3" />
                        </button>
                      </td>
                    )}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        {!readOnly && (
          <div className="flex flex-wrap items-end gap-2">
            <div>
              <label className="block text-[10px] text-gray-500 mb-0.5">Min</label>
              <input
                type="number"
                value={newElapsed}
                onChange={e => setNewElapsed(e.target.value)}
                placeholder="25"
                className="w-16 border border-gray-300 rounded-lg px-2 py-1.5 text-xs"
              />
            </div>
            <div>
              <label className="block text-[10px] text-gray-500 mb-0.5">Pulse</label>
              <input
                type="number"
                value={newPulse}
                onChange={e => setNewPulse(e.target.value)}
                className="w-16 border border-gray-300 rounded-lg px-2 py-1.5 text-xs"
              />
            </div>
            <div>
              <label className="block text-[10px] text-gray-500 mb-0.5">SpO₂</label>
              <input
                type="number"
                value={newSpo2}
                onChange={e => setNewSpo2(e.target.value)}
                className="w-16 border border-gray-300 rounded-lg px-2 py-1.5 text-xs"
              />
            </div>
            <button
              type="button"
              disabled={saving}
              onClick={() => addReading()}
              className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-white bg-cyan-600 hover:bg-cyan-700 rounded-lg"
            >
              <Plus className="h-3.5 w-3.5" /> Add Reading
            </button>
          </div>
        )}
      </section>
    </div>
  );
}
