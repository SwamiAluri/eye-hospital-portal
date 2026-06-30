'use client';

import { forwardRef, useRef } from 'react';
import { Lock } from 'lucide-react';
import {
  visiblePreOpSteps,
  isStepLocked,
  type PreOpStepKey,
  type PreOpStepMeta,
} from '@/lib/ip-management/preop-steps';
import type { StepReadiness } from '@/lib/ip-management/preop-readiness';
import { WARD_PREOP_TEST_IDS } from '@/lib/ip-management/ward-preop-test-ids';

export interface WardPreOpStepNavProps {
  activeStep: PreOpStepKey;
  onStepChange: (step: PreOpStepKey) => void;
  clinicalState: string;
  /** Per-step rollup readiness (Phase 13) — drives inline counts + blocker dots. */
  readiness?: Partial<Record<PreOpStepKey, StepReadiness>>;
}

/**
 * Vertical step rail for the Ward Pre-Op Workspace (Phase 14 — two-pane redesign).
 * Replaces the horizontal scrolling tab strip: all steps are visible at once with no
 * right-scroll, matching the EMR side-nav pattern. Accessible vertical tablist with
 * roving Up/Down focus, Home/End, aria-selected.
 *
 * Each row shows ONE status token — a colored count chip (grey = in progress,
 * green = complete) with a small red blocker dot — instead of the old count +
 * blocker badge + redundant "In progress" StatusChip trio.
 *
 * Steps that carry no readiness count (Nursing & Records, Admit — `hasCount:false`)
 * render a muted "ongoing/not-counted" marker instead of a count chip, so the rail's
 * visible step list reconciles with the readiness bar's "X of N steps ready" verdict
 * (N excludes these steps). See docs/ward-preop-redesign — Phase 1 (D2).
 */
export function WardPreOpStepNav({
  activeStep,
  onStepChange,
  clinicalState,
  readiness,
}: WardPreOpStepNavProps) {
  const tabRefs = useRef<Record<string, HTMLButtonElement | null>>({});

  // Admission-gated steps (Evaluation / Anaesthesia / Records) are hidden from the rail pre-admit.
  const steps = visiblePreOpSteps(clinicalState);

  function focusStep(key: PreOpStepKey) {
    tabRefs.current[key]?.focus();
  }

  function onKeyDown(e: React.KeyboardEvent, index: number) {
    const last = steps.length - 1;
    let nextIndex: number | null = null;
    switch (e.key) {
      case 'ArrowDown':
        nextIndex = index === last ? 0 : index + 1;
        break;
      case 'ArrowUp':
        nextIndex = index === 0 ? last : index - 1;
        break;
      case 'Home':
        nextIndex = 0;
        break;
      case 'End':
        nextIndex = last;
        break;
      default:
        return;
    }
    e.preventDefault();
    const next = steps[nextIndex];
    onStepChange(next.key);
    focusStep(next.key);
  }

  return (
    <div
      role="tablist"
      aria-orientation="vertical"
      aria-label="Pre-operative workflow steps"
      data-testid={WARD_PREOP_TEST_IDS.stepNav}
      className="flex gap-1 overflow-x-auto p-1 lg:flex-col lg:overflow-x-visible"
    >
      {steps.map((step, index) => (
        <StepTab
          key={step.key}
          ref={el => {
            tabRefs.current[step.key] = el;
          }}
          step={step}
          active={activeStep === step.key}
          locked={isStepLocked(step, clinicalState)}
          readiness={readiness?.[step.key]}
          onSelect={() => onStepChange(step.key)}
          onKeyDown={e => onKeyDown(e, index)}
        />
      ))}
    </div>
  );
}

interface StepTabProps {
  step: PreOpStepMeta;
  active: boolean;
  locked: boolean;
  readiness?: StepReadiness;
  onSelect: () => void;
  onKeyDown: (e: React.KeyboardEvent) => void;
}

const StepTab = forwardRef<HTMLButtonElement, StepTabProps>(function StepTab(
  { step, active, locked, readiness, onSelect, onKeyDown },
  ref,
) {
  const Icon = step.icon;
  const done = readiness?.status === 'completed';
  const blocking = readiness?.blocking ?? 0;

  return (
    <button
      ref={ref}
      type="button"
      role="tab"
      aria-selected={active}
      tabIndex={active ? 0 : -1}
      data-testid={WARD_PREOP_TEST_IDS.stepTab(step.key)}
      onClick={onSelect}
      onKeyDown={onKeyDown}
      title={locked ? `${step.label} — unlocks after admission` : step.label}
      className={[
        'group flex min-h-[2.75rem] shrink-0 items-center gap-2.5 rounded-xl border px-3 py-2 text-left transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 lg:w-full',
        active
          ? 'border-indigo-200 bg-indigo-50 text-indigo-700'
          : 'border-transparent text-gray-600 hover:bg-gray-50',
      ].join(' ')}
    >
      <span
        className={[
          'flex h-6 w-6 shrink-0 items-center justify-center rounded-full',
          active ? 'bg-indigo-600 text-white' : done ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-500',
        ].join(' ')}
        aria-hidden="true"
      >
        <Icon className="h-3.5 w-3.5" />
      </span>
      <span className="hidden min-w-0 flex-1 truncate text-sm font-medium lg:block">{step.label}</span>
      <span className="whitespace-nowrap text-xs font-medium lg:hidden">{step.short}</span>

      {locked ? (
        <Lock className="h-3.5 w-3.5 shrink-0 text-gray-400 lg:ml-auto" aria-hidden="true" />
      ) : readiness?.hasCount ? (
        <span className="flex shrink-0 items-center gap-1.5 lg:ml-auto">
          {blocking > 0 && (
            <span
              title={`${blocking} mandatory blocker${blocking === 1 ? '' : 's'}`}
              aria-label={`${blocking} mandatory blockers`}
              className="h-1.5 w-1.5 rounded-full bg-red-500"
            />
          )}
          <span
            data-testid={WARD_PREOP_TEST_IDS.stepTabCount(step.key)}
            className={[
              'whitespace-nowrap rounded-full px-1.5 py-0.5 text-[10px] font-semibold tabular-nums',
              done ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-600',
            ].join(' ')}
          >
            {readiness.completed}/{readiness.total}
          </span>
        </span>
      ) : (
        // `hasCount:false` step (Nursing & Records, Admit): not part of the readiness
        // count — show a muted marker so the rail reconciles with "X of N steps ready".
        readiness && (
          <span
            data-testid={WARD_PREOP_TEST_IDS.stepTabInfo(step.key)}
            title="Ongoing — not part of the readiness count"
            className="flex shrink-0 items-center lg:ml-auto"
          >
            <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-slate-300" />
            <span className="sr-only">Not counted toward readiness</span>
          </span>
        )
      )}
    </button>
  );
});
