'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { CheckSquare, Square, Loader2, Clock, AlertTriangle } from 'lucide-react';
import {
  ipManagementApi,
  type PacAssessmentDto,
  type PreOpCompletionDto,
} from '@/lib/api/ip-management.api';
import { usePreOpClearanceData } from '@/hooks/use-preop-clearance-data';
import type { StepReadiness } from '@/lib/ip-management/preop-readiness';
import {
  computeFastingStatus,
  formatFastingDuration,
  INTAKE_OPTIONS,
  normalizeIntakeType,
  type IntakeType,
} from '@/lib/ip-management/preop-fasting';
import {
  computeMedHoldSignals,
  isMedHoldRowVisible,
  medHoldHintForRow,
  MED_HOLD_ROWS,
  type MedHoldRowKey,
} from '@/lib/ip-management/preop-med-holds';
import { WARD_PREOP_TEST_IDS } from '@/lib/ip-management/ward-preop-test-ids';
import { StatusChip } from './primitives/StatusChip';
import { DerivedTick } from './primitives/DerivedTick';

export interface FastingMedicationPanelProps {
  journeyId: string;
  clinicalState: string;
  paymentMode?: string;
  readOnly?: boolean;
  /** When provided (workspace rollup), avoids a duplicate PAC fetch. */
  pac?: PacAssessmentDto | null;
  pacLoading?: boolean;
  /** Canonical step rollup so the panel shows the SAME count as the rail (no second denominator). */
  stepReadiness?: StepReadiness;
  /** Notify the workspace that data changed so the step rail rollup can refresh. */
  onChanged?: () => void;
}

function formatStamp(at: string | null | undefined, role?: string | null): string | null {
  if (!at) return null;
  const t = new Date(at);
  if (Number.isNaN(t.getTime())) return null;
  const who = role && role !== 'system' ? `${role} · ` : '';
  return `${who}${t.toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}`;
}

