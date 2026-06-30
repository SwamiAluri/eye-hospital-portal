'use client';

import { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useState } from 'react';
import { Check, Loader2, Sparkles } from 'lucide-react';
import { toast } from 'react-hot-toast';
import {
  ipManagementApi,
  CounsellorOutpatientChecklistDto,
} from '@/lib/api/ip-management.api';
import { useOutpatientChecklistHints } from '@/hooks/use-outpatient-checklist-hints';
import {
  computeRollupCards,
  hintForItem,
  ROLLUP_DRILLDOWN_TARGETS,
  type OutpatientIntegrationContext,
} from '@/lib/ip-checklist/outpatient-integration';
import type { OutpatientChecklistHandle } from '@/components/counsellors-desk/outpatient-checklist-handle';
import { OutpatientChecklistRollup } from './OutpatientChecklistRollup';

export interface CounsellorOutpatientChecklistProps {
  counselingSessionId: string;
  readOnly?: boolean;
  integrationContext?: OutpatientIntegrationContext;
  showRollup?: boolean;
}

export const CounsellorOutpatientChecklist = forwardRef<
  OutpatientChecklistHandle,
  CounsellorOutpatientChecklistProps
>(function CounsellorOutpatientChecklist(
  { counselingSessionId, readOnly = false, integrationContext, showRollup = false },
  ref,
) {
  const [checklist, setChecklist] = useState<CounsellorOutpatientChecklistDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [savingItemId, setSavingItemId] = useState<string | null>(null);
  const [applyingSuggestions, setApplyingSuggestions] = useState(false);

  const ctx: OutpatientIntegrationContext = useMemo(
    () => ({
      sessionId: counselingSessionId,
      ...integrationContext,
    }),
    [counselingSessionId, integrationContext],
  );

  const { hints } = useOutpatientChecklistHints(ctx);

  const load = useCallback(async () => {
    setLoading(true);
    const data = await ipManagementApi.getCounsellorOutpatientChecklist(counselingSessionId);
    setChecklist(data);
    setLoading(false);
  }, [counselingSessionId]);

  useEffect(() => {
    load();
  }, [load]);

  const rollupCards = useMemo(() => {
    if (!checklist) return [];
    return computeRollupCards(checklist.items, hints, ctx);
  }, [checklist, hints, ctx]);

  const pendingSuggestions = useMemo(() => {
    if (!checklist) return [];
    return checklist.items
      .filter((item) => !item.isCompleted && !item.isBypassed)
      .map((item) => ({ item, hint: hintForItem(hints, item.itemKey) }))
      .filter(
        (x): x is { item: typeof x.item; hint: NonNullable<typeof x.hint> } =>
          Boolean(x.hint?.suggestedComplete),
      );
  }, [checklist, hints]);

  const flushDraft = useCallback(
    async (options?: { silent?: boolean }) => {
      if (readOnly || pendingSuggestions.length === 0) return true;
      setApplyingSuggestions(true);
      let applied = 0;
      for (const { item, hint } of pendingSuggestions) {
        const updated = await ipManagementApi.saveCounsellorOutpatientCompletion(
          counselingSessionId,
          item.itemId,
          { isCompleted: true, notes: `Auto-suggested from ${hint.source}` },
        );
        if (updated) {
          setChecklist(updated);
          applied++;
        }
      }
      setApplyingSuggestions(false);
      if (applied > 0 && !options?.silent) {
        toast.success(`Applied ${applied} integration suggestion(s)`);
      }
      return applied > 0 || pendingSuggestions.length === 0;
    },
    [readOnly, pendingSuggestions, counselingSessionId],
  );

  useImperativeHandle(ref, () => ({ flushDraft }), [flushDraft]);

  async function toggleItem(itemId: string, currentlyDone: boolean) {
    if (readOnly) return;
    setSavingItemId(itemId);
    const updated = await ipManagementApi.saveCounsellorOutpatientCompletion(
      counselingSessionId,
      itemId,
      { isCompleted: !currentlyDone },
    );
    if (updated) {
      setChecklist(updated);
    } else {
      toast.error('Failed to save checklist item');
    }
    setSavingItemId(null);
  }

  async function applyAllSuggestions() {
    await flushDraft({ silent: false });
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8 text-sm text-counselling-muted-foreground">
        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        Loading safety checklist…
      </div>
    );
  }

  if (!checklist || checklist.items.length === 0) {
    return (
      <p className="py-4 text-sm text-counselling-muted-foreground">
        Outpatient safety checklist is not configured. Contact your administrator.
      </p>
    );
  }

  const { completedItems, totalItems } = checklist;
  const pct = totalItems > 0 ? Math.round((completedItems / totalItems) * 100) : 0;

  return (
    <div className="space-y-3">
      {showRollup && rollupCards.length > 0 && (
        <OutpatientChecklistRollup
          cards={rollupCards}
          onCardClick={(key) => {
            const targetKey = ROLLUP_DRILLDOWN_TARGETS[key];
            const el = document.querySelector(`[data-outpatient-item="${targetKey}"]`);
            el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
          }}
        />
      )}

      <div className="flex items-center justify-between rounded-lg border border-counselling-border bg-counselling-muted px-3 py-2">
        <span className="text-sm font-semibold text-counselling-foreground">
          Outpatient Safety Checklist
        </span>
        <span className="text-sm font-medium text-counselling-muted-foreground">
          {completedItems}/{totalItems} complete
          <span className="ml-1 text-counselling-muted-foreground/70">({pct}%)</span>
        </span>
      </div>

      {!readOnly && pendingSuggestions.length > 0 && (
        <button
          type="button"
          disabled={applyingSuggestions}
          onClick={applyAllSuggestions}
          className="flex items-center gap-1.5 text-xs font-medium text-counselling-primary bg-counselling-accent border border-counselling-primary/30 rounded-lg px-3 py-1.5 hover:bg-counselling-accent/80 disabled:opacity-50"
        >
          <Sparkles className="h-3.5 w-3.5" />
          {applyingSuggestions
            ? 'Applying…'
            : `Apply ${pendingSuggestions.length} lab/optometry suggestion(s)`}
        </button>
      )}

      <ul className="divide-y divide-counselling-border overflow-hidden rounded-2xl border border-counselling-border">
        {checklist.items.map((item) => {
          const done = item.isCompleted || item.isBypassed;
          const isSaving = savingItemId === item.itemId;
          const hint = hintForItem(hints, item.itemKey);

          return (
            <li
              key={item.itemId}
              data-outpatient-item={item.itemKey}
              className={[
                'flex items-start gap-3 px-3 py-2.5 transition-colors',
                done ? 'bg-counselling-accent/50' : 'bg-counselling-card',
              ].join(' ')}
            >
              <button
                type="button"
                disabled={readOnly || isSaving}
                onClick={() => toggleItem(item.itemId, item.isCompleted)}
                className={[
                  'mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded border transition-colors',
                  done
                    ? 'border-counselling-primary bg-counselling-primary text-white'
                    : 'border-counselling-border bg-counselling-card hover:border-counselling-primary',
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
                <p className={`text-sm ${done ? 'text-counselling-muted-foreground' : 'text-counselling-foreground'}`}>
                  {item.itemLabel}
                </p>
                {item.description && (
                  <p className="text-xs text-counselling-muted-foreground mt-0.5">{item.description}</p>
                )}
                {hint && (
                  <p
                    className={`text-[10px] mt-1 ${hint.suggestedComplete ? 'text-counselling-primary' : 'text-counselling-muted-foreground/80'}`}
                  >
                    {hint.label}
                    {hint.detail ? ` · ${hint.detail}` : ''}
                  </p>
                )}
                {item.itemKey === 'fellow_workup_done' && item.completedByRole && (
                  <p className="text-[10px] mt-1 text-slate-500">
                    Completed by: {item.completedByRole}
                  </p>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
});
