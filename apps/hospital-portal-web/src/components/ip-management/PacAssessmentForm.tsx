'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Activity, AlertTriangle, ArrowUpRight, CheckCircle2, HeartPulse, Loader2, Plus, Stethoscope, Trash2 } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { PacInvestigationSummary } from '@/components/ip-management/PacInvestigationSummary';
import { PacAccordionSection } from '@/components/ip-management/preop/primitives/PacAccordionSection';
import { usePreOpClearanceOptional } from '@/components/ip-management/preop/PreOpClearanceProvider';
import {
  ipManagementApi,
  PacAssessmentDto,
  PacMedicationLineDto,
  SavePacAssessmentRequest,
  VitalSignDto,
} from '@/lib/api/ip-management.api';
import type { PreOpStatus } from '@/lib/ip-management/preop-status';
import { getPreOpDiagnosisFromClearance } from '@/lib/ip-management/clinical-evaluation';
import { WARD_PREOP_TEST_IDS } from '@/lib/ip-management/ward-preop-test-ids';

export interface PacAssessmentFormProps {
  journeyId: string;
  readOnly?: boolean;
  onStatusChange?: (completed: boolean) => void;
  /** Deep-link to §1 Investigations (single editable lab source). */
  onNavigateInvestigations?: () => void;
  /** Deep-link to Step ⑧ Nursing & Records (single vitals source). */
  onNavigateVitals?: () => void;
  /** Deep-link to §2 Clinical Evaluation (pre-op diagnosis owner). */
  onNavigateEvaluation?: () => void;
  /** Notify the workspace that data changed so the step rail rollup can refresh. */
  onChanged?: () => void;
}

const ASA_OPTIONS = [1, 2, 3, 4, 5] as const;
const MALLAMPATI_OPTIONS = [
  { value: 1, label: 'I' },
  { value: 2, label: 'II' },
  { value: 3, label: 'III' },
  { value: 4, label: 'IV' },
] as const;
const ANAESTHESIA_PLANS = ['Local', 'General', 'Spinal', 'Topical', 'Retrobulbar', 'Peribulbar'] as const;
const CONSENT_TYPES = ['Written', 'Witnessed', 'Verbal'] as const;

const SYSTEMIC_FIELDS: Array<{ key: keyof PacAssessmentDto['systemicReview']; label: string }> = [
  { key: 'cvs', label: 'CVS' },
  { key: 'respiratory', label: 'Respiratory' },
  { key: 'renal', label: 'Renal' },
  { key: 'hepaticGi', label: 'Hepatic / GI' },
  { key: 'diabetes', label: 'Diabetes' },
  { key: 'cns', label: 'CNS' },
  { key: 'others', label: 'Others' },
];

const AIRWAY_TEXT_FIELDS: Array<{ key: keyof NonNullable<PacAssessmentDto['airwayExam']>; label: string }> = [
  { key: 'mouthOpening', label: 'Mouth opening' },
  { key: 'mentohyoid', label: 'Mentohyoid' },
  { key: 'neck', label: 'Neck' },
  { key: 'teeth', label: 'Teeth' },
  { key: 'lungs', label: 'Lungs' },
  { key: 'heart', label: 'Heart' },
  { key: 'venousAccess', label: 'Venous access' },
];

type PacAccordionKey = 'assessment' | 'airway' | 'systemic' | 'plan' | 'reference' | 'complete';

