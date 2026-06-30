'use client';

import { useEffect, useState } from 'react';
import { Loader2, PenLine } from 'lucide-react';
import { toast } from 'react-hot-toast';
import {
  ipManagementApi,
  type PreOpCompletionDto,
} from '@/lib/api/ip-management.api';
import { usePreOpClearanceData } from '@/hooks/use-preop-clearance-data';
import {
  canSignOffEvaluation,
  completionByKey,
  isEvaluationSignedOff,
  readClinicalEvaluationFields,
  RISK_CLASS_OPTIONS,
  type ClinicalEvaluationFields,
  type RiskClass,
} from '@/lib/ip-management/clinical-evaluation';
import { WARD_PREOP_TEST_IDS } from '@/lib/ip-management/ward-preop-test-ids';

export interface ClinicalEvaluationFormProps {
  journeyId: string;
  paymentMode?: string;
  procedureName?: string;
  eyeOperated?: string;
  readOnly?: boolean;
  onChanged?: () => void;
}

export function ClinicalEvaluationForm({
  journeyId,
  paymentMode,
  procedureName,
  eyeOperated,
  readOnly = false,
  onChanged,
}: ClinicalEvaluationFormProps) {
  const { detail, loading, reloadClearance } = usePreOpClearanceData({
    journeyId,
    paymentMode,
    onChanged,
  });
  const [fields, setFields] = useState<ClinicalEvaluationFields>({
    diagnosis: '',
    comorbidities: '',
    risk: '',
    iolPlan: '',
    counsellingNotes: '',
    surgicalPlanConfirmed: false,
    patientCounselled: false,
  });
  const [saving, setSaving] = useState<string | null>(null);
  const [signingOff, setSigningOff] = useState(false);

  const completions = detail?.completions ?? [];
  const isLocked = readOnly || isEvaluationSignedOff(completions);

  useEffect(() => {
    if (!detail) return;
    setFields(readClinicalEvaluationFields(detail.completions ?? []));
  }, [detail]);

  async function persistCompletion(
    completion: PreOpCompletionDto,
    patch: {
      isCompleted?: boolean;
      notes?: string | null;
      resultValue?: string | null;
      resultUnit?: string | null;
    },
    savingKey: string,
  ) {
    if (isLocked) return;
    setSaving(savingKey);
    try {
      const res = await ipManagementApi.savePreOpCompletion(journeyId, completion.itemId, {
        itemId: completion.itemId,
        isCompleted: patch.isCompleted ?? completion.isCompleted,
        isBypassed: false,
        notes: patch.notes === undefined ? completion.notes ?? undefined : patch.notes ?? undefined,
        resultValue:
          patch.resultValue === undefined ? completion.resultValue ?? undefined : patch.resultValue ?? undefined,
        resultUnit:
          patch.resultUnit === undefined ? completion.resultUnit ?? undefined : patch.resultUnit ?? undefined,
      });
      if (!res) {
        toast.error('Could not save clinical evaluation.');
        return;
      }
      await reloadClearance();
    } finally {
      setSaving(null);
    }
  }

  async function mirrorDiagnosisToPac(diagnosis: string) {
    const trimmed = diagnosis.trim();
    if (!trimmed) return;
    await ipManagementApi.savePacAssessment(journeyId, { preOpDiagnosis: trimmed });
  }

  async function saveDiagnosis(value: string) {
    const completion = completionByKey(completions, 'surgical_plan_confirmed');
    if (!completion) return;
    const trimmed = value.trim();
    await persistCompletion(
      completion,
      {
        resultValue: trimmed || null,
        isCompleted: fields.surgicalPlanConfirmed && !!trimmed,
        notes: fields.iolPlan.trim() || completion.notes,
      },
      'diagnosis',
    );
    if (trimmed) await mirrorDiagnosisToPac(trimmed);
  }

  async function saveComorbidities(value: string) {
    const completion = completionByKey(completions, 'comorbidities_reviewed');
    if (!completion) return;
    const trimmed = value.trim() || 'NAD';
    await persistCompletion(
      completion,
      { notes: trimmed, isCompleted: !!trimmed },
      'comorbidities',
    );
  }

  async function saveRisk(risk: RiskClass) {
    const completion = completionByKey(completions, 'risk_classification');
    if (!completion) return;
    await persistCompletion(
      completion,
      { resultValue: risk, isCompleted: true },
      'risk',
    );
  }

  async function saveIolPlan(value: string) {
    const completion = completionByKey(completions, 'surgical_plan_confirmed');
    if (!completion) return;
    await persistCompletion(
      completion,
      {
        notes: value.trim() || null,
        resultValue: fields.diagnosis.trim() || completion.resultValue,
        isCompleted: fields.surgicalPlanConfirmed && !!fields.diagnosis.trim(),
      },
      'iolPlan',
    );
  }

  async function toggleSurgicalPlanConfirmed(checked: boolean) {
    const completion = completionByKey(completions, 'surgical_plan_confirmed');
    if (!completion) return;
    setFields(f => ({ ...f, surgicalPlanConfirmed: checked }));
    await persistCompletion(
      completion,
      {
        isCompleted: checked && !!fields.diagnosis.trim(),
        resultValue: fields.diagnosis.trim() || completion.resultValue,
        notes: fields.iolPlan.trim() || completion.notes,
      },
      'surgicalPlan',
    );
  }

  async function saveCounsellingNotes(value: string) {
    const completion = completionByKey(completions, 'patient_counselled');
    if (!completion) return;
    await persistCompletion(
      completion,
      {
        notes: value.trim() || null,
        isCompleted: fields.patientCounselled && !!value.trim(),
      },
      'counselling',
    );
  }

  async function togglePatientCounselled(checked: boolean) {
    const completion = completionByKey(completions, 'patient_counselled');
    if (!completion) return;
    setFields(f => ({ ...f, patientCounselled: checked }));
    await persistCompletion(
      completion,
      {
        isCompleted: checked,
        notes: fields.counsellingNotes.trim() || completion.notes,
      },
      'patientCounselled',
    );
  }

  async function handleSignOff() {
    if (isLocked || !canSignOffEvaluation(fields)) return;
    setSigningOff(true);
    try {
      const completed = completionByKey(completions, 'doctor_evaluation_completed');
      const signed = completionByKey(completions, 'doctor_evaluation_signed');
      if (!completed || !signed) {
        toast.error('Sign-off items are not configured for this journey.');
        return;
      }

      for (const completion of [completed, signed]) {
        const res = await ipManagementApi.savePreOpCompletion(journeyId, completion.itemId, {
          itemId: completion.itemId,
          isCompleted: true,
          isBypassed: false,
          notes: completion.notes ?? undefined,
          resultValue: completion.resultValue ?? undefined,
        });
        if (!res) {
          toast.error('Could not complete doctor sign-off.');
          return;
        }
      }

      await mirrorDiagnosisToPac(fields.diagnosis);
      await reloadClearance();
      toast.success('Clinical evaluation signed off');
    } finally {
      setSigningOff(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center gap-2 py-4 text-sm text-gray-500">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading evaluation form…
      </div>
    );
  }

  const signoffReady = canSignOffEvaluation(fields);

  return (
    <div
      data-testid={WARD_PREOP_TEST_IDS.clinicalEvalForm}
      className="space-y-4 rounded-xl border border-gray-200 bg-white p-4"
    >
      <div>
        <p className="text-xs font-bold uppercase tracking-wide text-gray-500">Clinical assessment</p>
        <div className="mt-2 space-y-3">
          <div>
            <label className="mb-1 block text-xs text-gray-600" htmlFor="clinical-eval-diagnosis">
              Pre-op diagnosis *
            </label>
            <textarea
              id="clinical-eval-diagnosis"
              data-testid={WARD_PREOP_TEST_IDS.clinicalEvalDiagnosis}
              rows={2}
              disabled={isLocked}
              value={fields.diagnosis}
              placeholder="e.g. Immature cataract OD"
              onChange={e => setFields(f => ({ ...f, diagnosis: e.target.value }))}
              onBlur={e => void saveDiagnosis(e.target.value)}
              className="w-full resize-none rounded-lg border border-gray-300 px-3 py-2 text-xs disabled:bg-gray-50"
            />
            <p className="mt-1 text-[10px] text-gray-500">
              Single source of truth — PAC and consent reference this diagnosis (read-only there).
            </p>
          </div>

          <div>
            <label className="mb-1 block text-xs text-gray-600" htmlFor="clinical-eval-comorbidities">
              Comorbidities reviewed *
            </label>
            <textarea
              id="clinical-eval-comorbidities"
              data-testid={WARD_PREOP_TEST_IDS.clinicalEvalComorbidities}
              rows={2}
              disabled={isLocked}
              placeholder="NAD"
              value={fields.comorbidities}
              onChange={e => setFields(f => ({ ...f, comorbidities: e.target.value }))}
              onBlur={e => void saveComorbidities(e.target.value)}
              className="w-full resize-none rounded-lg border border-gray-300 px-3 py-2 text-xs disabled:bg-gray-50"
            />
          </div>

          <div>
            <label className="mb-1 block text-xs text-gray-600">Risk classification *</label>
            <div className="flex flex-wrap gap-2">
              {RISK_CLASS_OPTIONS.map(risk => (
                <button
                  key={risk}
                  type="button"
                  data-testid={WARD_PREOP_TEST_IDS.clinicalEvalRisk(risk)}
                  disabled={isLocked || saving === 'risk'}
                  onClick={() => {
                    setFields(f => ({ ...f, risk }));
                    void saveRisk(risk);
                  }}
                  className={`rounded-lg border px-3 py-1.5 text-xs ${
                    fields.risk === risk
                      ? 'border-indigo-600 bg-indigo-600 text-white'
                      : 'border-gray-300 text-gray-600'
                  }`}
                >
                  {risk}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div>
        <p className="text-xs font-bold uppercase tracking-wide text-gray-500">Surgical plan</p>
        <div className="mt-2 space-y-3">
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <div className="rounded-lg border border-gray-100 bg-gray-50 px-3 py-2 text-xs text-gray-700">
              <span className="text-gray-500">Procedure · </span>
              <strong>{procedureName?.trim() || '—'}</strong>
            </div>
            <div className="rounded-lg border border-gray-100 bg-gray-50 px-3 py-2 text-xs text-gray-700">
              <span className="text-gray-500">Operative eye · </span>
              <strong>{eyeOperated?.trim() || '—'}</strong>
            </div>
          </div>

          <div>
            <label className="mb-1 block text-xs text-gray-600" htmlFor="clinical-eval-iol">
              IOL / implant plan
            </label>
            <input
              id="clinical-eval-iol"
              data-testid={WARD_PREOP_TEST_IDS.clinicalEvalIolPlan}
              type="text"
              disabled={isLocked}
              value={fields.iolPlan}
              placeholder="e.g. Monofocal IOL power TBD in OT"
              onChange={e => setFields(f => ({ ...f, iolPlan: e.target.value }))}
              onBlur={e => void saveIolPlan(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-xs disabled:bg-gray-50"
            />
          </div>

          <label className="flex items-center gap-2 text-sm text-gray-700">
            <input
              type="checkbox"
              data-testid={WARD_PREOP_TEST_IDS.clinicalEvalSurgicalPlanConfirmed}
              disabled={isLocked || !fields.diagnosis.trim()}
              checked={fields.surgicalPlanConfirmed}
              onChange={e => void toggleSurgicalPlanConfirmed(e.target.checked)}
              className="rounded border-gray-300"
            />
            Surgical plan confirmed with patient *
          </label>
        </div>
      </div>

      <div>
        <p className="text-xs font-bold uppercase tracking-wide text-gray-500">Counselling</p>
        <div className="mt-2 space-y-3">
          <div>
            <label className="mb-1 block text-xs text-gray-600" htmlFor="clinical-eval-counselling">
              Counselling notes
            </label>
            <textarea
              id="clinical-eval-counselling"
              data-testid={WARD_PREOP_TEST_IDS.clinicalEvalCounselling}
              rows={2}
              disabled={isLocked}
              value={fields.counsellingNotes}
              placeholder="Risks, benefits, and post-op expectations discussed"
              onChange={e => setFields(f => ({ ...f, counsellingNotes: e.target.value }))}
              onBlur={e => void saveCounsellingNotes(e.target.value)}
              className="w-full resize-none rounded-lg border border-gray-300 px-3 py-2 text-xs disabled:bg-gray-50"
            />
          </div>

          <label className="flex items-center gap-2 text-sm text-gray-700">
            <input
              type="checkbox"
              data-testid={WARD_PREOP_TEST_IDS.clinicalEvalPatientCounselled}
              disabled={isLocked}
              checked={fields.patientCounselled}
              onChange={e => void togglePatientCounselled(e.target.checked)}
              className="rounded border-gray-300"
            />
            Patient counselled on procedure and risks *
          </label>
        </div>
      </div>

      {!isLocked && (
        <div className="border-t border-gray-100 pt-3">
          <button
            type="button"
            data-testid={WARD_PREOP_TEST_IDS.clinicalEvalSignoffButton}
            disabled={signingOff || !signoffReady || !!saving}
            onClick={() => void handleSignOff()}
            className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
          >
            <PenLine className="h-4 w-4" aria-hidden="true" />
            {signingOff ? 'Signing off…' : 'Sign off clinical evaluation'}
          </button>
          {!signoffReady && (
            <p className="mt-2 text-xs text-gray-500">
              Complete diagnosis, comorbidities, risk class, surgical plan confirmation, and patient counselling
              before sign-off.
            </p>
          )}
        </div>
      )}

      {saving && <p className="text-[11px] text-gray-400">Saving…</p>}
    </div>
  );
}
