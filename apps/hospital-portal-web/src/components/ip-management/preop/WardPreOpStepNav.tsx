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
  /** Per-step rollup — drives icon completion tint only (counts live in the readiness bar). */
  readiness?: Partial<Record<PreOpStepKey, StepReadiness>>;
}

/**
 * Vertical step rail for the Ward Pre-Op Workspace (Phase 14 — two-pane redesign).
 * Full step labels (no truncation); per-step X/Y counts live in the top readiness bar only.
 */
export function WardPreOpStepNav({
  activeStep,
  onStepChange,
  clinicalState,
  readiness,
}: WardPreOpStepNavProps) {
  const tabRefs = useRef<Record<string, HTMLButtonElement | null>>({});

  // Admission-gated steps (Evaluation / PAC / Anaesthesia / Records) are hidden from the rail pre-admit.
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
        'group flex min-h-[2.75rem] shrink-0 items-center gap-2.5 rounded-xl border px-3 py-2.5 text-left transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 lg:w-full',
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
      <span className="min-w-0 flex-1 text-sm font-medium leading-snug">{step.label}</span>

      {locked && (
        <Lock className="h-3.5 w-3.5 shrink-0 text-gray-400 lg:ml-auto" aria-hidden="true" />
      )}
    </button>
  );
});