export function FastingMedicationPanel({
  journeyId,
  paymentMode,
  readOnly = false,
  pac: pacProp,
  pacLoading: pacLoadingProp,
  onChanged,
}: FastingMedicationPanelProps) {
  const { detail, loading, error, reloadClearance } = usePreOpClearanceData({
    journeyId,
    paymentMode,
    onChanged,
  });
  const [pacLocal, setPacLocal] = useState<PacAssessmentDto | null>(null);
  const [pacLocalLoading, setPacLocalLoading] = useState(pacProp === undefined);

  const pac = pacProp !== undefined ? pacProp : pacLocal;
  const pacLoading = pacLoadingProp ?? (pacProp === undefined ? pacLocalLoading : false);
  const pacLoaded = pacProp !== undefined || !pacLocalLoading;

  useEffect(() => {
    if (pacProp !== undefined) return;
    let active = true;
    setPacLocalLoading(true);
    ipManagementApi
      .getPacAssessment(journeyId)
      .then(p => { if (active) setPacLocal(p); })
      .finally(() => { if (active) setPacLocalLoading(false); });
    return () => { active = false; };
  }, [journeyId, pacProp]);

  const [actionError, setActionError] = useState<string | null>(null);
  const [saving, setSaving] = useState<string | null>(null);
  const [npoValue, setNpoValue] = useState('');
  const [intakeType, setIntakeType] = useState<IntakeType>('light');

  useEffect(() => {
    const npo = detail?.completions.find(c => c.itemKey === 'last_food_time');
    setNpoValue(npo?.resultValue ?? npo?.notes ?? '');
    setIntakeType(normalizeIntakeType(npo?.resultUnit));
  }, [detail]);

  const byKey = useMemo(() => {
    const map = new Map<string, PreOpCompletionDto>();
    for (const c of detail?.completions ?? []) map.set(c.itemKey, c);
    return map;
  }, [detail]);

  const medSignals = useMemo(() => computeMedHoldSignals(pac), [pac]);
  const fasting = computeFastingStatus({ npoValue, intakeType });

  const medItems = MED_HOLD_ROWS.filter(meta => {
    const completion = byKey.get(meta.key);
    if (!completion) return false;
    return isMedHoldRowVisible(meta, {
      isCompleted: completion.isCompleted,
      isBlocking: completion.isBlocking,
      pacLoading,
      pacLoaded,
      signals: medSignals,
    });
  });

  async function persistToggle(completion: PreOpCompletionDto, isCompleted: boolean) {
    if (readOnly) return;
    setSaving(completion.itemKey);
    setActionError(null);
    try {
      const res = await ipManagementApi.savePreOpCompletion(journeyId, completion.itemId, {
        itemId: completion.itemId,
        isCompleted,
        isBypassed: false,
        notes: completion.notes ?? undefined,
      });
      if (!res) {
        setActionError(`Could not save "${completion.itemLabel}". Please retry.`);
        return;
      }
      await reloadClearance();
    } finally {
      setSaving(null);
    }
  }

  /**
   * Single NPO writer (D5). We persist the intake timestamp + type; the SERVER derives
   * `fasting_hours` + `fasting_confirmed` (no client-trusted safety facts).
   */
  async function saveNpo(value: string, type: IntakeType) {
    if (readOnly) return;
    const lastFood = byKey.get('last_food_time');
    if (!lastFood) return;
    const previous = lastFood.resultValue ?? lastFood.notes ?? '';
    setSaving('last_food_time');
    setActionError(null);
    try {
      const res = await ipManagementApi.savePreOpCompletion(journeyId, lastFood.itemId, {
        itemId: lastFood.itemId,
        isCompleted: !!value,
        isBypassed: false,
        notes: value || undefined,
        resultValue: value,
        resultUnit: type,
      });
      if (!res) {
        setActionError('Could not save the last-intake time. Please retry.');
        setNpoValue(previous);
        return;
      }
      await reloadClearance();
    } finally {
      setSaving(null);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center gap-2 py-10 text-sm text-gray-500">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading fasting & medication plan…
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
        {error}
      </div>
    );
  }

  const npoSaving = saving === 'last_food_time';
  const lastFood = byKey.get('last_food_time');
  const npoStamp = formatStamp(lastFood?.enteredAt ?? lastFood?.completedAt, lastFood?.completedByRole);
  const displayDuration =
    fasting.hours != null && !fasting.stale ? formatFastingDuration(fasting.hours) : '—';

  return (
    <div data-testid={WARD_PREOP_TEST_IDS.fastingPanel} className="space-y-4">
      <h3 className="text-sm font-semibold text-gray-900">Fasting &amp; Medication</h3>

      {actionError && (
        <div
          data-testid={WARD_PREOP_TEST_IDS.fastingError}
          role="alert"
          className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700"
        >
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          <span>{actionError}</span>
        </div>
      )}

      {lastFood && (
        <div className="rounded-xl border border-gray-200 bg-white px-3 py-3 space-y-3">
          <div className="flex items-center justify-between gap-2">
            <span className="text-sm font-medium text-gray-900">Nil by mouth (NPO)</span>
            {npoStamp && <span className="text-[11px] text-gray-400">Recorded · {npoStamp}</span>}
          </div>

          <div className="flex flex-wrap items-end gap-3">
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-gray-600">Last intake time</span>
              <input
                type="datetime-local"
                data-testid={WARD_PREOP_TEST_IDS.fastingNpoInput}
                value={npoValue}
                disabled={readOnly || npoSaving}
                max={new Date().toISOString().slice(0, 16)}
                onChange={e => setNpoValue(e.target.value)}
                onBlur={e => {
                  const v = e.target.value;
                  const stored = lastFood.resultValue ?? lastFood.notes ?? '';
                  if (v !== stored) void saveNpo(v, intakeType);
                }}
                className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-400 focus:outline-none focus:ring-1 focus:ring-indigo-400 disabled:bg-gray-50"
              />
            </label>

            <label className="block">
              <span className="mb-1 block text-xs font-medium text-gray-600">Intake type</span>
              <select
                data-testid={WARD_PREOP_TEST_IDS.fastingIntakeType}
                value={intakeType}
                disabled={readOnly || npoSaving}
                onChange={e => {
                  const next = e.target.value as IntakeType;
                  setIntakeType(next);
                  if (npoValue) void saveNpo(npoValue, next);
                }}
                className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-400 focus:outline-none focus:ring-1 focus:ring-indigo-400 disabled:bg-gray-50"
              >
                {INTAKE_OPTIONS.map(o => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </label>

            <div className="flex flex-col gap-1">
              <span className="text-xs font-medium text-gray-600">Fasting</span>
              <span
                data-testid={WARD_PREOP_TEST_IDS.fastingDuration}
                className="inline-flex items-center gap-1.5 rounded-md bg-gray-100 px-2.5 py-2 text-sm font-medium text-gray-800"
              >
                <Clock className="h-3.5 w-3.5 text-gray-500" aria-hidden="true" />
                {displayDuration}
              </span>
            </div>

            <div className="flex flex-col gap-1">
              <span className="text-xs font-medium text-gray-600">Status</span>
              <span data-testid={WARD_PREOP_TEST_IDS.fastingConfirmedChip}>
                {npoSaving ? (
                  <StatusChip status="in-progress" size="sm" label="Saving…" />
                ) : fasting.stale ? (
                  <StatusChip status="critical" size="sm" label="Verify intake time" />
                ) : fasting.confirmed ? (
                  <StatusChip status="completed" size="sm" label="Fasting confirmed" />
                ) : fasting.inadequate ? (
                  <StatusChip
                    status="critical"
                    size="sm"
                    label={`< ${fasting.threshold}h — not adequate`}
                  />
                ) : (
                  <StatusChip status="not-started" size="sm" label="Awaiting time" />
                )}
              </span>
            </div>
          </div>

          {fasting.stale && (
            <p className="text-xs text-amber-800">
              Last intake is over 24 hours ago — re-enter the correct time before marking fasting confirmed.
            </p>
          )}

          {fasting.inadequate && !fasting.stale && (
            <p className="text-xs text-red-700">
              Fasting is under {fasting.threshold} hours — confirm with the anaesthetist before proceeding.
            </p>
          )}
        </div>
      )}

      {medSignals.hasPacMedications && (
        <div
          data-testid={WARD_PREOP_TEST_IDS.fastingMedPull}
          className="rounded-lg border border-indigo-100 bg-indigo-50/50 px-3 py-2 text-xs text-indigo-900"
        >
          <span className="font-semibold">From PAC — current medications: </span>
          {medSignals.allMeds.map(m => m.name).join(', ')}
        </div>
      )}

      {medItems.length > 0 && (
        <div className="space-y-2">
          {medItems.map(meta => {
            const completion = byKey.get(meta.key)!;
            const done = completion.isCompleted;
            const isSaving = saving === meta.key;
            const stamp = done ? formatStamp(completion.completedAt, completion.completedByRole) : null;
            const hint = medHoldHintForRow(meta.key as MedHoldRowKey, medSignals);
            return (
              <div
                key={meta.key}
                data-testid={WARD_PREOP_TEST_IDS.fastingItem(meta.key)}
                className={[
                  'rounded-xl border px-3 py-2.5',
                  done ? 'border-emerald-100 bg-emerald-50/30' : 'border-gray-200 bg-white',
                ].join(' ')}
              >
                <div className="flex items-center gap-2.5">
                  <button
                    type="button"
                    role="checkbox"
                    aria-checked={done}
                    disabled={readOnly || isSaving}
                    data-testid={WARD_PREOP_TEST_IDS.fastingToggle(meta.key)}
                    onClick={() => persistToggle(completion, !done)}
                    className="shrink-0 rounded focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {isSaving ? (
                      <Loader2 className="h-5 w-5 animate-spin text-indigo-500" />
                    ) : done ? (
                      <CheckSquare className="h-5 w-5 text-emerald-600" />
                    ) : (
                      <Square className="h-5 w-5 text-gray-300" />
                    )}
                  </button>
                  <div className="min-w-0 flex-1">
                    <span className="text-sm font-medium text-gray-900">{meta.label}</span>
                    {stamp && <span className="ml-2 text-[11px] text-gray-400">{stamp}</span>}
                    {hint && (
                      <p
                        data-testid={WARD_PREOP_TEST_IDS.fastingMedHint(meta.key)}
                        className="mt-0.5 text-[11px] text-indigo-700"
                      >
                        Suggested hold: {hint}
                      </p>
                    )}
                  </div>
                  {completion.isBlocking && (
                    <span className="rounded-full bg-red-50 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-red-600">
                      Required
                    </span>
                  )}
                  <StatusChip status={done ? 'completed' : 'not-started'} size="sm" className="shrink-0" />
                </div>
              </div>
            );
          })}
        </div>
      )}

      {byKey.has('blood_group_confirmed') && (
        <div data-testid={WARD_PREOP_TEST_IDS.fastingDerivedGroup} className="space-y-2">
          <h4 className="text-xs font-semibold uppercase tracking-wide text-gray-500">Auto-tracked</h4>
          <DerivedTick
            itemKey="blood_group_confirmed"
            label="Blood group confirmed"
            satisfied={!!byKey.get('blood_group_confirmed')?.isCompleted}
            sourceLabel="Investigations"
            pendingHint={byKey.get('blood_group_confirmed')?.isCompleted ? undefined : 'Confirm blood group in Investigations.'}
          />
        </div>
      )}
    </div>
  );
}
