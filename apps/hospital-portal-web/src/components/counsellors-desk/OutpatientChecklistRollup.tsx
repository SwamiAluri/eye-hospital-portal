'use client';

import type { RollupCardState } from '@/lib/ip-checklist/outpatient-integration';

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

export interface OutpatientChecklistRollupProps {
  cards: RollupCardState[];
  onCardClick?: (cardKey: RollupCardState['key']) => void;
}

export function OutpatientChecklistRollup({ cards, onCardClick }: OutpatientChecklistRollupProps) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
      {cards.map(card => (
        <button
          type="button"
          key={card.key}
          onClick={() => onCardClick?.(card.key)}
          className={`rounded-lg border px-3 py-2.5 text-left transition-opacity hover:opacity-90 ${
            onCardClick ? 'cursor-pointer' : 'cursor-default'
          } ${STATUS_STYLES[card.status]}`}
        >
          <p className="text-[10px] font-bold uppercase tracking-wide opacity-70">{card.label}</p>
          <p className="text-sm font-semibold mt-0.5">{STATUS_LABEL[card.status]}</p>
          {card.total > 0 && card.key !== 'payment' && card.key !== 'preAuth' && (
            <p className="text-[10px] mt-0.5 opacity-80">
              {card.completed}/{card.total} items
            </p>
          )}
        </button>
      ))}
    </div>
  );
}
