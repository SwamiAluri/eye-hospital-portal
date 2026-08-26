'use client';

import { WARD_PREOP_TEST_IDS } from '@/lib/ip-management/ward-preop-test-ids';

const PRE_OP_STATES = new Set(['Expected', 'Admitted', 'ReadyForSurgery']);

export interface WardReadinessMeterProps {
  clinicalState: string;
  /** Pre-op milestones completed (server-computed rollup). */
  completed?: number | null;
  /** Pre-op milestones total (server-computed rollup). */
  total?: number | null;
  /** Critical investigation results entered but not yet verified. */
  unverifiedCriticalCount?: number | null;
  /** Pre-anaesthetic check sign-off complete. */
  pacCompleted?: boolean | null;
  /** P2 §2 department clearance flagged for ward attention. */
  p2NeedsAttention?: boolean | null;
  /**
   * `row` (default): compact bar + at most one muted blocker word, no fraction.
   * `detail`: full-width bar + the `X of N` fraction (used in the patient drawer).
   */
  variant?: 'row' | 'detail';
}

type Tone = 'critical' | 'progress' | 'complete';

/**
 * Single readiness indicator for ward list rows: one thin bar plus, at most,
 * one muted blocker word. The completed/total fraction is intentionally not
 * shown here — it surfaces in the patient drawer. Pre-op states only.
 */
export function WardReadinessMeter({
  clinicalState,
  completed,
  total,
  unverifiedCriticalCount,
  pacCompleted,
  p2NeedsAttention,
  variant = 'row',
}: WardReadinessMeterProps) {
  if (!PRE_OP_STATES.has(clinicalState)) return null;
  if (total == null || total <= 0) return null;

  const done = Math.max(0, Math.min(completed ?? 0, total));
  const percent = Math.round((done / total) * 100);
  const isComplete = done >= total;

  const criticalLabs = (unverifiedCriticalCount ?? 0) > 0;
  const deptAttention = p2NeedsAttention === true;
  const pacPending = pacCompleted === false && clinicalState !== 'Expected';

  // At most one muted blocker word, highest clinical priority first.
  const blocker = criticalLabs ? 'Labs'
    : deptAttention ? 'Dept'
    : pacPending ? 'PAC'
    : null;

  const tone: Tone = (criticalLabs || deptAttention) ? 'critical'
    : isComplete ? 'complete'
    : 'progress';

  const fillClass = tone === 'critical' ? 'bg-rose-500'
    : tone === 'complete' ? 'bg-emerald-500'
    : 'bg-blue-500';

  const ariaText = `Pre-op readiness ${done} of ${total}${blocker ? `, pending ${blocker}` : ''}`;

  if (variant === 'detail') {
    return (
      <div
        data-testid={WARD_PREOP_TEST_IDS.readinessMeter}
        data-readiness-percent={percent}
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={total}
        aria-valuenow={done}
        aria-valuetext={ariaText}
        aria-label={ariaText}
      >
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-xs font-semibold uppercase tracking-wide text-gray-500">Pre-op readiness</span>
          <span className="text-sm font-bold text-gray-900">{done} <span className="text-gray-400 font-medium">/ {total}</span></span>
        </div>
        <span className="block w-full h-2 rounded-full bg-gray-200 overflow-hidden">
          <span
            className={`block h-full rounded-full transition-all ${fillClass}`}
            style={{ width: `${Math.max(percent, 4)}%` }}
          />
        </span>
        {blocker && (
          <span className="inline-flex items-center mt-1.5 text-[11px] font-medium text-gray-500">
            Pending: {blocker}
          </span>
        )}
      </div>
    );
  }

  return (
    <div
      data-testid={WARD_PREOP_TEST_IDS.readinessMeter}
      data-readiness-percent={percent}
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={total}
      aria-valuenow={done}
      aria-valuetext={ariaText}
      className="meter"
      title={`Pre-op readiness ${done}/${total}`}
      aria-label={ariaText}
    >
      <span className="track">
        <span
          className={`fill ${tone === 'critical' ? 'critical' : isComplete ? 'ok' : ''}`}
          style={{ width: `${Math.max(percent, 4)}%` }}
        />
      </span>
      {blocker && (
        <span className="cell-sub" style={{ color: tone === 'critical' ? 'var(--ip-danger)' : undefined }}>{blocker}</span>
      )}
    </div>
  );
}
