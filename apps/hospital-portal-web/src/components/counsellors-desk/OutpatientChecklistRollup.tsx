'use client';

import type { RollupCardState } from '@/lib/ip-checklist/outpatient-integration';
import { counsellingSessionTokens } from '@/lib/counsellors-desk/counselling-session-tokens';
import { cn } from '@/lib/utils';

const STATUS_STYLES: Record<RollupCardState['status'], string> = {
  Done: 'bg-green-50 border-green-200 text-green-800',
  Pending: 'bg-amber-50 border-amber-200 text-amber-800',
  NotRequired: 'bg-slate-50 border-slate-200 text-slate-600',
};

const STATUS_LABEL: Record<RollupCardState['status'], string> = {
  Done: 'Done',
  Pending: 'Pending',
  NotRequired: 'N/A',
};

const READBACK_VALUE: Record<RollupCardState['status'], string> = {
  Done: counsellingSessionTokens.sessionStatusDetailValueSuccess,
  Pending: counsellingSessionTokens.sessionStatusDetailValueWarning,
  NotRequired: counsellingSessionTokens.sessionStatusDetailValue,
};

export type OutpatientChecklistRollupVariant = 'cards' | 'readback';

export interface OutpatientChecklistRollupProps {
  cards: RollupCardState[];
  onCardClick?: (cardKey: RollupCardState['key']) => void;
  /** cards = KPI tiles (session default); readback = compact status strip (finalize modal). */
  variant?: OutpatientChecklistRollupVariant;
}

function formatReadbackValue(card: RollupCardState): string {
  const label = STATUS_LABEL[card.status];
  if (card.total > 0 && card.key !== 'payment' && card.key !== 'preAuth') {
    return `${label} · ${card.completed}/${card.total}`;
  }
  if (card.key === 'preAuth' && card.total > 0) {
    return `${label} · ${card.completed}/${card.total}`;
  }
  return label;
}

export function OutpatientChecklistRollup({
  cards,
  onCardClick,
  variant = 'cards',
}: OutpatientChecklistRollupProps) {
  if (variant === 'readback') {
    return (
      <div
        data-rollup-variant="readback"
        className={counsellingSessionTokens.sessionStatusDetails}
      >
        {cards.map((card) => {
          const interactive = Boolean(onCardClick);
          const className = cn(
            'min-w-0 text-left',
            interactive &&
              'rounded-sm transition-colors hover:bg-counselling-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-counselling-primary/40',
          );
          const body = (
            <>
              <p className={counsellingSessionTokens.sessionStatusDetailLabel}>{card.label}</p>
              <p className={cn(READBACK_VALUE[card.status], 'mt-0.5')}>
                {formatReadbackValue(card)}
              </p>
            </>
          );
          if (interactive) {
            return (
              <button
                key={card.key}
                type="button"
                onClick={() => onCardClick?.(card.key)}
                className={className}
              >
                {body}
              </button>
            );
          }
          return (
            <div key={card.key} className={className}>
              {body}
            </div>
          );
        })}
      </div>
    );
  }

  return (
    <div data-rollup-variant="cards" className="grid grid-cols-2 gap-2 sm:grid-cols-4">
      {cards.map((card) => (
        <button
          type="button"
          key={card.key}
          onClick={() => onCardClick?.(card.key)}
          className={`rounded-lg border px-3 py-2.5 text-left transition-opacity hover:opacity-90 ${
            onCardClick ? 'cursor-pointer' : 'cursor-default'
          } ${STATUS_STYLES[card.status]}`}
        >
          <p className="text-[10px] font-bold uppercase tracking-wide opacity-70">{card.label}</p>
          <p className="mt-0.5 text-sm font-semibold">{STATUS_LABEL[card.status]}</p>
          {card.total > 0 && card.key !== 'payment' && card.key !== 'preAuth' && (
            <p className="mt-0.5 text-[10px] opacity-80">
              {card.completed}/{card.total} items
            </p>
          )}
        </button>
      ))}
    </div>
  );
}
