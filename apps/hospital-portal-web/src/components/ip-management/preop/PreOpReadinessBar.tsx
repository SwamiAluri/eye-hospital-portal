'use client';

import type { ReactNode } from 'react';
import { Loader2, ShieldCheck } from 'lucide-react';
import type { PreOpReadiness } from '@/lib/ip-management/preop-readiness';
import { ReadinessMeter } from './primitives/ReadinessMeter';
import { WARD_PREOP_TEST_IDS } from '@/lib/ip-management/ward-preop-test-ids';

export interface PreOpReadinessBarProps {
  readiness: PreOpReadiness | null;
  loading: boolean;
  /** Next-transition gate verdict, surfaced at the top instead of the footer. */
  gateSlot?: ReactNode;
}

/**
 * Sticky readiness bar (blueprint §5/§1) — the single "can we operate?" verdict,
 * moved from the footer to the top. Aggregates per-step readiness from the Phase 13
 * rollup: how many steps are ready and how many mandatory blockers remain.
 */
export function PreOpReadinessBar({
  readiness,
  loading,
  gateSlot,
}: PreOpReadinessBarProps) {
  const allReady =
    !!readiness
    && readiness.countableSteps > 0
    && readiness.readySteps === readiness.countableSteps
    && readiness.blockers === 0;

  return (
    <div
      data-testid={WARD_PREOP_TEST_IDS.readinessBar}
      className="flex flex-col gap-2 rounded-xl border border-gray-200 bg-gray-50/80 px-4 py-2.5 sm:flex-row sm:items-center sm:justify-between"
    >
      <div className="flex min-w-0 flex-1 items-center gap-3">
        <ShieldCheck
          className={`h-4 w-4 shrink-0 ${allReady ? 'text-emerald-600' : 'text-indigo-600'}`}
          aria-hidden="true"
        />
        {loading || !readiness ? (
          <span className="flex items-center gap-2 text-xs text-gray-500">
            <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" /> Checking readiness…
          </span>
        ) : (
          <div className="min-w-0 flex-1">
            <p
              data-testid={WARD_PREOP_TEST_IDS.readinessSummary}
              aria-live="polite"
              title="Counts the steps that gate surgery. Ongoing/action steps (Nursing & Records, Admit) are not included."
              className="text-sm font-semibold text-gray-800"
            >
              {allReady
                ? 'All steps ready for surgery'
                : `${readiness.readySteps} of ${readiness.countableSteps} steps ready`}
            </p>
            <ReadinessMeter
              completed={readiness.readySteps}
              total={readiness.countableSteps}
              blockers={readiness.blockers}
              unitLabel="steps ready"
              size="sm"
              hideText
              className="mt-1 max-w-xs"
            />
          </div>
        )}
      </div>

      {gateSlot && <div className="shrink-0">{gateSlot}</div>}
    </div>
  );
}
