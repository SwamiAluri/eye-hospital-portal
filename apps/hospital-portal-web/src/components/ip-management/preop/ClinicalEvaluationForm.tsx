'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Loader2, Pencil, PenLine } from 'lucide-react';
import { toast } from 'react-hot-toast';
import {
  ipManagementApi,
  type PreOpCompletionDto,
} from '@/lib/api/ip-management.api';
import { serviceCatalogApi, type IolMasterDto } from '@/lib/api/service-catalog.api';
import { usePreOpClearanceData } from '@/hooks/use-preop-clearance-data';
import { fetchCounsellingClinicalContext } from '@/lib/ip-management/clinical-evaluation-context';
import {
  loadChartComorbiditySuggestions,
  loadExamDiagnosisSource,
  loadJourneyIolPower,
  loadPatientDiagnosesForPrefill,
  loadSuggestedIolPower,
  mergeSuggestedComorbidities,
} from '@/lib/ip-management/clinical-evaluation-prefill';
import {
  buildComorbidityCompletionPatch,
  buildSurgicalPlanCompletionPatch,
} from '@/lib/ip-management/clinical-evaluation-persist';
import {
  canAmendClinicalEvaluation,
  canSignOffEvaluation,
  completionByKey,
  emptyClinicalEvaluationFields,
  formatComorbiditySummary,
  formatIolPlanSummary,
  formatWardDiagnosisSummary,
  hasIolPlanContent,
  isClinicalEvaluationEditLocked,
  isEvaluationSignedOff,
  isIolCataractProcedure,
  outpatientDiagnosisFromJourney,
  readClinicalEvaluationFields,
  type ClinicalEvaluationFields,
  type DiagnosisLaterality,
} from '@/lib/ip-management/clinical-evaluation';
import { WARD_PREOP_TEST_IDS } from '@/lib/ip-management/ward-preop-test-ids';
import { ClinicalEvaluationAmendDialog } from './ClinicalEvaluationAmendDialog';
import { ClinicalEvaluationComorbiditiesSection } from './ClinicalEvaluationComorbiditiesSection';
import { ClinicalEvaluationDiagnosisSection } from './ClinicalEvaluationDiagnosisSection';
import { ClinicalEvaluationIolSection } from './ClinicalEvaluationIolSection';

export interface ClinicalEvaluationFormProps {
  journeyId: string;
  counselingSessionId?: string | null;
  journeyDiagnosis?: string | null;
  clinicalState: string;
  paymentMode?: string;
  procedureName?: string;
  eyeOperated?: string;
  readOnly?: boolean;
  canEdit?: boolean;
  canSignOff?: boolean;
  canAmendInOt?: boolean;
  onChanged?: () => void;
}

function eyeToLaterality(eye?: string | null): DiagnosisLaterality {
  const e = (eye ?? '').toUpperCase();
  if (e.includes('OD') || e.includes('RE') || e.includes('RIGHT')) return 'OD';
  if (e.includes('OS') || e.includes('LE') || e.includes('LEFT')) return 'OS';
  return 'OU';
}

