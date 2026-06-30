'use client';

import { AlertTriangle } from 'lucide-react';
import { WARD_PREOP_V2_TEST_IDS } from '@/lib/ip-management/ward-preop-test-ids';

export interface ReadinessMeterProps {
  completed: number;
  total: number;
  /** Number of hard blockers (renders red emphasis). */
  blockers?: number;
  /** Trailing noun, e.g. "ready", "cleared". */
  unitLabel?: string;
  size?: 'sm' | 'md';
  /** Hide the textual summary, show bar only. */
  hideText?: boolean;
  className?: string;
}

/**
 * Compact readiness indicator shared by the sticky gate bar and per-step headers
 * (blueprint §6, §13). Communicates progress with a bar + text + (optional) blocker
 * count — accessible as a labelled progressbar.
 */
export function ReadinessMeter({
  completed,
  total,
  blockers = 0,
  unitLabel = 'ready',
  size = 'md',
  hideText = false,
  className = '',
}: ReadinessMeterProps) {
  const safeTotal = Math.max(total, 0);
  const safeCompleted = Math.min(Math.max(completed, 0), safeTotal || completed);
  const pct = safeTotal === 0 ? 0 : Math.round((safeCompleted / safeTotal) * 100);
  const allDone = safeTotal > 0 && safeCompleted >= safeTotal && blockers === 0;

  const barColor = blockers > 0 ? 'bg-red-500' : allDone ? 'bg-emerald-500' : 'bg-indigo-500';
  const barHeight = size === 'sm' ? 'h-1.5' : 'h-2';
  const textSize = size === 'sm' ? 'text-[11px]' : 'text-xs';

  const summary = `${safeCompleted} of ${safeTotal} ${unitLabel}`;

  return (
    <div
      data-testid={WARD_PREOP_V2_TEST_IDS.readinessMeter}
      className={`flex items-center gap-2 ${className}`}
    >
      <div
        role="progressbar"
        aria-valuenow={safeCompleted}
        aria-valuemin={0}
        aria-valuemax={safeTotal}
        aria-label={`${summary}${blockers > 0 ? `, ${blockers} blocker${blockers === 1 ? '' : 's'}` : ''}`}
        className={`relative w-full min-w-[3rem] overflow-hidden rounded-full bg-gray-200 ${barHeight}`}
      >
        <div
          className={`${barHeight} rounded-full transition-all ${barColor}`}
          style={{ width: `${pct}%` }}
        />
      </div>

      {!hideText && (
        <div className={`flex shrink-0 items-center gap-1.5 font-medium ${textSize}`}>
          <span className={allDone ? 'text-emerald-700' : 'text-gray-600'}>{summary}</span>
          {blockers > 0 && (
            <span className="inline-flex items-center gap-0.5 text-red-600">
              <AlertTriangle className="h-3 w-3" aria-hidden="true" />
              {blockers} blocker{blockers === 1 ? '' : 's'}
            </span>
          )}
        </div>
      )}
    </div>
  );
}
