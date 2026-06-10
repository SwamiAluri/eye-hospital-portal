'use client';

import { useCallback, useEffect, useState } from 'react';
import { CheckCircle2, Loader2, Plus, Stethoscope, Trash2 } from 'lucide-react';
import { toast } from 'react-hot-toast';
import {
  ipManagementApi,
  PacAssessmentDto,
  PacMedicationLineDto,
  SavePacAssessmentRequest,
} from '@/lib/api/ip-management.api';

export interface PacAssessmentFormProps {
  journeyId: string;
  readOnly?: boolean;
  onStatusChange?: (completed: boolean) => void;
}

const ASA_OPTIONS = [1, 2, 3, 4, 5] as const;
const ANAESTHESIA_PLANS = ['Local', 'General', 'Spinal', 'Topical', 'Retrobulbar', 'Peribulbar'] as const;
const CONSENT_TYPES = ['Written', 'Witnessed', 'Verbal'] as const;

const INVESTIGATION_FIELDS: Array<{ key: keyof PacAssessmentDto['investigations']; label: string }> = [
  { key: 'hgb', label: 'Hb / Hgb' },
  { key: 'fbs', label: 'FBS' },
  { key: 'serumCreatinine', label: 'Serum Creatinine' },
  { key: 'hiv', label: 'HIV' },
  { key: 'hBsAg', label: 'HBsAg' },
  { key: 'hcv', label: 'HCV' },
  { key: 'xray', label: 'X-Ray' },
  { key: 'ecg', label: 'ECG' },
  { key: 'echo2d', label: '2D Echo' },
  { key: 'bloodGroup', label: 'Blood Group' },
  { key: 'others', label: 'Others' },
];

const SYSTEMIC_FIELDS: Array<{ key: keyof PacAssessmentDto['systemicReview']; label: string }> = [
  { key: 'cvs', label: 'CVS' },
  { key: 'respiratory', label: 'Respiratory' },
  { key: 'renal', label: 'Renal' },
  { key: 'hepaticGi', label: 'Hepatic / GI' },
  { key: 'diabetes', label: 'Diabetes' },
  { key: 'cns', label: 'CNS' },
  { key: 'others', label: 'Others' },
];