export function ClinicalEvaluationForm({
  journeyId,
  counselingSessionId,
  journeyDiagnosis,
  clinicalState,
  paymentMode,
  procedureName,
  eyeOperated,
  readOnly = false,
  canEdit = true,
  canSignOff = false,
  canAmendInOt = false,
  onChanged,
}: ClinicalEvaluationFormProps) {
  const { detail, loading, reloadClearance } = usePreOpClearanceData({
    journeyId,
    paymentMode,
    onChanged,
  });
  const [fields, setFields] = useState<ClinicalEvaluationFields>(emptyClinicalEvaluationFields());
  const [isAmending, setIsAmending] = useState(false);
  const [amendDialogOpen, setAmendDialogOpen] = useState(false);
  const [amendKind, setAmendKind] = useState<'ward' | 'in_ot'>('ward');
  const [amendLoading, setAmendLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [signingOff, setSigningOff] = useState(false);
  const [iolOptions, setIolOptions] = useState<IolMasterDto[]>([]);
  const [counsellingIol, setCounsellingIol] = useState<IolMasterDto | null>(null);
  const [counsellorNotes, setCounsellorNotes] = useState<string | null>(null);
  const [ctxLoading, setCtxLoading] = useState(false);
  const [patientId, setPatientId] = useState<string | null>(null);
  const [patientAge, setPatientAge] = useState<number | null>(null);
  const [patientGender, setPatientGender] = useState<string | null>(null);
  const [opSource, setOpSource] = useState(outpatientDiagnosisFromJourney(journeyDiagnosis));
  const [biometryPowerSuggestion, setBiometryPowerSuggestion] = useState<string | null>(null);
  const [biometryChecked, setBiometryChecked] = useState(false);
  const [journeyIolPower, setJourneyIolPower] = useState<string | null>(null);
  const [refreshingOpd, setRefreshingOpd] = useState(false);
  const prevIolStatus = useRef<string | null>(null);
  const prevDiagnosisStatus = useRef<string | null>(null);
  const prefillDone = useRef(false);

  const completions = useMemo(() => detail?.completions ?? [], [detail?.completions]);
  const signedOff = isEvaluationSignedOff(completions);
  const showIolPlan = isIolCataractProcedure(procedureName);
  const amendGate = canAmendClinicalEvaluation({
    clinicalState,
    signedOff,
    canSign: canSignOff,
    canAmendInOt,
  });
  const editLocked = isClinicalEvaluationEditLocked({
    readOnly: readOnly || !canEdit,
    signedOff,
    isAmending,
  });
  const signoffReady = canSignOffEvaluation(fields);
  const showSignedSummary = signedOff && !isAmending;

  useEffect(() => {
    if (!detail) return;
    const loaded = readClinicalEvaluationFields(detail.completions ?? []);
    setFields(loaded);
    prevDiagnosisStatus.current = loaded.diagnosisStatus;
    prevIolStatus.current = loaded.iol.status;
    if (!loaded.sourceDiagnosis && opSource) {
      setFields(f => ({ ...f, sourceDiagnosis: opSource }));
    }
  }, [detail, opSource]);

  useEffect(() => {
    if (prefillDone.current || signedOff) return;
    let cancelled = false;
    void (async () => {
      const jPower = await loadJourneyIolPower(journeyId);
      if (!cancelled && jPower) setJourneyIolPower(jPower);
    })();
    return () => {
      cancelled = true;
    };
  }, [journeyId, signedOff]);

  useEffect(() => {
    if (!patientId || prefillDone.current || signedOff) return;
    let cancelled = false;
    void (async () => {
      const [dxRows, examSource, comorbHints, bioPower] = await Promise.all([
        loadPatientDiagnosesForPrefill(patientId),
        loadExamDiagnosisSource(patientId),
        loadChartComorbiditySuggestions(patientId),
        loadSuggestedIolPower(patientId, eyeOperated),
      ]);
      if (cancelled) return;
      prefillDone.current = true;
      if (bioPower) setBiometryPowerSuggestion(bioPower);
      setBiometryChecked(true);
      if (examSource) setOpSource(prev => prev ?? examSource);
      setFields(f => {
        const next = { ...f };
        if (examSource && !next.sourceDiagnosis) next.sourceDiagnosis = examSource;
        if (next.diagnoses.length === 0 && dxRows.length > 0) {
          next.diagnoses = dxRows;
          next.diagnosisSummary = formatWardDiagnosisSummary(dxRows);
        }
        next.comorbidities = mergeSuggestedComorbidities(next.comorbidities, comorbHints);
        if (!next.iol.power) {
          if (bioPower) next.iol = { ...next.iol, power: bioPower };
          else if (journeyIolPower) next.iol = { ...next.iol, power: journeyIolPower };
        }
        return next;
      });
    })();
    return () => {
      cancelled = true;
    };
  }, [patientId, eyeOperated, journeyIolPower, signedOff]);

  useEffect(() => {
    setOpSource(outpatientDiagnosisFromJourney(journeyDiagnosis));
  }, [journeyDiagnosis]);

  useEffect(() => {
    if (!counselingSessionId) {
      setCounsellorNotes(null);
      setPatientId(null);
      return;
    }
    let cancelled = false;
    setCtxLoading(true);
    void fetchCounsellingClinicalContext(counselingSessionId, journeyDiagnosis)
      .then(async ctx => {
        if (cancelled || !ctx) return;
        setCounsellorNotes(ctx.counsellorNotes);
        setPatientId(ctx.patientId);
        setPatientAge(ctx.patientAge);
        setPatientGender(ctx.patientGender);
        if (ctx.outpatientDiagnosis) {
          setOpSource(ctx.outpatientDiagnosis);
          setFields(f =>
            f.sourceDiagnosis ? f : { ...f, sourceDiagnosis: ctx.outpatientDiagnosis },
          );
        }
        if (ctx.variantId) {
          const options = await serviceCatalogApi.getVariantIolOptions(ctx.variantId);
          if (cancelled) return;
          setIolOptions(options);
          const counsellingId = ctx.selectedIolId;
          const match = counsellingId ? options.find(o => o.id === counsellingId) ?? null : null;
          setCounsellingIol(match);
          if (!signedOff) {
            setFields(f => ({
              ...f,
              iol: {
                ...f.iol,
                counsellingIolId: counsellingId ?? f.iol.counsellingIolId,
                wardIolId: f.iol.wardIolId ?? counsellingId,
              },
            }));
          }
        }
      })
      .catch(() => {
        if (!cancelled) setCounsellorNotes(null);
      })
      .finally(() => {
        if (!cancelled) setCtxLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [counselingSessionId, journeyDiagnosis, signedOff]);

  const persistCompletion = useCallback(
    async (
      completion: PreOpCompletionDto,
      patch: {
        isCompleted?: boolean;
        notes?: string | null;
        resultValue?: string | null;
        resultUnit?: string | null;
      },
    ) => {
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
      if (!res) throw new Error('save failed');
      return res;
    },
    [journeyId],
  );

  const saveAllFields = useCallback(
    async (nextFields: ClinicalEvaluationFields) => {
      const surgical = completionByKey(completions, 'surgical_plan_confirmed');
      const comorb = completionByKey(completions, 'comorbidities_reviewed');
      if (!surgical || !comorb) return;

      setSaving(true);
      try {
        await persistCompletion(surgical, buildSurgicalPlanCompletionPatch(nextFields, surgical));
        await persistCompletion(comorb, buildComorbidityCompletionPatch(nextFields));
        const dx = formatWardDiagnosisSummary(nextFields.diagnoses);
        if (dx) await ipManagementApi.savePacAssessment(journeyId, { preOpDiagnosis: dx }).then(() => {});

        if (
          nextFields.iol.status === 'changed'
          && prevIolStatus.current !== 'changed'
        ) {
          await ipManagementApi.notifyClinicalEvaluationMaterialChange(journeyId, {
            changeType: 'iol_changed',
            previousIolId: nextFields.iol.counsellingIolId,
            newIolId: nextFields.iol.wardIolId,
            reason: nextFields.iol.changeReason,
            inOt: clinicalState === 'InOT',
          });
        }
        prevIolStatus.current = nextFields.iol.status;

        if (
          nextFields.diagnosisStatus === 'overridden'
          && prevDiagnosisStatus.current !== 'overridden'
        ) {
          await ipManagementApi.notifyClinicalEvaluationMaterialChange(journeyId, {
            changeType: 'diagnosis_overridden',
            reason: nextFields.diagnosisOverrideReason,
            inOt: clinicalState === 'InOT',
          });
        }
        prevDiagnosisStatus.current = nextFields.diagnosisStatus;

        await reloadClearance();
      } catch {
        toast.error('Could not save clinical evaluation.');
      } finally {
        setSaving(false);
      }
    },
    [completions, journeyId, persistCompletion, reloadClearance, clinicalState],
  );

  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const queueSave = useCallback(
    (next: ClinicalEvaluationFields) => {
      if (editLocked) return;
      if (saveTimer.current) clearTimeout(saveTimer.current);
      saveTimer.current = setTimeout(() => void saveAllFields(next), 600);
    },
    [editLocked, saveAllFields],
  );

  function updateFields(patch: Partial<ClinicalEvaluationFields>) {
    setFields(prev => {
      const next = { ...prev, ...patch };
      queueSave(next);
      return next;
    });
  }

  async function handleRefreshFromOpd() {
    setRefreshingOpd(true);
    try {
      const result = await ipManagementApi.refreshFromOpd(journeyId);
      const nextPower = result.iolPower ?? result.journey.iolPower ?? null;
      setJourneyIolPower(nextPower);
      if (nextPower) {
        setFields(f => ({ ...f, iol: { ...f.iol, power: nextPower } }));
      }
      if (result.biometryMissing) {
        toast.error(`No biometry on file for the ${result.eyePhrase ?? 'selected eye'}.`);
      } else {
        toast.success('Planned IOL refreshed from OPD.');
      }
    } catch {
      toast.error('Could not refresh from OPD.');
    } finally {
      setRefreshingOpd(false);
    }
  }

  async function handleAmendConfirm(input: { reason: string; category: string }) {
    setAmendLoading(true);
    try {
      const res = await ipManagementApi.amendClinicalEvaluation(journeyId, {
        reason: input.reason,
        category: input.category,
        inOt: amendKind === 'in_ot',
      });
      if (!res) throw new Error('amend failed');
      setIsAmending(true);
      setAmendDialogOpen(false);
      prefillDone.current = false;
      await reloadClearance();
      toast.success('Evaluation unlocked for amendment — re-sign when complete.');
    } catch {
      toast.error('Could not unlock evaluation for amendment.');
    } finally {
      setAmendLoading(false);
    }
  }

  async function handleSignOff() {
    if (editLocked || !canSignOff || !signoffReady) return;
    setSigningOff(true);
    try {
      await saveAllFields(fields);
      const completed = completionByKey(completions, 'doctor_evaluation_completed');
      const signed = completionByKey(completions, 'doctor_evaluation_signed');
      if (!completed || !signed) {
        toast.error('Sign-off items are not configured for this journey.');
        return;
      }
      for (const completion of [completed, signed]) {
        await persistCompletion(completion, { isCompleted: true });
      }
      setIsAmending(false);
      await reloadClearance();
      toast.success('Clinical evaluation signed off');
    } catch {
      toast.error('Could not complete doctor sign-off.');
    } finally {
      setSigningOff(false);
    }
  }

  function openAmend(kind: 'ward' | 'in_ot') {
    setAmendKind(kind);
    setAmendDialogOpen(true);
  }

  const summaryDiagnosis = useMemo(
    () => formatWardDiagnosisSummary(fields.diagnoses) || fields.diagnosisSummary,
    [fields],
  );

  const summaryIolName = useMemo(() => {
    const id = fields.iol.wardIolId ?? fields.iol.counsellingIolId;
    if (!id) return null;
    const fromOptions = iolOptions.find(o => o.id === id);
    if (fromOptions) return `${fromOptions.brandManufacturer} ${fromOptions.modelName}`.trim();
    if (counsellingIol && counsellingIol.id === id) {
      return `${counsellingIol.brandManufacturer} ${counsellingIol.modelName}`.trim();
    }
    return null;
  }, [fields.iol.wardIolId, fields.iol.counsellingIolId, iolOptions, counsellingIol]);

  if (loading) {
    return (
      <div className="flex items-center gap-2 py-4 text-sm text-gray-500">
        <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
        Loading…
      </div>
    );
  }

  return (
    <>
      <div
        data-testid={WARD_PREOP_TEST_IDS.clinicalEvalForm}
        className="space-y-4 rounded-xl border border-gray-200 bg-white"
      >
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-gray-100 bg-gray-50 px-4 py-3">
          <div className="grid flex-1 grid-cols-1 gap-2 sm:grid-cols-2">
            <div className="text-xs text-gray-600">
              <span className="text-gray-500">Procedure</span>
              <p className="font-medium text-gray-900">{procedureName?.trim() || '—'}</p>
            </div>
            <div className="text-xs text-gray-600">
              <span className="text-gray-500">Operative eye</span>
              <p className="font-medium text-gray-900">{eyeOperated?.trim() || '—'}</p>
            </div>
          </div>
          {showSignedSummary && amendGate.allowed && (
            <button
              type="button"
              data-testid={
                amendGate.kind === 'in_ot'
                  ? WARD_PREOP_TEST_IDS.clinicalEvalEmergencyAmend
                  : WARD_PREOP_TEST_IDS.clinicalEvalAmendButton
              }
              onClick={() => openAmend(amendGate.kind ?? 'ward')}
              className="inline-flex items-center gap-1 rounded-lg border border-gray-300 bg-white px-2.5 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50"
            >
              <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
              {amendGate.kind === 'in_ot' ? 'Emergency amend' : 'Amend'}
            </button>
          )}
        </div>

        {showSignedSummary ? (
          <div className="space-y-3 px-4 pb-4 text-sm text-gray-800">
            <div>
              <p className="text-xs font-medium text-gray-500">Pre-operative diagnosis</p>
              <p data-testid={WARD_PREOP_TEST_IDS.clinicalEvalDiagnosis}>{summaryDiagnosis || '—'}</p>
              {fields.diagnosisStatus === 'overridden' && (
                <p className="mt-0.5 text-xs text-amber-700">Overridden from outpatient diagnosis</p>
              )}
              {fields.clinicalNote.trim() && (
                <p className="mt-1 text-xs text-gray-600">
                  <span className="font-medium text-gray-500">Clinical note: </span>
                  {fields.clinicalNote}
                </p>
              )}
            </div>
            <div>
              <p className="text-xs font-medium text-gray-500">Comorbidities reviewed</p>
              <p>{formatComorbiditySummary(fields.comorbidities) || '—'}</p>
            </div>
            {showIolPlan && (
              <div>
                <p className="text-xs font-medium text-gray-500">IOL plan</p>
                <p data-testid={WARD_PREOP_TEST_IDS.clinicalEvalIolSummary}>
                  {formatIolPlanSummary(fields.iol, summaryIolName)}
                </p>
                {!hasIolPlanContent(fields.iol) && counsellingIol && (
                  <p className="mt-0.5 text-xs text-gray-600">
                    Counselling selection: {counsellingIol.brandManufacturer} {counsellingIol.modelName}
                  </p>
                )}
              </div>
            )}
            <p className="text-xs text-gray-500">
              Use <span className="font-medium">Amend</span> to update diagnosis, comorbidities, or IOL and re-sign.
            </p>
          </div>
        ) : (
          <div className="space-y-4 px-4 pb-4">
            <ClinicalEvaluationDiagnosisSection
              fields={fields}
              sourceDiagnosis={fields.sourceDiagnosis ?? opSource}
              disabled={editLocked}
              patientId={patientId}
              patientAge={patientAge}
              patientGender={patientGender}
              defaultLaterality={eyeToLaterality(eyeOperated)}
              onChange={updateFields}
            />

            <ClinicalEvaluationComorbiditiesSection
              comorbidities={fields.comorbidities}
              disabled={editLocked}
              onChange={comorbidities => updateFields({ comorbidities })}
            />

            {showIolPlan && (
              <ClinicalEvaluationIolSection
                fields={fields}
                counsellingIol={counsellingIol}
                iolOptions={iolOptions}
                biometryPowerSuggestion={biometryPowerSuggestion}
                journeyIolPower={journeyIolPower}
                eyeOperated={eyeOperated}
                emptyBiometry={biometryChecked && !biometryPowerSuggestion}
                disabled={editLocked}
                refreshingFromOpd={refreshingOpd}
                onChange={iol => updateFields({ iol })}
                onRefreshFromOpd={handleRefreshFromOpd}
              />
            )}

            <label className="flex items-center gap-2 text-sm text-gray-800">
              <input
                type="checkbox"
                data-testid={WARD_PREOP_TEST_IDS.clinicalEvalSurgicalPlanConfirmed}
                disabled={editLocked || !formatWardDiagnosisSummary(fields.diagnoses)}
                checked={fields.surgicalPlanConfirmed}
                onChange={e => updateFields({ surgicalPlanConfirmed: e.target.checked })}
                className="rounded border-gray-300"
              />
              Surgical plan confirmed with patient
              <span className="text-red-600">*</span>
            </label>

            <div className="border-t border-gray-100 pt-3">
              <p className="mb-2 text-xs font-medium text-gray-700">Counselling (outpatient)</p>
              {ctxLoading ? (
                <p className="text-xs text-gray-500">Loading counsellor notes…</p>
              ) : counsellorNotes ? (
                <p
                  data-testid={WARD_PREOP_TEST_IDS.clinicalEvalCounselling}
                  className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-800 whitespace-pre-wrap"
                >
                  {counsellorNotes}
                </p>
              ) : (
                <p className="text-xs text-gray-500">No counsellor notes on file.</p>
              )}
              <label className="mt-3 flex items-center gap-2 text-sm text-gray-800">
                <input
                  type="checkbox"
                  data-testid={WARD_PREOP_TEST_IDS.clinicalEvalPatientCounselled}
                  disabled={editLocked}
                  checked={fields.patientCounselled}
                  onChange={e => updateFields({ patientCounselled: e.target.checked })}
                  className="rounded border-gray-300"
                />
                Patient counselled on procedure and risks
                <span className="text-red-600">*</span>
              </label>
            </div>

            <div className="border-t border-gray-100 pt-3">
              {canSignOff ? (
                <button
                  type="button"
                  data-testid={WARD_PREOP_TEST_IDS.clinicalEvalSignoffButton}
                  disabled={signingOff || !signoffReady || saving}
                  title={!signoffReady ? 'Complete all required fields before sign-off' : undefined}
                  onClick={() => void handleSignOff()}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
                >
                  <PenLine className="h-4 w-4" aria-hidden="true" />
                  {signingOff ? 'Signing off…' : 'Sign off clinical evaluation'}
                </button>
              ) : (
                <button
                  type="button"
                  disabled
                  data-testid={WARD_PREOP_TEST_IDS.clinicalEvalSignoffRequired}
                  title="Doctor sign-off required"
                  className="inline-flex cursor-not-allowed items-center gap-1.5 rounded-lg bg-gray-200 px-4 py-2 text-sm font-medium text-gray-500"
                >
                  <PenLine className="h-4 w-4" aria-hidden="true" />
                  Doctor sign-off required
                </button>
              )}
            </div>

            {(saving || signingOff) && <p className="text-[11px] text-gray-400">Saving…</p>}
          </div>
        )}
      </div>

      <ClinicalEvaluationAmendDialog
        open={amendDialogOpen}
        kind={amendKind}
        loading={amendLoading}
        onClose={() => setAmendDialogOpen(false)}
        onConfirm={handleAmendConfirm}
      />
    </>
  );
}
