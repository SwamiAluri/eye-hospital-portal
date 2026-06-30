'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Check, Loader2, Copy, Sparkles } from 'lucide-react';
import { toast } from 'react-hot-toast';
import {
  ipManagementApi,
  WardChecklistDto,
} from '@/lib/api/ip-management.api';
import { useWardChecklistHints } from '@/hooks/use-ward-checklist-hints';
import { useWardForm2SyncHints } from '@/hooks/use-ward-form2-sync-hints';
import { hintForItem } from '@/lib/ip-checklist/outpatient-integration';
import { WARD_PREOP_TEST_IDS } from '@/lib/ip-management/ward-preop-test-ids';

export interface WardChecklistProps {
  journeyId: string;
  paymentMode?: string;
  sessionId?: string;
  patientId?: string;
  financialState?: string;
  balanceDue?: number;
  readOnly?: boolean;
}

function fmtTime(dt: string | null | undefined): string {
  if (!dt) return '—';
  return new Date(dt).toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function financialLabel(state: string, balanceDue: number | null | undefined, emergencyFc: boolean): string {
  if (emergencyFc) return 'Emergency FC applied';
  if (['Paid', 'Settled', 'PartiallyPaid', 'Confirmed'].includes(state)) return state;
  if (balanceDue != null && balanceDue > 0) return `Outstanding ₹${balanceDue.toLocaleString('en-IN')}`;
  return state || 'NotCreated';
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

export function WardChecklist({
  journeyId,
  paymentMode,
  sessionId,
  patientId,
  financialState,
  balanceDue,
  readOnly = false,
}: WardChecklistProps) {
  const [checklist, setChecklist] = useState<WardChecklistDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [savingItemId, setSavingItemId] = useState<string | null>(null);

  const itemKeys = useMemo(() => checklist?.items.map(i => i.itemKey) ?? [], [checklist?.items]);
  const { hints: integrationHints } = useWardChecklistHints(
    { patientId, sessionId, financialState, balanceDue, emergencyFcApplied: checklist?.emergencyFcApplied },
    itemKeys,
  );
  const { hints: syncHints, reload: reloadSyncHints } = useWardForm2SyncHints({ journeyId, itemKeys });
  const hints = useMemo(
    () => mergeHints(integrationHints, syncHints),
    [integrationHints, syncHints],
  );

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

  async function toggleItem(itemId: string, currentlyDone: boolean) {
    if (readOnly) return;
    setSavingItemId(itemId);
    const updated = await ipManagementApi.saveWardChecklistCompletion(journeyId, itemId, {
      isCompleted: !currentlyDone,
    });
    if (updated) {
      setChecklist(updated);
      reloadSyncHints();
    } else {
      toast.error('Failed to save ward checklist item');
    }
    setSavingItemId(null);
  }

  async function applySuggestion(itemId: string) {
    if (readOnly) return;
    setSavingItemId(itemId);
    const updated = await ipManagementApi.saveWardChecklistCompletion(journeyId, itemId, {
      isCompleted: true,
    });
    if (updated) {
      setChecklist(updated);
      reloadSyncHints();
      toast.success('Checklist item marked complete');
    } else {
      toast.error('Failed to apply suggestion');
    }
    setSavingItemId(null);
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8 text-sm text-gray-500">
        <Loader2 className="h-4 w-4 animate-spin mr-2" />
        Loading ward checklist…
      </div>
    );
  }

  if (!checklist || checklist.items.length === 0) {
    return (
      <p className="text-sm text-gray-500 py-4">
        Ward checklist is not configured. Run migration 135 to seed items.
      </p>
    );
  }

  const { completedItems, totalItems } = checklist;
  const pct = totalItems > 0 ? Math.round((completedItems / totalItems) * 100) : 0;

  return (
    <div className="space-y-3" data-testid={WARD_PREOP_TEST_IDS.sectionWardSafety}>
      <div className="flex items-center justify-between rounded-lg bg-teal-50 border border-teal-200 px-3 py-2">
        <span className="text-sm font-semibold text-teal-900">Ward Safety Checklist</span>
        <span className="text-sm font-medium text-teal-800">
          {completedItems}/{totalItems} complete
          <span className="text-teal-600 ml-1">({pct}%)</span>
        </span>
      </div>

      <p className="text-xs text-gray-500">
        Items auto-tick from §1 investigations, vitals, PAC, and §2 consent when those steps complete.
        Dilatation requires nurse confirmation after med log entry.
      </p>

      <div className="grid grid-cols-2 gap-2 text-xs">
        <div className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2">
          <span className="text-gray-500">Billing status</span>
          <p className="font-medium text-gray-800 mt-0.5">
            {financialLabel(checklist.financialState, checklist.balanceDue, checklist.emergencyFcApplied)}
          </p>
        </div>
        <div className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2">
          <span className="text-gray-500">Check-in / OT informed</span>
          <p className="font-medium text-gray-800 mt-0.5">
            {fmtTime(checklist.wardCheckInAt)} · {fmtTime(checklist.informedOtTeamAt)}
          </p>
        </div>
      </div>

      <ul className="divide-y divide-gray-100 rounded-lg border border-gray-200 overflow-hidden">
        {checklist.items.map((item) => {
          const done = item.isCompleted || item.isBypassed;
          const isSaving = savingItemId === item.itemId;
          const copied = item.source === 'copied_from_counsellor';
          const autoSynced = (item.notes ?? '').toLowerCase().includes('auto-synced');
          const hint = hintForItem(hints, item.itemKey);
          const showApply = !readOnly && !done && hint?.suggestedComplete;

          return (
            <li
              key={item.itemId}
              className={[
                'flex items-start gap-3 px-3 py-2.5 transition-colors',
                done ? 'bg-green-50/60' : 'bg-white',
              ].join(' ')}
            >
              <button
                type="button"
                disabled={readOnly || isSaving}
                onClick={() => toggleItem(item.itemId, item.isCompleted)}
                className={[
                  'mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded border transition-colors',
                  done
                    ? 'border-green-600 bg-green-600 text-white'
                    : 'border-gray-300 bg-white hover:border-teal-500',
                  readOnly ? 'cursor-default opacity-70' : 'cursor-pointer',
                  isSaving ? 'opacity-50' : '',
                ].join(' ')}
                aria-label={item.itemLabel}
                aria-pressed={done}
              >
                {isSaving ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : done ? (
                  <Check className="h-3 w-3" strokeWidth={3} />
                ) : null}
              </button>

              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className={`text-sm ${done ? 'text-gray-700' : 'text-gray-900'}`}>
                    {item.itemLabel}
                  </p>
                  {copied && (
                    <span className="inline-flex items-center gap-0.5 text-[10px] font-medium text-blue-700 bg-blue-50 border border-blue-100 rounded px-1.5 py-0.5">
                      <Copy className="h-2.5 w-2.5" />
                      Counsellor
                    </span>
                  )}
                  {autoSynced && (
                    <span className="inline-flex items-center gap-0.5 text-[10px] font-medium text-indigo-700 bg-indigo-50 border border-indigo-100 rounded px-1.5 py-0.5">
                      <Sparkles className="h-2.5 w-2.5" /> Auto-synced
                    </span>
                  )}
                  {hint && (
                    <span className={`inline-flex items-center gap-0.5 text-[10px] font-medium rounded px-1.5 py-0.5 border ${
                      hint.suggestedComplete
                        ? 'text-emerald-700 bg-emerald-50 border-emerald-100'
                        : 'text-amber-700 bg-amber-50 border-amber-100'
                    }`}>
                      <Sparkles className="h-2.5 w-2.5" /> {hint.label}
                    </span>
                  )}
                </div>
                {item.description && (
                  <p className="text-xs text-gray-500 mt-0.5">{item.description}</p>
                )}
                {hint?.detail && (
                  <p className="text-[10px] text-gray-500 mt-0.5">{hint.detail}</p>
                )}
                {autoSynced && item.notes && (
                  <p className="text-[10px] text-indigo-600 mt-0.5">{item.notes}</p>
                )}
                {copied && item.completedByRole && (
                  <p className="text-[10px] mt-1 text-slate-500">
                    Fellow / role: {item.completedByRole}
                  </p>
                )}
                {showApply && (
                  <button
                    type="button"
                    disabled={isSaving}
                    onClick={() => applySuggestion(item.itemId)}
                    className="mt-1.5 text-[11px] font-medium text-teal-700 hover:text-teal-900 underline disabled:opacity-50"
                  >
                    Mark complete from suggestion
                  </button>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
