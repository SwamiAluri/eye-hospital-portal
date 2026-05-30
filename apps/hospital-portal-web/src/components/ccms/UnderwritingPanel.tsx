'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { AlertTriangle, Plus, Trash2, RefreshCw, HeartPulse, Info } from 'lucide-react';
import { toast } from 'react-hot-toast';
import {
  getPoliciesByCase, updatePolicy,
  type VisitPolicy, type UnderwritingSnapshot, type UnderwritingCondition,
} from '@/lib/api/ccms/visit-policies.api';

// ── Pre-configured chronic condition options ──────────────────────────────────

const COMMON_CONDITIONS = [
  { code: 'HTN',    label: 'Hypertension' },
  { code: 'DM',     label: 'Diabetes Mellitus' },
  { code: 'IHD',    label: 'Ischaemic Heart Disease' },
  { code: 'COPD',   label: 'COPD / Asthma' },
  { code: 'CKD',    label: 'Chronic Kidney Disease' },
  { code: 'LIVER',  label: 'Liver Disease' },
  { code: 'THYROID','label': 'Thyroid Disorder' },
  { code: 'OBES',   label: 'Obesity' },
  { code: 'EPI',    label: 'Epilepsy' },
  { code: 'PSY',    label: 'Psychiatric Disorder' },
  { code: 'GLAU',   label: 'Glaucoma' },
  { code: 'CATAR',  label: 'Cataract (pre-existing)' },
];

interface Props {
  caseId: string;
  readOnly?: boolean;
}

export function UnderwritingPanel({ caseId, readOnly = false }: Props) {
  const [policies, setPolicies] = useState<VisitPolicy[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [saving,   setSaving]   = useState<string | null>(null);

  // Edit state (applies to primary policy)
  const [snapshot, setSnapshot] = useState<UnderwritingSnapshot>({
    conditions: [],
    alcoholUse: false,
    hivRisk:    false,
    otherAilments: '',
  });
  const [dirty, setDirty] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const pols = await getPoliciesByCase(caseId);
      setPolicies(pols);
      const primary = pols.find(p => p.isPrimary) ?? pols[0];
      if (primary?.underwritingSnapshot) {
        setSnapshot(primary.underwritingSnapshot);
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, [caseId]);

  useEffect(() => { load(); }, [load]);

  const primaryPolicy = policies.find(p => p.isPrimary) ?? policies[0];

  const toggleCondition = (cond: { code: string; label: string }) => {
    setDirty(true);
    setSnapshot(s => {
      const exists = s.conditions.find(c => c.code === cond.code);
      return {
        ...s,
        conditions: exists
          ? s.conditions.filter(c => c.code !== cond.code)
          : [...s.conditions, { code: cond.code, label: cond.label }],
      };
    });
  };

  const handleSave = async () => {
    if (!primaryPolicy) {
      toast.error('Add a primary policy first before saving underwriting data.');
      return;
    }
    setSaving(primaryPolicy.id);
    try {
      await updatePolicy(caseId, primaryPolicy.id, { underwritingSnapshot: snapshot });
      toast.success('Underwriting snapshot saved');
      setDirty(false);
      load();
    } catch {
      toast.error('Failed to save underwriting data');
    } finally {
      setSaving(null);
    }
  };

  if (loading) {
    return (
      <div className="space-y-2 animate-pulse">
        <div className="h-6 bg-gray-100 rounded w-1/3" />
        <div className="grid grid-cols-3 gap-2">
          {Array.from({ length: 9 }).map((_, i) => <div key={i} className="h-8 bg-gray-100 rounded-xl" />)}
        </div>
      </div>
    );
  }

  if (!primaryPolicy) {
    return (
      <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 flex items-start gap-2">
        <Info className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
        <p className="text-xs text-amber-800">
          Add an insurance policy first. Underwriting data is captured against the primary policy.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <HeartPulse className="w-4 h-4 text-rose-500" />
          <p className="text-xs font-bold text-gray-700 uppercase tracking-widest">
            Pre-Existing Conditions
          </p>
        </div>
        <p className="text-[10px] text-gray-400">Applied to: {primaryPolicy.policyNumber}</p>
      </div>

      {/* Condition chips */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
        {COMMON_CONDITIONS.map(cond => {
          const selected = snapshot.conditions.some(c => c.code === cond.code);
          return (
            <button key={cond.code} type="button"
              onClick={() => !readOnly && toggleCondition(cond)}
              className={`px-3 py-2 text-[11px] font-semibold rounded-xl border text-left transition-colors ${
                selected
                  ? 'bg-rose-50 border-rose-300 text-rose-800'
                  : 'bg-white border-gray-200 text-gray-600 hover:border-rose-200 hover:bg-rose-50/50'
              } ${readOnly ? 'cursor-default' : 'cursor-pointer'}`}
            >
              {selected && <span className="text-rose-500 mr-1">✓</span>}
              {cond.label}
            </button>
          );
        })}
      </div>

      {/* Risk flags */}
      <div className="flex items-center gap-4 pt-1">
        {[
          { key: 'alcoholUse', label: 'Alcohol Use' },
          { key: 'hivRisk',    label: 'HIV/AIDS Risk' },
        ].map(f => (
          <label key={f.key} className="flex items-center gap-2 text-xs cursor-pointer">
            <input
              type="checkbox"
              checked={(snapshot as any)[f.key]}
              disabled={readOnly}
              onChange={e => { setDirty(true); setSnapshot(s => ({ ...s, [f.key]: e.target.checked })); }}
              className="rounded border-gray-300 text-rose-600 focus:ring-rose-500"
            />
            <span className="text-gray-700">{f.label}</span>
          </label>
        ))}
      </div>

      {/* Other ailments */}
      {!readOnly && (
        <div>
          <label className="block text-[10px] font-semibold text-gray-500 uppercase tracking-widest mb-1">
            Other Ailments / Notes
          </label>
          <textarea
            value={snapshot.otherAilments ?? ''}
            onChange={e => { setDirty(true); setSnapshot(s => ({ ...s, otherAilments: e.target.value })); }}
            rows={2}
            className="w-full px-3 py-2 text-xs border border-gray-200 rounded-xl resize-none focus:outline-none focus:ring-2 focus:ring-rose-400/30 placeholder:text-gray-300"
            placeholder="Any other pre-existing conditions or relevant notes…"
          />
        </div>
      )}

      {/* Active conditions preview (read-only or when nothing selected) */}
      {snapshot.conditions.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {snapshot.conditions.map(c => (
            <span key={c.code} className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-rose-100 text-rose-700">
              {c.label}
            </span>
          ))}
        </div>
      )}

      {/* Save button */}
      {!readOnly && dirty && (
        <div className="flex justify-end pt-1">
          <button onClick={handleSave} disabled={!!saving}
            className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-xl bg-rose-600 text-white hover:bg-rose-700 disabled:opacity-50">
            {saving ? <RefreshCw className="w-3 h-3 animate-spin" /> : <HeartPulse className="w-3 h-3" />}
            Save Underwriting Data
          </button>
        </div>
      )}
    </div>
  );
}
