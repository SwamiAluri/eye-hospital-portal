'use client';

import { forwardRef, useRef } from 'react';
import { Check, ShieldAlert } from 'lucide-react';
import {
  DISCHARGE_STEPS,
  type DischargeStepKey,
  type DischargeStepMeta,
} from '@/lib/ip-management/discharge-steps';
import { WARD_DISCHARGE_TEST_IDS } from '@/lib/ip-management/ward-discharge-test-ids';

export type DischargeStepStatus = 'idle' | 'done' | 'blocked';

export interface WardDischargeStepNavProps {
  activeStep: DischargeStepKey;
  onStepChange: (step: DischargeStepKey) => void;
  stepStatus?: Partial<Record<DischargeStepKey, DischargeStepStatus>>;
}

export function WardDischargeStepNav({
  activeStep,
  onStepChange,
  stepStatus,
}: WardDischargeStepNavProps) {
  const tabRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const steps = DISCHARGE_STEPS;

  function focusStep(key: DischargeStepKey) {
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
      aria-label="Discharge workflow steps"
      data-testid={WARD_DISCHARGE_TEST_IDS.stepNav}
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
          status={stepStatus?.[step.key] ?? 'idle'}
          onSelect={() => onStepChange(step.key)}
          onKeyDown={e => onKeyDown(e, index)}
        />
      ))}
    </div>
  );
}

interface StepTabProps {
  step: DischargeStepMeta;
  active: boolean;
  status: DischargeStepStatus;
  onSelect: () => void;
  onKeyDown: (e: React.KeyboardEvent) => void;
}

const StepTab = forwardRef<HTMLButtonElement, StepTabProps>(function StepTab(
  { step, active, status, onSelect, onKeyDown },
  ref,
) {
  const Icon = step.icon;
  const done = status === 'done';
  const blocked = status === 'blocked';

  return (
    <button
      ref={ref}
      type="button"
      role="tab"
      aria-selected={active}
      tabIndex={active ? 0 : -1}
      data-testid={WARD_DISCHARGE_TEST_IDS.stepTab(step.key)}
      onClick={onSelect}
      onKeyDown={onKeyDown}
      className={[
        'group flex min-h-[2.75rem] shrink-0 items-center gap-2.5 rounded-xl border px-3 py-2.5 text-left transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 lg:w-full',
        active
          ? blocked
            ? 'border-red-200 bg-red-50 text-red-800'
            : 'border-emerald-200 bg-emerald-50 text-emerald-800'
          : blocked
            ? 'border-transparent text-red-700 hover:bg-red-50'
            : 'border-transparent text-gray-600 hover:bg-gray-50',
      ].join(' ')}
    >
      <span
        className={[
          'flex h-6 w-6 shrink-0 items-center justify-center rounded-full',
          active
            ? blocked
              ? 'bg-red-600 text-white'
              : 'bg-emerald-600 text-white'
            : done
              ? 'bg-emerald-100 text-emerald-700'
              : blocked
                ? 'bg-red-100 text-red-700'
                : 'bg-gray-100 text-gray-500',
        ].join(' ')}
        aria-hidden="true"
      >
        {done ? (
          <Check className="h-3.5 w-3.5" />
        ) : blocked && step.isGate ? (
          <ShieldAlert className="h-3.5 w-3.5" />
        ) : (
          <Icon className="h-3.5 w-3.5" />
        )}
      </span>
      <span className="min-w-0 flex-1 text-sm font-medium leading-snug">{step.label}</span>
    </button>
  );
});
