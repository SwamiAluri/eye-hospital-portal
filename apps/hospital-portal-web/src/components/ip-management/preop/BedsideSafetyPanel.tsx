'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Check, Loader2, Lock } from 'lucide-react';
import { toast } from 'react-hot-toast';
import {
  ipManagementApi,
  type WardChecklistDto,
  type PreOpCompletionDto,
} from '@/lib/api/ip-management.api';
import { usePreOpClearanceOptional } from '@/components/ip-management/preop/PreOpClearanceProvider';
import { useWardChecklistHints } from '@/hooks/use-ward-checklist-hints';
import { useWardForm2SyncHints } from '@/hooks/use-ward-form2-sync-hints';
import { hintForItem } from '@/lib/ip-checklist/outpatient-integration';
import { WARD_PREOP_TEST_IDS } from '@/lib/ip-management/ward-preop-test-ids';
import type { StepReadiness } from '@/lib/ip-management/preop-readiness';
import {
  BEDSIDE_NURSE_WARD_ITEMS,
  BEDSIDE_NURSE_REHOMED_ITEMS,
} from '@/lib/ip-management/bedside-items';

export interface BedsideSafetyPanelProps {
  journeyId: string;
  paymentMode?: string;
  sessionId?: string;
  patientId?: string;
  financialState?: string;
  balanceDue?: number;
  readOnly?: boolean;
  /** Patient lifecycle state — bedside acts are locked until the patient is admitted. */
  clinicalState?: string;
  /** Canonical rollup so the panel meter matches the step rail (single source of truth). */
  stepReadiness?: StepReadiness;
  /** Notify the workspace that data changed so the step rail rollup can refresh. */
  onChanged?: () => void;
}

/** A ward item applies unless the catalog explicitly scopes it out for this surgery/patient type. */
function appliesToJourney(item: { appliesToJourney?: boolean } | undefined): boolean {
  return item?.appliesToJourney !== false;
}

/** Medico-legal attribution stamp: "role · date time" for a completed act. */
function formatStamp(at: string | null | undefined, role?: string | null): string | null {
  if (!at) return null;
  const t = new Date(at);
  if (Number.isNaN(t.getTime())) return null;
  const who = role && role !== 'system' ? `${role} · ` : '';
  return `${who}${t.toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}`;
}

function mergeHints(
  integration: ReturnType<typeof useWardChecklistHints>['hints'],
  sync: ReturnType<typeof useWardForm2SyncHints>['hints'],
) {
  const byKey = new Map(integration.map(h => [h.itemKey, h]));
  for (const h of sync) {
    const existing = byKey.get(h.itemKey);
    if (!existing || h.suggestedComplete) byKey.set(h.itemKey, h);
  }
  return Array.from(byKey.values());
}

