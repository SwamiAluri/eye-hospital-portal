'use client';

import { memo } from 'react';
import { CheckCircle2, Circle, ArrowUpRight } from 'lucide-react';
import { WARD_PREOP_V2_TEST_IDS } from '@/lib/ip-management/ward-preop-test-ids';

export interface DerivedTickProps {
  /** Stable key for test IDs. */
  itemKey: string;
  label: string;
  description?: string;
  /** Whether the upstream canonical fact is satisfied. */
  satisfied: boolean;
  /** Where the truth lives, e.g. "Investigations", "Vitals". */
  sourceLabel: string;
  /** Deep-link to the canonical writer. */
  onNavigateSource?: () => void;
  /** Shown when not yet satisfied, e.g. "Awaiting result". */
  pendingHint?: string;
  className?: string;
}

/**
 * Read-only checklist row that is auto-satisfied from a single canonical writer
 * elsewhere (derived tick — blueprint §10). Has NO editable control: it cannot be
 * ticked manually, preventing the duplicate data-entry the redesign eliminates.
 */
function DerivedTickBase({
  itemKey,
  label,
  description,
  satisfied,
  sourceLabel,
  onNavigateSource,
  pendingHint,
  className = '',
}: DerivedTickProps) {
  const Icon = satisfied ? CheckCircle2 : Circle;

  return (
    <div
      data-testid={WARD_PREOP_V2_TEST_IDS.derivedTick(itemKey)}
      aria-disabled="true"
      className={`flex items-start gap-2.5 rounded-lg border px-3 py-2 ${
        satisfied ? 'border-emerald-100 bg-emerald-50/40' : 'border-gray-200 bg-gray-50/60'
      } ${className}`}
    >
      <Icon
        className={`mt-0.5 h-4 w-4 shrink-0 ${satisfied ? 'text-emerald-600' : 'text-gray-300'}`}
        aria-hidden="true"
      />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
          <span className={`text-sm ${satisfied ? 'text-gray-800' : 'text-gray-600'}`}>{label}</span>
          <span className="sr-only">{satisfied ? 'Satisfied' : 'Not yet satisfied'}.</span>
          <span className="text-[11px] text-gray-400">Auto-tracked</span>
        </div>
        {description && <p className="mt-0.5 text-xs text-gray-500">{description}</p>}
        {!satisfied && pendingHint && (
          <p className="mt-0.5 text-xs text-amber-700">{pendingHint}</p>
        )}
      </div>

      {onNavigateSource ? (
        <button
          type="button"
          data-testid={WARD_PREOP_V2_TEST_IDS.derivedTickSource(itemKey)}
          onClick={onNavigateSource}
          className="inline-flex shrink-0 items-center gap-0.5 rounded-md px-1.5 py-0.5 text-[11px] font-medium text-indigo-600 hover:bg-indigo-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
        >
          {sourceLabel}
          <ArrowUpRight className="h-3 w-3" aria-hidden="true" />
        </button>
      ) : (
        <span className="shrink-0 text-[11px] text-gray-400">from {sourceLabel}</span>
      )}
    </div>
  );
}

/**
 * Memoized (Phase 12): derived ticks re-render only when their satisfied/label/
 * hint props change, not on every parent panel refresh.
 */
export const DerivedTick = memo(DerivedTickBase);
DerivedTick.displayName = 'DerivedTick';