function toLocalInput(dt: string | null | undefined): string {
  if (!dt) return '';
  const d = new Date(dt);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function PacAssessmentForm({ journeyId, readOnly = false, onStatusChange }: PacAssessmentFormProps) {
  const [data, setData] = useState<PacAssessmentDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [completing, setCompleting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const result = await ipManagementApi.getPacAssessment(journeyId);
    setData(result);
    onStatusChange?.(result?.assessmentStatus === 'Completed');
    setLoading(false);
  }, [journeyId, onStatusChange]);

  useEffect(() => {
    load();
  }, [load]);

  const isLocked = readOnly || data?.assessmentStatus === 'Completed';

  async function persist(patch: SavePacAssessmentRequest) {
    if (isLocked) return;
    setSaving(true);
    const updated = await ipManagementApi.savePacAssessment(journeyId, patch);
    if (updated) {
      setData(updated);
      onStatusChange?.(updated.assessmentStatus === 'Completed');
    } else toast.error('Failed to save PAC assessment');
    setSaving(false);
  }

  async function handleComplete() {
    if (isLocked || !data) return;
    if (!data.isComplete) {
      toast.error('Fill required fields (BP, HR, ASA, anaesthesia plan, consent) before completing.');
      return;
    }
    setCompleting(true);
    const updated = await ipManagementApi.completePacAssessment(journeyId);
    if (updated) {
      setData(updated);
      onStatusChange?.(true);
      toast.success('PAC assessment completed — ward checklist synced');
    } else toast.error('Could not complete PAC assessment');
    setCompleting(false);
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12 text-gray-400">
        <Loader2 className="h-5 w-5 animate-spin mr-2" /> Loading PAC…
      </div>
    );
  }

  if (!data) {
    return <p className="text-sm text-red-600 py-4">Could not load PAC assessment.</p>;
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Stethoscope className="h-4 w-4 text-violet-600" />
          <h3 className="text-sm font-semibold text-gray-800">Pre-Anaesthesia Check-up (Form 3)</h3>
        </div>
        <div className="flex items-center gap-2">
          {saving && <span className="text-xs text-gray-400">Saving…</span>}
          {data.assessmentStatus === 'Completed' ? (
            <span className="inline-flex items-center gap-1 text-xs font-medium text-green-700 bg-green-50 px-2 py-1 rounded-full">
              <CheckCircle2 className="h-3.5 w-3.5" /> Completed
            </span>
          ) : data.isComplete ? (
            <span className="text-xs text-amber-600">Ready to complete</span>
          ) : (
            <span className="text-xs text-gray-400">Draft</span>
          )}
        </div>
      </div>

      {(data.patientName || data.procedureName) && (
        <div className="bg-violet-50 border border-violet-100 rounded-xl px-4 py-3 text-xs text-violet-900">
          <p className="font-medium">{data.patientName ?? '—'} · {data.uhid ?? '—'}</p>
          <p className="text-violet-700 mt-0.5">{data.procedureName ?? '—'} · {data.eyeOperated ?? '—'}</p>
        </div>
      )}

      {/* Vitals & ASA */}
      <section className="space-y-3">
        <p className="text-xs font-bold uppercase tracking-wide text-gray-500">Vitals &amp; Physical Status</p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div>
            <label className="block text-xs text-gray-600 mb-1">Assessed at</label>
            <input
              type="datetime-local"
              disabled={isLocked}
              value={toLocalInput(data.assessedAt)}
              onChange={e => persist({ assessedAt: e.target.value ? new Date(e.target.value).toISOString() : null })}
              className="w-full border border-gray-300 rounded-lg px-2 py-1.5 text-xs disabled:bg-gray-50"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-600 mb-1">BP *</label>
            <input
              type="text"
              disabled={isLocked}
              placeholder="120/80"
              value={data.bp ?? ''}
              onChange={e => setData(d => d ? { ...d, bp: e.target.value } : d)}
              onBlur={e => persist({ bp: e.target.value || null })}
              className="w-full border border-gray-300 rounded-lg px-2 py-1.5 text-xs disabled:bg-gray-50"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-600 mb-1">HR (bpm) *</label>
            <input
              type="number"
              disabled={isLocked}
              value={data.hr ?? ''}
              onChange={e => setData(d => d ? { ...d, hr: e.target.value ? Number(e.target.value) : null } : d)}
              onBlur={e => persist({ hr: e.target.value ? Number(e.target.value) : null })}
              className="w-full border border-gray-300 rounded-lg px-2 py-1.5 text-xs disabled:bg-gray-50"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-600 mb-1">ASA Grade *</label>
            <div className="flex flex-wrap gap-1">
              {ASA_OPTIONS.map(n => (
                <button
                  key={n}
                  type="button"
                  disabled={isLocked}
                  onClick={() => { setData(d => d ? { ...d, physicalStatusAsa: n } : d); persist({ physicalStatusAsa: n }); }}
                  className={`px-2 py-1 text-xs rounded border ${data.physicalStatusAsa === n ? 'bg-violet-600 text-white border-violet-600' : 'border-gray-300 text-gray-600'}`}
                >
                  {n}
                </button>
              ))}
            </div>
          </div>
        </div>
        <div>
          <label className="block text-xs text-gray-600 mb-1">Pre-op Diagnosis</label>
          <input
            type="text"
            disabled={isLocked}
            value={data.preOpDiagnosis ?? ''}
            onChange={e => setData(d => d ? { ...d, preOpDiagnosis: e.target.value } : d)}
            onBlur={e => persist({ preOpDiagnosis: e.target.value || null })}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-xs disabled:bg-gray-50"
          />
        </div>
      </section>

      {/* Investigations */}
      <section className="space-y-2">
        <p className="text-xs font-bold uppercase tracking-wide text-gray-500">Investigations</p>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {INVESTIGATION_FIELDS.map(({ key, label }) => (
            <div key={key}>
              <label className="block text-[10px] text-gray-500 mb-0.5">{label}</label>
              <input
                type="text"
                disabled={isLocked}
                value={data.investigations?.[key] ?? ''}
                onChange={e => setData(d => d ? {
                  ...d,
                  investigations: { ...(d.investigations ?? {}), [key]: e.target.value },
                } : d)}
                onBlur={() => persist({ investigations: data.investigations ?? {} })}
                className="w-full border border-gray-300 rounded-lg px-2 py-1.5 text-xs disabled:bg-gray-50"
              />
            </div>
          ))}
        </div>
      </section>

      {/* Allergies & systemic */}
      <section className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-xs text-gray-600 mb-1">Allergies</label>
          <textarea
            rows={2}
            disabled={isLocked}
            value={data.allergies ?? ''}
            onChange={e => setData(d => d ? { ...d, allergies: e.target.value } : d)}
            onBlur={e => persist({ allergies: e.target.value || null })}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-xs resize-none disabled:bg-gray-50"
          />
        </div>
        <div>
          <label className="block text-xs text-gray-600 mb-1">Past Anaesthetic History</label>
          <textarea
            rows={2}
            disabled={isLocked}
            value={data.pastAnaestheticHistory ?? ''}
            onChange={e => setData(d => d ? { ...d, pastAnaestheticHistory: e.target.value } : d)}
            onBlur={e => persist({ pastAnaestheticHistory: e.target.value || null })}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-xs resize-none disabled:bg-gray-50"
          />
        </div>
      </section>

      <section className="space-y-2">
        <p className="text-xs font-bold uppercase tracking-wide text-gray-500">Systemic Review</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {SYSTEMIC_FIELDS.map(({ key, label }) => (
            <div key={key}>
              <label className="block text-[10px] text-gray-500 mb-0.5">{label}</label>
              <input
                type="text"
                disabled={isLocked}
                value={data.systemicReview?.[key] ?? ''}
                onChange={e => setData(d => d ? {
                  ...d,
                  systemicReview: { ...(d.systemicReview ?? {}), [key]: e.target.value },
                } : d)}
                onBlur={() => persist({ systemicReview: data.systemicReview ?? {} })}
                className="w-full border border-gray-300 rounded-lg px-2 py-1.5 text-xs disabled:bg-gray-50"
              />
            </div>
          ))}
        </div>
      </section>

      {/* Airway */}
      <section className="space-y-2">
        <p className="text-xs font-bold uppercase tracking-wide text-gray-500">Airway Examination</p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {([
            { key: 'mallampati' as const, label: 'Mallampati', type: 'number' },
            { key: 'mouthOpening' as const, label: 'Mouth Opening', type: 'text' },
            { key: 'mentohyoid' as const, label: 'Mentohyoid', type: 'text' },
            { key: 'neck' as const, label: 'Neck', type: 'text' },
            { key: 'teeth' as const, label: 'Teeth', type: 'text' },
            { key: 'lungs' as const, label: 'Lungs', type: 'text' },
            { key: 'heart' as const, label: 'Heart', type: 'text' },
            { key: 'venousAccess' as const, label: 'Venous Access', type: 'text' },
          ]).map(({ key, label, type }) => (
            <div key={key}>
              <label className="block text-[10px] text-gray-500 mb-0.5">{label}</label>
              <input
                type={type}
                disabled={isLocked}
                value={key === 'mallampati'
                  ? (data.airwayExam?.mallampati ?? '')
                  : (data.airwayExam?.[key] ?? '')}
                onChange={e => setData(d => d ? {
                  ...d,
                  airwayExam: {
                    ...(d.airwayExam ?? {}),
                    [key]: type === 'number'
                      ? (e.target.value ? Number(e.target.value) : null)
                      : e.target.value,
                  },
                } : d)}
                onBlur={() => persist({ airwayExam: data.airwayExam ?? {} })}
                className="w-full border border-gray-300 rounded-lg px-2 py-1.5 text-xs disabled:bg-gray-50"
              />
            </div>
          ))}
        </div>
      </section>

      {/* Plan & consent */}
      <section className="space-y-3">
        <p className="text-xs font-bold uppercase tracking-wide text-gray-500">Anaesthesia Plan &amp; Consent</p>
        <div>
          <label className="block text-xs text-gray-600 mb-1">Anaesthesia Plan *</label>
          <div className="flex flex-wrap gap-2">
            {ANAESTHESIA_PLANS.map(plan => (
              <button
                key={plan}
                type="button"
                disabled={isLocked}
                onClick={() => { setData(d => d ? { ...d, anaesthesiaPlan: plan } : d); persist({ anaesthesiaPlan: plan }); }}
                className={`px-3 py-1.5 text-xs rounded-lg border ${data.anaesthesiaPlan === plan ? 'bg-violet-600 text-white border-violet-600' : 'border-gray-300 text-gray-600'}`}
              >
                {plan}
              </button>
            ))}
          </div>
        </div>
        <div>
          <label className="block text-xs text-gray-600 mb-1">Consent Type *</label>
          <div className="flex flex-wrap gap-2">
            {CONSENT_TYPES.map(ct => (
              <button
                key={ct}
                type="button"
                disabled={isLocked}
                onClick={() => { setData(d => d ? { ...d, consentType: ct } : d); persist({ consentType: ct }); }}
                className={`px-3 py-1.5 text-xs rounded-lg border ${data.consentType === ct ? 'bg-violet-600 text-white border-violet-600' : 'border-gray-300 text-gray-600'}`}
              >
                {ct}
              </button>
            ))}
          </div>
        </div>
        <label className="flex items-center gap-2 text-sm text-gray-700">
          <input
            type="checkbox"
            disabled={isLocked}
            checked={data.periOpExplained}
            onChange={e => {
              setData(d => d ? { ...d, periOpExplained: e.target.checked } : d);
              persist({ periOpExplained: e.target.checked });
            }}
            className="rounded border-gray-300"
          />
          Peri-operative instructions explained to patient
        </label>
      </section>

      {/* Medications */}
      <section className="space-y-2">
        <div className="flex items-center justify-between">
          <p className="text-xs font-bold uppercase tracking-wide text-gray-500">Current Medications</p>
          {!isLocked && (
            <button
              type="button"
              onClick={() => {
                const meds: PacMedicationLineDto[] = [...(data.currentMedications ?? []), { name: '', dose: '', frequency: '' }];
                setData(d => d ? { ...d, currentMedications: meds } : d);
                persist({ currentMedications: meds });
              }}
              className="flex items-center gap-1 text-xs text-violet-600 hover:text-violet-800"
            >
              <Plus className="h-3.5 w-3.5" /> Add
            </button>
          )}
        </div>
        {(data.currentMedications ?? []).length === 0 ? (
          <p className="text-xs text-gray-400">No medications recorded.</p>
        ) : (
          <div className="space-y-2">
            {(data.currentMedications ?? []).map((med, idx) => (
              <div key={idx} className="flex gap-2 items-start">
                <input
                  placeholder="Drug"
                  disabled={isLocked}
                  value={med.name}
                  onChange={e => {
                    const meds = [...(data.currentMedications ?? [])];
                    meds[idx] = { ...meds[idx], name: e.target.value };
                    setData(d => d ? { ...d, currentMedications: meds } : d);
                  }}
                  onBlur={() => persist({ currentMedications: data.currentMedications ?? [] })}
                  className="flex-1 border border-gray-300 rounded-lg px-2 py-1.5 text-xs disabled:bg-gray-50"
                />
                <input
                  placeholder="Dose"
                  disabled={isLocked}
                  value={med.dose ?? ''}
                  onChange={e => {
                    const meds = [...(data.currentMedications ?? [])];
                    meds[idx] = { ...meds[idx], dose: e.target.value };
                    setData(d => d ? { ...d, currentMedications: meds } : d);
                  }}
                  onBlur={() => persist({ currentMedications: data.currentMedications ?? [] })}
                  className="w-24 border border-gray-300 rounded-lg px-2 py-1.5 text-xs disabled:bg-gray-50"
                />
                <input
                  placeholder="Freq"
                  disabled={isLocked}
                  value={med.frequency ?? ''}
                  onChange={e => {
                    const meds = [...(data.currentMedications ?? [])];
                    meds[idx] = { ...meds[idx], frequency: e.target.value };
                    setData(d => d ? { ...d, currentMedications: meds } : d);
                  }}
                  onBlur={() => persist({ currentMedications: data.currentMedications ?? [] })}
                  className="w-24 border border-gray-300 rounded-lg px-2 py-1.5 text-xs disabled:bg-gray-50"
                />
                {!isLocked && (
                  <button
                    type="button"
                    onClick={() => {
                      const meds = (data.currentMedications ?? []).filter((_, i) => i !== idx);
                      setData(d => d ? { ...d, currentMedications: meds } : d);
                      persist({ currentMedications: meds });
                    }}
                    className="p-1.5 text-red-500 hover:bg-red-50 rounded"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Advisories */}
      <section className="grid grid-cols-1 gap-3">
        {([
          { key: 'preOpConsultations' as const, label: 'Pre-op Consultations' },
          { key: 'medicationsAdvised' as const, label: 'Medications Advised' },
          { key: 'investigationsAdvised' as const, label: 'Investigations Advised' },
        ]).map(({ key, label }) => (
          <div key={key}>
            <label className="block text-xs text-gray-600 mb-1">{label}</label>
            <textarea
              rows={2}
              disabled={isLocked}
              value={data[key] ?? ''}
              onChange={e => setData(d => d ? { ...d, [key]: e.target.value } : d)}
              onBlur={e => {
                const v = e.target.value || null;
                if (key === 'preOpConsultations') persist({ preOpConsultations: v });
                else if (key === 'medicationsAdvised') persist({ medicationsAdvised: v });
                else persist({ investigationsAdvised: v });
              }}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-xs resize-none disabled:bg-gray-50"
            />
          </div>
        ))}
        <div>
          <label className="block text-xs text-gray-600 mb-1">Completed By (Designation)</label>
          <input
            type="text"
            disabled={isLocked}
            placeholder="Anaesthetist / Junior Doctor"
            value={data.completedByDesignation ?? ''}
            onChange={e => setData(d => d ? { ...d, completedByDesignation: e.target.value } : d)}
            onBlur={e => persist({ completedByDesignation: e.target.value || null })}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-xs disabled:bg-gray-50"
          />
        </div>
      </section>

      {!isLocked && (
        <div className="flex justify-end pt-2 border-t border-gray-100">
          <button
            type="button"
            disabled={completing || !data.isComplete}
            onClick={handleComplete}
            className="px-4 py-2 text-sm font-medium text-white bg-violet-600 hover:bg-violet-700 rounded-lg disabled:opacity-50"
          >
            {completing ? 'Completing…' : 'Complete PAC Assessment'}
          </button>
        </div>
      )}

      {data.completedAt && (
        <p className="text-xs text-gray-400 text-right">
          Completed {new Date(data.completedAt).toLocaleString('en-IN')}
        </p>
      )}
    </div>
  );
}