export function BedsideSafetyPanel({
  journeyId,
  paymentMode,
  sessionId,
  patientId,
  financialState,
  balanceDue,
  readOnly = false,
  clinicalState,
  onChanged,
}: BedsideSafetyPanelProps) {
  const sharedClearance = usePreOpClearanceOptional();
  const [checklist, setChecklist] = useState<WardChecklistDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [savingItemId, setSavingItemId] = useState<string | null>(null);

  const clearance = sharedClearance?.detail ?? null;
  const clearanceLoading = sharedClearance?.loading ?? false;

  // Bedside acts (check-in, dilatation, meds…) physically happen at the bedside, so they
  // stay locked until the patient is admitted.
  const bedsideActsLocked = readOnly || clinicalState === 'Expected';

  const itemKeys = useMemo(() => checklist?.items.map(i => i.itemKey) ?? [], [checklist?.items]);
  const { hints: integrationHints } = useWardChecklistHints(
    { patientId, sessionId, financialState, balanceDue, emergencyFcApplied: checklist?.emergencyFcApplied },
    itemKeys,
  );
  const { hints: syncHints, reload: reloadSyncHints } = useWardForm2SyncHints({ journeyId, itemKeys });
  const hints = useMemo(() => mergeHints(integrationHints, syncHints), [integrationHints, syncHints]);

  const load = useCallback(async () => {
    setLoading(true);
    const data = await ipManagementApi.getWardChecklist(journeyId, paymentMode);
    setChecklist(data);
    setLoading(false);
    reloadSyncHints();
  }, [journeyId, paymentMode, reloadSyncHints]);

  useEffect(() => {
    load();
  }, [load]);

  const wardByKey = new Map<string, WardChecklistDto['items'][number]>();
  for (const i of checklist?.items ?? []) wardByKey.set(i.itemKey, i);

  const clearanceByKey = new Map<string, PreOpCompletionDto>();
  for (const c of clearance?.completions ?? []) clearanceByKey.set(c.itemKey, c);

  async function toggleWardItem(itemId: string, currentlyDone: boolean) {
    if (bedsideActsLocked) return;
    setSavingItemId(itemId);
    const updated = await ipManagementApi.saveWardChecklistCompletion(journeyId, itemId, {
      isCompleted: !currentlyDone,
    });
    if (updated) {
      setChecklist(updated);
      reloadSyncHints();
      onChanged?.();
    } else {
      toast.error('Failed to save bedside checklist item');
    }
    setSavingItemId(null);
  }

  async function toggleRehomed(completion: PreOpCompletionDto) {
    if (bedsideActsLocked) return;
    setSavingItemId(completion.itemId);
    await ipManagementApi.savePreOpCompletion(journeyId, completion.itemId, {
      itemId: completion.itemId,
      isCompleted: !completion.isCompleted,
      isBypassed: false,
      notes: completion.notes ?? undefined,
    });
    if (sharedClearance) {
      await sharedClearance.reload();
      sharedClearance.notifyChanged();
    } else {
      onChanged?.();
    }
    setSavingItemId(null);
  }

  if (loading || clearanceLoading) {
    return (
      <div className="flex items-center justify-center py-8 text-sm text-gray-500">
        <Loader2 className="h-4 w-4 animate-spin mr-2" /> Loading bedside preparation…
      </div>
    );
  }

  if (!checklist || checklist.items.length === 0) {
    return (
      <p className="text-sm text-gray-500 py-4" data-testid={WARD_PREOP_TEST_IDS.sectionWardSafety}>
        Bedside preparation checklist is not configured. Run migration 135 to seed items.
      </p>
    );
  }

  function renderNurseToggle(
    itemId: string,
    itemKey: string,
    label: string,
    done: boolean,
    stamp: string | null,
    onToggle: () => void,
  ) {
    const isSaving = savingItemId === itemId;
    const hint = hintForItem(hints, itemKey);
    return (
      <li
        key={itemKey}
        className={['flex items-start gap-3 px-3 py-2.5', done ? 'bg-emerald-50/60' : 'bg-white'].join(' ')}
      >
        <button
          type="button"
          role="checkbox"
          aria-checked={done}
          aria-label={label}
          disabled={bedsideActsLocked || isSaving}
          data-testid={WARD_PREOP_TEST_IDS.bedsideNurseToggle(itemKey)}
          onClick={onToggle}
          className={[
            'mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded border transition-colors',
            done ? 'border-emerald-600 bg-emerald-600 text-white' : 'border-gray-300 bg-white hover:border-teal-500',
            bedsideActsLocked ? 'cursor-default opacity-70' : 'cursor-pointer',
            isSaving ? 'opacity-50' : '',
          ].join(' ')}
        >
          {isSaving ? <Loader2 className="h-3 w-3 animate-spin" /> : done ? <Check className="h-3 w-3" strokeWidth={3} /> : null}
        </button>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className={`text-sm ${done ? 'text-gray-700' : 'text-gray-900'}`}>{label}</p>
            {!done && !bedsideActsLocked && hint?.suggestedComplete && (
              <span className="rounded border border-emerald-100 bg-emerald-50 px-1.5 py-0.5 text-[10px] font-medium text-emerald-700">
                {hint.label}
              </span>
            )}
          </div>
          {stamp && <p className="mt-0.5 text-[11px] text-gray-500">{stamp}</p>}
        </div>
      </li>
    );
  }

  const nurseWard = BEDSIDE_NURSE_WARD_ITEMS.filter(
    n => wardByKey.has(n.key) && appliesToJourney(wardByKey.get(n.key)),
  );
  const nurseRehomed = BEDSIDE_NURSE_REHOMED_ITEMS.filter(n => clearanceByKey.has(n.key));

  return (
    <div className="space-y-4" data-testid={WARD_PREOP_TEST_IDS.sectionWardSafety}>
      {/* Count lives on the step rail (single source) — header carries only the title. */}
      <h3 className="text-sm font-semibold text-gray-900">Pre-OT Nursing Preparation</h3>

      {/* Nurse bedside actions (editable writers; locked until admission) */}
      <section data-testid={WARD_PREOP_TEST_IDS.bedsideNurseGroup} className="space-y-2">
        {bedsideActsLocked && clinicalState === 'Expected' && (
          <p
            data-testid={WARD_PREOP_TEST_IDS.bedsideActsLocked}
            className="flex items-center gap-1.5 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-xs text-gray-500"
          >
            <Lock className="h-3.5 w-3.5 shrink-0" aria-hidden="true" /> Bedside preparation unlocks once the patient is admitted.
          </p>
        )}
        <ul className="divide-y divide-gray-100 overflow-hidden rounded-lg border border-gray-200">
          {nurseWard.map(n => {
            const item = wardByKey.get(n.key)!;
            const done = item.isCompleted || item.isBypassed;
            return renderNurseToggle(
              item.itemId,
              n.key,
              n.label,
              done,
              done ? formatStamp(item.completedAt, item.completedByRole) : null,
              () => toggleWardItem(item.itemId, item.isCompleted),
            );
          })}
          {nurseRehomed.map(n => {
            const c = clearanceByKey.get(n.key)!;
            return renderNurseToggle(
              c.itemId,
              n.key,
              n.label,
              c.isCompleted,
              c.isCompleted ? formatStamp(c.completedAt, c.completedByRole) : null,
              () => toggleRehomed(c),
            );
          })}
        </ul>
      </section>
    </div>
  );
}
