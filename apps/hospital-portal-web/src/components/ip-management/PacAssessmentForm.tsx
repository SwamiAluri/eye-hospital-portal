'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Loader2,
  Plus,
  Stethoscope,
  Trash2,
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import { PacInvestigationSummary } from '@/components/ip-management/PacInvestigationSummary';
import { PacAnaesthesiaClearanceSection } from '@/components/ip-management/preop/PacAnaesthesiaClearanceSection';
import { PacClinicalSection } from '@/components/ip-management/preop/primitives/PacClinicalSection';
import {
  PacClinicalTable,
  PacFieldInput,
  PacFieldTextarea,
  PacIconLink,
  PacSegmentedControl,
  PacTableRow,
} from '@/components/ip-management/preop/primitives/PacClinicalTable';
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
  anaesthetistName?: string | null;
  readOnly?: boolean;
  onStatusChange?: (completed: boolean) => void;
  onNavigateInvestigations?: () => void;
  onNavigateVitals?: () => void;
  onNavigateEvaluation?: () => void;
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

function applyVitalsPrefill(pac: PacAssessmentDto, vitals: VitalSignDto[]): PacAssessmentDto {
  if (vitals.length === 0 || (pac.bp && pac.hr != null)) return pac;
  const latest = vitals[0];
  const bp = !pac.bp ? formatBpFromVital(latest) : null;
  const hr = pac.hr == null ? latest.pulseRate : null;
  if (!bp && hr == null) return pac;
  return { ...pac, bp: pac.bp ?? bp, hr: pac.hr ?? hr };
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

function sectionStatus(data: PacAssessmentDto, key: string): PreOpStatus {
  switch (key) {
    case 'assessment':
      return assessmentComplete(data)
        ? 'completed'
        : data.bp || data.hr != null || data.physicalStatusAsa
          ? 'in-progress'
          : 'not-started';
    case 'airway':
      return airwayComplete(data)
        ? 'completed'
        : Object.values(data.airwayExam ?? {}).some(v => v != null && v !== '')
          ? 'in-progress'
          : 'not-started';
    case 'systemic':
      return systemicComplete(data.systemicReview) ? 'completed' : 'not-started';
    case 'plan':
      return planComplete(data)
        ? 'completed'
        : data.anaesthesiaPlan || data.consentType
          ? 'in-progress'
          : 'not-started';
    case 'reference':
      return 'verified';
    case 'complete':
      return data.assessmentStatus === 'Completed'
        ? 'completed'
        : data.isComplete
          ? 'pending-verification'
          : 'not-started';
    default:
      return 'not-started';
  }
}

export function PacAssessmentForm({
  journeyId,
  anaesthetistName,
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
  const [saveError, setSaveError] = useState<string | null>(null);
  const [completing, setCompleting] = useState(false);
  const [completeDialog, setCompleteDialog] = useState<{ keys: string[] } | null>(null);
  const sharedClearance = usePreOpClearanceOptional();

  const load = useCallback(async () => {
    setLoading(true);
    const [result, vitalsList] = await Promise.all([
      ipManagementApi.getPacAssessment(journeyId),
      ipManagementApi.getVitals(journeyId).catch(() => [] as VitalSignDto[]),
    ]);
    setVitals(vitalsList);
    if (result) {
      const withPrefill = applyVitalsPrefill(result, vitalsList);
      setData(withPrefill);
      onStatusChange?.(withPrefill.assessmentStatus === 'Completed');
    } else {
      setData(null);
    }
    setLoading(false);
  }, [journeyId, onStatusChange]);

  useEffect(() => {
    void load();
  }, [load]);

  const isLocked = readOnly || data?.assessmentStatus === 'Completed';

  async function persist(patch: SavePacAssessmentRequest) {
    if (isLocked || !data) return;
    setSaving(true);
    setSaveError(null);
    const { data: updated, error } = await ipManagementApi.savePacAssessment(journeyId, patch);
    if (updated) {
      setData(updated);
      onStatusChange?.(updated.assessmentStatus === 'Completed');
      onChanged?.();
    } else {
      const message = error ?? 'Failed to save PAC assessment';
      setSaveError(message);
      toast.error(message);
    }
    setSaving(false);
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
    const { data: result, error } = await ipManagementApi.completePacAssessment(journeyId);
    if (result) {
      setData(result.assessment);
      onStatusChange?.(true);
      onChanged?.();
      if (result.unverifiedCriticalWarnings.length > 0) {
        toast(
          `PAC completed. ${result.unverifiedCriticalWarnings.length} critical investigation(s) remain unverified.`,
          { icon: '⚠️' },
        );
      } else {
        toast.success('PAC assessment completed');
      }
    } else {
      toast.error(error ?? 'Could not complete PAC assessment');
    }
    setCompleting(false);
    setCompleteDialog(null);
  }

  async function handleCompleteClick() {
    if (isLocked || !data) return;
    if (!data.isComplete) {
      toast.error('Complete required fields: BP, HR, ASA, anaesthesia plan, consent type.');
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
    return data.preOpDiagnosis?.trim() || '—';
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
      <div className="flex items-center justify-between gap-3 border-b border-gray-200 pb-2">
        <div className="flex items-center gap-2">
          <Stethoscope className="h-4 w-4 text-gray-700" aria-hidden="true" />
          <h3 className="text-sm font-semibold text-gray-900">Pre-Anaesthesia Check-up</h3>
        </div>
        <div className="flex items-center gap-2">
          {saving && <span className="text-xs text-gray-500">Saving…</span>}
          {saveError && !saving && (
            <span className="max-w-[14rem] truncate text-xs text-red-600" title={saveError}>
              Save failed
            </span>
          )}
          {readOnly && data.assessmentStatus !== 'Completed' && (
            <span className="rounded border border-gray-200 px-2 py-0.5 text-xs text-gray-500">
              View only
            </span>
          )}
          {data.assessmentStatus === 'Completed' ? (
            <span className="inline-flex items-center gap-1 rounded border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-800">
              <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" /> Completed
            </span>
          ) : data.isComplete ? (
            <span className="text-xs font-medium text-amber-700">Ready to complete</span>
          ) : (
            <span className="text-xs text-gray-500">Draft</span>
          )}
        </div>
      </div>

      {(data.patientName || data.procedureName) && (
        <div className="border border-gray-200 bg-gray-50 px-4 py-2 text-xs text-gray-800">
          <span className="font-medium">{data.patientName ?? '—'}</span>
          <span className="text-gray-500"> · </span>
          <span>{data.uhid ?? '—'}</span>
          <span className="text-gray-500"> · </span>
          <span>{data.procedureName ?? '—'}</span>
          <span className="text-gray-500"> · </span>
          <span>{data.eyeOperated ?? '—'}</span>
        </div>
      )}

      <PacClinicalSection
        sectionKey="assessment"
        title="Assessment"
        status={sectionStatus(data, 'assessment')}
      >
        <PacClinicalTable>
          <PacTableRow label="Assessed at">
            <PacFieldInput
              type="datetime-local"
              disabled={isLocked}
              value={toLocalInput(data.assessedAt)}
              onChange={e =>
                setData(d =>
                  d
                    ? {
                        ...d,
                        assessedAt: e.target.value
                          ? new Date(e.target.value).toISOString()
                          : null,
                      }
                    : d,
                )
              }
              onBlur={e =>
                void persist({
                  assessedAt: e.target.value ? new Date(e.target.value).toISOString() : null,
                })
              }
            />
          </PacTableRow>
          <PacTableRow label="BP" required>
            <PacFieldInput
              type="text"
              disabled={isLocked}
              testId={WARD_PREOP_TEST_IDS.pacFieldBp}
              value={data.bp ?? ''}
              onChange={e => setData(d => (d ? { ...d, bp: e.target.value } : d))}
              onBlur={e => void persist({ bp: e.target.value || null })}
            />
          </PacTableRow>
          <PacTableRow label="HR (bpm)" required>
            <PacFieldInput
              type="number"
              disabled={isLocked}
              testId={WARD_PREOP_TEST_IDS.pacFieldHr}
              value={data.hr ?? ''}
              onChange={e =>
                setData(d =>
                  d ? { ...d, hr: e.target.value ? Number(e.target.value) : null } : d,
                )
              }
              onBlur={e => void persist({ hr: e.target.value ? Number(e.target.value) : null })}
            />
          </PacTableRow>
          <PacTableRow label="ASA grade" required>
            <PacSegmentedControl
              options={ASA_OPTIONS}
              value={data.physicalStatusAsa}
              disabled={isLocked}
              onChange={n => {
                setData(d => (d ? { ...d, physicalStatusAsa: n } : d));
                void persist({ physicalStatusAsa: n });
              }}
            />
          </PacTableRow>
          <PacTableRow
            label="Pre-op diagnosis"
            action={
              onNavigateEvaluation ? (
                <PacIconLink
                  label="Open Clinical Evaluation"
                  testId={WARD_PREOP_TEST_IDS.pacEvaluationLink}
                  onClick={onNavigateEvaluation}
                />
              ) : undefined
            }
          >
            <span className="text-sm text-gray-800">{displayDiagnosis}</span>
          </PacTableRow>
          <PacTableRow label="Allergies">
            <PacFieldTextarea
              rows={2}
              disabled={isLocked}
              value={data.allergies ?? ''}
              onChange={e => setData(d => (d ? { ...d, allergies: e.target.value } : d))}
              onBlur={e => void persist({ allergies: e.target.value || null })}
            />
          </PacTableRow>
          <PacTableRow label="Past anaesthetic history">
            <PacFieldTextarea
              rows={2}
              disabled={isLocked}
              value={data.pastAnaestheticHistory ?? ''}
              onChange={e =>
                setData(d => (d ? { ...d, pastAnaestheticHistory: e.target.value } : d))
              }
              onBlur={e => void persist({ pastAnaestheticHistory: e.target.value || null })}
            />
          </PacTableRow>
        </PacClinicalTable>
      </PacClinicalSection>

      <PacClinicalSection
        sectionKey="airway"
        title="Airway examination"
        status={sectionStatus(data, 'airway')}
      >
        <PacClinicalTable>
          <PacTableRow label="Mallampati" required>
            <PacSegmentedControl
              options={MALLAMPATI_OPTIONS.map(o => o.value)}
              value={data.airwayExam?.mallampati}
              disabled={isLocked}
              formatLabel={v => MALLAMPATI_OPTIONS.find(o => o.value === v)?.label ?? String(v)}
              onChange={value => {
                const airwayExam = { ...(data.airwayExam ?? {}), mallampati: value };
                setData(d => (d ? { ...d, airwayExam } : d));
                void persist({ airwayExam });
              }}
            />
          </PacTableRow>
          {AIRWAY_TEXT_FIELDS.map(({ key, label }) => (
            <PacTableRow key={key} label={label}>
              <PacFieldInput
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
                onBlur={() => void persist({ airwayExam: data.airwayExam ?? {} })}
              />
            </PacTableRow>
          ))}
        </PacClinicalTable>
      </PacClinicalSection>

      <PacClinicalSection
        sectionKey="systemic"
        title="Systemic review"
        status={sectionStatus(data, 'systemic')}
      >
        <PacClinicalTable>
          {SYSTEMIC_FIELDS.map(({ key, label }) => (
            <PacTableRow key={key} label={label}>
              <PacFieldInput
                type="text"
                disabled={isLocked}
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
              />
            </PacTableRow>
          ))}
        </PacClinicalTable>
      </PacClinicalSection>

      <PacClinicalSection
        sectionKey="plan"
        title="Plan & consent"
        status={sectionStatus(data, 'plan')}
      >
        <PacClinicalTable>
          <PacTableRow label="Anaesthesia plan" required>
            <PacSegmentedControl
              options={ANAESTHESIA_PLANS}
              value={data.anaesthesiaPlan}
              disabled={isLocked}
              onChange={plan => {
                setData(d => (d ? { ...d, anaesthesiaPlan: plan } : d));
                void persist({ anaesthesiaPlan: plan });
              }}
            />
          </PacTableRow>
          <PacTableRow label="Consent type" required>
            <PacSegmentedControl
              options={CONSENT_TYPES}
              value={data.consentType}
              disabled={isLocked}
              onChange={ct => {
                setData(d => (d ? { ...d, consentType: ct } : d));
                void persist({ consentType: ct });
              }}
            />
          </PacTableRow>
          <PacTableRow label="Peri-operative instructions">
            <label className="inline-flex items-center gap-2 text-sm text-gray-800">
              <input
                type="checkbox"
                disabled={isLocked}
                checked={data.periOpExplained}
                onChange={e => {
                  setData(d => (d ? { ...d, periOpExplained: e.target.checked } : d));
                  void persist({ periOpExplained: e.target.checked });
                }}
                className="rounded border-gray-300"
              />
              Explained to patient
            </label>
          </PacTableRow>
          <PacTableRow
            label="Current medications"
            action={
              !isLocked ? (
                <button
                  type="button"
                  data-testid={WARD_PREOP_TEST_IDS.pacMedicationAdd}
                  onClick={() => {
                    const meds: PacMedicationLineDto[] = [
                      ...(data.currentMedications ?? []),
                      { name: '', dose: '', frequency: '' },
                    ];
                    setData(d => (d ? { ...d, currentMedications: meds } : d));
                    void persist({ currentMedications: meds });
                  }}
                  className="inline-flex items-center gap-1 rounded border border-gray-300 bg-white px-2 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50"
                >
                  <Plus className="h-3 w-3" aria-hidden="true" /> Add
                </button>
              ) : undefined
            }
          >
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-gray-200 text-left text-gray-500">
                  <th className="pb-1 pr-2 font-medium">Drug</th>
                  <th className="pb-1 pr-2 font-medium">Dose</th>
                  <th className="pb-1 pr-2 font-medium">Frequency</th>
                  <th className="pb-1 w-8" />
                </tr>
              </thead>
              <tbody>
                {(data.currentMedications ?? []).map((med, idx) => (
                  <tr key={idx}>
                    <td className="py-1 pr-2">
                      <PacFieldInput
                        disabled={isLocked}
                        value={med.name}
                        onChange={e => {
                          const meds = [...(data.currentMedications ?? [])];
                          meds[idx] = { ...meds[idx], name: e.target.value };
                          setData(d => (d ? { ...d, currentMedications: meds } : d));
                        }}
                        onBlur={() => void persist({ currentMedications: data.currentMedications ?? [] })}
                      />
                    </td>
                    <td className="py-1 pr-2">
                      <PacFieldInput
                        disabled={isLocked}
                        value={med.dose ?? ''}
                        onChange={e => {
                          const meds = [...(data.currentMedications ?? [])];
                          meds[idx] = { ...meds[idx], dose: e.target.value };
                          setData(d => (d ? { ...d, currentMedications: meds } : d));
                        }}
                        onBlur={() => void persist({ currentMedications: data.currentMedications ?? [] })}
                      />
                    </td>
                    <td className="py-1 pr-2">
                      <PacFieldInput
                        disabled={isLocked}
                        value={med.frequency ?? ''}
                        onChange={e => {
                          const meds = [...(data.currentMedications ?? [])];
                          meds[idx] = { ...meds[idx], frequency: e.target.value };
                          setData(d => (d ? { ...d, currentMedications: meds } : d));
                        }}
                        onBlur={() => void persist({ currentMedications: data.currentMedications ?? [] })}
                      />
                    </td>
                    <td className="py-1">
                      {!isLocked && (
                        <button
                          type="button"
                          onClick={() => {
                            const meds = (data.currentMedications ?? []).filter((_, i) => i !== idx);
                            setData(d => (d ? { ...d, currentMedications: meds } : d));
                            void persist({ currentMedications: meds });
                          }}
                          className="rounded p-1 text-red-600 hover:bg-red-50"
                          aria-label="Remove medication"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </PacTableRow>
          {(
            [
              { key: 'preOpConsultations' as const, label: 'Pre-op consultations' },
              { key: 'medicationsAdvised' as const, label: 'Medications advised' },
              { key: 'investigationsAdvised' as const, label: 'Investigations advised' },
            ] as const
          ).map(({ key, label }) => (
            <PacTableRow key={key} label={label}>
              <PacFieldTextarea
                rows={2}
                disabled={isLocked}
                value={data[key] ?? ''}
                onChange={e => setData(d => (d ? { ...d, [key]: e.target.value } : d))}
                onBlur={e => {
                  const v = e.target.value || null;
                  if (key === 'preOpConsultations') void persist({ preOpConsultations: v });
                  else if (key === 'medicationsAdvised') void persist({ medicationsAdvised: v });
                  else void persist({ investigationsAdvised: v });
                }}
              />
            </PacTableRow>
          ))}
          <PacTableRow label="Completed by">
            <PacFieldInput
              type="text"
              disabled={isLocked}
              value={data.completedByDesignation ?? ''}
              onChange={e =>
                setData(d => (d ? { ...d, completedByDesignation: e.target.value } : d))
              }
              onBlur={e => void persist({ completedByDesignation: e.target.value || null })}
            />
          </PacTableRow>
        </PacClinicalTable>
      </PacClinicalSection>

      <PacAnaesthesiaClearanceSection
        journeyId={journeyId}
        pac={data}
        anaesthetistName={anaesthetistName}
        completions={sharedClearance?.detail?.completions}
        disabled={isLocked}
        onChanged={onChanged}
      />

      <PacClinicalSection
        sectionKey="reference"
        title="Reference"
        status={sectionStatus(data, 'reference')}
      >
        <PacClinicalTable>
          <PacTableRow
            label="Investigations"
            action={
              onNavigateInvestigations ? (
                <PacIconLink
                  label="Open Investigations"
                  testId={WARD_PREOP_TEST_IDS.pacInvestigationEditLink}
                  onClick={onNavigateInvestigations}
                />
              ) : undefined
            }
          >
            <PacInvestigationSummary
              journeyId={journeyId}
              onEditInInvestigations={onNavigateInvestigations}
              defaultCollapsed
              compact
            />
          </PacTableRow>
          <PacTableRow
            label="Latest vitals"
            action={
              onNavigateVitals ? (
                <PacIconLink
                  label="Open Nursing & Records"
                  testId={WARD_PREOP_TEST_IDS.pacVitalsOpenLink}
                  onClick={onNavigateVitals}
                />
              ) : undefined
            }
          >
            <div data-testid={WARD_PREOP_TEST_IDS.pacVitalsReference}>
              {vitals.length === 0 ? (
                <span className="text-sm text-gray-500">—</span>
              ) : (
                <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-gray-800">
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
                  <span className="text-gray-500">
                    {new Date(vitals[0].recordedAt).toLocaleString('en-IN')}
                  </span>
                </div>
              )}
            </div>
          </PacTableRow>
        </PacClinicalTable>
      </PacClinicalSection>

      <PacClinicalSection
        sectionKey="complete"
        title="Complete PAC"
        status={sectionStatus(data, 'complete')}
      >
        <div className="px-4 py-3">
          {!isLocked ? (
            <button
              type="button"
              data-testid={WARD_PREOP_TEST_IDS.pacCompleteButton}
              disabled={completing || !data.isComplete}
              onClick={handleCompleteClick}
              className="rounded border border-gray-800 bg-gray-800 px-4 py-2 text-sm font-medium text-white hover:bg-gray-900 disabled:opacity-50"
            >
              {completing ? 'Completing…' : 'Complete PAC assessment'}
            </button>
          ) : (
            <p className="text-sm text-gray-600">
              {data.completedAt
                ? `Completed ${new Date(data.completedAt).toLocaleString('en-IN')}`
                : 'PAC assessment is locked.'}
            </p>
          )}
        </div>
      </PacClinicalSection>

      {completeDialog && (
        <div
          className="fixed inset-0 z-[70] flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm"
          data-testid={WARD_PREOP_TEST_IDS.pacCompleteWarnDialog}
        >
          <div className="w-full max-w-md rounded-lg border border-gray-200 bg-white shadow-xl">
            <div className="flex items-start gap-3 border-b border-gray-100 px-6 py-4">
              <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" aria-hidden="true" />
              <div>
                <h2 className="text-base font-semibold text-gray-900">Unverified critical labs</h2>
                <p className="mt-1 text-sm text-gray-600">
                  Critical investigations are not ward-verified. You may still complete PAC.
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
                className="rounded border border-gray-300 px-4 py-2 text-sm text-gray-600 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={completing}
                onClick={doComplete}
                data-testid={WARD_PREOP_TEST_IDS.pacCompleteConfirm}
                className="rounded border border-amber-700 bg-amber-700 px-4 py-2 text-sm font-medium text-white hover:bg-amber-800 disabled:opacity-50"
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