function toLocalInput(dt: string | null | undefined): string {
  if (!dt) return '';
  const d = new Date(dt);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function formatBpFromVital(v: VitalSignDto): string | null {
  if (v.bloodPressureSystolic != null && v.bloodPressureDiastolic != null) {
    return `${v.bloodPressureSystolic}/${v.bloodPressureDiastolic}`;
  }
  return null;
}

function applyVitalsPrefill(
  pac: PacAssessmentDto,
  vitals: VitalSignDto[],
): { data: PacAssessmentDto; note: string | null } {
  if (vitals.length === 0 || (pac.bp && pac.hr != null)) {
    return { data: pac, note: null };
  }
  const latest = vitals[0];
  const bp = !pac.bp ? formatBpFromVital(latest) : null;
  const hr = pac.hr == null ? latest.pulseRate : null;
  if (!bp && hr == null) return { data: pac, note: null };
  return {
    data: {
      ...pac,
      bp: pac.bp ?? bp,
      hr: pac.hr ?? hr,
    },
    note: 'Prefilled from latest Vitals tab entry — review before completing PAC.',
  };
}

function systemicComplete(review: PacAssessmentDto['systemicReview'] | undefined): boolean {
  return SYSTEMIC_FIELDS.every(({ key }) => !!review?.[key]?.trim());
}

function assessmentComplete(data: PacAssessmentDto): boolean {
  return !!(data.bp?.trim() && data.hr != null && data.physicalStatusAsa);
}

function airwayComplete(data: PacAssessmentDto): boolean {
  return data.airwayExam?.mallampati != null;
}

function planComplete(data: PacAssessmentDto): boolean {
  return !!(data.anaesthesiaPlan && data.consentType);
}

function sectionStatus(data: PacAssessmentDto, key: PacAccordionKey): PreOpStatus {
  switch (key) {
    case 'assessment':
      return assessmentComplete(data) ? 'completed' : data.bp || data.hr != null || data.physicalStatusAsa ? 'in-progress' : 'not-started';
    case 'airway':
      return airwayComplete(data) ? 'completed' : Object.values(data.airwayExam ?? {}).some(v => v != null && v !== '') ? 'in-progress' : 'not-started';
    case 'systemic':
      return systemicComplete(data.systemicReview) ? 'completed' : 'not-started';
    case 'plan':
      return planComplete(data) ? 'completed' : data.anaesthesiaPlan || data.consentType ? 'in-progress' : 'not-started';
    case 'reference':
      return 'verified';
    case 'complete':
      return data.assessmentStatus === 'Completed' ? 'completed' : data.isComplete ? 'pending-verification' : 'not-started';
    default:
      return 'not-started';
  }
}

function pickDefaultOpen(data: PacAssessmentDto): PacAccordionKey {
  if (!assessmentComplete(data)) return 'assessment';
  if (!airwayComplete(data)) return 'airway';
  if (!systemicComplete(data.systemicReview)) return 'systemic';
  if (!planComplete(data)) return 'plan';
  if (data.assessmentStatus !== 'Completed') return 'complete';
  return 'reference';
}

export function PacAssessmentForm({
  journeyId,
  readOnly = false,
  onStatusChange,
  onNavigateInvestigations,
  onNavigateVitals,
  onNavigateEvaluation,
  onChanged,
}: PacAssessmentFormProps) {
  const [data, setData] = useState<PacAssessmentDto | null>(null);
  const [vitals, setVitals] = useState<VitalSignDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [completing, setCompleting] = useState(false);
  const [vitalsPrefillNote, setVitalsPrefillNote] = useState<string | null>(null);
  const [completeDialog, setCompleteDialog] = useState<{ keys: string[] } | null>(null);
  const [openSection, setOpenSection] = useState<PacAccordionKey | null>(null);
  const [initialOpenSet, setInitialOpenSet] = useState(false);
  const sharedClearance = usePreOpClearanceOptional();

  const load = useCallback(async () => {
    setLoading(true);
    const [result, vitalsList] = await Promise.all([
      ipManagementApi.getPacAssessment(journeyId),
      ipManagementApi.getVitals(journeyId).catch(() => [] as VitalSignDto[]),
    ]);
    setVitals(vitalsList);
    if (result) {
      const { data: withPrefill, note } = applyVitalsPrefill(result, vitalsList);
      setData(withPrefill);
      setVitalsPrefillNote(note);
      onStatusChange?.(withPrefill.assessmentStatus === 'Completed');
    } else {
      setData(null);
    }
    setLoading(false);
  }, [journeyId, onStatusChange]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (data && !initialOpenSet) {
      setOpenSection(pickDefaultOpen(data));
      setInitialOpenSet(true);
    }
  }, [data, initialOpenSet]);

  const isLocked = readOnly || data?.assessmentStatus === 'Completed';

  async function persist(patch: SavePacAssessmentRequest) {
    if (isLocked || !data) return;
    setSaving(true);
    const updated = await ipManagementApi.savePacAssessment(journeyId, patch);
    if (updated) {
      setData(updated);
      setVitalsPrefillNote(null);
      onStatusChange?.(updated.assessmentStatus === 'Completed');
      onChanged?.();
    } else toast.error('Failed to save PAC assessment');
    setSaving(false);
  }

  function toggleSection(key: PacAccordionKey) {
    setOpenSection(prev => (prev === key ? null : key));
  }

  function persistSystemicField(key: keyof PacAssessmentDto['systemicReview'], raw: string) {
    const value = raw.trim() || 'NAD';
    const review = { ...(data?.systemicReview ?? {}), [key]: value };
    setData(d => (d ? { ...d, systemicReview: review } : d));
    void persist({ systemicReview: review });
  }

  async function doComplete() {
    if (isLocked || !data) return;
    setCompleting(true);
    const result = await ipManagementApi.completePacAssessment(journeyId);
    if (result) {
      setData(result.assessment);
      onStatusChange?.(true);
      onChanged?.();
      if (result.unverifiedCriticalWarnings.length > 0) {
        toast(
          `PAC completed. ${result.unverifiedCriticalWarnings.length} critical investigation(s) remain unverified at ward.`,
          { icon: '⚠️' },
        );
      } else {
        toast.success('PAC assessment completed — ward checklist synced');
      }
    } else {
      toast.error('Could not complete PAC assessment');
    }
    setCompleting(false);
    setCompleteDialog(null);
  }

  async function handleCompleteClick() {
    if (isLocked || !data) return;
    if (!data.isComplete) {
      toast.error('Fill required fields (BP, HR, ASA, anaesthesia plan, consent) before completing.');
      return;
    }
    const summary = await ipManagementApi.getWardInvestigationSummary(journeyId);
    const keys = summary?.unverifiedCriticalKeys ?? [];
    if (keys.length > 0) {
      setCompleteDialog({ keys });
      return;
    }
    await doComplete();
  }

  const displayDiagnosis = useMemo(() => {
    const fromEvaluation = getPreOpDiagnosisFromClearance(sharedClearance?.detail?.completions ?? []);
    if (fromEvaluation) return fromEvaluation;
    if (!data) return '—';
    return data.preOpDiagnosis?.trim() || 'Not recorded in Clinical Evaluation';
  }, [data, sharedClearance?.detail?.completions]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12 text-gray-400">
        <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Loading PAC…
      </div>
    );
  }

  if (!data) {
    return <p className="py-4 text-sm text-red-600">Could not load PAC assessment.</p>;
  }

  return (
    <div className="space-y-3" data-testid={WARD_PREOP_TEST_IDS.sectionPac}>
      <div className="mb-1 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Stethoscope className="h-4 w-4 text-violet-600" />
          <h3 className="text-sm font-semibold text-gray-800">Pre-Anaesthesia Check-up</h3>
        </div>
        <div className="flex items-center gap-2">
          {saving && <span className="text-xs text-gray-400">Saving…</span>}
          {readOnly && data.assessmentStatus !== 'Completed' && (
            <span className="rounded-full bg-gray-100 px-2 py-1 text-xs text-gray-500">View only</span>
          )}
          {data.assessmentStatus === 'Completed' ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-green-50 px-2 py-1 text-xs font-medium text-green-700">
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
        <div className="rounded-xl border border-violet-100 bg-violet-50 px-4 py-3 text-xs text-violet-900">
          <p className="font-medium">
            {data.patientName ?? '—'} · {data.uhid ?? '—'}
          </p>
          <p className="mt-0.5 text-violet-700">
            {data.procedureName ?? '—'} · {data.eyeOperated ?? '—'}
          </p>
        </div>
      )}

      <PacAccordionSection
        sectionKey="assessment"
        title="Pre-op assessment"
        subtitle="Vitals snapshot, ASA, allergies, anaesthetic history"
        status={sectionStatus(data, 'assessment')}
        open={openSection === 'assessment'}
        onToggle={() => toggleSection('assessment')}
      >
        {vitalsPrefillNote && !isLocked && (
          <p className="mb-3 rounded-lg border border-blue-100 bg-blue-50 px-3 py-2 text-xs text-blue-700">
            {vitalsPrefillNote}
          </p>
        )}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div>
            <label className="mb-1 block text-xs text-gray-600">Assessed at</label>
            <input
              type="datetime-local"
              disabled={isLocked}
              value={toLocalInput(data.assessedAt)}
              onChange={e =>
                persist({ assessedAt: e.target.value ? new Date(e.target.value).toISOString() : null })
              }
              className="w-full rounded-lg border border-gray-300 px-2 py-1.5 text-xs disabled:bg-gray-50"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs text-gray-600">BP *</label>
            <input
              type="text"
              disabled={isLocked}
              placeholder="120/80"
              value={data.bp ?? ''}
              onChange={e => setData(d => (d ? { ...d, bp: e.target.value } : d))}
              onBlur={e => persist({ bp: e.target.value || null })}
              className="w-full rounded-lg border border-gray-300 px-2 py-1.5 text-xs disabled:bg-gray-50"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs text-gray-600">HR (bpm) *</label>
            <input
              type="number"
              disabled={isLocked}
              value={data.hr ?? ''}
              onChange={e =>
                setData(d => (d ? { ...d, hr: e.target.value ? Number(e.target.value) : null } : d))
              }
              onBlur={e => persist({ hr: e.target.value ? Number(e.target.value) : null })}
              className="w-full rounded-lg border border-gray-300 px-2 py-1.5 text-xs disabled:bg-gray-50"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs text-gray-600">ASA grade *</label>
            <div className="flex flex-wrap gap-1">
              {ASA_OPTIONS.map(n => (
                <button
                  key={n}
                  type="button"
                  disabled={isLocked}
                  onClick={() => {
                    setData(d => (d ? { ...d, physicalStatusAsa: n } : d));
                    persist({ physicalStatusAsa: n });
                  }}
                  className={`rounded border px-2 py-1 text-xs ${
                    data.physicalStatusAsa === n
                      ? 'border-violet-600 bg-violet-600 text-white'
                      : 'border-gray-300 text-gray-600'
                  }`}
                >
                  {n}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="mt-3">
          <div className="mb-1 flex items-center justify-between gap-2">
            <label className="text-xs text-gray-600">Pre-op diagnosis (read-only)</label>
            {onNavigateEvaluation && (
              <button
                type="button"
                onClick={onNavigateEvaluation}
                className="inline-flex items-center gap-0.5 rounded-md px-1.5 py-0.5 text-[11px] font-medium text-violet-700 hover:bg-violet-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-500"
              >
                Edit in Clinical Evaluation
                <ArrowUpRight className="h-3 w-3" aria-hidden="true" />
              </button>
            )}
          </div>
          <p className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-xs text-gray-800">
            {displayDiagnosis}
          </p>
          <p className="mt-1 text-[10px] text-gray-500">
            Diagnosis is owned by Clinical Evaluation; PAC references it for anaesthesia planning.
          </p>
        </div>

        <div className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-xs text-gray-600">Allergies</label>
            <textarea
              rows={2}
              disabled={isLocked}
              value={data.allergies ?? ''}
              onChange={e => setData(d => (d ? { ...d, allergies: e.target.value } : d))}
              onBlur={e => persist({ allergies: e.target.value || null })}
              className="w-full resize-none rounded-lg border border-gray-300 px-3 py-2 text-xs disabled:bg-gray-50"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs text-gray-600">Past anaesthetic history</label>
            <textarea
              rows={2}
              disabled={isLocked}
              value={data.pastAnaestheticHistory ?? ''}
              onChange={e => setData(d => (d ? { ...d, pastAnaestheticHistory: e.target.value } : d))}
              onBlur={e => persist({ pastAnaestheticHistory: e.target.value || null })}
              className="w-full resize-none rounded-lg border border-gray-300 px-3 py-2 text-xs disabled:bg-gray-50"
            />
          </div>
        </div>
      </PacAccordionSection>

      <PacAccordionSection
        sectionKey="airway"
        title="Airway examination"
        subtitle="Mallampati and bedside airway assessment"
        status={sectionStatus(data, 'airway')}
        open={openSection === 'airway'}
        onToggle={() => toggleSection('airway')}
      >
        <div className="space-y-3">
          <div>
            <label className="mb-1 block text-xs text-gray-600">Mallampati *</label>
            <div className="flex flex-wrap gap-2">
              {MALLAMPATI_OPTIONS.map(({ value, label }) => (
                <button
                  key={value}
                  type="button"
                  disabled={isLocked}
                  onClick={() => {
                    const airwayExam = { ...(data.airwayExam ?? {}), mallampati: value };
                    setData(d => (d ? { ...d, airwayExam } : d));
                    persist({ airwayExam });
                  }}
                  className={`min-w-[2.5rem] rounded-lg border px-3 py-1.5 text-xs font-medium ${
                    data.airwayExam?.mallampati === value
                      ? 'border-violet-600 bg-violet-600 text-white'
                      : 'border-gray-300 text-gray-600'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {AIRWAY_TEXT_FIELDS.map(({ key, label }) => (
              <div key={key}>
                <label className="mb-0.5 block text-[10px] text-gray-500">{label}</label>
                <input
                  type="text"
                  disabled={isLocked}
                  value={data.airwayExam?.[key] ?? ''}
                  onChange={e =>
                    setData(d =>
                      d
                        ? {
                            ...d,
                            airwayExam: { ...(d.airwayExam ?? {}), [key]: e.target.value },
                          }
                        : d,
                    )
                  }
                  onBlur={() => persist({ airwayExam: data.airwayExam ?? {} })}
                  className="w-full rounded-lg border border-gray-300 px-2 py-1.5 text-xs disabled:bg-gray-50"
                />
              </div>
            ))}
          </div>
        </div>
      </PacAccordionSection>

      <PacAccordionSection
        sectionKey="systemic"
        title="Systemic review"
        subtitle="NAD by default — document exceptions"
        status={sectionStatus(data, 'systemic')}
        open={openSection === 'systemic'}
        onToggle={() => toggleSection('systemic')}
      >
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {SYSTEMIC_FIELDS.map(({ key, label }) => (
            <div key={key}>
              <label className="mb-0.5 block text-[10px] text-gray-500">{label}</label>
              <input
                type="text"
                disabled={isLocked}
                placeholder="NAD"
                value={data.systemicReview?.[key] ?? ''}
                onChange={e =>
                  setData(d =>
                    d
                      ? {
                          ...d,
                          systemicReview: { ...(d.systemicReview ?? {}), [key]: e.target.value },
                        }
                      : d,
                  )
                }
                onBlur={e => persistSystemicField(key, e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-2 py-1.5 text-xs disabled:bg-gray-50"
              />
            </div>
          ))}
        </div>
        <p className="mt-2 text-[10px] text-gray-500">
          Empty fields save as NAD on blur. Expand only when a system needs documentation.
        </p>
      </PacAccordionSection>

      <PacAccordionSection
        sectionKey="plan"
        title="Plan & consent"
        subtitle="Anaesthesia plan, consent type, medications, advisories"
        status={sectionStatus(data, 'plan')}
        open={openSection === 'plan'}
        onToggle={() => toggleSection('plan')}
      >
        <div className="space-y-4">
          <div>
            <label className="mb-1 block text-xs text-gray-600">Anaesthesia plan *</label>
            <div className="flex flex-wrap gap-2">
              {ANAESTHESIA_PLANS.map(plan => (
                <button
                  key={plan}
                  type="button"
                  disabled={isLocked}
                  onClick={() => {
                    setData(d => (d ? { ...d, anaesthesiaPlan: plan } : d));
                    persist({ anaesthesiaPlan: plan });
                  }}
                  className={`rounded-lg border px-3 py-1.5 text-xs ${
                    data.anaesthesiaPlan === plan
                      ? 'border-violet-600 bg-violet-600 text-white'
                      : 'border-gray-300 text-gray-600'
                  }`}
                >
                  {plan}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="mb-1 block text-xs text-gray-600">Consent type *</label>
            <div className="flex flex-wrap gap-2">
              {CONSENT_TYPES.map(ct => (
                <button
                  key={ct}
                  type="button"
                  disabled={isLocked}
                  onClick={() => {
                    setData(d => (d ? { ...d, consentType: ct } : d));
                    persist({ consentType: ct });
                  }}
                  className={`rounded-lg border px-3 py-1.5 text-xs ${
                    data.consentType === ct
                      ? 'border-violet-600 bg-violet-600 text-white'
                      : 'border-gray-300 text-gray-600'
                  }`}
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
                setData(d => (d ? { ...d, periOpExplained: e.target.checked } : d));
                persist({ periOpExplained: e.target.checked });
              }}
              className="rounded border-gray-300"
            />
            Peri-operative instructions explained to patient
          </label>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-xs font-bold uppercase tracking-wide text-gray-500">Current medications</p>
              {!isLocked && (
                <button
                  type="button"
                  onClick={() => {
                    const meds: PacMedicationLineDto[] = [
                      ...(data.currentMedications ?? []),
                      { name: '', dose: '', frequency: '' },
                    ];
                    setData(d => (d ? { ...d, currentMedications: meds } : d));
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
                  <div key={idx} className="flex items-start gap-2">
                    <input
                      placeholder="Drug"
                      disabled={isLocked}
                      value={med.name}
                      onChange={e => {
                        const meds = [...(data.currentMedications ?? [])];
                        meds[idx] = { ...meds[idx], name: e.target.value };
                        setData(d => (d ? { ...d, currentMedications: meds } : d));
                      }}
                      onBlur={() => persist({ currentMedications: data.currentMedications ?? [] })}
                      className="flex-1 rounded-lg border border-gray-300 px-2 py-1.5 text-xs disabled:bg-gray-50"
                    />
                    <input
                      placeholder="Dose"
                      disabled={isLocked}
                      value={med.dose ?? ''}
                      onChange={e => {
                        const meds = [...(data.currentMedications ?? [])];
                        meds[idx] = { ...meds[idx], dose: e.target.value };
                        setData(d => (d ? { ...d, currentMedications: meds } : d));
                      }}
                      onBlur={() => persist({ currentMedications: data.currentMedications ?? [] })}
                      className="w-24 rounded-lg border border-gray-300 px-2 py-1.5 text-xs disabled:bg-gray-50"
                    />
                    <input
                      placeholder="Freq"
                      disabled={isLocked}
                      value={med.frequency ?? ''}
                      onChange={e => {
                        const meds = [...(data.currentMedications ?? [])];
                        meds[idx] = { ...meds[idx], frequency: e.target.value };
                        setData(d => (d ? { ...d, currentMedications: meds } : d));
                      }}
                      onBlur={() => persist({ currentMedications: data.currentMedications ?? [] })}
                      className="w-24 rounded-lg border border-gray-300 px-2 py-1.5 text-xs disabled:bg-gray-50"
                    />
                    {!isLocked && (
                      <button
                        type="button"
                        onClick={() => {
                          const meds = (data.currentMedications ?? []).filter((_, i) => i !== idx);
                          setData(d => (d ? { ...d, currentMedications: meds } : d));
                          persist({ currentMedications: meds });
                        }}
                        className="rounded p-1.5 text-red-500 hover:bg-red-50"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 gap-3">
            {(
              [
                { key: 'preOpConsultations' as const, label: 'Pre-op consultations' },
                { key: 'medicationsAdvised' as const, label: 'Medications advised' },
                { key: 'investigationsAdvised' as const, label: 'Investigations advised (orders only)' },
              ] as const
            ).map(({ key, label }) => (
              <div key={key}>
                <label className="mb-1 block text-xs text-gray-600">{label}</label>
                <textarea
                  rows={2}
                  disabled={isLocked}
                  value={data[key] ?? ''}
                  onChange={e => setData(d => (d ? { ...d, [key]: e.target.value } : d))}
                  onBlur={e => {
                    const v = e.target.value || null;
                    if (key === 'preOpConsultations') persist({ preOpConsultations: v });
                    else if (key === 'medicationsAdvised') persist({ medicationsAdvised: v });
                    else persist({ investigationsAdvised: v });
                  }}
                  className="w-full resize-none rounded-lg border border-gray-300 px-3 py-2 text-xs disabled:bg-gray-50"
                />
              </div>
            ))}
            <div>
              <label className="mb-1 block text-xs text-gray-600">Completed by (designation)</label>
              <input
                type="text"
                disabled={isLocked}
                placeholder="Anaesthetist / Junior Doctor"
                value={data.completedByDesignation ?? ''}
                onChange={e => setData(d => (d ? { ...d, completedByDesignation: e.target.value } : d))}
                onBlur={e => persist({ completedByDesignation: e.target.value || null })}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-xs disabled:bg-gray-50"
              />
            </div>
          </div>
        </div>
      </PacAccordionSection>

      <PacAccordionSection
        sectionKey="reference"
        title="Reference"
        subtitle="Investigations and vitals (read-only sources)"
        status={sectionStatus(data, 'reference')}
        open={openSection === 'reference'}
        onToggle={() => toggleSection('reference')}
      >
        <div className="space-y-4">
          <PacInvestigationSummary
            journeyId={journeyId}
            onEditInInvestigations={onNavigateInvestigations}
            defaultCollapsed
          />

          <div
            data-testid={WARD_PREOP_TEST_IDS.pacVitalsReference}
            className="space-y-2 rounded-xl border border-gray-200 bg-gray-50/70 px-3 py-2.5"
          >
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-1.5">
                <HeartPulse className="h-3.5 w-3.5 text-violet-600" />
                <span className="text-[11px] font-bold uppercase tracking-wide text-gray-500">
                  Latest vitals (Step ⑧ — read-only)
                </span>
              </div>
              {onNavigateVitals && (
                <button
                  type="button"
                  data-testid={WARD_PREOP_TEST_IDS.pacVitalsOpenLink}
                  onClick={onNavigateVitals}
                  className="inline-flex items-center gap-0.5 rounded-md px-1.5 py-0.5 text-[11px] font-medium text-violet-700 hover:bg-violet-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-500"
                >
                  Record vitals
                  <ArrowUpRight className="h-3 w-3" aria-hidden="true" />
                </button>
              )}
            </div>
            {vitals.length === 0 ? (
              <p className="text-xs text-gray-500">No vitals recorded yet for this admission.</p>
            ) : (
              <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-700">
                <span>
                  BP <strong>{formatBpFromVital(vitals[0]) ?? '—'}</strong>
                </span>
                <span>
                  HR <strong>{vitals[0].pulseRate ?? '—'}</strong>
                </span>
                <span>
                  SpO₂{' '}
                  <strong>
                    {vitals[0].oxygenSaturation ?? '—'}
                    {vitals[0].oxygenSaturation != null ? '%' : ''}
                  </strong>
                </span>
                <span>
                  Temp <strong>{vitals[0].temperature ?? '—'}</strong>
                </span>
                <span className="text-gray-400">
                  {new Date(vitals[0].recordedAt).toLocaleString('en-IN')}
                </span>
              </div>
            )}
            <p className="text-[10px] text-gray-500">
              Vitals are recorded in Step ⑧ Nursing &amp; Records. PAC keeps a snapshot in Pre-op assessment.
            </p>
          </div>
        </div>
      </PacAccordionSection>

      <PacAccordionSection
        sectionKey="complete"
        title="Complete PAC"
        subtitle="Sign-off and ward checklist sync"
        status={sectionStatus(data, 'complete')}
        open={openSection === 'complete'}
        onToggle={() => toggleSection('complete')}
      >
        {!isLocked ? (
          <div className="flex flex-col items-start gap-3">
            <p
              data-testid={WARD_PREOP_TEST_IDS.pacAutoSatisfyNote}
              className="flex items-center gap-1 text-[11px] text-gray-500"
            >
              <Activity className="h-3 w-3 text-gray-400" aria-hidden="true" />
              Completing PAC auto-confirms §2 Anaesthesia clearance and the §3 &ldquo;PAC done&rdquo; safety
              tick.
            </p>
            <button
              type="button"
              disabled={completing || !data.isComplete}
              onClick={handleCompleteClick}
              className="rounded-lg bg-violet-600 px-4 py-2 text-sm font-medium text-white hover:bg-violet-700 disabled:opacity-50"
            >
              {completing ? 'Completing…' : 'Complete PAC assessment'}
            </button>
            {!data.isComplete && (
              <p className="text-xs text-gray-500">
                Complete BP, HR, ASA, Mallampati, anaesthesia plan, and consent type in the sections above.
              </p>
            )}
          </div>
        ) : (
          <p className="text-xs text-gray-500">PAC assessment is locked after completion.</p>
        )}
        {data.completedAt && (
          <p className="mt-2 text-xs text-gray-400">
            Completed {new Date(data.completedAt).toLocaleString('en-IN')}
          </p>
        )}
      </PacAccordionSection>

      {completeDialog && (
        <div
          className="fixed inset-0 z-[70] flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm"
          data-testid={WARD_PREOP_TEST_IDS.pacCompleteWarnDialog}
        >
          <div className="w-full max-w-md rounded-2xl bg-white shadow-xl">
            <div className="flex items-start gap-3 border-b border-gray-100 px-6 py-4">
              <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
              <div>
                <h2 className="text-base font-semibold text-gray-900">Unverified critical labs</h2>
                <p className="mt-1 text-sm text-gray-600">
                  The following critical investigations are not ward-verified in §1. You may still complete PAC.
                </p>
              </div>
            </div>
            <ul className="list-inside list-disc space-y-1 px-6 py-3 text-sm text-gray-800">
              {completeDialog.keys.map(key => (
                <li key={key}>{key.replace(/_/g, ' ')}</li>
              ))}
            </ul>
            <div className="flex justify-end gap-2 border-t border-gray-100 px-6 py-4">
              <button
                type="button"
                onClick={() => setCompleteDialog(null)}
                className="rounded-lg border border-gray-300 px-4 py-2 text-sm text-gray-600 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={completing}
                onClick={doComplete}
                data-testid={WARD_PREOP_TEST_IDS.pacCompleteConfirm}
                className="rounded-lg bg-amber-600 px-4 py-2 text-sm font-medium text-white hover:bg-amber-700 disabled:opacity-50"
              >
                {completing ? 'Completing…' : 'Complete PAC anyway'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
