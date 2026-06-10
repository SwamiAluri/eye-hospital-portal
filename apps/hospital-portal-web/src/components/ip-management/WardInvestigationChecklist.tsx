'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Check, Copy, Loader2, Sparkles } from 'lucide-react';
import { toast } from 'react-hot-toast';
import {
  ipManagementApi,
  WardInvestigationChecklistDto,
} from '@/lib/api/ip-management.api';
import { useWardChecklistHints } from '@/hooks/use-ward-checklist-hints';
import { hintForItem } from '@/lib/ip-checklist/outpatient-integration';

export interface WardInvestigationChecklistProps {
  journeyId: string;
  patientId?: string;
  sessionId?: string;
  anaesthesiaType?: string;
  readOnly?: boolean;
}

export function WardInvestigationChecklist({
  journeyId,
  patientId,
  sessionId,
  anaesthesiaType,
  readOnly = false,
}: WardInvestigationChecklistProps) {
  const [checklist, setChecklist] = useState<WardInvestigationChecklistDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [savingItemId, setSavingItemId] = useState<string | null>(null);

  const itemKeys = useMemo(
    () => checklist?.items.map(i => i.itemKey) ?? [],
    [checklist?.items],
  );

  const { hints } = useWardChecklistHints(
    { patientId, sessionId, anaesthesiaType },
    itemKeys,
  );

  const load = useCallback(async () => {
    setLoading(true);
    const data = await ipManagementApi.getWardInvestigationChecklist(journeyId);
    setChecklist(data);
    setLoading(false);
  }, [journeyId]);

  useEffect(() => {
    load();
  }, [load]);

  async function toggleItem(itemId: string, currentlyDone: boolean) {
    if (readOnly) return;
    setSavingItemId(itemId);
    const updated = await ipManagementApi.saveWardInvestigationCompletion(journeyId, itemId, {
      isCompleted: !currentlyDone,
    });
    if (updated) setChecklist(updated);
    else toast.error('Failed to save investigation item');
    setSavingItemId(null);
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8 text-sm text-gray-500">
        <Loader2 className="h-4 w-4 animate-spin mr-2" />
        Loading investigation checklist…
      </div>
    );
  }

  if (!checklist?.items.length) {
    return (
      <p className="text-sm text-gray-500 py-4">
        Investigation checklist not configured. Run migration 140.
      </p>
    );
  }

  const applicable = checklist.items.filter(i => i.appliesToJourney);
  const pct = checklist.totalItems > 0
    ? Math.round((checklist.completedItems / checklist.totalItems) * 100)
    : 0;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between rounded-lg bg-indigo-50 border border-indigo-200 px-3 py-2">
        <span className="text-sm font-semibold text-indigo-900">Ward Investigation Pre-op (Form 1)</span>
        <span className="text-sm font-medium text-indigo-800">
          {checklist.completedItems}/{checklist.totalItems} ({pct}%)
        </span>
      </div>
      <p className="text-xs text-gray-500">
        X-ray (GA) shown only when anaesthesia type is General. Counsellor items copy automatically.
      </p>
      <ul className="divide-y divide-gray-100 rounded-lg border border-gray-200 overflow-hidden">
        {applicable.map(item => {
          const done = item.isCompleted || item.isBypassed;
          const hint = hintForItem(hints, item.itemKey);
          const copied = item.source === 'copied_from_counsellor';

          return (
            <li key={item.itemId} className={`flex items-start gap-3 px-3 py-2.5 ${done ? 'bg-green-50/60' : 'bg-white'}`}>
              <button
                type="button"
                disabled={readOnly || savingItemId === item.itemId}
                onClick={() => toggleItem(item.itemId, item.isCompleted)}
                className={[
                  'mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded border',
                  done ? 'border-green-600 bg-green-600 text-white' : 'border-gray-300 bg-white hover:border-indigo-500',
                  readOnly ? 'cursor-default opacity-70' : 'cursor-pointer',
                ].join(' ')}
              >
                {savingItemId === item.itemId ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : done ? (
                  <Check className="h-3 w-3" strokeWidth={3} />
                ) : null}
              </button>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className={`text-sm ${done ? 'text-gray-700' : 'text-gray-900'}`}>{item.itemLabel}</p>
                  {copied && (
                    <span className="inline-flex items-center gap-0.5 text-[10px] font-medium text-blue-700 bg-blue-50 border border-blue-100 rounded px-1.5 py-0.5">
                      <Copy className="h-2.5 w-2.5" /> Counsellor
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
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
