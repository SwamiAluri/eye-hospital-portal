'use client';

import { useCallback, useEffect, useState } from 'react';
import { Check, Loader2 } from 'lucide-react';
import { toast } from 'react-hot-toast';
import {
  ipManagementApi,
  type ChecklistItemDto,
  type ChecklistResponseDto,
} from '@/lib/api/ip-management.api';
import { WardPostOpChecklist } from '@/components/ip-management/WardPostOpChecklist';

export function NurseSurgeonChecklistPanel({
  journeyId,
  patientId,
  counselingSessionId,
  readOnly,
  onChanged,
}: {
  journeyId: string;
  patientId?: string;
  counselingSessionId?: string;
  readOnly?: boolean;
  onChanged?: () => void;
}) {
  const [items, setItems] = useState<ChecklistItemDto[]>([]);
  const [responses, setResponses] = useState<ChecklistResponseDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);

  const loadSurgeon = useCallback(async () => {
    setLoading(true);
    const data = await ipManagementApi.getSurgeonChecklist(journeyId);
    setItems(data.items ?? []);
    setResponses(data.responses ?? []);
    setLoading(false);
  }, [journeyId]);

  useEffect(() => {
    void loadSurgeon();
  }, [loadSurgeon]);

  function isDone(itemId: string): boolean {
    return !!responses.find(r => r.checklistItemId === itemId)?.isCompleted;
  }

  async function toggleSurgeon(itemId: string) {
    if (readOnly) return;
    setSavingId(itemId);
    const nextDone = !isDone(itemId);
    const nextResponses = items.map(it => ({
      checklistItemId: it.id,
      isCompleted: it.id === itemId ? nextDone : isDone(it.id),
    }));
    const ok = await ipManagementApi.saveSurgeonChecklist(journeyId, { responses: nextResponses });
    setSavingId(null);
    if (!ok) {
      toast.error('Failed to save surgeon checklist');
      return;
    }
    await loadSurgeon();
    onChanged?.();
  }

  const surgeonDone = items.length > 0
    ? items.filter(i => isDone(i.id)).length
    : 0;

  return (
    <div className="space-y-6">
      <section>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-gray-900">Nurse checklist (Form 4)</h3>
        </div>
        <WardPostOpChecklist
          journeyId={journeyId}
          patientId={patientId}
          counselingSessionId={counselingSessionId}
          readOnly={readOnly}
        />
      </section>

      <section>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-gray-900">Surgeon post-op checklist</h3>
          {!loading && items.length > 0 && (
            <span className="text-xs bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded-full font-medium">
              {surgeonDone} of {items.length} complete
            </span>
          )}
        </div>
        {loading ? (
          <div className="flex items-center gap-2 text-sm text-gray-500 py-4">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading…
          </div>
        ) : items.length === 0 ? (
          <p className="text-sm text-gray-500">No surgeon checklist items configured.</p>
        ) : (
          <ul className="space-y-2 rounded-xl border border-gray-200 p-3">
            {items
              .slice()
              .sort((a, b) => a.itemOrder - b.itemOrder)
              .map(item => {
                const done = isDone(item.id);
                return (
                  <li key={item.id}>
                    <button
                      type="button"
                      disabled={readOnly || savingId === item.id}
                      onClick={() => void toggleSurgeon(item.id)}
                      className="flex w-full items-center gap-3 rounded-lg px-2 py-2 text-left text-sm hover:bg-gray-50 disabled:opacity-60"
                    >
                      <span
                        className={[
                          'flex h-5 w-5 shrink-0 items-center justify-center rounded border',
                          done ? 'border-emerald-500 bg-emerald-500 text-white' : 'border-gray-300 bg-white',
                        ].join(' ')}
                      >
                        {done && <Check className="h-3 w-3" />}
                      </span>
                      <span className={done ? 'text-gray-700' : 'text-gray-900'}>{item.itemLabel}</span>
                      {item.isRequired && (
                        <span className="ml-auto text-[10px] uppercase tracking-wide text-gray-400">Required</span>
                      )}
                    </button>
                  </li>
                );
              })}
          </ul>
        )}
        <p className="text-xs text-gray-500 mt-2">
          The nurse checklist alone does not close a post-op record — surgeon sign-off is required for discharge readiness.
        </p>
      </section>
    </div>
  );
}
